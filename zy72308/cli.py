#!/usr/bin/env python3
"""线性回归残差复盘 - 命令行工具"""

import click
import os
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from residual_review.workflow import ReviewWorkflow
from residual_review.storage import StorageManager
from residual_review.exporter import UnifiedExporter
from residual_review.row_manager import RowManager

console = Console()


@click.group()
def cli():
    """线性回归残差复盘系统"""
    pass


@cli.command()
@click.argument("csv_file")
@click.option("--source-name", default=None, help="源文件名称")
@click.option("--delete-line", type=int, default=None, help="模拟删除指定行号")
def run(csv_file, source_name, delete_line):
    """运行完整的复盘流程（阿岚工作流）"""
    if not os.path.exists(csv_file):
        console.print(f"[red]错误: 文件 {csv_file} 不存在[/red]")
        return

    workflow = ReviewWorkflow()
    result = workflow.simulate_alans_workflow(csv_file, delete_line)

    console.print(Panel.fit(
        f"导入ID: [bold cyan]{result['import_id']}[/bold cyan]\n"
        f"包含断档: [bold {'red' if result['has_gaps'] else 'green'}]{'是' if result['has_gaps'] else '否'}[/bold {'red' if result['has_gaps'] else 'green'}]",
        title="复盘完成",
        border_style="green"
    ))


@cli.command()
@click.argument("csv_file")
@click.option("--source-name", default=None, help="源文件名称")
def import_data(csv_file, source_name):
    """步骤1: 导入数据"""
    workflow = ReviewWorkflow()
    result = workflow.step1_import(csv_file, source_name)
    console.print(f"导入完成: {result['import_id']}")


@cli.command()
@click.argument("import_id")
@click.argument("line_no", type=int)
@click.argument("annotation")
@click.option("--author", default="阿岚", help="批注人")
def annotate(import_id, line_no, annotation, author):
    """步骤2: 添加批注"""
    workflow = ReviewWorkflow()
    result = workflow.step2_annotate(import_id, line_no, annotation, author)
    console.print(f"批注已添加: {result['message']}")


@cli.command()
@click.argument("import_id")
def update_params(import_id):
    """步骤3: 更新参数并重算"""
    workflow = ReviewWorkflow()
    result = workflow.step3_update_params(import_id)
    console.print(f"参数已更新: v{result['params_version']}")


@cli.command()
@click.argument("import_id")
def delete_row(import_id):
    """删除指定行（模拟人工操作）"""
    storage = StorageManager()
    row_manager = RowManager(storage)

    record = storage.load_record(import_id)
    if not record:
        console.print(f"[red]错误: 记录 {import_id} 不存在[/red]")
        return

    table = Table(title="当前数据行")
    table.add_column("原始行号")
    table.add_column("当前行号")
    table.add_column("X值")
    table.add_column("Y值")
    table.add_column("状态")

    for row in sorted(record.rows, key=lambda r: r.original_line_no):
        curr = str(row.current_line_no) if row.current_line_no else "-"
        table.add_row(
            str(row.original_line_no),
            curr,
            f"{row.x_value:.2f}",
            f"{row.y_value:.2f}",
            row.status.value
        )
    console.print(table)

    line_no = click.prompt("请输入要删除的原始行号", type=int)
    notes = click.prompt("删除原因（可选）", default="人工删除")

    row_manager.delete_row(import_id, line_no, notes)
    console.print(f"[green]行 {line_no} 已标记为删除[/green]")


