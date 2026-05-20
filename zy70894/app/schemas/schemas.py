from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class RepairRecordCreate(BaseModel):
    record_id: str
    work_order_no: str
    product_sn: str
    repair_date: datetime
    defect_code: str
    defect_description: Optional[str] = None
    repair_station: str
    repair_result: str
    material_batch_no: str
    operator: Optional[str] = None
    remarks: Optional[str] = None
    source_file: Optional[str] = None


class WorkOrderCreate(BaseModel):
    order_no: str
    product_model: str
    planned_qty: int
    actual_qty: Optional[int] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    production_line: str
    status: str
    material_batch_no: str
    source_file: Optional[str] = None


class ReviewRecordCreate(BaseModel):
    comparison_result_id: int
    reviewer: str
    review_decision: str
    review_notes: Optional[str] = None
    new_status: Optional[str] = None
    new_discrepancy: Optional[str] = None


class ComparisonResultResponse(BaseModel):
    id: int
    comparison_batch_id: str
    work_order_no: str
    product_sn: str
    match_status: str
    discrepancy_type: Optional[str] = None
    discrepancy_details: Optional[str] = None
    responsible_station: Optional[str] = None
    confidence_score: float
    is_resolved: bool
    resolution_notes: Optional[str] = None

    class Config:
        from_attributes = True


class ComparisonSummaryResponse(BaseModel):
    batch_id: str
    total_records: int
    matched_records: int
    discrepancy_records: int
    pending_review: int
    resolved_records: int
    material_batch_issues: int
    station_issues: int
    repair_loop_issues: int
    multi_defect_issues: int

    class Config:
        from_attributes = True


class MaterialTraceResponse(BaseModel):
    batch_no: str
    material_code: str
    material_name: str
    supplier: str
    quality_status: str
    defect_qty: int
    trace_logs: List[dict]

    class Config:
        from_attributes = True
