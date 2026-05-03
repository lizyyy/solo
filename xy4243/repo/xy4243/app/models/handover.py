from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from .base import BaseEntity
from .enums import HandoverStatus


@dataclass
class HandoverRecord(BaseEntity):
    prop_id: str = ""
    prop_name: str = ""
    scene_id: str = ""
    scene_title: str = ""
    actor_id: str = ""
    actor_name: str = ""
    status: HandoverStatus = HandoverStatus.PENDING
    quantity: int = 1
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    handover_person: str = ""
    return_person: str = ""
    verification_person: str = ""
    notes: str = ""
    verification_notes: str = ""
    is_signed_out: bool = False
    signed_out_at: Optional[datetime] = None
    is_signed_in: bool = False
    signed_in_at: Optional[datetime] = None
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        super().__post_init__()

    @classmethod
    def from_csv_row(cls, row: dict, id_prefix: str = "handover"):
        status_str = row.get("status", "PENDING").upper()
        try:
            status = HandoverStatus[status_str]
        except KeyError:
            status = HandoverStatus.PENDING

        try:
            quantity = int(row.get("quantity", 1))
        except (ValueError, TypeError):
            quantity = 1

        def parse_datetime(value: str) -> Optional[datetime]:
            if not value:
                return None
            try:
                return datetime.fromisoformat(value)
            except (ValueError, TypeError):
                return None

        is_signed_out = row.get("is_signed_out", "").lower() in ("true", "yes", "1", "y")
        is_signed_in = row.get("is_signed_in", "").lower() in ("true", "yes", "1", "y")
        is_verified = row.get("is_verified", "").lower() in ("true", "yes", "1", "y")

        return cls(
            id=row.get("handover_id", "") or f"{id_prefix}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            prop_id=row.get("prop_id", ""),
            prop_name=row.get("prop_name", ""),
            scene_id=row.get("scene_id", ""),
            scene_title=row.get("scene_title", ""),
            actor_id=row.get("actor_id", ""),
            actor_name=row.get("actor_name", ""),
            status=status,
            quantity=quantity,
            scheduled_start_time=parse_datetime(row.get("scheduled_start_time")),
            scheduled_end_time=parse_datetime(row.get("scheduled_end_time")),
            actual_start_time=parse_datetime(row.get("actual_start_time")),
            actual_end_time=parse_datetime(row.get("actual_end_time")),
            handover_person=row.get("handover_person", ""),
            return_person=row.get("return_person", ""),
            verification_person=row.get("verification_person", ""),
            notes=row.get("notes", ""),
            verification_notes=row.get("verification_notes", ""),
            is_signed_out=is_signed_out,
            signed_out_at=parse_datetime(row.get("signed_out_at")),
            is_signed_in=is_signed_in,
            signed_in_at=parse_datetime(row.get("signed_in_at")),
            is_verified=is_verified,
            verified_at=parse_datetime(row.get("verified_at")),
        )

    def sign_out(self, handover_person: str) -> None:
        self.handover_person = handover_person
        self.is_signed_out = True
        self.signed_out_at = datetime.now()
        self.status = HandoverStatus.IN_USE
        self.actual_start_time = datetime.now()
        self.updated_at = datetime.now()

    def sign_in(self, return_person: str) -> None:
        self.return_person = return_person
        self.is_signed_in = True
        self.signed_in_at = datetime.now()
        self.status = HandoverStatus.RETURNED
        self.actual_end_time = datetime.now()
        self.updated_at = datetime.now()

    def verify(self, verification_person: str, notes: str = "") -> None:
        self.verification_person = verification_person
        self.verification_notes = notes
        self.is_verified = True
        self.verified_at = datetime.now()
        self.status = HandoverStatus.VERIFIED
        self.updated_at = datetime.now()

    def mark_lost(self) -> None:
        self.status = HandoverStatus.LOST
        self.updated_at = datetime.now()

    def mark_missing(self) -> None:
        self.status = HandoverStatus.MISSING
        self.updated_at = datetime.now()

    def is_missing_signature(self) -> bool:
        return not self.is_signed_out or not self.is_signed_in

    def is_verification_missing(self) -> bool:
        return not self.is_verified

    def is_overdue(self, current_time: datetime = None, grace_hours: int = 24) -> bool:
        if current_time is None:
            current_time = datetime.now()
        if not self.scheduled_end_time:
            return False
        if self.status in (HandoverStatus.RETURNED, HandoverStatus.VERIFIED):
            return False
        grace_period = timedelta(hours=grace_hours)
        return (current_time - self.scheduled_end_time) > grace_period
