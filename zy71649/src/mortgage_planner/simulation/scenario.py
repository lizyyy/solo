"""情景对比模块"""

from datetime import date
from typing import Optional, List, Dict, Any
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

from ..models.loan import LoanContract
from ..models.budget import Budget
from ..models.penalty import PenaltyRule
from ..models.goal import ClientGoal, PrepayStrategy, Priority
from ..models.repayment import RepaymentRecord
from ..engine.calculator import (
    simulate_prepayment,
    get_repayment_summary,
    PrepayResult,
    RepaymentSummary,
    calculate_monthly_payment,
)
from ..engine.penalty_calculator import calculate_penalty
from ..engine.cashflow_analyzer import analyze_cashflow, CashflowAnalysis
from .constraints import (
    check_all_constraints,
    ConstraintCheck,
    get_critical_issues,
    get_failed_constraints,
)
from ..exceptions.handler import ExceptionHandler


D = Decimal
ROUND = lambda x: D(x).quantize(D("0.01"), rounding="ROUND_HALF_UP")


class ScenarioStatus(str, Enum):
    """情景状态"""
    DRAFT = "draft"
    VIABLE = "viable"
    OPTIMAL = "optimal"
    REJECTED = "rejected"


class Scenario(BaseModel):
    """提前还款情景"""
    id: str
    name: str
    description: Optional[str] = None
    strategy: PrepayStrategy
    prepay_amount: Decimal = Field(gt=0)
    prepay_date: date = Field(default_factory=date.today)
    paid_months: int = Field(ge=0)
    penalty_amount: Decimal = Field(default=Decimal("0"),)
    total_cost: Decimal = Field()
    result: Optional[PrepayResult] = None
    summary: Optional[RepaymentSummary] = None
    cashflow_analysis: Optional[CashflowAnalysis] = None
    constraints: List[ConstraintCheck] = Field(default_factory=list)
    score: Optional[float] = None
    status: ScenarioStatus = ScenarioStatus.DRAFT
    created_at: date = Field(default_factory=date.today)

    @property
    def is_viable(self) -> bool:
        """是否可行"""
        critical = get_critical_issues(self.constraints)
        return len(critical) == 0

    @property
    def issues_count(self) -> int:
        """问题数量"""
        return len(get_failed_constraints(self.constraints))


class ScenarioResult(BaseModel):
    """情景对比结果"""
    model_config = {"arbitrary_types_allowed": True}

    scenarios: List[Scenario]
    optimal_scenario: Optional[Scenario] = None
    comparison_table: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    exception_handler: Optional[ExceptionHandler] = None


def create_scenario(
    name: str,
    strategy: PrepayStrategy,
    prepay_amount: Decimal,
    loan: LoanContract,
    paid_months: int,
    penalty_rule: Optional[PenaltyRule] = None,
    budget: Optional[Budget] = None,
    goal: Optional[ClientGoal] = None,
    existing_records: Optional[List[RepaymentRecord]] = None,
    description: Optional[str] = None,
    exception_handler: Optional[ExceptionHandler] = None,
) -> Scenario:
    """创建并评估一个情景"""
    from uuid import uuid4

    if exception_handler is None:
        exception_handler = ExceptionHandler()

    summary = get_repayment_summary(loan, paid_months, existing_records)

    penalty_amount = D("0")
    if penalty_rule:
        try:
            penalty_amount = calculate_penalty(
                penalty_rule,
                loan,
                prepay_amount,
                paid_months,
                remaining_principal=summary.remaining_principal,
            )
        except Exception as e:
            exception_handler.handle_exception(e)

    total_cost = ROUND(prepay_amount + penalty_amount)

    result = None
    try:
        result = simulate_prepayment(
            loan=loan,
            prepay_amount=prepay_amount,
            strategy=strategy,
            paid_months=paid_months,
            penalty_amount=penalty_amount,
            existing_records=existing_records,
        )
    except Exception as e:
        exception_handler.handle_exception(e)

    cashflow_analysis = None
    if budget and result:
        try:
            cashflow_analysis = analyze_cashflow(budget, loan, result, summary)
        except Exception as e:
            exception_handler.handle_exception(e)

    constraints = check_all_constraints(
        loan=loan,
        prepay_result=result,
        summary=summary,
        paid_months=paid_months,
        strategy_name=strategy.value,
        penalty_rule=penalty_rule,
        budget=budget,
        goal=goal,
    )

    scenario = Scenario(
        id=uuid4().hex[:8],
        name=name,
        description=description,
        strategy=strategy,
        prepay_amount=ROUND(prepay_amount),
        penalty_amount=ROUND(penalty_amount),
        total_cost=total_cost,
        result=result,
        summary=summary,
        cashflow_analysis=cashflow_analysis,
        constraints=constraints,
        paid_months=paid_months,
    )

    scenario.score = _calculate_score(scenario, goal)

    if scenario.is_viable and scenario.issues_count == 0:
        scenario.status = ScenarioStatus.VIABLE
    elif not scenario.is_viable:
        scenario.status = ScenarioStatus.REJECTED

    return scenario


