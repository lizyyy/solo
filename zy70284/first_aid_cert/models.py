from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import uuid4
from enum import Enum


class RecordAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    IMPORT = "import"


class CertificateStatus(str, Enum):
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"


class RetrainingStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    OVERDUE = "overdue"


@dataclass
class Personnel:
    id: str
    name: str
    employee_id: str
    department: str
    phone: str
    email: str
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        name: str,
        employee_id: str,
        department: str,
        phone: str = "",
        email: str = "",
    ) -> "Personnel":
        now = datetime.now().isoformat()
        return cls(
            id=str(uuid4())[:8],
            name=name,
            employee_id=employee_id,
            department=department,
            phone=phone,
            email=email,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Certificate:
    id: str
    personnel_id: str
    personnel_name: str
    certificate_type: str
    certificate_number: str
    issue_date: str
    expiry_date: str
    issuer: str
    status: str
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        personnel_id: str,
        personnel_name: str,
        certificate_type: str,
        certificate_number: str,
        issue_date: str,
        expiry_date: str,
        issuer: str = "急救培训中心",
    ) -> "Certificate":
        now = datetime.now().isoformat()
        return cls(
            id=str(uuid4())[:8],
            personnel_id=personnel_id,
            personnel_name=personnel_name,
            certificate_type=certificate_type,
            certificate_number=certificate_number,
            issue_date=issue_date,
            expiry_date=expiry_date,
            issuer=issuer,
            status=CertificateStatus.VALID.value,
            created_at=now,
            updated_at=now,
        )

    def get_status(self, today: Optional[datetime] = None) -> CertificateStatus:
        if today is None:
            today = datetime.now().date()
        expiry_date = datetime.strptime(self.expiry_date, "%Y-%m-%d").date()
        days_remaining = (expiry_date - today).days

        if days_remaining < 0:
            return CertificateStatus.EXPIRED
        elif days_remaining <= 30:
            return CertificateStatus.EXPIRING_SOON
        return CertificateStatus.VALID

    def update_status(self, today: Optional[datetime] = None) -> None:
        self.status = self.get_status(today).value
        self.updated_at = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RetrainingPlan:
    id: str
    certificate_id: str
    personnel_id: str
    personnel_name: str
    planned_date: str
    completed_date: Optional[str]
    trainer: Optional[str]
    status: str
    notes: str
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        certificate_id: str,
        personnel_id: str,
        personnel_name: str,
        planned_date: str,
        trainer: Optional[str] = None,
        notes: str = "",
    ) -> "RetrainingPlan":
        now = datetime.now().isoformat()
        return cls(
            id=str(uuid4())[:8],
            certificate_id=certificate_id,
            personnel_id=personnel_id,
            personnel_name=personnel_name,
            planned_date=planned_date,
            completed_date=None,
            trainer=trainer,
            status=RetrainingStatus.PENDING.value,
            notes=notes,
            created_at=now,
            updated_at=now,
        )

    def get_status(self, today: Optional[datetime] = None) -> RetrainingStatus:
        if today is None:
            today = datetime.now().date()

        if self.completed_date:
            return RetrainingStatus.COMPLETED

        planned_date = datetime.strptime(self.planned_date, "%Y-%m-%d").date()
        if today > planned_date:
            return RetrainingStatus.OVERDUE
        return RetrainingStatus.PENDING

    def update_status(self, today: Optional[datetime] = None) -> None:
        self.status = self.get_status(today).value
        self.updated_at = datetime.now().isoformat()

    def mark_completed(
        self,
        completed_date: str,
        trainer: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> None:
        self.completed_date = completed_date
        self.status = RetrainingStatus.COMPLETED.value
        if trainer:
            self.trainer = trainer
        if notes:
            self.notes = notes
        self.updated_at = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HistoryRecord:
    id: str
    entity_type: str
    entity_id: str
    action: str
    before: Optional[Dict[str, Any]]
    after: Optional[Dict[str, Any]]
    timestamp: str
    description: str

    @classmethod
    def create(
        cls,
        entity_type: str,
        entity_id: str,
        action: str,
        before: Optional[Dict[str, Any]] = None,
        after: Optional[Dict[str, Any]] = None,
        description: str = "",
    ) -> "HistoryRecord":
        return cls(
            id=str(uuid4())[:8],
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before=before,
            after=after,
            timestamp=datetime.now().isoformat(),
            description=description,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
