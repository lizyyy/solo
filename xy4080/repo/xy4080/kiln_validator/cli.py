"""窑炉升温曲线校验员 CLI 入口"""

from pathlib import Path
from typing import Optional
import json

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from kiln_validator import __version__
from kiln_validator.models import (
    KilnConfig,
    WorkpieceList,
    ProbeDataPoint,
    DEFAULT_MAX_RAMP_RATE_C_PER_HOUR,
)
from kiln_validator.parsers import (
    parse_firing_plan_csv,
    parse_workpiece_csv,
    parse_probe_data_csv,
)
from kiln_validator.thermo import run_thermal_simulation
from kiln_validator.rules import run_full_validation
from kiln_validator.reports import generate_all_reports


app = typer.Typer(
    name="kiln-validator",
    help="窑炉升温曲线校验员 - 小型陶艺工作室本地科学计算CLI",
    add_completion=False,
)
console = Console()


WORKSPACE_DIR = Path.cwd() / ".kiln-workspace"
CONFIG_FILE = WORKSPACE_DIR / "config.json"
PLAN_FILE = WORKSPACE_DIR / "plan.json"
WORKPIECES_FILE = WORKSPACE_DIR / "workpieces.json"
PROBE_FILE = WORKSPACE_DIR / "probe_data.json"
SIMULATION_FILE = WORKSPACE_DIR / "simulation.json"
VALIDATION_FILE = WORKSPACE_DIR / "validation.json"
REPORTS_DIR = WORKSPACE_DIR / "reports"


def version_callback(value: bool):
    if value:
        console.print(f"[bold green]窑炉升温曲线校验员[/bold green] 版本: [cyan]{__version__}[/cyan]")
        raise typer.Exit()


@app.callback()
def callback(
    version: bool = typer.Option(
        False, "--version", "-v", callback=version_callback, is_eager=True
    ),
):
    pass


@app.command()
def init(
    dir: Optional[Path] = typer.Option(
        None, "--dir", "-d", help="工作目录路径（默认当前目录下的 .kiln-workspace）"
    ),
    max_ramp_rate: float = typer.Option(
        DEFAULT_MAX_RAMP_RATE_C_PER_HOUR, "--max-ramp-rate", "-r", help="最大允许升温速率 (°C/小时)"
    ),
    glaze_tolerance: float = typer.Option(
        15.0, "--glaze-tolerance", "-g", help="釉料温区容差 (°C)"
    ),
):
    """
    初始化工作目录并创建默认配置文件。
    
    运行此命令后，将在工作目录创建 config.json 配置文件，可以手动编辑调整参数。
    """
    global WORKSPACE_DIR, CONFIG_FILE
    
    if dir:
        WORKSPACE_DIR = dir
        CONFIG_FILE = WORKSPACE_DIR / "config.json"
    
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    
    config = KilnConfig(
        max_ramp_rate_c_per_hour=max_ramp_rate,
        glaze_temperature_tolerance=glaze_tolerance,
    )
    
    config.to_file(CONFIG_FILE)
    
    console.print(Panel.fit(
        f"[bold green]✓ 初始化完成[/bold green]\n\n"
        f"工作目录: {WORKSPACE_DIR}\n"
        f"配置文件: {CONFIG_FILE}\n\n"
        f"当前配置:\n"
        f"  • 最大升温速率: {max_ramp_rate} °C/小时\n"
        f"  • 釉料温区容差: ±{glaze_tolerance} °C",
        title="窑炉升温曲线校验员",
        border_style="green",
    ))


