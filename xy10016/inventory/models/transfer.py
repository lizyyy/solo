from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


TRANSFER_STATUS_PENDING = 'pending'
TRANSFER_STATUS_APPROVED = 'approved'
TRANSFER_STATUS_IN_TRANSIT = 'in_transit'
TRANSFER_STATUS_COMPLETED = 'completed'
TRANSFER_STATUS_FAILED = 'failed'
TRANSFER_STATUS_CANCELLED = 'cancelled'


class Transfer(Base):
    __tablename__ = 'transfer'

    transfer_no = Column(String(50), unique=True, nullable=False)
    from_store_id = Column(Integer, ForeignKey('store.id'), nullable=False)
    to_store_id = Column(Integer, ForeignKey('store.id'), nullable=False)
    total_quantity = Column(Integer, default=0)
    total_amount = Column(Float, default=0.0)
    status = Column(String(20), default=TRANSFER_STATUS_PENDING)
    priority = Column(String(20), default='normal')
    created_by = Column(String(50))
    approved_by = Column(String(50))
    approved_at = Column(DateTime)
    shipped_at = Column(DateTime)
    received_at = Column(DateTime)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    notes = Column(Text)

    from_store = relationship('Store', foreign_keys=[from_store_id])
    to_store = relationship('Store', foreign_keys=[to_store_id])
    items = relationship('TransferItem', back_populates='transfer', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Transfer {self.transfer_no}>'


class TransferItem(Base):
    __tablename__ = 'transfer_item'

    transfer_id = Column(Integer, ForeignKey('transfer.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('product.id'), nullable=False)
    requested_quantity = Column(Integer, nullable=False)
    shipped_quantity = Column(Integer, default=0)
    received_quantity = Column(Integer, default=0)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    notes = Column(Text)

    transfer = relationship('Transfer', back_populates='items')
    product = relationship('Product')
