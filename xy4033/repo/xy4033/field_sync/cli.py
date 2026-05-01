import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from .__init__ import __version__
from .config import (
    DEFAULT_CONFIG_NAME,
    ConflictStrategy,
    SyncConfig,
    find_config,
    get_default_allowed_extensions,
    get_default_ignore_patterns,
)
from .conflict import ConflictManager, format_conflict_for_display
from .executor import Executor, ExecutionError
from .journal import JournalManager
from .models import Manifest, PlanStatus, generate_timestamp_id
from .planner import PlanGenerator
from .reporter import Reporter
from .scanner import FileScanner

console = Console()


def load_config_or_exit(config_path: Optional[str] = None) -> SyncConfig:
    if config_path:
        if not os.path.exists(config_path):
            console.print(f"[red]错误: 配置文件不存在: {config_path}[/red]")
            sys.exit(1)
        return SyncConfig.load(config_path)
    
    found = find_config('.')
    if not found:
        console.print("[red]错误: 未找到配置文件。请先运行 'field-sync init' 初始化。[/red]")
        sys.exit(1)
    
    return SyncConfig.load(str(found))


@click.group()
@click.version_option(__version__, prog_name="field-sync")
def main():
    """
    外业资料双向同步预演器
    
    用于外业测绘小组的本地端侧资料同步工具，支持：
    - init: 初始化同步配置
    - scan: 扫描两端文件生成manifest
    - plan: 生成dry-run同步计划
    - apply: 执行无冲突同步计划
    - undo: 回滚最近一次同步操作
    - report: 导出同步报告
    - history: 查询历史记录
    """
    pass


@main.command()
@click.option('--left', '-l', required=True, help='左侧工作目录路径（笔记本端）')
@click.option('--right', '-r', required=True, help='右侧备份目录路径（移动硬盘）')
@click.option('--output', '-o', default=DEFAULT_CONFIG_NAME, help='配置文件输出路径')
@click.option('--use-default-ignores', '-i', is_flag=True, default=True, help='使用默认忽略模式')
@click.option('--use-default-extensions', '-e', is_flag=True, default=True, help='使用默认允许的文件扩展名')
def init(left: str, right: str, output: str, use_default_ignores: bool, use_default_extensions: bool):
    """
    初始化同步配置
    
    创建同步配置文件，指定两侧目录、忽略规则、允许的文件类型等。
    """
    left_path = Path(left).resolve()
    right_path = Path(right).resolve()
    
    if not left_path.exists():
        console.print(f"[red]错误: 左侧目录不存在: {left_path}[/red]")
        sys.exit(1)
    
    if not right_path.exists():
        console.print(f"[yellow]警告: 右侧目录不存在，将创建: {right_path}[/yellow]")
        right_path.mkdir(parents=True, exist_ok=True)
    
    config = SyncConfig(
        left_dir=str(left_path),
        right_dir=str(right_path),
        ignore_patterns=get_default_ignore_patterns() if use_default_ignores else [],
        allowed_extensions=get_default_allowed_extensions() if use_default_extensions else [],
        conflict_strategy=ConflictStrategy(),
    )
    
    output_path = Path(output).resolve()
    config.save(str(output_path))
    
    console.print(Panel.fit(
        f"[green]配置文件已创建:[/green] {output_path}\n\n"
        f"左侧目录: {left_path}\n"
        f"右侧目录: {right_path}\n"
        f"忽略模式: {len(config.ignore_patterns)} 项\n"
        f"允许扩展名: {len(config.allowed_extensions)} 项",
        title="初始化成功",
        border_style="green"
    ))


