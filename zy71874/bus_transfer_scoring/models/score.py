from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from .evidence import EvidenceRef


class ScoreItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    dimension: str
    score: float
    max_score: float
    description: str = ""
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    constraint_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    def trace_evidence(self) -> list[str]:
        return [ref.label() for ref in self.evidence_refs]

    def detail(self) -> str:
        lines = [
            f"[{self.dimension}] {self.score}/{self.max_score}",
            f"  说明: {self.description}",
        ]
        if self.evidence_refs:
            lines.append("  依据:")
            for ref in self.evidence_refs:
                lines.append(f"    - {ref.label()} (到达时间: {ref.arrived_at:%Y-%m-%d %H:%M})")
        else:
            lines.append("  依据: (无)")
        return "\n".join(lines)


class ScoreResult(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    team_id: str
    route_id: str
    total_score: float = 0.0
    items: list[ScoreItem] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def compute_total(self) -> float:
        self.total_score = sum(item.score for item in self.items)
        self.updated_at = datetime.now()
        return self.total_score

    def trace_all_evidence(self) -> dict[str, list[str]]:
        return {item.dimension: item.trace_evidence() for item in self.items}

    def report(self) -> str:
        parts = [
            f"公交换乘评分报告 - 队伍:{self.team_id} 路线:{self.route_id}",
            f"总分: {self.total_score}",
            "=" * 50,
        ]
        for item in self.items:
            parts.append(item.detail())
        parts.append("=" * 50)
        parts.append("可追溯依据汇总:")
        for dim, refs in self.trace_all_evidence().items():
            if refs:
                parts.append(f"  {dim}: {', '.join(refs)}")
            else:
                parts.append(f"  {dim}: (无依据)")
        return "\n".join(parts)
