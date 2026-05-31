from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from .evidence import EvidenceKind


class OverrideSource(str, Enum):
    RESULT_GRAPH = "result_graph"
    EXPERIMENTAL_DATA = "experimental_data"
    MANUAL = "manual"


class ConstraintSpec(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str
    description: str
    value: Any
    unit: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    version: int = 1

    def deactivate(self) -> "ConstraintSpec":
        return self.model_copy(update={"is_active": False})


class ConstraintOverride(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    constraint_id: str
    constraint_name: str
    old_value: Any
    new_value: Any
    source: OverrideSource
    source_evidence_id: Optional[str] = None
    source_evidence_kind: Optional[EvidenceKind] = None
    reason: str = ""
    next_action: str = ""
    next_responsible: str = ""
    created_at: datetime = Field(default_factory=datetime.now)

    def explain(self) -> str:
        kind_label = {
            OverrideSource.RESULT_GRAPH: "结果图",
            OverrideSource.EXPERIMENTAL_DATA: "实验数据",
            OverrideSource.MANUAL: "手动修改",
        }
        src = kind_label[self.source]
        parts = [
            f"约束 [{self.constraint_name}] 被覆盖:",
            f"  来源: {src}",
        ]
        if self.source_evidence_id:
            parts.append(f"  依据ID: {self.source_evidence_id}")
        parts.append(f"  原值: {self.old_value} → 新值: {self.new_value}")
        if self.reason:
            parts.append(f"  原因: {self.reason}")
        if self.next_action:
            parts.append(f"  下一步: {self.next_action}")
        if self.next_responsible:
            parts.append(f"  补材料方: {self.next_responsible}")
        return "\n".join(parts)
