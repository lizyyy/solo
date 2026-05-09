from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


PRICE_CHANGE_STATUS_DRAFT = 'draft'
PRICE_CHANGE_STATUS_PENDING = 'pending'
PRICE_CHANGE_STATUS_APPROVED = 'approved'
PRICE_CHANGE_STATUS_APPLIED = 'applied'
PRICE_CHANGE_STATUS_FAILED = 'failed'
PRICE_CHANGE_STATUS_CANCELLED = 'cancelled'


class PriceChange(Base):
    __tablename__ = 'price_change'

    change_no = Column(String(50), unique=True, nullable=False)
    store_id = Column(Integer, ForeignKey('store.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('product.id'), nullable=False)
    old_price = Column(Float, nullable=False)
    new_price = Column(Float, nullable=False)
    reason = Column(String(255))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String(20), default=PRICE_CHANGE_STATUS_DRAFT)
    created_by = Column(String(50))
    approved_by = Column(String(50))
    approved_at = Column(DateTime)
    applied_at = Column(DateTime)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    notes = Column(Text)

    store = relationship('Store')
    product = relationship('Product')

    def __repr__(self):
        return f'<PriceChange {self.change_no}>'
