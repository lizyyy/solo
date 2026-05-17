import json
import csv
from datetime import datetime
from typing import List
import pandas as pd
from ..models import BillingReport, CalculationResult, ValidationError


class ReportExporter:
    @staticmethod
    def to_json(report: BillingReport, file_path: str) -> None:
        data = json.loads(report.model_dump_json())
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def to_csv(report: BillingReport, file_path: str) -> None:
        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["仓租计费排查报告"])
            writer.writerow(["报告ID", report.report_id])
            writer.writerow(["生成时间", report.generated_at.strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow([])
            writer.writerow(["汇总统计"])
            writer.writerow(["总记录数", report.total_records])
            writer.writerow(["有效记录数", report.valid_records])
            writer.writerow(["无效记录数", report.invalid_records])
            writer.writerow(["总基础金额", round(report.total_base_amount, 2)])
            writer.writerow(["总折扣金额", round(report.total_discount_amount, 2)])
            writer.writerow(["总最终金额", round(report.total_final_amount, 2)])
            writer.writerow([])
            writer.writerow(["计费明细"])
            writer.writerow([
                "客户ID", "客户名称", "库位", "体积(m³)", "原始天数",
                "退仓截断天数", "有效天数", "免租天数", "计费天数",
                "体积单价", "天数折扣率", "日费率", "基础金额",
                "折扣金额", "最终金额", "计算说明", "警告信息"
            ])
            for result in report.results:
                writer.writerow([
                    result.customer_id,
                    result.customer_name,
                    result.warehouse_location,
                    result.volume,
                    result.raw_occupancy_days,
                    result.checkout_truncated_days,
                    result.effective_occupancy_days,
                    result.free_rent_days_applied,
                    result.billable_days,
                    result.volume_tier_price,
                    result.days_discount_rate,
                    result.daily_rate,
                    result.base_amount,
                    result.discount_amount,
                    result.final_amount,
                    json.dumps(result.calculation_details, ensure_ascii=False),
                    " | ".join(result.warnings),
                ])
            writer.writerow([])
            writer.writerow(["异常记录"])
            writer.writerow(["行号", "字段", "错误类型", "错误信息", "异常值"])
            for error in report.errors:
                writer.writerow([
                    error.row_number,
                    error.field,
                    error.error_type,
                    error.message,
                    error.value,
                ])

    @staticmethod
    def to_excel(report: BillingReport, file_path: str) -> None:
        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            summary_data = {
                "项目": [
                    "报告ID", "生成时间", "总记录数", "有效记录数",
                    "无效记录数", "总基础金额", "总折扣金额", "总最终金额"
                ],
                "值": [
                    report.report_id,
                    report.generated_at.strftime("%Y-%m-%d %H:%M:%S"),
                    report.total_records,
                    report.valid_records,
                    report.invalid_records,
                    round(report.total_base_amount, 2),
                    round(report.total_discount_amount, 2),
                    round(report.total_final_amount, 2),
                ],
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name="报告汇总", index=False)

            results_data = []
            for result in report.results:
                results_data.append({
                    "客户ID": result.customer_id,
                    "客户名称": result.customer_name,
                    "库位": result.warehouse_location,
                    "体积(m³)": result.volume,
                    "原始天数": result.raw_occupancy_days,
                    "退仓截断天数": result.checkout_truncated_days,
                    "有效天数": result.effective_occupancy_days,
                    "免租天数": result.free_rent_days_applied,
                    "计费天数": result.billable_days,
                    "体积单价": result.volume_tier_price,
                    "天数折扣率": result.days_discount_rate,
                    "日费率": result.daily_rate,
                    "基础金额": result.base_amount,
                    "折扣金额": result.discount_amount,
                    "最终金额": result.final_amount,
                    "计算说明": json.dumps(result.calculation_details, ensure_ascii=False),
                    "警告信息": " | ".join(result.warnings),
                })
            pd.DataFrame(results_data).to_excel(writer, sheet_name="计费明细", index=False)

            errors_data = []
            for error in report.errors:
                errors_data.append({
                    "行号": error.row_number,
                    "字段": error.field,
                    "错误类型": error.error_type,
                    "错误信息": error.message,
                    "异常值": error.value,
                })
            if errors_data:
                pd.DataFrame(errors_data).to_excel(writer, sheet_name="异常记录", index=False)

    @staticmethod
    def print_console_report(report: BillingReport) -> None:
        from rich.console import Console
        from rich.table import Table
        from rich.panel import Panel

        console = Console()

        console.print(
            Panel.fit(
                f"[bold blue]仓租阶梯免租退仓截断排查报告[/bold blue]\n"
                f"报告ID: {report.report_id}\n"
                f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
                border_style="blue",
            )
        )

        summary_table = Table(title="汇总统计", show_header=True, header_style="bold magenta")
        summary_table.add_column("项目")
        summary_table.add_column("数值", justify="right")
        summary_table.add_row("总记录数", str(report.total_records))
        summary_table.add_row("有效记录数", f"[green]{report.valid_records}[/green]")
        summary_table.add_row("无效记录数", f"[red]{report.invalid_records}[/red]")
        summary_table.add_row("总基础金额", f"¥{report.total_base_amount:,.2f}")
        summary_table.add_row("总折扣金额", f"¥{report.total_discount_amount:,.2f}")
        summary_table.add_row("总最终金额", f"[bold]¥{report.total_final_amount:,.2f}[/bold]")
        console.print(summary_table)

        if report.results:
            results_table = Table(title="计费明细", show_header=True, header_style="bold cyan")
            results_table.add_column("客户ID")
            results_table.add_column("客户名称")
            results_table.add_column("体积", justify="right")
            results_table.add_column("原始天数", justify="right")
            results_table.add_column("截断天数", justify="right")
            results_table.add_column("计费天数", justify="right")
            results_table.add_column("最终金额", justify="right")
            for result in report.results[:10]:
                results_table.add_row(
                    result.customer_id,
                    result.customer_name,
                    f"{result.volume}m³",
                    str(result.raw_occupancy_days),
                    str(result.checkout_truncated_days),
                    str(result.billable_days),
                    f"¥{result.final_amount:,.2f}",
                )
            if len(report.results) > 10:
                results_table.add_row("...", f"共{len(report.results)}条记录", "", "", "", "", "")
            console.print(results_table)

        if report.errors:
            error_table = Table(title="异常记录", show_header=True, header_style="bold red")
            error_table.add_column("行号", justify="right")
            error_table.add_column("字段")
            error_table.add_column("错误类型")
            error_table.add_column("错误信息")
            for error in report.errors[:10]:
                error_table.add_row(
                    str(error.row_number),
                    error.field,
                    error.error_type,
                    error.message,
                )
            if len(report.errors) > 10:
                error_table.add_row("", "", f"共{len(report.errors)}条异常", "")
            console.print(error_table)

        console.print(
            Panel.fit(
                "[green]✓ 报告生成完成[/green]\n"
                f"详细报告已导出至output目录",
                border_style="green",
            )
        )
