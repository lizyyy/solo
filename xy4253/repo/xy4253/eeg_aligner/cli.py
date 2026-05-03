import click
from datetime import datetime
from pathlib import Path
from typing import Optional, List
import logging
import sys

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from eeg_aligner import __version__
from eeg_aligner.models import ProjectData, IssueSeverity
from eeg_aligner.parsers import (
    EEGCSVParser,
    EventsJSONLParser,
    SleepStagesParser,
    ClockCalibrationParser,
    DataValidator,
)
from eeg_aligner.alignment import EventAligner
from eeg_aligner.rules import CheckEngine
from eeg_aligner.storage import ProjectStore
from eeg_aligner.export import ReportExporter
from eeg_aligner.sample_data import SampleDataGenerator

console = Console()
logger = logging.getLogger("eeg_aligner")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


def get_project_dir() -> Path:
    return Path.cwd() / ".eeg_aligner"


def load_project_or_exit() -> ProjectData:
    project_dir = get_project_dir()
    store = ProjectStore(project_dir)
    
    try:
        return store.load()
    except FileNotFoundError:
        console.print("[bold red]错误:[/bold red] 未找到项目数据。请先运行 'eeg-aligner import' 或 'eeg-aligner init' 命令。")
        sys.exit(1)


def save_project(data: ProjectData) -> None:
    project_dir = get_project_dir()
    store = ProjectStore(project_dir)
    data.updated_at = datetime.now()
    store.save(data)


@click.group()
@click.version_option(__version__, "--version", "-v")
@click.option("--verbose", "-V", is_flag=True, help="显示详细日志")
def main(verbose: bool = False):
    """脑电事件码对齐员 - 睡眠实验室事件码对齐和校验工具"""
    if verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Verbose mode enabled")


@main.command()
@click.option("--output", "-o", type=click.Path(path_type=Path), default=None,
              help="示例数据输出目录 (默认: ./sample_data)")
@click.option("--seed", "-s", type=int, default=None,
              help="随机种子 (用于生成可重复的示例数据)")
def init(output: Optional[Path], seed: Optional[int]):
    """生成示例数据项目"""
    
    if output is None:
        output = Path.cwd() / "sample_data"
    
    console.print(Panel.fit(
        f"[bold cyan]脑电事件码对齐员 - 示例数据生成器[/bold cyan]\n"
        f"版本: {__version__}",
        title="初始化项目"
    ))
    
    console.print(f"\n[bold]正在生成示例数据到:[/bold] {output}")
    
    generator = SampleDataGenerator(seed=seed)
    files = generator.save_sample_data(output)
    
    console.print("\n[bold green]✓[/bold green] 示例数据生成完成!")
    console.print("\n[bold]生成的文件:[/bold]")
    for name, path in files.items():
        console.print(f"  - {path.name}")
    
    console.print("\n[bold]下一步操作:[/bold]")
    console.print(f"  1. cd {output}")
    console.print(f"  2. eeg-aligner import --eeg eeg_summary.csv --events events.jsonl --stages sleep_stages.csv --calibration clock_calibration.csv")
    console.print(f"  3. eeg-aligner align")
    console.print(f"  4. eeg-aligner check")
    console.print(f"  5. eeg-aligner report --output ./reports")
    
    console.print("\n[bold]提示:[/bold] 使用 --seed 参数可以生成相同的示例数据")


@main.command()
@click.option("--eeg", "-e", type=click.Path(exists=True, path_type=Path),
              help="EEG通道摘要 CSV 文件")
@click.option("--events", "-E", type=click.Path(exists=True, path_type=Path),
              help="刺激事件 JSONL 文件")
@click.option("--stages", "-s", type=click.Path(exists=True, path_type=Path),
              help="睡眠分期表 CSV/TXT 文件")
@click.option("--calibration", "-c", type=click.Path(exists=True, path_type=Path),
              help="时钟校准记录 CSV/JSON/JSONL 文件")
