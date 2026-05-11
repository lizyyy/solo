"""核心数据模型"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid


class InvoiceType(Enum):
    """发票类型"""
    ENTERPRISE = "企业"
    PERSONAL = "个人"
    UNKNOWN = "未知"


class OrderStatus(Enum):
    """订单状态"""
    COMPLETED = "已完成"
    PARTIAL_REFUND = "部分退款"
    FULL_REFUND = "全额退款"
    PENDING = "待处理"


@dataclass
class InvoiceHeader:
    """发票抬头"""
    header_id: str
    name: str
    type: InvoiceType
    tax_number: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    is_valid: bool = True
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "header_id": self.header_id,
            "name": self.name,
            "type": self.type.value,
            "tax_number": self.tax_number or "",
            "address": self.address or "",
            "phone": self.phone or "",
            "bank_name": self.bank_name or "",
            "bank_account": self.bank_account or "",
            "email": self.email or "",
            "notes": self.notes or "",
        }


@dataclass
class ProductCategory:
    """商品类目"""
    category_id: str
    name: str
    tax_rate: Optional[Decimal] = None
    parent_category: Optional[str] = None
    description: Optional[str] = None
    is_tax_rate_defined: bool = False
    created_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if self.tax_rate is not None:
            self.is_tax_rate_defined = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category_id": self.category_id,
            "name": self.name,
            "tax_rate": float(self.tax_rate) if self.tax_rate else None,
            "parent_category": self.parent_category or "",
            "description": self.description or "",
            "is_tax_rate_defined": self.is_tax_rate_defined,
        }


@dataclass
class OrderItem:
    """订单商品项"""
    item_id: str
    product_name: str
    category_id: str
    category_name: str
    quantity: int
    unit_price: Decimal
    amount: Decimal
    tax_rate: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    refunded_quantity: int = 0
    refunded_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    notes: Optional[str] = None

    def __post_init__(self):
        if self.amount is None:
            self.amount = self.unit_price * Decimal(str(self.quantity))

    @property
    def net_amount(self) -> Decimal:
        """净金额（扣除退款后）"""
        return self.amount - self.refunded_amount

    @property
    def net_quantity(self) -> int:
        return self.quantity - self.refunded_quantity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "item_id": self.item_id,
            "product_name": self.product_name,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "quantity": self.quantity,
            "unit_price": float(self.unit_price),
            "amount": float(self.amount),
            "tax_rate": float(self.tax_rate) if self.tax_rate else None,
            "tax_amount": float(self.tax_amount) if self.tax_amount else None,
            "refunded_quantity": self.refunded_quantity,
            "refunded_amount": float(self.refunded_amount),
            "net_amount": float(self.net_amount),
            "net_quantity": self.net_quantity,
            "notes": self.notes or "",
        }


@dataclass
class Order:
    """订单"""
    order_id: str
    platform: str
    order_date: datetime
    header_id: Optional[str] = None
    header_name: Optional[str] = None
    header_type: InvoiceType = InvoiceType.UNKNOWN
    total_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    total_refunded_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    items: List[OrderItem] = field(default_factory=list)
    status: OrderStatus = OrderStatus.COMPLETED
    has_invoiced: bool = False
    invoice_ids: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if not self.total_amount and self.items:
            self.total_amount = sum(item.amount for item in self.items)
        if not self.total_refunded_amount and self.items:
            self.total_refunded_amount = sum(item.refunded_amount for item in self.items)
        if self.total_refunded_amount >= self.total_amount and self.total_amount > 0:
            self.status = OrderStatus.FULL_REFUND
        elif self.total_refunded_amount > 0:
            self.status = OrderStatus.PARTIAL_REFUND

    @property
    def net_amount(self) -> Decimal:
        return self.total_amount - self.total_refunded_amount

    @property
    def has_header(self) -> bool:
        return bool(self.header_id or self.header_name)

    @property
    def is_valid_for_invoice(self) -> bool:
        return (
            self.has_header
            and self.net_amount > 0
            and self.status != OrderStatus.FULL_REFUND
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id,
            "platform": self.platform,
            "order_date": self.order_date.strftime("%Y-%m-%d %H:%M:%S"),
            "header_id": self.header_id or "",
            "header_name": self.header_name or "",
            "header_type": self.header_type.value,
            "total_amount": float(self.total_amount),
            "total_refunded_amount": float(self.total_refunded_amount),
            "net_amount": float(self.net_amount),
            "status": self.status.value,
            "has_invoiced": self.has_invoiced,
            "invoice_ids": ",".join(self.invoice_ids),
            "notes": self.notes or "",
            "item_count": len(self.items),
        }


@dataclass
class RefundRecord:
    """退款记录"""
    refund_id: str
    order_id: str
    refund_date: datetime
    refund_type: str
    amount: Decimal
    item_id: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    is_processed: bool = False
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "refund_id": self.refund_id,
            "order_id": self.order_id,
            "refund_date": self.refund_date.strftime("%Y-%m-%d %H:%M:%S"),
            "refund_type": self.refund_type,
            "amount": float(self.amount),
            "item_id": self.item_id or "",
            "reason": self.reason or "",
            "notes": self.notes or "",
            "is_processed": self.is_processed,
        }


class IssueType(Enum):
    """异常类型"""
    HEADER_MISSING = "抬头缺失"
    TAX_RATE_MIXED = "税率混同"
    REFUND_NOT_PROCESSED = "退款未处理"
    DUPLICATE_INVOICE = "重复开票"
    CATEGORY_NO_TAX_RATE = "类目无税率"
    INVALID_HEADER = "抬头无效"
    ZERO_AMOUNT = "金额为零"
    FULL_REFUNDED = "已全额退款"


@dataclass
class Issue:
    """异常记录"""
    type: IssueType
    issue_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    order_id: Optional[str] = None
    item_id: Optional[str] = None
    category_id: Optional[str] = None
    header_id: Optional[str] = None
    message: str = ""
    severity: str = "error"
    details: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    resolution_notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "type": self.type.value,
            "order_id": self.order_id or "",
            "item_id": self.item_id or "",
            "category_id": self.category_id or "",
            "header_id": self.header_id or "",
            "message": self.message,
            "severity": self.severity,
            "resolved": self.resolved,
            "resolution_notes": self.resolution_notes or "",
        }


@dataclass
class InvoiceGroup:
    """发票分组（拆票结果）"""
    group_id: str
    header_name: str
    header_type: InvoiceType
    tax_rate: Decimal
    order_ids: List[str] = field(default_factory=list)
    items: List[OrderItem] = field(default_factory=list)
    total_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    tax_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    net_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    split_reason: str = ""
    is_adjusted: bool = False
    adjustment_notes: Optional[str] = None
    original_group_ids: List[str] = field(default_factory=list)

    def __post_init__(self):
        if not self.total_amount and self.items:
            self.total_amount = sum(item.amount for item in self.items)
            self.net_amount = sum(item.net_amount for item in self.items)
        if not self.tax_amount and self.tax_rate and self.net_amount:
            self.tax_amount = self.net_amount * self.tax_rate / (Decimal("1") + self.tax_rate)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "group_id": self.group_id,
            "header_name": self.header_name,
            "header_type": self.header_type.value,
            "tax_rate": float(self.tax_rate),
            "tax_rate_percent": f"{float(self.tax_rate) * 100}%",
            "order_ids": ",".join(self.order_ids),
            "order_count": len(self.order_ids),
            "item_count": len(self.items),
            "total_amount": float(self.total_amount),
            "tax_amount": float(self.tax_amount),
            "net_amount": float(self.net_amount),
            "split_reason": self.split_reason,
            "is_adjusted": self.is_adjusted,
            "adjustment_notes": self.adjustment_notes or "",
        }


@dataclass
class AdjustmentRecord:
    """人工调整记录"""
    adjustment_id: str
    timestamp: datetime
    operator: str
    action: str
    original_groups: List[InvoiceGroup]
    new_groups: List[InvoiceGroup]
    reason: str
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "adjustment_id": self.adjustment_id,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "operator": self.operator,
            "action": self.action,
            "reason": self.reason,
            "notes": self.notes or "",
            "original_group_count": len(self.original_groups),
            "new_group_count": len(self.new_groups),
        }


@dataclass
class SplitResult:
    """拆票结果"""
    original_orders: List[Order]
    headers: List[InvoiceHeader]
    categories: List[ProductCategory]
    refunds: List[RefundRecord]
    issues: List[Issue]
    invoice_groups: List[InvoiceGroup]
    adjustments: List[AdjustmentRecord] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)

    @property
    def total_orders(self) -> int:
        return len(self.original_orders)

    @property
    def valid_orders(self) -> int:
        return len([o for o in self.original_orders if o.is_valid_for_invoice])

    @property
    def total_invoice_groups(self) -> int:
        return len(self.invoice_groups)

    @property
    def total_issues(self) -> int:
        return len(self.issues)

    @property
    def unresolved_issues(self) -> int:
        return len([i for i in self.issues if not i.resolved])

    @property
    def total_amount(self) -> Decimal:
        return sum(g.net_amount for g in self.invoice_groups)
