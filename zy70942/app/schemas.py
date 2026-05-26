from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class WaybillBase(BaseModel):
    waybill_no: str
    order_no: Optional[str] = None
    sender: Optional[str] = None
    receiver: Optional[str] = None
    origin_city: Optional[str] = None
    dest_city: Optional[str] = None
    product_name: Optional[str] = None
    weight: Optional[float] = None
    volume: Optional[float] = None
    quantity: Optional[int] = None
    declared_value: Optional[float] = None
    freight: Optional[float] = None
    planned_departure_time: Optional[datetime] = None
    planned_arrival_time: Optional[datetime] = None
    actual_departure_time: Optional[datetime] = None
    actual_arrival_time: Optional[datetime] = None
    transport_type: Optional[str] = None
    carrier: Optional[str] = None
    route_code: Optional[str] = None
    damage_status: Optional[str] = None
    damage_description: Optional[str] = None


class WaybillCreate(WaybillBase):
    pass


class Waybill(WaybillBase):
    id: int
    status: str
    is_reconciled: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    batch_id: Optional[str] = None

    class Config:
        from_attributes = True


class TrackingRecordBase(BaseModel):
    waybill_no: str
    timestamp: datetime
    location: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
    status_code: Optional[str] = None
    description: Optional[str] = None
    operator: Optional[str] = None
    transfer_station: Optional[str] = None
    is_transfer_point: bool = False
    scan_type: Optional[str] = None


class TrackingRecordCreate(TrackingRecordBase):
    pass


class TrackingRecord(TrackingRecordBase):
    id: int
    waybill_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PenaltyRuleBase(BaseModel):
    rule_code: str
    rule_name: str
    rule_type: str
    penalty_type: Optional[str] = None
    calculation_method: Optional[str] = None
    base_value: Optional[float] = None
    percentage: Optional[float] = None
    min_penalty: Optional[float] = None
    max_penalty: Optional[float] = None
    threshold_hours: Optional[float] = None
    conditions: Optional[Dict[str, Any]] = None
    exempt_conditions: Optional[Dict[str, Any]] = None
    priority: int = 0
    is_active: bool = True
    version: str = "v1.0"
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    description: Optional[str] = None


class PenaltyRuleCreate(PenaltyRuleBase):
    pass


class PenaltyRule(PenaltyRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReconciliationResultBase(BaseModel):
    waybill_no: str
    batch_id: Optional[str] = None


class ReconciliationResultDetail(ReconciliationResultBase):
    id: int
    waybill_id: int
    delay_hours: float
    delay_level: Optional[str] = None
    is_delayed: bool
    is_damaged: bool
    damage_type: Optional[str] = None
    damage_severity: Optional[str] = None
    transfer_responsibility: Optional[Dict[str, Any]] = None
    is_transfer_issue: bool
    total_penalty: float
    delay_penalty: float
    damage_penalty: float
    transfer_penalty: float
    exempt_reason: Optional[str] = None
    is_exempt: bool
    is_duplicate_penalty: bool
    duplicate_source: Optional[str] = None
    weather_exempt: bool
    weather_info: Optional[Dict[str, Any]] = None
    penalty_details: Optional[Dict[str, Any]] = None
    discrepancy_explanation: Optional[str] = None
    status: str
    review_status: str
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    auto_calculation_details: Optional[Dict[str, Any]] = None
    manual_adjustment: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewRecordBase(BaseModel):
    reconciliation_id: int
    waybill_no: str
    reviewer: str
    action: str
    adjustment_reason: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    comment: Optional[str] = None


class ReviewRecordCreate(ReviewRecordBase):
    old_status: str
    new_status: str
    old_total_penalty: float
    new_total_penalty: float


class ReviewRecord(ReviewRecordBase):
    id: int
    old_status: str
    new_status: str
    old_total_penalty: float
    new_total_penalty: float
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewActionRequest(BaseModel):
    waybill_no: str
    reviewer: str
    action: str
    status: Optional[str] = None
    total_penalty: Optional[float] = None
    delay_penalty: Optional[float] = None
    damage_penalty: Optional[float] = None
    transfer_penalty: Optional[float] = None
    is_exempt: Optional[bool] = None
    exempt_reason: Optional[str] = None
    is_delayed: Optional[bool] = None
    is_damaged: Optional[bool] = None
    is_transfer_issue: Optional[bool] = None
    comment: str
    evidence: Optional[Dict[str, Any]] = None


class PenaltyHistoryBase(BaseModel):
    waybill_no: str
    penalty_type: str
    rule_id: int
    rule_code: str
    rule_name: str
    calculation_basis: Dict[str, Any]
    original_value: float
    penalty_amount: float
    source_type: str
    source_batch: Optional[str] = None
    traceability_path: Optional[Dict[str, Any]] = None


class PenaltyHistoryDetail(PenaltyHistoryBase):
    id: int
    reconciliation_id: int
    is_adjusted: bool
    adjustment_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReconciliationBatchBase(BaseModel):
    batch_id: str
    batch_name: str
    period: Optional[str] = None
    generated_by: Optional[str] = None


class ReconciliationBatchDetail(ReconciliationBatchBase):
    id: int
    total_waybills: int
    reconciled_count: int
    pending_count: int
    exempt_count: int
    total_penalty: float
    status: str
    generated_at: datetime
    completed_at: Optional[datetime] = None
    summary: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    total_count: int
    success_count: int
    failed_count: int
    errors: List[str]
    batch_id: Optional[str] = None


class BatchReconciliationRequest(BaseModel):
    batch_id: str
    batch_name: Optional[str] = None
    period: Optional[str] = None
    generated_by: Optional[str] = None


class ReconciliationSummary(BaseModel):
    batch_id: str
    total_waybills: int
    processed_count: int
    pending_count: int
    exempt_count: int
    delayed_count: int
    damaged_count: int
    transfer_issue_count: int
    total_penalty: float
    delay_penalty_total: float
    damage_penalty_total: float
    transfer_penalty_total: float
    average_penalty: float
    penalty_distribution: Dict[str, int]


class PenaltyTraceResponse(BaseModel):
    waybill_no: str
    penalty_type: str
    rule_code: str
    rule_name: str
    calculation_basis: Dict[str, Any]
    penalty_amount: float
    traceability_path: List[Dict[str, Any]]
    historical_records: List[Dict[str, Any]]


class WeatherExemptionBase(BaseModel):
    city: str
    start_time: datetime
    end_time: datetime
    weather_type: str
    severity: str
    description: Optional[str] = None
    affected_routes: Optional[List[str]] = None


class WeatherExemptionCreate(WeatherExemptionBase):
    pass


class WeatherExemption(WeatherExemptionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
