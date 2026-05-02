"""CLI入口模块 - 离线地块包同步修补员"""

import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .__init__ import __version__
from .tile_index import TileIndexManager
from .log_parser import LogParser
from .rules_engine import RulesEngine, CheckSeverity
from .patch_plan import PatchPlanner
from .executor import DryRunExecutor
from .reporter import Reporter


console = Console()


def get_work_dir(ctx: click.Context) -> Path:
    """获取工作目录"""
    work_dir = ctx.obj.get("work_dir", Path.cwd())
    if isinstance(work_dir, str):
        work_dir = Path(work_dir)
    return work_dir


def get_source_dir(ctx: click.Context) -> Path:
    """获取源数据目录"""
    source_dir = ctx.obj.get("source_dir", get_work_dir(ctx))
    if isinstance(source_dir, str):
        source_dir = Path(source_dir)
    return source_dir


@click.group()
@click.version_option(version=__version__, prog_name="offline-sync-repair")
@click.option("--work-dir", "-w", type=click.Path(path_type=Path), default=Path.cwd(),
              help="工作目录（用于存储索引和报告）")
@click.option("--source-dir", "-s", type=click.Path(path_type=Path), default=None,
              help="源数据目录（包含 tiles, parcels, tasks 等子目录）")
@click.pass_context
def cli(ctx: click.Context, work_dir: Path, source_dir: Optional[Path]):
    """离线地块包同步修补员 - 农机服务站运维工具
    
    用于春耕前检查和修复离线地块包同步问题，包括：
    - 瓦片覆盖检查
    - 地块版本一致性
    - 任务重复检测
    - 终端状态监控
    - 回滚包可用性验证
    """
    ctx.ensure_object(dict)
    ctx.obj["work_dir"] = work_dir
    ctx.obj["source_dir"] = source_dir if source_dir else work_dir
    
    work_dir.mkdir(parents=True, exist_ok=True)


@cli.command()
@click.option("--tiles-dir", type=click.Path(path_type=Path), default=None,
              help="瓦片目录（默认: source_dir/tiles）")
@click.option("--parcels-dir", type=click.Path(path_type=Path), default=None,
              help="地块目录（默认: source_dir/parcels）")
@click.option("--tasks-dir", type=click.Path(path_type=Path), default=None,
              help="任务目录（默认: source_dir/tasks）")
@click.option("--rollback-dir", type=click.Path(path_type=Path), default=None,
              help="回滚包目录（默认: source_dir/rollback）")
@click.option("--zoom-levels", "-z", type=str, default=None,
              help="缩放级别（逗号分隔，如: 14,15,16,17,18）")
@click.option("--save-index/--no-save-index", default=True,
              help="是否保存索引到文件")
@click.pass_context
def scan(ctx: click.Context, tiles_dir: Optional[Path], parcels_dir: Optional[Path],
         tasks_dir: Optional[Path], rollback_dir: Optional[Path],
         zoom_levels: Optional[str], save_index: bool):
    """扫描并索引资料包，计算文件哈希
    
    扫描瓦片目录、地块GeoJSON、任务清单和回滚包，建立索引并计算哈希值。
    """
    work_dir = get_work_dir(ctx)
    source_dir = get_source_dir(ctx)
    
    tiles_dir = tiles_dir or source_dir / "tiles"
    parcels_dir = parcels_dir or source_dir / "parcels"
    tasks_dir = tasks_dir or source_dir / "tasks"
    rollback_dir = rollback_dir or source_dir / "rollback"
    
    zoom_levels_list = None
    if zoom_levels:
        zoom_levels_list = [int(z.strip()) for z in zoom_levels.split(",") if z.strip()]
    
    console.print(Panel.fit(
        "[bold blue]扫描索引[/bold blue]\n"
        f"工作目录: {work_dir}\n"
        f"源数据目录: {source_dir}",
        title="离线地块包同步修补员"
    ))
    
    manager = TileIndexManager(work_dir)
    
    with console.status("[bold green]扫描瓦片目录..."):
        tile_count = manager.scan_tiles(tiles_dir, zoom_levels_list)
    console.print(f"✅ 扫描瓦片: [green]{tile_count}[/green] 个瓦片")
    
    with console.status("[bold green]扫描地块目录..."):
        parcel_count = manager.scan_parcels(parcels_dir)
    console.print(f"✅ 扫描地块: [green]{parcel_count}[/green] 个地块")
    
    with console.status("[bold green]扫描任务目录..."):
        task_count = manager.scan_tasks(tasks_dir)
    console.print(f"✅ 扫描任务: [green]{task_count}[/green] 个任务")
    
    with console.status("[bold green]扫描回滚包目录..."):
        rollback_count = manager.scan_rollback_packages(rollback_dir)
    console.print(f"✅ 扫描回滚包: [green]{rollback_count}[/green] 个回滚包")
    
    if save_index:
        with console.status("[bold green]保存索引..."):
            manager.save_index()
        console.print(f"✅ 索引已保存到: [cyan]{manager.index_file}[/cyan]")
    
    table = Table(title="扫描结果摘要")
    table.add_column("类型", style="cyan")
    table.add_column("数量", style="green")
    table.add_row("瓦片", str(tile_count))
    table.add_row("地块", str(parcel_count))
    table.add_row("任务", str(task_count))
    table.add_row("回滚包", str(rollback_count))
    console.print(table)


