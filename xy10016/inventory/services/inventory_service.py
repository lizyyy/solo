from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from inventory.models import (
    Inventory, InventoryHistory, Store, Product
)
from inventory.services.audit_service import AuditService


class InventoryService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.audit = AuditService(db_session)

    def get_or_create_inventory(self, store_id: int, product_id: int, username: str = 'system') -> Inventory:
        inventory = self.db.query(Inventory).filter(
            Inventory.store_id == store_id,
            Inventory.product_id == product_id
        ).first()

        if inventory:
            return inventory

        inventory = Inventory(
            store_id=store_id,
            product_id=product_id,
            quantity=0,
            available_quantity=0,
            reserved_quantity=0,
            version=1
        )
        self.db.add(inventory)
        self.db.flush()

        self._record_history(
            inventory,
            change_type='INITIAL',
            changed_by=username,
            change_reason='Initial inventory creation'
        )

        return inventory

    def adjust_quantity(
        self,
        store_id: int,
        product_id: int,
        quantity_change: int,
        reason: str,
        username: str = 'system',
        reference_id: str = None
    ) -> Inventory:
        inventory = self.get_or_create_inventory(store_id, product_id, username)

        old_values = {
            'quantity': inventory.quantity,
            'available_quantity': inventory.available_quantity,
            'reserved_quantity': inventory.reserved_quantity
        }

        inventory.quantity += quantity_change
        inventory.available_quantity += quantity_change
        inventory.version += 1
        inventory.last_sync_at = datetime.utcnow()

        if inventory.quantity < 0:
            inventory.status = 'negative'
        elif inventory.quantity <= inventory.min_stock:
            inventory.status = 'low_stock'
        else:
            inventory.status = 'normal'

        self._record_history(
            inventory,
            change_type='QUANTITY_ADJUST',
            changed_by=username,
            change_reason=reason,
            reference_id=reference_id
        )

        self.audit.log_update(
            resource_type='INVENTORY',
            resource_id=f"{store_id}-{product_id}",
            old_value=old_values,
            new_value={
                'quantity': inventory.quantity,
                'available_quantity': inventory.available_quantity,
                'reserved_quantity': inventory.reserved_quantity
            },
            username=username
        )

        return inventory

    def update_price(
        self,
        store_id: int,
        product_id: int,
        new_price: float,
        reason: str,
        username: str = 'system'
    ) -> Inventory:
        inventory = self.get_or_create_inventory(store_id, product_id, username)
        old_price = inventory.sale_price

        inventory.sale_price = new_price
        inventory.version += 1

        self._record_history(
            inventory,
            change_type='PRICE_CHANGE',
            changed_by=username,
            change_reason=f"Price changed: {old_price} -> {new_price}. {reason}"
        )

        self.audit.log_update(
            resource_type='INVENTORY',
            resource_id=f"{store_id}-{product_id}",
            old_value={'sale_price': old_price},
            new_value={'sale_price': new_price},
            username=username
        )

        return inventory

    def reserve_quantity(
        self,
        store_id: int,
        product_id: int,
        quantity: int,
        username: str = 'system'
    ) -> bool:
        inventory = self.get_or_create_inventory(store_id, product_id, username)

        if inventory.available_quantity < quantity:
            return False

        inventory.available_quantity -= quantity
        inventory.reserved_quantity += quantity

        self._record_history(
            inventory,
            change_type='RESERVE',
            changed_by=username,
            change_reason=f"Reserved {quantity} units"
        )

        return True

    def release_reserved(
        self,
        store_id: int,
        product_id: int,
        quantity: int,
        username: str = 'system'
    ) -> bool:
        inventory = self.get_or_create_inventory(store_id, product_id, username)

        if inventory.reserved_quantity < quantity:
            return False

        inventory.reserved_quantity -= quantity
        inventory.available_quantity += quantity

        self._record_history(
            inventory,
            change_type='RELEASE',
            changed_by=username,
            change_reason=f"Released {quantity} reserved units"
        )

        return True

    def get_inventory(
        self,
        store_id: Optional[int] = None,
        product_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[Inventory]:
        query = self.db.query(Inventory)

        if store_id:
            query = query.filter(Inventory.store_id == store_id)
        if product_id:
            query = query.filter(Inventory.product_id == product_id)
        if status:
            query = query.filter(Inventory.status == status)

        return query.all()

    def get_history(
        self,
        inventory_id: int,
        limit: int = 50
    ) -> List[InventoryHistory]:
        return self.db.query(InventoryHistory).filter(
            InventoryHistory.inventory_id == inventory_id
        ).order_by(InventoryHistory.changed_at.desc()).limit(limit).all()

    def get_version_at_time(
        self,
        store_id: int,
        product_id: int,
        timestamp: datetime
    ) -> Optional[InventoryHistory]:
        return self.db.query(InventoryHistory).filter(
            InventoryHistory.store_id == store_id,
            InventoryHistory.product_id == product_id,
            InventoryHistory.changed_at <= timestamp
        ).order_by(InventoryHistory.changed_at.desc()).first()

    def get_low_stock(self, store_id: Optional[int] = None) -> List[Inventory]:
        query = self.db.query(Inventory).filter(
            Inventory.quantity <= Inventory.min_stock
        )
        if store_id:
            query = query.filter(Inventory.store_id == store_id)
        return query.all()

    def _record_history(
        self,
        inventory: Inventory,
        change_type: str,
        changed_by: str,
        change_reason: str = '',
        reference_id: str = None
    ):
        history = InventoryHistory(
            inventory_id=inventory.id,
            version=inventory.version,
            store_id=inventory.store_id,
            product_id=inventory.product_id,
            quantity=inventory.quantity,
            available_quantity=inventory.available_quantity,
            reserved_quantity=inventory.reserved_quantity,
            sale_price=inventory.sale_price,
            min_stock=inventory.min_stock,
            max_stock=inventory.max_stock,
            change_type=change_type,
            change_reason=change_reason,
            changed_by=changed_by,
            changed_at=datetime.utcnow(),
            reference_id=reference_id
        )
        self.db.add(history)
