from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
from ..models.enums import MaterialType


class MaterialBase(BaseModel):
    material_type: MaterialType
    file_name: str
    metadata: Optional[Dict[str, Any]] = None


class MaterialUpload(MaterialBase):
    uploaded_by: str = Field(..., max_length=100)


class MaterialResponse(MaterialBase):
    id: int
    batch_id: int
    file_path: str
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime
    parsed: bool
    parsed_at: Optional[datetime] = None
    parse_error: Optional[str] = None

    class Config:
        from_attributes = True


class MaterialListResponse(BaseModel):
    total: int
    items: List[MaterialResponse]
