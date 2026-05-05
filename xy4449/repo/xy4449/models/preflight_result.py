from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PreflightStatus(str, Enum):
    PASSED = "passed"
    WARNING = "warning"
    FAILED = "failed"
    SKIPPED = "skipped"


class PreflightCheck(BaseModel):
    check_name: str
    check_type: str
    status: PreflightStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    severity: str = "normal"
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PreflightResult(BaseModel):
    id: str
    work_order_id: str
    
    status: PreflightStatus = PreflightStatus.SKIPPED
    
    checks: List[PreflightCheck] = Field(default_factory=list)
    
    font_check: PreflightStatus = PreflightStatus.SKIPPED
    paper_check: PreflightStatus = PreflightStatus.SKIPPED
    size_check: PreflightStatus = PreflightStatus.SKIPPED
    machine_check: PreflightStatus = PreflightStatus.SKIPPED
    
    missing_fonts: List[str] = Field(default_factory=list)
    required_paper: Optional[str] = None
    paper_available: bool = False
    paper_quantity_required: Optional[int] = None
    paper_quantity_available: Optional[int] = None
    
    size_mismatch_details: Optional[Dict[str, Any]] = None
    
    machine_conflicts: List[str] = Field(default_factory=list)
    conflicting_maintenance: List[str] = Field(default_factory=list)
    
    overall_score: float = 100.0
    risk_level: str = "low"
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    
    notes: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def calculate_overall_status(self) -> PreflightStatus:
        if any(check.status == PreflightStatus.FAILED for check in self.checks):
            self.status = PreflightStatus.FAILED
        elif any(check.status == PreflightStatus.WARNING for check in self.checks):
            self.status = PreflightStatus.WARNING
        elif all(check.status == PreflightStatus.PASSED for check in self.checks):
            self.status = PreflightStatus.PASSED
        else:
            self.status = PreflightStatus.SKIPPED
        
        return self.status
    
    def calculate_score(self) -> float:
        if not self.checks:
            self.overall_score = 100.0
            return self.overall_score
        
        total_score = 100.0
        for check in self.checks:
            if check.status == PreflightStatus.FAILED:
                if check.severity == "critical":
                    total_score -= 40
                elif check.severity == "high":
                    total_score -= 25
                else:
                    total_score -= 15
            elif check.status == PreflightStatus.WARNING:
                if check.severity == "high":
                    total_score -= 10
                else:
                    total_score -= 5
        
        self.overall_score = max(0.0, min(100.0, total_score))
        
        if self.overall_score >= 80:
            self.risk_level = "low"
        elif self.overall_score >= 50:
            self.risk_level = "medium"
        else:
            self.risk_level = "high"
        
        return self.overall_score
    
    def add_check(self, check: PreflightCheck):
        self.checks.append(check)
    
    def mark_complete(self):
        self.completed_at = datetime.now()
        if self.started_at:
            self.duration_seconds = (self.completed_at - self.started_at).total_seconds()
        
        self.calculate_overall_status()
        self.calculate_score()
