from typing import Optional
from pydantic import Field

from .base import BaseSchema, TimestampMixin


class StudentBase(BaseSchema):
    student_id: str = Field(..., max_length=50, description="学生学号")
    name: str = Field(..., max_length=100, description="学生姓名")
    class_name: Optional[str] = Field(None, max_length=100, description="班级")
    contact: Optional[str] = Field(None, max_length=100, description="联系方式")
    notes: Optional[str] = Field(None, max_length=500, description="备注")


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseSchema):
    student_id: Optional[str] = None
    name: Optional[str] = None
    class_name: Optional[str] = None
    contact: Optional[str] = None
    notes: Optional[str] = None


class StudentResponse(StudentBase, TimestampMixin):
    id: int
