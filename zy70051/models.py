from datetime import datetime
from enum import Enum, auto
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from uuid import uuid4


class BillStatus(Enum):
    DRAFT = "draft"
    REGISTERED = "registered"
    ENDORSED = "endorsed"
    COLLECTION_PENDING = "collection_pending"
    COLLECTION_SUBMITTED = "collection_submitted"
    COLLECTION_CONFIRMED = "collection_confirmed"
    PAID = "paid"
    RETURNED = "returned"
    ERROR = "error"


class EndorsementStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class CollectionStatus(Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class TransactionType(Enum):
    REGISTRATION = "registration"
    ENDORSEMENT = "endorsement"
    COLLECTION_SUBMIT = "collection_submit"
    COLLECTION_CONFIRM = "collection_confirm"
    PAYMENT = "payment"
    RETURN = "return"
    COMPENSATION = "compensation"


@dataclass
class Endorsement:
    id: str
    from_holder: str
    to_holder: str
    sequence: int
    status: EndorsementStatus
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    reject_reason: Optional[str] = None


@dataclass
class CollectionRequest:
    id: str
    bill_id: str
    holder_id: str
    collection_bank: str
    collection_account: str
    status: CollectionStatus
    created_at: datetime
    submitted_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    fail_reason: Optional[str] = None


@dataclass
class ReturnRecord:
    id: str
    bill_id: str
    holder_id: str
    return_bank: str
    return_reason: str
    return_date: datetime
    handled_at: Optional[datetime] = None
    handler: Optional[str] = None


@dataclass
class FundTransaction:
    id: str
    bill_id: str
    transaction_type: TransactionType
    amount: float
    currency: str
    debit_account: str
    credit_account: str
    created_at: datetime
    reference_id: str


@dataclass
class FailedOperation:
    id: str
    bill_id: str
    operation_type: str
    operation_data: Dict
    error_message: str
    failed_at: datetime
    retry_count: int = 0
    last_retry_at: Optional[datetime] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None


@dataclass
class Bill:
    id: str
    bill_no: str
    drawer: str
    acceptor: str
    amount: float
    currency: str
    issue_date: datetime
    maturity_date: datetime
    current_holder: str
    status: BillStatus
    endorsements: List[Endorsement] = field(default_factory=list)
    collection_request: Optional[CollectionRequest] = None
    return_record: Optional[ReturnRecord] = None
    transactions: List[FundTransaction] = field(default_factory=list)
    failed_operations: List[FailedOperation] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_endorsement(self, endorsement: Endorsement):
        expected_sequence = len(self.endorsements) + 1
        if endorsement.sequence != expected_sequence:
            raise ValueError(f"Endorsement sequence error: expected {expected_sequence}, got {endorsement.sequence}")
        if endorsement.from_holder != self.current_holder:
            raise ValueError(f"Endorsement from_holder mismatch: current holder is {self.current_holder}")
        self.endorsements.append(endorsement)

    def get_latest_endorsement(self) -> Optional[Endorsement]:
        return self.endorsements[-1] if self.endorsements else None

    def verify_endorsement_chain(self) -> bool:
        if not self.endorsements:
            return True
        
        for i, end in enumerate(self.endorsements):
            if end.status != EndorsementStatus.CONFIRMED:
                return False
            if i > 0:
                if end.from_holder != self.endorsements[i-1].to_holder:
                    return False
        return True
