from pydantic import BaseModel, Field, validator
from typing import List, Optional, Any
from datetime import datetime, date
import re


class ImportDetailSchema(BaseModel):
    id: int
    row_number: int
    raw_data: dict
    status: str
    error_message: Optional[str]
    fix_suggestion: Optional[str]
    target_id: Optional[int]
    created_at: datetime

    class Config:
        orm_mode = True


class ImportResult(BaseModel):
    import_record_id: int
    status: str
    total_count: int
    success_count: int
    failed_count: int
    error_message: Optional[str]
    details: List[ImportDetailSchema]


class ElderlyImportSchema(BaseModel):
    name: str = Field(..., description="姓名")
    id_card: str = Field(..., description="身份证号")
    phone: Optional[str] = Field(None, description="电话")
    gender: Optional[str] = Field(None, description="性别")
    age: Optional[int] = Field(None, description="年龄")
    address: Optional[str] = Field(None, description="地址")
    community: Optional[str] = Field(None, description="社区")
    building: Optional[str] = Field(None, description="楼栋")
    room: Optional[str] = Field(None, description="房间")
    route_code: Optional[str] = Field(None, description="配送路线")
    dietary_restrictions: Optional[str] = Field(None, description="忌口（逗号分隔）")
    chronic_diseases: Optional[str] = Field(None, description="慢病（逗号分隔）")
    notes: Optional[str] = Field(None, description="备注")

    @validator("id_card")
    def validate_id_card(cls, v):
        if v and not re.match(r"^\d{17}[\dXx]$", v):
            raise ValueError(f"身份证号格式错误: {v}")
        return v

    @validator("phone")
    def validate_phone(cls, v):
        if v and not re.match(r"^1[3-9]\d{9}$", v):
            raise ValueError(f"手机号格式错误: {v}")
        return v

    @validator("age")
    def validate_age(cls, v):
        if v is not None and (v < 0 or v > 150):
            raise ValueError(f"年龄范围错误: {v}")
        return v


class MenuItemImportSchema(BaseModel):
    name: str = Field(..., description="菜品名称")
    category: Optional[str] = Field(None, description="分类")
    price: Optional[float] = Field(0.0, description="价格")
    ingredients: Optional[List[str]] = Field(default_factory=list, description="食材")
    allergens: Optional[List[str]] = Field(default_factory=list, description="过敏原")
    suitable_diseases: Optional[List[str]] = Field(default_factory=list, description="适合慢病")
    unsuitable_diseases: Optional[List[str]] = Field(default_factory=list, description="不适合慢病")
    is_vegetarian: Optional[bool] = Field(False, description="是否素食")
    is_soft: Optional[bool] = Field(False, description="是否软食")


class DailyMenuImportSchema(BaseModel):
    menu_date: date = Field(..., description="日期")
    meal_type: str = Field(..., description="餐别")
    menu_items: List[str] = Field(default_factory=list, description="菜品名称列表")


class DeliveryImportSchema(BaseModel):
    id_card: str = Field(..., description="老人身份证号")
    delivery_date: date = Field(..., description="配送日期")
    meal_type: str = Field(..., description="餐别")
    menu_items: Optional[List[str]] = Field(default_factory=list, description="菜品名称列表")
    route_code: Optional[str] = Field(None, description="配送路线")
    delivery_sequence: Optional[int] = Field(0, description="配送顺序")
    volunteer_name: Optional[str] = Field(None, description="志愿者姓名")
    volunteer_phone: Optional[str] = Field(None, description="志愿者电话")
    notes: Optional[str] = Field(None, description="备注")