@main.command()
@click.option('--config', '-c', help='配置文件路径')
@click.option('--output-dir', '-o', help='Manifest输出目录')
@click.option('--left-only', is_flag=True, help='只扫描左侧')
@click.option('--right-only', is_flag=True, help='只扫描右侧')
def scan(config: Optional[str], output_dir: Optional[str], left_only: bool, right_only: bool):
    """
    扫描两端文件生成manifest
    
    扫描左侧工作目录和右侧备份目录，生成包含文件元数据的manifest。
    """
    sync_config = load_config_or_exit(config)
    
    if output_dir is None:
        output_dir = sync_config.manifest_dir
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    scanner = FileScanner(sync_config)
    timestamp = generate_timestamp_id()
    
    left_manifest = None
    right_manifest = None
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        
        if not right_only:
            task = progress.add_task("扫描左侧目录...", total=None)
            left_manifest = scanner.scan_left()
            progress.update(task, completed=1, total=1)
            
            left_path = output_path / f"manifest_left_{timestamp}.json"
            left_manifest.save(str(left_path))
            console.print(f"[green]左侧 manifest 已保存:[/green] {left_path}")
            console.print(f"  共 {len(left_manifest)} 个文件")
        
        if not left_only:
            task = progress.add_task("扫描右侧目录...", total=None)
            right_manifest = scanner.scan_right()
            progress.update(task, completed=1, total=1)
            
            right_path = output_path / f"manifest_right_{timestamp}.json"
            right_manifest.save(str(right_path))
            console.print(f"[green]右侧 manifest 已保存:[/green] {right_path}")
            console.print(f"  共 {len(right_manifest)} 个文件")
    
    if left_manifest and right_manifest:
        table = Table(title="扫描结果对比")
        table.add_column("项目", style="cyan")
        table.add_column("左侧", style="green")
        table.add_column("右侧", style="blue")
        
        table.add_row("文件数量", str(len(left_manifest)), str(len(right_manifest)))
        
        left_size = sum(f.size for f in left_manifest.files.values())
        right_size = sum(f.size for f in right_manifest.files.values())
        
        def format_size(size: int) -> str:
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024:
                    return f"{size:.2f} {unit}"
                size /= 1024
            return f"{size:.2f} TB"
        
        table.add_row("总大小", format_size(left_size), format_size(right_size))
        console.print(table)


