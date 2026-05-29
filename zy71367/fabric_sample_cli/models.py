from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, validator


class InspectionStatus(str, Enum):
    PENDING = "待检验"
    IN_PROGRESS = "检验中"
    PASSED = "检验通过"
    FAILED = "检验不合格"
    REINSPECT = "待复检"
    REVOKED = "已撤回"


class ColorFormat(str, Enum):
    HEX = "HEX"
    RGB = "RGB"
    PANTONE = "PANTONE"
    CMYK = "CMYK"
    NAME = "中文名称"
    UNKNOWN = "未知格式"


class ArrivalStatus(str, Enum):
    ON_TIME = "准时到货"
    EARLY = "提前到货"
    DELAYED = "到货逾期"
    NOT_ARRIVED = "未到货"
    UNKNOWN = "状态未知"


class OperationType(str, Enum):
    CREATE = "创建"
    UPDATE = "更新"
    AMEND = "补录"
    REVOKE = "撤回"
    MATCH = "匹配"
    INSPECT = "检验"
    EXPORT = "导出"


class Supplier(BaseModel):
    supplier_id: str = Field(..., description="供应商编号")
    supplier_name: str = Field(..., description="供应商名称")
    contact_person: Optional[str] = Field(None, description="联系人")
    contact_phone: Optional[str] = Field(None, description="联系电话")
    address: Optional[str] = Field(None, description="地址")
    remark: Optional[str] = Field(None, description="备注")


class ColorSpec(BaseModel):
    color_code: str = Field(..., description="色号原始值")
    color_name: Optional[str] = Field(None, description="颜色名称")
    format_detected: ColorFormat = Field(ColorFormat.UNKNOWN, description="检测到的色号格式")
    normalized_hex: Optional[str] = Field(None, description="标准化HEX色号")
    normalized_rgb: Optional[tuple] = Field(None, description="标准化RGB值")
    pantone_code: Optional[str] = Field(None, description="潘通色号")
    color_confidence: float = Field(0.0, description="色号识别置信度")
    is_confusing: bool = Field(False, description="是否存在色号混淆风险")
    confusing_with: Optional[List[str]] = Field(None, description="可能混淆的其他色号")


class FabricSample(BaseModel):
    sample_id: str = Field(..., description="样卡编号")
    fabric_name: str = Field(..., description="面料名称")
    fabric_type: Optional[str] = Field(None, description="面料成分/类型")
    color_spec: ColorSpec = Field(..., description="颜色规格")
    supplier_id: str = Field(..., description="供应商编号")
    arrival_date: Optional[date] = Field(None, description="实际到货日期")
    expected_arrival: Optional[date] = Field(None, description="预计到货日期")
    inspection_deadline: Optional[date] = Field(None, description="试装检验截止日期")
    sample_report_path: Optional[str] = Field(None, description="样卡报告路径")
    inspection_status: InspectionStatus = Field(InspectionStatus.PENDING, description="检验状态")
    remark: Optional[str] = Field(None, description="备注（脏数据、手写标注等）")
    is_missing: bool = Field(False, description="样卡是否缺失")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Garment(BaseModel):
    garment_id: str = Field(..., description="成衣编号")
    style_name: str = Field(..., description="款式名称")
    style_code: Optional[str] = Field(None, description="款式代码")
    sample_id: Optional[str] = Field(None, description="关联样卡编号")
    supplier_id: Optional[str] = Field(None, description="供应商编号")
    color_spec: Optional[ColorSpec] = Field(None, description="成衣颜色规格")
    fitting_date: Optional[date] = Field(None, description="试装日期")
    show_order: Optional[int] = Field(None, description="走秀顺序")
    remark: Optional[str] = Field(None, description="备注")


class MatchingRecord(BaseModel):
    match_id: str = Field(..., description="匹配记录编号")
    sample_id: str = Field(..., description="样卡编号")
    supplier_id: str = Field(..., description="供应商编号")
    garment_id: str = Field(..., description="成衣编号")
    match_score: float = Field(0.0, description="匹配置信度")
    color_match_score: float = Field(0.0, description="颜色匹配度")
    supplier_match_score: float = Field(0.0, description="供应商匹配度")
    is_manual: bool = Field(False, description="是否人工匹配")
    matched_at: datetime = Field(default_factory=datetime.now)
    matched_by: Optional[str] = Field(None, description="匹配人")


class ErrorRecord(BaseModel):
    error_id: str = Field(..., description="错误编号")
    error_type: str = Field(..., description="错误类型")
    error_code: str = Field(..., description="错误代码")
    message: str = Field(..., description="错误描述")
    related_sample_id: Optional[str] = Field(None, description="关联样卡")
    related_garment_id: Optional[str] = Field(None, description="关联成衣")
    related_supplier_id: Optional[str] = Field(None, description="关联供应商")
    severity: str = Field("warning", description="严重程度")
    calculation_detail: Optional[Dict[str, Any]] = Field(None, description="计算过程详情")
    created_at: datetime = Field(default_factory=datetime.now)
    resolved: bool = Field(False, description="是否已解决")


class HistoryRecord(BaseModel):
    record_id: str = Field(..., description="历史记录编号")
    operation_type: OperationType = Field(..., description="操作类型")
    entity_type: str = Field(..., description="实体类型")
    entity_id: str = Field(..., description="实体编号")
    operator: Optional[str] = Field(None, description="操作人")
    operation_time: datetime = Field(default_factory=datetime.now)
    before_data: Optional[Dict[str, Any]] = Field(None, description="操作前数据")
    after_data: Optional[Dict[str, Any]] = Field(None, description="操作后数据")
    change_reason: Optional[str] = Field(None, description="变更原因")
    calculation_trace: Optional[List[str]] = Field(None, description="计算追踪日志")


class ArrivalReminder(BaseModel):
    reminder_id: str = Field(..., description="提醒编号")
    sample_id: str = Field(..., description="样卡编号")
    garment_id: Optional[str] = Field(None, description="关联成衣")
    arrival_status: ArrivalStatus = Field(..., description="到货状态")
    expected_arrival: date = Field(..., description="预计到货日期")
    actual_arrival: Optional[date] = Field(None, description="实际到货日期")
    inspection_deadline: Optional[date] = Field(None, description="检验截止日期")
    days_overdue: int = Field(0, description="逾期天数")
    days_before_deadline: Optional[int] = Field(None, description="距离检验截止天数")
    status_transition_chain: List[str] = Field(default_factory=list, description="状态流转链")
    calculation_process: Dict[str, Any] = Field(default_factory=dict, description="计算过程")
    created_at: datetime = Field(default_factory=datetime.now)


class DataStore(BaseModel):
    suppliers: Dict[str, Supplier] = Field(default_factory=dict)
    samples: Dict[str, FabricSample] = Field(default_factory=dict)
    garments: Dict[str, Garment] = Field(default_factory=dict)
    matches: Dict[str, MatchingRecord] = Field(default_factory=dict)
    errors: Dict[str, ErrorRecord] = Field(default_factory=dict)
    history: Dict[str, HistoryRecord] = Field(default_factory=list)
    reminders: Dict[str, ArrivalReminder] = Field(default_factory=dict)

    @validator('history', pre=True, always=True)
    def convert_history_to_dict(cls, v):
        if isinstance(v, list):
            return {h.record_id: h for h in v}
        return v