def _calculate_score(scenario: Scenario, goal: Optional[ClientGoal]) -> float:
    """计算情景得分（0-100分）"""
    if not scenario.result:
        return 0

    score = 100
    result = scenario.result
    issues = get_failed_constraints(scenario.constraints)
    critical = get_critical_issues(scenario.constraints)

    if critical:
        return 0

    for issue in issues:
        if issue.severity == "warning":
            score -= 10

    if goal:
        if goal.priority == Priority.INTEREST_SAVING:
            if result.interest_saved > 0:
                bonus = min(20, float(result.interest_saved / D("10000")))
                score += bonus
        elif goal.priority == Priority.CASHFLOW_FRIENDLY:
            if result.cashflow_impact > 0:
                bonus = min(20, float(result.cashflow_impact / D("500")))
                score += bonus
        elif goal.priority == Priority.EARLY_PAYOFF:
            if result.months_saved > 0:
                bonus = min(20, float(result.months_saved / 12))
                score += bonus

    return min(100, max(0, score))


def generate_default_scenarios(
    loan: LoanContract,
    paid_months: int,
    goal: Optional[ClientGoal] = None,
    budget: Optional[Budget] = None,
    penalty_rule: Optional[PenaltyRule] = None,
    existing_records: Optional[List[RepaymentRecord]] = None,
    exception_handler: Optional[ExceptionHandler] = None,
) -> List[Scenario]:
    """生成默认情景组合"""
    scenarios: List[Scenario] = []
    summary = get_repayment_summary(loan, paid_months, existing_records)
    remaining = summary.remaining_principal

    amounts = []
    strategies = [PrepayStrategy.SHORTEN_TERM, PrepayStrategy.REDUCE_PAYMENT]

    if goal and goal.prepay_amount:
        amounts.append(goal.prepay_amount)
    else:
        if budget and budget.available_cash:
            max_amount = budget.get_max_prepay_amount()
            if max_amount > 0:
                amounts.append(min(max_amount, remaining * D("0.3")))
                amounts.append(min(max_amount, remaining * D("0.5")))
                if max_amount >= remaining:
                    amounts.append(remaining)
        else:
            amounts.append(remaining * D("0.3"))
            amounts.append(remaining * D("0.5"))
            amounts.append(remaining)

    amounts = sorted(list(set([ROUND(a) for a in amounts if a > 0])))

    for strategy in strategies:
        for amount in amounts:
            strategy_name = "缩短期限" if strategy == PrepayStrategy.SHORTEN_TERM else "减少月供"
            name = f"{strategy_name} - {_format_amount(amount)}元"
            desc = f"提前还款{_format_amount(amount)}元，采用{strategy_name}方式"

            scenario = create_scenario(
                name=name,
                strategy=strategy,
                prepay_amount=amount,
                loan=loan,
                paid_months=paid_months,
                penalty_rule=penalty_rule,
                budget=budget,
                goal=goal,
                existing_records=existing_records,
                description=desc,
                exception_handler=exception_handler,
            )
            scenarios.append(scenario)

    return scenarios


