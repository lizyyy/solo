from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class RecordStatus(str, Enum):
    CONFIRMED = "已确认"
    PENDING_SUPPLEMENT = "待补"
    MANUAL_MODIFIED = "人工改过"


class ChangeType(str, Enum):
    MATERIAL_SUPPLEMENT = "补材料"
    CONCLUSION_CHANGE = "改结论"
    KNOWLEDGE_MODIFY = "知识库改动"


class ConclusionType(str, Enum):
    PASS = "通过"
    FAIL = "不通过"
    NEEDS_REVIEW = "待复核"


@dataclass
class InspectionRecord:
    record_id: str
    received_at: datetime
    question: str
    standard_answer: str
    initial_conclusion: ConclusionType
    current_conclusion: ConclusionType
    status: RecordStatus
    inspection_items: Dict[str, Any]
    inspector: str
    remarks: Optional[str] = None
    material_supplement_at: Optional[datetime] = None
    last_modified_at: Optional[datetime] = None
    modified_by: Optional[str] = None
    change_history: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class CustomerServiceDialog:
    dialog_id: str
    record_id: str
    received_at: datetime
    customer_id: str
    session_content: List[Dict[str, str]]
    key_points: List[str]
    is_delayed: bool = False
    delay_hours: float = 0.0


@dataclass
class KnowledgeBaseChange:
    change_id: str
    record_id: str
    changed_at: datetime
    change_type: ChangeType
    field_name: str
    old_value: str
    new_value: str
    operator: str
    is_manual: bool = True
    reason: Optional[str] = None


@dataclass
class EvidenceLink:
    record_id: str
    evidence_type: str
    evidence_id: str
    evidence_title: str
    evidence_summary: str
    conclusion_point: str
    confidence: float
