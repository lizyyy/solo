"""报告导出与终端提示模块。

将优化结果导出为业务同事容易理解的格式：
- Markdown 格式：便于阅读、打印、归档
- JSON 格式：便于系统集成、二次开发、复核
- 终端人话提示：运行时即时反馈

所有异常记录都会在报告中清晰展示，业务可见。
"""
from __future__ import annotations

import logging
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box
from tabulate import tabulate

from .models import (
    OptimizationResult, CabinClass, FlightInfo,
    FlightOrder, DataIssue
)
from .anomaly_detector import AnomalyRecord
from .rollback_manager import OptimizationRecord, ManualOverride

logger = logging.getLogger(__name__)


class ReportExporter:
    """报告导出器。"""

    def __init__(self):
        self.console = Console()

    def export_markdown(
        self,
        optimization_result: OptimizationResult,
        flight_info: FlightInfo,
        scenario_comparison: List[Dict[str, Any]],
        anomalies: List[AnomalyRecord],
        summary: Dict[str, Any],
        manual_overrides: Optional[List[Dict[str, Any]]] = None,
        data_issues: Optional[List[DataIssue]] = None,
        output_path: Optional[str] = None
    ) -> str:
        """导出 Markdown 格式报告。

        Args:
            optimization_result: 优化结果
            flight_info: 航班信息
            scenario_comparison: 情景对比数据
            anomalies: 异常记录列表
            summary: 人话总结
            manual_overrides: 人工覆盖记录
            data_issues: 数据问题列表
            output_path: 输出文件路径（可选）

        Returns:
            Markdown 内容字符串
        """
        logger.info("生成 Markdown 报告...")

        md = []

        md.append(f"# ✈️ 航班超售优化报告")
        md.append("")
        md.append(f"**航班号**: {flight_info.flight_no}")
        md.append(f"**日期**: {flight_info.flight_date.strftime('%Y年%m月%d日')}")
        md.append(f"**航线**: {flight_info.departure} → {flight_info.arrival}")
        md.append(f"**计划起飞**: {flight_info.scheduled_departure.strftime('%H:%M')}")
        md.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md.append("")

        md.append("## 🎯 核心结论")
        md.append("")
        md.append(f"> **{summary['headline']}**")
        md.append("")
        md.append(summary["core_recommendation"])
        md.append("")

        md.append("### 决策指导")
        md.append("")
        md.append(f"{summary['decision_guide']}")
        md.append("")

        md.append(summary["anomaly_warning"])
        md.append("")

        md.append("## 📊 关键指标")
        md.append("")
        md.append("| 指标 | 数值 | 说明 |")
        md.append("|------|------|------|")
        for metric in summary["key_metrics"]:
            md.append(f"| {metric['name']} | {metric['value']:,} {metric['unit']} | {metric['explanation']} |")
        md.append("")

        md.append("## 🚀 推荐超售方案")
        md.append("")
        md.append("| 舱位 | 容量 | 已售 | 建议超售 | 超售比例 | 爽约率 | 平均票价 | 预计收入 | 预计补偿 | 预计净利 | 风险 |")
        md.append("|------|------|------|----------|----------|--------|----------|----------|----------|----------|------|")

        from .cost_optimizer import CostOptimizer
        optimizer = CostOptimizer()
        for cabin in [CabinClass.FIRST, CabinClass.BUSINESS,
                      CabinClass.PREMIUM_ECONOMY, CabinClass.ECONOMY]:
            if cabin not in flight_info.capacity:
                continue
            cap = flight_info.capacity[cabin]
            ob = optimization_result.optimal_overbooking.get(cabin, 0)
            nsr = optimization_result.expected_no_show_rate.get(cabin, 0)

            cabin_orders = [o for o in optimization_result.__dict__.get('_flight_orders', [])
                           if o.cabin_class == cabin]
            booked = len(cabin_orders)
            avg_fare = optimizer._calculate_average_fare(
                optimization_result.__dict__.get('_flight_orders', []), cabin
            )

            ob_ratio = (ob / cap * 100) if cap > 0 else 0
            risk_color = {
                "low": "🟢低",
                "medium": "🟡中",
                "high": "🔴高"
            }

            expected_rev = (booked + ob) * avg_fare * (1 - nsr)
            expected_comp = ob * nsr * 500 if cabin == CabinClass.ECONOMY else ob * nsr * 1500
            expected_net = expected_rev - expected_comp

            risk_level = optimization_result.risk_level if ob > 0 else "low"

            md.append(
                f"| {cabin.name} | {cap} | {booked} | {ob} | "
                f"{ob_ratio:.1f}% | {nsr*100:.1f}% | ¥{avg_fare:,.0f} | "
                f"¥{expected_rev:,.0f} | ¥{expected_comp:,.0f} | ¥{expected_net:,.0f} | "
                f"{risk_color.get(risk_level, risk_level)} |"
            )
        md.append("")

        md.append("## 📈 情景对比分析")
        md.append("")
        md.append("| 方案 | 总超售 | 预计收入 | 预计补偿 | 预计净利 | 最大超售概率 | 与推荐方案差异 | 建议 |")
        md.append("|------|--------|----------|----------|----------|--------------|----------------|------|")
        for sc in scenario_comparison:
            icon = sc.get("icon", "")
            name = f"{icon} {sc['scenario']}"
            delta = sc['vs_recommended_delta']
            delta_str = f"+¥{delta:,.0f}" if delta >= 0 else f"-¥{abs(delta):,.0f}"
            prob = sc['max_denied_probability'] * 100
            md.append(
                f"| {name} | {sc['total_overbooking']} | "
                f"¥{sc['expected_revenue']:,.0f} | ¥{sc['expected_compensation']:,.0f} | "
                f"¥{sc['expected_net_profit']:,.0f} | {prob:.1f}% | {delta_str} | "
                f"{sc.get('recommendation', '')} |"
            )
        md.append("")

        md.append("## ⚠️ 异常记录")
        md.append("")
        if anomalies:
            md.append(f"共检测到 **{len(anomalies)}** 条异常记录：")
            md.append("")

            by_severity: Dict[str, List[AnomalyRecord]] = {}
            for a in anomalies:
                if a.severity not in by_severity:
                    by_severity[a.severity] = []
                by_severity[a.severity].append(a)

            severity_order = ["error", "warning", "low"]
            icon_map = {"error": "🔴", "warning": "🟡", "low": "🔵"}
            label_map = {"error": "严重", "warning": "警告", "low": "提示"}

            for sev in severity_order:
                if sev not in by_severity:
                    continue
                items = by_severity[sev]
                md.append(f"### {icon_map[sev]} {label_map[sev]} ({len(items)} 条)")
                md.append("")

                for i, a in enumerate(items, 1):
                    md.append(f"#### {i}. [{a.category}] {a.description}")
                    md.append("")
                    md.append(f"**异常ID**: `{a.anomaly_id}`")
                    md.append("")
                    md.append(f"> {a.human_explanation}")
                    md.append("")
                    md.append(f"**建议操作**: `{a.suggested_action}`")
                    md.append("")
                    md.append("**可选操作**: " + ", ".join(f"`{opt}`" for opt in a.action_options))
                    md.append("")

                    if a.affected_records:
                        md.append("<details>")
                        md.append(f"<summary>查看受影响的 {len(a.affected_records)} 条记录</summary>")
                        md.append("")
                        md.append("```json")
                        md.append(json.dumps(a.affected_records[:5], ensure_ascii=False, indent=2))
                        if len(a.affected_records) > 5:
                            md.append(f"... 还有 {len(a.affected_records) - 5} 条")
                        md.append("```")
                        md.append("")
                        md.append("</details>")
                        md.append("")
        else:
            md.append("✅ 未检测到异常记录，数据质量良好。")
            md.append("")

        if manual_overrides:
            md.append("## 🛠️ 人工覆盖记录")
            md.append("")
            md.append("本次优化包含以下人工调整：")
            md.append("")
            md.append("| 调整时间 | 调整人 | 字段 | 原值 | 新值 | 原因 |")
            md.append("|----------|--------|------|------|------|------|")
            for ov in manual_overrides:
                md.append(
                    f"| {ov['applied_at']} | {ov['applied_by']} | {ov['field']} | "
                    f"`{ov['old_value']}` | `{ov['new_value']}` | {ov['reason']} |"
                )
            md.append("")

        md.append("## 📋 待办事项")
        md.append("")
        for i, item in enumerate(summary["action_items"], 1):
            md.append(f"{i}. [ ] {item}")
        md.append("")

        if optimization_result.warnings:
            md.append("## 💡 其他提示")
            md.append("")
            for w in optimization_result.warnings:
                md.append(f"- {w}")
            md.append("")

        md.append("---")
        md.append("")
        md.append("*此报告由航班超售优化系统自动生成，如有疑问请联系收益管理团队。*")
        md.append("")
        md.append(f"*结果版本: `{optimization_result.result_id}`*")

        content = "\n".join(md)

        if output_path:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"Markdown 报告已保存: {output_path}")

        return content

    def export_json(
        self,
        optimization_result: OptimizationResult,
        flight_info: FlightInfo,
        scenario_comparison: List[Dict[str, Any]],
        anomalies: List[AnomalyRecord],
        summary: Dict[str, Any],
        manual_overrides: Optional[List[Dict[str, Any]]] = None,
        data_issues: Optional[List[DataIssue]] = None,
        output_path: Optional[str] = None
    ) -> str:
        """导出 JSON 格式报告。

        包含完整的原始数据，便于复核和系统集成。
        """
        logger.info("生成 JSON 报告...")

        report_data = {
            "metadata": {
                "report_version": "1.0",
                "generated_at": datetime.now().isoformat(),
                "result_id": optimization_result.result_id,
                "request_id": optimization_result.request_id
            },
            "flight_info": {
                "flight_no": flight_info.flight_no,
                "flight_date": flight_info.flight_date.isoformat(),
                "departure": flight_info.departure,
                "arrival": flight_info.arrival,
                "scheduled_departure": flight_info.scheduled_departure.isoformat(),
                "capacity": {c.value: v for c, v in flight_info.capacity.items()}
            },
            "optimization_result": {
                "optimal_overbooking": {c.value: v for c, v in optimization_result.optimal_overbooking.items()},
                "expected_no_show_rate": {c.value: v for c, v in optimization_result.expected_no_show_rate.items()},
                "expected_revenue": round(optimization_result.expected_revenue, 2),
                "expected_compensation_cost": round(optimization_result.expected_compensation_cost, 2),
                "expected_net_profit": round(optimization_result.expected_net_profit, 2),
                "risk_level": optimization_result.risk_level,
                "risk_explanation": optimization_result.risk_explanation,
                "warnings": optimization_result.warnings
            },
            "scenario_comparison": scenario_comparison,
            "anomalies": [a.to_dict() for a in anomalies],
            "summary": {
                "headline": summary["headline"],
                "decision_guide": summary["decision_guide"],
                "anomaly_warning": summary["anomaly_warning"],
                "key_metrics": summary["key_metrics"],
                "action_items": summary["action_items"]
            },
            "manual_overrides": manual_overrides or []
        }

        if data_issues:
            report_data["data_issues"] = [
                {
                    "issue_id": di.issue_id,
                    "issue_type": di.issue_type,
                    "severity": di.severity,
                    "description": di.description,
                    "suggested_action": di.suggested_action,
                    "resolved": di.resolved
                }
                for di in data_issues if not di.resolved
            ]

        content = json.dumps(report_data, ensure_ascii=False, indent=2)

        if output_path:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"JSON 报告已保存: {output_path}")

        return content


