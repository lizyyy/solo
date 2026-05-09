from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from inventory.services.transfer_service import TransferService
from inventory.services.price_service import PriceService
from inventory.services.inventory_service import InventoryService
from inventory.services.audit_service import AuditService


class BatchService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.transfer_service = TransferService(db_session)
        self.price_service = PriceService(db_session)
        self.inventory_service = InventoryService(db_session)
        self.audit = AuditService(db_session)

    def batch_create_transfers(
        self,
        transfers_data: List[Dict[str, Any]],
        created_by: str = 'system',
        stop_on_error: bool = False
    ) -> Dict[str, Any]:
        results = {
            'total': len(transfers_data),
            'success': 0,
            'failed': 0,
            'details': []
        }

        for i, data in enumerate(transfers_data):
            try:
                transfer = self.transfer_service.create_transfer(
                    from_store_code=data['from_store'],
                    to_store_code=data['to_store'],
                    items=data['items'],
                    created_by=created_by,
                    priority=data.get('priority', 'normal'),
                    notes=data.get('notes', '')
                )
                self.db.flush()

                results['success'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'success',
                    'transfer_no': transfer.transfer_no,
                    'from_store': data['from_store'],
                    'to_store': data['to_store'],
                    'items_count': len(data['items'])
                })
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'failed',
                    'from_store': data.get('from_store'),
                    'to_store': data.get('to_store'),
                    'error': str(e)
                })

                if stop_on_error:
                    self.db.rollback()
                    return results

        return results

    def batch_create_price_changes(
        self,
        price_changes_data: List[Dict[str, Any]],
        created_by: str = 'system',
        auto_submit: bool = False,
        stop_on_error: bool = False
    ) -> Dict[str, Any]:
        results = {
            'total': len(price_changes_data),
            'success': 0,
            'failed': 0,
            'details': []
        }

        for i, data in enumerate(price_changes_data):
            try:
                price_change = self.price_service.create_price_change(
                    store_code=data['store'],
                    sku=data['sku'],
                    new_price=data['new_price'],
                    reason=data.get('reason', 'Batch price change'),
                    created_by=created_by
                )

                if auto_submit:
                    price_change = self.price_service.submit_for_approval(
                        price_change.change_no,
                        created_by
                    )

                self.db.flush()

                results['success'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'success',
                    'change_no': price_change.change_no,
                    'store': data['store'],
                    'sku': data['sku'],
                    'old_price': price_change.old_price,
                    'new_price': price_change.new_price
                })
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'failed',
                    'store': data.get('store'),
                    'sku': data.get('sku'),
                    'error': str(e)
                })

                if stop_on_error:
                    self.db.rollback()
                    return results

        return results

    def batch_adjust_inventory(
        self,
        adjustments: List[Dict[str, Any]],
        adjusted_by: str = 'system',
        stop_on_error: bool = False
    ) -> Dict[str, Any]:
        results = {
            'total': len(adjustments),
            'success': 0,
            'failed': 0,
            'details': []
        }

        for i, data in enumerate(adjustments):
            try:
                from inventory.models import Store, Product

                store = self.db.query(Store).filter(Store.code == data['store']).first()
                product = self.db.query(Product).filter(Product.sku == data['sku']).first()

                if not store:
                    raise ValueError(f"Store not found: {data['store']}")
                if not product:
                    raise ValueError(f"Product not found: {data['sku']}")

                inventory = self.inventory_service.adjust_quantity(
                    store_id=store.id,
                    product_id=product.id,
                    quantity_change=data['quantity_change'],
                    reason=data.get('reason', 'Batch inventory adjustment'),
                    username=adjusted_by
                )
                self.db.flush()

                results['success'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'success',
                    'store': data['store'],
                    'sku': data['sku'],
                    'quantity_change': data['quantity_change'],
                    'new_quantity': inventory.quantity
                })
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'failed',
                    'store': data.get('store'),
                    'sku': data.get('sku'),
                    'error': str(e)
                })

                if stop_on_error:
                    self.db.rollback()
                    return results

        return results

    def batch_approve_transfers(
        self,
        transfer_nos: List[str],
        approved_by: str = 'system',
        stop_on_error: bool = False
    ) -> Dict[str, Any]:
        results = {
            'total': len(transfer_nos),
            'success': 0,
            'failed': 0,
            'details': []
        }

        for i, transfer_no in enumerate(transfer_nos):
            try:
                transfer = self.transfer_service.approve_transfer(transfer_no, approved_by)
                self.db.flush()

                results['success'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'success',
                    'transfer_no': transfer_no,
                    'from_store': transfer.from_store.code if transfer.from_store else None,
                    'to_store': transfer.to_store.code if transfer.to_store else None
                })
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'failed',
                    'transfer_no': transfer_no,
                    'error': str(e)
                })

                if stop_on_error:
                    self.db.rollback()
                    return results

        return results

    def batch_apply_price_changes(
        self,
        change_nos: List[str],
        applied_by: str = 'system',
        stop_on_error: bool = False
    ) -> Dict[str, Any]:
        results = {
            'total': len(change_nos),
            'success': 0,
            'failed': 0,
            'details': []
        }

        for i, change_no in enumerate(change_nos):
            try:
                price_change = self.price_service.apply_price_change(change_no, applied_by)
                self.db.flush()

                results['success'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'success',
                    'change_no': change_no,
                    'store': price_change.store.code if price_change.store else None,
                    'sku': price_change.product.sku if price_change.product else None,
                    'old_price': price_change.old_price,
                    'new_price': price_change.new_price
                })
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'index': i,
                    'status': 'failed',
                    'change_no': change_no,
                    'error': str(e)
                })

                if stop_on_error:
                    self.db.rollback()
                    return results

        return results
