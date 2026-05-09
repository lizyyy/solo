from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from .base import Base


class Product(Base):
    __tablename__ = 'product'

    sku = Column(String(50), unique=True, nullable=False)
    barcode = Column(String(50))
    name = Column(String(200), nullable=False)
    category = Column(String(100))
    unit = Column(String(20), default='件')
    cost_price = Column(Float, default=0.0)
    base_sale_price = Column(Float, default=0.0)
    description = Column(Text)
    status = Column(String(20), default='active')

    def __repr__(self):
        return f'<Product {self.sku} - {self.name}>'
