from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class CheckStatus(Enum):
    PASS = "pass"
    PENDING_CONFIRM = "pending_confirm"
    FAIL = "fail"


class AnomalyType(Enum):
    MODEL_DUPLICATE = "model_duplicate"
    ROUTE_BLOCKED = "route_blocked"
    AXIS_FLIPPED = "axis_flipped"


@dataclass
class TraceRef:
    source_type: str
    source_id: str
    detail: str = ""


@dataclass
class CADPoint:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    label: str = ""
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    version: int = 1
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class EquipmentNote:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    equipment_name: str = ""
    model_id: str = ""
    position_cad_point_id: Optional[str] = None
    remark: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class RouteCheckResult:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    run_id: str = ""
    check_item: str = ""
    status: CheckStatus = CheckStatus.PASS
    anomaly_type: Optional[AnomalyType] = None
    description: str = ""
    trace_refs: List[TraceRef] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class RouteRun:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    batch_key: str = ""
    run_index: int = 1
    material_snapshot: Dict[str, Any] = field(default_factory=dict)
    results: List[RouteCheckResult] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class CADChangeAlert:
    point_id: str = ""
    point_label: str = ""
    old_version: int = 0
    new_version: int = 0
    changes: Dict[str, Any] = field(default_factory=dict)
    affected_results: List[str] = field(default_factory=list)