@main.command()
@click.option('--config', '-c', help='配置文件路径')
@click.option('--left-manifest', '-l', help='左侧manifest文件路径')
@click.option('--right-manifest', '-r', help='右侧manifest文件路径')
@click.option('--output', '-o', help='计划输出路径')
@click.option('--save-quarantine', '-q', is_flag=True, default=True, help='保存冲突到quarantine')
def plan(
    config: Optional[str],
    left_manifest: Optional[str],
    right_manifest: Optional[str],
    output: Optional[str],
    save_quarantine: bool,
):
    """
    生成dry-run同步计划
    
    根据两端manifest生成同步计划，识别新增、修改、删除、重命名候选和各种冲突。
    冲突项将被隔离，不会直接执行。
    """
    sync_config = load_config_or_exit(config)
    
    manifest_dir = Path(sync_config.manifest_dir)
    
    if left_manifest is None:
        left_files = sorted(manifest_dir.glob("manifest_left_*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
        if not left_files:
            console.print("[red]错误: 未找到左侧manifest。请先运行 'field-sync scan'。[/red]")
            sys.exit(1)
        left_manifest = str(left_files[0])
    
    if right_manifest is None:
        right_files = sorted(manifest_dir.glob("manifest_right_*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
        if not right_files:
            console.print("[red]错误: 未找到右侧manifest。请先运行 'field-sync scan'。[/red]")
            sys.exit(1)
        right_manifest = str(right_files[0])
    
    console.print(f"[cyan]加载左侧 manifest:[/cyan] {left_manifest}")
    console.print(f"[cyan]加载右侧 manifest:[/cyan] {right_manifest}")
    
    left_mf = Manifest.load(left_manifest)
    right_mf = Manifest.load(right_manifest)
    
    generator = PlanGenerator(sync_config)
    sync_plan = generator.generate_plan(
        left_mf, right_mf,
        left_manifest_path=left_manifest,
        right_manifest_path=right_manifest,
    )
    
    if output is None:
        timestamp = generate_timestamp_id()
        plan_dir = Path(sync_config.plan_dir)
        plan_dir.mkdir(parents=True, exist_ok=True)
        output = str(plan_dir / f"plan_{timestamp}.json")
    
    sync_plan.save(output)
    console.print(f"[green]计划已保存:[/green] {output}")
    
    stats = sync_plan.statistics
    table = Table(title="同步计划统计")
    table.add_column("类别", style="cyan")
    table.add_column("数量", style="green")
    
    table.add_row("左侧文件", str(stats.get("left_files", 0)))
    table.add_row("右侧文件", str(stats.get("right_files", 0)))
    table.add_row("待执行操作", str(stats.get("operations_count", 0)))
    table.add_row("发现冲突", f"[red]{stats.get('conflicts_count', 0)}[/red]")
    
    if stats.get("operations_count", 0) > 0:
        table.add_row("  左→右复制", str(stats.get("copy_left_to_right", 0)))
        table.add_row("  右→左复制", str(stats.get("copy_right_to_left", 0)))
    
    console.print(table)
    
    if sync_plan.has_conflicts():
        console.print(Panel(
            "[yellow]警告: 计划包含冲突项，无法直接执行。[/yellow]\n"
            "请检查冲突详情并手动解决后重新扫描。",
            title="存在冲突",
            border_style="yellow"
        ))
        
        if save_quarantine:
            conflict_manager = ConflictManager(sync_config)
            quarantine_path = conflict_manager.quarantine_file_from_plan(sync_plan)
            console.print(f"[yellow]冲突项已隔离到:[/yellow] {quarantine_path}")
        
        for idx, conflict in enumerate(sync_plan.conflicts[:5], 1):
            console.print(f"\n[bold yellow]冲突 {idx}:[/bold yellow]")
            console.print(format_conflict_for_display(conflict))
        
        if len(sync_plan.conflicts) > 5:
            console.print(f"\n[yellow]... 还有 {len(sync_plan.conflicts) - 5} 个冲突未显示[/yellow]")
    
    else:
        console.print(Panel(
            "[green]计划无冲突，可以执行。[/green]\n"
            "运行 'field-sync apply' 执行同步。",
            title="计划就绪",
            border_style="green"
        ))


@main.command()
@click.option('--config', '-c', help='配置文件路径')
@click.option('--plan', '-p', help='计划文件路径')
@click.option('--dry-run', '-n', is_flag=True, help='仅预览，不实际执行')
@click.option('--force', '-f', is_flag=True, help='强制执行（即使有冲突，不推荐）')
def apply(config: Optional[str], plan: Optional[str], dry_run: bool, force: bool):
    """
    执行同步计划
    
    只能执行无冲突的计划。执行前写入journal，执行后逐项校验sha256。
    """
    sync_config = load_config_or_exit(config)
    
    if plan is None:
        plan_dir = Path(sync_config.plan_dir)
        plan_files = sorted(plan_dir.glob("plan_*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
        if not plan_files:
            console.print("[red]错误: 未找到计划文件。请先运行 'field-sync plan'。[/red]")
            sys.exit(1)
        plan = str(plan_files[0])
    
    console.print(f"[cyan]加载计划:[/cyan] {plan}")
    sync_plan = SyncPlan.load(plan)
    
    if sync_plan.has_conflicts() and not force:
        console.print("[red]错误: 计划包含冲突，无法执行。[/red]")
        console.print("请解决冲突后重新扫描和生成计划，或使用 --force 强制执行（不推荐）。")
        sys.exit(1)
    
    if sync_plan.get_operation_count() == 0:
        console.print("[green]计划中没有待执行的操作。[/green]")
        sys.exit(0)
    
    executor = Executor(sync_config, dry_run=dry_run)
    
    mode = "[yellow]预览模式[/yellow]" if dry_run else "[green]执行模式[/green]"
    console.print(f"\n开始执行同步计划 ({mode})...")
    console.print(f"待执行操作数: {sync_plan.get_operation_count()}")
    console.print()
    
    try:
        def progress_callback(current: int, total: int, desc: str):
            console.print(f"  [{current}/{total}] {desc}")
        
        journal, errors = executor.execute_plan(sync_plan, progress_callback=progress_callback)
        
        console.print()
        if errors:
            console.print(f"[red]执行完成，但有 {len(errors)} 个错误:[/red]")
            for error in errors[:10]:
                console.print(f"  - {error}")
            if len(errors) > 10:
                console.print(f"  ... 还有 {len(errors) - 10} 个错误")
        else:
            console.print("[green]所有操作执行完成！[/green]")
        
        if not dry_run:
            verify_errors = executor.verify_execution(journal)
            if verify_errors:
                console.print(f"[red]校验发现问题:[/red]")
                for error in verify_errors:
                    console.print(f"  - {error}")
            else:
                console.print("[green]SHA256 校验通过！[/green]")
            
            console.print(f"[cyan]Journal 已记录:[/cyan] {sync_config.journal_dir}")
    
    except ExecutionError as e:
        console.print(f"[red]执行错误: {e}[/red]")
        sys.exit(1)


@main.command()
@click.option('--config', '-c', help='配置文件路径')
@click.option('--journal', '-j', help='指定journal文件路径（默认使用最近一次）')
@click.option('--dry-run', '-n', is_flag=True, help='仅预览，不实际执行')
@click.option('--force', '-f', is_flag=True, help='强制撤销，即使检测到文件被修改')
def undo(config: Optional[str], journal: Optional[str], dry_run: bool, force: bool):
    """
    回滚最近一次同步操作
    
    根据journal回滚已复制、已删除和已改名的文件。
    遇到目标被用户改过时会停下来提示。
    """
    sync_config = load_config_or_exit(config)
    
    journal_manager = JournalManager(sync_config)
    
    if journal is None:
        latest = journal_manager.load_latest_journal()
        if latest is None:
            console.print("[red]错误: 未找到可撤销的journal记录。[/red]")
            sys.exit(1)
        journal_obj = latest
        console.print("[cyan]使用最近一次 journal[/cyan]")
    else:
        if not os.path.exists(journal):
            console.print(f"[red]错误: Journal 文件不存在: {journal}[/red]")
            sys.exit(1)
        journal_obj = journal_manager.load_journal(journal)
        console.print(f"[cyan]加载 journal:[/cyan] {journal}")
    
    if not journal_obj.is_applied:
        console.print("[yellow]该 journal 未执行任何操作，无需撤销。[/yellow]")
        sys.exit(0)
    
    mode = "[yellow]预览模式[/yellow]" if dry_run else "[green]执行模式[/green]"
    console.print(f"\n开始撤销操作 ({mode})...")
    
    completed_entries = [e for e in journal_obj.entries if e.status == "completed"]
    console.print(f"待撤销操作数: {len(completed_entries)}")
    console.print()
    
    def progress_callback(current: int, total: int, desc: str):
        console.print(f"  [{current}/{total}] {desc}")
    
    successes, failures = journal_manager.undo_journal(
        journal_obj,
        dry_run=dry_run,
        force=force,
        progress_callback=progress_callback,
    )
    
    console.print()
    if successes:
        console.print(f"[green]成功撤销 {len(successes)} 个操作:[/green]")
        for success in successes[:5]:
            console.print(f"  - {success}")
        if len(successes) > 5:
            console.print(f"  ... 还有 {len(successes) - 5} 个操作")
    
    if failures:
        console.print(f"[red]撤销失败 {len(failures)} 个操作:[/red]")
        for failure in failures:
            console.print(f"  - {failure}")
        
        if not force:
            console.print("\n[yellow]提示: 使用 --force 可以继续撤销剩余操作[/yellow]")


@main.command()
@click.option('--config', '-c', help='配置文件路径')
@click.option('--type', '-t', type=click.Choice(['scan', 'plan']), default='scan', help='报告类型')
@click.option('--format', '-f', 'fmt', type=click.Choice(['markdown', 'json', 'both']), default='both', help='输出格式')
@click.option('--output', '-o', help='输出文件路径')
@click.option('--left-manifest', '-l', help='左侧manifest路径')
@click.option('--right-manifest', '-r', help='右侧manifest路径')
@click.option('--plan-path', '-p', help='计划文件路径')
def report(
    config: Optional[str],
    type: str,
    fmt: str,
    output: Optional[str],
    left_manifest: Optional[str],
    right_manifest: Optional[str],
    plan_path: Optional[str],
):
    """
    导出同步报告
    
    支持导出扫描报告和计划报告，格式支持Markdown和JSON。
    """
    sync_config = load_config_or_exit(config)
    reporter = Reporter(sync_config)
    
    if type == 'scan':
        manifest_dir = Path(sync_config.manifest_dir)
        
        if left_manifest is None:
            left_files = sorted(manifest_dir.glob("manifest_left_*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
            if not left_files:
                console.print("[red]错误: 未找到左侧manifest。[/red]")
                sys.exit(1)
            left_manifest = str(left_files[0])
        
        if right_manifest is None:
            right_files = sorted(manifest_dir.glob("manifest_right_*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
            if not right_files:
                console.print("[red]错误: 未找到右侧manifest。[/red]")
                sys.exit(1)
            right_manifest = str(right_files[0])
        
        left_mf = Manifest.load(left_manifest)
        right_mf = Manifest.load(right_manifest)
        
        report_data = reporter.generate_scan_report(
            left_mf, right_mf,
            left_manifest_path=left_manifest,
            right_manifest_path=right_manifest,
        )
    
    else:
        if plan_path is None:
            plan_dir = Path(sync_config.plan_dir)
            plan_files = sorted(plan_dir.glob("plan_*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
            if not plan_files:
                console.print("[red]错误: 未找到计划文件。[/red]")
                sys.exit(1)
            plan_path = str(plan_files[0])
        
        sync_plan = SyncPlan.load(plan_path)
        report_data = reporter.generate_plan_report(sync_plan)
    
    output_base = output
    if output_base is None:
        timestamp = generate_timestamp_id()
        output_base = str(reporter.report_dir / f"report_{type}_{timestamp}")
    
    if fmt in ['markdown', 'both']:
        md_path = reporter.export_markdown(report_data, f"{output_base}.md")
        console.print(f"[green]Markdown 报告已导出:[/green] {md_path}")
    
    if fmt in ['json', 'both']:
        json_path = reporter.export_json(report_data, f"{output_base}.json")
        console.print(f"[green]JSON 报告已导出:[/green] {json_path}")


@main.command()
@click.option('--config', '-c', help='配置文件路径')
@click.option('--limit', '-n', type=int, default=10, help='显示最近N条记录')
@click.option('--type', '-t', type=click.Choice(['all', 'scan', 'plan', 'journal']), default='all', help='记录类型')
def history(config: Optional[str], limit: int, type: str):
    """
    查询历史记录
    
    查看过去的扫描、计划生成和同步操作历史。
    """
    sync_config = load_config_or_exit(config)
    
    manifest_dir = Path(sync_config.manifest_dir)
    plan_dir = Path(sync_config.plan_dir)
    journal_dir = Path(sync_config.journal_dir)
    
    records = []
    
    if type in ['all', 'scan'] and manifest_dir.exists():
        for mf in manifest_dir.glob("manifest_*.json"):
            if mf.name == "manifest_latest.json":
                continue
            stat = mf.stat()
            records.append({
                "type": "scan",
                "side": "left" if "left" in mf.name else "right",
                "path": str(mf),
                "time": stat.st_mtime,
            })
    
    if type in ['all', 'plan'] and plan_dir.exists():
        for pf in plan_dir.glob("plan_*.json"):
            stat = pf.stat()
            records.append({
                "type": "plan",
                "path": str(pf),
                "time": stat.st_mtime,
            })
    
    if type in ['all', 'journal'] and journal_dir.exists():
        for jf in journal_dir.glob("journal_*.json"):
            if jf.name == "journal_latest.json":
                continue
            stat = jf.stat()
            records.append({
                "type": "journal",
                "path": str(jf),
                "time": stat.st_mtime,
            })
    
    records.sort(key=lambda x: x["time"], reverse=True)
    records = records[:limit]
    
    if not records:
        console.print("[yellow]未找到历史记录[/yellow]")
        return
    
    table = Table(title="历史记录")
    table.add_column("#", style="cyan", width=3)
    table.add_column("类型", style="magenta", width=8)
    table.add_column("时间", style="green", width=20)
    table.add_column("详情", style="white")
    
    for idx, record in enumerate(records, 1):
        time_str = datetime.fromtimestamp(record["time"]).strftime("%Y-%m-%d %H:%M:%S")
        type_label = {
            "scan": f"[cyan]扫描[/cyan]",
            "plan": f"[yellow]计划[/yellow]",
            "journal": f"[green]执行[/green]",
        }.get(record["type"], record["type"])
        
        detail = record["path"]
        if record["type"] == "scan":
            detail = f"{'左侧' if record['side'] == 'left' else '右侧'} manifest"
        
        table.add_row(str(idx), type_label, time_str, detail)
    
    console.print(table)


if __name__ == "__main__":
    main()
