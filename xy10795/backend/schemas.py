from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from models import RiskStatus, ReportStatus, DelayReasonStatus


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MilestoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    planned_date: datetime
    actual_date: Optional[datetime] = None
    status: str = "planned"
    original_input: Optional[str] = None
    processed_result: Optional[str] = None


class MilestoneCreate(MilestoneBase):
    project_id: int


class Milestone(MilestoneBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RiskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: RiskStatus = RiskStatus.IDENTIFIED
    owner: Optional[str] = None
    owner_feedback: Optional[str] = None
    impact_level: Optional[str] = None
    probability: Optional[str] = None


class RiskCreate(RiskBase):
    project_id: int


class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[RiskStatus] = None
    owner: Optional[str] = None
    owner_feedback: Optional[str] = None
    impact_level: Optional[str] = None
    probability: Optional[str] = None
    update_token: Optional[str] = None


class Risk(RiskBase):
    id: int
    project_id: int
    last_updated_by: Optional[str]
    last_updated_at: Optional[datetime]
    created_at: datetime
    update_token: Optional[str]

    class Config:
        from_attributes = True


class WeeklyReportBase(BaseModel):
    week_start: datetime
    week_end: datetime
    summary: Optional[str] = None
    status: ReportStatus = ReportStatus.DRAFT


class WeeklyReportCreate(WeeklyReportBase):
    project_id: int


class WeeklyReportUpdate(BaseModel):
    week_start: Optional[datetime] = None
    week_end: Optional[datetime] = None
    summary: Optional[str] = None
    status: Optional[ReportStatus] = None
    review_comment: Optional[str] = None
    reviewed_by: Optional[str] = None
    operation_id: Optional[str] = None


class WeeklyReport(WeeklyReportBase):
    id: int
    project_id: int
    version: str
    created_by: Optional[str]
    reviewed_by: Optional[str]
    review_comment: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    operation_id: Optional[str]

    class Config:
        from_attributes = True


class ReportRiskBase(BaseModel):
    risk_id: int
    status_at_report: Optional[str] = None
    owner_feedback_at_report: Optional[str] = None
    notes: Optional[str] = None


class ReportRiskCreate(ReportRiskBase):
    weekly_report_id: int


class ReportRisk(ReportRiskBase):
    id: int
    weekly_report_id: int

    class Config:
        from_attributes = True


class DelayReasonBase(BaseModel):
    reason: str
    correction_path: Optional[str] = None


class DelayReasonCreate(DelayReasonBase):
    milestone_id: int
    weekly_report_id: Optional[int] = None


class DelayReasonUpdate(BaseModel):
    reason: Optional[str] = None
    correction_path: Optional[str] = None
    status: Optional[DelayReasonStatus] = None
    review_comment: Optional[str] = None
    reviewed_by: Optional[str] = None


class DelayReason(DelayReasonBase):
    id: int
    milestone_id: int
    weekly_report_id: Optional[int]
    status: DelayReasonStatus
    review_comment: Optional[str]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_by: Optional[str]
    created_at: datetime
    version: int

    class Config:
        from_attributes = True


class SendRecordBase(BaseModel):
    sent_to: str
    subject: Optional[str] = None
    content: Optional[str] = None


class SendRecordCreate(SendRecordBase):
    weekly_report_id: int
    operation_id: Optional[str] = None


class SendRecord(SendRecordBase):
    id: int
    weekly_report_id: int
    sent_by: Optional[str]
    sent_at: datetime
    operation_id: Optional[str]

    class Config:
        from_attributes = True


class WeeklyReportDetail(WeeklyReport):
    project: Project
    report_risks: List[ReportRisk] = []
    send_records: List[SendRecord] = []


class RiskWithProject(Risk):
    project: Project


class MilestoneWithDelayReasons(Milestone):
    delay_reasons: List[DelayReason] = []


class ProjectDetail(Project):
    milestones: List[Milestone] = []
    risks: List[Risk] = []
    weekly_reports: List[WeeklyReport] = []
