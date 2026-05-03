from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time
from enum import Enum


class ConflictType(str, Enum):
    ACTOR_SCHEDULE = "actor_schedule"
    TRANSFER_TIME = "transfer_time"
    WEATHER_ISSUE = "weather_issue"
    NIGHT_SHIFT_HOURS = "night_shift_hours"
    CROSS_GROUP_OVERLAP = "cross_group_overlap"


class ConflictSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ValidationSuggestion(BaseModel):
    conflict_type: ConflictType
    severity: ConflictSeverity
    message: str
    suggestion: Optional[str] = None
    affected_elements: List[str] = []


class ValidationResult(BaseModel):
    date: date
    total_conflicts: int
    critical_count: int
    warning_count: int
    info_count: int
    conflicts: List[ValidationSuggestion] = []
    is_valid: bool = True


class SceneBase(BaseModel):
    scene_number: str
    description: Optional[str] = None
    is_night: bool = False
    is_interior: bool = False
    cast: Optional[str] = None
    estimated_duration_minutes: int = 60


class CrewBase(BaseModel):
    name: str
    role: str
    is_actor: bool = False
    group_name: Optional[str] = None
    availability_start: Optional[date] = None
    availability_end: Optional[date] = None


class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    is_exterior: bool = False
    is_sound_stage: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class WeatherBase(BaseModel):
    location_name: str
    date: date
    condition: str
    temperature: Optional[float] = None
    precipitation_probability: float = 0.0
    is_rainy: bool = False


class ImportResult(BaseModel):
    scenes_imported: int
    crew_imported: int
    locations_imported: int
    weather_imported: int
    message: str


class CallSheetScene(BaseModel):
    scene_number: str
    description: str
    location: str
    time: str
    duration: str
    cast: str
    is_night: bool


class CallSheetExport(BaseModel):
    date: date
    scenes: List[CallSheetScene]
    weather_notes: str
    special_instructions: List[str]
    markdown_content: str
