from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class StatisticsQuery(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    region_id: Optional[int] = None
    store_id: Optional[int] = None
    provider_id: Optional[int] = None

class TemperatureEventStats(BaseModel):
    total_events: int = 0
    pending_events: int = 0
    processing_events: int = 0
    resolved_events: int = 0
    high_temp_count: int = 0
    low_temp_count: int = 0
    avg_resolve_hours: Optional[float] = None

class DispatchStats(BaseModel):
    total_dispatches: int = 0
    pending_dispatches: int = 0
    accepted_dispatches: int = 0
    completed_dispatches: int = 0
    avg_response_time_hours: Optional[float] = None
    avg_completion_time_hours: Optional[float] = None
    on_time_rate: Optional[float] = None
    escalated_count: int = 0

class RepairStats(BaseModel):
    total_repairs: int = 0
    avg_work_hours: Optional[float] = None
    avg_rating: Optional[float] = None
    total_parts_cost: float = 0

class ClosedLoopStats(BaseModel):
    temperature_event_stats: TemperatureEventStats
    dispatch_stats: DispatchStats
    repair_stats: RepairStats

class ProviderPerformance(BaseModel):
    provider_id: int
    provider_name: str
    total_dispatches: int = 0
    completed_dispatches: int = 0
    avg_response_time_hours: Optional[float] = None
    avg_completion_time_hours: Optional[float] = None
    on_time_rate: Optional[float] = None
    escalated_count: int = 0
    avg_rating: Optional[float] = None

class StorePerformance(BaseModel):
    store_id: int
    store_name: str
    total_events: int = 0
    resolved_events: int = 0
    avg_resolve_hours: Optional[float] = None
