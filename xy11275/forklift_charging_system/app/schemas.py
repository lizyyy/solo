from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class ForkliftBase(BaseModel):
    name: str
    battery_level: float = 100.0
    status: str = "idle"


class ForkliftCreate(ForkliftBase):
    pass


class Forklift(ForkliftBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChargingPileBase(BaseModel):
    name: str
    status: str = "available"


class ChargingPileCreate(ChargingPileBase):
    pass


class ChargingPile(ChargingPileBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChargingTaskBase(BaseModel):
    forklift_id: int
    charging_pile_id: int
    shift: str
    requested_by: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ChargingTaskCreate(ChargingTaskBase):
    pass


class ChargingTask(ChargingTaskBase):
    id: int
    status: str
    reason: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    forklift: Optional[Forklift]
    charging_pile: Optional[ChargingPile]

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: str
    operator: str
    target_id: Optional[int] = None
    target_type: Optional[str] = None
    status: str
    reason: Optional[str] = None
    details: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchResult(BaseModel):
    success_count: int
    failed_count: int
    total_count: int
    successful: List[int]
    failed: List[dict]


class RuleResult(BaseModel):
    passed: bool
    reason: str
    rule_name: str