@click.option("--validate/--no-validate", default=True,
              help="导入后自动校验数据 (默认: 开启)")
def import_data(eeg: Optional[Path], events: Optional[Path], stages: Optional[Path],
                calibration: Optional[Path], validate: bool):
    """导入实验数据文件"""
    
    console.print(Panel.fit(
        "[bold cyan]脑电事件码对齐员 - 数据导入[/bold cyan]",
        title="导入数据"
    ))
    
    if not any([eeg, events, stages, calibration]):
        console.print("[bold red]错误:[/bold red] 至少需要指定一个数据文件 (--eeg, --events, --stages, 或 --calibration)")
        sys.exit(1)
    
    project_dir = get_project_dir()
    store = ProjectStore(project_dir)
    
    try:
        project_data = store.load()
        console.print(f"\n[bold]加载现有项目:[/bold] {project_data.project_id}")
    except FileNotFoundError:
        project_id = f"proj_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        now = datetime.now()
        project_data = ProjectData(
            project_id=project_id,
            created_at=now,
            updated_at=now,
        )
        console.print(f"\n[bold]创建新项目:[/bold] {project_id}")
    
    if eeg:
        console.print(f"\n[bold]解析 EEG 摘要:[/bold] {eeg.name}")
        parser = EEGCSVParser()
        summaries = parser.parse(eeg)
        project_data.eeg_summaries = summaries
        console.print(f"  [green]✓[/green] 解析了 {len(summaries)} 个通道")
        
        for issue in parser.get_issues():
            console.print(f"  [yellow]⚠[/yellow] {issue}")
    
    if events:
        console.print(f"\n[bold]解析事件数据:[/bold] {events.name}")
        parser = EventsJSONLParser()
        parsed_events = parser.parse(events)
        project_data.events = parsed_events
        console.print(f"  [green]✓[/green] 解析了 {len(parsed_events)} 个事件")
        
        for issue in parser.get_issues():
            console.print(f"  [yellow]⚠[/yellow] {issue.message}")
    
    if stages:
        console.print(f"\n[bold]解析睡眠分期:[/bold] {stages.name}")
        parser = SleepStagesParser()
        parsed_stages = parser.parse(stages)
        project_data.sleep_stages = parsed_stages
        console.print(f"  [green]✓[/green] 解析了 {len(parsed_stages)} 个分期")
        
        for issue in parser.get_issues():
            console.print(f"  [yellow]⚠[/yellow] {issue.message}")
    
    if calibration:
        console.print(f"\n[bold]解析时钟校准:[/bold] {calibration.name}")
        parser = ClockCalibrationParser()
        parsed_calib = parser.parse(calibration)
        project_data.clock_calibrations = parsed_calib
        console.print(f"  [green]✓[/green] 解析了 {len(parsed_calib)} 个校准点")
        
        for issue in parser.get_issues():
            console.print(f"  [yellow]⚠[/yellow] {issue.message}")
    
    if validate:
        console.print("\n[bold]校验数据...[/bold]")
        validator = DataValidator()
        is_valid = validator.validate_all(
            project_data.eeg_summaries,
            project_data.events,
            project_data.sleep_stages,
            project_data.clock_calibrations,
        )
        
        issues_by_severity = validator.get_issues_by_severity()
        critical_count = len(issues_by_severity[IssueSeverity.CRITICAL])
        warning_count = len(issues_by_severity[IssueSeverity.WARNING])
        info_count = len(issues_by_severity[IssueSeverity.INFO])
        
        if critical_count > 0:
            console.print(f"  [bold red]✗[/bold red] 发现 {critical_count} 个严重问题")
        if warning_count > 0:
            console.print(f"  [bold yellow]⚠[/bold yellow] 发现 {warning_count} 个警告")
        if info_count > 0:
            console.print(f"  [bold blue]ℹ[/bold blue] 发现 {info_count} 个信息提示")
        
        if is_valid:
            console.print("  [bold green]✓[/bold green] 数据校验通过")
    
    save_project(project_data)
    
    console.print("\n[bold green]✓[/bold green] 数据导入完成!")
    console.print(f"\n[bold]项目信息:[/bold]")
    console.print(f"  项目ID: {project_data.project_id}")
    console.print(f"  EEG通道数: {len(project_data.eeg_summaries)}")
    console.print(f"  事件数: {len(project_data.events)}")
    console.print(f"  睡眠分期数: {len(project_data.sleep_stages)}")
    console.print(f"  校准点数: {len(project_data.clock_calibrations)}")
    
    console.print("\n[bold]下一步:[/bold] 运行 'eeg-aligner align' 进行时钟对齐")


