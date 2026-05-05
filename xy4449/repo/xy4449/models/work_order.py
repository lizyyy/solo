from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class WorkOrderStatus(str, Enum):
    PENDING = "pending"
    PREFLIGHT_RUNNING = "preflight_running"
    PREFLIGHT_PASSED = "preflight_passed"
    PREFLIGHT_FAILED = "preflight_failed"
    REVIEW_PENDING = "review_pending"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    PRODUCTION = "production"
    COMPLETED = "completed"


class WorkOrder(BaseModel):
    id: str = Field(default_factory=lambda: f"WO{datetime.now().strftime('%Y%m%d%H%M%S')}")
    file_name: str
    file_path: str
    uploaded_at: datetime = Field(default_factory=datetime.now)
    status: WorkOrderStatus = WorkOrderStatus.PENDING
    
    customer_name: Optional[str] = None
    job_name: Optional[str] = None
    quantity: Optional[int] = None
    
    page_count: int = 0
    paper_type: Optional[str] = None
    paper_size: Optional[str] = None
    paper_width: Optional[float] = None
    paper_height: Optional[float] = None
    
    required_fonts: List[str] = Field(default_factory=list)
    missing_fonts: List[str] = Field(default_factory=list)
    
    cutting_template_id: Optional[str] = None
    
    notes: List[str] = Field(default_factory=list)
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def update_timestamp(self):
        self.updated_at = datetime.now()
    
    def add_note(self, note: str, author: str = "system"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.notes.append(f"[{timestamp}] [{author}] {note}")
        self.update_timestamp()
