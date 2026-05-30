"""违约金计算引擎"""

from datetime import date
from typing import Optional
from decimal import Decimal, ROUND_HALF_UP

from ..models.penalty import PenaltyRule, PenaltyType
from ..models.loan import LoanContract
from .calculator import calculate_monthly_payment

D = Decimal
ROUND = lambda x: D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)
ROUND4 = lambda x: D(x).quantize(D("0.0001"), rounding=ROUND_HALF_UP)


def calculate_penalty(
    penalty_rule: PenaltyRule,
    loan: LoanContract,
    prepay_amount: Decimal,
    paid_months: int,
    prepay_date: Optional[date] = None,
    remaining_principal: Optional[Decimal] = None,
) -> Decimal:
    """
    计算提前还款违约金

    Args:
        penalty_rule: 违约金规则
        loan: 贷款合同
        prepay_amount: 提前还款金额
        paid_months: 已还款月数
        prepay_date: 提前还款日期
        remaining_principal: 剩余本金（可选，未提供时自动计算）

    Returns:
        违约金金额
    """
    if prepay_date is None:
        prepay_date = date.today()

    if not penalty_rule.is_applicable(prepay_date):
        return D("0")

    if paid_months < penalty_rule.min_months_to_prepay:
        raise ValueError(
            f"还款未满{penalty_rule.min_months_to_prepay}个月，不允许提前还款"
        )

    if prepay_amount < penalty_rule.min_prepay_amount:
        raise ValueError(
            f"提前还款金额不能低于最低限额: {penalty_rule.min_prepay_amount}元"
        )

    penalty_type = penalty_rule.penalty_type
    penalty_value = penalty_rule.penalty_value

    if penalty_type == PenaltyType.TIERED:
        tier = penalty_rule.get_applicable_tier(paid_months)
        if tier is None:
            return D("0")
        penalty_type = tier.penalty_type
        penalty_value = tier.penalty_value

    monthly_payment = calculate_monthly_payment(
        loan.loan_amount,
        loan.annual_interest_rate,
        loan.loan_term_months,
    )

    if penalty_type == PenaltyType.NO_PENALTY:
        return D("0")

    elif penalty_type == PenaltyType.FIXED_AMOUNT:
        return ROUND(penalty_value)

    elif penalty_type == PenaltyType.PRINCIPAL_RATIO:
        return ROUND(prepay_amount * penalty_value)

    elif penalty_type == PenaltyType.INTEREST_MONTHS:
        months = int(penalty_value)
        if remaining_principal is not None:
            interest = ROUND(remaining_principal * loan.monthly_rate * months)
        else:
            interest = ROUND(monthly_payment * months * D("0.7"))
        return interest

    raise ValueError(f"未知的违约金类型: {penalty_type}")


def get_penalty_description(
    penalty_rule: PenaltyRule,
    paid_months: int,
    prepay_amount: Decimal,
) -> str:
    """获取违约金计算说明"""
    if penalty_rule.penalty_type == PenaltyType.TIERED:
        tier = penalty_rule.get_applicable_tier(paid_months)
        if tier is None:
            return "当前还款期数不适用违约金规则"
        penalty_type = tier.penalty_type
        penalty_value = tier.penalty_value
        max_months_str = str(tier.max_months) if tier.max_months else "无限"
        tier_desc = f"适用阶梯: {tier.description or f'{tier.min_months}-{max_months_str}个月'}"
    else:
        penalty_type = penalty_rule.penalty_type
        penalty_value = penalty_rule.penalty_value
        tier_desc = ""

    descriptions = {
        PenaltyType.NO_PENALTY: "无违约金",
        PenaltyType.FIXED_AMOUNT: f"固定违约金 {penalty_value} 元",
        PenaltyType.PRINCIPAL_RATIO: f"按提前还款金额的 {float(penalty_value) * 100:.2f}% 收取，"
                                    f"即 {prepay_amount} × {penalty_value} = {ROUND(prepay_amount * penalty_value)} 元",
        PenaltyType.INTEREST_MONTHS: f"收取 {int(penalty_value)} 个月利息作为违约金",
    }

    base_desc = descriptions.get(penalty_type, f"未知类型: {penalty_type}")
    return f"{tier_desc}\n{base_desc}" if tier_desc else base_desc
