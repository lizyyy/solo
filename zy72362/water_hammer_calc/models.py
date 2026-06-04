from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


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
