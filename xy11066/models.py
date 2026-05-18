from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ClaimStatus(str, Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    REVIEWING = "审核中"
    SUPPLEMENT_REQUESTED = "要求补录"
    SUPPLEMENTED = "已补录"
    REJECTED = "已驳回"
    APPROVED = "已通过"
    COMPLETED = "已完成"


class TemperatureProbeStatus(str, Enum):
    NORMAL = "正常"
    MISSING_SEGMENT = "缺段"
    DEVIATION = "超温"
    INVALID = "数据无效"


class ColdChainClaim(BaseModel):
    claim_id: str = Field(description="索赔单号")
    warehouse_code: str = Field(description="仓库编码")
    warehouse_name: str = Field(description="仓库名称")
    waybill_no: str = Field(description="运单号")
    goods_name: str = Field(description="货物名称")
    goods_batch: str = Field(description="货物批次")
    goods_quantity: int = Field(description="货物数量")
    goods_unit: str = Field(description="计量单位")
    temperature_requirement: str = Field(description="温度要求")
    actual_temperature_avg: float = Field(description="实际平均温度")
    probe_id: str = Field(description="温度探头编号")
    probe_status: TemperatureProbeStatus = Field(description="探头状态")
    temperature_start_time: datetime = Field(description="测温开始时间")
    temperature_end_time: datetime = Field(description="测温结束时间")
    abnormal_duration_hours: float = Field(description="异常持续时长(小时)")
    responsible_party: str = Field(description="责任方")
    claim_amount: float = Field(description="索赔金额")
    applicant: str = Field(description="申请人")
    application_time: datetime = Field(description="申请时间")
    status: ClaimStatus = Field(description="状态")
    reviewer: Optional[str] = Field(None, description="审核人")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_opinion: Optional[str] = Field(None, description="审核意见")
    manual_remark: Optional[str] = Field(None, description="人工备注")
    supplement_count: int = Field(0, description="补录次数")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class BadRowInfo(BaseModel):
    row_index: int = Field(description="行号")
    original_data: Dict[str, Any] = Field(description="原始字段数据")
    error_reason: str = Field(description="错误原因")
    suggestion: str = Field(description="处理建议")


class ImportResult(BaseModel):
    success_count: int = Field(description="成功导入数量")
    fail_count: int = Field(description="失败数量")
    warning_count: int = Field(description="警告数量")
    bad_rows: List[BadRowInfo] = Field(default_factory=list, description="坏行详情")
    warning_rows: List[BadRowInfo] = Field(default_factory=list, description="警告行详情")
    imported_claims: List[ColdChainClaim] = Field(default_factory=list, description="已导入的索赔单")


class ProbeMissingSegmentRequest(BaseModel):
    claim_id: str = Field(description="索赔单号")
    manual_remark: str = Field(description="人工备注")
    operator: str = Field(description="操作人")
