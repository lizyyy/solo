"""CLI 命令入口 - 越野跑赛事计时芯片核验工具"""

import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import print as rprint

from . import __version__
from .models import RaceData, ViolationLevel, SplitRecord
from .parsers import load_all_data, ParseError
from .rules import run_all_checks, build_split_records
from .review_store import ReviewStore, ResolutionType
from .reporter import generate_all_reports, generate_markdown_report


console = Console()


class Workspace:
    """工作区管理 - 存储和加载会话数据"""
    
    def __init__(self, workspace_dir: Path):
        self.workspace_dir = workspace_dir
        self.data_file = workspace_dir / "race_data.pkl"
        self.splits_file = workspace_dir / "splits.pkl"
        self.review_file = workspace_dir / "reviews.json"
        self.config_file = workspace_dir / "config.json"
        
    def exists(self) -> bool:
        return self.workspace_dir.exists()
    
    def init(self):
        """初始化工作区"""
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        if not self.config_file.exists():
            config = {
                "created_at": datetime.now().isoformat(),
                "version": __version__,
            }
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
    
    def save_race_data(self, data: RaceData):
        """保存赛事数据"""
        with open(self.data_file, "wb") as f:
            pickle.dump(data, f)
    
    def load_race_data(self) -> Optional[RaceData]:
        """加载赛事数据"""
        if not self.data_file.exists():
            return None
        with open(self.data_file, "rb") as f:
            return pickle.load(f)
    
    def save_splits(self, splits: Dict[str, List[SplitRecord]]):
        """保存分段记录"""
        with open(self.splits_file, "wb") as f:
            pickle.dump(splits, f)
    
    def load_splits(self) -> Optional[Dict[str, List[SplitRecord]]]:
        """加载分段记录"""
        if not self.splits_file.exists():
            return None
        with open(self.splits_file, "rb") as f:
            return pickle.load(f)
    
    def get_review_store(self) -> ReviewStore:
        """获取复核存储"""
        return ReviewStore(self.review_file)


def get_workspace(ctx: click.Context) -> Workspace:
    """从上下文获取工作区"""
    return ctx.obj["workspace"]


def ensure_race_data(ctx: click.Context) -> RaceData:
    """确保已加载赛事数据"""
    ws = get_workspace(ctx)
    data = ws.load_race_data()
    if data is None:
        console.print("[red]错误: 请先运行 import 命令导入数据[/red]")
        ctx.exit(1)
    return data


def ensure_splits(ctx: click.Context) -> Dict[str, List[SplitRecord]]:
    """确保已构建分段记录"""
    ws = get_workspace(ctx)
    splits = ws.load_splits()
    if splits is None:
        console.print("[red]错误: 请先运行 link 命令构建计时链[/red]")
        ctx.exit(1)
    return splits


@click.group()
@click.option(
    "--workspace", "-w",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path.cwd() / ".race-checker",
    help="工作区目录",
    show_default=True,
)
@click.version_option(__version__, prog_name="race-checker")
@click.pass_context
def main(ctx: click.Context, workspace: Path):
    """越野跑赛事计时芯片赛前核验工具
    
    用于赛前核查芯片绑定、波次分配、检查点读取等问题。
    """
    ctx.ensure_object(dict)
    ctx.obj["workspace"] = Workspace(workspace)


