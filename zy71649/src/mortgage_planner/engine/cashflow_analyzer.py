"""现金流分析引擎"""

from datetime import date
from typing import Optional, List
from decimal import Decimal, ROUND_HALF_UP

from pydantic import BaseModel, Field

from ..models.budget import Budget
from ..models.loan import LoanContract
from .calculator import PrepayResult, RepaymentSummary, get_repayment_summary

D = Decimal
ROUND = lambda x: D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)


class CashflowProjection(BaseModel):
    """现金流预测项"""
    month: date
    income: Decimal = Field()
    expenses: Decimal = Field()
    mortgage_payment: Decimal = Field()
    prepayment_amount: Decimal = Field(default=Decimal("0"),)
    penalty_amount: Decimal = Field(default=Decimal("0"),)
    surplus: Decimal = Field()
    cumulative_surplus: Decimal = Field()
    note: Optional[str] = None


class CashflowAnalysis(BaseModel):
    """现金流分析结果"""
    has_negative_cashflow: bool
    negative_months: List[date] = Field(default_factory=list)
    min_surplus: Decimal = Field()
    avg_surplus: Decimal = Field()
    total_prepay_cost: Decimal = Field()
    emergency_fund_remaining: Decimal = Field()
    risk_level: str
    recommendations: List[str] = Field(default_factory=list)
    projections: List[CashflowProjection] = Field(default_factory=list)


def analyze_cashflow(
    budget: Budget,
    loan: LoanContract,
    prepay_result: PrepayResult,
    summary: Optional[RepaymentSummary] = None,
    projection_months: int = 36,
    emergency_months: int = 6,
) -> CashflowAnalysis:
    """
    分析提前还款对现金流的影响

    Args:
        budget: 家庭预算
        loan: 贷款合同
        prepay_result: 提前还款结果
        summary: 还款汇总信息（可选）
        projection_months: 预测月数
        emergency_months: 紧急预备金月数

    Returns:
        现金流分析结果
    """
    if summary is None:
        from .calculator import simulate_prepayment
        summary = get_repayment_summary(loan, paid_months=0)

    total_prepay_cost = prepay_result.total_cost
    available_cash = budget.available_cash or D("0")
    emergency_need = budget.monthly_household_expense * D(str(emergency_months))
    emergency_fund_remaining = ROUND(max(D("0"), available_cash - total_prepay_cost - emergency_need))

    original_monthly_payment = summary.original_monthly_payment
    new_monthly_payment = prepay_result.new_monthly_payment or original_monthly_payment

    projections: List[CashflowProjection] = []
    negative_months: List[date] = []
    surpluses: List[Decimal] = []

    current_date = date.today().replace(day=1)
    cumulative_surplus = ROUND(available_cash - total_prepay_cost)

    for i in range(projection_months):
        month_start = current_date.replace(
            year=current_date.year + (current_date.month + i - 1) // 12,
            month=(current_date.month + i - 1) % 12 + 1,
            day=1
        )

        prepayment_amount = D("0")
        penalty_amount = D("0")
        note = None

        if i == 0:
            prepayment_amount = prepay_result.prepay_amount
            penalty_amount = prepay_result.penalty_amount
            note = f"提前还款 {prepay_result.prepay_amount} 元，违约金 {prepay_result.penalty_amount} 元（从储蓄支付）"

        if prepay_result.new_term_months and i >= prepay_result.new_term_months:
            mortgage_payment = D("0")
            note = "贷款已结清" if note is None else note + "，贷款已结清"
        else:
            mortgage_payment = new_monthly_payment

        monthly_surplus = ROUND(
            budget.monthly_household_income
            - budget.monthly_household_expense
            - mortgage_payment
        )
        cumulative_surplus = ROUND(cumulative_surplus + monthly_surplus)

        if cumulative_surplus < 0:
            negative_months.append(month_start)

        surpluses.append(monthly_surplus)
        projections.append(CashflowProjection(
            month=month_start,
            income=budget.monthly_household_income,
            expenses=budget.monthly_household_expense,
            mortgage_payment=mortgage_payment,
            prepayment_amount=prepayment_amount,
            penalty_amount=penalty_amount,
            surplus=monthly_surplus,
            cumulative_surplus=cumulative_surplus,
            note=note,
        ))

    has_negative = len(negative_months) > 0
    min_surplus = min(surpluses) if surpluses else D("0")
    avg_surplus = ROUND(sum(surpluses) / len(surpluses)) if surpluses else D("0")

    risk_level = _assess_risk_level(
        has_negative,
        min_surplus,
        emergency_fund_remaining,
        emergency_need,
        prepay_result,
    )

    recommendations = _generate_recommendations(
        budget,
        loan,
        prepay_result,
        has_negative,
        min_surplus,
        emergency_fund_remaining,
        emergency_need,
    )

    return CashflowAnalysis(
        has_negative_cashflow=has_negative,
        negative_months=negative_months,
        min_surplus=min_surplus,
        avg_surplus=avg_surplus,
        total_prepay_cost=total_prepay_cost,
        emergency_fund_remaining=emergency_fund_remaining,
        risk_level=risk_level,
        recommendations=recommendations,
        projections=projections,
    )


