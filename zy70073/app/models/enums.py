from enum import Enum


class ContractStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PARTIAL_FULFILLED = "partial_fulfilled"
    FULLY_FULFILLED = "fully_fulfilled"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class DeliveryStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    ACCEPTED = "accepted"
    PARTIAL_ACCEPTED = "partial_accepted"
    REJECTED = "rejected"
    LATE = "late"


class AcceptanceResult(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    PARTIAL_ACCEPTED = "partial_accepted"
    REJECTED = "rejected"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    DUE = "due"
    PAID = "paid"
    OVERDUE = "overdue"
    PARTIALLY_PAID = "partially_paid"


class WarningLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class WarningType(str, Enum):
    UPCOMING_DELIVERY = "upcoming_delivery"
    LATE_DELIVERY = "late_delivery"
    UPCOMING_PAYMENT = "upcoming_payment"
    LATE_PAYMENT = "late_payment"
    QUALITY_ISSUE = "quality_issue"
    PENALTY_UNSETTLED = "penalty_unsettled"


class CompensationStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYABLE = "retryable"


class CompensationType(str, Enum):
    SEND_NOTIFICATION = "send_notification"
    UPDATE_CONTRACT_STATUS = "update_contract_status"
    APPLY_PENALTY = "apply_penalty"
    REGENERATE_WARNING = "regenerate_warning"
