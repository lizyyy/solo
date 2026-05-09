from sqlalchemy import Column, Integer, String, Text
from .base import Base


class Store(Base):
    __tablename__ = 'store'

    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    address = Column(String(255))
    city = Column(String(50))
    phone = Column(String(20))
    manager = Column(String(50))
    status = Column(String(20), default='active')
    notes = Column(Text)

    def __repr__(self):
        return f'<Store {self.code} - {self.name}>'
