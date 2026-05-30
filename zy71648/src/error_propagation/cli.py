"""命令行界面"""

import typer
import os
import json
from typing import List, Optional
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn

from .types import Formula
from .processor import ErrorPropagationProcessor

app = typer.Typer(
    name="errorprop",
    help="物理实验误差传播分析工具",
    add_completion=False,
    no_args_is_help=True
)

console = Console()


@app.command("process")
def process_file(
    file_path: str = typer.Argument(..., help="数据文件路径 (.csv, .xlsx, .json)"),
    formula: List[str] = typer.Option(
        [], "--formula", "-f",
        help="计算公式，格式: '目标变量=表达式'，例如: 'ρ=m/V'"
    ),
    formula_file: Optional[str] = typer.Option(
        None, "--formula-file",
        help="包含公式的JSON文件路径"
    ),
    output_dir: str = typer.Option("output", "--output", "-o", help="输出目录"),
    assume_independent: bool = typer.Option(
        True, "--independent/--correlated",
        help="是否假设变量独立（默认独立，使用方和根法）"
    ),
    processed_by: str = typer.Option("teacher", "--user", "-u", help="处理人姓名"),
    no_history: bool = typer.Option(False, "--no-history", help="不保存历史记录"),
    show_charts: bool = typer.Option(False, "--show-charts", help="处理完成后显示图表"),
):
    """处理数据文件并生成误差传播分析报告"""

    if not os.path.exists(file_path):
        console.print(f"[red]错误: 文件不存在: {file_path}[/red]")
        raise typer.Exit(1)

    processor = ErrorPropagationProcessor(output_dir=output_dir)

    formulas = []
    if formula_file and os.path.exists(formula_file):
        with open(formula_file, 'r', encoding='utf-8') as f:
            formula_data = json.load(f)
            for item in formula_data:
                formulas.append(Formula(
                    expression=item['expression'],
                    target_variable=item['target_variable'],
                    description=item.get('description')
                ))

    for f_str in formula:
        if '=' in f_str:
            target, expr = f_str.split('=', 1)
            formulas.append(Formula(
                expression=expr.strip(),
                target_variable=target.strip(),
                description=f"用户输入公式: {f_str}"
            ))

    if not formulas:
        console.print("[yellow]警告: 未提供计算公式，将仅进行数据清洗和单位校验[/yellow]")

    file_name = os.path.basename(file_path)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console
    ) as progress:

        tasks = []
        for step in processor.processing_order:
            tasks.append(progress.add_task(f"[cyan]{step}[/cyan]", total=100))

        try:
            processed_data = processor.process_file(
                file_path=file_path,
                formulas=formulas,
                assume_independent=assume_independent,
                processed_by=processed_by,
                save_history=not no_history
            )

            for task in tasks:
                progress.update(task, completed=100)

        except Exception as e:
            console.print(f"[red]处理失败: {str(e)}[/red]")
            import traceback
            traceback.print_exc()
            raise typer.Exit(1)

    _display_results(processed_data, file_name, output_dir)

    if show_charts:
        chart_dir = os.path.join(output_dir, "charts")
        if os.path.exists(chart_dir):
            console.print(f"\n[green]图表已生成在: {chart_dir}[/green]")


