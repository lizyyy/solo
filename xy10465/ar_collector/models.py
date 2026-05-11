from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class CollectionStatus(str, Enum):
    NO_CONTACT = "no_contact"
    CONTACTED = "contacted"
    PROMISED = "promised"
    DISPUTED = "disputed"
    PARTIAL_PAID = "partial_paid"
    PAID = "paid"


class CustomerTier(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


@dataclass
class Customer:
    customer_id: str
    name: str
    tier: CustomerTier
    credit_limit: float
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["tier"] = self.tier.value if isinstance(self.tier, CustomerTier) else self.tier
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Customer":
        return cls(
            customer_id=data["customer_id"],
            name=data["name"],
            tier=CustomerTier(data["tier"]) if isinstance(data["tier"], str) else data["tier"],
            credit_limit=data["credit_limit"],
            contact_person=data.get("contact_person"),
            phone=data.get("phone"),
            email=data.get("email"),
        )


@dataclass
class Receivable:
    invoice_no: str
    customer_id: str
    invoice_date: date
    due_date: date
    amount: float
    paid_amount: float = 0.0
    status: CollectionStatus = CollectionStatus.NO_CONTACT
    dispute_reason: Optional[str] = None
    dispute_date: Optional[date] = None
    dispute_resolved: bool = False
    dispute_resolved_date: Optional[date] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @property
    def balance(self) -> float:
        return self.amount - self.paid_amount

    @property
    def overdue_days(self) -> int:
        today = date.today()
        if today <= self.due_date:
            return 0
        return (today - self.due_date).days

    @property
    def is_overdue(self) -> bool:
        return self.overdue_days > 0

    @property
    def is_disputed(self) -> bool:
        return self.status == CollectionStatus.DISPUTED and not self.dispute_resolved

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value if isinstance(self.status, CollectionStatus) else self.status
        d["invoice_date"] = self.invoice_date.isoformat()
        d["due_date"] = self.due_date.isoformat()
        if self.dispute_date:
            d["dispute_date"] = self.dispute_date.isoformat()
        if self.dispute_resolved_date:
            d["dispute_resolved_date"] = self.dispute_resolved_date.isoformat()
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Receivable":
        return cls(
            invoice_no=data["invoice_no"],
            customer_id=data["customer_id"],
            invoice_date=date.fromisoformat(data["invoice_date"]),
            due_date=date.fromisoformat(data["due_date"]),
            amount=data["amount"],
            paid_amount=data.get("paid_amount", 0.0),
            status=CollectionStatus(data["status"]) if isinstance(data.get("status"), str) else data.get("status", CollectionStatus.NO_CONTACT),
            dispute_reason=data.get("dispute_reason"),
            dispute_date=date.fromisoformat(data["dispute_date"]) if data.get("dispute_date") else None,
            dispute_resolved=data.get("dispute_resolved", False),
            dispute_resolved_date=date.fromisoformat(data["dispute_resolved_date"]) if data.get("dispute_resolved_date") else None,
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
        )


@dataclass
class CollectionLog:
    log_id: str
    invoice_no: str
    contact_date: date
    contact_method: str
    contact_result: str
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["contact_date"] = self.contact_date.isoformat()
        d["created_at"] = self.created_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CollectionLog":
        return cls(
            log_id=data["log_id"],
            invoice_no=data["invoice_no"],
            contact_date=date.fromisoformat(data["contact_date"]),
            contact_method=data["contact_method"],
            contact_result=data["contact_result"],
            notes=data.get("notes"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
        )


@dataclass
class Promise:
    promise_id: str
    invoice_no: str
    promise_date: date
    promised_payment_date: date
    promised_amount: float
    is_fulfilled: bool = False
    fulfilled_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def is_missed(self) -> bool:
        today = date.today()
        return not self.is_fulfilled and today > self.promised_payment_date

    @property
    def days_overdue(self) -> int:
        if not self.is_missed:
            return 0
        today = date.today()
        return (today - self.promised_payment_date).days

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["promise_date"] = self.promise_date.isoformat()
        d["promised_payment_date"] = self.promised_payment_date.isoformat()
        if self.fulfilled_date:
            d["fulfilled_date"] = self.fulfilled_date.isoformat()
        d["created_at"] = self.created_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Promise":
        return cls(
            promise_id=data["promise_id"],
            invoice_no=data["invoice_no"],
            promise_date=date.fromisoformat(data["promise_date"]),
            promised_payment_date=date.fromisoformat(data["promised_payment_date"]),
            promised_amount=data["promised_amount"],
            is_fulfilled=data.get("is_fulfilled", False),
            fulfilled_date=date.fromisoformat(data["fulfilled_date"]) if data.get("fulfilled_date") else None,
            notes=data.get("notes"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
        )


@dataclass
class Payment:
    payment_id: str
    invoice_no: str
    payment_date: date
    amount: float
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["payment_date"] = self.payment_date.isoformat()
        d["created_at"] = self.created_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Payment":
        return cls(
            payment_id=data["payment_id"],
            invoice_no=data["invoice_no"],
            payment_date=date.fromisoformat(data["payment_date"]),
            amount=data["amount"],
            notes=data.get("notes"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
        )


@dataclass
class TieredReceivable:
    receivable: Receivable
    customer: Optional[Customer]
    priority_score: int
    priority_level: str
    collection_logs: List[CollectionLog] = field(default_factory=list)
    active_promise: Optional[Promise] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "receivable": self.receivable.to_dict(),
            "customer": self.customer.to_dict() if self.customer else None,
            "priority_score": self.priority_score,
            "priority_level": self.priority_level,
            "collection_logs_count": len(self.collection_logs),
            "has_active_promise": self.active_promise is not None,
        }
