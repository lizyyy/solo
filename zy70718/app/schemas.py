from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
import json

from app.models import JourneyStatus


class StepDefinition(BaseModel):
    step_id: str
    name: str
    action: str
    expected: Optional[str] = None


class JourneyAssetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    steps_definition: str
    dependent_services: Optional[str] = None
    run_frequency: str = Field(..., min_length=1)

    @validator("steps_definition")
    def validate_steps(cls, v):
        try:
            steps = json.loads(v)
            if not isinstance(steps, list):
                raise ValueError("步骤定义必须是数组格式")
            for step in steps:
                if "step_id" not in step or "name" not in step:
                    raise ValueError("每个步骤必须包含 step_id 和 name")
            return v
        except json.JSONDecodeError:
            raise ValueError("步骤定义必须是有效的JSON格式")


class JourneyAssetCreate(JourneyAssetBase):
    pass


class JourneyAssetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    steps_definition: Optional[str] = None
    dependent_services: Optional[str] = None
    run_frequency: Optional[str] = None
    status: Optional[JourneyStatus] = None


class JourneyAssetResponse(JourneyAssetBase):
    id: int
    status: JourneyStatus
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    registered_at: Optional[datetime]

    class Config:
        from_attributes = True


class FailureSampleBase(BaseModel):
    sample_data: str
    error_message: Optional[str] = None


class FailureSampleCreate(FailureSampleBase):
    journey_id: int


class FailureSampleResponse(FailureSampleBase):
    id: int
    journey_id: int
    occurred_at: datetime
    archived: int
    archived_at: Optional[datetime]

    class Config:
        from_attributes = True


class RegistrationReportBase(BaseModel):
    report_content: str
    reporter: Optional[str] = None


class RegistrationReportCreate(RegistrationReportBase):
    journey_id: int


class RegistrationReportResponse(RegistrationReportBase):
    id: int
    journey_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class JourneyDetailResponse(JourneyAssetResponse):
    failure_samples: List[FailureSampleResponse]
    registration_reports: List[RegistrationReportResponse]

    class Config:
        from_attributes = True