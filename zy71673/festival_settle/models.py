from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from decimal import Decimal
import datetime


class RecordStatus(str, Enum):
    PROVISIONAL = "provisional"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class PipelineStage(str, Enum):
    CONTRACT_PARSED = "contract_parsed"
    BOX_OFFICE_COLLECTED = "box_office_collected"
    PAYMENT_MATCHED = "payment_matched"
    SETTLEMENT_CALCULATED = "settlement_calculated"
    REPORT_EXPORTED = "report_exported"


@dataclass
class Contract:
    id: Optional[int] = None
    artist_name: str = ""
    guarantee_amount: Decimal = Decimal("0")
    revenue_share_ratio: Decimal = Decimal("0")
    sponsor_clause: str = ""
    performance_slot: str = ""
    remarks: str = ""
    content_hash: str = ""
    status: RecordStatus = RecordStatus.PROVISIONAL
    created_at: str = ""


@dataclass
class BoxOfficeRecord:
    id: Optional[int] = None
    date: str = ""
    artist_name: str = ""
    ticket_revenue: Decimal = Decimal("0")
    ticket_count: int = 0
    performance_slot: str = ""
    remarks: str = ""
    content_hash: str = ""
    status: RecordStatus = RecordStatus.PROVISIONAL
    created_at: str = ""


@dataclass
class SponsorRecord:
    id: Optional[int] = None
    sponsor_name: str = ""
    artist_name: str = ""
    exposure_amount: Decimal = Decimal("0")
    deduction_amount: Decimal = Decimal("0")
    remarks: str = ""
    content_hash: str = ""
    status: RecordStatus = RecordStatus.PROVISIONAL
    created_at: str = ""


@dataclass
class PaymentRecord:
    id: Optional[int] = None
    artist_name: str = ""
    amount: Decimal = Decimal("0")
    payment_date: str = ""
    payment_type: str = ""
    remarks: str = ""
    content_hash: str = ""
    status: RecordStatus = RecordStatus.PROVISIONAL
    created_at: str = ""


@dataclass
class SettlementRecord:
    id: Optional[int] = None
    artist_name: str = ""
    performance_slot: str = ""
    guarantee_amount: Decimal = Decimal("0")
    box_office_revenue: Decimal = Decimal("0")
    revenue_share_ratio: Decimal = Decimal("0")
    revenue_share_amount: Decimal = Decimal("0")
    sponsor_deduction: Decimal = Decimal("0")
    total_entitlement: Decimal = Decimal("0")
    total_paid: Decimal = Decimal("0")
    net_due: Decimal = Decimal("0")
    issues: str = ""
    variance_explanation: str = ""
    remarks: str = ""
    status: RecordStatus = RecordStatus.PROVISIONAL
    stage: PipelineStage = PipelineStage.SETTLEMENT_CALCULATED
    created_at: str = ""
    updated_at: str = ""


@dataclass
class PipelineState:
    artist_name: str = ""
    stage: PipelineStage = PipelineStage.CONTRACT_PARSED
    status: RecordStatus = RecordStatus.PROVISIONAL
    updated_at: str = ""