@main.command()
@click.option(
    "--participants", "-p",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="选手报名表 CSV",
)
@click.option(
    "--chips", "-c",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="芯片绑定表 CSV",
)
@click.option(
    "--waves", "-w",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="起跑波次表 CSV",
)
@click.option(
    "--checkpoints", "-cp",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="检查点配置 CSV",
)
@click.option(
    "--logs", "-l",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="设备日志 CSV",
)
@click.option(
    "--dnf", "-d",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="退赛名单 CSV",
)
@click.option(
    "--race-name", "-n",
    type=str,
    default="未命名赛事",
    help="赛事名称",
)
@click.pass_context
def import_data(
    ctx: click.Context,
    participants: Optional[Path],
    chips: Optional[Path],
    waves: Optional[Path],
    checkpoints: Optional[Path],
    logs: Optional[Path],
    dnf: Optional[Path],
    race_name: str,
):
    """导入多源 CSV 数据文件"""
    ws = get_workspace(ctx)
    ws.init()
    
    console.print(Panel.fit(f"[bold blue]导入数据 - {race_name}[/bold blue]"))
    
    try:
        data = load_all_data(
            participants_file=participants,
            chip_bindings_file=chips,
            waves_file=waves,
            checkpoints_file=checkpoints,
            logs_file=logs,
            dnf_file=dnf,
            race_name=race_name,
        )
        
        ws.save_race_data(data)
        
        table = Table(title="导入统计")
        table.add_column("数据类型", style="cyan")
        table.add_column("数量", style="magenta", justify="right")
        table.add_column("来源文件", style="green")
        
        table.add_row("选手", str(len(data.participants)), participants.name if participants else "-")
        table.add_row("芯片绑定", str(len(data.chip_bindings)), chips.name if chips else "-")
        table.add_row("波次", str(len(data.waves)), waves.name if waves else "-")
        table.add_row("检查点", str(len(data.checkpoints)), checkpoints.name if checkpoints else "-")
        table.add_row("设备日志", str(len(data.checkpoint_logs)), logs.name if logs else "-")
        table.add_row("退赛记录", str(len(data.dnf_records)), dnf.name if dnf else "-")
        
        console.print(table)
        console.print(f"\n[green]✓ 数据已保存到工作区: {ws.workspace_dir}[/green]")
        
    except ParseError as e:
        console.print(f"[red]✗ 解析错误: {e}[/red]")
        ctx.exit(1)


@main.command()
@click.pass_context
def link(ctx: click.Context):
    """构建选手-芯片-波次-检查点计时链"""
    data = ensure_race_data(ctx)
    ws = get_workspace(ctx)
    
    console.print(Panel.fit("[bold blue]构建计时链[/bold blue]"))
    
    try:
        splits = build_split_records(data)
        ws.save_splits(splits)
        
        total_splits = sum(len(s) for s in splits.values())
        participants_with_splits = len([p for p in splits.values() if p])
        
        table = Table(title="计时链统计")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="magenta", justify="right")
        
        table.add_row("关联选手数", str(participants_with_splits))
        table.add_row("总分段记录", str(total_splits))
        
        console.print(table)
        
        if splits:
            example_bib = next(iter(splits.keys()))
            example_splits = splits[example_bib]
            
            console.print(f"\n[bold]示例: 选手 {example_bib} 的分段记录[/bold]")
            split_table = Table()
            split_table.add_column("顺序", style="cyan")
            split_table.add_column("检查点", style="green")
            split_table.add_column("类型", style="yellow")
            split_table.add_column("读取时间", style="magenta")
            split_table.add_column("分段时间", style="blue")
            split_table.add_column("区间时间", style="red")
            
            for i, s in enumerate(example_splits[:5], 1):
                split_table.add_row(
                    str(i),
                    s.checkpoint.name,
                    s.checkpoint.cp_type.value,
                    s.log_time.strftime("%H:%M:%S"),
                    str(s.split_time).split(".")[0] if s.split_time else "-",
                    str(s.segment_time).split(".")[0] if s.segment_time else "-",
                )
            
            console.print(split_table)
            if len(example_splits) > 5:
                console.print(f"  ... 还有 {len(example_splits) - 5} 条记录")
        
        console.print("\n[green]✓ 计时链构建完成[/green]")
        
    except Exception as e:
        console.print(f"[red]✗ 构建失败: {e}[/red]")
        ctx.exit(1)