@main.command()
@click.option("--force-method", "-m", type=str, default=None,
              help="强制使用指定的对齐方法 (linear, single_point, average)")
def align(force_method: Optional[str]):
    """估计时钟漂移并对齐事件时间戳"""
    
    console.print(Panel.fit(
        "[bold cyan]脑电事件码对齐员 - 时钟对齐[/bold cyan]",
        title="对齐事件"
    ))
    
    project_data = load_project_or_exit()
    
    if not project_data.events:
        console.print("[bold red]错误:[/bold red] 没有事件数据。请先运行 'eeg-aligner import --events'")
        sys.exit(1)
    
    console.print(f"\n[bold]项目信息:[/bold] {project_data.project_id}")
    console.print(f"  事件数: {len(project_data.events)}")
    console.print(f"  校准点数: {len(project_data.clock_calibrations)}")
    console.print(f"  EEG通道数: {len(project_data.eeg_summaries)}")
    
    console.print("\n[bold]执行时钟对齐...[/bold]")
    
    aligner = EventAligner()
    aligned_events, alignment_result = aligner.align_events(
        project_data.events,
        project_data.clock_calibrations,
        project_data.eeg_summaries,
        force_method=force_method,
    )
    
    project_data.events = aligned_events
    project_data.alignment_result = alignment_result
    
    table = Table(title="对齐结果")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("对齐方法", alignment_result.alignment_method)
    table.add_row("估计漂移", f"{alignment_result.drift_estimate_ms:.2f} ms")
    table.add_row("置信度", f"{alignment_result.drift_confidence:.0%}")
    table.add_row("已对齐事件", f"{alignment_result.aligned_events_count}")
    table.add_row("同步点数", f"{len(alignment_result.sync_points)}")
    
    console.print(table)
    
    if alignment_result.issues:
        console.print("\n[bold yellow]对齐问题:[/bold yellow]")
        for issue in alignment_result.issues[:5]:
            console.print(f"  - {issue.message}")
        if len(alignment_result.issues) > 5:
            console.print(f"  ... 还有 {len(alignment_result.issues) - 5} 个问题")
    
    save_project(project_data)
    
    console.print("\n[bold green]✓[/bold green] 时钟对齐完成!")
    console.print("\n[bold]下一步:[/bold] 运行 'eeg-aligner check' 检查数据质量")


@main.command()
@click.option("--expected-codes", "-c", type=str, default=None,
              help="期望的事件码列表 (逗号分隔, 如: 1,2,3,4,5)")
@click.option("--min-interval", "-i", type=float, default=10.0,
              help="最小事件间隔 (毫秒, 默认: 10)")
@click.option("--max-overlap", "-o", type=float, default=0.5,
              help="最大允许伪迹重叠比例 (0-1, 默认: 0.5)")
@click.option("--use-original/--use-aligned", default=False,
              help="使用原始时间戳而非对齐后的时间戳 (默认: 使用对齐后的)")
