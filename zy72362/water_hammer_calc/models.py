from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CalcStatus(str, Enum):
    DRAFT = "待复核"
    NEEDS_REVIEW = "需设备工程师复核"
    REVIEWED_BY_TRAINER = "训练教练老唐已确认"
    APPROVED = "设备工程师已通过"
    REJECTED = "设备工程师已驳回"
    FINALIZED = "已归档"


class ChangeType(str, Enum):
    NAMEPLATE_IMPORT = "导入铭牌参数"
    SCREENSHOT_LINK = "补录维修群截图"
    OVERRIDE_REASON = "补充改系数原因"
    STATUS_CHANGE = "状态变更"
    PARAMETER_EDIT = "人工修改参数"
    ENGINEER_REVIEW = "设备工程师复核"
    TRAINER_REVIEW = "训练教练确认"


class EvidenceSource(str, Enum):
    NAMEPLATE = "设备铭牌参数"
    MAINTENANCE_SCREENSHOT = "维修群截图"
    MANUAL_OVERRIDE = "人工改系数"


class Provenance(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    source: EvidenceSource
    detail: str
    timestamp: datetime


class ParameterEntry(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    name: str
    value: float
    unit: str
    provenance: Provenance
    is_manually_modified: bool = False
    modification_reason: Optional[str] = None
    missing_materials: list[str] = []
    next_action: Optional[str] = None


class OverrideFlag(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    parameter_name: str
    original_value: float
    overridden_value: float
    reason: Optional[str] = None
    needs_review: bool = True
    reviewer: Optional[str] = None


class NameplateData(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    equipment_id: str
    equipment_name: str
    parameters: list[ParameterEntry]


class MaintenanceScreenshot(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    screenshot_id: str
    description: str
    related_parameter_names: list[str]
    image_path: Optional[str] = None


class ChangeRecord(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    change_id: str
    change_type: ChangeType
    timestamp: datetime
    operator: str
    parameter_name: Optional[str] = None
    old_value: Optional[float] = None
    new_value: Optional[float] = None
    reason: Optional[str] = None
    status_before: Optional[str] = None
    status_after: Optional[str] = None
    related_screenshot_id: Optional[str] = None
    related_nameplate_id: Optional[str] = None
    reviewer: Optional[str] = None
    comments: Optional[str] = None


class WaterHammerInput(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    pipe_length: float
    pipe_diameter: float
    wall_thickness: float
    fluid_density: float
    bulk_modulus: float
    wave_speed: Optional[float] = None
    valve_closing_time: float
    initial_velocity: float
    coefficients: dict[str, float]
    parameter_entries: list[ParameterEntry] = []


class WaterHammerResult(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    max_pressure: float
    pressure_rise: float
    joukowsky_pressure: float
    wave_speed_used: float
    classification: str
    parameter_entries: list[ParameterEntry]
    override_flags: list[OverrideFlag]
    replay_narrative: str
    status: CalcStatus = CalcStatus.DRAFT
    change_history: list[ChangeRecord] = []
    calc_id: Optional[str] = None
    reviewed_by_engineer: bool = False
    reviewed_by_trainer: bool = False
    engineer_name: Optional[str] = None
    trainer_name: Optional[str] = None


class ReportExport(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    calc_id: str
    export_timestamp: datetime
    status: str
    summary: dict
    parameter_entries: list[ParameterEntry]
    override_flags: list[OverrideFlag]
    replay_narrative: str
    change_history: list[ChangeRecord]
    next_action_summary: list[str]