@main.command()
@click.option(
    "--max-speed",
    type=float,
    default=25.0,
    help="最大允许速度 (km/h)",
    show_default=True,
)
@click.option(
    "--grace-seconds",
    type=int,
    default=30,
    help="抢跑宽限时间 (秒)",
    show_default=True,
)
@click.option(
    "--wave-gap",
    type=int,
    default=5,
    help="波次间隔判定阈值 (分钟)",
    show_default=True,
)
@click.option(
    "--details", "-d",
    is_flag=True,
    help="显示详细违规信息",
)
@click.pass_context
def check(
    ctx: click.Context,
    max_speed: float,
    grace_seconds: int,
    wave_gap: int,
    details: bool,
):
    """运行所有校验规则"""
    data = ensure_race_data(ctx)
    ws = get_workspace(ctx)
    splits = ws.load_splits()
    
    if splits is None:
        console.print("[yellow]警告: 未找到计时链，将自动构建...[/yellow]")
        splits = build_split_records(data)
        ws.save_splits(splits)
    
    console.print(Panel.fit("[bold blue]运行规则校验[/bold blue]"))
    
    config = {
        "max_speed_kmh": max_speed,
        "grace_seconds": grace_seconds,
        "wave_gap_minutes": wave_gap,
    }
    
    violations = run_all_checks(data, splits, config)
    
    if not data.violations:
        data.violations = []
    data.violations = violations
    ws.save_race_data(data)
    
    critical = [v for v in violations if v.level == ViolationLevel.CRITICAL]
    warning = [v for v in violations if v.level == ViolationLevel.WARNING]
    info = [v for v in violations if v.level == ViolationLevel.INFO]
    
    stats_table = Table(title="违规统计")
    stats_table.add_column("级别", style="cyan")
    stats_table.add_column("数量", style="magenta", justify="right")
    stats_table.add_column("状态", style="green")
    
    stats_table.add_row("🔴 严重", str(len(critical)), "[red]需立即处理[/red]" if critical else "[green]无[/green]")
    stats_table.add_row("🟡 警告", str(len(warning)), "[yellow]建议核实[/yellow]" if warning else "[green]无[/green]")
    stats_table.add_row("🔵 信息", str(len(info)), "[blue]仅供参考[/blue]" if info else "[green]无[/green]")
    stats_table.add_row("合计", str(len(violations)), "")
    
    console.print(stats_table)
    
    if violations:
        console.print("\n[bold]违规类型分布:[/bold]")
        
        type_counts: Dict[str, int] = {}
        for v in violations:
            vt = v.violation_type.value
            type_counts[vt] = type_counts.get(vt, 0) + 1
        
        for vt, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
            console.print(f"  • {vt}: {count} 条")
        
        if details:
            console.print("\n[bold]详细违规记录:[/bold]")
            for v in violations[:20]:
                level_icon = "🔴" if v.level == ViolationLevel.CRITICAL else "🟡" if v.level == ViolationLevel.WARNING else "🔵"
                console.print(f"\n{level_icon} [{v.violation_id}] {v.violation_type.value}")
                console.print(f"   严重程度: {v.level.value}")
                console.print(f"   描述: {v.message}")
                if v.bib_number:
                    console.print(f"   选手: {v.bib_number}")
                if v.chip_id:
                    console.print(f"   芯片: {v.chip_id}")
            
            if len(violations) > 20:
                console.print(f"\n  ... 还有 {len(violations) - 20} 条记录")
    
    if critical:
        console.print(f"\n[red]⚠ 发现 {len(critical)} 条严重违规，请立即处理[/red]")
    elif warning:
        console.print(f"\n[yellow]⚠ 发现 {len(warning)} 条警告，建议核实[/yellow]")
    else:
        console.print("\n[green]✓ 未发现严重违规[/green]")


