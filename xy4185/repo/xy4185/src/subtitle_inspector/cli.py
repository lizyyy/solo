import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich import print as rprint

from . import __version__
from .models import (
    Report, ScanResult, CheckResult, FixPlan,
    IssueSeverity, IssueCategory
)
from .subtitle_parser import parse_subtitle_file
from .font_detector import FontDetector
from .rule_engine import RuleEngine, parse_program_csv
from .fix_plan import FixPlanner, FixGenerator
from .reporter import generate_reports


console = Console()


def scan_directory(directory: Path) -> ScanResult:
    subtitle_files: List = []
    font_files: List = []
    program_list = None
    
    for ext in ["*.srt", "*.ass"]:
        for file_path in directory.rglob(ext):
            try:
                subtitle_file = parse_subtitle_file(file_path)
                subtitle_files.append(subtitle_file)
            except Exception as e:
                console.print(f"[yellow]警告: 无法解析字幕文件 {file_path}: {e}[/yellow]")
    
    font_detector = FontDetector()
    fonts = font_detector.detect_fonts(directory)
    
    for font in fonts:
        all_text = "".join(
            entry.text 
            for sf in subtitle_files 
            for entry in sf.entries
        )
        font = font_detector.check_font_compatibility(font, [all_text])
        font_files.append(font)
    
    program_csv_paths = [
        directory / "program.csv",
        directory / "节目单.csv",
        directory / "playlist.csv",
    ]
    
    for csv_path in program_csv_paths:
        if csv_path.exists():
            program_list = parse_program_csv(csv_path)
            if program_list:
                break
    
    timecode_log = None
    log_paths = [
        directory / "timecode.log",
        directory / "时间码.log",
    ]
    for log_path in log_paths:
        if log_path.exists():
            try:
                with open(log_path, "r", encoding="utf-8") as f:
                    timecode_log = {"path": str(log_path), "content": f.read()[:1000]}
            except Exception:
                pass
    
    summary = {
        "subtitle_count": len(subtitle_files),
        "font_count": len(font_files),
        "has_program_list": program_list is not None,
        "has_timecode_log": timecode_log is not None,
        "languages": list({sf.language for sf in subtitle_files}),
        "total_entries": sum(len(sf.entries) for sf in subtitle_files)
    }
    
    return ScanResult(
        subtitle_files=subtitle_files,
        program_list=program_list,
        font_files=font_files,
        timecode_log=timecode_log,
        summary=summary
    )


def run_checks(
    scan_result: ScanResult,
    config: Optional[Dict] = None
) -> CheckResult:
    engine = RuleEngine()
    
    return engine.run_checks(
        subtitle_files=scan_result.subtitle_files,
        program_list=scan_result.program_list,
        font_files=scan_result.font_files,
        config=config
    )


