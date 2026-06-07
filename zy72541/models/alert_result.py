from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from enum import Enum


class AlertStatus(str, Enum):
    NORMAL = "正常"
    EXPIRED = "知识过期"
    NEED_REVIEW = "待算法复核"
    UPDATED = "已更新口径"
    REWORKED = "返工修正"


class DesensitizationStatus(str, Enum):
    PASSED = "脱敏通过"
    PHONE_LEAKED = "手机号漏遮"
    PARTIAL_MASKED = "部分脱敏"
    FIXED = "已修复"


class EvidenceSource(str, Enum):
    GRAY_BATCH = "灰度批次"
    ANNOTATION = "标注员留言"
    BOTH = "双证据"


@dataclass
class AlertResult:
    result_id: str
    batch_id: str
    session_id: str
    knowledge_id: str
    original_question: str
    current_answer: str
    annotation_remark: str = ""
    on_site_statement: str = ""
    alert_status: AlertStatus = AlertStatus.NORMAL
    desensitization_status: DesensitizationStatus = DesensitizationStatus.PASSED
    evidence_source: EvidenceSource = EvidenceSource.GRAY_BATCH
    processed_by: Optional[str] = None
    processed_at: Optional[str] = None
    version: int = 1
    history: List[dict] = field(default_factory=list)
    raw_phone_found: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    def add_history(self, action: str, operator: str, detail: str):
        self.history.append({
            "action": action,
            "operator": operator,
            "detail": detail,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "version": self.version
        })

    def increment_version(self):
        self.version += 1
