from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class RecordStatus(str, Enum):
    PROCESSED = "processed"
    PENDING = "pending"
    RETURNED = "returned"


class PriceTier(str, Enum):
    VIP = "VIP"
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class ObstructionType(str, Enum):
    PILLAR = "pillar"
    RAILING = "railing"
    EQUIPMENT = "equipment"
    OTHER = "other"


class Seat(BaseModel):
    seat_id: str
    row: int
    col: int
    x: float
    y: float
    elevation: float
    section: Optional[str] = None
    notes: Optional[str] = None


class Stage(BaseModel):
    stage_id: str
    width: float
    depth: float
    height: float
    center_x: float = 0.0
    center_y: float = 0.0


class Obstruction(BaseModel):
    obstruction_id: str
    obs_type: ObstructionType
    x: float
    y: float
    radius: float
    height: float
    description: Optional[str] = None


class SightlineScoreRecord(BaseModel):
    record_id: str
    seat_id: str
    stage_id: str
    score: Optional[float] = None
    price_tier: Optional[PriceTier] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    status: RecordStatus = RecordStatus.PENDING
    obstruction_ids: list[str] = Field(default_factory=list)
    issue_tags: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    is_supplement: bool = False
    is_withdrawn: bool = False
    supplement_for: Optional[str] = None
    revision: int = 1


class SightlineScoreCreate(BaseModel):
    seat_id: str
    stage_id: str
    score: Optional[float] = None
    price_tier: Optional[PriceTier] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    obstruction_ids: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    is_supplement: bool = False
    supplement_for: Optional[str] = None


class SightlineScoreUpdate(BaseModel):
    score: Optional[float] = None
    price_tier: Optional[PriceTier] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    notes: Optional[str] = None
    obstruction_ids: Optional[list[str]] = None


class StatusTransition(BaseModel):
    action: str
    reason: Optional[str] = None
    notes: Optional[str] = None


class ExceptionItem(BaseModel):
    item_id: str
    record_id: Optional[str] = None
    seat_id: Optional[str] = None
    exception_type: str
    detail: str
    created_at: datetime = Field(default_factory=datetime.now)
    resolved: bool = False
