from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class ForbiddenStatus(Enum):
    PENDING = "待处理"
    NORMAL = "正常通过"
    LINK_404_PASSED = "链接404但判通过"
    NEED_PM_REVIEW = "待产品经理复核"
    CONFLICT = "口径冲突"
    SUPPLEMENTED = "已补录修正"
    REJECTED = "已驳回"


class RecordSource(Enum):
    ANNOTATOR_COMMENT = "标注员留言"
    MODEL_OUTPUT = "模型输出片段"
    MANUAL_CORRECTION = "人工修正"


class ConflictType(Enum):
    OLD_CALIBER_FOUND = "发现旧口径"
    LINK_BROKEN = "链接失效"
    CONTENT_MISMATCH = "内容不一致"


@dataclass
class AnnotatorComment:
    id: str
    content: str
    annotator: str
    timestamp: datetime
    reference_url: Optional[str] = None
    product_id: Optional[str] = None
    reason: Optional[str] = None


@dataclass
class ModelOutputFragment:
    id: str
    content: str
    model_version: str
    timestamp: datetime
    source_task_id: str
    matched_product_id: Optional[str] = None


@dataclass
class ForbiddenRecord:
    id: str
    keyword: str
    status: ForbiddenStatus
    source: RecordSource
    created_at: datetime
    updated_at: datetime
    annotator_comment_id: Optional[str] = None
    model_output_id: Optional[str] = None
    reference_url: Optional[str] = None
    link_404: bool = False
    conflict_note: Optional[str] = None
    pm_review_note: Optional[str] = None
    history: List[Dict] = field(default_factory=list)

    def add_history(self, action: str, operator: str, note: str = ""):
        self.history.append({
            "action": action,
            "operator": operator,
            "note": note,
            "timestamp": datetime.now().isoformat()
        })
        self.updated_at = datetime.now()


@dataclass
class ConflictSample:
    id: str
    forbidden_record_id: str
    conflict_type: ConflictType
    old_content: str
    new_content: str
    detected_at: datetime
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None


@dataclass
class WorkflowState:
    step: int = 0
    current_operator: Optional[str] = None
    records_processed: int = 0
    conflicts_found: int = 0
    pm_review_needed: int = 0
