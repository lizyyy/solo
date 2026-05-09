from typing import Optional
from pydantic import BaseModel
from .base import BaseSchema

class PartBase(BaseModel):
    name: str
    code: str
    category: Optional[str] = None
    unit: str = "个"
    unit_price: float = 0
    stock: int = 0
    description: Optional[str] = None

class PartCreate(PartBase):
    pass

class PartUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    stock: Optional[int] = None
    description: Optional[str] = None

class Part(BaseSchema):
    name: str
    code: str
    category: Optional[str] = None
    unit: str
    unit_price: float
    stock: int
    description: Optional[str] = None

    class Config:
        from_attributes = True

class PartQuery(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    page: int = 1
    page_size: int = 10

class PartsUsageBase(BaseModel):
    receipt_id: int
    part_id: int
    quantity: int = 1
    notes: Optional[str] = None

class PartsUsageCreate(PartsUsageBase):
    pass

class PartsUsage(BaseSchema):
    receipt_id: int
    part_id: int
    quantity: int
    unit_price: float
    notes: Optional[str] = None

    class Config:
        from_attributes = True
