"""约束检查模块"""

from datetime import date
from enum import Enum
from typing import List, Optional, Callable
from decimal import Decimal

from pydantic import BaseModel, Field

from ..models.loan import LoanContract
from ..models.budget import Budget
from ..models.penalty import PenaltyRule
from ..models.goal import ClientGoal
from ..engine.calculator import PrepayResult, RepaymentSummary, get_repayment_summary
from ..engine.penalty_calculator import calculate_penalty
from ..engine.cashflow_analyzer import analyze_cashflow
from ..exceptions.base import ErrorContext
from ..exceptions.rule_errors import (
    PrepayTooEarlyError,
    PrepayAmountTooSmallError,
    CashflowNegativeError,
    PenaltyExceedsSavingError,
)
from ..exceptions.material_errors import (
    BudgetMissingError,
    PenaltyRuleMissingError,
)


D = Decimal
ROUND = lambda x: D(x).quantize(D("0.01"), rounding="ROUND_HALF_UP")


class ConstraintType(str, Enum):
    """约束类型"""
    PREPAY_PERIOD = "prepay_period"
    PREPAY_AMOUNT = "prepay_amount"
    CASHFLOW = "cashflow"
    PENALTY_ECONOMIC = "penalty_economic"
    EMERGENCY_FUND = "emergency_fund"
    DEBT_RATIO = "debt_ratio"
    GOAL_ALIGNMENT = "goal_alignment"


class ConstraintCheck(BaseModel):
    """约束检查结果"""
    constraint_type: ConstraintType
    passed: bool
    severity: str = "info"
    message: str
    suggestion: Optional[str] = None
    details: Optional[dict] = None

    @property
    def icon(self) -> str:
        if self.passed:
            return "✅"
        if self.severity == "critical":
            return "🔴"
        if self.severity == "warning":
            return "🟡"
        return "ℹ️"


def check_prepay_period_constraint(
    penalty_rule: Optional[PenaltyRule],
    paid_months: int,
) -> ConstraintCheck:
    """检查提前还款期限约束"""
    if penalty_rule is None:
        return ConstraintCheck(
            constraint_type=ConstraintType.PREPAY_PERIOD,
            passed=True,
            severity="warning",
            message="未配置违约金规则，已跳过提前还款期限检查",
            suggestion="建议导入违约金规则以确保计算准确",
        )

    if paid_months < penalty_rule.min_months_to_prepay:
        exc = PrepayTooEarlyError(paid_months, penalty_rule.min_months_to_prepay)
        return ConstraintCheck(
            constraint_type=ConstraintType.PREPAY_PERIOD,
            passed=False,
            severity="warning",
            message=exc.message,
            suggestion=exc.context.suggestions[0] if exc.context.suggestions else None,
        )

    return ConstraintCheck(
        constraint_type=ConstraintType.PREPAY_PERIOD,
        passed=True,
        message=f"已还款 {paid_months} 个月，满足最低 {penalty_rule.min_months_to_prepay} 个月要求",
    )


def check_prepay_amount_constraint(
    penalty_rule: Optional[PenaltyRule],
    prepay_amount: Decimal,
) -> ConstraintCheck:
    """检查提前还款金额约束"""
    if penalty_rule is None:
        return ConstraintCheck(
            constraint_type=ConstraintType.PREPAY_AMOUNT,
            passed=True,
            severity="warning",
            message="未配置违约金规则，已跳过提前还款金额检查",
            suggestion="建议导入违约金规则以确保计算准确",
        )

    if prepay_amount < penalty_rule.min_prepay_amount:
        exc = PrepayAmountTooSmallError(prepay_amount, penalty_rule.min_prepay_amount)
        return ConstraintCheck(
            constraint_type=ConstraintType.PREPAY_AMOUNT,
            passed=False,
            severity="warning",
            message=exc.message,
            suggestion=exc.context.suggestions[0] if exc.context.suggestions else None,
        )

    return ConstraintCheck(
        constraint_type=ConstraintType.PREPAY_AMOUNT,
        passed=True,
        message=f"提前还款金额 {prepay_amount} 元，满足最低 {penalty_rule.min_prepay_amount} 元要求",
    )


