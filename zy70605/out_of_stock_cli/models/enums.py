from enum import Enum


class CompensationType(Enum):
    REFUND = "refund"
    EXCHANGE = "exchange"
    POINTS = "points"


class CompensationStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSED = "processed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OrderStatus(Enum):
    PAID = "paid"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PARTIAL_REFUNDED = "partial_refunded"
