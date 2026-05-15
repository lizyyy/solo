from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
import uuid


@dataclass
class FinanceCarrierRecord:
    batch_no: str
    source_system: str
    amount: float
    carrier_date: str
    account_code: str
    description: Optional[str] = None
    processor: Optional[str] = None
    pharmacy_receipt_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict:
        return {
            "batch_no": self.batch_no,
            "source_system": self.source_system,
            "amount": self.amount,
            "carrier_date": self.carrier_date,
            "account_code": self.account_code,
            "description": self.description,
            "processor": self.processor,
            "pharmacy_receipt_id": self.pharmacy_receipt_id,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class ProcessingLog:
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    batch_no: str = ""
    source_system: str = ""
    status: str = ""
    processor: str = ""
    input_data: Dict = field(default_factory=dict)
    error_message: Optional[str] = None
    error_details: Optional[Dict] = None
    processing_basis: Optional[str] = None
    pharmacy_receipt_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        return {
            "log_id": self.log_id,
            "batch_no": self.batch_no,
            "source_system": self.source_system,
            "status": self.status,
            "processor": self.processor,
            "input_data": self.input_data,
            "error_message": self.error_message,
            "error_details": self.error_details,
            "processing_basis": self.processing_basis,
            "pharmacy_receipt_id": self.pharmacy_receipt_id,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class CandidateItem:
    batch_no: str
    source_system: str
    action: str
    reason: str
    record_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "batch_no": self.batch_no,
            "source_system": self.source_system,
            "action": self.action,
            "reason": self.reason,
            "record_id": self.record_id,
        }