def check_cashflow_constraint(
    budget: Optional[Budget],
    loan: LoanContract,
    prepay_result: PrepayResult,
    summary: RepaymentSummary,
) -> ConstraintCheck:
    """检查现金流约束"""
    if budget is None:
        return ConstraintCheck(
            constraint_type=ConstraintType.CASHFLOW,
            passed=True,
            severity="warning",
            message="未配置预算数据，已跳过现金流压力测试",
            suggestion="建议导入预算数据以进行完整的现金流分析",
        )

    cashflow = analyze_cashflow(budget, loan, prepay_result, summary)

    if cashflow.has_negative_cashflow:
        first_negative = cashflow.negative_months[0]
        exc = CashflowNegativeError(first_negative, cashflow.min_surplus)
        return ConstraintCheck(
            constraint_type=ConstraintType.CASHFLOW,
            passed=False,
            severity="critical",
            message=exc.message,
            suggestion=exc.context.suggestions[0] if exc.context.suggestions else None,
            details={"negative_months": [m.isoformat() for m in cashflow.negative_months]},
        )

    risk_color = "🟢" if "低风险" in cashflow.risk_level else ("🟡" if "中风险" in cashflow.risk_level else "🔴")
    severity = "info" if "低风险" in cashflow.risk_level else ("warning" if "中风险" in cashflow.risk_level else "critical")

    return ConstraintCheck(
        constraint_type=ConstraintType.CASHFLOW,
        passed="低风险" in cashflow.risk_level,
        severity=severity,
        message=f"{risk_color} 现金流风险评估: {cashflow.risk_level}",
        suggestion=cashflow.recommendations[0] if cashflow.recommendations else None,
        details={
            "min_surplus": float(cashflow.min_surplus),
            "avg_surplus": float(cashflow.avg_surplus),
            "emergency_fund_remaining": float(cashflow.emergency_fund_remaining),
        },
    )


def check_penalty_constraint(
    prepay_result: PrepayResult,
) -> ConstraintCheck:
    """检查违约金经济性约束"""
    if prepay_result.penalty_amount == 0:
        return ConstraintCheck(
            constraint_type=ConstraintType.PENALTY_ECONOMIC,
            passed=True,
            message="无违约金，经济上可行",
        )

    if prepay_result.interest_saved < prepay_result.penalty_amount:
        exc = PenaltyExceedsSavingError(prepay_result.penalty_amount, prepay_result.interest_saved)
        return ConstraintCheck(
            constraint_type=ConstraintType.PENALTY_ECONOMIC,
            passed=False,
            severity="warning",
            message=exc.message,
            suggestion=exc.context.suggestions[0] if exc.context.suggestions else None,
            details={
                "penalty": float(prepay_result.penalty_amount),
                "interest_saved": float(prepay_result.interest_saved),
                "ratio": float(prepay_result.penalty_amount / prepay_result.interest_saved) if prepay_result.interest_saved > 0 else None,
            },
        )

    ratio = float(prepay_result.interest_saved / prepay_result.penalty_amount) if prepay_result.penalty_amount > 0 else float("inf")
    return ConstraintCheck(
        constraint_type=ConstraintType.PENALTY_ECONOMIC,
        passed=True,
        message=f"💡 经济可行: 节省利息 {prepay_result.interest_saved} 元 / 违约金 {prepay_result.penalty_amount} 元 = {ratio:.1f}x",
    )


def check_emergency_fund_constraint(
    budget: Optional[Budget],
    prepay_result: PrepayResult,
    emergency_months: int = 6,
) -> ConstraintCheck:
    """检查紧急预备金约束"""
    if budget is None or budget.available_cash is None or budget.monthly_household_expense == 0:
        return ConstraintCheck(
            constraint_type=ConstraintType.EMERGENCY_FUND,
            passed=True,
            severity="warning",
            message="预算数据不完整，已跳过紧急预备金检查",
            suggestion="建议补充完整的预算数据",
        )

    emergency_need = budget.monthly_household_expense * D(str(emergency_months))
    remaining = budget.available_cash - prepay_result.total_cost
    remaining_after_emergency = remaining - emergency_need

    if remaining_after_emergency < 0:
        return ConstraintCheck(
            constraint_type=ConstraintType.EMERGENCY_FUND,
            passed=False,
            severity="critical",
            message=f"🔴 提前还款后紧急预备金不足: 需要 {emergency_need} 元，缺口 {abs(remaining_after_emergency)} 元",
            suggestion="建议降低提前还款金额，或延后至预备金充足后再操作",
            details={
                "available_cash": float(budget.available_cash),
                "prepay_cost": float(prepay_result.total_cost),
                "emergency_need": float(emergency_need),
                "remaining": float(remaining),
            },
        )

    months_covered = float(remaining / budget.monthly_household_expense) if budget.monthly_household_expense > 0 else 0
    return ConstraintCheck(
        constraint_type=ConstraintType.EMERGENCY_FUND,
        passed=True,
        message=f"✅ 紧急预备金充足: 提前还款后剩余可用资金 {remaining} 元，约可覆盖 {months_covered:.1f} 个月支出",
    )


