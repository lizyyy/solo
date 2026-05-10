import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from inventory.models import (
    PriceChange, Store, Product, Inventory,
    PRICE_CHANGE_STATUS_DRAFT, PRICE_CHANGE_STATUS_PENDING,
    PRICE_CHANGE_STATUS_APPROVED, PRICE_CHANGE_STATUS_APPLIED,
    PRICE_CHANGE_STATUS_FAILED, PRICE_CHANGE_STATUS_CANCELLED
)
from inventory.services.audit_service import AuditService
from inventory.services.inventory_service import InventoryService
from inventory.services.retry_service import with_retry, RecoveryService


class PriceService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.audit = AuditService(db_session)
        self.inventory_service = InventoryService(db_session)
        self.recovery = RecoveryService(self.audit)

    def generate_change_no(self) -> str:
        now = datetime.now()
        unique_suffix = uuid.uuid4().hex[:4].upper()
        count = self.db.query(PriceChange).filter(
            PriceChange.created_at >= now.replace(hour=0, minute=0, second=0)
        ).count() + 1
        return f'PC{now.strftime("%Y%m%d%H%M%S")}{count:03d}{unique_suffix}'

    def create_price_change(
        self,
        store_code: str,
        sku: str,
        new_price: float,
        reason: str,
        created_by: str = 'system',
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> PriceChange:
        store = self.db.query(Store).filter(Store.code == store_code).first()
        product = self.db.query(Product).filter(Product.sku == sku).first()

        if not store:
            raise ValueError(f"Store not found: {store_code}")
        if not product:
            raise ValueError(f"Product not found: {sku}")

        inventory = self.inventory_service.get_or_create_inventory(store.id, product.id)
        old_price = inventory.sale_price

        change_no = self.generate_change_no()
        price_change = PriceChange(
            change_no=change_no,
            store_id=store.id,
            product_id=product.id,
            old_price=old_price,
            new_price=new_price,
            reason=reason,
            start_date=start_date,
            end_date=end_date,
            status=PRICE_CHANGE_STATUS_DRAFT,
            created_by=created_by
        )
        self.db.add(price_change)

        self.audit.log_create(
            resource_type='PRICE_CHANGE',
            new_value={
                'change_no': change_no,
                'store': store_code,
                'sku': sku,
                'old_price': old_price,
                'new_price': new_price,
                'reason': reason
            },
            username=created_by
        )

        return price_change

    def submit_for_approval(
        self,
        change_no: str,
        submitted_by: str
    ) -> PriceChange:
        price_change = self._get_price_change(change_no)

        if price_change.status != PRICE_CHANGE_STATUS_DRAFT:
            raise ValueError(f"Cannot submit price change with status: {price_change.status}")

        price_change.status = PRICE_CHANGE_STATUS_PENDING

        self.audit.log_update(
            resource_type='PRICE_CHANGE',
            resource_id=price_change.id,
            old_value={'status': PRICE_CHANGE_STATUS_DRAFT},
            new_value={'status': PRICE_CHANGE_STATUS_PENDING},
            username=submitted_by
        )

        return price_change

    def approve_price_change(
        self,
        change_no: str,
        approved_by: str
    ) -> PriceChange:
        price_change = self._get_price_change(change_no)

        if price_change.status != PRICE_CHANGE_STATUS_PENDING:
            raise ValueError(f"Cannot approve price change with status: {price_change.status}")

        price_change.status = PRICE_CHANGE_STATUS_APPROVED
        price_change.approved_by = approved_by
        price_change.approved_at = datetime.utcnow()

        self.audit.log_update(
            resource_type='PRICE_CHANGE',
            resource_id=price_change.id,
            old_value={'status': PRICE_CHANGE_STATUS_PENDING},
            new_value={'status': PRICE_CHANGE_STATUS_APPROVED, 'approved_by': approved_by},
            username=approved_by
        )

        return price_change

    @with_retry(max_attempts=3)
    def apply_price_change(
        self,
        change_no: str,
        applied_by: str
    ) -> PriceChange:
        price_change = self._get_price_change(change_no)

        if price_change.status != PRICE_CHANGE_STATUS_APPROVED:
            raise ValueError(f"Cannot apply price change with status: {price_change.status}")

        if price_change.start_date and datetime.utcnow() < price_change.start_date:
            raise ValueError(f"Price change not yet valid. Valid from {price_change.start_date}")

        if price_change.end_date and datetime.utcnow() > price_change.end_date:
            raise ValueError(f"Price change expired. Valid until {price_change.end_date}")

        try:
            self.inventory_service.update_price(
                price_change.store_id,
                price_change.product_id,
                price_change.new_price,
                price_change.reason or f"Applied via price change {change_no}",
                applied_by
            )

            price_change.status = PRICE_CHANGE_STATUS_APPLIED
            price_change.applied_at = datetime.utcnow()

        except Exception as e:
            self._handle_price_change_error(price_change, 'APPLY', e, applied_by)
            raise

        self.audit.log_update(
            resource_type='PRICE_CHANGE',
            resource_id=price_change.id,
            old_value={'status': PRICE_CHANGE_STATUS_APPROVED, 'price': price_change.old_price},
            new_value={'status': PRICE_CHANGE_STATUS_APPLIED, 'price': price_change.new_price},
            username=applied_by
        )

        return price_change

    def cancel_price_change(
        self,
        change_no: str,
        cancelled_by: str,
        reason: str = ''
    ) -> PriceChange:
        price_change = self._get_price_change(change_no)

        if price_change.status in [PRICE_CHANGE_STATUS_APPLIED, PRICE_CHANGE_STATUS_CANCELLED]:
            raise ValueError(f"Cannot cancel price change with status: {price_change.status}")

        price_change.status = PRICE_CHANGE_STATUS_CANCELLED
        price_change.notes = reason

        self.audit.log_update(
            resource_type='PRICE_CHANGE',
            resource_id=price_change.id,
            old_value={'status': price_change.status},
            new_value={'status': PRICE_CHANGE_STATUS_CANCELLED, 'reason': reason},
            username=cancelled_by
        )

        return price_change

    def get_price_change(self, change_no: str) -> PriceChange:
        return self._get_price_change(change_no)

    def get_price_changes(
        self,
        status: Optional[str] = None,
        store_id: Optional[int] = None,
        limit: int = 100
    ) -> List[PriceChange]:
        query = self.db.query(PriceChange)

        if status:
            query = query.filter(PriceChange.status == status)
        if store_id:
            query = query.filter(PriceChange.store_id == store_id)

        return query.order_by(PriceChange.created_at.desc()).limit(limit).all()

    def _get_price_change(self, change_no: str) -> PriceChange:
        price_change = self.db.query(PriceChange).filter(PriceChange.change_no == change_no).first()
        if not price_change:
            raise ValueError(f"Price change not found: {change_no}")
        return price_change

    def _handle_price_change_error(
        self,
        price_change: PriceChange,
        operation: str,
        error: Exception,
        username: str
    ):
        price_change.status = PRICE_CHANGE_STATUS_FAILED
        price_change.error_message = str(error)
        price_change.retry_count += 1

        self.recovery.record_failure(
            price_change.change_no,
            'PRICE_CHANGE',
            {'change_no': price_change.change_no, 'operation': operation},
            str(error),
            operation
        )

        self.audit.log_error(
            action=f'PRICE_CHANGE_{operation}_FAILED',
            resource_type='PRICE_CHANGE',
            resource_id=price_change.id,
            error_message=str(error),
            username=username
        )
