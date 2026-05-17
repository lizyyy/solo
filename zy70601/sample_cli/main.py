import os
from pathlib import Path
from typing import List, Optional
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .parser import DataParser
from .rules import RuleEngine
from .approval import ApprovalManager
from .report import ReportGenerator
from .models import SampleRecord, RejectionReason, ApprovalStatus

console = Console()


class SampleHandoverCLI:
    def __init__(self):
        self.parser = DataParser()
        self.rule_engine = RuleEngine()
        self.approval_manager: Optional[ApprovalManager] = None
        self.report_generator = ReportGenerator()
        self.records: List[SampleRecord] = []

    def load_files(self, file_paths: List[str], approval_store: Optional[str] = None):
        all_records = []
        for file_path in file_paths:
            if not os.path.exists(file_path):
                console.print(f"[red]警告: 文件不存在 - {file_path}[/red]")
                continue
            try:
                records = self.parser.parse_file(file_path)
                all_records.extend(records)
                console.print(f"[green]已加载: {file_path} - {len(records)} 条记录[/green]")
            except Exception as e:
                console.print(f"[red]加载失败: {file_path} - {str(e)}[/red]")

        self.records = sorted(all_records, key=lambda x: (x.source_file, x.source_row))

        if approval_store:
            self.approval_manager = ApprovalManager(approval_store)
            self.records = self.approval_manager.restore_approvals(self.records)

        return self.records

    def validate(self):
        if not self.records:
            console.print("[yellow]没有记录需要验证[/yellow]")
            return None
        result = self.rule_engine.validate(self.records)
        return result

    def show_validation_summary(self):
        result = self.validate()
        if not result:
            return

        console.print(Panel.fit(
            "\n".join([
                f"总记录数: {result.total_records}",
                f"有效记录: [green]{result.valid_records}[/green]",
                f"无效记录: [red]{result.invalid_records}[/red]",
                f"拒收记录: [orange]{result.rejected_records}[/orange]",
                f"待审批: [yellow]{result.pending_approval}[/yellow]",
                f"重复条码: [red]{len(result.barcode_duplicates)}[/red] 个",
                f"接收超时: [orange]{len(result.time_expired)}[/orange] 条",
            ]),
            title="验证结果摘要",
            border_style="blue"
        ))

    def show_duplicates(self):
        duplicates = self.rule_engine.get_duplicate_groups(self.records)
        if not duplicates:
            console.print("[green]没有发现重复条码[/green]")
            return

        for barcode, group in duplicates.items():
            console.print(f"\n[bold red]重复条码: {barcode} ({len(group)} 条)[/bold red]")
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("来源文件")
            table.add_column("行号")
            table.add_column("采样时间")
            table.add_column("运输人")
            table.add_column("接收时间")

            for record in group:
                table.add_row(
                    record.source_file,
                    str(record.source_row),
                    record.sampling_time.strftime("%Y-%m-%d %H:%M") if record.sampling_time else "-",
                    record.transporter or "-",
                    record.receive_time.strftime("%Y-%m-%d %H:%M") if record.receive_time else "-",
                )
            console.print(table)

    def show_rejected(self):
        rejected = self.rule_engine.get_rejected_records(self.records)
        if not rejected:
            console.print("[green]没有拒收记录[/green]")
            return

        console.print(f"\n[bold orange]拒收记录共 {len(rejected)} 条[/bold orange]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("来源")
        table.add_column("行号")
        table.add_column("条码")
        table.add_column("拒收原因")
        table.add_column("审批状态")
        table.add_column("错误")

        for record in rejected:
            table.add_row(
                record.source_file,
                str(record.source_row),
                record.barcode,
                record.rejection_reason.value if record.rejection_reason else "-",
                record.approval_status.value,
                "; ".join(record.errors[:2]) if record.errors else "-",
            )
        console.print(table)

    def show_pending_approval(self):
        pending = self.rule_engine.get_records_needing_approval(self.records)
        if not pending:
            console.print("[green]没有待审批记录[/green]")
            return

        console.print(f"\n[bold yellow]待审批记录共 {len(pending)} 条[/bold yellow]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("来源")
        table.add_column("行号")
        table.add_column("条码")
        table.add_column("拒收原因")
        table.add_column("错误")

        for record in pending:
            table.add_row(
                record.source_file,
                str(record.source_row),
                record.barcode,
                record.rejection_reason.value if record.rejection_reason else "-",
                "; ".join(record.errors[:2]) if record.errors else "-",
            )
        console.print(table)

    def show_invalid(self):
        invalid = [r for r in self.records if not r.is_valid]
        if not invalid:
            console.print("[green]没有无效记录[/green]")
            return

        console.print(f"\n[bold red]无效记录共 {len(invalid)} 条[/bold red]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("来源文件")
        table.add_column("行号")
        table.add_column("原始条码")
        table.add_column("错误信息")

        for record in invalid:
            table.add_row(
                record.source_file,
                str(record.source_row),
                record.barcode,
                "; ".join(record.errors),
            )
        console.print(table)

    def export_reports(self, output_dir: str):
        result = self.validate()
        if not result:
            console.print("[yellow]没有数据可导出[/yellow]")
            return

        report = self.report_generator.generate_report(self.records, result)

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        csv_path = self.report_generator.export_csv(report, str(output_path / "handover_report.csv"))
        json_path = self.report_generator.export_json(report, str(output_path / "handover_report.json"))
        txt_path = self.report_generator.export_summary_txt(report, str(output_path / "handover_summary.txt"))

        console.print(f"[green]报告已导出到: {output_dir}[/green]")
        console.print(f"  - CSV: {csv_path}")
        console.print(f"  - JSON: {json_path}")
        console.print(f"  - 摘要: {txt_path}")

    def approve_all(self, approver: str, override_rejection: bool = False):
        if not self.approval_manager:
            console.print("[red]错误: 未指定审批存储路径，请使用 --approval-store 参数[/red]")
            return

        pending = self.rule_engine.get_records_needing_approval(self.records)
        if not pending:
            console.print("[green]没有待审批记录[/green]")
            return

        self.approval_manager.batch_approve(pending, approver, override_rejection)
        console.print(f"[green]已批量审批 {len(pending)} 条记录[/green]")

    def find_by_barcode(self, barcode: str):
        found = self.rule_engine.get_records_by_barcode(self.records, barcode)
        if not found:
            console.print(f"[yellow]未找到条码: {barcode}[/yellow]")
            return

        console.print(f"\n[bold blue]找到 {len(found)} 条条码为 {barcode} 的记录[/bold blue]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("来源文件")
        table.add_column("行号")
        table.add_column("采样时间")
        table.add_column("运输人")
        table.add_column("接收时间")
        table.add_column("是否拒收")
        table.add_column("审批状态")

        for record in found:
            table.add_row(
                record.source_file,
                str(record.source_row),
                record.sampling_time.strftime("%Y-%m-%d %H:%M") if record.sampling_time else "-",
                record.transporter or "-",
                record.receive_time.strftime("%Y-%m-%d %H:%M") if record.receive_time else "-",
                "[red]是[/red]" if record.is_rejected else "[green]否[/green]",
                record.approval_status.value,
            )
        console.print(table)


@click.group()
@click.option("--files", "-f", multiple=True, help="输入文件路径(可多次指定)")
@click.option("--approval-store", "-a", help="审批记录存储路径")
@click.pass_context
def cli(ctx, files, approval_store):
    """检验样本交接拒收原因补录审批排查CLI工具"""
    ctx.ensure_object(dict)
    cli_instance = SampleHandoverCLI()
    ctx.obj["cli"] = cli_instance
    ctx.obj["files"] = files
    ctx.obj["approval_store"] = approval_store

    if files:
        cli_instance.load_files(list(files), approval_store)


@cli.command()
@click.pass_context
def validate(ctx):
    """验证所有记录"""
    cli_instance = ctx.obj["cli"]
    cli_instance.show_validation_summary()
    cli_instance.show_duplicates()
    cli_instance.show_invalid()
    cli_instance.show_rejected()
    cli_instance.show_pending_approval()


@cli.command()
@click.option("--duplicates/--no-duplicates", default=False, help="显示重复条码")
@click.option("--rejected/--no-rejected", default=False, help="显示拒收记录")
@click.option("--invalid/--no-invalid", default=False, help="显示无效记录")
@click.option("--pending/--no-pending", default=False, help="显示待审批记录")
@click.pass_context
def show(ctx, duplicates, rejected, invalid, pending):
    """显示各类记录"""
    cli_instance = ctx.obj["cli"]
    cli_instance.show_validation_summary()

    if duplicates:
        cli_instance.show_duplicates()
    if rejected:
        cli_instance.show_rejected()
    if invalid:
        cli_instance.show_invalid()
    if pending:
        cli_instance.show_pending_approval()

    if not any([duplicates, rejected, invalid, pending]):
        cli_instance.show_duplicates()
        cli_instance.show_invalid()
        cli_instance.show_rejected()
        cli_instance.show_pending_approval()


@cli.command()
@click.argument("barcode")
@click.pass_context
def find(ctx, barcode):
    """按条码查找记录"""
    cli_instance = ctx.obj["cli"]
    cli_instance.find_by_barcode(barcode)


@cli.command()
@click.option("--output", "-o", required=True, help="输出目录")
@click.pass_context
def export(ctx, output):
    """导出交接报告"""
    cli_instance = ctx.obj["cli"]
    cli_instance.export_reports(output)


@cli.command()
@click.option("--approver", "-p", required=True, help="审批人姓名")
@click.option("--override/--no-override", default=False, help="解除拒收状态")
@click.pass_context
def approve(ctx, approver, override):
    """批量审批所有待审批记录"""
    cli_instance = ctx.obj["cli"]
    cli_instance.approve_all(approver, override)


@cli.command()
@click.option("--output", "-o", default="sample_data", help="测试数据输出目录")
def generate_test_data(output):
    """生成测试数据"""
    import csv
    from datetime import datetime, timedelta

    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)

    base_time = datetime.now()

    data1 = [
        ["条码", "采样时间", "运输人", "运输批次", "接收时间", "接收窗口"],
        ["S001", (base_time - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), "张三", "BATCH001", (base_time - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"), "上午"],
        ["S002", (base_time - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"), "李四", "BATCH001", (base_time - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S"), "上午"],
        ["S003", (base_time - timedelta(hours=26)).strftime("%Y-%m-%d %H:%M:%S"), "王五", "BATCH001", base_time.strftime("%Y-%m-%d %H:%M:%S"), "下午"],
        ["S001", (base_time - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"), "赵六", "BATCH002", (base_time - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), "下午"],
        ["S004", "", "钱七", "BATCH002", base_time.strftime("%Y-%m-%d %H:%M:%S"), "下午"],
    ]

    data2 = [
        ["样本条码", "采样时间", "运输人", "运输批次", "接收时间", "拒收原因"],
        ["S005", (base_time - timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"), "孙八", "BATCH003", (base_time - timedelta(hours=9)).strftime("%Y-%m-%d %H:%M:%S"), ""],
        ["S006", (base_time - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), "", "BATCH003", (base_time - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"), "样本破损"],
        ["S003", (base_time - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"), "周九", "BATCH003", (base_time - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), ""],
        ["S007", (base_time - timedelta(hours=28)).strftime("%Y-%m-%d %H:%M:%S"), "吴十", "BATCH004", base_time.strftime("%Y-%m-%d %H:%M:%S"), ""],
    ]

    with open(output_path / "batch01.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(data1)

    with open(output_path / "batch02.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(data2)

    console.print(f"[green]测试数据已生成到: {output_path}[/green]")
    console.print(f"  - batch01.csv ({len(data1)-1} 条记录)")
    console.print(f"  - batch02.csv ({len(data2)-1} 条记录)")
    console.print(f"\n[yellow]提示: 运行以下命令开始验证:[/yellow]")
    console.print(f"  sample-cli -f {output_path / 'batch01.csv'} -f {output_path / 'batch02.csv'} validate")


if __name__ == "__main__":
    cli()