@app.command("import-plan")
def import_plan(
    plan_csv: Path = typer.Argument(..., help="烧成计划CSV文件路径", exists=True),
    workpieces_csv: Optional[Path] = typer.Option(
        None, "--workpieces", "-w", help="作品清单CSV文件路径", exists=True
    ),
    probe_csv: Optional[Path] = typer.Option(
        None, "--probe", "-p", help="探头数据CSV文件路径", exists=True
    ),
):
    """
    导入烧成计划、作品清单和探头数据。
    
    烧成计划CSV必需，作品清单和探头数据可选。
    数据将被解析并保存到工作目录，供后续 simulate、check、report 命令使用。
    """
    _ensure_workspace()
    
    console.print("[cyan]正在导入数据...[/cyan]")
    
    console.print(f"  解析烧成计划: {plan_csv}")
    plan = parse_firing_plan_csv(plan_csv)
    plan_dict = plan.model_dump(mode="json")
    PLAN_FILE.write_text(json.dumps(plan_dict, ensure_ascii=False, indent=2), encoding="utf-8")
    console.print(f"    [green]✓[/green] 共 {len(plan.segments)} 个烧成段，总时长 {plan.total_duration_minutes} 分钟")
    
    if workpieces_csv:
        console.print(f"  解析作品清单: {workpieces_csv}")
        workpieces = parse_workpiece_csv(workpieces_csv)
        workpieces_dict = workpieces.model_dump(mode="json")
        WORKPIECES_FILE.write_text(json.dumps(workpieces_dict, ensure_ascii=False, indent=2), encoding="utf-8")
        console.print(f"    [green]✓[/green] 共 {workpieces.count} 件作品，最大厚度 {workpieces.max_thickness_cm}cm")
    
    if probe_csv:
        console.print(f"  解析探头数据: {probe_csv}")
        probe_data = parse_probe_data_csv(probe_csv)
        probe_dicts = [p.model_dump(mode="json") for p in probe_data]
        PROBE_FILE.write_text(json.dumps(probe_dicts, ensure_ascii=False, indent=2), encoding="utf-8")
        console.print(f"    [green]✓[/green] 共 {len(probe_data)} 个数据点")
    
    console.print(Panel.fit(
        "[bold green]✓ 导入完成[/bold green]",
        title="数据导入",
        border_style="green",
    ))


@app.command()
def simulate(
    thickness: Optional[float] = typer.Option(
        None, "--thickness", "-t", help="坯体厚度（厘米），默认使用已导入作品的最大厚度"
    ),
    plan_csv: Optional[Path] = typer.Option(
        None, "--plan", "-p", help="烧成计划CSV（如未import-plan，可用此参数直接指定）", exists=True
    ),
    config_json: Optional[Path] = typer.Option(
        None, "--config", "-c", help="配置文件JSON路径", exists=True
    ),
):
    """
    运行热模拟，按时间步估算热惯性与内外温差。
    
    模拟基于简化热传导模型，计算每个时间步的：
    - 窑炉环境温度
    - 坯体表面温度
    - 坯体中心温度
    - 内外温差（炸坯风险指标）
    """
    config = _load_config(config_json)
    
    if plan_csv:
        plan = parse_firing_plan_csv(plan_csv)
    else:
        plan = _load_plan()
    
    if thickness is None:
        if WORKPIECES_FILE.exists():
            workpieces = _load_workpieces()
            thickness = workpieces.max_thickness_cm
            console.print(f"[cyan]使用已导入作品的最大厚度: {thickness} cm[/cyan]")
        else:
            thickness = 2.0
            console.print(f"[yellow]未指定厚度，使用默认值: {thickness} cm[/yellow]")
    
    console.print(f"[cyan]运行热模拟...[/cyan]")
    console.print(f"  坯体厚度: {thickness} cm")
    console.print(f"  时间步长: {config.time_step_minutes} 分钟")
    
    simulation = run_thermal_simulation(plan, thickness, config)
    
    simulation_dict = simulation.model_dump(mode="json")
    SIMULATION_FILE.write_text(json.dumps(simulation_dict, ensure_ascii=False, indent=2), encoding="utf-8")
    
    table = Table(title="热模拟结果摘要")
    table.add_column("指标", style="cyan")
    table.add_column("值", style="green")
    
    table.add_row("总模拟步数", str(simulation.total_steps))
    table.add_row("总模拟时长", f"{simulation.total_minutes} 分钟")
    table.add_row("最高窑炉温度", f"{simulation.peak_oven_temperature_c:.1f} °C")
    table.add_row("最大内外温差", f"{simulation.max_internal_delta_c:.1f} °C")
    
    if simulation.max_internal_delta_at_step:
        step = simulation.max_internal_delta_at_step
        table.add_row("最大温差发生时间", f"{step.time_minutes} 分钟")
        if step.segment_name:
            table.add_row("所在段", step.segment_name)
    
    console.print("")
    console.print(table)
    
    if simulation.max_internal_delta_c >= 80:
        console.print(f"\n[bold red]⚠ 警告: 最大温差 {simulation.max_internal_delta_c:.1f}°C，炸坯风险极高！[/bold red]")
    elif simulation.max_internal_delta_c >= 40:
        console.print(f"\n[bold yellow]⚠ 注意: 最大温差 {simulation.max_internal_delta_c:.1f}°C，建议关注[/bold yellow]")


