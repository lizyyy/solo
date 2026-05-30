"""基础数据模型"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from uuid import uuid4

from pydantic import BaseModel as PydanticBaseModel, Field, field_validator


class ConflictResolution(str, Enum):
    """冲突处理策略"""
    SKIP = "skip"
    UPDATE = "update"
    ASK = "ask"
    ERROR = "error"


class BaseModel(PydanticBaseModel):
    """基础模型"""
    model_config = {"arbitrary_types_allowed": True}

    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    version: int = 1
    notes: Optional[str] = None

    def touch(self) -> None:
        """更新时间戳和版本"""
        self.updated_at = datetime.now()
        self.version += 1


class AuditMixin(PydanticBaseModel):
    """审计混入类"""
    created_by: Optional[str] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    is_confirmed: bool = False
    change_history: list[Dict[str, Any]] = Field(default_factory=list)

    def record_change(self, field: str, old_value: Any, new_value: Any, operator: Optional[str] = None) -> None:
        """记录变更历史"""
        self.change_history.append({
            "field": field,
            "old_value": old_value,
            "new_value": new_value,
            "operator": operator,
            "changed_at": datetime.now().isoformat(),
        })

    def confirm(self, operator: str) -> None:
        """确认数据"""
        self.is_confirmed = True
        self.confirmed_by = operator
        self.confirmed_at = datetime.now()

    @field_validator("change_history")
    @classmethod
    def _validate_change_history(cls, v: list) -> list:
        if not isinstance(v, list):
            return []
        return v
