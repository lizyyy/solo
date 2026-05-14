from sqlalchemy import Column, Integer, String, Boolean, DateTime
from .base import BaseModel


class TenantSandbox(BaseModel):
    __tablename__ = "tenant_sandboxes"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    environment = Column(String(50), nullable=False)
    connection_string = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    last_cleaned_at = Column(DateTime, nullable=True)