@click.group()
@click.version_option(version=__version__, prog_name="subtitle-inspector")
@click.option("--debug/--no-debug", default=False, help="启用调试模式")
@click.pass_context
def main(ctx, debug):
    """演出字幕包巡检员 - 剧场字幕机管理员专用工具
    
    巡演前快速校验字幕包，发现潜在问题。
    """
    ctx.ensure_object(dict)
    ctx.obj["DEBUG"] = debug


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), help="输出扫描结果到 JSON 文件")
@click.pass_context
def scan(ctx, directory: Path, output: Optional[Path]):
    """建立字幕包索引
    
    扫描目录中的字幕文件、字体、节目单等，建立完整索引。
    
    DIRECTORY: 字幕包所在目录路径
    """
    console.print(f"[bold blue]🎬 演出字幕包巡检员 v{__version__}[/bold blue]")
    console.print(f"[bold]扫描目录:[/bold] {directory}")
    console.print()
    
    with console.status("[bold green]正在扫描...[/bold green]"):
        scan_result = scan_directory(directory)
    
    tree = Tree(f"[bold green]📦 字幕包概览[/bold green]")
    
    sub_tree = tree.add(f"[bold]字幕文件 ({len(scan_result.subtitle_files)})[/bold]")
    for sf in scan_result.subtitle_files:
        sub_tree.add(
            f"[cyan]{sf.path.name}[/cyan] - "
            f"{sf.format.upper()} | {sf.language} | "
            f"[yellow]{len(sf.entries)} 条[/yellow]"
        )
    
    if scan_result.program_list:
        prog_tree = tree.add(f"[bold]节目单 ({len(scan_result.program_list.items)} 个幕次)[/bold]")
        prog_tree.add(f"[cyan]{scan_result.program_list.path.name}[/cyan]")
    
    if scan_result.font_files:
        font_tree = tree.add(f"[bold]字体文件 ({len(scan_result.font_files)})[/bold]")
        for font in scan_result.font_files:
            missing = ""
            if font.missing_chars:
                missing = f" [red]⚠️ {len(font.missing_chars)} 缺字[/red]"
            font_tree.add(f"[cyan]{font.path.name}[/cyan] - {font.family} {missing}")
    
    console.print(tree)
    console.print()
    
    table = Table(title="扫描统计")
    table.add_column("项目", style="cyan")
    table.add_column("数值", style="magenta")
    
    table.add_row("字幕文件数", str(scan_result.summary["subtitle_count"]))
    table.add_row("字体文件数", str(scan_result.summary["font_count"]))
    table.add_row("检测语言", ", ".join(scan_result.summary["languages"]))
    table.add_row("字幕总条数", str(scan_result.summary["total_entries"]))
    table.add_row("节目单", "✓ 已检测" if scan_result.summary["has_program_list"] else "✗ 未检测")
    table.add_row("时间码日志", "✓ 已检测" if scan_result.summary["has_timecode_log"] else "✗ 未检测")
    
    console.print(table)
    
    if output:
        output_data = {
            "generated_at": datetime.now().isoformat(),
            "scan_result": {
                "summary": scan_result.summary,
                "subtitle_files": [
                    {
                        "path": str(sf.path),
                        "format": sf.format,
                        "encoding": sf.encoding,
                        "language": sf.language,
                        "entry_count": len(sf.entries)
                    }
                    for sf in scan_result.subtitle_files
                ],
                "font_files": [
                    {
                        "path": str(f.path),
                        "family": f.family,
                        "style": f.style,
                        "weight": f.weight,
                        "missing_chars": f.missing_chars[:20] if f.missing_chars else []
                    }
                    for f in scan_result.font_files
                ]
            }
        }
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2, default=str)
        console.print(f"\n[green]✓ 扫描结果已保存至: {output}[/green]")
    
    return scan_result


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--config", "-c", type=click.Path(exists=True, path_type=Path), help="规则配置文件")
@click.option("--severity", "-s", 
              type=click.Choice(["critical", "error", "warning", "info"]),
              default="info",
              help="显示的最低严重级别")
