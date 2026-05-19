from typing import Dict
from .base import BaseRule, RuleResult
from .context import ApplicationContext, ApprovalContext
from models import ExceptionType, ApplicationStatus, ApprovalResult


class StockValidationRule(BaseRule[ApplicationContext]):
    def __init__(self):
        super().__init__("库存校验", "检查申请数量是否超过可用库存")

    def apply(self, context: ApplicationContext) -> RuleResult:
        inventory_map: Dict[str, float] = {}
        for inv in context.inventories:
            if inv.reagent_id not in inventory_map:
                inventory_map[inv.reagent_id] = 0
            inventory_map[inv.reagent_id] += inv.available_quantity

        for item in context.items:
            available = inventory_map.get(item.reagent_id, 0)
            if item.quantity > available:
                return RuleResult.fail(
                    ExceptionType.INSUFFICIENT_STOCK,
                    f"试剂 {item.reagent_name} 库存不足，申请数量: {item.quantity}, 可用数量: {available}",
                    blocking=True
                )
        return RuleResult.success()


class QuantityValidationRule(BaseRule[ApplicationContext]):
    def __init__(self):
        super().__init__("数量校验", "检查申请数量是否合法")

    def apply(self, context: ApplicationContext) -> RuleResult:
        for item in context.items:
            if item.quantity <= 0:
                return RuleResult.fail(
                    ExceptionType.INVALID_QUANTITY,
                    f"试剂 {item.reagent_name} 申请数量必须大于0，当前数量: {item.quantity}",
                    blocking=True
                )
        return RuleResult.success()


class ApplicationNotEmptyRule(BaseRule[ApplicationContext]):
    def __init__(self):
        super().__init__("申请非空校验", "检查申请单是否包含试剂")

    def apply(self, context: ApplicationContext) -> RuleResult:
        if not context.items:
            return RuleResult.fail(
                ExceptionType.INVALID_QUANTITY,
                "申请单必须包含至少一种试剂",
                blocking=True
            )
        return RuleResult.success()


class ApplicationStatusRule(BaseRule[ApplicationContext]):
    def __init__(self):
        super().__init__("申请状态校验", "检查申请单状态是否允许提交")

    def apply(self, context: ApplicationContext) -> RuleResult:
        allowed_statuses = [ApplicationStatus.DRAFT, ApplicationStatus.REJECTED]
        if context.application.status not in allowed_statuses:
            return RuleResult.fail(
                ExceptionType.INVALID_QUANTITY,
                f"申请单当前状态为 {context.application.status.value}，不允许提交",
                blocking=True
            )
        return RuleResult.success()


class ApprovalAuthorityRule(BaseRule[ApprovalContext]):
    def __init__(self):
        super().__init__("审批权限校验", "检查审批人是否重复审批")

    def apply(self, context: ApprovalContext) -> RuleResult:
        approver_id = context.approval_record.approver_id
        for approval in context.existing_approvals:
            if approval.approver_id == approver_id and approval.result == ApprovalResult.APPROVED:
                return RuleResult.fail(
                    ExceptionType.DANGER_GOODS_UNAPPROVED,
                    "不能重复审批同一申请单",
                    blocking=True
                )
        return RuleResult.success()


class DoubleApprovalRule(BaseRule[ApprovalContext]):
    def __init__(self):
        super().__init__("双人审批校验", "危险品需要双人审批")

    def apply(self, context: ApprovalContext) -> RuleResult:
        if not context.requires_double_approval:
            return RuleResult.success()
        
        approved_count = sum(
            1 for a in context.existing_approvals 
            if a.result == ApprovalResult.APPROVED
        )
        
        if context.approval_record.result == ApprovalResult.APPROVED:
            if approved_count == 0:
                return RuleResult.success()
            elif approved_count == 1:
                return RuleResult.success()
        
        return RuleResult.success()


class RejectionWithReasonRule(BaseRule[ApprovalContext]):
    def __init__(self):
        super().__init__("驳回原因校验", "驳回必须提供原因")

    def apply(self, context: ApprovalContext) -> RuleResult:
        if context.approval_record.result == ApprovalResult.REJECTED:
            if not context.approval_record.comment:
                return RuleResult.fail(
                    ExceptionType.INVALID_QUANTITY,
                    "驳回申请必须提供驳回原因",
                    blocking=True
                )
        return RuleResult.success()


def create_application_rules() -> list:
    return [
        ApplicationNotEmptyRule(),
        ApplicationStatusRule(),
        QuantityValidationRule(),
        StockValidationRule(),
    ]


def create_approval_rules() -> list:
    return [
        ApprovalAuthorityRule(),
        RejectionWithReasonRule(),
        DoubleApprovalRule(),
    ]
