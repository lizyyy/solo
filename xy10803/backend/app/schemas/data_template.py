from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .common import BaseSchema


class DataTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: str
    sql_template: str
    parameters: List[Dict[str, Any]] = Field(default_factory=list)
    dependencies: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True
    version: str = "1.0"


class DataTemplateCreate(DataTemplateBase):
    pass


class DataTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template_type: Optional[str] = None
    sql_template: Optional[str] = None
    parameters: Optional[List[Dict[str, Any]]] = None
    dependencies: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None
    version: Optional[str] = None


class DataTemplateSchema(DataTemplateBase, BaseSchema):
    pass
