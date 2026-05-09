from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from decimal import Decimal


class StoreBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=50)
    address: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[int] = None
    description: Optional[str] = None


class StoreCreate(StoreBase):
    pass


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class StoreResponse(StoreBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    sku: str = Field(..., min_length=2, max_length=50)
    barcode: Optional[str] = None
    category: Optional[str] = None
    unit: str = "件"
    default_cost: Decimal = Field(default=0, ge=0)
    default_sale_price: Decimal = Field(default=0, ge=0)
    min_stock: Optional[int] = Field(default=0, ge=0)
    max_stock: Optional[int] = None
    description: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    default_cost: Optional[Decimal] = None
    default_sale_price: Optional[Decimal] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryResponse(BaseModel):
    id: int
    store_id: int
    product_id: int
    quantity: int
    reserved_quantity: int
    available_quantity: int
    cost_price: Decimal
    sale_price: Decimal
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    store_name: Optional[str] = None

    class Config:
        from_attributes = True


class InventoryAdjustmentRequest(BaseModel):
    store_id: int
    product_id: int
    new_quantity: int
    adjustment_type: str = Field(..., pattern="^(increase|decrease|set)$")
    reason: str = Field(..., min_length=2)
    reference: Optional[str] = None


class InventoryUpdateRequest(BaseModel):
    cost_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None
