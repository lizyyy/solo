from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ValidationErrorType(str, Enum):
    MISSING_HS_CODE = "MISSING_HS_CODE"
    INVALID_HS_CODE = "INVALID_HS_CODE"
    MISSING_WEIGHT = "MISSING_WEIGHT"
    MISSING_VOLUME = "MISSING_VOLUME"
    WEIGHT_VOLUME_MISMATCH = "WEIGHT_VOLUME_MISMATCH"
    MISSING_CONTAINER_NO = "MISSING_CONTAINER_NO"
    DUPLICATE_CONTAINER = "DUPLICATE_CONTAINER"
    MULTI_TICKET_CONTAINER = "MULTI_TICKET_CONTAINER"
    PROHIBITED_ITEM = "PROHIBITED_ITEM"
    RESTRICTED_ITEM = "RESTRICTED_ITEM"
    DUPLICATE_DECLARATION = "DUPLICATE_DECLARATION"
    CANCELLED_DECLARATION = "CANCELLED_DECLARATION"
    MISSING_CERTIFICATE = "MISSING_CERTIFICATE"
    INVALID_NAME = "INVALID_NAME"


@dataclass
class ValidationError:
    error_type: ValidationErrorType
    message: str
    item_id: Optional[str] = None
    container_no: Optional[str] = None
    ticket_no: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.MEDIUM
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ManifestItem:
    ticket_no: str
    container_no: str
    description: str
    hs_code: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: str = "KG"
    volume: Optional[float] = None
    volume_unit: str = "CBM"
    quantity: Optional[int] = None
    origin_country: Optional[str] = None
    destination_country: Optional[str] = None
    is_cancelled: bool = False
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Manifest:
    voyage_no: str
    vessel_name: str
    eta: Optional[datetime] = None
    etd: Optional[datetime] = None
    items: List[ManifestItem] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PackingItem:
    ticket_no: str
    container_no: str
    description: str
    hs_code: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: str = "KG"
    volume: Optional[float] = None
    volume_unit: str = "CBM"
    quantity: Optional[int] = None
    package_type: Optional[str] = None
    marks: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PackingList:
    ticket_no: str
    packing_date: Optional[datetime] = None
    items: List[PackingItem] = field(default_factory=list)
    total_weight: Optional[float] = None
    total_volume: Optional[float] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DeclarationRule:
    rule_id: str
    rule_name: str
    rule_type: str
    conditions: Dict[str, Any] = field(default_factory=dict)
    required_certificates: List[str] = field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.MEDIUM
    description: str = ""
    priority: int = 100


@dataclass
class CorrectionTask:
    task_id: str
    ticket_no: str
    container_no: Optional[str]
    item_id: Optional[str]
    task_type: str
    description: str
    required_documents: List[str] = field(default_factory=list)
    priority: int = 1
    risk_level: RiskLevel = RiskLevel.MEDIUM
    status: str = "PENDING"
    due_date: Optional[datetime] = None


@dataclass
class ContainerReconciliation:
    container_no: str
    ticket_numbers: List[str] = field(default_factory=list)
    is_multi_ticket: bool = False
    weight_discrepancy: float = 0.0
    volume_discrepancy: float = 0.0
    has_duplicate_items: bool = False
    issues: List[ValidationError] = field(default_factory=list)


@dataclass
class InspectionResult:
    manifest: Optional[Manifest] = None
    packing_lists: List[PackingList] = field(default_factory=list)
    rules: List[DeclarationRule] = field(default_factory=list)
    
    validation_errors: List[ValidationError] = field(default_factory=list)
    correction_tasks: List[CorrectionTask] = field(default_factory=list)
    container_reconciliations: List[ContainerReconciliation] = field(default_factory=list)
    
    overall_risk_level: RiskLevel = RiskLevel.LOW
    risk_summary: Dict[RiskLevel, int] = field(default_factory=dict)
    
    inspection_time: datetime = field(default_factory=datetime.now)
    raw_issues: List[Dict[str, Any]] = field(default_factory=list)
