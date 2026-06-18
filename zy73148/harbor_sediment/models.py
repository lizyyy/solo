from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class RecordStatus(str, Enum):
    RELEASED = "已放行"
    PENDING_EVIDENCE = "待补证据"
    MANUALLY_MODIFIED = "人工改过"
    SUSPENDED = "暂缓"
    CALCULATION_FAILED = "计算失败"


class ErrorCategory(str, Enum):
    FORMULA_ERROR = "公式错误"
    UNIT_ERROR = "单位错误"
    THRESHOLD_ERROR = "阈值错误"
    DATA_MISMATCH = "数据不匹配"
    CLOUD_OCCLUSION = "遥感云遮挡"
    MISSING_DATA = "数据缺失"


class BottleSample(BaseModel):
    bottle_id: str = Field(..., description="采样瓶编号，如 HW-20250315-A03-072")
    sampling_time: Optional[datetime] = Field(None, description="采样时间")
    station_code: Optional[str] = Field(None, description="站位编码")
    experiment_result: Optional[float] = Field(None, description="实验结果（含沙量 kg/m³）")
    experiment_unit: Optional[str] = Field(None, description="实验结果单位")
    experiment_time: Optional[datetime] = Field(None, description="实验时间")
    batch_no: Optional[str] = Field(None, description="批次号")
    operator: Optional[str] = Field(None, description="操作员")
    raw_data: Dict[str, Any] = Field(default_factory=dict, description="原始数据")
    remarks: Optional[str] = Field(None, description="备注")
    has_cloud_occlusion: bool = Field(False, description="是否存在遥感云遮挡")
    cloud_occlusion_detail: Optional[str] = Field(None, description="云遮挡详情")

    @field_validator("bottle_id")
    @classmethod
    def validate_bottle_id_format(cls, v: str) -> str:
        if not v or len(v) < 5:
            raise ValueError("采样瓶编号格式无效")
        return v


class CalculationError(BaseModel):
    category: ErrorCategory = Field(..., description="错误类别")
    detail: str = Field(..., description="错误详情")
    affected_field: Optional[str] = Field(None, description="受影响字段")
    suggestion: Optional[str] = Field(None, description="修复建议")
    timestamp: datetime = Field(default_factory=datetime.now, description="错误发生时间")


class SuspicionItem(BaseModel):
    source: str = Field(..., description="疑点来源（如 采样瓶编号、遥感数据）")
    content: str = Field(..., description="疑点内容")
    reason: str = Field(..., description="暂缓原因")
    related_bottle_ids: List[str] = Field(default_factory=list, description="关联采样瓶编号")
    timestamp: datetime = Field(default_factory=datetime.now, description="记录时间")


class ChangeHistory(BaseModel):
    version: int = Field(..., description="版本号")
    change_time: datetime = Field(default_factory=datetime.now, description="变更时间")
    operator: Optional[str] = Field(None, description="操作人")
    old_material: Dict[str, Any] = Field(default_factory=dict, description="旧材料数据快照")
    new_material: Dict[str, Any] = Field(default_factory=dict, description="新材料数据快照")
    new_remark: Optional[str] = Field(None, description="新备注")
    change_reason: str = Field(..., description="改判原因")
    old_conclusion: Optional[str] = Field(None, description="原结论")
    new_conclusion: Optional[str] = Field(None, description="新结论")


class SedimentRecord(BaseModel):
    record_id: str = Field(..., description="淤积空间标注记录ID")
    station_code: str = Field(..., description="站位编码")
    target_harbor: str = Field(..., description="目标港湾")
    status: RecordStatus = Field(..., description="记录状态")
    bottles: List[BottleSample] = Field(default_factory=list, description="关联采样瓶列表")
    bottles_received: List[str] = Field(default_factory=list, description="已收到的采样瓶编号（按批次）")
    sediment_conclusion: Optional[str] = Field(None, description="淤积空间标注结论")
    sediment_value: Optional[float] = Field(None, description="淤积量计算值")
    sediment_unit: Optional[str] = Field(None, description="淤积量单位")
    calculation_errors: List[CalculationError] = Field(default_factory=list, description="计算错误列表")
    suspicions: List[SuspicionItem] = Field(default_factory=list, description="疑点列表")
    change_history: List[ChangeHistory] = Field(default_factory=list, description="变更历史")
    current_version: int = Field(1, description="当前版本号")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    final_report_ready: bool = Field(False, description="是否可进入最终报告")
    created_by: Optional[str] = Field(None, description="创建人")
    last_modified_by: Optional[str] = Field(None, description="最后修改人")


class CommunicationResult(BaseModel):
    record_id: str = Field(..., description="记录ID")
    station_code: str = Field(..., description="站位")
    target_harbor: str = Field(..., description="目标港湾")
    status: RecordStatus = Field(..., description="状态标签")
    status_color: str = Field(..., description="状态颜色（用于前端展示）")
    summary: str = Field(..., description="一句话摘要，可直接用于沟通")
    detail_sections: List[Dict[str, Any]] = Field(default_factory=list, description="详细分区内容")
    bottle_ids: List[str] = Field(default_factory=list, description="涉及采样瓶编号")
    pending_actions: List[str] = Field(default_factory=list, description="待办动作")
    last_update: datetime = Field(..., description="最后更新时间")