@app.command("interactive")
def interactive_mode(
    output_dir: str = typer.Option("output", "--output", "-o", help="输出目录"),
):
    """交互式处理模式"""
    console.print(Panel.fit(
        "[bold cyan]🔬 物理实验误差传播分析工具 - 交互式模式[/bold cyan]\n\n"
        "请按提示输入数据，支持多组测量和多个公式",
        border_style="cyan"
    ))

    processor = ErrorPropagationProcessor(output_dir=output_dir)

    measurements = {}
    while True:
        console.print("\n[bold]添加测量值[/bold]")
        name = typer.prompt("变量名 (输入 'done' 完成)")
        if name.lower() == 'done':
            break

        value = typer.prompt("测量值", type=float)
        uncertainty = typer.prompt("不确定度", type=float)
        unit = typer.prompt("单位")
        description = typer.prompt("描述 (可选)", default="")

        from .types import Measurement as M
        measurements[name] = M(
            name=name,
            value=value,
            uncertainty=uncertainty,
            unit=unit,
            description=description or None,
            group="interactive"
        )

    formulas = []
    while True:
        console.print("\n[bold]添加计算公式[/bold]")
        target = typer.prompt("目标变量名 (输入 'done' 完成)")
        if target.lower() == 'done':
            break

        expression = typer.prompt("表达式 (例如: m/V)")
        description = typer.prompt("公式描述 (可选)", default="")

        formulas.append(Formula(
            expression=expression,
            target_variable=target,
            description=description or None
        ))

    if not measurements or not formulas:
        console.print("[yellow]未提供足够数据，退出[/yellow]")
        return

    from .types import ExperimentGroup
    group = ExperimentGroup(
        name="interactive",
        measurements=measurements,
        formulas=formulas
    )

    processed_by = typer.prompt("处理人", default="teacher")

    with console.status("[cyan]正在进行误差传播计算...[/cyan]"):
        group = processor._validate_units({"interactive": group})["interactive"]
        group = processor._check_correlations({"interactive": group})["interactive"]
        group = processor._propagate_errors({"interactive": group}, assume_independent=True)["interactive"]

    from .types import ProcessedData
    processed_data = ProcessedData(
        groups={"interactive": group},
        all_issues=group.issues,
        cleaning_log=[],
        processing_order=processor.processing_order
    )

    _display_results(processed_data, "interactive", output_dir)

    save = typer.confirm("是否保存报告?", default=True)
    if save:
        processor.export_reports(processed_data, "interactive")
        console.print(f"[green]报告已保存到: {output_dir}[/green]")


@app.command("history")
def history_commands(
    action: str = typer.Argument(..., help="操作: list, show, compare, stats"),
    file_name: Optional[str] = typer.Option(None, "--file", "-f", help="筛选文件名"),
    entry_id: Optional[int] = typer.Option(None, "--id", help="记录ID"),
    entry_id2: Optional[int] = typer.Option(None, "--id2", help="比较的第二个记录ID"),
    limit: int = typer.Option(20, "--limit", "-n", help="显示数量"),
):
    """历史记录管理"""
    processor = ErrorPropagationProcessor()

    if action == "list":
        entries = processor.get_history(file_name=file_name, limit=limit)
        _display_history_list(entries)

    elif action == "show":
        if not entry_id:
            console.print("[red]错误: 请提供 --id 参数[/red]")
            raise typer.Exit(1)
        entry = processor.history_tracker.get_entry(entry_id)
        if entry:
            _display_history_entry(entry)
        else:
            console.print(f"[red]未找到记录 ID: {entry_id}[/red]")

    elif action == "compare":
        if not entry_id or not entry_id2:
            console.print("[red]错误: 请提供 --id 和 --id2 参数[/red]")
            raise typer.Exit(1)
        diff = processor.compare_history(entry_id, entry_id2)
        _display_comparison(diff)

    elif action == "stats":
        stats = processor.get_statistics()
        _display_statistics(stats)

    else:
        console.print(f"[red]未知操作: {action}[/red]")
        console.print("可用操作: list, show, compare, stats")


@app.command("demo")
def run_demo(
    output_dir: str = typer.Option("output", "--output", "-o", help="输出目录"),
):
    """运行演示数据"""
    import tempfile
    import csv

    console.print(Panel.fit(
        "[bold cyan]🔬 误差传播分析演示[/bold cyan]\n\n"
        "演示: 单摆法测重力加速度 g = 4π²L/T²",
        border_style="cyan"
    ))

    demo_data = [
        ["name", "value", "uncertainty", "unit", "group", "description"],
        ["L", "0.984", "0.001", "m", "group1", "摆长"],
        ["T", "1.992", "0.001", "s", "group1", "周期"],
        ["L", "0.752", "0.001", "m", "group2", "摆长"],
        ["T", "1.741", "0.001", "s", "group2", "周期"],
        ["L", "0.501", "0.001", "m", "group3", "摆长"],
        ["T", "1.420", "0.001", "s", "group3", "周期"],
    ]

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(demo_data)
        temp_file = f.name

    try:
        processor = ErrorPropagationProcessor(output_dir=output_dir)

        formulas = [
            Formula(
                expression="4 * pi**2 * L / T**2",
                target_variable="g",
                description="单摆法测重力加速度: g = 4π²L/T²"
            )
        ]

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            console=console
        ) as progress:
            for step in processor.processing_order:
                progress.add_task(f"[cyan]{step}[/cyan]", total=100)

            processed_data = processor.process_file(
                file_path=temp_file,
                formulas=formulas,
                assume_independent=True,
                processed_by="demo",
                save_history=False
            )

        _display_results(processed_data, "demo", output_dir)

        processor.export_reports(processed_data, "demo")
        console.print(f"\n[green]演示报告已保存到: {output_dir}[/green]")
        console.print("[green]你可以打开 demo_summary.html 查看完整报告[/green]")

    finally:
        os.unlink(temp_file)


