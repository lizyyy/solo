"""
验证器
处理各种边界情况：缺字段、重复请求、数据有效性等
"""

from typing import Optional, List, Tuple
from dataclasses import dataclass

from .models import (
    PlanVersion, QuotaBucket, QuotaType,
    ChangeReason
)


@dataclass
class ValidationError:
    """验证错误"""
    field: str
    message: str
    code: str = "validation_error"


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool
    errors: List[ValidationError]
    
    @property
    def error_messages(self) -> List[str]:
        """获取所有错误消息"""
        return [e.message for e in self.errors]


class QuotaValidator:
    """限额验证器
    负责验证请求参数、套餐升级请求等
    """
    
    @staticmethod
    def validate_plan_upgrade(
        tenant_id: Optional[str],
        old_plan: Optional[PlanVersion],
        new_plan: Optional[PlanVersion],
        request_id: Optional[str] = None
    ) -> ValidationResult:
        """验证套餐升级请求"""
        errors: List[ValidationError] = []
        
        if not tenant_id or not tenant_id.strip():
            errors.append(ValidationError(
                field="tenant_id",
                message="租户ID不能为空",
                code="missing_tenant_id"
            ))
        
        if not old_plan:
            errors.append(ValidationError(
                field="old_plan",
                message="旧套餐信息不能为空",
                code="missing_old_plan"
            ))
        
        if not new_plan:
            errors.append(ValidationError(
                field="new_plan",
                message="新套餐信息不能为空",
                code="missing_new_plan"
            ))
        
        if old_plan and new_plan:
            if old_plan.plan_id == new_plan.plan_id and old_plan.version == new_plan.version:
                errors.append(ValidationError(
                    field="plan",
                    message="新旧套餐不能相同",
                    code="same_plan"
                ))
            
            if not new_plan.is_active:
                errors.append(ValidationError(
                    field="new_plan",
                    message="新套餐未激活",
                    code="inactive_plan"
                ))
        
        if not new_plan or (new_plan and all(v <= 0 for v in new_plan.quotas.values())):
            errors.append(ValidationError(
                field="quotas",
                message="新套餐没有有效的限额配置",
                code="invalid_quotas"
            ))
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors
        )
    
    @staticmethod
    def validate_quota_values(quotas: dict) -> ValidationResult:
        """验证限额值"""
        errors: List[ValidationError] = []
        
        if not quotas:
            return ValidationResult(is_valid=True, errors=[])
        
        for quota_type_str, value in quotas.items():
            try:
                quota_type = QuotaType(quota_type_str)
            except ValueError:
                errors.append(ValidationError(
                    field="quota_type",
                    message=f"无效的限额类型: {quota_type_str}",
                    code="invalid_quota_type"
                ))
                continue
            
            if not isinstance(value, int) or value < 0:
                errors.append(ValidationError(
                    field=f"quotas.{quota_type_str}",
                    message=f"限额值必须是非负整数，当前值: {value}",
                    code="invalid_quota_value"
                ))
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors
        )
    
    @staticmethod
    def validate_manual_adjustment(
        tenant_id: Optional[str],
        quota_type: Optional[str],
        new_value: Optional[int],
        operator_id: Optional[str]
    ) -> ValidationResult:
        """验证人工调整请求"""
        errors: List[ValidationError] = []
        
        if not tenant_id or not tenant_id.strip():
            errors.append(ValidationError(
                field="tenant_id",
                message="租户ID不能为空",
                code="missing_tenant_id"
            ))
        
        if not quota_type:
            errors.append(ValidationError(
                field="quota_type",
                message="限额类型不能为空",
                code="missing_quota_type"
            ))
        else:
            try:
                QuotaType(quota_type)
            except ValueError:
                errors.append(ValidationError(
                    field="quota_type",
                    message=f"无效的限额类型: {quota_type}",
                    code="invalid_quota_type"
                ))
        
        if new_value is None:
            errors.append(ValidationError(
                field="new_value",
                message="新限额值不能为空",
                code="missing_new_value"
            ))
        elif not isinstance(new_value, int) or new_value < 0:
            errors.append(ValidationError(
                field="new_value",
                message=f"限额值必须是非负整数，当前值: {new_value}",
                code="invalid_new_value"
            ))
        
        if not operator_id or not operator_id.strip():
            errors.append(ValidationError(
                field="operator_id",
                message="操作人ID不能为空",
                code="missing_operator_id"
            ))
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors
        )
    
    @staticmethod
    def check_duplicate_request(
        request_id: Optional[str],
        existing_transaction
    ) -> Tuple[bool, Optional[str]]:
        """检查重复请求
        返回: (是否重复, 已存在的事务ID)
        """
        if not request_id:
            return False, None
        
        if existing_transaction:
            return True, existing_transaction.transaction_id
        
        return False, None
    
    @staticmethod
    def check_downgrade_safety(
        old_bucket: QuotaBucket,
        new_plan: PlanVersion
    ) -> Tuple[bool, List[QuotaType]]:
        """检查降级安全性
        当降级时，如果已使用量超过新套餐限额，需要添加缓冲
        返回: (是否安全, 需要缓冲的限额类型列表)
        """
        unsafe_types: List[QuotaType] = []
        
        for quota_type in QuotaType:
            used = old_bucket.get_usage(quota_type)
            new_quota = new_plan.get_quota(quota_type)
            
            if used > new_quota:
                unsafe_types.append(quota_type)
        
        return len(unsafe_types) == 0, unsafe_types
