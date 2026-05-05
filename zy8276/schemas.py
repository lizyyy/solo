from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models import OrderStatus, InventoryAction


class ProductBase(BaseModel):
    sku: str = Field(..., description="商品SKU")
    name: str = Field(..., description="商品名称")
    price: float = Field(..., description="商品价格")
    total_stock: int = Field(..., description="总库存")


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int
    available_stock: int
    frozen_stock: int
    sold_stock: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    user_id: str = Field(..., description="用户ID")
    sku: str = Field(..., description="商品SKU")
    quantity: int = Field(..., gt=0, description="购买数量")


class OrderCreate(OrderBase):
    idempotency_key: str = Field(..., description="幂等键")


class OrderResponse(BaseModel):
    id: int
    order_no: str
    product_id: int
    user_id: str
    quantity: int
    unit_price: float
    total_amount: float
    status: OrderStatus
    idempotency_key: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryJournalResponse(BaseModel):
    id: int
    product_id: int
    order_id: Optional[int]
    action: InventoryAction
    quantity: int
    before_available: int
    after_available: int
    before_frozen: int
    after_frozen: int
    before_sold: int
    after_sold: int
    created_at: datetime

    class Config:
        from_attributes = True


class IdempotencyKeyResponse(BaseModel):
    id: int
    key: str
    order_id: Optional[int]
    status: str
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


class PaymentRequest(BaseModel):
    order_no: str = Field(..., description="订单号")


class CancelRequest(BaseModel):
    order_no: str = Field(..., description="订单号")


class InventoryAuditItem(BaseModel):
    sku: str
    name: str
    total_stock: int
    available_stock: int
    frozen_stock: int
    sold_stock: int
    expected_total: int
    is_balanced: bool


class InventoryAuditReport(BaseModel):
    generated_at: datetime
    summary: dict
    products: list[InventoryAuditItem]
    total_orders: int
    pending_orders: int
    paid_orders: int
    cancelled_orders: int
