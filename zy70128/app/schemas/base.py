from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BaseResponse(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
