from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, Dict, Any, List


class SecuritySupervisorReport(BaseModel):
    batch_id: int
    batch_number: str
    batch_name: str
    status_before_freeze: str
    status_after_freeze: str
    freeze_time: Optional[datetime] = None
    frozen_by: Optional[str] = None
    freeze_reason: Optional[str] = None
    total_visitors: int
    overstay_count: int
    manual_adjustment_count: int
    review_comments: List[Dict[str, Any]]
    state_change_history: List[Dict[str, Any]]
    generated_at: datetime
    generated_by: str


class DailySummary(BaseModel):
    report_date: date
    total_batches: int
    frozen_batches: int
    settled_batches: int
    total_visitors: int
    overstay_visitors: int
    pending_review_count: int
    manual_intervention_count: int


class ExportRequest(BaseModel):
    batch_ids: Optional[List[int]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    include_state_history: bool = True
    include_audit_logs: bool = False
    format: str = "xlsx"
    exported_by: str
