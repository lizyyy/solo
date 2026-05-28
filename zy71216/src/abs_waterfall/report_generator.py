"""报告生成模块 - 生成终端摘要、机器可读JSON和人可读报告"""

import json
from datetime import date
from pathlib import Path
from typing import List
from decimal import Decimal

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

from .models import (
    DealStructure,
    WaterfallResult,
    Discrepancy,
    TriggerStatus,
    PaymentAllocation,
    FeePayment,
)


class ReportGenerator:
    """报告生成器"""

    def __init__(self, deal: DealStructure, result: WaterfallResult, discrepancies: List[Discrepancy]):
        self.deal = deal
        self.result = result
        self.discrepancies = discrepancies
        self.console = Console()

    def _get_severity_style(self, severity: str) -> str:
        styles = {
            "CRITICAL": "bold red on yellow",
            "HIGH": "bold red",
            "MEDIUM": "bold yellow",
            "LOW": "bold blue",
        }
        return styles.get(severity, "white")

    def _format_amount(self, amount: float) -> str:
        return f"¥{amount:,.2f}"

    def _format_pct(self, value: float) -> str:
        return f"{value*100:.2f}%"

    def generate_terminal_summary(self) -> None:
        """生成终端摘要"""
        console = self.console

        console.print()
        title = Text("ABS 现金流瀑布复核报告", style="bold cyan", justify="center")
        console.print(Panel(title, border_style="cyan", box=box.DOUBLE))
        console.print()

        deal_info = Table(title="交易基本信息", box=box.ROUNDED, border_style="cyan")
        deal_info.add_column("项目", style="bold")
        deal_info.add_column("内容")
        deal_info.add_row("交易代码", self.deal.deal_id)
        deal_info.add_row("交易名称", self.deal.deal_name)
        deal_info.add_row("计息区间", f"{self.result.period_start_date} 至 {self.result.period_end_date}")
        deal_info.add_row("付款日", str(self.deal.next_payment_date))
        console.print(deal_info)
        console.print()

        cashflow_summary = Table(title="现金流汇总", box=box.ROUNDED, border_style="green")
        cashflow_summary.add_column("项目", style="bold")
        cashflow_summary.add_column("金额", justify="right", style="green")
        cashflow_summary.add_row("期初归集账户余额", self._format_amount(self.result.beginning_collection_balance))
        cashflow_summary.add_row("本期现金流入", self._format_amount(self.result.total_cash_inflow))
        cashflow_summary.add_row("本期现金流出", self._format_amount(self.result.total_cash_outflow))
        cashflow_summary.add_row("期末归集账户余额", self._format_amount(self.result.ending_collection_balance))
        cashflow_summary.add_row("期初储备金余额", self._format_amount(self.result.beginning_reserve_balance))
        cashflow_summary.add_row("期末储备金余额", self._format_amount(self.result.ending_reserve_balance))
        console.print(cashflow_summary)
        console.print()

        fee_table = Table(title="服务费支付明细", box=box.ROUNDED, border_style="magenta")
        fee_table.add_column("费用名称", style="bold")
        fee_table.add_column("应付金额", justify="right")
        fee_table.add_column("实付金额", justify="right", style="green")
        fee_table.add_column("短缺金额", justify="right", style="yellow")
        fee_table.add_column("结转短缺", justify="right", style="red")
        for fp in self.result.fee_payments:
            fee_table.add_row(
                fp.fee_name,
                self._format_amount(fp.scheduled_amount),
                self._format_amount(fp.paid_amount),
                self._format_amount(fp.shortfall_amount),
                self._format_amount(fp.carried_shortfall),
            )
        console.print(fee_table)
        console.print()

        tranche_table = Table(title="分层支付明细", box=box.ROUNDED, border_style="blue")
        tranche_table.add_column("分层名称", style="bold")
        tranche_table.add_column("支付类型", style="bold")
        tranche_table.add_column("应付金额", justify="right")
        tranche_table.add_column("实付金额", justify="right", style="green")
        tranche_table.add_column("短缺金额", justify="right", style="yellow")
        tranche_table.add_column("来源", justify="center")
        for tp in self.result.tranche_payments:
            source = "违约回款" if tp.is_from_recovery else "正常回款"
            tranche_table.add_row(
                tp.tranche_name,
                tp.payment_type.value,
                self._format_amount(tp.scheduled_amount),
                self._format_amount(tp.paid_amount),
                self._format_amount(tp.shortfall_amount),
                source,
            )
        console.print(tranche_table)
        console.print()

        trigger_table = Table(title="触发事件检测结果", box=box.ROUNDED, border_style="yellow")
        trigger_table.add_column("事件名称", style="bold")
        trigger_table.add_column("测试公式", style="dim")
        trigger_table.add_column("实际值", justify="right")
        trigger_table.add_column("阈值", justify="right")
        trigger_table.add_column("状态", justify="center")
        for trigger in self.result.trigger_results:
            status_style = "green" if trigger.status == TriggerStatus.NOT_TRIGGERED else "bold red"
            status_text = "✓ 未触发" if trigger.status == TriggerStatus.NOT_TRIGGERED else "⚠ 已触发"
            if trigger.status == TriggerStatus.WAIVED:
                status_text = "○ 已豁免"
                status_style = "yellow"
            elif trigger.status == TriggerStatus.CURED:
                status_text = "✓ 已治愈"
                status_style = "green"
            trigger_table.add_row(
                trigger.event_name,
                trigger.test_formula,
                self._format_pct(trigger.actual_value),
                self._format_pct(trigger.threshold),
                Text(status_text, style=status_style),
            )
        console.print(trigger_table)
        console.print()

        if self.discrepancies:
            severity_count = {}
            for d in self.discrepancies:
                severity_count[d.severity] = severity_count.get(d.severity, 0) + 1

            summary_parts = []
            for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
                if sev in severity_count:
                    summary_parts.append(f"[{self._get_severity_style(sev)}]{sev}: {severity_count[sev]}[/]")

            discrep_header = Text.assemble(
                ("差错检测结果", "bold"),
                "  (",
                *[(p, "") for p in summary_parts],
                ")",
            )

            discrep_table = Table(title=discrep_header, box=box.ROUNDED, border_style="red")
            discrep_table.add_column("差错编号", style="bold")
            discrep_table.add_column("严重程度", justify="center")
            discrep_table.add_column("差错描述", style="bold")
            discrep_table.add_column("期望值", justify="right")
            discrep_table.add_column("实际值", justify="right")

            for d in self.discrepancies:
                severity_style = self._get_severity_style(d.severity)
                expected = self._format_amount(d.expected_value) if d.expected_value is not None else "-"
                actual = self._format_amount(d.actual_value) if d.actual_value is not None else "-"
                discrep_table.add_row(
                    d.discrepancy_id,
                    Text(d.severity, style=severity_style),
                    d.description,
                    expected,
                    actual,
                )

            console.print(discrep_table)
            console.print()

            for d in self.discrepancies:
                severity_style = self._get_severity_style(d.severity)
                panel_title = Text.assemble(
                    (f"差错详情 - {d.discrepancy_id} ", "bold"),
                    (f"[{d.severity}]", severity_style),
                )

                content = Text()
                content.append("差错类型: ", style="bold")
                content.append(f"{d.discrepancy_type.value}\n")
                content.append("描述: ", style="bold")
                content.append(f"{d.description}\n\n")
                content.append("详细解释:\n", style="bold underline")
                content.append(f"{d.explanation}\n\n")

                if d.related_tranche:
                    content.append("涉及分层: ", style="bold")
                    content.append(f"{d.related_tranche}\n")
                if d.related_asset:
                    content.append("涉及资产: ", style="bold")
                    content.append(f"{d.related_asset}\n")
                if d.affected_records:
                    content.append("影响记录: ", style="bold")
                    content.append(f"{', '.join(d.affected_records)}\n")

                console.print(Panel(content, title=panel_title, border_style="red", box=box.ROUNDED))
                console.print()
        else:
            console.print(Panel(
                Text("✓ 未检测到任何差错，现金流分配符合交易文件约定", style="bold green", justify="center"),
                title="差错检测结果",
                border_style="green",
                box=box.ROUNDED,
            ))
            console.print()

        raw_cf_count = len(self.result.raw_cashflows_used)
        raw_cf_total = sum(cf.amount for cf in self.result.raw_cashflows_used)
        console.print(Panel(
            Text(f"原始现金流记录已保留 {raw_cf_count} 笔，合计 {self._format_amount(raw_cf_total)}，可用于后续排错追溯",
                 style="dim", justify="center"),
            border_style="dim",
            box=box.ROUNDED,
        ))
        console.print()

        if self.discrepancies:
            critical_count = sum(1 for d in self.discrepancies if d.severity == "CRITICAL")
            high_count = sum(1 for d in self.discrepancies if d.severity == "HIGH")

            if critical_count > 0 or high_count > 0:
                conclusion = Text()
                conclusion.append("【处理结论】", style="bold red on white")
                conclusion.append("\n\n")
                conclusion.append("检测到严重/高危差错，本期分配报告 ", style="bold")
                conclusion.append("不得出具", style="bold red underline")
                conclusion.append("。\n", style="bold")
                conclusion.append("请根据差错详情逐项修正后重新运行复核。\n", style="bold")
                if critical_count > 0:
                    conclusion.append(f"⚠ CRITICAL级别差错 {critical_count} 项，需优先处理。\n", style="bold red")
                if high_count > 0:
                    conclusion.append(f"⚠ HIGH级别差错 {high_count} 项，需认真核实。\n", style="bold red")

                console.print(Panel(conclusion, border_style="red", box=box.DOUBLE))
            else:
                conclusion = Text()
                conclusion.append("【处理结论】", style="bold yellow on white")
                conclusion.append("\n\n")
                conclusion.append("检测到中/低级别差错，建议核实后 ", style="bold")
                conclusion.append("谨慎出具", style="bold yellow underline")
                conclusion.append("报告。\n", style="bold")
                console.print(Panel(conclusion, border_style="yellow", box=box.DOUBLE))
        else:
            conclusion = Text()
            conclusion.append("【处理结论】", style="bold green on white")
            conclusion.append("\n\n")
            conclusion.append("现金流分配复核通过，可正常出具分配报告。\n", style="bold green")
            console.print(Panel(conclusion, border_style="green", box=box.DOUBLE))

        console.print()

    def generate_machine_readable(self, output_path: str) -> None:
        """生成机器可读的JSON报告"""
        data = {
            "metadata": {
                "deal_id": self.deal.deal_id,
                "deal_name": self.deal.deal_name,
                "period_start": self.result.period_start_date.isoformat(),
                "period_end": self.result.period_end_date.isoformat(),
                "payment_date": self.deal.next_payment_date.isoformat(),
                "generation_time": date.today().isoformat(),
            },
            "cashflow_summary": {
                "total_inflow": self.result.total_cash_inflow,
                "total_outflow": self.result.total_cash_outflow,
                "beginning_collection_balance": self.result.beginning_collection_balance,
                "ending_collection_balance": self.result.ending_collection_balance,
                "beginning_reserve_balance": self.result.beginning_reserve_balance,
                "ending_reserve_balance": self.result.ending_reserve_balance,
            },
            "fee_payments": [
                {
                    "fee_id": fp.fee_id,
                    "fee_name": fp.fee_name,
                    "scheduled_amount": fp.scheduled_amount,
                    "paid_amount": fp.paid_amount,
                    "shortfall_amount": fp.shortfall_amount,
                    "carried_shortfall": fp.carried_shortfall,
                }
                for fp in self.result.fee_payments
            ],
            "tranche_payments": [
                {
                    "tranche_id": tp.tranche_id,
                    "tranche_name": tp.tranche_name,
                    "payment_type": tp.payment_type.value,
                    "scheduled_amount": tp.scheduled_amount,
                    "paid_amount": tp.paid_amount,
                    "shortfall_amount": tp.shortfall_amount,
                    "carried_shortfall": tp.carried_shortfall,
                    "is_from_recovery": tp.is_from_recovery,
                }
                for tp in self.result.tranche_payments
            ],
            "trigger_results": [
                {
                    "event_id": tr.event_id,
                    "event_name": tr.event_name,
                    "event_type": tr.event_type.value,
                    "test_formula": tr.test_formula,
                    "actual_value": tr.actual_value,
                    "threshold": tr.threshold,
                    "status": tr.status.value,
                }
                for tr in self.result.trigger_results
            ],
            "discrepancies": [
                {
                    "discrepancy_id": d.discrepancy_id,
                    "discrepancy_type": d.discrepancy_type.value,
                    "severity": d.severity,
                    "description": d.description,
                    "expected_value": d.expected_value,
                    "actual_value": d.actual_value,
                    "related_tranche": d.related_tranche,
                    "related_asset": d.related_asset,
                    "affected_records": d.affected_records,
                    "explanation": d.explanation,
                }
                for d in self.discrepancies
            ],
            "original_values_preserved": self.result.original_values_preserved,
            "raw_cashflows_used": [
                {
                    "record_id": cf.record_id,
                    "asset_id": cf.asset_id,
                    "payment_date": cf.payment_date.isoformat(),
                    "payment_type": cf.payment_type.value,
                    "amount": cf.amount,
                    "is_recovery": cf.is_recovery,
                }
                for cf in self.result.raw_cashflows_used
            ],
            "conclusion": {
                "has_critical_issues": any(d.severity == "CRITICAL" for d in self.discrepancies),
                "has_high_issues": any(d.severity == "HIGH" for d in self.discrepancies),
                "total_issues": len(self.discrepancies),
                "can_issue_report": all(d.severity not in ["CRITICAL", "HIGH"] for d in self.discrepancies),
            },
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def generate_human_readable(self, output_path: str) -> None:
        """生成人可读的文本报告"""
        lines = []

        lines.append("=" * 80)
        lines.append("ABS现金流瀑布复核报告")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【交易基本信息】")
        lines.append("-" * 40)
        lines.append(f"交易代码: {self.deal.deal_id}")
        lines.append(f"交易名称: {self.deal.deal_name}")
        lines.append(f"计息区间: {self.result.period_start_date} 至 {self.result.period_end_date}")
        lines.append(f"付款日: {self.deal.next_payment_date}")
        lines.append(f"报告生成日期: {date.today()}")
        lines.append("")

        lines.append("【现金流汇总】")
        lines.append("-" * 40)
        lines.append(f"期初归集账户余额: {self._format_amount(self.result.beginning_collection_balance)}")
        lines.append(f"本期现金流入: {self._format_amount(self.result.total_cash_inflow)}")
        lines.append(f"本期现金流出: {self._format_amount(self.result.total_cash_outflow)}")
        lines.append(f"期末归集账户余额: {self._format_amount(self.result.ending_collection_balance)}")
        lines.append(f"期初储备金余额: {self._format_amount(self.result.beginning_reserve_balance)}")
        lines.append(f"期末储备金余额: {self._format_amount(self.result.ending_reserve_balance)}")
        lines.append("")

        lines.append("【服务费支付明细】")
        lines.append("-" * 40)
        lines.append(f"{'费用名称':<15} {'应付金额':>15} {'实付金额':>15} {'短缺金额':>15} {'结转短缺':>15}")
        lines.append("-" * 75)
        for fp in self.result.fee_payments:
            lines.append(
                f"{fp.fee_name:<15} "
                f"{self._format_amount(fp.scheduled_amount):>15} "
                f"{self._format_amount(fp.paid_amount):>15} "
                f"{self._format_amount(fp.shortfall_amount):>15} "
                f"{self._format_amount(fp.carried_shortfall):>15}"
            )
        lines.append("")

        lines.append("【分层支付明细】")
        lines.append("-" * 40)
        lines.append(f"{'分层名称':<12} {'类型':<8} {'应付金额':>15} {'实付金额':>15} {'短缺金额':>15} {'来源':<8}")
        lines.append("-" * 75)
        for tp in self.result.tranche_payments:
            source = "违约回款" if tp.is_from_recovery else "正常回款"
            lines.append(
                f"{tp.tranche_name:<12} "
                f"{tp.payment_type.value:<8} "
                f"{self._format_amount(tp.scheduled_amount):>15} "
                f"{self._format_amount(tp.paid_amount):>15} "
                f"{self._format_amount(tp.shortfall_amount):>15} "
                f"{source:<8}"
            )
        lines.append("")

        lines.append("【触发事件检测结果】")
        lines.append("-" * 40)
        lines.append(f"{'事件名称':<20} {'公式':<20} {'实际值':>12} {'阈值':>12} {'状态':<10}")
        lines.append("-" * 75)
        for tr in self.result.trigger_results:
            status = "已触发" if tr.status == TriggerStatus.TRIGGERED else "未触发"
            if tr.status == TriggerStatus.WAIVED:
                status = "已豁免"
            elif tr.status == TriggerStatus.CURED:
                status = "已治愈"
            lines.append(
                f"{tr.event_name:<20} "
                f"{tr.test_formula:<20} "
                f"{self._format_pct(tr.actual_value):>12} "
                f"{self._format_pct(tr.threshold):>12} "
                f"{status:<10}"
            )
        lines.append("")

        if self.discrepancies:
            lines.append("【差错检测结果】")
            lines.append("-" * 40)
            lines.append(f"共检测到 {len(self.discrepancies)} 项差错:")
            lines.append("")

            for i, d in enumerate(self.discrepancies, 1):
                lines.append(f"差错 #{i}: {d.discrepancy_id} [{d.severity}]")
                lines.append(f"  类型: {d.discrepancy_type.value}")
                lines.append(f"  描述: {d.description}")
                if d.expected_value is not None:
                    lines.append(f"  期望值: {self._format_amount(d.expected_value)}")
                if d.actual_value is not None:
                    lines.append(f"  实际值: {self._format_amount(d.actual_value)}")
                if d.related_tranche:
                    lines.append(f"  涉及分层: {d.related_tranche}")
                if d.related_asset:
                    lines.append(f"  涉及资产: {d.related_asset}")
                lines.append(f"  详细解释:")
                for line in d.explanation.split('。'):
                    if line.strip():
                        lines.append(f"    - {line.strip()}。")
                lines.append("")
        else:
            lines.append("【差错检测结果】")
            lines.append("-" * 40)
            lines.append("✓ 未检测到任何差错，现金流分配符合交易文件约定。")
            lines.append("")

        lines.append("【原始值保留说明】")
        lines.append("-" * 40)
        lines.append(f"已保留 {len(self.result.raw_cashflows_used)} 笔原始现金流记录，")
        lines.append(f"合计金额: {self._format_amount(sum(cf.amount for cf in self.result.raw_cashflows_used))}")
        lines.append("可用于后续审计和排错追溯。")
        lines.append("")

        lines.append("【处理结论】")
        lines.append("=" * 80)

        critical_count = sum(1 for d in self.discrepancies if d.severity == "CRITICAL")
        high_count = sum(1 for d in self.discrepancies if d.severity == "HIGH")
        medium_count = sum(1 for d in self.discrepancies if d.severity == "MEDIUM")

        if critical_count > 0 or high_count > 0:
            lines.append("【红灯】检测到严重/高危差错，本期分配报告不得出具。")
            lines.append(f"  - CRITICAL级别差错: {critical_count} 项")
            lines.append(f"  - HIGH级别差错: {high_count} 项")
            lines.append("  请根据差错详情逐项修正后重新运行复核。")
        elif medium_count > 0:
            lines.append("【黄灯】检测到中级别差错，建议核实后谨慎出具报告。")
            lines.append(f"  - MEDIUM级别差错: {medium_count} 项")
            lines.append("  请与服务商确认相关事项后再决定是否出具报告。")
        else:
            lines.append("【绿灯】现金流分配复核通过，可正常出具分配报告。")

        lines.append("")
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
