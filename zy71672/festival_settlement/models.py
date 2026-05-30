from dataclasses import dataclass, field
from enum import Enum
from datetime import date, datetime
from typing import Optional
import decimal


class RecordStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


@dataclass
class ArtistContract:
    contract_id: str
    artist_id: str
    artist_name: str
    guarantee_amount: decimal.Decimal
    revenue_share_ratio: decimal.Decimal
    contract_date: date
    stage: str = ""
    notes: str = ""
    status: RecordStatus = RecordStatus.PENDING
    source_file: str = ""


@dataclass
class BoxOfficeTransaction:
    txn_id: str
    txn_date: date
    stage: str
    ticket_type: str
    quantity: int
    unit_price: decimal.Decimal
    total_amount: decimal.Decimal
    notes: str = ""
    status: RecordStatus = RecordStatus.PENDING
    source_file: str = ""


@dataclass
class SponsorTerm:
    sponsor_id: str
    sponsor_name: str
    exposure_type: str
    amount: decimal.Decimal
    artist_ids: list = field(default_factory=list)
    deduction_ratio: decimal.Decimal = decimal.Decimal("0")
    notes: str = ""
    status: RecordStatus = RecordStatus.PENDING
    source_file: str = ""


@dataclass
class PerformanceSchedule:
    schedule_id: str
    artist_id: str
    artist_name: str
    stage: str
    performance_date: date
    start_time: str
    end_time: str
    notes: str = ""
    status: RecordStatus = RecordStatus.PENDING
    source_file: str = ""


@dataclass
class PaymentRecord:
    payment_id: str
    artist_id: str
    amount: decimal.Decimal
    payment_date: date
    payment_type: str
    reference_id: str = ""
    notes: str = ""
    status: RecordStatus = RecordStatus.PENDING
    source_file: str = ""


@dataclass
class SettlementLine:
    settlement_id: str
    artist_id: str
    artist_name: str
    guarantee_amount: decimal.Decimal
    box_office_share: decimal.Decimal
    sponsor_deduction: decimal.Decimal
    total_due: decimal.Decimal
    total_paid: decimal.Decimal
    variance: decimal.Decimal
    notes: str = ""
    status: RecordStatus = RecordStatus.PENDING
    created_at: str = ""
    updated_at: str = ""


@dataclass
class NoteEntry:
    note_id: str
    entity_type: str
    entity_id: str
    content: str
    created_at: str
    author: str = "system"


@dataclass
class AnomalyItem:
    anomaly_id: str
    anomaly_type: str
    entity_type: str
    entity_id: str
    description: str
    severity: str = "warning"
    resolved: bool = False
    resolution_note: str = ""


@dataclass
class SettlementSummary:
    total_artists: int
    total_guarantee: decimal.Decimal
    total_box_office_share: decimal.Decimal
    total_sponsor_deduction: decimal.Decimal
    total_due: decimal.Decimal
    total_paid: decimal.Decimal
    total_variance: decimal.Decimal
    anomaly_count: int
    confirmed_count: int
    rejected_count: int
    pending_count: int
