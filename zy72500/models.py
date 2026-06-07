from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class RecordStatus(Enum):
    PENDING = "待复核"
    CONFIRMED = "已确认"
    DUPLICATE = "重复计入"
    RESOLVED = "已解决"


class IntentCategory(Enum):
    REFUND = "退款申请"
    COMPLAINT = "服务投诉"
    CONSULT = "业务咨询"
    RETURN = "退货换货"
    OTHER = "其他"


@dataclass
class AnnotationNote:
    annotator: str
    note: str
    timestamp: datetime
    is_official_caliber: bool = False


@dataclass
class UserFeedback:
    feedback_id: str
    user_id: str
    content: str
    timestamp: datetime
    old_model_intent: IntentCategory
    new_model_intent: IntentCategory
    gray_batch: str
    status: RecordStatus = RecordStatus.PENDING
    annotation_notes: List[AnnotationNote] = field(default_factory=list)
    duplicate_of: Optional[str] = None
    manual_correction: Optional[IntentCategory] = None
    evidence_snapshot: Optional[Dict] = None

    def to_dict(self) -> Dict:
        return {
            "feedback_id": self.feedback_id,
            "user_id": self.user_id,
            "content": self.content,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "old_model_intent": self.old_model_intent.value,
            "new_model_intent": self.new_model_intent.value,
            "gray_batch": self.gray_batch,
            "status": self.status.value,
            "annotation_notes": [
                {
                    "annotator": n.annotator,
                    "note": n.note,
                    "timestamp": n.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "is_official_caliber": n.is_official_caliber
                }
                for n in self.annotation_notes
            ],
            "duplicate_of": self.duplicate_of,
            "manual_correction": self.manual_correction.value if self.manual_correction else None,
        }
