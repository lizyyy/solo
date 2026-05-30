"""报告生成模块 - 支持Markdown和Excel格式导出"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from decimal import Decimal

import pandas as pd
from pydantic import BaseModel

from ..models.loan import LoanContract
from ..models.budget import Budget
from ..models.penalty import PenaltyRule
from ..models.goal import ClientGoal
from ..models.repayment import RepaymentRecord
from ..engine.calculator import RepaymentSummary
from ..simulation.scenario import Scenario, ScenarioResult
from ..simulation.constraints import ConstraintCheck
from ..exceptions.handler import ExceptionHandler
from .interpreter import ResultInterpreter, ExplanationLevel


D = Decimal


class ReportFormat(str):
    """报告格式"""
    MARKDOWN = "markdown"
    EXCEL = "excel"
    HTML = "html"


class ReportGenerator:
    """报告生成器"""

    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.interpreter = ResultInterpreter()

    def generate_report(
        self,
        loan: LoanContract,
        summary: RepaymentSummary,
        scenario_result: ScenarioResult,
        paid_months: int,
        format: str = ReportFormat.MARKDOWN,
        penalty_rule: Optional[PenaltyRule] = None,
        budget: Optional[Budget] = None,
        goal: Optional[ClientGoal] = None,
        existing_records: Optional[List[RepaymentRecord]] = None,
        exception_handler: Optional[ExceptionHandler] = None,
        explanation_level: ExplanationLevel = ExplanationLevel.STANDARD,
        filename: Optional[str] = None,
    ) -> str:
        """
        生成报告

        Args:
            loan: 贷款合同
            summary: 还款汇总
            scenario_result: 情景对比结果
            paid_months: 已还款月数
            format: 报告格式
            penalty_rule: 违约金规则
            budget: 预算
            goal: 客户目标
            existing_records: 历史还款记录
            exception_handler: 异常处理器
            explanation_level: 解释深度
            filename: 输出文件名

        Returns:
            报告文件路径
        """
        self.interpreter.level = explanation_level

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if not filename:
            filename = f"prepay_report_{loan.contract_no}_{timestamp}"

        if format == ReportFormat.MARKDOWN:
            return self._generate_markdown(
                filename, loan, summary, scenario_result, paid_months,
                penalty_rule, budget, goal, existing_records, exception_handler
            )
        elif format == ReportFormat.EXCEL:
            return self._generate_excel(
                filename, loan, summary, scenario_result, paid_months,
                penalty_rule, budget, goal, existing_records, exception_handler
            )
        else:
            raise ValueError(f"不支持的报告格式: {format}")

    def _generate_markdown(
        self,
        filename: str,
        loan: LoanContract,
        summary: RepaymentSummary,
        scenario_result: ScenarioResult,
        paid_months: int,
        penalty_rule: Optional[PenaltyRule],
        budget: Optional[Budget],
        goal: Optional[ClientGoal],
        existing_records: Optional[List[RepaymentRecord]],
        exception_handler: Optional[ExceptionHandler],
    ) -> str:
        """生成Markdown格式报告"""
        filepath = self.output_dir / f"{filename}.md"

        lines = []

        lines.append(f"# 房贷提前还款规划报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}")
        lines.append(f"**客户姓名**: {loan.customer_name}")
        lines.append(f"**客户ID**: {loan.customer_id}")
        lines.append(f"**合同编号**: {loan.contract_no}")
        lines.append(f"**贷款银行**: {loan.bank_name or '-'}")
        lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 📋 一、贷款基本信息")
        lines.append("")
        lines.append("| 项目 | 详情 |")
        lines.append("|------|------|")
        lines.append(f"| 贷款金额 | {self._fmt(loan.loan_amount)} 元 |")
        lines.append(f"| 贷款期限 | {loan.loan_term_months} 个月 ({loan.loan_term_months // 12} 年) |")
        lines.append(f"| 年利率 | {self._fmt_pct(loan.annual_interest_rate)} |")
        lines.append(f"| 还款方式 | {'等额本息' if loan.repayment_method.value == 'equal_principal_interest' else '等额本金'} |")
        lines.append(f"| 贷款起始日 | {loan.start_date.isoformat()} |")
        lines.append(f"| 首次还款日 | {loan.first_payment_date.isoformat()} |")
        lines.append(f"| 到期日期 | {loan.maturity_date.isoformat()} |")
        lines.append(f"| LPR定价 | {'是' if loan.lpr_based else '否'} |")
        if loan.lpr_based:
            lines.append(f"| 当前LPR | {self._fmt_pct(loan.current_lpr_rate) if loan.current_lpr_rate else '-'} |")
            lines.append(f"| LPR加点 | {self._fmt_pct(loan.lpr_margin) if loan.lpr_margin else '-'} |")
        lines.append(f"| 原月供 | {self._fmt(summary.original_monthly_payment)} 元 |")
        lines.append("")

        lines.append("## 📊 二、还款进度分析")
        lines.append("")
        lines.append("| 项目 | 金额 | 占比 |")
        lines.append("|------|------|------|")
        lines.append(f"| 已还款月数 | {paid_months} 个月 | {paid_months / loan.loan_term_months * 100:.1f}% |")
        lines.append(f"| 已还本金 | {self._fmt(summary.total_paid_principal)} 元 | {self._pct(summary.total_paid_principal, loan.loan_amount)} |")
        lines.append(f"| 已付利息 | {self._fmt(summary.total_paid_interest)} 元 | - |")
        lines.append(f"| 剩余本金 | {self._fmt(summary.remaining_principal)} 元 | {self._pct(summary.remaining_principal, loan.loan_amount)} |")
        lines.append(f"| 剩余期数 | {summary.remaining_months} 个月 | {summary.remaining_months / loan.loan_term_months * 100:.1f}% |")
        lines.append(f"| 原计划总利息 | {self._fmt(summary.total_interest_original)} 元 | - |")
        lines.append("")

        loan_explanations = self.interpreter.explain_loan_summary(loan, summary, paid_months)
        for exp in loan_explanations:
            lines.append(f"### 💡 {exp.title}")
            lines.append("")
            lines.append(exp.content)
            lines.append("")

        lines.append("## 🎯 三、提前还款方案对比")
        lines.append("")

        if scenario_result.comparison_table:
            lines.append("| 情景名称 | 策略 | 提前还款 | 违约金 | 节省利息 | 节省期数 | 新月供 | 月供变化 | 得分 | 状态 |")
            lines.append("|----------|------|----------|--------|----------|----------|--------|----------|------|------|")
            for row in scenario_result.comparison_table:
                lines.append(
                    f"| {row['情景名称']} | {row['策略']} | {row['提前还款额']} | "
                    f"{row['违约金']} | {row['节省利息']} | {row['节省期数']} | "
                    f"{row['新月供']} | {row['月供变化']} | {row['得分']} | {row['状态']} |"
                )
            lines.append("")

        scenario_explanations = self.interpreter.explain_scenario_comparison(scenario_result, goal)
        for exp in scenario_explanations:
            lines.append(f"### {exp.title}")
            lines.append("")
            lines.append(exp.content)
            lines.append("")

        optimal = scenario_result.optimal_scenario
        if optimal and optimal.result:
            lines.append("## 🏆 四、推荐方案详情")
            lines.append("")

            prepay_explanations = self.interpreter.explain_prepay_result(
                optimal.result, loan, penalty_rule, paid_months, summary.remaining_principal
            )
            for exp in prepay_explanations:
                lines.append(f"### {exp.title}")
                lines.append("")
                lines.append(exp.content)
                lines.append("")

            if optimal.cashflow_analysis:
                lines.append("## 💰 五、现金流分析")
                lines.append("")

                cashflow_explanations = self.interpreter.explain_cashflow_analysis(
                    optimal.cashflow_analysis, budget or Budget(
                        customer_id=loan.customer_id,
                        budget_month=date.today(),
                        monthly_household_income=D("0"),
                        monthly_household_expense=D("0"),
                        monthly_mortgage_payment=D("0"),
                        monthly_surplus=D("0"),
                    )
                )
                for exp in cashflow_explanations:
                    lines.append(f"### {exp.title}")
                    lines.append("")
                    lines.append(exp.content)
                    lines.append("")

                lines.append("### 📈 现金流预测（前12个月）")
                lines.append("")
                lines.append("| 月份 | 收入 | 支出 | 月供 | 提前还款 | 结余 | 累计结余 | 备注 |")
                lines.append("|------|------|------|------|----------|------|----------|------|")
                for proj in optimal.cashflow_analysis.projections[:12]:
                    lines.append(
                        f"| {proj.month.strftime('%Y-%m')} | {self._fmt(proj.income)} | {self._fmt(proj.expenses)} | "
                        f"{self._fmt(proj.mortgage_payment)} | {self._fmt(proj.prepayment_amount)} | "
                        f"{self._fmt(proj.surplus)} | {self._fmt(proj.cumulative_surplus)} | "
                        f"{proj.note or '-'} |"
                    )
                lines.append("")

            lines.append("## ✅ 六、约束检查结果")
            lines.append("")

            constraint_explanations = self.interpreter.explain_constraints(optimal.constraints)
            for exp in constraint_explanations:
                lines.append(f"### {exp.title}")
                lines.append("")
                lines.append(exp.content)
                lines.append("")

            lines.append("| 检查项 | 结果 | 说明 |")
            lines.append("|--------|------|------|")
            for c in optimal.constraints:
                status = "✅ 通过" if c.passed else ("🔴 严重" if c.severity == "critical" else "🟡 警告")
                lines.append(f"| {self._constraint_label(c.constraint_type)} | {status} | {c.message} |")
            lines.append("")

        if optimal and optimal.result and optimal.result.schedule:
            lines.append("## 📅 七、新还款计划（节选）")
            lines.append("")
            lines.append("| 期数 | 还款日期 | 月供 | 本金 | 利息 | 剩余本金 |")
            lines.append("|------|----------|------|------|------|----------|")
            for item in optimal.result.schedule[:12]:
                lines.append(
                    f"| {item.period_no} | {item.payment_date.isoformat()} | "
                    f"{self._fmt(item.total_payment)} | {self._fmt(item.principal_payment)} | "
                    f"{self._fmt(item.interest_payment)} | {self._fmt(item.remaining_principal)} |"
                )
            if len(optimal.result.schedule) > 12:
                lines.append(f"| ... | ... | ... | ... | ... | ... |")
            lines.append("")

        if exception_handler and exception_handler.has_issues:
            lines.append("## ⚠️ 八、异常与注意事项")
            lines.append("")
            lines.append(f"- **错误**: {exception_handler.errors or 0} 个")
            lines.append(f"- **警告**: {exception_handler.warnings or 0} 个")
            lines.append(f"- **提示**: {len(exception_handler.infos) if exception_handler.infos else 0} 个")
            lines.append("")

            for err in exception_handler.errors[:5]:
                lines.append(f"### ❌ {err.category_label}")
                lines.append("")
                lines.append(err.format_for_console())
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("> **免责声明**: 本报告基于提供的数据和假设条件生成，仅供参考。最终决策请以银行实际规定和客户实际情况为准。建议在操作前与贷款银行确认相关规则和费用。")
        lines.append("")
        lines.append(f"> 报告由「房贷提前还款规划工具」自动生成于 {datetime.now().isoformat()}")

        content = "\n".join(lines)
        filepath.write_text(content, encoding="utf-8")
        return str(filepath)

    def _generate_excel(
        self,
        filename: str,
        loan: LoanContract,
        summary: RepaymentSummary,
        scenario_result: ScenarioResult,
        paid_months: int,
        penalty_rule: Optional[PenaltyRule],
        budget: Optional[Budget],
        goal: Optional[ClientGoal],
        existing_records: Optional[List[RepaymentRecord]],
        exception_handler: Optional[ExceptionHandler],
    ) -> str:
        """生成Excel格式报告"""
        filepath = self.output_dir / f"{filename}.xlsx"

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            summary_data = {
                "项目": [
                    "客户姓名", "客户ID", "合同编号", "贷款金额", "贷款期限",
                    "年利率", "还款方式", "贷款起始日", "到期日期", "已还款月数",
                    "已还本金", "已付利息", "剩余本金", "剩余期数", "原月供",
                ],
                "详情": [
                    loan.customer_name, loan.customer_id, loan.contract_no,
                    float(loan.loan_amount), f"{loan.loan_term_months}个月",
                    float(loan.annual_interest_rate),
                    "等额本息" if loan.repayment_method.value == "equal_principal_interest" else "等额本金",
                    loan.start_date.isoformat(), loan.maturity_date.isoformat(),
                    paid_months, float(summary.total_paid_principal),
                    float(summary.total_paid_interest), float(summary.remaining_principal),
                    summary.remaining_months, float(summary.original_monthly_payment),
                ],
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name="贷款概览", index=False)

            if scenario_result.comparison_table:
                df_compare = pd.DataFrame(scenario_result.comparison_table)
                df_compare.to_excel(writer, sheet_name="方案对比", index=False)

            optimal = scenario_result.optimal_scenario
            if optimal and optimal.result:
                result_data = {
                    "项目": [
                        "方案名称", "提前还款金额", "违约金", "总成本",
                        "节省利息", "缩短期限(月)", "新月供", "月供变化",
                        "新到期日", "综合得分",
                    ],
                    "数值": [
                        optimal.name, float(optimal.prepay_amount), float(optimal.penalty_amount),
                        float(optimal.total_cost), float(optimal.result.interest_saved),
                        optimal.result.months_saved,
                        float(optimal.result.new_monthly_payment) if optimal.result.new_monthly_payment else 0,
                        float(optimal.result.cashflow_impact),
                        optimal.result.new_maturity_date.isoformat() if optimal.result.new_maturity_date else "-",
                        optimal.score or 0,
                    ],
                }
                pd.DataFrame(result_data).to_excel(writer, sheet_name="推荐方案", index=False)

                if optimal.result.schedule:
                    schedule_data = []
                    for item in optimal.result.schedule:
                        schedule_data.append({
                            "期数": item.period_no,
                            "还款日期": item.payment_date.isoformat(),
                            "月供(元)": float(item.total_payment),
                            "本金(元)": float(item.principal_payment),
                            "利息(元)": float(item.interest_payment),
                            "剩余本金(元)": float(item.remaining_principal),
                        })
                    pd.DataFrame(schedule_data).to_excel(writer, sheet_name="还款计划", index=False)

                if optimal.cashflow_analysis:
                    cashflow_data = []
                    for proj in optimal.cashflow_analysis.projections:
                        cashflow_data.append({
                            "月份": proj.month.isoformat(),
                            "收入(元)": float(proj.income),
                            "支出(元)": float(proj.expenses),
                            "月供(元)": float(proj.mortgage_payment),
                            "提前还款(元)": float(proj.prepayment_amount),
                            "违约金(元)": float(proj.penalty_amount),
                            "结余(元)": float(proj.surplus),
                            "累计结余(元)": float(proj.cumulative_surplus),
                            "备注": proj.note or "",
                        })
                    pd.DataFrame(cashflow_data).to_excel(writer, sheet_name="现金流预测", index=False)

            constraint_data = []
            if optimal:
                for c in optimal.constraints:
                    constraint_data.append({
                        "检查项": self._constraint_label(c.constraint_type),
                        "是否通过": "是" if c.passed else "否",
                        "严重程度": c.severity,
                        "说明": c.message,
                        "建议": c.suggestion or "",
                    })
            pd.DataFrame(constraint_data).to_excel(writer, sheet_name="约束检查", index=False)

            if exception_handler and exception_handler.has_issues:
                error_data = []
                all_issues = exception_handler.errors + exception_handler.warnings + exception_handler.infos
                for err in all_issues:
                    error_data.append({
                        "类型": err.category_label,
                        "严重程度": err.severity.value,
                        "错误信息": err.message,
                        "字段": err.context.field or "",
                        "建议": "; ".join(err.context.suggestions),
                    })
                pd.DataFrame(error_data).to_excel(writer, sheet_name="异常信息", index=False)

        return str(filepath)

    def _fmt(self, amount: Optional[Decimal]) -> str:
        if amount is None:
            return "-"
        return f"{float(amount):,.2f}"

    def _fmt_pct(self, rate: Optional[Decimal]) -> str:
        if rate is None:
            return "-"
        return f"{float(rate * 100):.2f}%"

    def _pct(self, part: Decimal, total: Decimal) -> str:
        if total == 0:
            return "-"
        return f"{float(part / total * 100):.1f}%"

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
