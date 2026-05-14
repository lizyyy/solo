from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from .common import BaseSchema


class TenantSandboxBase(BaseModel):
    tenant_id: str
    name: str
    environment: str
    connection_string: Optional[str] = None
    is_active: bool = True
    last_cleaned_at: Optional[datetime] = None


class TenantSandboxCreate(TenantSandboxBase):
    pass


class TenantSandboxUpdate(BaseModel):
    tenant_id: Optional[str] = None
    name: Optional[str] = None
    environment: Optional[str] = None
    connection_string: Optional[str] = None
    is_active: Optional[bool] = None
    last_cleaned_at: Optional[datetime] = None


class TenantSandboxSchema(TenantSandboxBase, BaseSchema):
    pass