class TerminalPresenter:
    """终端展示器 - 用人话在终端显示优化结果。"""

    def __init__(self):
        self.console = Console()

    def print_welcome(self):
        """打印欢迎信息。"""
        self.console.print()
        self.console.print(Panel.fit(
            "[bold cyan]✈️  航班超售补偿优化系统[/bold cyan]\n"
            "[dim]基于概率建模和成本优化的智能决策支持工具[/dim]",
            border_style="cyan"
        ))
        self.console.print()

    def print_loading_status(self, message: str, emoji: str = "📥"):
        """打印加载状态。"""
        self.console.print(f"  {emoji} {message}...")

    def print_data_issues_summary(self, issues: List[DataIssue]):
        """打印数据问题摘要。"""
        if not issues:
            self.console.print("  ✅ 数据加载完成，未发现问题")
            return

        by_severity: Dict[str, int] = {}
        for issue in issues:
            by_severity[issue.severity] = by_severity.get(issue.severity, 0) + 1

        self.console.print()
        self.console.print("  ⚠️  数据加载完成，发现以下问题：")

        sev_colors = {
            "critical": "[red]",
            "error": "[red]",
            "warning": "[yellow]",
            "info": "[blue]"
        }
        sev_labels = {
            "critical": "严重",
            "error": "错误",
            "warning": "警告",
            "info": "提示"
        }

        for sev, count in by_severity.items():
            color = sev_colors.get(sev, "")
            label = sev_labels.get(sev, sev)
            self.console.print(f"    {color}• {label}: {count} 条[/]")

        self.console.print("  [dim]详细异常记录将在报告中列出[/]")
        self.console.print()

    def print_optimization_result(
        self,
        optimization_result: OptimizationResult,
        flight_info: FlightInfo,
        summary: Dict[str, Any],
        anomalies: List[AnomalyRecord]
    ):
        """打印优化结果摘要。"""
        self.console.print()
        self.console.print(Panel(
            Text(summary["headline"], style="bold"),
            title="🎯 优化结果",
            border_style="green"
        ))
        self.console.print()

        self.console.print("[bold]📊 关键指标[/]")
        metrics_table = Table(show_header=True, header_style="bold magenta", box=box.SIMPLE)
        metrics_table.add_column("指标")
        metrics_table.add_column("数值", justify="right")
        metrics_table.add_column("说明")

        for metric in summary["key_metrics"]:
            metrics_table.add_row(
                metric["name"],
                f"{metric['value']:,} {metric['unit']}",
                Text(metric["explanation"], style="dim")
            )

        self.console.print(metrics_table)
        self.console.print()

        self.console.print("[bold]🚀 各舱位超售建议[/]")
        cabin_table = Table(show_header=True, header_style="bold blue", box=box.SIMPLE)
        cabin_table.add_column("舱位")
        cabin_table.add_column("容量", justify="right")
        cabin_table.add_column("已售", justify="right")
        cabin_table.add_column("建议超售", justify="right")
        cabin_table.add_column("超售比例", justify="right")
        cabin_table.add_column("爽约率", justify="right")
        cabin_table.add_column("风险")

        risk_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴"}

        from .cost_optimizer import CostOptimizer
        optimizer = CostOptimizer()

        for cabin in [CabinClass.FIRST, CabinClass.BUSINESS,
                      CabinClass.PREMIUM_ECONOMY, CabinClass.ECONOMY]:
            if cabin not in flight_info.capacity:
                continue

            cap = flight_info.capacity[cabin]
            ob = optimization_result.optimal_overbooking.get(cabin, 0)
            nsr = optimization_result.expected_no_show_rate.get(cabin, 0)
            cabin_orders = [o for o in optimization_result.__dict__.get('_flight_orders', [])
                           if o.cabin_class == cabin]
            booked = len(cabin_orders)
            ob_ratio = (ob / cap * 100) if cap > 0 else 0
            risk = optimization_result.risk_level if ob > 0 else "low"

            cabin_table.add_row(
                f"[bold]{cabin.name}[/]",
                str(cap),
                str(booked),
                f"[bold green]{ob}[/]" if ob > 0 else "0",
                f"{ob_ratio:.1f}%",
                f"{nsr*100:.1f}%",
                f"{risk_emoji.get(risk, '')} {risk.upper()}"
            )

        self.console.print(cabin_table)
        self.console.print()

        self.console.print("[bold]💡 风险说明[/]")
        self.console.print(f"  {optimization_result.risk_explanation}")
        self.console.print()

        self.console.print("[bold]📋 建议操作[/]")
        for i, action in enumerate(summary["action_items"], 1):
            self.console.print(f"  {i}. {action}")
        self.console.print()

        if anomalies:
            error_count = sum(1 for a in anomalies if a.severity == "error")
            warning_count = sum(1 for a in anomalies if a.severity == "warning")

            self.console.print()
            if error_count > 0:
                self.console.print(
                    f"[bold red]⚠️  检测到 {error_count} 个严重异常，"
                    f"{warning_count} 个警告，请人工复核后再执行！[/]"
                )
            else:
                self.console.print(
                    f"[bold yellow]ℹ️  检测到 {len(anomalies)} 个需要关注的异常，"
                    f"请在报告中查看详情。[/]"
                )
            self.console.print()

        if optimization_result.warnings:
            self.console.print("[bold yellow]💡 其他提示[/]")
            for w in optimization_result.warnings:
                self.console.print(f"  • {w}")
            self.console.print()

        self.console.print(summary["decision_guide"])
        self.console.print()

    def print_scenario_comparison(self, scenarios: List[Dict[str, Any]]):
        """打印情景对比。"""
        self.console.print("[bold]📈 多情景对比[/]")

        table = Table(show_header=True, header_style="bold cyan", box=box.SIMPLE)
        table.add_column("方案")
        table.add_column("总超售", justify="right")
        table.add_column("预计收入", justify="right")
        table.add_column("预计补偿", justify="right")
        table.add_column("预计净利", justify="right")
        table.add_column("最大超售概率", justify="right")
        table.add_column("与推荐差异", justify="right")

        for sc in scenarios:
            icon = sc.get("icon", "")
            name = f"{icon} {sc['scenario']}"
            delta = sc['vs_recommended_delta']
            delta_str = f"[green]+¥{delta:,.0f}[/]" if delta >= 0 else f"[red]-¥{abs(delta):,.0f}[/]"
            prob = sc['max_denied_probability'] * 100

            style = "bold" if sc['scenario'] == "推荐方案" else ""

            table.add_row(
                Text(name, style=style),
                str(sc['total_overbooking']),
                f"¥{sc['expected_revenue']:,.0f}",
                f"¥{sc['expected_compensation']:,.0f}",
                f"¥{sc['expected_net_profit']:,.0f}",
                f"{prob:.1f}%",
                delta_str if sc['scenario'] != "推荐方案" else "—"
            )

        self.console.print(table)
        self.console.print()

    def print_report_saved(self, md_path: Optional[str], json_path: Optional[str]):
        """打印报告保存信息。"""
        self.console.print()
        self.console.print(Panel(
            "[bold]📄 报告已生成[/]\n" +
            (f"  Markdown: [blue]{md_path}[/]\n" if md_path else "") +
            (f"  JSON:     [blue]{json_path}[/]" if json_path else ""),
            border_style="green"
        ))
        self.console.print()

    def print_rollback_success(self, record_id: str):
        """打印回滚成功信息。"""
        self.console.print()
        self.console.print(f"  ✅ 记录 [bold]{record_id}[/] 已成功回滚")
        self.console.print()

    def print_override_success(self, field: str, old: Any, new: Any):
        """打印人工覆盖成功信息。"""
        self.console.print()
        self.console.print(
            f"  ✅ 已人工覆盖 [bold]{field}[/]: "
            f"[strike]{old}[/] → [bold green]{new}[/]"
        )
        self.console.print()

    def print_error(self, message: str):
        """打印错误信息。"""
        self.console.print()
        self.console.print(f"  [bold red]❌ 错误:[/] {message}")
        self.console.print()

    def print_success(self, message: str):
        """打印成功信息。"""
        self.console.print()
        self.console.print(f"  ✅ {message}")
        self.console.print()
