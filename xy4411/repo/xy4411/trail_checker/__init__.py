from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Checkpoint(BaseModel):
    cp_id: str
    name: str
    distance_km: float
    cutoff_time: datetime
    is_start: bool = False
    is_end: bool = False


class AidStation(BaseModel):
    station_id: str
    name: str
    checkpoint_id: str
    expected_items: Dict[str, float]


class RaceConfig(BaseModel):
    race_name: str
    race_date: str
    distance_km: float
    checkpoints: List[Checkpoint]
    aid_stations: List[AidStation]


class Registration(BaseModel):
    bib: str
    name: str
    gender: str
    age: int
    emergency_contact: str
    category: str
    chip_id: str
    status: str = "registered"


class TimingRecord(BaseModel):
    record_id: str
    chip_id: str
    bib: str
    checkpoint_id: str
    timestamp: datetime
    record_type: str = "timing"


class AidStationConsumption(BaseModel):
    consumption_id: str
    station_id: str
    recorded_at: datetime
    consumed_items: Dict[str, float]
    notes: str = ""


class MedicalEvent(BaseModel):
    event_id: str
    timestamp: datetime
    bib: str
    checkpoint_id: str
    location: str
    symptoms: List[str]
    severity: str
    treatment: List[str]
    treated_by: str
    status: str
    needs_follow_up: bool
    notes: str = ""


class RunnerStatus(BaseModel):
    bib: str
    name: str
    category: str
    chip_id: str
    registered: bool = True
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    checkpoints_visited: List[str] = []
    checkpoints_missing: List[str] = []
    cutoff_violations: List[str] = []
    race_status: str = "unknown"
    total_time_seconds: Optional[float] = None
    medical_events: List[str] = []
    review_status: str = "pending"
    review_notes: str = ""


class AidStationCheck(BaseModel):
    station_id: str
    station_name: str
    expected_items: Dict[str, float]
    total_consumed: Dict[str, float]
    anomalies: List[str] = []
    review_status: str = "pending"


class MedicalEventCheck(BaseModel):
    event_id: str
    bib: str
    runner_name: str
    severity: str
    status: str
    needs_follow_up: bool
    review_status: str = "pending"
    follow_up_contacted: bool = False
    follow_up_notes: str = ""


class AuditPackage(BaseModel):
    generated_at: datetime
    race_name: str
    race_date: str
    total_registrations: int
    total_timing_records: int
    total_aid_station_records: int
    total_medical_events: int
    runner_checks: List[RunnerStatus]
    aid_station_checks: List[AidStationCheck]
    medical_event_checks: List[MedicalEventCheck]
    summary: Dict[str, Any]
