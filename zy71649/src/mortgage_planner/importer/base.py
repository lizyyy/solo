"""导入基础模块"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Any, Dict, TypeVar, Generic
from pathlib import Path

from pydantic import BaseModel

from ..models.base import ConflictResolution
from ..exceptions.base import MortgageException


T = TypeVar("T")


class ImportAction(str, Enum):
    """导入操作"""
    INSERTED = "inserted"
    UPDATED = "updated"
    SKIPPED = "skipped"
    CONFLICTED = "conflicted"
    FAILED = "failed"

    @property
    def icon(self) -> str:
        icons = {
            self.INSERTED: "✅",
            self.UPDATED: "🔄",
            self.SKIPPED: "⏭️",
            self.CONFLICTED: "⚔️",
            self.FAILED: "❌",
        }
        return icons[self]


class ImportStatus(str, Enum):
    """导入状态"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class ImportResult(BaseModel, Generic[T]):
    """导入结果"""
    model_config = {"arbitrary_types_allowed": True}

    filename: str
    total_records: int = 0
    successful: int = 0
    skipped: int = 0
    updated: int = 0
    conflicts: int = 0
    failed: int = 0
    action_summary: Dict[str, int] = {}
    records: List[tuple[ImportAction, Optional[T], Optional[MortgageException]]] = []
    started_at: datetime
    completed_at: Optional[datetime] = None
    conflict_resolution: ConflictResolution = ConflictResolution.ASK

    def add_record(
        self,
        action: ImportAction,
        record: Optional[T] = None,
        error: Optional[MortgageException] = None,
    ) -> None:
        """添加记录结果"""
        self.total_records += 1
        self.records.append((action, record, error))
        self.action_summary[action.value] = self.action_summary.get(action.value, 0) + 1

        if action == ImportAction.INSERTED:
            self.successful += 1
        elif action == ImportAction.UPDATED:
            self.updated += 1
            self.successful += 1
        elif action == ImportAction.SKIPPED:
            self.skipped += 1
        elif action == ImportAction.CONFLICTED:
            self.conflicts += 1
        elif action == ImportAction.FAILED:
            self.failed += 1

    @property
    def status(self) -> ImportStatus:
        """获取导入状态"""
        if self.failed > 0 and self.successful == 0:
            return ImportStatus.FAILED
        if self.conflicts > 0 or self.failed > 0:
            return ImportStatus.PARTIAL
        return ImportStatus.SUCCESS

    @property
    def errors(self) -> List[MortgageException]:
        """获取所有错误"""
        return [e for _, _, e in self.records if e is not None]

    @property
    def has_conflicts(self) -> bool:
        """是否有冲突"""
        return self.conflicts > 0

    @property
    def has_failures(self) -> bool:
        """是否有失败"""
        return self.failed > 0

    def complete(self) -> None:
        """标记导入完成"""
        self.completed_at = datetime.now()

    def get_summary(self) -> Dict[str, int]:
        """获取汇总统计"""
        return {
            "新增": self.successful - self.updated,
            "更新": self.updated,
            "跳过": self.skipped,
            "冲突": self.conflicts,
            "失败": self.failed,
        }

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "filename": self.filename,
            "total_records": self.total_records,
            "successful": self.successful,
            "skipped": self.skipped,
            "updated": self.updated,
            "conflicts": self.conflicts,
            "failed": self.failed,
            "status": self.status.value,
            "action_summary": self.action_summary,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "errors": [e.to_dict() for e in self.errors],
        }
