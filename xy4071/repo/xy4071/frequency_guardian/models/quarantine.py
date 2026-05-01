"""隔离存储模型"""

from datetime import datetime
from typing import List, Optional, Any, Dict
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from .violation import Violation


class QuarantineEntry(BaseModel):
    """隔离条目模型"""

    entry_id: str = Field(default_factory=lambda: str(uuid4()), description="条目唯一标识")
    source_type: str = Field(description="来源类型: radio, frequency, schedule, log")
    source_file: Optional[str] = Field(default=None, description="来源文件名")
    line_number: Optional[int] = Field(default=None, description="源文件行号")
    raw_data: Dict[str, Any] = Field(default_factory=dict, description="原始数据")

    violations: List[Violation] = Field(default_factory=list, description="违规列表")

    quarantine_reason: str = Field(default="数据验证失败", description="隔离原因")
    quarantined_at: datetime = Field(default_factory=datetime.now, description="隔离时间")
    quarantine_note: Optional[str] = Field(default=None, description="隔离备注")

    status: str = Field(default="quarantined", description="状态: quarantined, reviewed, resolved, dismissed")
    reviewed_by: Optional[str] = Field(default=None, description="复核人")
    reviewed_at: Optional[datetime] = Field(default=None, description="复核时间")
    review_notes: Optional[str] = Field(default=None, description="复核备注")
    review_decision: Optional[str] = Field(default=None, description="复核决定: accept, reject, needs_more_info")

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str) -> str:
        """验证来源类型"""
        valid_types = ["radio", "frequency", "schedule", "log"]
        if v.lower() not in valid_types:
            raise ValueError(f"无效的来源类型: {v}, 有效类型: {valid_types}")
        return v.lower()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """验证状态"""
        valid_statuses = ["quarantined", "reviewed", "resolved", "dismissed"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"无效的状态: {v}, 有效状态: {valid_statuses}")
        return v.lower()

    @field_validator("review_decision")
    @classmethod
    def validate_review_decision(cls, v: Optional[str]) -> Optional[str]:
        """验证复核决定"""
        if v is None:
            return None
        valid_decisions = ["accept", "reject", "needs_more_info"]
        if v.lower() not in valid_decisions:
            raise ValueError(f"无效的复核决定: {v}, 有效决定: {valid_decisions}")
        return v.lower()

    def add_violation(self, violation: Violation) -> None:
        """添加违规"""
        self.violations.append(violation)

    def has_violations(self) -> bool:
        """是否有违规"""
        return len(self.violations) > 0

    def get_violation_count(self) -> int:
        """获取违规数量"""
        return len(self.violations)

    class Config:
        validate_assignment = True
        use_enum_values = True


class ReviewRecord(BaseModel):
    """复核记录模型"""

    review_id: str = Field(default_factory=lambda: str(uuid4()), description="复核唯一标识")
    entry_id: str = Field(description="关联的隔离条目ID")
    violation_id: Optional[str] = Field(default=None, description="关联的违规ID（可选）")

    reviewer: str = Field(description="复核人")
    reviewed_at: datetime = Field(default_factory=datetime.now, description="复核时间")

    decision: str = Field(description="复核决定: confirm, dismiss, needs_more_info")
    notes: Optional[str] = Field(default=None, description="复核备注")

    correction_applied: bool = Field(default=False, description="是否已应用修正")
    correction_details: Optional[Dict[str, Any]] = Field(default=None, description="修正详情")

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        """验证复核决定"""
        valid_decisions = ["confirm", "dismiss", "needs_more_info"]
        if v.lower() not in valid_decisions:
            raise ValueError(f"无效的复核决定: {v}, 有效决定: {valid_decisions}")
        return v.lower()

    class Config:
        validate_assignment = True


class QuarantineStore(BaseModel):
    """隔离存储模型"""

    store_name: str = Field(default="频率排班守门员隔离存储", description="存储名称")
    version: str = Field(default="1.0", description="版本")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    last_updated: datetime = Field(default_factory=datetime.now, description="最后更新时间")

    entries: List[QuarantineEntry] = Field(default_factory=list, description="隔离条目列表")
    reviews: List[ReviewRecord] = Field(default_factory=list, description="复核记录列表")

    project_name: Optional[str] = Field(default=None, description="项目名称")
    exercise_name: Optional[str] = Field(default=None, description="演练名称")

    def add_entry(self, entry: QuarantineEntry) -> None:
        """添加隔离条目"""
        self.entries.append(entry)
        self.last_updated = datetime.now()

    def get_entry_by_id(self, entry_id: str) -> Optional[QuarantineEntry]:
        """根据ID获取隔离条目"""
        for entry in self.entries:
            if entry.entry_id == entry_id:
                return entry
        return None

    def get_entries_by_source_type(self, source_type: str) -> List[QuarantineEntry]:
        """根据来源类型获取隔离条目"""
        return [e for e in self.entries if e.source_type == source_type.lower()]

    def get_entries_by_status(self, status: str) -> List[QuarantineEntry]:
        """根据状态获取隔离条目"""
        return [e for e in self.entries if e.status == status.lower()]

    def add_review(self, review: ReviewRecord) -> None:
        """添加复核记录"""
        self.reviews.append(review)
        self.last_updated = datetime.now()

    def get_reviews_for_entry(self, entry_id: str) -> List[ReviewRecord]:
        """获取指定条目的所有复核记录"""
        return [r for r in self.reviews if r.entry_id == entry_id]

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        total = len(self.entries)
        quarantined = len([e for e in self.entries if e.status == "quarantined"])
        reviewed = len([e for e in self.entries if e.status == "reviewed"])
        resolved = len([e for e in self.entries if e.status == "resolved"])
        dismissed = len([e for e in self.entries if e.status == "dismissed"])

        by_source_type = {}
        for entry in self.entries:
            st = entry.source_type
            by_source_type[st] = by_source_type.get(st, 0) + 1

        return {
            "total_entries": total,
            "status_counts": {
                "quarantined": quarantined,
                "reviewed": reviewed,
                "resolved": resolved,
                "dismissed": dismissed,
            },
            "by_source_type": by_source_type,
            "total_reviews": len(self.reviews),
        }

    class Config:
        validate_assignment = True
        use_enum_values = True
