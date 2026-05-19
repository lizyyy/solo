from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import Inventory


class InventoryRepository:
    def __init__(self):
        pass

    def get_by_batch(self, db: Session, batch_id: int) -> Optional[Inventory]:
        return db.query(Inventory).filter(Inventory.batch_id == batch_id).first()

    def get_by_medicine(self, db: Session, medicine_id: int) -> List[Inventory]:
        return db.query(Inventory).filter(Inventory.medicine_id == medicine_id).all()

    def create(self, db: Session, inventory: Inventory) -> Inventory:
        db.add(inventory)
        db.commit()
        db.refresh(inventory)
        return inventory

    def update_quantity(self, db: Session, inventory_id: int, quantity: int, available_quantity: int) -> Optional[Inventory]:
        inventory = db.query(Inventory).filter(Inventory.id == inventory_id).first()
        if inventory:
            inventory.quantity = quantity
            inventory.available_quantity = available_quantity
            db.commit()
            db.refresh(inventory)
        return inventory

    def lock_quantity(self, db: Session, inventory_id: int, quantity: int) -> Optional[Inventory]:
        inventory = db.query(Inventory).filter(Inventory.id == inventory_id).first()
        if inventory and inventory.available_quantity >= quantity:
            inventory.available_quantity -= quantity
            inventory.locked_quantity += quantity
            db.commit()
            db.refresh(inventory)
        return inventory

    def unlock_quantity(self, db: Session, inventory_id: int, quantity: int) -> Optional[Inventory]:
        inventory = db.query(Inventory).filter(Inventory.id == inventory_id).first()
        if inventory and inventory.locked_quantity >= quantity:
            inventory.available_quantity += quantity
            inventory.locked_quantity -= quantity
            db.commit()
            db.refresh(inventory)
        return inventory

    def record_damage(self, db: Session, inventory_id: int, quantity: int) -> Optional[Inventory]:
        inventory = db.query(Inventory).filter(Inventory.id == inventory_id).first()
        if inventory and inventory.available_quantity >= quantity:
            inventory.available_quantity -= quantity
            inventory.damaged_quantity += quantity
            db.commit()
            db.refresh(inventory)
        return inventory

    def get_total_available(self, db: Session, medicine_id: int) -> int:
        inventories = db.query(Inventory).filter(Inventory.medicine_id == medicine_id).all()
        return sum(inv.available_quantity for inv in inventories)

    def list_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Inventory]:
        return db.query(Inventory).order_by(Inventory.created_at.desc()).offset(skip).limit(limit).all()
