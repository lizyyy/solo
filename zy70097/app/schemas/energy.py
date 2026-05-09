from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class EnergyDataBase(BaseModel):
    equipment_id: int = Field(..., description="设备ID")
    record_date: datetime = Field(..., description="记录日期时间")
    energy_consumption: float = Field(..., description="能耗值 (kWh)")
    energy_type: Optional[str] = Field("electricity", description="能源类型")
    source: Optional[str] = Field(None, description="数据来源")


class EnergyDataCreate(EnergyDataBase):
    pass


class EnergyDataResponse(EnergyDataBase):
    id: int
    is_outlier: bool
    outlier_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductionDataBase(BaseModel):
    equipment_id: int = Field(..., description="设备ID")
    record_date: datetime = Field(..., description="记录日期时间")
    production_quantity: float = Field(..., description="产量")
    production_unit: str = Field(..., description="产量单位")
    shift: Optional[str] = Field(None, description="班次")
    source: Optional[str] = Field(None, description="数据来源")


class ProductionDataCreate(ProductionDataBase):
    pass


class ProductionDataResponse(ProductionDataBase):
    id: int
    is_outlier: bool
    outlier_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BaselineVersionBase(BaseModel):
    name: str = Field(..., description="版本名称")
    equipment_id: Optional[int] = Field(None, description="关联设备ID")
    group_id: Optional[int] = Field(None, description="关联分组ID")
    baseline_type: str = Field(..., description="基线类型: equipment, group")
    start_date: datetime = Field(..., description="基线开始日期")
    end_date: datetime = Field(..., description="基线结束日期")
    description: Optional[str] = Field(None, description="描述")
    created_by: Optional[str] = Field(None, description="创建人")


class BaselineVersionCreate(BaselineVersionBase):
    version: Optional[str] = Field(None, description="版本号，不填则自动生成")


class BaselineVersionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    replace_reason: Optional[str] = None


class BaselineVersionResponse(BaselineVersionBase):
    id: int
    version: str
    baseline_value: float
    baseline_std: Optional[float]
    baseline_formula: Optional[Dict[str, Any]]
    is_active: bool
    status: str
    data_points_count: int
    excluded_points_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BaselineCalculationRequest(BaseModel):
    equipment_ids: Optional[List[int]] = Field(None, description="设备ID列表")
    group_ids: Optional[List[int]] = Field(None, description="分组ID列表")
    start_date: datetime = Field(..., description="基线开始日期")
    end_date: datetime = Field(..., description="基线结束日期")
    version_name: str = Field(..., description="版本名称")
    created_by: Optional[str] = Field(None, description="创建人")


class EnergySavingBase(BaseModel):
    equipment_id: int = Field(..., description="设备ID")
    baseline_id: int = Field(..., description="基线版本ID")
    period_start: datetime = Field(..., description="统计周期开始")
    period_end: datetime = Field(..., description="统计周期结束")


class EnergySavingResponse(EnergySavingBase):
    id: int
    calculation_date: datetime
    actual_energy: float
    baseline_energy: float
    saving_energy: float
    saving_rate: float
    normalized_production: float
    data_points_count: int
    status: str
    remark: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SavingCalculationRequest(BaseModel):
    equipment_ids: Optional[List[int]] = Field(None, description="设备ID列表")
    group_ids: Optional[List[int]] = Field(None, description="分组ID列表")
    baseline_id: Optional[int] = Field(None, description="指定基线版本ID，不填则使用当前激活版本")
    period_start: datetime = Field(..., description="统计周期开始")
    period_end: datetime = Field(..., description="统计周期结束")
    created_by: Optional[str] = Field(None, description="计算人")


class OutlierDetectionRequest(BaseModel):
    equipment_ids: Optional[List[int]] = Field(None, description="设备ID列表")
    start_date: datetime = Field(..., description="开始日期")
    end_date: datetime = Field(..., description="结束日期")
    threshold: Optional[float] = Field(3.0, description="异常阈值（标准差倍数）")
