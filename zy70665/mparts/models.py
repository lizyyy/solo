from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class SourceLocation(BaseModel):
    file_path: str
    line_number: int
    original_line: str


class CarModel(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_id: str
    brand: str
    series: str
    year: int
    engine: str
    source_location: Optional[SourceLocation] = None


class MaintenanceItem(BaseModel):
    maintenance_id: str
    name: str
    required_parts: Dict[str, int]
    applicable_models: List[str]
    source_location: Optional[SourceLocation] = None


class PartInventory(BaseModel):
    part_number: str
    part_name: str
    quantity: int
    location: str
    source_location: Optional[SourceLocation] = None


class AlternativePart(BaseModel):
    original_part: str
    alternative_part: str
    priority: int
    applicable_models: Optional[List[str]] = None
    source_location: Optional[SourceLocation] = None


class BadLine(BaseModel):
    file_path: str
    line_number: int
    original_line: str
    error_message: str


class GapLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class PartRequirement(BaseModel):
    part_number: str
    part_name: str
    required_qty: int
    available_qty: int
    gap_qty: int
    gap_level: GapLevel
    alternative_parts: List[str] = Field(default_factory=list)
    source_trace: List[str] = Field(default_factory=list)


class MaintenancePlanResult(BaseModel):
    car_model: str
    maintenance_name: str
    maintenance_id: str
    parts_summary: List[PartRequirement]
    total_gap_count: int
    critical_gap_count: int


class ProcessResult(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    car_models: List[CarModel] = Field(default_factory=list)
    maintenance_items: List[MaintenanceItem] = Field(default_factory=list)
    inventory: List[PartInventory] = Field(default_factory=list)
    alternatives: List[AlternativePart] = Field(default_factory=list)
    bad_lines: List[BadLine] = Field(default_factory=list)
    plan_results: List[MaintenancePlanResult] = Field(default_factory=list)
