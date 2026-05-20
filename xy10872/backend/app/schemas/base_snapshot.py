from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class BaseSnapshotBase(BaseModel):
    lab_space_id: int
    name: str
    description: Optional[str] = None
    path: str
    is_base: Optional[bool] = False
    created_by: Optional[str] = None


class BaseSnapshotCreate(BaseSnapshotBase):
    pass


class BaseSnapshot(BaseSnapshotBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True