def check(expected_codes: Optional[str], min_interval: float, max_overlap: float,
          use_original: bool):
    """检查漏码、重码、分期冲突和伪迹重叠"""
    
    console.print(Panel.fit(
        "[bold cyan]脑电事件码对齐员 - 数据检查[/bold cyan]",
        title="检查数据"
    ))
    
    project_data = load_project_or_exit()
    
    if not project_data.events:
        console.print("[bold red]错误:[/bold red] 没有事件数据。请先运行 'eeg-aligner import'")
        sys.exit(1)
    
    expected_codes_list: List[int] = []
    if expected_codes:
        try:
            expected_codes_list = [int(c.strip()) for c in expected_codes.split(",")]
            console.print(f"\n[bold]期望事件码:[/bold] {expected_codes_list}")
        except ValueError:
            console.print("[bold red]错误:[/bold red] 期望事件码格式错误，请使用逗号分隔的整数")
            sys.exit(1)
    
    console.print(f"\n[bold]检查参数:[/bold]")
    console.print(f"  最小事件间隔: {min_interval} ms")
    console.print(f"  最大伪迹重叠比例: {max_overlap:.0%}")
    console.print(f"  使用时间戳: {'原始' if use_original else '对齐后'}")
    
    console.print("\n[bold]执行数据检查...[/bold]")
    
    check_engine = CheckEngine(
        expected_codes=expected_codes_list,
        min_interval_ms=min_interval,
        max_artifact_overlap_ratio=max_overlap,
    )
    
    check_result = check_engine.check_all(
        project_data.events,
        project_data.sleep_stages,
        use_aligned_timestamps=not use_original,
    )
    
    project_data.check_result = check_result
    
    summary_table = Table(title="检查结果摘要")
    summary_table.add_column("指标", style="cyan")
    summary_table.add_column("数量", style="green")
    summary_table.add_row("总事件数", f"{check_result.total_events}")
    summary_table.add_row("有效事件数", f"{check_result.valid_events}")
    summary_table.add_row("总分期数", f"{check_result.total_epochs}")
    summary_table.add_row("🔴 严重问题", f"{check_result.critical_issue_count}")
    summary_table.add_row("🟡 警告问题", f"{check_result.warning_issue_count}")
    summary_table.add_row("🔵 信息提示", f"{check_result.info_issue_count}")
    
    console.print(summary_table)
    
    if check_result.missing_codes:
        console.print(f"\n[bold red]🔴 缺失的事件码:[/bold red] {check_result.missing_codes}")
    
    if check_result.duplicate_codes:
        console.print(f"\n[bold yellow]🟡 重复的事件码:[/bold yellow] {check_result.duplicate_codes}")
    
    if check_result.stage_conflicts:
        console.print(f"\n[bold yellow]🟡 睡眠分期冲突:[/bold yellow] {len(check_result.stage_conflicts)} 个")
        for conflict in check_result.stage_conflicts[:3]:
            epoch = conflict.get("epoch_number", "N/A")
            stage = conflict.get("epoch_stage", "N/A")
            code = conflict.get("event_code", "N/A")
            console.print(f"  - 事件 {code} 在第 {epoch} 期 ({stage})")
        if len(check_result.stage_conflicts) > 3:
            console.print(f"  ... 还有 {len(check_result.stage_conflicts) - 3} 个冲突")
    
    if check_result.artifact_overlaps:
        console.print(f"\n[bold red]🔴 伪迹重叠:[/bold red] {len(check_result.artifact_overlaps)} 个")
        for overlap in check_result.artifact_overlaps[:3]:
            code = overlap.get("overlapping_event_code", "N/A")
            ratio = overlap.get("overlap_ratio", 0)
            console.print(f"  - 事件 {code} 与伪迹重叠 {ratio:.0%}")
        if len(check_result.artifact_overlaps) > 3:
            console.print(f"  ... 还有 {len(check_result.artifact_overlaps) - 3} 个重叠")
    
    if check_result.issues:
        console.print("\n[bold]详细问题列表:[/bold]")
        
        critical = [i for i in check_result.issues if i.severity == IssueSeverity.CRITICAL]
        warning = [i for i in check_result.issues if i.severity == IssueSeverity.WARNING]
        info = [i for i in check_result.issues if i.severity == IssueSeverity.INFO]
        
        if critical:
            console.print(f"\n[bold red]🔴 严重问题 ({len(critical)}):[/bold red]")
            for issue in critical[:5]:
                console.print(f"  - {issue.message}")
                if issue.suggestion:
                    console.print(f"    建议: {issue.suggestion}")
        
        if warning:
            console.print(f"\n[bold yellow]🟡 警告问题 ({len(warning)}):[/bold yellow]")
            for issue in warning[:5]:
                console.print(f"  - {issue.message}")
        
        if info:
            console.print(f"\n[bold blue]🔵 信息提示 ({len(info)}):[/bold blue]")
            for issue in info[:3]:
                console.print(f"  - {issue.message}")
    
    save_project(project_data)
    
    console.print("\n[bold green]✓[/bold green] 数据检查完成!")
    
    if check_result.critical_issue_count > 0:
        console.print(f"\n[bold red]⚠[/bold red] 发现 {check_result.critical_issue_count} 个严重问题，建议处理后再进行分析")
    
    console.print("\n[bold]下一步:[/bold] 运行 'eeg-aligner report' 导出审计报告")


