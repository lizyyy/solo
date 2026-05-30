from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class CreditLedger:
    ledger_id: str
    counterparty: str
    credit_limit: float
    used_credit: float
    available_credit: float
    effective_date: str
    expiry_date: str
    status: str
    updated_by: str
    updated_at: datetime = field(default_factory=datetime.now)
    remarks: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "CreditLedger":
        return cls(
            ledger_id=data.get("ledger_id", str(uuid.uuid4())),
            counterparty=data["counterparty"],
            credit_limit=float(data["credit_limit"]),
            used_credit=float(data.get("used_credit", 0)),
            available_credit=float(data.get("available_credit", data["credit_limit"])),
            effective_date=data["effective_date"],
            expiry_date=data["expiry_date"],
            status=data.get("status", "active"),
            updated_by=data["updated_by"],
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
            remarks=data.get("remarks")
        )

    def to_dict(self) -> dict:
        return {
            "ledger_id": self.ledger_id,
            "counterparty": self.counterparty,
            "credit_limit": self.credit_limit,
            "used_credit": self.used_credit,
            "available_credit": self.available_credit,
            "effective_date": self.effective_date,
            "expiry_date": self.expiry_date,
            "status": self.status,
            "updated_by": self.updated_by,
            "updated_at": self.updated_at.isoformat(),
            "remarks": self.remarks
        }
