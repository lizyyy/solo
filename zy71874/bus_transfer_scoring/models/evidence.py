from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class EvidenceKind(str, Enum):
    RESULT_GRAPH = "result_graph"
    EXPERIMENTAL_DATA = "experimental_data"


class EvidenceRef(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    kind: EvidenceKind
    source_id: str
    description: str = ""
    arrived_at: datetime = Field(default_factory=datetime.now)
    snapshot: Optional[dict[str, Any]] = None

    def label(self) -> str:
        kind_map = {
            EvidenceKind.RESULT_GRAPH: "结果图",
            EvidenceKind.EXPERIMENTAL_DATA: "实验数据",
        }
        return f"[{kind_map[self.kind]}] {self.source_id}"


class ResultGraph(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    team_id: str
    route_id: str
    graph_url: str = ""
    description: str = ""
    uploaded_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def as_evidence_ref(self) -> EvidenceRef:
        return EvidenceRef(
            kind=EvidenceKind.RESULT_GRAPH,
            source_id=self.id,
            description=self.description or f"结果图-{self.route_id}",
            arrived_at=self.uploaded_at,
            snapshot={"team_id": self.team_id, "route_id": self.route_id},
        )


class ExperimentalData(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    team_id: str
    route_id: str
    data_url: str = ""
    description: str = ""
    uploaded_at: datetime = Field(default_factory=datetime.now)
    metrics: dict[str, Any] = Field(default_factory=dict)

    def as_evidence_ref(self) -> EvidenceRef:
        return EvidenceRef(
            kind=EvidenceKind.EXPERIMENTAL_DATA,
            source_id=self.id,
            description=self.description or f"实验数据-{self.route_id}",
            arrived_at=self.uploaded_at,
            snapshot={"team_id": self.team_id, "route_id": self.route_id, "metrics": self.metrics},
        )
