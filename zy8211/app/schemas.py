from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from enum import Enum


class Shift(str, Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    NIGHT = "night"


class ExceptionType(str, Enum):
    DOSAGE_MISMATCH = "dosage_mismatch"
    FEED_SLUDGE_MISMATCH = "feed_sludge_mismatch"
    MOISTURE_EXCEED = "moisture_exceed"
    CROSS_SHIFT_BATCH = "cross_shift_batch"
    MISSING_BATCH = "missing_batch"
    MISSING_LAB_RESULT = "missing_lab_result"


class DehydratorRunBase(BaseModel):
    machine_id: str = Field(..., description="脱水机编号")
    start_time: datetime = Field(..., description="运行开始时间")
    end_time: Optional[datetime] = Field(None, description="运行结束时间")
    feed_sludge_volume: float = Field(..., gt=0, description="进泥量(m³)")
    feed_sludge_concentration: Optional[float] = Field(None, description="进泥浓度(%)")
    dry_solids_input: Optional[float] = Field(None, description="绝干泥量(t)")
    batch_id: Optional[str] = Field(None, description="关联药剂批次ID")


class DehydratorRunCreate(DehydratorRunBase):
    run_id: str = Field(..., description="运行记录ID")


class DehydratorRunResponse(DehydratorRunBase):
    run_id: str
    shift: str
    shift_date: datetime
    imported_at: datetime
    source_file: Optional[str]
    
    class Config:
        from_attributes = True


class ChemicalBatchBase(BaseModel):
    chemical_type: str = Field(..., description="药剂类型")
    concentration: float = Field(..., gt=0, description="药剂浓度(%)")
    dosage_rate_target: Optional[float] = Field(None, description="目标投加率(kg/t)")
    dosage_rate_min: Optional[float] = Field(None, description="最小投加率(kg/t)")
    dosage_rate_max: Optional[float] = Field(None, description="最大投加率(kg/t)")
    start_time: datetime = Field(..., description="批次开始时间")
    end_time: Optional[datetime] = Field(None, description="批次结束时间")
    total_chemical_used: Optional[float] = Field(None, description="总药剂使用量(kg)")
    supplier: Optional[str] = Field(None, description="供应商")


class ChemicalBatchCreate(ChemicalBatchBase):
    batch_id: str = Field(..., description="批次ID")


class ChemicalBatchResponse(ChemicalBatchBase):
    batch_id: str
    imported_at: datetime
    source_file: Optional[str]
    
    class Config:
        from_attributes = True


class LabMoistureResultBase(BaseModel):
    sample_time: datetime = Field(..., description="取样时间")
    moisture_content: float = Field(..., ge=0, le=100, description="含水率(%)")
    cake_solids: Optional[float] = Field(None, description="泥饼含固率(%)")
    run_id: Optional[str] = Field(None, description="关联运行记录ID")
    batch_id: Optional[str] = Field(None, description="关联药剂批次ID")
    tested_by: Optional[str] = Field(None, description="检测人")
    tested_at: Optional[datetime] = Field(None, description="检测时间")


class LabMoistureResultCreate(LabMoistureResultBase):
    result_id: str = Field(..., description="检测结果ID")


class LabMoistureResultResponse(LabMoistureResultBase):
    result_id: str
    imported_at: datetime
    source_file: Optional[str]
    
    class Config:
        from_attributes = True


class ExceptionReviewBase(BaseModel):
    run_id: str = Field(..., description="运行记录ID")
    exception_type: ExceptionType = Field(..., description="异常类型")
    exception_message: str = Field(..., description="异常描述")


class ExceptionReviewCreate(ExceptionReviewBase):
    pass


class ExceptionReviewResponse(ExceptionReviewBase):
    review_id: str
    is_resolved: bool
    resolution_note: Optional[str]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExceptionReviewResolve(BaseModel):
    resolution_note: str = Field(..., description="处理说明")
    resolved_by: str = Field(..., description="处理人")


class ReviewRuleBase(BaseModel):
    rule_name: str = Field(..., description="规则名称")
    rule_type: str = Field(..., description="规则类型")
    threshold_value: Optional[float] = Field(None, description="阈值")
    min_value: Optional[float] = Field(None, description="最小值")
    max_value: Optional[float] = Field(None, description="最大值")
    is_enabled: bool = Field(default=True, description="是否启用")
    priority: int = Field(default=1, ge=1, description="优先级")


class ReviewRuleCreate(ReviewRuleBase):
    rule_id: str = Field(..., description="规则ID")


class ReviewRuleResponse(ReviewRuleBase):
    rule_id: str
    imported_at: datetime
    
    class Config:
        from_attributes = True


class ImportResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    message: str
    errors: List[str] = []


class BatchAnalysis(BaseModel):
    batch_id: str
    chemical_type: str
    total_runs: int
    total_feed_volume: float
    total_dry_solids: float
    avg_dosage_rate: Optional[float]
    avg_moisture: Optional[float]
    cross_shift: bool
    exception_count: int


class DailyReport(BaseModel):
    report_date: date
    total_runs: int
    total_feed_volume: float
    total_dry_solids: float
    avg_moisture: Optional[float]
    exception_count: int
    resolved_count: int
    batch_analysis: List[BatchAnalysis]
