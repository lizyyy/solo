from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class RuleType(str, Enum):
    NORMAL = "normal"
    WIDE = "wide"


class DetectionStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"


class LakePartition(BaseModel):
    id: str = Field(description="分区唯一标识")
    source_system: str = Field(description="来源系统")
    environment: str = Field(description="环境名称")
    database_name: str = Field(description="数据库名称")
    table_name: str = Field(description="表名称")
    partition_column: str = Field(description="分区字段")
    partition_value: str = Field(description="分区值")
    data_date: str = Field(description="数据日期")
    record_count: int = Field(description="记录数")
    file_size: float = Field(description="文件大小(MB)")
    creation_time: datetime = Field(description="创建时间")
    update_time: datetime = Field(description="更新时间")
    original_input: Dict[str, Any] = Field(description="原始输入完整数据，便于回溯")


class DetectionRule(BaseModel):
    rule_id: str = Field(description="规则ID")
    rule_name: str = Field(description="规则名称")
    rule_type: RuleType = Field(description="规则类型")
    version: str = Field(description="规则版本号")
    description: str = Field(description="规则描述")
    conditions: Dict[str, Any] = Field(description="检测条件配置")
    created_at: datetime = Field(description="规则创建时间")
    is_active: bool = Field(description="是否启用")


class InvoiceRed冲Record(BaseModel):
    id: str = Field(description="记录ID")
    environment: str = Field(description="环境名称")
    invoice_no: str = Field(description="发票号码")
    red冲_date: str = Field(description="红冲日期")
    amount: float = Field(description="红冲金额")
    status: str = Field(description="状态")
    original_input: Dict[str, Any] = Field(description="原始输入完整数据")
    source_partition_id: Optional[str] = Field(None, description="关联的分区ID")


class FailedItem(BaseModel):
    batch_id: str = Field(description="批次ID")
    item_id: str = Field(description="项目ID")
    item_type: str = Field(description="项目类型")
    error_message: str = Field(description="错误信息")
    error_type: str = Field(description="错误类型")
    original_data: Dict[str, Any] = Field(description="原始数据")
    failed_at: datetime = Field(default_factory=datetime.now)
    rule_version: str = Field(description="当时使用的规则版本")


class BatchRecord(BaseModel):
    batch_id: str = Field(description="批次ID")
    rule_version: str = Field(description="使用的规则版本")
    rule_type: RuleType = Field(description="规则类型")
    start_time: datetime = Field(description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    total_count: int = Field(0, description="总记录数")
    pass_count: int = Field(0, description="通过数")
    fail_count: int = Field(0, description="失败数")
    warning_count: int = Field(0, description="警告数")
    status: str = Field("running", description="批次状态")
    executed_by: str = Field("system", description="执行人")


class DetectionResult(BaseModel):
    batch_id: str = Field(description="批次ID")
    partition_id: str = Field(description="分区ID")
    status: DetectionStatus = Field(description="检测状态")
    rule_id: str = Field(description="使用的规则ID")
    rule_version: str = Field(description="规则版本")
    details: Dict[str, Any] = Field(description="检测详情")
    suggestions: List[str] = Field(description="处理建议")
    detected_at: datetime = Field(default_factory=datetime.now)


class ComparisonItem(BaseModel):
    field_name: str = Field(description="字段名")
    before: Any = Field(description="处理前值")
    after: Any = Field(description="处理后值")
    changed: bool = Field(description="是否变更")


class ReportData(BaseModel):
    batch_id: str = Field(description="批次ID")
    rule_version: str = Field(description="规则版本")
    rule_type: RuleType = Field(description="规则类型")
    execution_time_seconds: float = Field(description="执行时间(秒)")
    before_summary: Dict[str, Any] = Field(description="处理前汇总")
    after_summary: Dict[str, Any] = Field(description="处理后汇总")
    comparisons: List[ComparisonItem] = Field(description="详细对比项")
    suggestions: List[str] = Field(description="下一步建议")
    failed_items_count: int = Field(description="失败项数量")
    generated_at: datetime = Field(default_factory=datetime.now)
