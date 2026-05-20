from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class LabSpaceBase(BaseModel):
    name: str
    student_id: str
    student_name: str
    course_id: str
    path: str
    is_active: Optional[bool] = True


class LabSpaceCreate(LabSpaceBase):
    pass


class LabSpace(LabSpaceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True