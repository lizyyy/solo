from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ChangeAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    NO_OP = "no-op"
    READ = "read"
    UNKNOWN = "unknown"


class ChangeSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ResourceChange(BaseModel):
    resource_address: str = Field(..., description="资源完整地址")
    resource_type: str = Field(..., description="资源类型")
    resource_name: str = Field(..., description="资源名称")
    module_path: Optional[str] = Field(None, description="模块路径")
    action: ChangeAction = Field(..., description="变更动作")
    previous_attributes: Dict[str, Any] = Field(default_factory=dict, description="变更前属性")
    planned_attributes: Dict[str, Any] = Field(default_factory=dict, description="变更后属性")
    changed_fields: List[str] = Field(default_factory=list, description="变更的字段列表")
    sensitive_fields: List[str] = Field(default_factory=list, description="敏感字段列表")
    line_number: Optional[int] = Field(None, description="在plan文件中的行号")
    source_file: Optional[str] = Field(None, description="源文件路径")
    responsible_team: Optional[str] = Field(None, description="责任团队")
    severity: ChangeSeverity = Field(ChangeSeverity.MEDIUM, description="变更严重程度")
    requires_attention: bool = Field(False, description="是否需要人工处理")
    notes: Optional[str] = Field(None, description="备注信息")


class ProcessingError(BaseModel):
    error_type: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误信息")
    source_file: str = Field(..., description="源文件")
    line_number: Optional[int] = Field(None, description="行号")
    raw_content: Optional[str] = Field(None, description="原始内容")
    timestamp: datetime = Field(default_factory=datetime.now)


class TeamMapping(BaseModel):
    team_name: str = Field(..., description="团队名称")
    patterns: List[str] = Field(default_factory=list, description="匹配模式（资源类型或模块路径）")
    priority: int = Field(0, description="匹配优先级")


class DriftSummary(BaseModel):
    summary_id: str = Field(..., description="摘要ID")
    generated_at: datetime = Field(default_factory=datetime.now)
    input_file: str = Field(..., description="输入文件")
    total_resources: int = Field(0, description="总资源数")
    total_changes: int = Field(0, description="总变更数")
    changes_by_action: Dict[ChangeAction, int] = Field(default_factory=dict, description="按动作分类的变更统计")
    changes_by_team: Dict[str, int] = Field(default_factory=dict, description="按团队分类的变更统计")
    changes_by_severity: Dict[ChangeSeverity, int] = Field(default_factory=dict, description="按严重程度分类")
    changes_requiring_attention: int = Field(0, description="需要人工处理的变更数")
    changes: List[ResourceChange] = Field(default_factory=list, description="所有变更详情")
    errors: List[ProcessingError] = Field(default_factory=list, description="处理错误")
    masked_fields_count: int = Field(0, description="已遮蔽的敏感字段数")