def check_debt_ratio_constraint(
    budget: Optional[Budget],
    prepay_result: PrepayResult,
) -> ConstraintCheck:
    """检查债务收入比约束"""
    if budget is None or budget.monthly_household_income == 0:
        return ConstraintCheck(
            constraint_type=ConstraintType.DEBT_RATIO,
            passed=True,
            severity="warning",
            message="收入数据缺失，已跳过债务收入比检查",
            suggestion="建议补充月收入数据",
        )

    new_payment = prepay_result.new_monthly_payment or budget.monthly_mortgage_payment
    ratio = float(new_payment / budget.monthly_household_income)

    if ratio > 0.5:
        return ConstraintCheck(
            constraint_type=ConstraintType.DEBT_RATIO,
            passed=False,
            severity="warning",
            message=f"🟡 债务收入比偏高: {ratio * 100:.1f}% (建议不超过50%)",
            suggestion="建议选择'减少月供'方式降低债务压力",
        )
    elif ratio > 0.3:
        return ConstraintCheck(
            constraint_type=ConstraintType.DEBT_RATIO,
            passed=True,
            severity="warning",
            message=f"⚠️ 债务收入比: {ratio * 100:.1f}% (处于合理区间上限)",
        )

    return ConstraintCheck(
        constraint_type=ConstraintType.DEBT_RATIO,
        passed=True,
        message=f"✅ 债务收入比健康: {ratio * 100:.1f}%",
    )


def check_goal_alignment_constraint(
    goal: Optional[ClientGoal],
    prepay_result: PrepayResult,
    strategy_name: str,
) -> ConstraintCheck:
    """检查与客户目标的一致性"""
    if goal is None:
        return ConstraintCheck(
            constraint_type=ConstraintType.GOAL_ALIGNMENT,
            passed=True,
            severity="warning",
            message="未配置客户目标，已跳过目标一致性检查",
            suggestion="建议导入客户目标以生成定制化方案",
        )

    issues = []
    if goal.has_amount_goal and goal.prepay_amount is not None:
        if abs(prepay_result.prepay_amount - goal.prepay_amount) > D("100"):
            issues.append(f"提前还款金额 {prepay_result.prepay_amount} 与目标 {goal.prepay_amount} 不一致")

    if goal.has_payment_goal and goal.target_monthly_payment is not None and prepay_result.new_monthly_payment:
        if abs(prepay_result.new_monthly_payment - goal.target_monthly_payment) > D("100"):
            issues.append(f"新月供 {prepay_result.new_monthly_payment} 与目标 {goal.target_monthly_payment} 不一致")

    if goal.maximum_monthly_payment and prepay_result.new_monthly_payment:
        if prepay_result.new_monthly_payment > goal.maximum_monthly_payment:
            issues.append(f"新月供 {prepay_result.new_monthly_payment} 超过客户可承受上限 {goal.maximum_monthly_payment}")

    if goal.prepay_strategy.value != strategy_name:
        issues.append(f"当前策略 {strategy_name} 与客户偏好 {goal.prepay_strategy.value} 不一致")

    if issues:
        return ConstraintCheck(
            constraint_type=ConstraintType.GOAL_ALIGNMENT,
            passed=False,
            severity="warning",
            message="⚠️ 与客户目标存在差异: " + "; ".join(issues),
            suggestion="建议调整方案参数以匹配客户目标",
        )

    return ConstraintCheck(
        constraint_type=ConstraintType.GOAL_ALIGNMENT,
        passed=True,
        message="✅ 方案与客户目标一致",
    )


def check_all_constraints(
    loan: LoanContract,
    prepay_result: PrepayResult,
    summary: RepaymentSummary,
    paid_months: int,
    strategy_name: str,
    penalty_rule: Optional[PenaltyRule] = None,
    budget: Optional[Budget] = None,
    goal: Optional[ClientGoal] = None,
    emergency_months: int = 6,
) -> List[ConstraintCheck]:
    """执行所有约束检查"""
    checks = [
        check_prepay_period_constraint(penalty_rule, paid_months),
        check_prepay_amount_constraint(penalty_rule, prepay_result.prepay_amount),
        check_penalty_constraint(prepay_result),
        check_cashflow_constraint(budget, loan, prepay_result, summary),
        check_emergency_fund_constraint(budget, prepay_result, emergency_months),
        check_debt_ratio_constraint(budget, prepay_result),
        check_goal_alignment_constraint(goal, prepay_result, strategy_name),
    ]

    return checks


def get_failed_constraints(checks: List[ConstraintCheck]) -> List[ConstraintCheck]:
    """获取未通过的约束检查"""
    return [c for c in checks if not c.passed]


def get_critical_issues(checks: List[ConstraintCheck]) -> List[ConstraintCheck]:
    """获取严重问题"""
    return [c for c in checks if c.severity == "critical" and not c.passed]