@main.command("list")
@click.option(
    "--level", "-l",
    type=click.Choice(["all", "critical", "warning", "info"]),
    default="all",
    help="按级别过滤",
)
@click.option(
    "--unreviewed", "-u",
    is_flag=True,
    help="仅显示未复核的",
)
@click.pass_context
def list_violations(ctx: click.Context, level: str, unreviewed: bool):
    """列出所有违规记录"""
    data = ensure_race_data(ctx)
    ws = get_workspace(ctx)
    review_store = ws.get_review_store()
    
    violations = data.violations or []
    
    if level == "critical":
        violations = [v for v in violations if v.level == ViolationLevel.CRITICAL]
    elif level == "warning":
        violations = [v for v in violations if v.level == ViolationLevel.WARNING]
    elif level == "info":
        violations = [v for v in violations if v.level == ViolationLevel.INFO]
    
    if unreviewed:
        violations = [
            v for v in violations
            if review_store.get_review(v.violation_id) is None
        ]
    
    console.print(Panel.fit(f"[bold blue]违规记录列表 ({len(violations)} 条)[/bold blue]"))
    
    if not violations:
        console.print("[green]无符合条件的违规记录[/green]")
        return
    
    table = Table()
    table.add_column("ID", style="cyan")
    table.add_column("类型", style="yellow")
    table.add_column("级别", style="magenta")
    table.add_column("选手/芯片", style="green")
    table.add_column("描述", style="white", overflow="fold")
    table.add_column("复核状态", style="blue")
    
    for v in violations:
        subject = v.bib_number or v.chip_id or "-"
        review = review_store.get_review(v.violation_id)
        review_status = f"[green]✓ {review.resolution.value}[/green]" if review else "[yellow]待复核[/yellow]"
        
        level_style = "red" if v.level == ViolationLevel.CRITICAL else "yellow" if v.level == ViolationLevel.WARNING else "blue"
        
        table.add_row(
            v.violation_id,
            v.violation_type.value,
            f"[{level_style}]{v.level.value}[/{level_style}]",
            subject,
            v.message[:60] + "..." if len(v.message) > 60 else v.message,
            review_status,
        )
    
    console.print(table)


@main.command()
@click.argument("violation_id", type=str)
@click.option(
    "--resolution", "-r",
    type=click.Choice(["confirm", "dismiss", "pending", "override"]),
    required=True,
    help="裁决类型",
)
@click.option(
    "--reviewer", "-a",
    type=str,
    help="复核人姓名",
)
@click.option(
    "--notes", "-n",
    type=str,
    help="复核备注",
)
@click.pass_context
def review(
    ctx: click.Context,
    violation_id: str,
    resolution: str,
    reviewer: Optional[str],
    notes: Optional[str],
):
    """保存人工裁决记录
    
    VIOLATION_ID: 违规记录ID (如 VABC1234)
    
    裁决类型:
    - confirm: 确认违规
    - dismiss: 忽略/误报
    - pending: 待进一步核实
    - override: 人工更正
    """
    data = ensure_race_data(ctx)
    ws = get_workspace(ctx)
    review_store = ws.get_review_store()
    
    violation = next(
        (v for v in data.violations if v.violation_id == violation_id.upper()),
        None
    )
    
    if not violation:
        console.print(f"[red]错误: 未找到违规记录 {violation_id}[/red]")
        ctx.exit(1)
    
    resolution_map = {
        "confirm": ResolutionType.CONFIRMED,
        "dismiss": ResolutionType.DISMISSED,
        "pending": ResolutionType.PENDING,
        "override": ResolutionType.MANUAL_OVERRIDE,
    }
    resolution_type = resolution_map[resolution]
    
    console.print(Panel.fit("[bold blue]保存复核记录[/bold blue]"))
    
    console.print(f"\n违规记录:")
    console.print(f"  ID: {violation.violation_id}")
    console.print(f"  类型: {violation.violation_type.value}")
    console.print(f"  级别: {violation.level.value}")
    console.print(f"  描述: {violation.message}")
    
    review_record = review_store.add_review(
        violation_id=violation.violation_id,
        violation_type=violation.violation_type.value,
        original_message=violation.message,
        resolution=resolution_type,
        reviewer=reviewer,
        notes=notes,
        bib_number=violation.bib_number,
        chip_id=violation.chip_id,
        evidence=violation.evidence,
    )
    
    console.print(f"\n[green]✓ 复核记录已保存[/green]")
    console.print(f"  复核ID: {review_record.review_id}")
    console.print(f"  裁决: {resolution_type.value}")
    if reviewer:
        console.print(f"  复核人: {reviewer}")
    if notes:
        console.print(f"  备注: {notes}")