@main.command()
@click.option("--output", "-o", type=click.Path(path_type=Path), required=True,
              help="输出目录路径")
@click.option("--format", "-f", type=click.Choice(["all", "markdown", "csv", "json", "zip"]),
              default="all", help="输出格式 (默认: all)")
@click.option("--name", "-n", type=str, default=None,
              help="报告包名称 (默认: 自动生成)")
def report(output: Path, format: str, name: Optional[str]):
    """导出 Markdown、CSV、JSON 审计包"""
    
    console.print(Panel.fit(
        "[bold cyan]脑电事件码对齐员 - 报告导出[/bold cyan]",
        title="导出报告"
    ))
    
    project_data = load_project_or_exit()
    
    console.print(f"\n[bold]项目信息:[/bold] {project_data.project_id}")
    console.print(f"  输出目录: {output}")
    console.print(f"  输出格式: {format}")
    
    exporter = ReportExporter()
    
    if format == "all" or format == "zip":
        console.print("\n[bold]生成审计包...[/bold]")
        zip_path = exporter.export_audit_package(
            project_data,
            output,
            package_name=name,
        )
        console.print(f"  [green]✓[/green] 审计包已保存: {zip_path}")
    
    if format == "all" or format == "markdown":
        md_path = output / "audit_report.md"
        console.print(f"\n[bold]生成 Markdown 报告...[/bold]")
        exporter.markdown_exporter.export(project_data, md_path)
        console.print(f"  [green]✓[/green] Markdown 报告已保存: {md_path}")
    
    if format == "all" or format == "csv":
        console.print(f"\n[bold]生成 CSV 报告...[/bold]")
        
        summary_path = output / "summary.csv"
        exporter.csv_exporter.export_summary(project_data, summary_path)
        console.print(f"  [green]✓[/green] 摘要已保存: {summary_path}")
        
        if project_data.events:
            events_path = output / "events.csv"
            exporter.csv_exporter.export_events(project_data.events, events_path)
            console.print(f"  [green]✓[/green] 事件列表已保存: {events_path}")
        
        if project_data.sleep_stages:
            stages_path = output / "sleep_stages.csv"
            exporter.csv_exporter.export_stages(project_data.sleep_stages, stages_path)
            console.print(f"  [green]✓[/green] 睡眠分期已保存: {stages_path}")
        
        if project_data.check_result:
            issues_path = output / "issues.csv"
            exporter.csv_exporter.export_issues(project_data.check_result, issues_path)
            console.print(f"  [green]✓[/green] 问题列表已保存: {issues_path}")
    
    if format == "all" or format == "json":
        json_path = output / "full_data.json"
        console.print(f"\n[bold]生成 JSON 导出...[/bold]")
        exporter.json_exporter.export_project(project_data, json_path)
        console.print(f"  [green]✓[/green] 完整数据已保存: {json_path}")
    
    console.print("\n[bold green]✓[/bold green] 报告导出完成!")
    
    if project_data.check_result and project_data.check_result.critical_issue_count > 0:
        console.print(f"\n[bold red]⚠[/bold red] 注意: 报告包含 {project_data.check_result.critical_issue_count} 个严重问题")


