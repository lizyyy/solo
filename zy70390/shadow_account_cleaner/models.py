"""数据模型定义"""
from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator


class Employee(BaseModel):
    """HR 员工数据模型"""
    employee_id: str = Field(..., description="员工号")
    name: str = Field(..., description="姓名")
    email: str = Field(..., description="邮箱")
    phone: str = Field(..., description="手机号")
    department: str = Field(..., description="部门")
    position: str = Field(..., description="职位")
    status: str = Field(..., description="员工状态: active/terminated/transferred")
    join_date: date = Field(..., description="入职日期")
    termination_date: Optional[date] = Field(None, description="离职日期")
    previous_departments: List[str] = Field(default_factory=list, description="历史部门")
    previous_emails: List[str] = Field(default_factory=list, description="历史邮箱")
    manager_id: Optional[str] = Field(None, description="直属上级员工号")
    
    @validator('status')
    def validate_status(cls, v):
        allowed = {'active', 'terminated', 'transferred'}
        if v not in allowed:
            raise ValueError(f"状态必须是以下之一: {allowed}")
        return v


class Account(BaseModel):
    """系统账号数据模型"""
    account_id: str = Field(..., description="账号ID")
    system: str = Field(..., description="所属系统: git/bi/crm/...")
    username: str = Field(..., description="用户名")
    name: Optional[str] = Field(None, description="显示姓名")
    email: Optional[str] = Field(None, description="邮箱")
    phone: Optional[str] = Field(None, description="手机号")
    employee_id: Optional[str] = Field(None, description="关联员工号")
    status: str = Field(default="active", description="账号状态: active/disabled")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    last_login: Optional[datetime] = Field(None, description="最后登录时间")
    is_service_account: bool = Field(default=False, description="是否服务账号")
    service_account_owner: Optional[str] = Field(None, description="服务账号负责人")
    service_account_expiry: Optional[date] = Field(None, description="服务账号豁免到期时间")
    notes: Optional[str] = Field(None, description="备注")
    
    @validator('status')
    def validate_status(cls, v):
        allowed = {'active', 'disabled'}
        if v not in allowed:
            raise ValueError(f"状态必须是以下之一: {allowed}")
        return v


class Permission(BaseModel):
    """权限数据模型"""
    permission_id: str = Field(..., description="权限ID")
    account_id: str = Field(..., description="关联账号ID")
    system: str = Field(..., description="所属系统")
    role: str = Field(..., description="角色名")
    permissions: List[str] = Field(default_factory=list, description="权限列表")
    is_high_risk: bool = Field(default=False, description="是否高风险权限")
    granted_at: Optional[datetime] = Field(None, description="授权时间")


class MatchResult(BaseModel):
    """匹配结果模型"""
    account_id: str = Field(..., description="账号ID")
    employee_id: Optional[str] = Field(None, description="匹配到的员工号")
    confidence: float = Field(..., description="置信度 0.0-1.0")
    evidence: Dict[str, str] = Field(default_factory=dict, description="匹配证据字段")
    match_method: str = Field(..., description="匹配方法: exact_email/partial_name/...")
    is_ambiguous: bool = Field(default=False, description="是否有歧义（同名等情况）")


class RiskAssessment(BaseModel):
    """风险评估模型"""
    account_id: str = Field(..., description="账号ID")
    risk_level: str = Field(..., description="风险等级: high/medium/low")
    risk_type: str = Field(..., description="风险类型: terminated_employee/transferred_stale/unclaimed/duplicate/service_account_expired")
    description: str = Field(..., description="风险描述")
    recommended_action: str = Field(..., description="建议动作")
    evidence: Dict[str, str] = Field(default_factory=dict, description="风险证据")
    score: float = Field(..., description="风险分数")


class OwnerMark(BaseModel):
    """人工认领记录"""
    account_id: str = Field(..., description="账号ID")
    owner_employee_id: Optional[str] = Field(None, description="认领人员工号")
    marked_by: str = Field(..., description="操作人")
    marked_at: datetime = Field(default_factory=datetime.now, description="操作时间")
    reason: str = Field(..., description="认领/忽略原因")
    is_exemption: bool = Field(default=False, description="是否豁免")
    exemption_expiry: Optional[date] = Field(None, description="豁免到期时间")


class DisablePlan(BaseModel):
    """禁用计划"""
    account_id: str = Field(..., description="账号ID")
    planned_date: date = Field(..., description="计划禁用日期")
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    reason: str = Field(..., description="禁用原因")
    status: str = Field(default="pending", description="状态: pending/executed/cancelled/expired")
    risk_assessment: Optional[RiskAssessment] = Field(None, description="关联的风险评估")


class Report(BaseModel):
    """清理报告"""
    generated_at: datetime = Field(default_factory=datetime.now, description="报告生成时间")
    summary: Dict[str, int] = Field(default_factory=dict, description="统计摘要")
    accounts: List[Account] = Field(default_factory=list, description="所有账号")
    employees: List[Employee] = Field(default_factory=list, description="所有员工")
    matches: List[MatchResult] = Field(default_factory=list, description="匹配结果")
    risks: List[RiskAssessment] = Field(default_factory=list, description="风险评估")
    owner_marks: List[OwnerMark] = Field(default_factory=list, description="认领记录")
    disable_plans: List[DisablePlan] = Field(default_factory=list, description="禁用计划")