@main.command()
@click.option(
    "--output", "-o",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path.cwd() / "reports",
    help="输出目录",
    show_default=True,
)
@click.option(
    "--format", "-f",
    type=click.Choice(["all", "markdown", "csv", "json"]),
    default="all",
    help="输出格式",
)
@click.option(
    "--prefix", "-p",
    type=str,
    default="race-audit",
    help="文件名前缀",
)
@click.pass_context
def report(
    ctx: click.Context,
    output: Path,
    format: str,
    prefix: str,
):
    """导出审计报告
    
    支持 Markdown、CSV、JSON 三种格式。
    """
    data = ensure_race_data(ctx)
    ws = get_workspace(ctx)
    splits = ensure_splits(ctx)
    review_store = ws.get_review_store()
    
    console.print(Panel.fit("[bold blue]生成审计报告[/bold blue]"))
    
    output.mkdir(parents=True, exist_ok=True)
    
    violations = data.violations or []
    
    if format == "all":
        result = generate_all_reports(
            race_data=data,
            violations=violations,
            participant_splits=splits,
            output_dir=output,
            review_store=review_store,
            prefix=prefix,
        )
        
        console.print(f"\n[green]✓ 已生成所有格式报告[/green]")
        console.print(f"\n输出目录: {output}")
        
        tree = Tree("报告文件", style="blue")
        if "markdown" in result:
            tree.add(f"[green]{result['markdown'].name}[/green] (Markdown)")
        if "json" in result:
            tree.add(f"[yellow]{result['json'].name}[/yellow] (JSON)")
        if "csv_dir" in result:
            csv_tree = tree.add(f"[magenta]{result['csv_dir'].name}/[/magenta] (CSV目录)")
            if "csv_files" in result:
                for f in result["csv_files"]:
                    csv_tree.add(f.name)
        
        console.print(tree)
        
    elif format == "markdown":
        md_content = generate_markdown_report(data, violations, splits, review_store)
        md_path = output / f"{prefix}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        console.print(f"[green]✓ Markdown 报告已生成: {md_path}[/green]")
        
    elif format == "json":
        from .reporter import generate_json_audit
        json_path = output / f"{prefix}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        generate_json_audit(data, violations, splits, json_path, review_store)
        console.print(f"[green]✓ JSON 报告已生成: {json_path}[/green]")
        
    elif format == "csv":
        from .reporter import generate_csv_audit
        csv_dir = output / f"{prefix}-csv-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        csv_files = generate_csv_audit(data, violations, splits, csv_dir, review_store)
        console.print(f"[green]✓ CSV 报告已生成到: {csv_dir}[/green]")
        for f in csv_files:
            console.print(f"  - {f.name}")


@main.command()
@click.pass_context
def status(ctx: click.Context):
    """显示当前工作区状态"""
    ws = get_workspace(ctx)
    
    console.print(Panel.fit("[bold blue]工作区状态[/bold blue]"))
    
    if not ws.exists():
        console.print("[yellow]工作区尚未初始化，请先运行 import 命令[/yellow]")
        return
    
    data = ws.load_race_data()
    splits = ws.load_splits()
    review_store = ws.get_review_store()
    
    table = Table(title="数据状态")
    table.add_column("项目", style="cyan")
    table.add_column("状态", style="green")
    
    status_data = "[green]✓ 已加载[/green]" if data else "[red]✗ 未导入[/red]"
    status_splits = "[green]✓ 已构建[/green]" if splits else "[yellow]○ 未构建[/yellow]"
    
    table.add_row("赛事数据", status_data)
    table.add_row("计时链", status_splits)
    
    if data:
        table.add_row("选手数", str(len(data.participants)))
        table.add_row("芯片绑定", str(len(data.chip_bindings)))
        table.add_row("违规记录", str(len(data.violations) if data.violations else 0))
    
    review_stats = review_store.get_statistics()
    table.add_row("已复核记录", str(review_stats["total_reviews"]))
    
    console.print(table)
    
    console.print(f"\n工作区目录: {ws.workspace_dir}")


if __name__ == "__main__":
    main()
