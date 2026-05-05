from datetime import datetime, date
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class MaintenanceType(str, Enum):
    PREVENTIVE = "preventive"
    CORRECTIVE = "corrective"
    INSPECTION = "inspection"
    CALIBRATION = "calibration"


class MaintenanceStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MaintenanceRecord(BaseModel):
    id: str
    machine_id: str
    machine_name: str
    maintenance_type: MaintenanceType
    status: MaintenanceStatus = MaintenanceStatus.SCHEDULED
    
    scheduled_date: date
    scheduled_start_time: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    
    technician: Optional[str] = None
    description: str
    notes: Optional[str] = None
    
    downtime_hours: Optional[float] = None
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }
    
    @property
    def is_active(self) -> bool:
        return self.status == MaintenanceStatus.IN_PROGRESS
    
    @property
    def is_scheduled_for_today(self) -> bool:
        today = date.today()
        return self.scheduled_date == today
    
    def is_overlapping(self, check_time: datetime) -> bool:
        if self.status not in [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS]:
            return False
        
        check_date = check_time.date()
        if self.scheduled_date != check_date:
            return False
        
        if self.status == MaintenanceStatus.IN_PROGRESS:
            if self.actual_start_time and not self.actual_end_time:
                return self.actual_start_time <= check_time
        
        if self.scheduled_start_time and self.scheduled_end_time:
            try:
                start_time = datetime.strptime(self.scheduled_start_time, "%H:%M").time()
                end_time = datetime.strptime(self.scheduled_end_time, "%H:%M").time()
                check_time_only = check_time.time()
                return start_time <= check_time_only <= end_time
            except ValueError:
                pass
        
        return True
