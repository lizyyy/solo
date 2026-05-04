from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from decimal import Decimal


class PaymentStatus(Enum):
    UNPAID = "未付款"
    PAID = "已付款"
    OVERPAID = "疑似多付"
    UNDERPAID = "疑似少付"
    UNMATCHED = "付款无对应报名"
    PENDING_CONFIRM = "待确认"


class RecordStatus(Enum):
    CONFIRMED = "已确认"
    DUPLICATE = "疑似重复"
    NAME_MISMATCH = "姓名不一致"
    PHONE_MISMATCH = "手机号不一致"
    MODIFIED = "已被修改"
    WAITLIST = "候补"
    IN_GROUP = "已分组"


class TimeSlot(Enum):
    SATURDAY_MORNING = "周六上午"
    SATURDAY_AFTERNOON = "周六下午"
    SUNDAY_MORNING = "周日上午"
    SUNDAY_AFTERNOON = "周日下午"


@dataclass
class RegistrationRecord:
    raw_line: str
    line_number: int
    
    sequence_number: Optional[int] = None
    group_nickname: Optional[str] = None
    real_name: Optional[str] = None
    phone: Optional[str] = None
    
    total_people: int = 0
    adult_count: int = 0
    child_count: int = 0
    
    dietary_restrictions: List[str] = field(default_factory=list)
    time_slots: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    
    has_payment_screenshot: bool = False
    payment_amount: Optional[Decimal] = None
    
    source_file: str = "chat.txt"
    parse_warnings: List[str] = field(default_factory=list)
    
    record_id: str = field(init=False)
    
    def __post_init__(self):
        import hashlib
        content = f"{self.line_number}:{self.raw_line}"
        self.record_id = hashlib.md5(content.encode('utf-8')).hexdigest()[:12]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "sequence_number": self.sequence_number,
            "group_nickname": self.group_nickname,
            "real_name": self.real_name,
            "phone": self.phone,
            "total_people": self.total_people,
            "adult_count": self.adult_count,
            "child_count": self.child_count,
            "dietary_restrictions": ", ".join(self.dietary_restrictions),
            "time_slots": ", ".join(self.time_slots),
            "notes": " | ".join(self.notes),
            "has_payment_screenshot": self.has_payment_screenshot,
            "payment_amount": str(self.payment_amount) if self.payment_amount else None,
            "parse_warnings": " | ".join(self.parse_warnings),
            "raw_line": self.raw_line,
            "line_number": self.line_number,
        }


@dataclass
class PaymentRecord:
    payer_name: str
    amount: Decimal
    payment_time: Optional[datetime] = None
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    
    matched: bool = False
    matched_registration_ids: List[str] = field(default_factory=list)
    match_confidence: float = 0.0
    match_reason: Optional[str] = None
    
    source_file: str = "payments.csv"
    line_number: int = 0
    
    payment_id: str = field(init=False)
    
    def __post_init__(self):
        import hashlib
        content = f"{self.line_number}:{self.payer_name}:{self.amount}"
        self.payment_id = hashlib.md5(content.encode('utf-8')).hexdigest()[:12]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "payment_id": self.payment_id,
            "payer_name": self.payer_name,
            "amount": str(self.amount),
            "payment_time": self.payment_time.isoformat() if self.payment_time else None,
            "transaction_id": self.transaction_id,
            "notes": self.notes,
            "matched": self.matched,
            "matched_registration_ids": ", ".join(self.matched_registration_ids),
            "match_confidence": self.match_confidence,
            "match_reason": self.match_reason,
            "line_number": self.line_number,
        }


@dataclass
class EditRecord:
    original_name: str
    new_name: Optional[str] = None
    new_phone: Optional[str] = None
    new_total_people: Optional[int] = None
    new_child_count: Optional[int] = None
    new_time_slots: Optional[List[str]] = None
    notes: Optional[str] = None
    
    applied: bool = False
    matched_registration_id: Optional[str] = None
    
    source_file: str = "optional_edits.csv"
    line_number: int = 0


@dataclass
class TimeSlotRule:
    name: str
    max_capacity: int
    max_child_ratio: Optional[float] = None
    priority: int = 0


@dataclass
class RulesConfig:
    total_max_capacity: int
    price_per_adult: Decimal
    price_per_child: Decimal
    time_slots: List[TimeSlotRule]
    group_size: int = 10
    prefer_same_time_together: bool = True
    allow_time_slot_conflict: bool = False
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RulesConfig':
        time_slots_data = data.get('time_slots', [])
        time_slots = []
        for ts_data in time_slots_data:
            time_slots.append(TimeSlotRule(
                name=ts_data['name'],
                max_capacity=ts_data.get('max_capacity', 999),
                max_child_ratio=ts_data.get('max_child_ratio'),
                priority=ts_data.get('priority', 0),
            ))
        
        return cls(
            total_max_capacity=data.get('total_max_capacity', 999),
            price_per_adult=Decimal(str(data.get('price_per_adult', 0))),
            price_per_child=Decimal(str(data.get('price_per_child', 0))),
            time_slots=time_slots,
            group_size=data.get('group_size', 10),
            prefer_same_time_together=data.get('prefer_same_time_together', True),
            allow_time_slot_conflict=data.get('allow_time_slot_conflict', False),
        )


