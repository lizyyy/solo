from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class SampleStatus(Enum):
    PENDING = "待处理"
    NORMAL = "正常"
    CONFLICT = "冲突"
    NEED_PRODUCT_REVIEW = "待产品复核"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"


class MaterialType(Enum):
    NORMAL = "正常材料"
    WRONG_STANDARD = "错口径材料"
    SUPPLEMENTARY = "补录材料"


@dataclass
class SampleRecord:
    sample_id: str
    prompt_version: str
    knowledge_link: str
    material_type: MaterialType
    hallucination_mark: bool
    status: SampleStatus = SampleStatus.PENDING
    link_valid: Optional[bool] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    operator: Optional[str] = None
    remark: Optional[str] = None
    supplementary_from: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "样本ID": self.sample_id,
            "提示词版本号": self.prompt_version,
            "知识库引用链接": self.knowledge_link,
            "材料类型": self.material_type.value,
            "幻觉标记": self.hallucination_mark,
            "状态": self.status.value,
            "链接有效性": ("有效" if self.link_valid is True else "无效" if self.link_valid is False else "未检测"),
            "创建时间": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": self.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "操作人": self.operator or "",
            "备注": self.remark or "",
            "补录来源": self.supplementary_from or ""
        }


@dataclass
class ConflictEvidence:
    sample_id: str
    conflict_type: str
    prompt_evidence: str
    link_evidence: str
    description: str
    created_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "样本ID": self.sample_id,
            "冲突类型": self.conflict_type,
            "提示词版本证据": self.prompt_evidence,
            "知识库链接证据": self.link_evidence,
            "冲突描述": self.description,
            "创建时间": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "是否已解决": "是" if self.resolved else "否",
            "处理结果": self.resolution or "",
            "处理人": self.resolved_by or ""
        }


@dataclass
class HistoryRecord:
    sample_id: str
    action: str
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    operator: str = ""
    detail: str = ""
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "样本ID": self.sample_id,
            "操作": self.action,
            "操作前状态": self.before_status or "",
            "操作后状态": self.after_status or "",
            "操作人": self.operator,
            "操作详情": self.detail,
            "时间": self.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }


@dataclass
class SelfCheckResult:
    check_type: str
    passed: bool
    message: str
    details: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "检查项": self.check_type,
            "是否通过": "是" if self.passed else "否",
            "说明": self.message,
            "详情": "\n".join(self.details)
        }