@main.command()
def status():
    """显示当前项目状态"""
    
    console.print(Panel.fit(
        "[bold cyan]脑电事件码对齐员 - 项目状态[/bold cyan]",
        title="项目状态"
    ))
    
    project_dir = get_project_dir()
    store = ProjectStore(project_dir)
    info = store.get_project_info()
    
    if not info.get("exists"):
        console.print("\n[bold yellow]当前目录没有项目数据[/bold yellow]")
        console.print("\n[bold]可用命令:[/bold]")
        console.print("  eeg-aligner init      - 生成示例数据")
        console.print("  eeg-aligner import    - 导入实验数据")
        sys.exit(0)
    
    project_data = load_project_or_exit()
    
    table = Table(title="项目信息")
    table.add_column("属性", style="cyan")
    table.add_column("值", style="green")
    table.add_row("项目ID", project_data.project_id)
    table.add_row("创建时间", project_data.created_at.strftime("%Y-%m-%d %H:%M:%S") if project_data.created_at else "N/A")
    table.add_row("更新时间", project_data.updated_at.strftime("%Y-%m-%d %H:%M:%S") if project_data.updated_at else "N/A")
    table.add_row("EEG通道数", f"{len(project_data.eeg_summaries)}")
    table.add_row("事件数", f"{len(project_data.events)}")
    table.add_row("睡眠分期数", f"{len(project_data.sleep_stages)}")
    table.add_row("校准点数", f"{len(project_data.clock_calibrations)}")
    
    console.print(table)
    
    if project_data.alignment_result:
        align_table = Table(title="对齐状态")
        align_table.add_column("属性", style="cyan")
        align_table.add_column("值", style="green")
        align_table.add_row("对齐方法", project_data.alignment_result.alignment_method)
        align_table.add_row("估计漂移", f"{project_data.alignment_result.drift_estimate_ms:.2f} ms")
        align_table.add_row("置信度", f"{project_data.alignment_result.drift_confidence:.0%}")
        console.print(align_table)
    else:
        console.print("\n[bold yellow]⚠[/bold yellow] 尚未执行时钟对齐")
        console.print("  运行 'eeg-aligner align' 进行对齐")
    
    if project_data.check_result:
        check_table = Table(title="检查状态")
        check_table.add_column("属性", style="cyan")
        check_table.add_column("值", style="green")
        check_table.add_row("严重问题", f"{project_data.check_result.critical_issue_count}")
        check_table.add_row("警告问题", f"{project_data.check_result.warning_issue_count}")
        check_table.add_row("信息提示", f"{project_data.check_result.info_issue_count}")
        console.print(check_table)
    else:
        console.print("\n[bold yellow]⚠[/bold yellow] 尚未执行数据检查")
        console.print("  运行 'eeg-aligner check' 进行检查")
    
    console.print("\n[bold]可用操作:[/bold]")
    if not project_data.alignment_result:
        console.print("  eeg-aligner align     - 执行时钟对齐")
    elif not project_data.check_result:
        console.print("  eeg-aligner check     - 执行数据检查")
    else:
        console.print("  eeg-aligner report    - 导出审计报告")


if __name__ == "__main__":
    main()
