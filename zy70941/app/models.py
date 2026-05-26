from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ResultStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    FAILED = "failed"


class TransitNode(BaseModel):
    node_code: str
    node_name: str
    arrival_time: Optional[datetime]
    departure_time: Optional[datetime]
    status: str


class Waybill(BaseModel):
    waybill_no: str
    sender: str
    receiver: str
    origin: str
    destination: str
    estimated_delivery: datetime
    actual_delivery: Optional[datetime]
    transit_nodes: List[TransitNode]
    weight: float
    cargo_type: str
    damage_count: int = 0
    damage_description: Optional[str] = None
    is_weather_issue: Optional[str] = None


class TrackEvent(BaseModel):
    waybill_no: str
    event_time: datetime
    event_type: str
    location: str
    operator: Optional[str] = None
    remark: Optional[str] = None


class PenaltyRule(BaseModel):
    rule_id: str
    rule_name: str
    rule_type: str
    penalty_amount: float
    conditions: Dict[str, Any]
    description: str


class BatchRequest(BaseModel):
    batch_id: str
    waybills: List[Waybill]
    tracks: List[TrackEvent]
    rules: List[PenaltyRule]


class FailedRecord(BaseModel):
    waybill_no: str
    original_data: Dict[str, Any]
    failure_reason: str
    suggested_action: str
    rule_applied: Optional[str] = None
    penalty_amount: Optional[float] = None


class ProcessResult(BaseModel):
    batch_id: str
    status: str
    normal_count: int
    pending_count: int
    failed_count: int
    normal_items: List[Dict[str, Any]]
    pending_items: List[Dict[str, Any]]
    failed_items: List[FailedRecord]
    processing_time: datetime
    message: str


class BatchStatusResponse(BaseModel):
    batch_id: str
    exists: bool
    status: str
    created_at: Optional[datetime]
    message: str


class LocalProcessRequest(BaseModel):
    batch_id: Optional[str] = None
    waybill_path: str = "./samples/waybills.csv"
    track_path: str = "./samples/tracks.json"
    rules_path: str = "./samples/rules.json"
