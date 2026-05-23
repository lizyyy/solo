from datetime import datetime
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field, validator, ValidationError


class Material(BaseModel):
    material_id: str = Field(..., description="原料ID")
    material_name: str = Field(..., description="原料名称")
    category: str = Field(..., description="原料分类")
    unit: str = Field(..., description="单位")
    unit_conversion: Dict[str, float] = Field(default_factory=dict, description="单位换算关系")
    price_per_unit: float = Field(..., gt=0, description="单价")

    @validator('unit_conversion', pre=True)
    def parse_conversion(cls, v):
        if isinstance(v, str):
            result = {}
            for pair in v.split(';'):
                if ':' in pair:
                    k, val = pair.split(':', 1)
                    result[k.strip()] = float(val.strip())
            return result
        return v


class Store(BaseModel):
    store_id: str = Field(..., description="门店ID")
    store_name: str = Field(..., description="门店名称")
    region: Optional[str] = Field(None, description="区域")
    manager: Optional[str] = Field(None, description="负责人")


class PurchaseItem(BaseModel):
    purchase_id: str = Field(..., description="采购单ID")
    store_id: str = Field(..., description="门店ID")
    material_id: str = Field(..., description="原料ID")
    purchase_date: datetime = Field(..., description="采购日期")
    quantity: float = Field(..., gt=0, description="采购数量")
    unit: str = Field(..., description="单位")
    total_price: float = Field(..., ge=0, description="总价")

    @validator('purchase_date', pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S']:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期格式: {v}")
        return v


class UsageItem(BaseModel):
    usage_id: str = Field(..., description="领用单ID")
    store_id: str = Field(..., description="门店ID")
    material_id: str = Field(..., description="原料ID")
    usage_date: datetime = Field(..., description="领用日期")
    quantity: float = Field(..., gt=0, description="领用数量")
    unit: str = Field(..., description="单位")
    department: Optional[str] = Field(None, description="领用部门")

    @validator('usage_date', pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S']:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期格式: {v}")
        return v


class WasteItem(BaseModel):
    waste_id: str = Field(..., description="报损单ID")
    store_id: str = Field(..., description="门店ID")
    material_id: str = Field(..., description="原料ID")
    waste_date: datetime = Field(..., description="报损日期")
    quantity: float = Field(..., gt=0, description="报损数量")
    unit: str = Field(..., description="单位")
    reason: Optional[str] = Field(None, description="报损原因")

    @validator('waste_date', pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S']:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期格式: {v}")
        return v


class ValidationErrorItem(BaseModel):
    row_number: int
    error_type: str
    error_message: str
    raw_data: Dict[str, Any]


class ProcessConfig(BaseModel):
    threshold_waste_rate: float = Field(default=5.0, gt=0, lt=100, description="损耗率阈值(%)")
    date_start: Optional[datetime] = Field(None, description="统计开始日期")
    date_end: Optional[datetime] = Field(None, description="统计结束日期")
    target_store: Optional[str] = Field(None, description="指定门店ID")
    target_category: Optional[str] = Field(None, description="指定原料分类")


class WasteReportItem(BaseModel):
    store_id: str
    store_name: str
    material_id: str
    material_name: str
    category: str
    purchase_quantity: float
    purchase_amount: float
    usage_quantity: float
    waste_quantity: float
    waste_amount: float
    waste_rate: float
    is_abnormal: bool
    unit: str


class StoreRankingItem(BaseModel):
    store_id: str
    store_name: str
    total_purchase: float
    total_waste: float
    waste_rate: float
    waste_amount: float
    rank: int


class CategoryAnalysisItem(BaseModel):
    category: str
    total_purchase: float
    total_waste: float
    waste_rate: float
    waste_amount: float


class FinalReport(BaseModel):
    summary: Dict[str, Any]
    store_rankings: List[StoreRankingItem]
    category_analysis: List[CategoryAnalysisItem]
    abnormal_items: List[WasteReportItem]
    validation_errors: List[ValidationErrorItem]
    config: ProcessConfig
    generated_at: datetime
