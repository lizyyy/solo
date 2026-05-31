from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from .evidence import EvidenceRef
from .constraint import ConstraintOverride


class ChangeType(str, Enum):
    SUPPLEMENT = "supplement"
    CONCLUSION_CHANGE = "conclusion_change"
    CONSTRAINT_OVERRIDE = "constraint_override"
    MANUAL_EDIT = "manual_edit"


class ChangeSource(str, Enum):
    RESULT_GRAPH = "result_graph"
    EXPERIMENTAL_DATA = "experimental_data"
    MANUAL = "manual"
    SYSTEM = "system"


class ChangeRecord(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    change_type: ChangeType
    source: ChangeSource
    description: str = ""
    before: Optional[Any] = None
    after: Optional[Any] = None
    evidence_ref: Optional[EvidenceRef] = None
    override_ref: Optional[ConstraintOverride] = None
    changed_by: str = "system"
    created_at: datetime = Field(default_factory=datetime.now)

    def is_conclusion_changing(self) -> bool:
        return self.change_type in (
            ChangeType.CONCLUSION_CHANGE,
            ChangeType.CONSTRAINT_OVERRIDE,
        )

    def summary(self) -> str:
        type_label = {
            ChangeType.SUPPLEMENT: "补材料",
            ChangeType.CONCLUSION_CHANGE: "改结论",
            ChangeType.CONSTRAINT_OVERRIDE: "约束覆盖",
            ChangeType.MANUAL_EDIT: "手动修改",
        }
        source_label = {
            ChangeSource.RESULT_GRAPH: "结果图",
            ChangeSource.EXPERIMENTAL_DATA: "实验数据",
            ChangeSource.MANUAL: "手动",
            ChangeSource.SYSTEM: "系统",
        }
        parts = [
            f"[{type_label[self.change_type]}] 来源:{source_label[self.source]}",
            f"  {self.description}",
        ]
        if self.before is not None or self.after is not None:
            parts.append(f"  变更: {self.before} → {self.after}")
        if self.evidence_ref:
            parts.append(f"  依据: {self.evidence_ref.label()}")
        if self.override_ref:
            parts.append(f"  约束覆盖说明:\n{self.override_ref.explain()}")
        return "\n".join(parts)