def compare_scenarios(
    scenarios: List[Scenario],
    goal: Optional[ClientGoal] = None,
) -> ScenarioResult:
    """对比多个情景"""
    viable_scenarios = [s for s in scenarios if s.status != ScenarioStatus.REJECTED]

    for scenario in viable_scenarios:
        if scenario.score is not None and scenario.status == ScenarioStatus.VIABLE:
            scenario.status = ScenarioStatus.OPTIMAL
            break

    optimal = max(
        (s for s in viable_scenarios if s.score is not None),
        key=lambda s: s.score or 0,
        default=None,
    )

    if optimal:
        optimal.status = ScenarioStatus.OPTIMAL

    comparison_table = _build_comparison_table(scenarios)
    recommendations = _generate_recommendations(scenarios, optimal, goal)

    return ScenarioResult(
        scenarios=scenarios,
        optimal_scenario=optimal,
        comparison_table=comparison_table,
        recommendations=recommendations,
    )


def _build_comparison_table(scenarios: List[Scenario]) -> List[Dict[str, Any]]:
    """构建对比表格"""
    table = []
    for s in scenarios:
        r = s.result
        row = {
            "情景名称": s.name,
            "策略": _strategy_label(s.strategy),
            "提前还款额": _format_amount(s.prepay_amount),
            "违约金": _format_amount(s.penalty_amount),
            "总成本": _format_amount(s.total_cost),
            "新月供": _format_amount(r.new_monthly_payment) if r and r.new_monthly_payment else "-",
            "月供变化": _format_amount(r.cashflow_impact) if r else "-",
            "节省利息": _format_amount(r.interest_saved) if r else "-",
            "节省期数": f"{r.months_saved}个月" if r else "-",
            "新到期日": r.new_maturity_date.isoformat() if r and r.new_maturity_date else "-",
            "得分": f"{s.score:.0f}" if s.score else "-",
            "问题数": s.issues_count,
            "状态": _status_label(s.status),
        }
        table.append(row)
    return table


def _generate_recommendations(
    scenarios: List[Scenario],
    optimal: Optional[Scenario],
    goal: Optional[ClientGoal],
) -> List[str]:
    """生成建议"""
    recommendations: List[str] = []

    viable = [s for s in scenarios if s.status != ScenarioStatus.REJECTED]
    rejected = [s for s in scenarios if s.status == ScenarioStatus.REJECTED]

    if rejected:
        recommendations.append(f"⚠️ 有 {len(rejected)} 个方案因严重问题被排除")

    if not viable:
        recommendations.append("❌ 当前无可行方案，建议调整提前还款金额或策略")
        return recommendations

    if optimal:
        if goal and goal.priority:
            priority_label = {
                "interest_saving": "利息节省优先",
                "cashflow_friendly": "现金流友好优先",
                "balanced": "平衡考虑",
                "early_payoff": "尽早结清优先",
            }.get(goal.priority.value, "综合评估")
            recommendations.append(
                f"🏆 推荐方案: '{optimal.name}'（基于{priority_label}评估，得分 {optimal.score:.0f}）"
            )
        else:
            recommendations.append(
                f"🏆 推荐方案: '{optimal.name}'（综合得分 {optimal.score:.0f}）"
            )

    for s in viable:
        if s.status == ScenarioStatus.OPTIMAL:
            continue
        if s.result and s.result.interest_saved > 0:
            recommendations.append(
                f"📊 备选方案: '{s.name}' 可节省利息 {_format_amount(s.result.interest_saved)} 元"
            )

    return recommendations


def _format_amount(amount: Optional[Decimal]) -> str:
    """格式化金额"""
    if amount is None:
        return "-"
    if abs(amount) >= D("10000"):
        return f"{float(amount / D('10000')):.1f}万"
    return f"{float(amount):,.0f}"


def _strategy_label(strategy: PrepayStrategy) -> str:
    """策略标签"""
    return {
        PrepayStrategy.SHORTEN_TERM: "缩短期限",
        PrepayStrategy.REDUCE_PAYMENT: "减少月供",
        PrepayStrategy.MIXED: "混合方式",
        PrepayStrategy.LUMP_SUM: "一次性结清",
    }.get(strategy, strategy.value)


def _status_label(status: ScenarioStatus) -> str:
    """状态标签"""
    return {
        ScenarioStatus.DRAFT: "⚪ 草稿",
        ScenarioStatus.VIABLE: "🟢 可行",
        ScenarioStatus.OPTIMAL: "🏆 最优",
        ScenarioStatus.REJECTED: "🔴 排除",
    }.get(status, status.value)
