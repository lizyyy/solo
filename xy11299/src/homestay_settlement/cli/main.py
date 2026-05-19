import click
from datetime import datetime
from rich.console import Console
from rich.table import Table

from ..models import init_db, SessionLocal
from ..importers import RoomStatusImporter, CleaningRecordImporter, PhotoImporter
from ..services import CleaningRuleEngine, ReviewService, SettlementService
from ..exporters import CSVExporter

console = Console()


@click.group()
def cli():
    """民宿保洁结算管理工具"""
    init_db()


@cli.group()
def import_data():
    """导入数据"""
    pass


@import_data.command()
@click.argument("file_path")
@click.option("--operator", default="system", help="操作人")
def room_status(file_path, operator):
    """导入房态数据 CSV 文件"""
    db = SessionLocal()
    try:
        importer = RoomStatusImporter(db, operator)
        result = importer.import_file(file_path)

        table = Table(title="房态数据导入结果")
        table.add_column("项目", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_row("成功导入", str(result.success_count))
        table.add_row("失败数量", str(result.error_count))
        console.print(table)

        if result.errors:
            error_table = Table(title="导入错误详情")
            error_table.add_column("行号", style="red")
            error_table.add_column("错误信息", style="yellow")
            for error in result.errors[:5]:
                error_table.add_row(str(error.source_row or ""), error.error_message)
            if len(result.errors) > 5:
                error_table.add_row("", f"... 还有 {len(result.errors) - 5} 条错误")
            console.print(error_table)
    finally:
        db.close()


@import_data.command()
@click.argument("file_path")
@click.option("--operator", default="system", help="操作人")
def cleaning_records(file_path, operator):
    """导入保洁记录 JSON 文件"""
    db = SessionLocal()
    try:
        importer = CleaningRecordImporter(db, operator)
        result = importer.import_file(file_path)

        table = Table(title="保洁记录导入结果")
        table.add_column("项目", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_row("成功导入", str(result.success_count))
        table.add_row("失败数量", str(result.error_count))
        console.print(table)

        if result.errors:
            error_table = Table(title="导入错误详情")
            error_table.add_column("行号", style="red")
            error_table.add_column("错误信息", style="yellow")
            for error in result.errors[:5]:
                error_table.add_row(str(error.source_row or ""), error.error_message)
            if len(result.errors) > 5:
                error_table.add_row("", f"... 还有 {len(result.errors) - 5} 条错误")
            console.print(error_table)
    finally:
        db.close()


@import_data.command()
@click.argument("file_path")
@click.option("--operator", default="system", help="操作人")
def photos(file_path, operator):
    """导入照片清单 CSV 文件"""
    db = SessionLocal()
    try:
        importer = PhotoImporter(db, operator)
        result = importer.import_file(file_path)

        table = Table(title="照片清单导入结果")
        table.add_column("项目", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_row("成功导入", str(result.success_count))
        table.add_row("失败数量", str(result.error_count))
        console.print(table)

        if result.errors:
            error_table = Table(title="导入错误详情")
            error_table.add_column("行号", style="red")
            error_table.add_column("错误信息", style="yellow")
            for error in result.errors[:5]:
                error_table.add_row(str(error.source_row or ""), error.error_message)
            if len(result.errors) > 5:
                error_table.add_row("", f"... 还有 {len(result.errors) - 5} 条错误")
            console.print(error_table)
    finally:
        db.close()


@cli.group()
def rules():
    """规则引擎操作"""
    pass


@rules.command()
@click.argument("start_date")
@click.argument("end_date")
@click.option("--operator", default="system", help="操作人")
def run(start_date, end_date, operator):
    """运行规则引擎，自动生成问题"""
    db = SessionLocal()
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        engine = CleaningRuleEngine(db)
        result = engine.run_batch_rules(start, end)

        table = Table(title="规则引擎执行结果")
        table.add_column("项目", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_row("处理保洁记录", str(result["processed_records"]))
        table.add_row("生成问题", str(result["total_issues_created"]))
        console.print(table)
    finally:
        db.close()


@cli.group()
def review():
    """复核操作"""
    pass


@review.command()
@click.option("--cleaner-id", type=int, help="保洁员ID")
def list_pending(cleaner_id):
    """列出待复核的问题"""
    db = SessionLocal()
    try:
        service = ReviewService(db)
        issues = service.get_pending_issues(cleaner_id)

        if not issues:
            console.print("[green]没有待复核的问题[/green]")
            return

        table = Table(title="待复核问题列表")
        table.add_column("ID", style="cyan")
        table.add_column("类型", style="magenta")
        table.add_column("描述", style="yellow")
        table.add_column("扣款金额", style="red")
        table.add_column("状态", style="blue")

        for issue in issues[:10]:
            table.add_row(
                str(issue.id),
                issue.issue_type,
                issue.description[:30] + "..." if len(issue.description) > 30 else issue.description,
                str(issue.deduction_amount),
                issue.deduction_status,
            )
        if len(issues) > 10:
            console.print(f"[yellow]还有 {len(issues) - 10} 条记录未显示[/yellow]")
        console.print(table)
    finally:
        db.close()


@review.command()
@click.argument("issue_id", type=int)
@click.option("--notes", default="", help="备注")
@click.option("--operator", default="system", help="操作人")
def confirm(issue_id, notes, operator):
    """确认扣款"""
    db = SessionLocal()
    try:
        service = ReviewService(db, operator)
        issue = service.confirm_deduction(issue_id, notes)
        if issue:
            console.print(f"[green]问题 {issue_id} 扣款已确认[/green]")
        else:
            console.print("[red]问题不存在或无法确认[/red]")
    finally:
        db.close()


@review.command()
@click.argument("issue_id", type=int)
@click.option("--reason", required=True, help="申诉理由")
@click.option("--operator", default="system", help="操作人")
def appeal(issue_id, reason, operator):
    """申诉问题"""
    db = SessionLocal()
    try:
        service = ReviewService(db, operator)
        issue = service.appeal_issue(issue_id, reason)
        if issue:
            console.print(f"[green]问题 {issue_id} 已提交申诉[/green]")
        else:
            console.print("[red]问题不存在或无法申诉[/red]")
    finally:
        db.close()


@review.command()
@click.argument("issue_id", type=int)
@click.option("--notes", required=True, help="处理意见")
@click.option("--adjust-amount", type=float, help="调整扣款金额")
@click.option("--operator", default="system", help="操作人")
def resolve(issue_id, notes, adjust_amount, operator):
    """处理申诉并最终确认"""
    db = SessionLocal()
    try:
        service = ReviewService(db, operator)
        issue = service.resolve_issue(issue_id, notes, adjust_amount)
        if issue:
            console.print(f"[green]问题 {issue_id} 已处理完成[/green]")
        else:
            console.print("[red]问题不存在或无法处理[/red]")
    finally:
        db.close()


@cli.group()
def settlement():
    """结算操作"""
    pass


@settlement.command()
@click.argument("month")
@click.option("--operator", default="system", help="操作人")
def summary(month, operator):
    """生成月度结算汇总"""
    db = SessionLocal()
    try:
        service = SettlementService(db, operator)
        result = service.get_monthly_summary(month)

        table = Table(title=f"{month} 月度结算汇总")
        table.add_column("保洁员", style="cyan")
        table.add_column("保洁次数", style="magenta")
        table.add_column("基础金额", style="green")
        table.add_column("扣款总额", style="red")
        table.add_column("实发金额", style="blue")
        table.add_column("状态", style="yellow")

        for s in result["settlements"]:
            table.add_row(
                s["cleaner_name"],
                str(s["total_cleanings"]),
                f"{s['base_amount']:.2f}",
                f"{s['total_deductions']:.2f}",
                f"{s['final_amount']:.2f}",
                "已确认" if s["is_finalized"] else "待确认",
            )

        console.print(table)
        console.print(f"\n[bold]总计:[/bold] 保洁员 {result['cleaners_count']} 人, "
                      f"总保洁次数 {result['total_cleanings']}, "
                      f"实发总额 {result['total_final_amount']:.2f} 元")
    finally:
        db.close()


@settlement.command()
@click.argument("settlement_id", type=int)
@click.option("--operator", default="system", help="操作人")
def finalize(settlement_id, operator):
    """确认结算单"""
    db = SessionLocal()
    try:
        service = SettlementService(db, operator)
        settlement = service.finalize_settlement(settlement_id)
        if settlement:
            console.print(f"[green]结算单 {settlement_id} 已确认[/green]")
        else:
            console.print("[red]结算单不存在或已确认[/red]")
    finally:
        db.close()


@cli.group()
def export():
    """导出数据"""
    pass


@export.command()
@click.argument("month")
@click.option("--output-dir", default="./output", help="输出目录")
def settlements(month, output_dir):
    """导出月度结算报表"""
    db = SessionLocal()
    try:
        exporter = CSVExporter(db, output_dir)
        filepath = exporter.export_settlements(month)
        console.print(f"[green]结算报表已导出到: {filepath}[/green]")
    finally:
        db.close()


@export.command()
@click.argument("start_date")
@click.argument("end_date")
@click.option("--output-dir", default="./output", help="输出目录")
def cleaning_records(start_date, end_date, output_dir):
    """导出保洁记录"""
    db = SessionLocal()
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        exporter = CSVExporter(db, output_dir)
        filepath = exporter.export_cleaning_records(start, end)
        console.print(f"[green]保洁记录已导出到: {filepath}[/green]")
    finally:
        db.close()


@export.command()
@click.option("--output-dir", default="./output", help="输出目录")
def issues(output_dir):
    """导出问题清单"""
    db = SessionLocal()
    try:
        exporter = CSVExporter(db, output_dir)
        filepath = exporter.export_issues()
        console.print(f"[green]问题清单已导出到: {filepath}[/green]")
    finally:
        db.close()


@export.command()
@click.option("--output-dir", default="./output", help="输出目录")
def import_errors(output_dir):
    """导出导入错误"""
    db = SessionLocal()
    try:
        exporter = CSVExporter(db, output_dir)
        filepath = exporter.export_import_errors()
        console.print(f"[green]导入错误已导出到: {filepath}[/green]")
    finally:
        db.close()


@export.command()
@click.argument("cleaner_id", type=int)
@click.argument("month")
@click.option("--output-dir", default="./output", help="输出目录")
def settlement_detail(cleaner_id, month, output_dir):
    """导出保洁员明细结算单"""
    db = SessionLocal()
    try:
        exporter = CSVExporter(db, output_dir)
        filepath = exporter.export_detailed_settlement(cleaner_id, month)
        console.print(f"[green]明细结算单已导出到: {filepath}[/green]")
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
    finally:
        db.close()


if __name__ == "__main__":
    cli()
