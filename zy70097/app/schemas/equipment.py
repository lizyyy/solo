from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class EquipmentBase(BaseModel):
    name: str = Field(..., description="设备名称")
    code: str = Field(..., description="设备编号")
    type: str = Field(..., description="设备类型")
    group_id: Optional[int] = Field(None, description="所属分组ID")
    install_date: Optional[datetime] = Field(None, description="安装日期")
    replace_date: Optional[datetime] = Field(None, description="更换日期")
    status: Optional[str] = Field("active", description="状态")
    description: Optional[str] = Field(None, description="描述")


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    group_id: Optional[int] = None
    install_date: Optional[datetime] = None
    replace_date: Optional[datetime] = None
    status: Optional[str] = None
    description: Optional[str] = None


class EquipmentResponse(EquipmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EquipmentGroupBase(BaseModel):
    name: str = Field(..., description="分组名称")
    code: str = Field(..., description="分组编号")
    description: Optional[str] = Field(None, description="描述")
    parent_id: Optional[int] = Field(None, description="父分组ID")


class EquipmentGroupCreate(EquipmentGroupBase):
    pass


class EquipmentGroupUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None


class EquipmentGroupResponse(EquipmentGroupBase):
    id: int
    created_at: datetime
    updated_at: datetime
    equipments: List[EquipmentResponse] = []

    class Config:
        from_attributes = True
