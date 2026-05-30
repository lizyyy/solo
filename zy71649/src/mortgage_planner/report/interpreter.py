"""结果解释模块 - 为专业报告提供人性化解释"""

from datetime import date
from typing import Optional, List, Dict, Any
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

from ..models.loan import LoanContract
from ..models.budget import Budget
from ..models.goal import ClientGoal, PrepayStrategy, Priority
from ..engine.calculator import PrepayResult, RepaymentSummary
from ..engine.penalty_calculator import get_penalty_description
from ..engine.cashflow_analyzer import CashflowAnalysis
from ..simulation.scenario import Scenario, ScenarioResult, compare_scenarios
from ..simulation.constraints import ConstraintCheck, get_failed_constraints, get_critical_issues
from ..models.penalty import PenaltyRule


D = Decimal


class ExplanationLevel(str, Enum):
    """解释深度"""
    SIMPLE = "simple"
    STANDARD = "standard"
    DETAILED = "detailed"
    EXPERT = "expert"


class Explanation(BaseModel):
    """解释条目"""
    title: str
    content: str
    level: ExplanationLevel = ExplanationLevel.STANDARD
    category: Optional[str] = None
    importance: int = 5
    data_reference: Optional[Dict[str, Any]] = None


class ResultInterpreter:
    """结果解释器"""

    def __init__(self, level: ExplanationLevel = ExplanationLevel.STANDARD):
        self.level = level

    def explain_loan_summary(
        self,
        loan: LoanContract,
        summary: RepaymentSummary,
        paid_months: int,
    ) -> List[Explanation]:
        """解释贷款汇总信息"""
        explanations: List[Explanation] = []

        explanations.append(Explanation(
            title="贷款基本情况",
            content=(
                f"客户 {loan.customer_name} 于 {loan.start_date.isoformat()} 获得贷款 "
                f"{self._format_amount(loan.loan_amount)} 元，期限 {loan.loan_term_months} 个月 "
                f"（{loan.loan_term_months // 12} 年），年利率 {self._format_rate(loan.annual_interest_rate)}，"
                f"采用{self._repayment_method_label(loan.repayment_method)}方式还款。"
            ),
            category="基本信息",
        ))

        explanations.append(Explanation(
            title="还款进度",
            content=(
                f"截至今日，已还款 {paid_months} 个月，约占总期限的 {paid_months / loan.loan_term_months * 100:.1f}%。"
                f"已还本金 {self._format_amount(summary.total_paid_principal)} 元，"
                f"已付利息 {self._format_amount(summary.total_paid_interest)} 元。"
            ),
            category="还款进度",
        ))

        explanations.append(Explanation(
            title="剩余债务",
            content=(
                f"当前剩余本金 {self._format_amount(summary.remaining_principal)} 元，"
                f"剩余还款期 {summary.remaining_months} 个月。"
                f"如按原计划继续还款，还需支付利息约 {self._format_amount(summary.total_interest_original - summary.total_paid_interest)} 元。"
            ),
            category="剩余债务",
            importance=8,
        ))

        if self.level in [ExplanationLevel.DETAILED, ExplanationLevel.EXPERT]:
            explanations.append(Explanation(
                title="月供构成分析",
                content=(
                    f"原月供 {self._format_amount(summary.original_monthly_payment)} 元。"
                    f"在等额本息还款方式下，前期还款中利息占比较高，本金占比较低。"
                    f"随着还款期数增加，利息占比会逐渐下降，本金占比上升。"
                    f"已还期数 {paid_months} 个月后，当前月供中约 "
                    f"{self._estimate_principal_ratio(summary, paid_months) * 100:.0f}% 为本金。"
                ),
                category="专业分析",
                importance=6,
            ))

        return explanations

    def explain_prepay_result(
        self,
        prepay_result: PrepayResult,
        loan: LoanContract,
        penalty_rule: Optional[PenaltyRule] = None,
        paid_months: int = 0,
        remaining_principal: Optional[Decimal] = None,
    ) -> List[Explanation]:
        """解释提前还款结果"""
        explanations: List[Explanation] = []

        strategy_label = {
            "shorten_term": "缩短期限（月供不变）",
            "reduce_payment": "减少月供（期限不变）",
        }.get(prepay_result.strategy.value, prepay_result.strategy.value)

        explanations.append(Explanation(
            title="提前还款方案概述",
            content=(
                f"本次提前还款 {self._format_amount(prepay_result.prepay_amount)} 元，"
                f"采用「{strategy_label}」方式。"
                f"需支付违约金 {self._format_amount(prepay_result.penalty_amount)} 元，"
                f"合计支出 {self._format_amount(prepay_result.total_cost)} 元。"
            ),
            category="方案概述",
            importance=9,
        ))

        interest_ratio_text = ""
        if remaining_principal and remaining_principal > 0:
            ratio = float(prepay_result.interest_saved / remaining_principal * 100)
            interest_ratio_text = f"约占当前剩余本金的 {ratio:.1f}%。"
        elif prepay_result.prepay_amount > 0:
            ratio = float(prepay_result.interest_saved / prepay_result.prepay_amount * 100)
            interest_ratio_text = f"约为提前还款额的 {ratio:.1f}%。"

        explanations.append(Explanation(
            title="收益分析",
            content=(
                f"提前还款后可节省利息 {self._format_amount(prepay_result.interest_saved)} 元，"
                f"{interest_ratio_text}"
                f"净收益（节省利息 - 违约金）为 {self._format_amount(prepay_result.interest_saved - prepay_result.penalty_amount)} 元。"
            ),
            category="收益分析",
            importance=10,
        ))

        if prepay_result.strategy.value == "shorten_term":
            explanations.append(Explanation(
                title="期限变化",
                content=(
                    f"月供保持 {self._format_amount(prepay_result.new_monthly_payment)} 元不变，"
                    f"还款期限缩短 {prepay_result.months_saved} 个月（{prepay_result.months_saved // 12} 年 {prepay_result.months_saved % 12} 个月）。"
                    f"新的到期日为 {prepay_result.new_maturity_date.isoformat()}。"
                ),
                category="期限变化",
                importance=8,
            ))
        else:
            explanations.append(Explanation(
                title="月供变化",
                content=(
                    f"还款期限不变，月供从原 {self._format_amount(prepay_result.new_monthly_payment and (prepay_result.new_monthly_payment + prepay_result.cashflow_impact))} 元 "
                    f"降至 {self._format_amount(prepay_result.new_monthly_payment)} 元，"
                    f"每月减少支出 {self._format_amount(prepay_result.cashflow_impact)} 元，"
                    f"显著改善月度现金流状况。"
                ),
                category="月供变化",
                importance=8,
            ))

        if penalty_rule and prepay_result.penalty_amount > 0:
            penalty_desc = get_penalty_description(penalty_rule, paid_months, prepay_result.prepay_amount)
            explanations.append(Explanation(
                title="违约金说明",
                content=(
                    f"根据贷款合同约定的违约金规则：\n{penalty_desc}\n\n"
                    f"本次提前还款产生违约金 {self._format_amount(prepay_result.penalty_amount)} 元。"
                    f"违约金占提前还款金额的 {float(prepay_result.penalty_amount / prepay_result.prepay_amount * 100):.2f}%。"
                ),
                category="违约金说明",
                importance=7,
            ))

        if self.level in [ExplanationLevel.DETAILED, ExplanationLevel.EXPERT]:
            roi = self._calculate_roi(prepay_result)
            explanations.append(Explanation(
                title="投资回报分析",
                content=(
                    f"从投资角度看，本次提前还款相当于进行了一笔"
                    f"收益率约为 {roi * 100:.1f}% 的投资（基于节省的利息）。"
                    f"对比当前市场无风险收益率（约2%-3%），"
                    f"{'具有明显的投资价值' if roi > 0.03 else '投资价值一般'}。"
                ),
                category="专业分析",
                importance=5,
                data_reference={"roi": float(roi)},
            ))

        return explanations

    def explain_cashflow_analysis(
        self,
        analysis: CashflowAnalysis,
        budget: Budget,
    ) -> List[Explanation]:
        """解释现金流分析结果"""
        explanations: List[Explanation] = []

        risk_label = "高风险" if "高风险" in analysis.risk_level else ("中风险" if "中风险" in analysis.risk_level else "低风险")

        explanations.append(Explanation(
            title="现金流风险评估",
            content=(
                f"现金流风险等级：{analysis.risk_level}\n\n"
                f"预测期内月度平均结余 {self._format_amount(analysis.avg_surplus)} 元，"
                f"最低月度结余 {self._format_amount(analysis.min_surplus)} 元。"
                f"{'⚠️ 注意：有 ' + str(len(analysis.negative_months)) + ' 个月出现现金流缺口' if analysis.has_negative_cashflow else '✅ 预测期内无现金流缺口。'}"
            ),
            category="风险评估",
            importance=10,
        ))

        explanations.append(Explanation(
            title="紧急预备金情况",
            content=(
                f"提前还款后，预计剩余可用资金 {self._format_amount(analysis.emergency_fund_remaining)} 元。"
                f"按当前月支出 {self._format_amount(budget.monthly_household_expense)} 元计算，"
                f"约可覆盖 {float(analysis.emergency_fund_remaining / budget.monthly_household_expense):.1f} 个月的家庭支出。"
                f"{'建议补充紧急预备金' if analysis.emergency_fund_remaining < budget.monthly_household_expense * 3 else '紧急预备金充足'}"
            ),
            category="预备金分析",
            importance=9,
        ))

        if self.level in [ExplanationLevel.DETAILED, ExplanationLevel.EXPERT]:
            explanations.append(Explanation(
                title="财务健康指标",
                content=(
                    f"债务收入比：{float(budget.debt_service_ratio * 100):.1f}% "
                    f"({'偏高' if budget.debt_service_ratio and budget.debt_service_ratio > 0.5 else '健康'})\n"
                    f"储蓄率：{float(budget.savings_rate * 100):.1f}% "
                    f"({'偏低' if budget.savings_rate and budget.savings_rate < 0.2 else '良好'})"
                ),
                category="财务指标",
                importance=6,
            ))

        for i, rec in enumerate(analysis.recommendations[:3]):
            explanations.append(Explanation(
                title=f"建议 {i + 1}",
                content=rec,
                category="行动建议",
                importance=7 - i,
            ))

        return explanations

    def explain_constraints(
        self,
        constraints: List[ConstraintCheck],
    ) -> List[Explanation]:
        """解释约束检查结果"""
        explanations: List[Explanation] = []

        failed = get_failed_constraints(constraints)
        critical = get_critical_issues(constraints)

        if critical:
            explanations.append(Explanation(
                title="⚠️ 严重问题",
                content=(
                    f"发现 {len(critical)} 个严重问题，可能导致方案不可行：\n"
                    + "\n".join([f"• {c.icon} {c.message}" for c in critical])
                ),
                category="约束检查",
                importance=10,
            ))

        if failed and not critical:
            explanations.append(Explanation(
                title="⚠️ 需要关注的问题",
                content=(
                    f"发现 {len(failed)} 个需要关注的问题：\n"
                    + "\n".join([f"• {c.icon} {c.message}" for c in failed])
                ),
                category="约束检查",
                importance=8,
            ))

        if not failed:
            explanations.append(Explanation(
                title="✅ 约束检查通过",
                content="所有约束检查均已通过，方案可行。",
                category="约束检查",
                importance=5,
            ))

        if self.level in [ExplanationLevel.DETAILED, ExplanationLevel.EXPERT]:
            passed = [c for c in constraints if c.passed]
            for c in passed:
                if c.severity != "info":
                    explanations.append(Explanation(
                        title=f"✅ {self._constraint_label(c.constraint_type)}",
                        content=f"{c.message}\n{c.suggestion or ''}",
                        category="详细检查",
                        importance=3,
                    ))

        return explanations

    def explain_scenario_comparison(
        self,
        scenario_result: ScenarioResult,
        goal: Optional[ClientGoal] = None,
    ) -> List[Explanation]:
        """解释情景对比结果"""
        explanations: List[Explanation] = []

        optimal = scenario_result.optimal_scenario
        scenarios = scenario_result.scenarios
        viable = [s for s in scenarios if s.status.value != "rejected"]
        rejected = [s for s in scenarios if s.status.value == "rejected"]

        explanations.append(Explanation(
            title="方案对比概览",
            content=(
                f"共生成 {len(scenarios)} 个提前还款方案，"
                f"其中 {len(viable)} 个方案可行，{len(rejected)} 个方案因严重问题被排除。"
            ),
            category="对比概览",
        ))

        if optimal:
            priority_text = ""
            if goal and goal.priority:
                priority_map = {
                    "interest_saving": "利息节省优先",
                    "cashflow_friendly": "现金流友好优先",
                    "balanced": "平衡考虑",
                    "early_payoff": "尽早结清优先",
                }
                priority_text = f"（基于{priority_map.get(goal.priority.value, '综合评估')}）"

            explanations.append(Explanation(
                title="🏆 推荐方案",
                content=(
                    f"推荐方案：「{optimal.name}」{priority_text}\n"
                    f"综合得分：{optimal.score:.0f}/100\n\n"
                    f"• 提前还款：{self._format_amount(optimal.prepay_amount)} 元\n"
                    f"• 支付违约金：{self._format_amount(optimal.penalty_amount)} 元\n"
                    f"• 节省利息：{self._format_amount(optimal.result.interest_saved) if optimal.result else '-'} 元\n"
                    f"• 缩短期限：{optimal.result.months_saved if optimal.result else 0} 个月\n"
                    + (f"• 月供减少：{self._format_amount(optimal.result.cashflow_impact)} 元\n" if optimal.result and optimal.result.cashflow_impact > 0 else "")
                ),
                category="推荐方案",
                importance=10,
            ))

        if self.level in [ExplanationLevel.STANDARD, ExplanationLevel.DETAILED, ExplanationLevel.EXPERT]:
            for i, rec in enumerate(scenario_result.recommendations):
                explanations.append(Explanation(
                    title=f"建议 {i + 1}",
                    content=rec,
                    category="专家建议",
                    importance=9 - i,
                ))

        return explanations

    def generate_summary(
        self,
        loan: LoanContract,
        summary: RepaymentSummary,
        scenario_result: ScenarioResult,
        paid_months: int,
        penalty_rule: Optional[PenaltyRule] = None,
        budget: Optional[Budget] = None,
        goal: Optional[ClientGoal] = None,
    ) -> str:
        """生成摘要文本"""
        optimal = scenario_result.optimal_scenario
        lines = []

        lines.append(f"# 房贷提前还款规划报告")
        lines.append("")
        lines.append(f"**客户**: {loan.customer_name}")
        lines.append(f"**合同号**: {loan.contract_no}")
        lines.append(f"**报告日期**: {date.today().isoformat()}")
        lines.append("")

        lines.append("## 一、贷款概况")
        lines.append(f"- 贷款金额: {self._format_amount(loan.loan_amount)} 元")
        lines.append(f"- 贷款期限: {loan.loan_term_months} 个月 ({loan.loan_term_months // 12} 年)")
        lines.append(f"- 年利率: {self._format_rate(loan.annual_interest_rate)}")
        lines.append(f"- 已还款: {paid_months} 个月")
        lines.append(f"- 剩余本金: {self._format_amount(summary.remaining_principal)} 元")
        lines.append("")

        if optimal and optimal.result:
            lines.append("## 二、推荐方案")
            lines.append(f"- 方案名称: {optimal.name}")
            lines.append(f"- 提前还款: {self._format_amount(optimal.prepay_amount)} 元")
            lines.append(f"- 违约金: {self._format_amount(optimal.penalty_amount)} 元")
            lines.append(f"- 节省利息: {self._format_amount(optimal.result.interest_saved)} 元")
            if optimal.result.months_saved > 0:
                lines.append(f"- 缩短期限: {optimal.result.months_saved} 个月")
            if optimal.result.cashflow_impact > 0:
                lines.append(f"- 月供减少: {self._format_amount(optimal.result.cashflow_impact)} 元")
            lines.append("")

            lines.append("## 三、核心建议")
            for rec in scenario_result.recommendations:
                lines.append(f"- {rec}")
            lines.append("")

        return "\n".join(lines)

    def _format_amount(self, amount: Optional[Decimal]) -> str:
        if amount is None:
            return "-"
        if abs(amount) >= D("10000"):
            return f"{float(amount / D('10000')):.2f}万"
        return f"{float(amount):,.2f}"

    def _format_rate(self, rate: Decimal) -> str:
        return f"{float(rate * 100):.2f}%"

    def _repayment_method_label(self, method) -> str:
        return {
            "equal_principal_interest": "等额本息",
            "equal_principal": "等额本金",
        }.get(method.value, method.value)

    def _constraint_label(self, constraint_type) -> str:
        return {
            "prepay_period": "提前还款期限",
            "prepay_amount": "提前还款金额",
            "cashflow": "现金流压力",
            "penalty_economic": "违约金经济性",
            "emergency_fund": "紧急预备金",
            "debt_ratio": "债务收入比",
            "goal_alignment": "目标一致性",
        }.get(constraint_type.value, constraint_type.value)

    def _estimate_principal_ratio(self, summary: RepaymentSummary, paid_months: int) -> float:
        """估算当前月供中本金占比"""
        if paid_months <= 0:
            return 0.3
        total_paid = summary.total_paid_principal + summary.total_paid_interest
        if total_paid == 0:
            return 0.3
        avg_principal_ratio = float(summary.total_paid_principal / total_paid)
        return min(0.9, max(0.2, avg_principal_ratio * 1.2))

    def _calculate_roi(self, result: PrepayResult) -> float:
        """计算提前还款的投资回报率"""
        if result.prepay_amount == 0 or result.months_saved == 0:
            return 0
        net_saving = result.interest_saved - result.penalty_amount
        years = result.months_saved / 12
        annualized = (net_saving / result.prepay_amount) / years if years > 0 else 0
        return float(annualized)
