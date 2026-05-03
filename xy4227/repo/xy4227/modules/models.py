# 数据模型定义
# 定义项目中使用的各种数据结构

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class RiskLevel(Enum):
    """风险等级"""
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "严重"


class RiskType(Enum):
    """风险类型"""
    SENSITIVE_WORD = "敏感词"
    UNAUTHORIZED_NAME = "未授权姓名"
    ADDRESS = "住址信息"
    PERSONAL_ID = "身份证号"
    PHONE = "电话号码"
    EMAIL = "邮箱地址"
    COMPANY = "公司信息"
    OTHER = "其他敏感信息"


class SpeakerPermission(Enum):
    """说话人权限"""
    FULL_AUTHORIZATION = "完全授权"
    PARTIAL_AUTHORIZATION = "部分授权"
    NO_AUTHORIZATION = "未授权"


class ReviewStatus(Enum):
    """复核状态"""
    PENDING = "待复核"
    APPROVED = "已通过"
    REJECTED = "已驳回"
    MODIFIED = "已修改"


@dataclass
class SubtitleEntry:
    """字幕条目"""
    id: int
    start_time: float  # 秒为单位
    end_time: float
    text: str
    speaker: Optional[str] = None
    notes: str = ""
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time


@dataclass
class Speaker:
    """说话人信息"""
    name: str
    permission: SpeakerPermission
    alias: List[str] = field(default_factory=list)
    notes: str = ""
    authorized_phrases: List[str] = field(default_factory=list)


@dataclass
class SensitiveWord:
    """敏感词定义"""
    word: str
    level: RiskLevel
    category: RiskType
    replacement: str = "[已脱敏]"
    notes: str = ""
    is_pattern: bool = False  # 是否为正则表达式模式


@dataclass
class RiskMarker:
    """风险标记"""
    id: str
    subtitle_id: int
    start_index: int
    end_index: int
    risk_text: str
    risk_type: RiskType
    risk_level: RiskLevel
    suggested_replacement: str
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewer_notes: str = ""
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    custom_replacement: Optional[str] = None


@dataclass
class RiskFragment:
    """风险片段（可合并）"""
    id: str
    subtitle_ids: List[int]  # 关联的字幕ID列表
    start_time: float
    end_time: float
    risk_markers: List[RiskMarker]
    review_status: ReviewStatus = ReviewStatus.PENDING
    merged: bool = False
    merged_from: List[str] = field(default_factory=list)
    notes: str = ""
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def highest_risk_level(self) -> RiskLevel:
        if not self.risk_markers:
            return RiskLevel.LOW
        level_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
        max_level = RiskLevel.LOW
        for marker in self.risk_markers:
            if level_order.index(marker.risk_level) > level_order.index(max_level):
                max_level = marker.risk_level
        return max_level


@dataclass
class NoteEntry:
    """片段备注"""
    id: str
    subtitle_id: int
    note_type: str
    content: str
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = "系统"


@dataclass
class RedactionDecision:
    """脱敏决策记录"""
    id: str
    subtitle_id: int
    original_text: str
    redacted_text: str
    risk_markers: List[RiskMarker]
    decision_type: str  # "redact", "keep", "modify"
    decided_at: datetime = field(default_factory=datetime.now)
    decided_by: str = "系统"
    notes: str = ""


@dataclass
class ProjectState:
    """项目状态"""
    project_name: str
    created_at: datetime
    updated_at: datetime
    subtitles: List[SubtitleEntry]
    speakers: List[Speaker]
    sensitive_words: List[SensitiveWord]
    notes: List[NoteEntry]
    risk_markers: List[RiskMarker]
    risk_fragments: List[RiskFragment]
    redactions: List[RedactionDecision]
    version_history: List[Dict[str, Any]]
    active_version: int = 0


@dataclass
class ExportResult:
    """导出结果"""
    file_path: str
    file_type: str
    export_time: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