@click.pass_context
def check(ctx, directory: Path, config: Optional[Path], severity: str):
    """执行完整校验
    
    校验编码、时间轴、节目单一致性、缺字、禁用词、双语对齐等。
    
    DIRECTORY: 字幕包所在目录路径
    """
    console.print(f"[bold blue]🎬 演出字幕包巡检员 v{__version__}[/bold blue]")
    console.print(f"[bold]校验目录:[/bold] {directory}")
    console.print()
    
    with console.status("[bold green]正在扫描...[/bold green]"):
        scan_result = scan_directory(directory)
    
    rule_config = None
    if config:
        with open(config, "r", encoding="utf-8") as f:
            rule_config = json.load(f)
    
    with console.status("[bold green]正在执行校验规则...[/bold green]"):
        check_result = run_checks(scan_result, rule_config)
    
    severity_order = {
        "critical": 0,
        "error": 1,
        "warning": 2,
        "info": 3
    }
    min_level = severity_order[severity]
    
    filtered_issues = [
        i for i in check_result.issues 
        if severity_order[i.severity.value] <= min_level
    ]
    
    console.print(f"[bold]📊 校验结果[/bold]")
    console.print()
    
    table = Table(title="问题统计")
    table.add_column("严重程度", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_column("状态", style="green")
    
    stats = check_result.stats
    
    for sev_name, sev_label in [
        ("critical", "🔴 严重"),
        ("error", "🟠 错误"),
        ("warning", "🟡 警告"),
        ("info", "🔵 信息"),
    ]:
        count = stats["by_severity"].get(sev_name, 0)
        status = "[red]需处理[/red]" if count > 0 and sev_name in ["critical", "error"] else "[green]正常[/green]"
        table.add_row(sev_label, str(count), status if count == 0 else "")
    
    console.print(table)
    console.print()
    
    if filtered_issues:
        console.print(f"[bold]🔍 问题详情[/bold]")
        console.print()
        
        for issue in filtered_issues[:20]:
            sev_color = {
                "critical": "bold red",
                "error": "bold orange",
                "warning": "bold yellow",
                "info": "bold blue"
            }.get(issue.severity.value, "white")
            
            console.print(f"[{sev_color}]▲ {issue.title}[/{sev_color}]")
            console.print(f"  类别: {issue.category.value}")
            if issue.file:
                console.print(f"  文件: {issue.file.name}")
            if issue.position:
                console.print(f"  位置: {issue.position}")
            console.print(f"  描述: {issue.description}")
            if issue.suggested_fix:
                console.print(f"  [green]💡 建议:[/green] {issue.suggested_fix}")
            console.print()
        
        if len(filtered_issues) > 20:
            console.print(f"[yellow]... 还有 {len(filtered_issues) - 20} 个问题[/yellow]")
            console.print()
    
    if stats["by_severity"].get("critical", 0) > 0 or stats["by_severity"].get("error", 0) > 0:
        console.print("[red]⚠️ 检测到需要处理的问题，请使用 fix 命令查看修补建议，或 report 命令导出完整报告。[/red]")
    else:
        console.print("[green]✅ 未检测到严重问题！[/green]")
    
    ctx.obj["LAST_SCAN"] = scan_result
    ctx.obj["LAST_CHECK"] = check_result


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), help="临时输出目录")
@click.pass_context
def fix(ctx, directory: Path, output: Optional[Path]):
    """生成修补建议
    
    在临时目录生成修补建议文件，不会覆盖原文件。
    
    DIRECTORY: 字幕包所在目录路径
    """
    console.print(f"[bold blue]🎬 演出字幕包巡检员 v{__version__}[/bold blue]")
    console.print(f"[bold]生成修补建议:[/bold] {directory}")
    console.print()
    
    with console.status("[bold green]正在扫描...[/bold green]"):
        scan_result = scan_directory(directory)
    
    with console.status("[bold green]正在执行校验...[/bold green]"):
        check_result = run_checks(scan_result)
    
    if not check_result.issues:
        console.print("[green]✅ 没有检测到问题，无需修补。[/green]")
        return
    
    with console.status("[bold green]正在生成修补计划...[/bold green]"):
        planner = FixPlanner(scan_result, check_result)
        fix_plan = planner.create_fix_plan()
    
    console.print(f"[bold]🔧 修补计划[/bold]")
    console.print()
    console.print(f"共 {len(fix_plan.suggestions)} 条建议")
    console.print()
    
    for i, suggestion in enumerate(fix_plan.suggestions[:15], 1):
        console.print(f"[bold cyan]{i}.[/bold cyan] {suggestion.description}")
        if suggestion.file:
            console.print(f"   文件: {suggestion.file.name}")
        if "action" in suggestion.suggestion:
            console.print(f"   操作: {suggestion.suggestion['action']}")
        console.print()
    
    if len(fix_plan.suggestions) > 15:
        console.print(f"... 还有 {len(fix_plan.suggestions) - 15} 条建议")
        console.print()
    
    if output:
        generator = FixGenerator(directory)
        fixed_dir = generator.generate_fixed_files(fix_plan)
        
        import shutil
        shutil.copytree(fixed_dir, output, dirs_exist_ok=True)
        console.print(f"[green]✓ 修补建议已生成至: {output}[/green]")
    else:
        console.print("[yellow]提示: 使用 -o 参数指定输出目录以生成完整的修补文件副本。[/yellow]")
        console.print("      这将创建包含 FIX_MANIFEST.json 的修复建议目录。")


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), required=True, help="报告输出目录")
@click.option("--name", "-n", default="subtitle_inspection", help="报告文件名前缀")
@click.pass_context
def report(ctx, directory: Path, output: Path, name: str):
    """导出巡检报告
    
    导出 Markdown、CSV 问题清单和 JSON 审计包。
    
    DIRECTORY: 字幕包所在目录路径
    """
    console.print(f"[bold blue]🎬 演出字幕包巡检员 v{__version__}[/bold blue]")
    console.print(f"[bold]生成报告:[/bold] {directory}")
    console.print()
    
    with console.status("[bold green]正在扫描...[/bold green]"):
        scan_result = scan_directory(directory)
    
    with console.status("[bold green]正在执行校验...[/bold green]"):
        check_result = run_checks(scan_result)
    
    with console.status("[bold green]正在生成修补计划...[/bold green]"):
        planner = FixPlanner(scan_result, check_result)
        fix_plan = planner.create_fix_plan()
    
    report_obj = Report(
        scan_result=scan_result,
        check_result=check_result,
        fix_plan=fix_plan
    )
    
    with console.status("[bold green]正在导出报告...[/bold green]"):
        outputs = generate_reports(report_obj, output, name)
    
    console.print(f"[bold green]✓ 报告已生成:[/bold green]")
    console.print()
    
    for format_name, file_path in outputs.items():
        console.print(f"  - {format_name.upper()}: {file_path}")
    
    console.print()
    console.print(f"[bold]报告摘要:[/bold]")
    console.print(f"  - 检测字幕文件: {len(scan_result.subtitle_files)} 个")
    console.print(f"  - 检测字体文件: {len(scan_result.font_files)} 个")
    console.print(f"  - 发现问题: {check_result.stats['total']} 个")
    console.print(f"  - 修补建议: {len(fix_plan.suggestions)} 条")


if __name__ == "__main__":
    main()
