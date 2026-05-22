from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.core.config import TaskStatus, RetryCategory

class RetryCategoryStats(BaseModel):
    category: str
    count: int
    success_rate: float
    avg_retry_count: float

class TaskSummaryReport(BaseModel):
    total_tasks: int
    pending_tasks: int
    processing_tasks: int
    retrying_tasks: int
    success_tasks: int
    failed_tasks: int
    dead_letter_tasks: int
    manual_review_tasks: int
    compensated_tasks: int
    closed_tasks: int
    overall_success_rate: float
    avg_retry_count: float
    total_compensation_amount: float

class FailedRecordDetail(BaseModel):
    id: int
    task_id: str
    retry_attempt: int
    error_category: str
    error_message: str
    error_details: Optional[Dict[str, Any]] = None
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

class DeadLetterSummary(BaseModel):
    total_dead_letter: int
    by_category: Dict[str, int]
    waiting_for_review: int
    resolved_last_24h: int

class RecoveryStats(BaseModel):
    total_recovered: int
    manual_recovery: int
    auto_recovery: int
    recovery_rate: float
    avg_time_to_recovery_minutes: float

class ManagerDashboard(BaseModel):
    task_summary: TaskSummaryReport
    retry_category_stats: List[RetryCategoryStats]
    dead_letter_summary: DeadLetterSummary
    recovery_stats: RecoveryStats
    top_errors: List[Dict[str, Any]]
    recent_activities: List[Dict[str, Any]]
    data_sources_stability: Dict[str, Dict[str, int]]
