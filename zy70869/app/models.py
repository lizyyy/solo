from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


class ItemStatus(str, Enum):
    NORMAL = "normal"
    PENDING_CONFIRMATION = "pending_confirmation"
    FAILED = "failed"


class Sample(BaseModel):
    sample_id: str = Field(description="样品唯一标识")
    batch_id: str = Field(description="批次号")
    material_code: str = Field(description="物料编码")
    sample_date: date = Field(description="取样日期")
    sample_time: Optional[str] = Field(None, description="取样时间")
    test_type: str = Field(description="试验类型")
    chamber_id: Optional[str] = Field(None, description="环境箱编号")
    extension_approved: Optional[bool] = Field(None, description="延期是否审批")
    extension_days: Optional[int] = Field(0, description="延期天数")
    submitted_at: Optional[datetime] = Field(None, description="提交时间")
    raw_data: Dict[str, Any] = Field(default_factory=dict, description="原始数据")


class TestPlan(BaseModel):
    plan_id: str = Field(description="方案ID")
    test_type: str = Field(description="试验类型")
    material_code: str = Field(description="物料编码")
    sampling_window_days: int = Field(description="取样窗口天数")
    sampling_start_date: date = Field(description="取样起始日期")
    required_temperature_min: float = Field(description="最低要求温度")
    required_temperature_max: float = Field(description="最高要求温度")
    test_duration_days: int = Field(description="试验持续天数")
    extension_allowed: bool = Field(default=True, description="是否允许延期")
    max_extension_days: int = Field(default=30, description="最大延期天数")


class ChamberRecord(BaseModel):
    chamber_id: str = Field(description="环境箱编号")
    record_time: datetime = Field(description="记录时间")
    temperature: float = Field(description="温度")
    humidity: Optional[float] = Field(None, description="湿度")
    sample_id: Optional[str] = Field(None, description="关联样品ID")


class FailureDetail(BaseModel):
    rule_name: str = Field(description="违反的规则名称")
    description: str = Field(description="可读说明")
    suggestion: str = Field(description="建议处理方式")
    boundary_info: Optional[str] = Field(None, description="边界信息说明")


class ResultItem(BaseModel):
    sample_id: str
    batch_id: str
    material_code: str
    status: ItemStatus
    sample_date: date
    test_type: str
    failures: List[FailureDetail] = Field(default_factory=list)
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class ValidationResult(BaseModel):
    normal: List[ResultItem] = Field(default_factory=list)
    pending_confirmation: List[ResultItem] = Field(default_factory=list)
    failed: List[ResultItem] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    duplicates_skipped: List[str] = Field(default_factory=list, description="跳过的重复批次")
