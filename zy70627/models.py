from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import uuid4


class PackageStatus(Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    USED_UP = "used_up"
    TRANSFERRED = "transferred"


class ExtensionStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class VerificationStatus(Enum):
    VALID = "valid"
    INVALID = "invalid"
    CONFLICT = "conflict"
    WARNING = "warning"


@dataclass
class Customer:
    customer_id: str
    name: str
    phone: str
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class PackageItem:
    item_id: str
    name: str
    total_count: int
    used_count: int = 0
    gifted_count: int = 0

    @property
    def remaining_count(self) -> int:
        return self.total_count + self.gifted_count - self.used_count


@dataclass
class TreatmentPackage:
    package_id: str
    customer_id: str
    original_store_id: str
    current_store_id: str
    name: str
    items: List[PackageItem]
    purchase_date: datetime
    expiry_date: datetime
    status: PackageStatus = PackageStatus.ACTIVE
    transferred: bool = False
    transfer_history: List[str] = field(default_factory=list)


@dataclass
class VerificationRecord:
    verification_id: str = field(default_factory=lambda: str(uuid4()))
    package_id: str = ""
    item_id: str = ""
    store_id: str = ""
    customer_id: str = ""
    verification_time: datetime = field(default_factory=datetime.now)
    is_gift: bool = False
    notes: str = ""


@dataclass
class ExtensionRequest:
    request_id: str = field(default_factory=lambda: str(uuid4()))
    package_id: str = ""
    customer_id: str = ""
    request_date: datetime = field(default_factory=datetime.now)
    original_expiry: datetime = datetime.now()
    new_expiry: datetime = datetime.now()
    reason: str = ""
    status: ExtensionStatus = ExtensionStatus.PENDING
    approved_by: str = ""
    approval_date: Optional[datetime] = None


@dataclass
class ValidationResult:
    status: VerificationStatus
    message: str
    details: dict = field(default_factory=dict)