def _display_results(processed_data, file_name, output_dir):
    """显示处理结果"""
    console.print("\n")
    console.print(Panel.fit(
        f"[bold green]✅ 处理完成: {file_name}[/bold green]",
        border_style="green"
    ))

    for group_name, group in processed_data.groups.items():
        console.print(f"\n[bold cyan]实验组: {group_name}[/bold cyan]")

        if group.results:
            table = Table(title="计算结果")
            table.add_column("目标量", style="bold")
            table.add_column("值 ± 不确定度", justify="right")
            table.add_column("相对不确定度", justify="right")
            table.add_column("主要来源", style="yellow")
            table.add_column("单位")

            for target_name, result in group.results.items():
                val_str = f"{result.target_value:.6g} ± {result.target_uncertainty:.6g}"
                rel_str = f"{result.relative_uncertainty*100:.2f}%"
                table.add_row(target_name, val_str, rel_str, result.dominant_source, result.target_unit)

            console.print(table)

        if group.measurements:
            table = Table(title="输入测量值")
            table.add_column("变量", style="bold")
            table.add_column("值", justify="right")
            table.add_column("不确定度", justify="right")
            table.add_column("相对不确定度", justify="right")
            table.add_column("单位")

            for name, m in group.measurements.items():
                rel_str = f"{m.relative_uncertainty*100:.3f}%"
                table.add_row(name, f"{m.value}", f"{m.uncertainty}", rel_str, m.unit)

            console.print(table)

    if processed_data.all_issues:
        console.print(f"\n[bold yellow]⚠️  发现 {len(processed_data.all_issues)} 个问题:[/bold yellow]")
        for issue in processed_data.all_issues:
            color = {
                'critical': 'red',
                'error': 'red',
                'warning': 'yellow',
                'info': 'blue'
            }.get(issue.severity.value, 'white')

            loc = f" [{issue.location}]" if issue.location else ""
            console.print(f"  [{color}]• [{issue.severity.value.upper()}] {issue.issue_type.value}{loc}: {issue.message}[/{color}]")

    if processed_data.cleaning_log:
        console.print(f"\n[bold]🧹 清洗日志:[/bold]")
        for log in processed_data.cleaning_log:
            console.print(f"  • {log}")

    console.print(f"\n[bold]📁 输出目录:[/bold] {os.path.abspath(output_dir)}")


def _display_history_list(entries):
    """显示历史记录列表"""
    if not entries:
        console.print("[yellow]暂无历史记录[/yellow]")
        return

    table = Table(title="历史记录")
    table.add_column("ID", style="bold", justify="right")
    table.add_column("文件名", style="cyan")
    table.add_column("处理时间")
    table.add_column("处理人", style="green")
    table.add_column("问题", justify="right")
    table.add_column("已解决", justify="right")
    table.add_column("修正数", justify="right")

    for entry in entries:
        table.add_row(
            str(entry.id),
            entry.file_name,
            datetime.fromtimestamp(entry.processed_at).strftime('%Y-%m-%d %H:%M:%S'),
            entry.processed_by,
            str(entry.issues_found),
            str(entry.issues_resolved),
            str(len(entry.corrections))
        )

    console.print(table)


