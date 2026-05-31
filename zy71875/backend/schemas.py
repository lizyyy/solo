from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class MealRecordBase(BaseModel):
    record_date: date
    meal_type: str = Field(..., max_length=20, description="餐次：早餐/午餐/晚餐")
    dish_name: str = Field(..., max_length=100, description="菜品名称")
    predicted_count: Optional[int] = Field(0, ge=0, description="预测份数")
    actual_count: Optional[int] = Field(0, ge=0, description="实际份数")
    unit: Optional[str] = Field("份", max_length=20, description="单位")
    price: Optional[float] = Field(0.0, ge=0, description="单价")
    category: Optional[str] = Field(None, max_length=50, description="菜品分类")
    notes: Optional[str] = Field(None, description="备注")

    @field_validator('meal_type')
    def validate_meal_type(cls, v):
        valid_types = ['早餐', '午餐', '晚餐']
        if v not in valid_types:
            raise ValueError(f"餐次必须是以下之一：{', '.join(valid_types)}")
        return v


class MealRecordCreate(MealRecordBase):
    pass


class MealRecordUpdate(BaseModel):
    predicted_count: Optional[int] = Field(None, ge=0)
    actual_count: Optional[int] = Field(None, ge=0)
    price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class MealRecordResponse(MealRecordBase):
    id: int
    batch_id: Optional[str]
    is_reviewed: bool
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    is_corrected: bool
    corrected_by: Optional[str]
    corrected_at: Optional[datetime]
    correction_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchPredictionRequest(BaseModel):
    start_date: date
    end_date: date
    batch_name: Optional[str] = None
    model_version: Optional[str] = "v1.0"
    overwrite_existing: Optional[bool] = Field(False, description="是否覆盖已存在的预测")

    @field_validator('end_date')
    def end_date_must_be_after_start_date(cls, v, values):
        if 'start_date' in values.data and v < values.data['start_date']:
            raise ValueError("结束日期不能早于开始日期")
        return v


class BatchResponse(BaseModel):
    batch_id: str
    status: str
    total_records: int
    message: str


class ReviewRequest(BaseModel):
    record_ids: List[int]
    reviewed_by: str = Field(..., max_length=50)


class CorrectionRequest(BaseModel):
    record_id: int
    field_name: str
    new_value: Any
    reason: str = Field(..., max_length=200, description="修正原因")
    corrected_by: str = Field(..., max_length=50)

    @field_validator('field_name')
    def validate_field_name(cls, v):
        allowed_fields = ['predicted_count', 'actual_count', 'price', 'notes', 'dish_name', 'category']
        if v not in allowed_fields:
            raise ValueError(f"不允许修改此字段，允许修改的字段：{', '.join(allowed_fields)}")
        return v


class ExportRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    meal_types: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    include_model_info: Optional[bool] = True
    format: str = Field("excel", description="导出格式：excel/csv")

    @field_validator('format')
    def validate_format(cls, v):
        valid_formats = ['excel', 'csv']
        if v not in valid_formats:
            raise ValueError(f"导出格式必须是以下之一：{', '.join(valid_formats)}")
        return v


class HistoryQuery(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    meal_type: Optional[str] = None
    is_reviewed: Optional[bool] = None
    is_corrected: Optional[bool] = None
    keyword: Optional[str] = None


class PaginatedResponse(BaseModel):
    items: List[MealRecordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    user_friendly_message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