def _assess_risk_level(
    has_negative: bool,
    min_surplus: Decimal,
    emergency_fund_remaining: Decimal,
    emergency_need: Decimal,
    prepay_result: PrepayResult,
) -> str:
    """评估风险等级"""
    if has_negative:
        return "🔴 高风险 - 出现现金流为负的月份"

    if emergency_fund_remaining < 0:
        return "🔴 高风险 - 紧急预备金不足"

    if min_surplus < D("1000"):
        return "🟡 中风险 - 月度结余较低，抗风险能力弱"

    if emergency_fund_remaining < emergency_need * D("0.5"):
        return "🟡 中风险 - 紧急预备金偏低"

    if prepay_result.interest_saved < prepay_result.penalty_amount:
        return "🟡 中风险 - 节省利息低于违约金，经济上不划算"

    return "🟢 低风险 - 现金流健康，提前还款可行"


def _generate_recommendations(
    budget: Budget,
    loan: LoanContract,
    prepay_result: PrepayResult,
    has_negative: bool,
    min_surplus: Decimal,
    emergency_fund_remaining: Decimal,
    emergency_need: Decimal,
) -> List[str]:
    """生成建议"""
    recommendations: List[str] = []

    if has_negative:
        recommendations.append(
            "⚠️ 提前还款首月可能出现现金流缺口，建议："
            "1) 降低提前还款金额；"
            "2) 延后提前还款时间，先积累足够预备金；"
            "3) 考虑采用'减少月供'方式降低每月还款压力"
        )

    if emergency_fund_remaining < 0:
        recommendations.append(
            f"⚠️ 紧急预备金不足，建议保留至少 {emergency_need} 元（{int(emergency_need / budget.monthly_household_expense)}个月支出）"
            f"作为家庭应急资金，当前提前还款后将出现缺口 {abs(emergency_fund_remaining)} 元"
        )

    if min_surplus < D("1000") and not has_negative:
        recommendations.append(
            f"⚠️ 月度结余仅 {min_surplus} 元，建议适当降低提前还款金额，"
            "保持每月至少2000-3000元的灵活资金应对突发支出"
        )

    if prepay_result.interest_saved < prepay_result.penalty_amount:
        recommendations.append(
            f"⚠️ 经济上不划算：节省利息 {prepay_result.interest_saved} 元 "
            f"< 违约金 {prepay_result.penalty_amount} 元，建议考虑延后提前还款"
        )

    if prepay_result.strategy.value == "shorten_term" and prepay_result.cashflow_impact == 0:
        recommendations.append(
            "💡 选择'缩短期限'方式可最大化节省利息，但月供保持不变，"
            "适合现金流充裕、追求尽早结清的客户"
        )

    if prepay_result.strategy.value == "reduce_payment" and prepay_result.cashflow_impact > 0:
        recommendations.append(
            f"💡 选择'减少月供'方式，每月可减少支出 {prepay_result.cashflow_impact} 元，"
            "适合希望降低月度还款压力、提高资金流动性的客户"
        )

    if prepay_result.penalty_amount > 0 and prepay_result.interest_saved > prepay_result.penalty_amount * D("2"):
        recommendations.append(
            f"✅ 提前还款收益显著，可节省利息 {prepay_result.interest_saved} 元，"
            f"约为违约金的 {float(prepay_result.interest_saved / prepay_result.penalty_amount):.1f} 倍"
        )
    elif prepay_result.penalty_amount == 0 and prepay_result.interest_saved > 0:
        recommendations.append(
            f"✅ 无违约金！提前还款可节省利息 {prepay_result.interest_saved} 元，非常划算"
        )

    if not recommendations:
        recommendations.append("✅ 当前方案可行，建议根据客户实际情况和风险偏好最终确认")

    return recommendations
