from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .common import IdMixin, TimestampMixin, AuditMixin


class Store(Base, IdMixin, TimestampMixin, AuditMixin):
    __tablename__ = "stores"

    store_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    store_name: Mapped[str] = mapped_column(String(128), nullable=False)
    
    city: Mapped[str] = mapped_column(String(64), nullable=True)
    address: Mapped[str] = mapped_column(String(255), nullable=True)
    manager: Mapped[str] = mapped_column(String(64), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    remark: Mapped[str] = mapped_column(String(255), nullable=True)
