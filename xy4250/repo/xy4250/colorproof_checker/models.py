from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional, Dict, List, Any
from decimal import Decimal


class ProofStatus(Enum):
    PENDING = "pending"
    CHECKING = "checking"
    APPROVED = "approved"
    RELEASED = "released"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"


class RiskLevel(Enum):
    SAFE = "safe"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class ColorMeasurement:
    id: str
    sample_name: str
    batch_number: str
    color_code: str
    delta_e: Decimal
    delta_l: Optional[Decimal] = None
    delta_a: Optional[Decimal] = None
    delta_b: Optional[Decimal] = None
    delta_c: Optional[Decimal] = None
    delta_h: Optional[Decimal] = None
    lab_l: Optional[Decimal] = None
    lab_a: Optional[Decimal] = None
    lab_b: Optional[Decimal] = None
    measurement_date: Optional[datetime] = None
    notes: Optional[str] = None


@dataclass
class InkFormula:
    id: str
    color_code: str
    color_name: str
    customer_id: str
    customer_name: str
    pantone_code: Optional[str] = None
    base_inks: Dict[str, Decimal] = field(default_factory=dict)
    total_weight: Decimal = Decimal("100")
    viscosity: Optional[Decimal] = None
    ph_value: Optional[Decimal] = None
    create_date: Optional[date] = None
    notes: Optional[str] = None


@dataclass
class PaperBatch:
    id: str
    batch_number: str
    paper_type: str
    paper_name: str
    grammage: int
    width: Optional[int] = None
    length: Optional[int] = None
    supplier: Optional[str] = None
    manufacture_date: Optional[date] = None
    expiry_date: Optional[date] = None
    received_date: Optional[date] = None
    total_quantity: Optional[Decimal] = None
    used_quantity: Optional[Decimal] = None
    warehouse_location: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class DryingRecord:
    id: str
    proof_id: str
    batch_number: str
    print_time: datetime
    drying_start_time: datetime
    drying_end_time: Optional[datetime] = None
    drying_method: str = "自然晾干"
    drying_temperature: Optional[Decimal] = None
    drying_humidity: Optional[Decimal] = None
    coating_type: Optional[str] = None
    coating_amount: Optional[Decimal] = None
    operator_name: Optional[str] = None
    visual_check_result: Optional[bool] = None
    touch_check_result: Optional[bool] = None
    notes: Optional[str] = None


@dataclass
class ProofTask:
    id: str
    task_number: str
    customer_id: str
    customer_name: str
    color_code: str
    color_name: str
    paper_batch_number: str
    ink_formula_id: str
    create_time: datetime = field(default_factory=datetime.now)
    status: ProofStatus = ProofStatus.PENDING
    color_measurement_id: Optional[str] = None
    drying_record_id: Optional[str] = None
    check_results: Dict[str, Any] = field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.SAFE
    risks: List[Dict[str, Any]] = field(default_factory=list)
    release_time: Optional[datetime] = None
    released_by: Optional[str] = None
    rollback_time: Optional[datetime] = None
    rolled_back_by: Optional[str] = None
    rollback_reason: Optional[str] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CustomerTolerance:
    customer_id: str
    customer_name: str
    delta_e_tolerance: Decimal = Decimal("2.0")
    delta_l_tolerance: Optional[Decimal] = None
    delta_a_tolerance: Optional[Decimal] = None
    delta_b_tolerance: Optional[Decimal] = None
    special_tolerances: Dict[str, Decimal] = field(default_factory=dict)
    min_drying_hours: Decimal = Decimal("4")
    notes: Optional[str] = None


@dataclass
class WorkspaceState:
    workspace_path: str
    last_updated: datetime = field(default_factory=datetime.now)
    active_proof_ids: List[str] = field(default_factory=list)
    import_snapshots: List[Dict[str, Any]] = field(default_factory=list)
    release_history: List[Dict[str, Any]] = field(default_factory=list)