@cli.command("import-log")
@click.argument("log_path", type=click.Path(path_type=Path, exists=True))
@click.option("--terminal-id", "-t", type=str, default=None,
              help="强制指定终端ID（当日志中没有明确标识时使用）")
@click.option("--save-data/--no-save-data", default=True,
              help="是否保存解析的数据到文件")
@click.pass_context
def import_log(ctx: click.Context, log_path: Path, terminal_id: Optional[str], save_data: bool):
    """导入终端日志
    
    解析终端同步日志，提取同步事件和终端状态信息。
    LOG_PATH 可以是单个日志文件或包含多个日志文件的目录。
    """
    work_dir = get_work_dir(ctx)
    
    console.print(Panel.fit(
        "[bold blue]导入终端日志[/bold blue]\n"
        f"日志路径: {log_path}\n"
        f"终端ID: {terminal_id or '自动检测'}",
        title="离线地块包同步修补员"
    ))
    
    parser = LogParser(work_dir)
    
    event_count = 0
    if log_path.is_file():
        with console.status("[bold green]解析日志文件..."):
            event_count = parser.parse_file(log_path, terminal_id)
    else:
        with console.status("[bold green]解析日志目录..."):
            event_count = parser.parse_directory(log_path)
    
    console.print(f"✅ 解析事件: [green]{event_count}[/green] 个")
    
    with console.status("[bold green]构建终端状态..."):
        terminals = parser.build_terminal_status()
    
    console.print(f"✅ 识别终端: [green]{len(terminals)}[/green] 个")
    
    if save_data:
        with console.status("[bold green]保存解析数据..."):
            parser.save_parsed_data()
        console.print(f"✅ 数据已保存到: [cyan]{work_dir / '.sync_index'}[/cyan]")
    
    if terminals:
        table = Table(title="终端状态摘要")
        table.add_column("终端ID", style="cyan")
        table.add_column("状态", style="green")
        table.add_column("最后活动", style="yellow")
        table.add_column("已分配任务", style="blue")
        table.add_column("已完成任务", style="green")
        table.add_column("错误", style="red")
        
        for tid, status in terminals.items():
            last_seen = status.last_seen.strftime("%Y-%m-%d %H:%M") if status.last_seen else "未知"
            table.add_row(
                tid,
                status.status,
                last_seen,
                str(len(status.assigned_tasks)),
                str(len(status.completed_tasks)),
                str(len(status.errors)) if status.errors else "0"
            )
        console.print(table)


@cli.command()
@click.option("--load-index/--no-load-index", default=True,
              help="是否从文件加载已保存的索引")
@click.option("--load-logs/--no-load-logs", default=True,
              help="是否从文件加载已解析的日志数据")
