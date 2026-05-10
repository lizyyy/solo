import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from inventory.models import (
    Transfer, TransferItem, Store, Product, Inventory,
    TRANSFER_STATUS_PENDING, TRANSFER_STATUS_APPROVED,
    TRANSFER_STATUS_IN_TRANSIT, TRANSFER_STATUS_COMPLETED,
    TRANSFER_STATUS_FAILED, TRANSFER_STATUS_CANCELLED
)
from inventory.services.audit_service import AuditService
from inventory.services.inventory_service import InventoryService
from inventory.services.retry_service import with_retry, RecoveryService


class TransferService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.audit = AuditService(db_session)
        self.inventory_service = InventoryService(db_session)
        self.recovery = RecoveryService(self.audit)

    def generate_transfer_no(self) -> str:
        now = datetime.now()
        unique_suffix = uuid.uuid4().hex[:4].upper()
        count = self.db.query(Transfer).filter(
            Transfer.created_at >= now.replace(hour=0, minute=0, second=0)
        ).count() + 1
        return f'TF{now.strftime("%Y%m%d%H%M%S")}{count:03d}{unique_suffix}'

    def create_transfer(
        self,
        from_store_code: str,
        to_store_code: str,
        items: List[Dict[str, Any]],
        created_by: str = 'system',
        priority: str = 'normal',
        notes: str = ''
    ) -> Transfer:
        from_store = self.db.query(Store).filter(Store.code == from_store_code).first()
        to_store = self.db.query(Store).filter(Store.code == to_store_code).first()

        if not from_store or not to_store:
            raise ValueError(f"Store not found: from={from_store_code}, to={to_store_code}")

        transfer_no = self.generate_transfer_no()
        transfer = Transfer(
            transfer_no=transfer_no,
            from_store_id=from_store.id,
            to_store_id=to_store.id,
            status=TRANSFER_STATUS_PENDING,
            priority=priority,
            created_by=created_by,
            notes=notes
        )
        self.db.add(transfer)
        self.db.flush()

        total_qty = 0
        total_amount = 0.0

        for item_data in items:
            sku = item_data['sku']
            product = self.db.query(Product).filter(Product.sku == sku).first()
            if not product:
                raise ValueError(f"Product not found: {sku}")

            qty = item_data['quantity']
            unit_price = item_data.get('unit_price', product.base_sale_price)

            inventory = self.inventory_service.get_or_create_inventory(from_store.id, product.id)
            if inventory.available_quantity < qty:
                raise ValueError(
                    f"Insufficient stock for {sku}: "
                    f"available={inventory.available_quantity}, requested={qty}"
                )

            transfer_item = TransferItem(
                transfer_id=transfer.id,
                product_id=product.id,
                requested_quantity=qty,
                unit_price=unit_price,
                total_price=qty * unit_price
            )
            self.db.add(transfer_item)

            total_qty += qty
            total_amount += qty * unit_price

        transfer.total_quantity = total_qty
        transfer.total_amount = total_amount

        self.audit.log_create(
            resource_type='TRANSFER',
            new_value={
                'transfer_no': transfer_no,
                'from_store': from_store_code,
                'to_store': to_store_code,
                'items': items
            },
            username=created_by
        )

        return transfer

    def approve_transfer(
        self,
        transfer_no: str,
        approved_by: str
    ) -> Transfer:
        transfer = self._get_transfer(transfer_no)

        if transfer.status != TRANSFER_STATUS_PENDING:
            raise ValueError(f"Cannot approve transfer with status: {transfer.status}")

        transfer.status = TRANSFER_STATUS_APPROVED
        transfer.approved_by = approved_by
        transfer.approved_at = datetime.utcnow()

        self.audit.log_update(
            resource_type='TRANSFER',
            resource_id=transfer.id,
            old_value={'status': TRANSFER_STATUS_PENDING},
            new_value={'status': TRANSFER_STATUS_APPROVED, 'approved_by': approved_by},
            username=approved_by
        )

        return transfer

    def ship_transfer(
        self,
        transfer_no: str,
        shipped_by: str
    ) -> Transfer:
        transfer = self._get_transfer(transfer_no)

        if transfer.status != TRANSFER_STATUS_APPROVED:
            raise ValueError(f"Cannot ship transfer with status: {transfer.status}")

        try:
            for item in transfer.items:
                success = self.inventory_service.reserve_quantity(
                    transfer.from_store_id,
                    item.product_id,
                    item.requested_quantity,
                    shipped_by
                )
                if not success:
                    raise ValueError(f"Failed to reserve quantity for product {item.product_id}")

                self.db.flush()

                self.inventory_service.adjust_quantity(
                    transfer.from_store_id,
                    item.product_id,
                    -item.requested_quantity,
                    f"Shipped via transfer {transfer_no}",
                    shipped_by,
                    transfer_no
                )

                item.shipped_quantity = item.requested_quantity

            transfer.status = TRANSFER_STATUS_IN_TRANSIT
            transfer.shipped_at = datetime.utcnow()

        except Exception as e:
            self._handle_transfer_error(transfer, 'SHIP', e, shipped_by)
            raise

        self.audit.log_update(
            resource_type='TRANSFER',
            resource_id=transfer.id,
            old_value={'status': TRANSFER_STATUS_APPROVED},
            new_value={'status': TRANSFER_STATUS_IN_TRANSIT},
            username=shipped_by
        )

        return transfer

    @with_retry(max_attempts=3)
    def receive_transfer(
        self,
        transfer_no: str,
        received_by: str,
        received_items: Optional[Dict[str, int]] = None
    ) -> Transfer:
        transfer = self._get_transfer(transfer_no)

        if transfer.status != TRANSFER_STATUS_IN_TRANSIT:
            raise ValueError(f"Cannot receive transfer with status: {transfer.status}")

        try:
            for item in transfer.items:
                if received_items and item.product.sku in received_items:
                    received_qty = received_items[item.product.sku]
                else:
                    received_qty = item.shipped_quantity

                self.inventory_service.adjust_quantity(
                    transfer.to_store_id,
                    item.product_id,
                    received_qty,
                    f"Received via transfer {transfer_no}",
                    received_by,
                    transfer_no
                )

                item.received_quantity = received_qty

            transfer.status = TRANSFER_STATUS_COMPLETED
            transfer.received_at = datetime.utcnow()

        except Exception as e:
            self._handle_transfer_error(transfer, 'RECEIVE', e, received_by)
            raise

        self.audit.log_update(
            resource_type='TRANSFER',
            resource_id=transfer.id,
            old_value={'status': TRANSFER_STATUS_IN_TRANSIT},
            new_value={'status': TRANSFER_STATUS_COMPLETED},
            username=received_by
        )

        return transfer

    def cancel_transfer(
        self,
        transfer_no: str,
        cancelled_by: str,
        reason: str = ''
    ) -> Transfer:
        transfer = self._get_transfer(transfer_no)

        if transfer.status not in [TRANSFER_STATUS_PENDING, TRANSFER_STATUS_APPROVED]:
            raise ValueError(f"Cannot cancel transfer with status: {transfer.status}")

        transfer.status = TRANSFER_STATUS_CANCELLED
        transfer.notes = (transfer.notes or '') + f"\nCancelled: {reason}" if reason else transfer.notes

        self.audit.log_update(
            resource_type='TRANSFER',
            resource_id=transfer.id,
            old_value={'status': transfer.status},
            new_value={'status': TRANSFER_STATUS_CANCELLED, 'reason': reason},
            username=cancelled_by
        )

        return transfer

    def retry_failed_transfer(
        self,
        transfer_no: str,
        username: str
    ) -> Tuple[bool, str]:
        transfer = self._get_transfer(transfer_no)

        if transfer.status != TRANSFER_STATUS_FAILED:
            return False, f"Transfer status is {transfer.status}, not failed"

        if transfer.retry_count >= transfer.max_retries:
            return False, f"Max retries ({transfer.max_retries}) exceeded"

        transfer.retry_count += 1
        transfer.error_message = None

        if transfer.shipped_at and not transfer.received_at:
            try:
                self.receive_transfer(transfer_no, username)
                return True, "Successfully received"
            except Exception as e:
                return False, str(e)

        return False, "Unknown transfer state"

    def get_transfer(self, transfer_no: str) -> Transfer:
        return self._get_transfer(transfer_no)

    def get_transfers(
        self,
        status: Optional[str] = None,
        from_store_id: Optional[int] = None,
        to_store_id: Optional[int] = None,
        limit: int = 100
    ) -> List[Transfer]:
        query = self.db.query(Transfer)

        if status:
            query = query.filter(Transfer.status == status)
        if from_store_id:
            query = query.filter(Transfer.from_store_id == from_store_id)
        if to_store_id:
            query = query.filter(Transfer.to_store_id == to_store_id)

        return query.order_by(Transfer.created_at.desc()).limit(limit).all()

    def _get_transfer(self, transfer_no: str) -> Transfer:
        transfer = self.db.query(Transfer).filter(Transfer.transfer_no == transfer_no).first()
        if not transfer:
            raise ValueError(f"Transfer not found: {transfer_no}")
        return transfer

    def _handle_transfer_error(
        self,
        transfer: Transfer,
        operation: str,
        error: Exception,
        username: str
    ):
        transfer.status = TRANSFER_STATUS_FAILED
        transfer.error_message = str(error)

        self.recovery.record_failure(
            transfer.transfer_no,
            'TRANSFER',
            {'transfer_no': transfer.transfer_no, 'operation': operation},
            str(error),
            operation
        )

        self.audit.log_error(
            action=f'TRANSFER_{operation}_FAILED',
            resource_type='TRANSFER',
            resource_id=transfer.id,
            error_message=str(error),
            username=username
        )
