import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import BatchExecutionReport, RiskType


class ReportGenerator:
    def __init__(self):
        self.console = Console()

    def print_console_report(
        self,
        report: BatchExecutionReport,
        suggestions: list = None,
        preview_data: dict = None
    ) -> None:
        self._print_header(report)
        self._print_execution_summary(report)
        self._print_before_after_comparison(report, suggestions)
        self._print_grayscale_notes(report)
        self._print_next_steps(report)

    def _print_header(self, report: BatchExecutionReport) -> None:
        title = Text("数据修复预演执行报告", style="bold blue")
        subtitle = Text(f"批次ID: {report.batch_id}", style="dim")
        self.console.print(Panel(Text.assemble(title, "\n", subtitle)))

    def _print_execution_summary(self, report: BatchExecutionReport) -> None:
        table = Table(title="执行摘要")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="magenta")

        duration = (report.end_time - report.start_time).total_seconds() if report.end_time else 0

        table.add_row("批次ID", report.batch_id)
        table.add_row("操作者", report.operator)
        table.add_row("开始时间", report.start_time.strftime("%Y-%m-%d %H:%M:%S"))
        table.add_row("结束时间", report.end_time.strftime("%Y-%m-%d %H:%M:%S") if report.end_time else "-")
        table.add_row("执行耗时", f"{duration:.2f} 秒")
        table.add_row("总处理数", str(report.total_count))
        table.add_row("成功数", f"[green]{report.success_count}[/green]")
        table.add_row("失败数", f"[red]{report.failed_count}[/red]")
        table.add_row("跳过数", str(report.skipped_count))

        self.console.print(table)

    def _print_before_after_comparison(self, report: BatchExecutionReport, suggestions: list = None) -> None:
        suggestion_map = {s.order_id: s for s in suggestions} if suggestions else {}

        table = Table(title="处理前后对比", show_lines=True)
        table.add_column("工单ID", style="cyan", no_wrap=True)
        table.add_column("风险类型", style="magenta")
        table.add_column("字段路径", style="yellow", width=40)
        table.add_column("原值", style="red")
        table.add_column("新值", style="green")
        table.add_column("原始行号", style="dim")
        table.add_column("处理依据", style="blue", width=50)

        for record in report.fix_records:
            suggestion = suggestion_map.get(record.order_id)
            basis = suggestion.basis if suggestion else "根据业务规则处理"
            original_row = str(suggestion.original_row_index) if suggestion else "-"

            risk_display = record.risk_type.value
            if record.risk_type == RiskType.PERMISSION_OVER_GRANTED:
                risk_display = f"[bold red]{risk_display}[/bold red]"
            elif record.risk_type == RiskType.GRAYSCALE_RECORD:
                risk_display = f"[bold yellow]{risk_display}[/bold yellow]"

            table.add_row(
                record.order_id,
                risk_display,
                record.field_path,
                str(record.old_value),
                str(record.new_value),
                original_row,
                basis
            )

        self.console.print(table)

    def _print_grayscale_notes(self, report: BatchExecutionReport) -> None:
        if not report.grayscale_notes:
            return

        self.console.print("\n")
        table = Table(title="灰度发布备忘 - 人工修正记录", show_lines=True)
        table.add_column("记录ID", style="cyan")
        table.add_column("字段路径", style="yellow")
        table.add_column("来源", style="magenta")
        table.add_column("修正内容", style="green")
        table.add_column("处理依据", style="blue", width=50)

        for note in report.grayscale_notes:
            table.add_row(
                note["record_id"],
                note["field_path"],
                note["field_path"],
                note["content"],
                note["basis"]
            )

        self.console.print(table)

    def _print_next_steps(self, report: BatchExecutionReport) -> None:
        self.console.print("\n")
        table = Table(title="下一步建议", show_header=False)
        table.add_column("序号", style="cyan")
        table.add_column("建议内容", style="white")

        for idx, step in enumerate(report.next_steps, 1):
            table.add_row(str(idx), step)

        self.console.print(table)

    def export_json_report(
        self,
        report: BatchExecutionReport,
        filepath: str,
        suggestions: list = None
    ) -> None:
        suggestion_map = {s.order_id: s for s in suggestions} if suggestions else {}

        report_data = {
            "batch_id": report.batch_id,
            "operator": report.operator,
            "start_time": report.start_time.isoformat(),
            "end_time": report.end_time.isoformat() if report.end_time else None,
            "execution_duration_seconds": (
                (report.end_time - report.start_time).total_seconds()
                if report.end_time else 0
            ),
            "summary": {
                "total_count": report.total_count,
                "success_count": report.success_count,
                "failed_count": report.failed_count,
                "skipped_count": report.skipped_count
            },
            "fix_records_with_details": [],
            "grayscale_notes": report.grayscale_notes,
            "next_steps": report.next_steps
        }

        for record in report.fix_records:
            suggestion = suggestion_map.get(record.order_id)
            record_data = {
                "order_id": record.order_id,
                "risk_type": record.risk_type.value,
                "field_path": record.field_path,
                "source_field_path": record.field_path,
                "old_value": record.old_value,
                "new_value": record.new_value,
                "result": record.result.value,
                "error_message": record.error_message,
                "executed_at": record.executed_at.isoformat(),
                "original_row_index": suggestion.original_row_index if suggestion else None,
                "reason": suggestion.reason if suggestion else None,
                "basis": suggestion.basis if suggestion else None
            }
            report_data["fix_records_with_details"].append(record_data)

        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

    def print_preview(self, preview_data: Dict[str, Any]) -> None:
        self.console.print(Panel("[bold yellow]批量操作预览 - 请确认影响范围[/bold yellow]"))

        summary_table = Table(title="影响范围摘要")
        summary_table.add_column("项目", style="cyan")
        summary_table.add_column("数量", style="magenta")
        summary_table.add_row("总工单数", str(preview_data["total_orders"]))
        summary_table.add_row("待修复项数", str(preview_data["total_suggestions"]))
        self.console.print(summary_table)

        risk_table = Table(title="风险类型统计")
        risk_table.add_column("风险类型", style="cyan")
        risk_table.add_column("数量", style="magenta")
        for risk_type, count in preview_data["risk_summary"].items():
            risk_table.add_row(risk_type, str(count))
        self.console.print(risk_table)

        affected_table = Table(title="受影响工单列表")
        affected_table.add_column("工单ID", style="cyan")
        for order_id in preview_data["affected_orders"]:
            affected_table.add_row(order_id)
        self.console.print(affected_table)

        preview_table = Table(title="修复项详情预览", show_lines=True)
        preview_table.add_column("工单ID", style="cyan")
        preview_table.add_column("风险类型", style="magenta")
        preview_table.add_column("字段路径", style="yellow")
        preview_table.add_column("原值", style="red")
        preview_table.add_column("建议值", style="green")
        preview_table.add_column("原始行号", style="dim")

        for item in preview_data["before_after_preview"]:
            preview_table.add_row(
                item["order_id"],
                item.get("risk_type", "unknown"),
                item["field_path"],
                str(item["before"]),
                str(item["after"]),
                str(item["original_row_index"])
            )
        self.console.print(preview_table)
