from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RuleTypeEnum(str, Enum):
    LESION_DETECTION = "病斑检测"
    VERIFICATION = "核验规则"
    ROLLBACK = "回滚规则"
    REPORT = "报告规则"


class RuleStatusEnum(str, Enum):
    DRAFT = "草稿"
    ACTIVE = "启用"
    DISABLED = "停用"
    DEPRECATED = "弃用"


class RuleDefinitionBase(BaseModel):
    rule_code: str = Field(..., description="规则编号")
    rule_name: str = Field(..., description="规则名称")
    rule_type: RuleTypeEnum = Field(..., description="规则类型")
    rule_description: str = Field(..., description="规则描述")
    rule_condition: Dict[str, Any] = Field(..., description="规则条件(JSON格式)")
    rule_action: Optional[Dict[str, Any]] = Field(default=None, description="规则动作(JSON格式)")
    priority: Optional[int] = Field(default=0, description="优先级(数字越大优先级越高)")
    is_auto_apply: Optional[bool] = Field(default=True, description="是否自动应用")
    remark: Optional[str] = Field(default=None, description="备注")


class RuleDefinitionCreate(RuleDefinitionBase):
    created_by: str = Field(..., description="创建人")


class RuleDefinitionUpdate(BaseModel):
    rule_name: Optional[str] = Field(default=None, description="规则名称")
    rule_description: Optional[str] = Field(default=None, description="规则描述")
    rule_condition: Optional[Dict[str, Any]] = Field(default=None, description="规则条件(JSON格式)")
    rule_action: Optional[Dict[str, Any]] = Field(default=None, description="规则动作(JSON格式)")
    priority: Optional[int] = Field(default=None, description="优先级(数字越大优先级越高)")
    is_auto_apply: Optional[bool] = Field(default=None, description="是否自动应用")
    remark: Optional[str] = Field(default=None, description="备注")


class RuleDefinitionResponse(RuleDefinitionBase):
    id: int = Field(..., description="主键ID")
    version: int = Field(default=1, description="版本号")
    status: RuleStatusEnum = Field(default=RuleStatusEnum.DRAFT, description="规则状态")
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(..., description="创建时间")
    updated_by: Optional[str] = Field(default=None, description="更新人")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class RuleListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")
    items: list[RuleDefinitionResponse] = Field(..., description="规则列表")


class RuleExecutionLogResponse(BaseModel):
    id: int = Field(..., description="主键ID")
    log_code: str = Field(..., description="日志编号")
    rule_id: int = Field(..., description="规则ID")
    rule_code: str = Field(..., description="规则编号")
    rule_name: str = Field(..., description="规则名称")
    target_type: str = Field(..., description="目标类型(lesion/verification等)")
    target_id: int = Field(..., description="目标ID")
    target_code: Optional[str] = Field(default=None, description="目标编号")
    input_data: Optional[Dict[str, Any]] = Field(default=None, description="输入数据快照")
    execution_result: Optional[Dict[str, Any]] = Field(default=None, description="执行结果")
    match_reason: Optional[str] = Field(default=None, description="匹配原因")
    is_matched: bool = Field(default=False, description="是否匹配")
    executed_by: Optional[str] = Field(default=None, description="执行人")
    executed_at: datetime = Field(..., description="执行时间")
    remark: Optional[str] = Field(default=None, description="备注")
    
    class Config:
        from_attributes = True


class RuleApplicationRequest(BaseModel):
    rule_type: RuleTypeEnum = Field(..., description="规则类型")
    target_type: str = Field(..., description="目标类型")
    target_data: Dict[str, Any] = Field(..., description="目标数据")
    target_id: Optional[int] = Field(default=None, description="目标ID")
    target_code: Optional[str] = Field(default=None, description="目标编号")
    executed_by: str = Field(default="system", description="执行人")
    auto_save: bool = Field(default=True, description="是否自动保存执行日志")