@dataclass
class MergedRecord:
    primary_record: RegistrationRecord
    duplicate_records: List[RegistrationRecord] = field(default_factory=list)
    payment_records: List[PaymentRecord] = field(default_factory=list)
    edit_record: Optional[EditRecord] = None
    
    status: RecordStatus = RecordStatus.CONFIRMED
    payment_status: PaymentStatus = PaymentStatus.UNPAID
    expected_payment: Decimal = Decimal('0')
    actual_payment: Decimal = Decimal('0')
    
    assigned_time_slot: Optional[str] = None
    assigned_group: Optional[str] = None
    is_waitlist: bool = False
    
    warnings: List[str] = field(default_factory=list)
    merged_id: str = field(init=False)
    
    def __post_init__(self):
        self.merged_id = self.primary_record.record_id
    
    @property
    def display_name(self) -> str:
        if self.edit_record and self.edit_record.new_name:
            return self.edit_record.new_name
        if self.primary_record.real_name:
            return self.primary_record.real_name
        if self.primary_record.group_nickname:
            return self.primary_record.group_nickname
        return "未知"
    
    @property
    def effective_phone(self) -> Optional[str]:
        if self.edit_record and self.edit_record.new_phone:
            return self.edit_record.new_phone
        return self.primary_record.phone
    
    @property
    def effective_total_people(self) -> int:
        if self.edit_record and self.edit_record.new_total_people is not None:
            return self.edit_record.new_total_people
        return self.primary_record.total_people
    
    @property
    def effective_child_count(self) -> int:
        if self.edit_record and self.edit_record.new_child_count is not None:
            return self.edit_record.new_child_count
        return self.primary_record.child_count
    
    @property
    def effective_adult_count(self) -> int:
        return self.effective_total_people - self.effective_child_count
    
    @property
    def effective_time_slots(self) -> List[str]:
        if self.edit_record and self.edit_record.new_time_slots:
            return self.edit_record.new_time_slots
        if self.primary_record.time_slots:
            return self.primary_record.time_slots
        return []
    
    def calculate_expected_payment(self, rules: RulesConfig) -> Decimal:
        adults = self.effective_adult_count
        children = self.effective_child_count
        expected = (adults * rules.price_per_adult) + (children * rules.price_per_child)
        self.expected_payment = expected
        return expected
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "merged_id": self.merged_id,
            "display_name": self.display_name,
            "phone": self.effective_phone,
            "total_people": self.effective_total_people,
            "adults": self.effective_adult_count,
            "children": self.effective_child_count,
            "time_slots": ", ".join(self.effective_time_slots),
            "assigned_time_slot": self.assigned_time_slot,
            "assigned_group": self.assigned_group,
            "is_waitlist": self.is_waitlist,
            "status": self.status.value,
            "payment_status": self.payment_status.value,
            "expected_payment": str(self.expected_payment),
            "actual_payment": str(self.actual_payment),
            "dietary_restrictions": ", ".join(self.primary_record.dietary_restrictions),
            "notes": " | ".join(self.primary_record.notes),
            "warnings": " | ".join(self.warnings),
            "duplicate_count": len(self.duplicate_records),
            "primary_record_id": self.primary_record.record_id,
        }


@dataclass
class Group:
    group_name: str
    time_slot: str
    members: List[MergedRecord] = field(default_factory=list)
    max_size: int = 10
    
    @property
    def current_size(self) -> int:
        return sum(m.effective_total_people for m in self.members)
    
    @property
    def adult_count(self) -> int:
        return sum(m.effective_adult_count for m in self.members)
    
    @property
    def child_count(self) -> int:
        return sum(m.effective_child_count for m in self.members)
    
    @property
    def child_ratio(self) -> float:
        if self.current_size == 0:
            return 0.0
        return self.child_count / self.current_size
    
    def can_add(self, record: MergedRecord, max_child_ratio: Optional[float] = None) -> bool:
        new_size = self.current_size + record.effective_total_people
        if new_size > self.max_size:
            return False
        
        if max_child_ratio is not None:
            new_child_count = self.child_count + record.effective_child_count
            new_ratio = new_child_count / new_size if new_size > 0 else 0.0
            if new_ratio > max_child_ratio:
                return False
        
        return True


@dataclass
class ValidationIssue:
    severity: str
    category: str
    message: str
    related_record_id: Optional[str] = None
    related_payment_id: Optional[str] = None
    line_number: Optional[int] = None
    suggestion: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "severity": self.severity,
            "category": self.category,
            "message": self.message,
            "related_record_id": self.related_record_id,
            "related_payment_id": self.related_payment_id,
            "line_number": self.line_number,
            "suggestion": self.suggestion,
        }


@dataclass
class ProcessingResult:
    raw_registrations: List[RegistrationRecord]
    payments: List[PaymentRecord]
    edits: List[EditRecord]
    merged_records: List[MergedRecord]
    groups: Dict[str, List[Group]]
    waitlist: List[MergedRecord]
    validation_issues: List[ValidationIssue]
    rules: RulesConfig
    
    processing_time: datetime = field(default_factory=datetime.now)
    
    @property
    def confirmed_count(self) -> int:
        return len([r for r in self.merged_records if not r.is_waitlist])
    
    @property
    def waitlist_count(self) -> int:
        return len(self.waitlist)
    
    @property
    def paid_count(self) -> int:
        return len([r for r in self.merged_records if r.payment_status == PaymentStatus.PAID])
    
    @property
    def total_expected_payment(self) -> Decimal:
        return sum(r.expected_payment for r in self.merged_records)
    
    @property
    def total_actual_payment(self) -> Decimal:
        return sum(r.actual_payment for r in self.merged_records)