@click.pass_context
def check(ctx: click.Context, load_index: bool, load_logs: bool):
    """执行校验检查
    
    检查瓦片覆盖、版本依赖、任务重复、终端状态和回滚可用性。
    """
    work_dir = get_work_dir(ctx)
    source_dir = get_source_dir(ctx)
    
    console.print(Panel.fit(
        "[bold blue]执行校验检查[/bold blue]\n"
        f"工作目录: {work_dir}",
        title="离线地块包同步修补员"
    ))
    
    manager = TileIndexManager(work_dir)
    parser = LogParser(work_dir)
    
    index_loaded = False
    if load_index:
        with console.status("[bold green]加载索引..."):
            index_loaded = manager.load_index()
        if index_loaded:
            console.print(f"✅ 索引已加载")
        else:
            console.print(f"⚠️ 未找到索引文件，请先运行 [cyan]scan[/cyan] 命令")
    
    logs_loaded = False
    if load_logs:
        with console.status("[bold green]加载日志数据..."):
            logs_loaded = parser.load_parsed_data()
        if logs_loaded:
            console.print(f"✅ 日志数据已加载")
        else:
            console.print(f"⚠️ 未找到日志数据，请先运行 [cyan]import-log[/cyan] 命令")
    
    if not index_loaded and not manager.parcels and not manager.tile_cache:
        console.print("[red]错误: 没有可用的索引数据，请先运行 scan 命令[/red]")
        sys.exit(1)
    
    with console.status("[bold green]执行规则检查..."):
        engine = RulesEngine(manager, parser)
        report = engine.run_all_checks()
    
    console.print(f"\n[bold]检查完成:[/bold]")
    console.print(f"  总检查数: {report.total_checks}")
    console.print(f"  通过: [green]{report.passed_count}[/green]")
    console.print(f"  警告: [yellow]{report.warning_count}[/yellow]")
    console.print(f"  错误: [red]{report.error_count}[/red]")
    console.print(f"  严重: [bold red]{report.critical_count}[/bold red]")
    
    if report.critical_count > 0 or report.error_count > 0:
        console.print("\n[bold red]⚠️ 发现需要立即处理的问题![/bold red]")
    
    table = Table(title="检查结果摘要")
    table.add_column("严重程度", style="cyan")
    table.add_column("数量", style="green")
    table.add_row("通过 (INFO)", str(report.passed_count))
    table.add_row("警告 (WARNING)", str(report.warning_count))
    table.add_row("错误 (ERROR)", str(report.error_count))
    table.add_row("严重 (CRITICAL)", str(report.critical_count))
    console.print(table)
    
    ctx.obj["last_check_report"] = report


@cli.command()
@click.option("--description", "-d", type=str, default="自动生成的修补计划",
              help="修补计划描述")
@click.pass_context
def plan(ctx: click.Context, description: str):
    """生成差异修补计划
    
    根据检查结果生成修补计划，包括需要补充的瓦片、更新的地块版本等。
    """
    work_dir = get_work_dir(ctx)
    
    console.print(Panel.fit(
        "[bold blue]生成修补计划[/bold blue]\n"
        f"工作目录: {work_dir}",
        title="离线地块包同步修补员"
    ))
    
    manager = TileIndexManager(work_dir)
    parser = LogParser(work_dir)
    
    with console.status("[bold green]加载索引..."):
        manager.load_index()
    with console.status("[bold green]加载日志数据..."):
        parser.load_parsed_data()
    
    with console.status("[bold green]执行规则检查..."):
        engine = RulesEngine(manager, parser)
        check_report = engine.run_all_checks()
    
    with console.status("[bold green]生成修补计划..."):
        planner = PatchPlanner(manager, check_report)
        patch_plan = planner.generate_plan(description)
    
    summary = patch_plan.summary
    
    console.print(f"\n[bold]修补计划生成完成:[/bold]")
    console.print(f"  计划ID: {patch_plan.plan_id}")
    console.print(f"  涉及终端数: {summary.get('total_terminals', 0)}")
    console.print(f"  总操作数: {summary.get('total_actions', 0)}")
    console.print(f"  预估总大小: {summary.get('estimated_total_size', 0)} 字节")
    
    if patch_plan.terminal_plans:
        table = Table(title="按终端分类")
        table.add_column("终端ID", style="cyan")
        table.add_column("操作数", style="green")
        table.add_column("Critical", style="red")
        table.add_column("High", style="yellow")
        table.add_column("Medium", style="blue")
        table.add_column("预估大小", style="magenta")
        
        for tid, tp in patch_plan.terminal_plans.items():
            from .utils import get_file_size_str
            table.add_row(
                tid,
                str(len(tp.actions)),
                str(tp.critical_count),
                str(tp.high_count),
                str(tp.medium_count),
                get_file_size_str(tp.estimated_total_size)
            )
        console.print(table)
    
    ctx.obj["last_patch_plan"] = patch_plan
    
    console.print(f"\n[bold]提示:[/bold] 使用 [cyan]report[/cyan] 命令导出详细报告")
    console.print(f"[bold]提示:[/bold] 使用 [cyan]apply[/cyan] 命令进行演练执行")


