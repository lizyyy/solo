# -*- coding: utf-8 -*-
"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from enum import Enum


class WorkOrderStatus(Enum):
    PENDING = "待排程"
    SCHEDULED = "已排程"
    CONFLICT = "存在冲突"
    NEED_REVIEW = "待人工确认"


class DockType(Enum):
    GRAVING = "干船坞"
    FLOATING = "浮船坞"
    SLIPWAY = "船台"


class LiftType(Enum):
    GANTRY = "龙门吊"
    FLOATING = "浮吊"
    TRAVELING = "移动吊"


class CraftType(Enum):
    ELECTRICIAN = "电工"
    WELDER = "焊工"
    FITTER = "钳工"
    PAINTER = "油漆工"
    RIGGER = "起重工"
    MECHANIC = "机修工"


@dataclass
class Ship:
    name: str
    imo_number: str
    length: float
    width: float
    depth: float
    vessel_type: str


@dataclass
class WorkOrder:
    order_id: str
    ship: Ship
    work_description: str
    work_types: List[str]
    priority: int
    estimated_duration_hours: float
    required_dock_type: DockType
    required_lift_types: List[LiftType]
    required_crafts: List[CraftType]
    earliest_start: Optional[datetime] = None
    latest_deadline: Optional[datetime] = None
    assigned_dock: Optional[str] = None
    assigned_lifts: List[str] = field(default_factory=list)
    assigned_crafts: Dict[str, List[str]] = field(default_factory=dict)
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    status: WorkOrderStatus = WorkOrderStatus.PENDING
    conflicts: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class DockSlot:
    dock_id: str
    dock_name: str
    dock_type: DockType
    max_length: float
    max_width: float
    start_time: datetime
    end_time: datetime
    capacity: int = 1


@dataclass
class LiftResource:
    lift_id: str
    lift_name: str
    lift_type: LiftType
    capacity_ton: float
    working_hours: List[Dict[str, Any]] = field(default_factory=list)
    unavailable_periods: List[Dict[str, datetime]] = field(default_factory=list)


@dataclass
class CraftSchedule:
    craft_type: CraftType
    workers: List[Dict[str, Any]] = field(default_factory=list)
    working_hours: Dict[str, List[time]] = field(default_factory=dict)
    unavailable_periods: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class TideWindow:
    date: date
    high_tide_time: time
    low_tide_time: time
    min_depth_for_entry: float
    min_depth_for_exit: float


@dataclass
class ScheduledAssignment:
    order_id: str
    dock_id: str
    dock_name: str
    lift_ids: List[str]
    craft_assignments: Dict[str, List[str]]
    start_time: datetime
    end_time: datetime


@dataclass
class ProcessingResult:
    total_rows: int = 0
    valid_rows: int = 0
    skipped_rows: List[Dict[str, Any]] = field(default_factory=list)
    need_review_rows: List[Dict[str, Any]] = field(default_factory=list)
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    successful_assignments: List[ScheduledAssignment] = field(default_factory=list)
