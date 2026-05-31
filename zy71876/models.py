from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime
import uuid


class RecordStatus(Enum):
    CONFIRMED = "已确认"
    PENDING = "待补"
    MANUAL_MODIFIED = "人工修改"


class AllocationType(Enum):
    AUTO = "自动分配"
    MANUAL = "人工调整"


@dataclass
class Constraint:
    id: str
    name: str
    description: str
    rule_type: str
    rule_expression: str
    priority: int = 1
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Parameter:
    id: str
    name: str
    value: Any
    unit: str = ""
    description: str = ""
    source: str = ""


@dataclass
class Material:
    id: str
    name: str
    category: str
    total_quantity: float
    unit: str
    specs: str = ""


@dataclass
class DemandPoint:
    id: str
    name: str
    location: str
    priority_level: int
    population: int = 0
    demand_items: Dict[str, float] = field(default_factory=dict)


@dataclass
class AllocationRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    material_id: str = ""
    material_name: str = ""
    demand_point_id: str = ""
    demand_point_name: str = ""
    allocated_quantity: float = 0.0
    unit: str = ""
    allocation_type: AllocationType = AllocationType.AUTO
    status: RecordStatus = RecordStatus.PENDING
    judgment_reason: str = ""
    next_step: str = ""
    constraints_applied: List[str] = field(default_factory=list)
    manual_modified: bool = False
    original_quantity: Optional[float] = None
    modified_by: str = ""
    modified_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    version: int = 1
    import_batch: str = ""


@dataclass
class ImportBatch:
    id: str
    filename: str
    import_time: datetime
    record_count: int
    is_active: bool = True


@dataclass
class Workspace:
    name: str
    constraints: Dict[str, Constraint] = field(default_factory=dict)
    parameters: Dict[str, Parameter] = field(default_factory=dict)
    materials: Dict[str, Material] = field(default_factory=dict)
    demand_points: Dict[str, DemandPoint] = field(default_factory=dict)
    allocations: Dict[str, AllocationRecord] = field(default_factory=dict)
    import_batches: Dict[str, ImportBatch] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
