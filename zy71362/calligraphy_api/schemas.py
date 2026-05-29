from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


VALID_STATUSES = ["uploaded", "image_corrected", "layout_measured", "scored", "completed"]
VALID_FONT_TYPES = ["楷书", "行书", "草书", "隶书", "篆书", "宋体", "黑体"]
VALID_COMMENT_TYPES = ["general", "correction", "praise"]
VALID_ISSUE_TYPES = ["image_tilt", "signature_missed", "line_spacing_misjudgment"]
VALID_SEVERITIES = ["low", "medium", "high"]


class HomeworkCreate(BaseModel):
    student_name: str = Field(..., max_length=100)
    font_type: str = Field(..., max_length=50)
    class_name: Optional[str] = None


class HomeworkResponse(BaseModel):
    id: int
    student_name: str
    font_type: str
    class_name: Optional[str]
    image_path: str
    original_image_path: Optional[str]
    status: str
    tilt_angle: Optional[float]
    tilt_corrected: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScoreReportCreate(BaseModel):
    char_spacing_score: Optional[float] = Field(None, ge=0, le=100)
    line_spacing_score: Optional[float] = Field(None, ge=0, le=100)
    signature_position_score: Optional[float] = Field(None, ge=0, le=100)


class ScoreReportCorrect(BaseModel):
    char_spacing_score: Optional[float] = Field(None, ge=0, le=100)
    line_spacing_score: Optional[float] = Field(None, ge=0, le=100)
    signature_position_score: Optional[float] = Field(None, ge=0, le=100)
    override_reason: Optional[str] = None


class ScoreReportResponse(BaseModel):
    id: int
    homework_id: int
    char_spacing_score: float
    line_spacing_score: float
    signature_position_score: float
    total_score: float
    is_manual_override: bool
    override_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    teacher_comment: str
    comment_type: str = "general"


class CommentResponse(BaseModel):
    id: int
    homework_id: int
    teacher_comment: str
    comment_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class LayoutMeasurementResponse(BaseModel):
    id: int
    homework_id: int
    char_distances: list
    line_distances: list
    avg_char_spacing: float
    avg_line_spacing: float
    char_spacing_variance: float
    line_spacing_variance: float
    signature_detected: bool
    signature_region: Optional[dict]
    row_count: int
    char_count: int
    is_manual_adjusted: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LayoutMeasurementAdjust(BaseModel):
    avg_char_spacing: Optional[float] = None
    avg_line_spacing: Optional[float] = None
    char_spacing_variance: Optional[float] = None
    line_spacing_variance: Optional[float] = None
    signature_detected: Optional[bool] = None
    signature_region: Optional[dict] = None


class AdvanceStatusRequest(BaseModel):
    target_status: Optional[str] = None


class IssueRecordResponse(BaseModel):
    id: int
    homework_id: int
    issue_type: str
    severity: str
    description: str
    suggested_action: Optional[str]
    resolution: Optional[str]
    resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class IssueResolve(BaseModel):
    resolution: str


class ImageCorrectRequest(BaseModel):
    force: bool = False


class ClassComparisonResponse(BaseModel):
    class_name: str
    student_count: int
    avg_char_spacing_score: float
    avg_line_spacing_score: float
    avg_signature_position_score: float
    avg_total_score: float
    top_students: list
    bottom_students: list


class ExportFormat(BaseModel):
    format: str = "json"