@app.command()
def check(
    plan_csv: Optional[Path] = typer.Option(
        None, "--plan", "-p", help="烧成计划CSV", exists=True
    ),
    workpieces_csv: Optional[Path] = typer.Option(
        None, "--workpieces", "-w", help="作品清单CSV", exists=True
    ),
    probe_csv: Optional[Path] = typer.Option(
        None, "--probe", "-r", help="探头数据CSV", exists=True
    ),
    config_json: Optional[Path] = typer.Option(
        None, "--config", "-c", help="配置文件JSON", exists=True
    ),
    simulate: bool = typer.Option(
        True, "--simulate/--no-simulate", help="是否同时运行热模拟"
    ),
):
    """
    执行完整校验，标出各类问题。
    
    校验项目包括：
    • 升温斜率超限
    • 保温不足
    • 降温段影响釉色
    • 探头漂移（如有探头数据）
    • 坯体厚度冲突
    • 釉料温区不匹配
    • 热模拟内外温差（如启用simulate）
    """
    config = _load_config(config_json)
    
    if plan_csv:
        plan = parse_firing_plan_csv(plan_csv)
    else:
        plan = _load_plan()
    
    if workpieces_csv:
        workpieces = parse_workpiece_csv(workpieces_csv)
    elif WORKPIECES_FILE.exists():
        workpieces = _load_workpieces()
    else:
        from kiln_validator.models import WorkpieceList
        workpieces = WorkpieceList(workpieces=[])
        console.print("[yellow]未提供作品清单，将跳过厚度和釉料相关校验[/yellow]")
    
    probe_data = None
    if probe_csv:
        probe_data = parse_probe_data_csv(probe_csv)
    elif PROBE_FILE.exists():
        probe_data = _load_probe_data()
    
    simulation_result = None
    if simulate and workpieces.count > 0:
        thickness = workpieces.max_thickness_cm
        console.print(f"[cyan]运行热模拟（厚度: {thickness}cm）...[/cyan]")
        simulation_result = run_thermal_simulation(plan, thickness, config)
    
    console.print(f"[cyan]执行校验规则...[/cyan]")
    
    validation = run_full_validation(
        plan=plan,
        workpieces=workpieces,
        config=config,
        simulation_result=simulation_result,
        probe_data=probe_data,
    )
    
    validation_dict = validation.model_dump(mode="json")
    VALIDATION_FILE.write_text(json.dumps(validation_dict, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    
    console.print("")
    _print_validation_summary(validation)
    console.print("")
    
    if validation.has_critical:
        console.print(Panel.fit(
            f"[bold red]🔴 发现 {validation.critical_count} 个严重问题，必须修复后才能烧制！[/bold red]",
            border_style="red",
        ))
    elif validation.has_warnings:
        console.print(Panel.fit(
            f"[bold yellow]🟡 发现 {validation.warning_count} 个警告，建议检查[/bold yellow]",
            border_style="yellow",
        ))
    else:
        console.print(Panel.fit(
            "[bold green]✓ 校验通过，未发现严重问题[/bold green]",
            border_style="green",
        ))
    
    if validation.issues:
        console.print("")
        for issue in validation.issues:
            icon = "🔴" if issue.is_critical else "🟡" if issue.is_warning else "ℹ️"
            loc = ""
            if issue.location_segment:
                loc = f" @ [{issue.location_segment}]"
            elif issue.location_minutes:
                loc = f" @ {issue.location_minutes}分钟"
            console.print(f"{icon} {issue.message}{loc}")
            if issue.suggestion:
                console.print(f"   💡 {issue.suggestion}")


@app.command()
def report(
    output_dir: Optional[Path] = typer.Option(
        None, "--output", "-o", help="输出目录（默认工作目录下的 reports 文件夹）"
    ),
    name: str = typer.Option(
        "kiln-validation-report", "--name", "-n", help="报告文件名（不含扩展名）"
    ),
    format: str = typer.Option(
        "all", "--format", "-f", help="输出格式: all/markdown/csv/json"
    ),
    validation_json: Optional[Path] = typer.Option(
        None, "--validation", "-v", help="校验结果JSON文件路径", exists=True
    ),
):
    """
    导出校验报告，支持 Markdown、CSV、JSON 三种格式。
    
    默认导出所有三种格式到工作目录的 reports 文件夹。
    """
    if validation_json:
        validation = _load_validation_from_file(validation_json)
    elif VALIDATION_FILE.exists():
        validation = _load_validation()
    else:
        console.print("[bold red]错误: 没有找到校验结果，请先运行 check 命令[/bold red]")
        raise typer.Exit(1)
    
    plan = _load_plan() if PLAN_FILE.exists() else None
    workpieces = _load_workpieces() if WORKPIECES_FILE.exists() else None
    simulation = _load_simulation() if SIMULATION_FILE.exists() else None
    config = _load_config() if CONFIG_FILE.exists() else None
    
    out_dir = output_dir or REPORTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    
    from kiln_validator.reports.generator import ReportGenerator
    
    gen = ReportGenerator(
        validation_result=validation,
        plan=plan,
        workpieces=workpieces,
        simulation=simulation,
        config=config,
    )
    
    paths = {}
    
    if format in ["all", "markdown"]:
        md_path = out_dir / f"{name}.md"
        md_path.write_text(gen.generate_markdown(), encoding="utf-8")
        paths["markdown"] = md_path
    
    if format in ["all", "csv"]:
        csv_path = out_dir / f"{name}.csv"
        csv_path.write_text(gen.generate_csv(), encoding="utf-8-sig")
        paths["csv"] = csv_path
    
    if format in ["all", "json"]:
        json_path = out_dir / f"{name}.json"
        json_path.write_text(gen.generate_json(), encoding="utf-8")
        paths["json"] = json_path
    
    console.print(Panel.fit(
        "[bold green]✓ 报告生成完成[/bold green]\n\n" +
        "\n".join(f"  • {fmt}: {path}" for fmt, path in paths.items()),
        title="报告导出",
        border_style="green",
    ))


def _ensure_workspace():
    """确保工作目录存在"""
    if not WORKSPACE_DIR.exists():
        WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
        config = KilnConfig.create_default()
        config.to_file(CONFIG_FILE)


def _load_config(path: Optional[Path] = None) -> KilnConfig:
    """加载配置"""
    config_path = path or CONFIG_FILE
    if config_path.exists():
        return KilnConfig.from_file(config_path)
    return KilnConfig.create_default()


def _load_plan() -> "FiringPlan":
    """加载已保存的烧成计划"""
    if not PLAN_FILE.exists():
        console.print("[bold red]错误: 未找到烧成计划，请先运行 import-plan 或使用 --plan 参数[/bold red]")
        raise typer.Exit(1)
    
    from kiln_validator.models import FiringPlan
    data = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    return FiringPlan.model_validate(data)


def _load_workpieces() -> WorkpieceList:
    """加载已保存的作品清单"""
    data = json.loads(WORKPIECES_FILE.read_text(encoding="utf-8"))
    return WorkpieceList.model_validate(data)


def _load_probe_data() -> list:
    """加载已保存的探头数据"""
    from kiln_validator.models import ProbeDataPoint
    data = json.loads(PROBE_FILE.read_text(encoding="utf-8"))
    return [ProbeDataPoint.model_validate(d) for d in data]


def _load_simulation():
    """加载已保存的模拟结果"""
    from kiln_validator.models import ThermoSimulationResult
    data = json.loads(SIMULATION_FILE.read_text(encoding="utf-8"))
    return ThermoSimulationResult.model_validate(data)


def _load_validation():
    """加载已保存的校验结果"""
    from kiln_validator.models import ValidationResult
    data = json.loads(VALIDATION_FILE.read_text(encoding="utf-8"))
    return ValidationResult.model_validate(data)


def _load_validation_from_file(path: Path):
    """从指定文件加载校验结果"""
    from kiln_validator.models import ValidationResult
    data = json.loads(path.read_text(encoding="utf-8"))
    return ValidationResult.model_validate(data)


def _print_validation_summary(validation):
    """打印校验摘要表格"""
    from kiln_validator.models import IssueCategory, IssueSeverity
    
    table = Table(title="校验问题统计")
    table.add_column("类别", style="cyan")
    table.add_column("🔴 严重", style="red")
    table.add_column("🟡 警告", style="yellow")
    table.add_column("ℹ️ 信息", style="blue")
    table.add_column("合计", style="green")
    
    for cat in IssueCategory:
        issues = validation.get_issues_by_category(cat)
        if not issues:
            continue
        
        critical = sum(1 for i in issues if i.is_critical)
        warning = sum(1 for i in issues if i.is_warning)
        info = len(issues) - critical - warning
        
        from kiln_validator.reports.generator import CATEGORY_NAMES
        cat_name = CATEGORY_NAMES.get(cat, cat.value)
        
        table.add_row(
            cat_name,
            str(critical) if critical > 0 else "-",
            str(warning) if warning > 0 else "-",
            str(info) if info > 0 else "-",
            str(len(issues)),
        )
    
    table.add_row(
        "[bold]总计[/bold]",
        f"[bold red]{validation.critical_count}[/bold red]",
        f"[bold yellow]{validation.warning_count}[/bold yellow]",
        f"[bold blue]{validation.info_count}[/bold blue]",
        f"[bold green]{validation.total_issues}[/bold green]",
    )
    
    console.print(table)


if __name__ == "__main__":
    app()
