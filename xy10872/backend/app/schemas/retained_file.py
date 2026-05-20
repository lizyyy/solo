from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class RetainedFileBase(BaseModel):
    reset_request_id: int
    file_path: str
    reason: Optional[str] = None
    is_submission: bool = False
    retained_path: Optional[str] = None


class RetainedFileCreate(RetainedFileBase):
    pass


class RetainedFile(RetainedFileBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True