from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


class Inventory(Base):
    __tablename__ = 'inventory'

    store_id = Column(Integer, ForeignKey('store.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('product.id'), nullable=False)
    quantity = Column(Integer, default=0)
    available_quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    sale_price = Column(Float, default=0.0)
    min_stock = Column(Integer, default=0)
    max_stock = Column(Integer, default=1000)
    last_sync_at = Column(DateTime)
    status = Column(String(20), default='normal')
    version = Column(Integer, default=1)

    store = relationship('Store')
    product = relationship('Product')

    __table_args__ = (
        {'sqlite_autoincrement': True}
    )

    def __repr__(self):
        return f'<Inventory Store:{self.store_id} Product:{self.product_id} Qty:{self.quantity}>'


class InventoryHistory(Base):
    __tablename__ = 'inventory_history'

    inventory_id = Column(Integer, ForeignKey('inventory.id'), nullable=False)
    version = Column(Integer, nullable=False)
    store_id = Column(Integer, ForeignKey('store.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('product.id'), nullable=False)
    quantity = Column(Integer)
    available_quantity = Column(Integer)
    reserved_quantity = Column(Integer)
    sale_price = Column(Float)
    min_stock = Column(Integer)
    max_stock = Column(Integer)
    change_type = Column(String(50))
    change_reason = Column(String(255))
    changed_by = Column(String(50))
    changed_at = Column(DateTime, default=datetime.utcnow)
    reference_id = Column(String(100))
    notes = Column(Text)

    inventory = relationship('Inventory')
