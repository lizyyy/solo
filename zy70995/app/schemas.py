from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class SubsidySubmission(BaseModel):
    batch_no: str = Field(description="批次号")
    student_name: str = Field(description="学生姓名")
    student_id: str = Field(description="学号")
    class_name: str = Field(description="班级")
    meal_days: int = Field(description="用餐天数")
    subsidy_amount: int = Field(description="补贴金额（分）")


class SubmissionResponse(BaseModel):
    submission_id: int
    task_id: int
    batch_no: str
    state: str
    message: str


class TaskResponse(BaseModel):
    task_id: int
    submission_id: int
    state: str
    classification: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class ReviewRequest(BaseModel):
    actor_id: int = Field(description="操作人ID")
    new_category: Optional[str] = Field(None, description="新分类")
    new_state: Optional[str] = Field(None, description="新状态")
    field_updates: Optional[dict[str, Any]] = Field(None, description="字段更新")
    reason: str = Field(description="修改原因")


class ChangeLogResponse(BaseModel):
    id: int
    task_id: int
    actor_id: int
    change_type: str
    reason: str
    before_value: dict[str, Any]
    after_value: dict[str, Any]
    created_at: datetime


class FieldTraceResponse(BaseModel):
    field_name: str
    original_value: Any
    current_value: Any
    change_history: list[dict[str, Any]]


class ExportReportResponse(BaseModel):
    report_id: int
    submission_id: int
    report_payload: dict[str, Any]
    exported_by: int
    exported_at: datetime