def _display_history_entry(entry):
    """显示单条历史记录详情"""
    console.print(Panel.fit(
        f"[bold cyan]历史记录 #{entry.id}[/bold cyan]",
        border_style="cyan"
    ))

    console.print(f"[bold]文件名:[/bold] {entry.file_name}")
    console.print(f"[bold]处理时间:[/bold] {datetime.fromtimestamp(entry.processed_at).strftime('%Y-%m-%d %H:%M:%S')}")
    console.print(f"[bold]处理人:[/bold] {entry.processed_by}")
    console.print(f"[bold]问题数:[/bold] {entry.issues_found} 发现, {entry.issues_resolved} 已解决")
    console.print(f"[bold]数据哈希:[/bold] {entry.original_data_hash[:32]}...")

    if entry.report_path:
        console.print(f"[bold]报告路径:[/bold] {entry.report_path}")

    console.print(f"\n[bold]摘要:[/bold] {entry.summary}")

    if entry.corrections:
        console.print(f"\n[bold]修正记录 ({len(entry.corrections)} 条):[/bold]")
        table = Table()
        table.add_column("字段", style="bold")
        table.add_column("原值")
        table.add_column("新值", style="green")
        table.add_column("原因")
        table.add_column("修改人")
        table.add_column("时间")

        for corr in entry.corrections:
            table.add_row(
                corr.field,
                str(corr.old_value),
                str(corr.new_value),
                corr.reason,
                corr.corrected_by,
                datetime.fromtimestamp(corr.timestamp).strftime('%Y-%m-%d %H:%M:%S')
            )
        console.print(table)


def _display_comparison(diff):
    """显示比较结果"""
    if "error" in diff:
        console.print(f"[red]{diff['error']}[/red]")
        return

    console.print(Panel.fit(
        f"[bold cyan]版本对比[/bold cyan]",
        border_style="cyan"
    ))

    meta = diff["metadata"]
    console.print(f"[bold]版本 1:[/bold] #{meta['entry1']['id']} - {meta['entry1']['file_name']} "
                 f"({meta['entry1']['processed_by']} @ {meta['entry1']['processed_at']})")
    console.print(f"[bold]版本 2:[/bold] #{meta['entry2']['id']} - {meta['entry2']['file_name']} "
                 f"({meta['entry2']['processed_by']} @ {meta['entry2']['processed_at']})")

    stats = diff["statistics_diff"]
    console.print(f"\n[bold]统计变化:[/bold]")
    for key, value in stats.items():
        change = value['change']
        color = 'green' if change >= 0 else 'red'
        sign = '+' if change >= 0 else ''
        console.print(f"  {key}: {value['entry1']} → {value['entry2']} ([{color}]{sign}{change}[/{color}])")

    corr_diff = diff["corrections_diff"]
    if corr_diff["new_in_entry2"]:
        console.print(f"\n[bold green]新增修正 ({len(corr_diff['new_in_entry2'])} 条):[/bold green]")
        for corr in corr_diff["new_in_entry2"]:
            console.print(f"  • {corr['field']}: {corr['old_value']} → {corr['new_value']} "
                         f"({corr['corrected_by']})")

    if corr_diff["modified"]:
        console.print(f"\n[bold yellow]修改的修正 ({len(corr_diff['modified'])} 条):[/bold yellow]")
        for mod in corr_diff["modified"]:
            console.print(f"  • {mod['field']}: {mod['entry1_value']} → {mod['entry2_value']} "
                         f"(由 {mod['entry1_by']} 改为 {mod['entry2_by']})")


def _display_statistics(stats):
    """显示统计信息"""
    console.print(Panel.fit(
        "[bold cyan]📊 系统统计[/bold cyan]",
        border_style="cyan"
    ))

    table = Table(show_header=False)
    table.add_column("项目", style="bold")
    table.add_column("数值", justify="right")

    table.add_row("总处理次数", str(stats['total_entries']))
    table.add_row("处理文件数", str(stats['total_files']))
    table.add_row("发现问题总数", str(stats['total_issues_found']))
    table.add_row("已解决问题数", str(stats['total_issues_resolved']))
    table.add_row("人工修正总数", str(stats['total_corrections']))
    table.add_row("问题解决率", f"{stats['resolution_rate']:.1f}%")

    if stats['active_users']:
        table.add_row("活跃用户", ", ".join(stats['active_users']))

    console.print(table)


if __name__ == "__main__":
    app()
