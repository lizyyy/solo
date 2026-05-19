from datetime import datetime
from typing import Optional
from app.schemas.common import BaseSchema


class TideRecordBase(BaseSchema):
    record_date: datetime
    tide_type: str
    height: float
    timezone: str = "Asia/Shanghai"


class TideRecordCreate(TideRecordBase):
    source_file: Optional[str] = None
    batch_id: Optional[str] = None


class TideRecordResponse(TideRecordBase):
    id: int
    source_file: Optional[str] = None
    batch_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
