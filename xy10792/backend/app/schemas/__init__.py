from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models import ResumeStatus


class JobPositionBase(BaseModel):
    name: str = Field(..., description="岗位名称")
    department: Optional[str] = None
    required_skills: Optional[List[str]] = None
    required_experience: Optional[str] = None
    required_education: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class JobPositionCreate(JobPositionBase):
    pass


class JobPositionUpdate(JobPositionBase):
    pass


class JobPositionResponse(JobPositionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ParseResultBase(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    education: Optional[str] = None
    school: Optional[str] = None
    major: Optional[str] = None
    work_years: Optional[float] = None
    current_company: Optional[str] = None
    current_position: Optional[str] = None
    expected_salary: Optional[str] = None
    current_salary: Optional[str] = None
    city: Optional[str] = None
    skills: Optional[List[str]] = None
    work_experience: Optional[List[Dict[str, Any]]] = None
    education_experience: Optional[List[Dict[str, Any]]] = None
    project_experience: Optional[List[Dict[str, Any]]] = None


class ParseResultCreate(ParseResultBase):
    resume_id: int
    parse_source: str = "自动"
    confidence_score: float = 0.0
    raw_content: Optional[str] = None


class ParseResultUpdate(ParseResultBase):
    pass


class ParseResultResponse(ParseResultBase):
    id: int
    resume_id: int
    version: int
    parse_source: str
    confidence_score: float
    created_at: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class ReviewRecordBase(BaseModel):
    reviewer: str
    review_comment: Optional[str] = None
    changes_made: Optional[Dict[str, Any]] = None
    parse_data: Optional[Dict[str, Any]] = None


class ReviewRecordCreate(ReviewRecordBase):
    pass


class ReviewRecordResponse(ReviewRecordBase):
    id: int
    resume_id: int
    review_time: datetime
    
    class Config:
        from_attributes = True


class ResumeBase(BaseModel):
    filename: str
    file_path: Optional[str] = None
    file_hash: Optional[str] = None


class ResumeCreate(ResumeBase):
    pass


class ResumeUpdate(BaseModel):
    status: Optional[ResumeStatus] = None
    matched_job_id: Optional[int] = None
    match_score: Optional[float] = None


class ResumeListResponse(BaseModel):
    id: int
    filename: str
    status: ResumeStatus
    match_score: float
    matched_job_name: Optional[str] = None
    latest_parse_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ResumeDetailResponse(BaseModel):
    id: int
    filename: str
    file_path: Optional[str] = None
    status: ResumeStatus
    match_score: float
    matched_job: Optional[JobPositionResponse] = None
    latest_parse: Optional[ParseResultResponse] = None
    parse_history: List[ParseResultResponse] = []
    review_records: List[ReviewRecordResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DiffItem(BaseModel):
    field: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    change_type: str


class ParseDiffResponse(BaseModel):
    has_changes: bool
    diffs: List[DiffItem]


class StatisticsResponse(BaseModel):
    total_resumes: int
    status_distribution: Dict[str, int]
    avg_match_score: float
    daily_trend: List[Dict[str, Any]]
    top_skills: List[Dict[str, Any]]


class ExportRequest(BaseModel):
    resume_ids: Optional[List[int]] = None
    status_filter: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    export_format: str = "excel"