@cli.command()
@click.argument("import_id")
def supplement(import_id):
    """补录已删除的行"""
    storage = StorageManager()
    row_manager = RowManager(storage)
    exporter = UnifiedExporter(storage)

    gaps = row_manager.get_gap_summary(import_id)
    if not gaps:
        console.print("[yellow]没有需要补录的断档行[/yellow]")
        return

    table = Table(title="断档记录")
    table.add_column("原始行号")
    table.add_column("状态")
    table.add_column("备注")
    for gap in gaps:
        table.add_row(str(gap["original_line_no"]), gap["status"], gap["notes"])
    console.print(table)

    line_no = click.prompt("请输入要补录的原始行号", type=int)
    x_val = click.prompt("X值", type=float)
    y_val = click.prompt("Y值", type=float)
    notes = click.prompt("补录说明（可选）", default="补录数据")

    row_manager.supplement_row(import_id, line_no, x_val, y_val, notes)

    from residual_review.importer import DataImporter
    DataImporter(storage).recalculate_residuals(import_id)

    console.print(f"[green]行 {line_no} 已补录，残差已重算[/green]")


@cli.command()
@click.argument("import_id")
def export(import_id):
    """导出复盘记录"""
    exporter = UnifiedExporter(StorageManager())
    files = exporter.export_all(import_id)

    console.print(Panel.fit(
        "\n".join([f"  [cyan]{k}[/cyan]: {v}" for k, v in files.items()]),
        title="导出完成",
        border_style="green"
    ))


@cli.command()
def list_records():
    """列出所有复盘记录"""
    storage = StorageManager()
    exporter = UnifiedExporter(storage)
    records = storage.list_records()

    if not records:
        console.print("[yellow]暂无复盘记录[/yellow]")
        return

    table = Table(title="复盘记录列表")
    table.add_column("导入ID")
    table.add_column("状态")
    table.add_column("总行数")
    table.add_column("断档数")
    table.add_column("参数版本")

    for import_id in records:
        data = exporter.export_for_api(import_id)
        table.add_row(
            data["导入ID"],
            data["状态"],
            str(data["总行数"]),
            str(data["断档行数"]),
            f"v{data['参数版本']}"
        )

    console.print(table)


@cli.command()
@click.argument("import_id")
def show(import_id):
    """显示复盘详情"""
    exporter = UnifiedExporter(StorageManager())
    data = exporter.export_for_api(import_id)

    console.print(Panel(
        f"源文件: {data['源文件']}\n"
        f"导入时间: {data['导入时间']}\n"
        f"状态: [bold]{data['状态']}[/bold]\n"
        f"有效行数: {data['有效行数']} / {data['总行数']}\n"
        f"断档行数: [bold red]{data['断档行数']}[/bold red]",
        title=f"复盘记录: {import_id}"
    ))

    if data["回归参数"]:
        console.print("\n[bold]回归参数:[/bold]")
        console.print(f"  斜率: {data['回归参数']['slope']:.6f}")
        console.print(f"  截距: {data['回归参数']['intercept']:.6f}")
        console.print(f"  R²: {data['回归参数']['r_squared']:.6f}")

    if data["断档摘要"]:
        console.print("\n[bold red]断档记录（待教研组复核）:[/bold red]")
        for gap in data["断档摘要"]:
            console.print(f"  [原始行号{gap['原始行号']}] {gap['备注']}")

    if data["批注记录"]:
        console.print("\n[bold]批注记录:[/bold]")
        for ann in data["批注记录"]:
            console.print(f"  [{ann['author']} @ 行{ann['original_line_no']}] {ann['annotation']}")

    console.print("\n[bold]行明细:[/bold]")
    table = Table()
    table.add_column("原始行号")
    table.add_column("当前行号")
    table.add_column("X值")
    table.add_column("Y值")
    table.add_column("残差")
    table.add_column("状态")
    table.add_column("备注")

    for row in data["行明细"]:
        curr = str(row["当前行号"]) if row["当前行号"] else "-"
        residual = f"{row['残差']:.4f}" if row["残差"] else "-"
        status_style = "red" if row["状态"] == "gap" else "green"
        table.add_row(
            str(row["原始行号"]),
            curr,
            f"{row['X值']:.2f}",
            f"{row['Y值']:.2f}",
            residual,
            f"[{status_style}]{row['状态']}[/{status_style}]",
            row["备注"]
        )
    console.print(table)


if __name__ == "__main__":
    cli()