@cli.command()
@click.option("--cleanup/--no-cleanup", default=False,
              help="执行完成后是否清理临时目录")
@click.option("--description", "-d", type=str, default="演练执行",
              help="执行描述")
@click.pass_context
def apply(ctx: click.Context, cleanup: bool, description: str):
    """演练执行修补计划（仅在临时目录）
    
    在临时目录中模拟执行修补计划，记录操作日志但不修改实际数据。
    """
    work_dir = get_work_dir(ctx)
    source_dir = get_source_dir(ctx)
    
    console.print(Panel.fit(
        "[bold blue]演练执行修补计划[/bold blue]\n"
        f"工作目录: {work_dir}\n"
        f"源数据目录: {source_dir}\n"
        f"[yellow]⚠️ 此为演练模式，不会修改实际数据[/yellow]",
        title="离线地块包同步修补员"
    ))
    
    manager = TileIndexManager(work_dir)
    parser = LogParser(work_dir)
    
    with console.status("[bold green]加载索引..."):
        manager.load_index()
    with console.status("[bold green]加载日志数据..."):
        parser.load_parsed_data()
    
    with console.status("[bold green]执行规则检查..."):
        engine = RulesEngine(manager, parser)
        check_report = engine.run_all_checks()
    
    with console.status("[bold green]生成修补计划..."):
        planner = PatchPlanner(manager, check_report)
        patch_plan = planner.generate_plan(description)
    
    if not patch_plan.terminal_plans and not patch_plan.global_actions:
        console.print("[green]没有需要执行的操作，所有检查均通过[/green]")
        return
    
    with console.status("[bold green]执行演练..."):
        executor = DryRunExecutor(work_dir, source_dir)
        result = executor.execute_plan(patch_plan, description)
    
    console.print(f"\n[bold]演练执行完成:[/bold]")
    console.print(f"  计划ID: {result.plan_id}")
    console.print(f"  临时目录: [cyan]{result.temp_dir}[/cyan]")
    console.print(f"  最终状态: {result.status.value}")
    console.print(f"  成功: [green]{result.success_count}[/green]")
    console.print(f"  失败: [red]{result.failed_count}[/red]")
    console.print(f"  跳过: [yellow]{result.skipped_count}[/yellow]")
    
    if result.failed_count > 0:
        console.print("\n[bold red]⚠️ 部分操作执行失败，请查看详细日志[/bold red]")
    
    ctx.obj["last_execution_result"] = result
    
    console.print(f"\n[bold]提示:[/bold] 执行日志已保存到: [cyan]{work_dir / '.sync_index' / 'dry_runs'}[/cyan]")
    console.print(f"[bold]提示:[/bold] 使用 [cyan]report[/cyan] 命令导出详细报告")
    
    if cleanup:
        with console.status("[bold green]清理临时目录..."):
            executor.cleanup_temp_dir()
        console.print(f"✅ 临时目录已清理")


@cli.command()
@click.argument("report_type", type=click.Choice(["check", "plan", "execution"]), default="check")
@click.option("--output-name", "-n", type=str, default=None,
              help="输出文件名（不含扩展名）")
@click.pass_context
def report(ctx: click.Context, report_type: str, output_name: Optional[str]):
    """导出审计报告（Markdown、CSV、JSON）
    
    REPORT_TYPE: 报告类型
    - check: 检查报告
    - plan: 修补计划报告
    - execution: 执行报告
    """
    work_dir = get_work_dir(ctx)
    
    console.print(Panel.fit(
        f"[bold blue]导出{report_type}报告[/bold blue]\n"
        f"工作目录: {work_dir}",
        title="离线地块包同步修补员"
    ))
    
    reporter = Reporter(work_dir)
    package = None
    
    if report_type == "check":
        manager = TileIndexManager(work_dir)
        parser = LogParser(work_dir)
        manager.load_index()
        parser.load_parsed_data()
        
        engine = RulesEngine(manager, parser)
        check_report = engine.run_all_checks()
        
        name = output_name or "check_report"
        with console.status("[bold green]生成检查报告..."):
            package = reporter.generate_check_report(check_report, name)
    
    elif report_type == "plan":
        manager = TileIndexManager(work_dir)
        parser = LogParser(work_dir)
        manager.load_index()
        parser.load_parsed_data()
        
        engine = RulesEngine(manager, parser)
        check_report = engine.run_all_checks()
        
        planner = PatchPlanner(manager, check_report)
        patch_plan = planner.generate_plan("报告导出")
        
        name = output_name or "patch_plan"
        with console.status("[bold green]生成修补计划报告..."):
            package = reporter.generate_plan_report(patch_plan, name)
    
    elif report_type == "execution":
        manager = TileIndexManager(work_dir)
        parser = LogParser(work_dir)
        manager.load_index()
        parser.load_parsed_data()
        
        engine = RulesEngine(manager, parser)
        check_report = engine.run_all_checks()
        
        planner = PatchPlanner(manager, check_report)
        patch_plan = planner.generate_plan("报告导出")
        
        executor = DryRunExecutor(work_dir, work_dir)
        result = executor.execute_plan(patch_plan, "报告导出演练")
        
        name = output_name or "execution_report"
        with console.status("[bold green]生成执行报告..."):
            package = reporter.generate_execution_report(result, name)
    
    if package:
        console.print(f"\n[bold]报告生成完成:[/bold]")
        console.print(f"  报告ID: {package.report_id}")
        console.print(f"  输出目录: [cyan]{package.output_dir}[/cyan]")
        
        table = Table(title="生成的文件")
        table.add_column("文件名", style="cyan")
        table.add_column("格式", style="green")
        
        for file_path in package.files:
            fmt = file_path.suffix.upper()[1:] if file_path.suffix else "UNKNOWN"
            table.add_row(file_path.name, fmt)
        console.print(table)


@cli.command()
@click.pass_context
def status(ctx: click.Context):
    """显示当前状态摘要"""
    work_dir = get_work_dir(ctx)
    
    console.print(Panel.fit(
        "[bold blue]状态摘要[/bold blue]\n"
        f"工作目录: {work_dir}",
        title="离线地块包同步修补员"
    ))
    
    manager = TileIndexManager(work_dir)
    parser = LogParser(work_dir)
    
    index_loaded = manager.load_index()
    logs_loaded = parser.load_parsed_data()
    
    table = Table(title="数据状态")
    table.add_column("项目", style="cyan")
    table.add_column("状态", style="green")
    table.add_column("数量", style="yellow")
    
    tile_count = len(manager.tile_cache)
    parcel_count = len(manager.parcels)
    task_count = len(manager.tasks)
    rollback_count = len(manager.rollback_packages)
    terminal_count = len(parser.terminals)
    
    table.add_row("索引", "已加载" if index_loaded else "未加载", "-")
    table.add_row("瓦片", "✓", str(tile_count))
    table.add_row("地块", "✓", str(parcel_count))
    table.add_row("任务", "✓", str(task_count))
    table.add_row("回滚包", "✓", str(rollback_count))
    table.add_row("日志数据", "已加载" if logs_loaded else "未加载", "-")
    table.add_row("终端", "✓", str(terminal_count))
    console.print(table)
    
    if not index_loaded and not manager.parcels:
        console.print("\n[yellow]⚠️ 提示: 请先运行 [cyan]scan[/cyan] 命令扫描数据[/yellow]")
    if not logs_loaded and not parser.terminals:
        console.print("[yellow]⚠️ 提示: 请先运行 [cyan]import-log[/cyan] 命令导入日志[/yellow]")


if __name__ == "__main__":
    cli(obj={})
