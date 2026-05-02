"""闸泵联排演算器 CLI 入口模块。"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from zha_beng_yan_suan_qi import __version__
from zha_beng_yan_suan_qi.parser import DataParser
from zha_beng_yan_suan_qi.scheduler import Scheduler
from zha_beng_yan_suan_qi.storage import StateStorage
from zha_beng_yan_suan_qi.exporter import Exporter
from zha_beng_yan_suan_qi.types import (
    SiteConfig,
    ImportedData,
    AlertType,
    AlertLevel,
)


console = Console()
ERROR_CONSOLE = Console(stderr=True)


def get_workspace() -> Path:
    """获取工作空间目录。"""
    workspace = Path.cwd() / ".zha-beng-workspace"
    workspace.mkdir(exist_ok=True)
    return workspace


def get_config_path() -> Path:
    """获取站点配置文件路径。"""
    return get_workspace() / "site_config.json"


def get_storage() -> StateStorage:
    """获取状态存储实例。"""
    return StateStorage(get_workspace())


def load_site_config() -> SiteConfig:
    """加载站点配置。"""
    config_path = get_config_path()
    if not config_path.exists():
        ERROR_CONSOLE.print(
            "[red]错误: 未找到站点配置。请先运行 'zha-beng init' 命令初始化站点。[/red]"
        )
        sys.exit(1)
    storage = get_storage()
    return storage.load_config()


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
@click.version_option(__version__, "-v", "--version")
def main():
    """闸泵联排演算器 - 基层水务站值班员用的本地科学计算CLI。

    暴雨前安全演练，避免内河漫顶、外河倒灌或泵频繁启停。
    """
    pass


@main.command()
@click.option("--site-name", "-n", required=True, help="站点名称")
@click.option("--site-id", "-i", required=True, help="站点唯一标识")
@click.option("--river-name", "-r", required=True, help="河道名称")
@click.option("--channel-area", "-a", type=float, required=True, help="内河河道水面面积 (平方米)")
@click.option("--capacity", "-c", type=float, required=True, help="内河最大库容 (立方米)")
@click.option("--warning-level", "-w", type=float, required=True, help="内河警戒水位 (米)")
@click.option("--critical-level", "-l", type=float, required=True, help="内河保证水位 (米)")
@click.option("--outer-river-name", help="外河名称")
@click.option("--outer-warning-level", type=float, help="外河警戒水位 (米)")
@click.option("--outer-critical-level", type=float, help="外河保证水位 (米)")
@click.option("--min-pump-cycle", type=float, default=2.0, help="泵最小启停间隔 (小时)，默认2小时")
@click.option("--daily-energy-limit", type=float, help="每日能耗上限 (千瓦时)")
def init(
    site_name: str,
    site_id: str,
    river_name: str,
    channel_area: float,
    capacity: float,
    warning_level: float,
    critical_level: float,
    outer_river_name: Optional[str],
    outer_warning_level: Optional[float],
    outer_critical_level: Optional[float],
    min_pump_cycle: float,
    daily_energy_limit: Optional[float],
):
    """初始化站点配置。

    创建站点的基本参数配置，包括河道参数、水位阈值、泵闸限制等。
    """
    workspace = get_workspace()
    
    config = SiteConfig(
        site_name=site_name,
        site_id=site_id,
        river_name=river_name,
        inner_channel_area=channel_area,
        inner_channel_capacity=capacity,
        inner_warning_level=warning_level,
        inner_critical_level=critical_level,
        outer_river_name=outer_river_name,
        outer_warning_level=outer_warning_level,
        outer_critical_level=outer_critical_level,
        min_pump_cycle_hours=min_pump_cycle,
        daily_energy_limit_kwh=daily_energy_limit,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    storage = get_storage()
    storage.save_config(config)
    
    console.print(f"[green]✓ 站点配置已初始化[/green]")
    console.print(f"  工作目录: {workspace}")
    console.print(f"  站点: {site_name} ({site_id})")
    
    if critical_level <= warning_level:
        console.print(f"[yellow]⚠ 警告: 保证水位({critical_level}m) 应高于警戒水位({warning_level}m)[/yellow]")


@main.command()
@click.option("--water-levels", "-wl", "water_levels_file", type=click.Path(exists=True), help="河道水位CSV文件路径")
@click.option("--rainfall", "-rf", "rainfall_file", type=click.Path(exists=True), help="降雨预报CSV文件路径")
@click.option("--pump-curves", "-pc", "pump_curves_file", type=click.Path(exists=True), help="泵站曲线CSV文件路径")
@click.option("--gate-limits", "-gl", "gate_limits_file", type=click.Path(exists=True), help="闸门开度限制CSV文件路径")
@click.option("--all", "-a", "import_all", is_flag=True, help="导入所有支持的文件（从当前目录自动查找）")
def import_data(
    water_levels_file: Optional[str],
    rainfall_file: Optional[str],
    pump_curves_file: Optional[str],
    gate_limits_file: Optional[str],
    import_all: bool,
):
    """导入数据文件。

    支持导入河道水位、降雨预报、泵站曲线和闸门开度限制四种CSV数据。
    """
    site_config = load_site_config()
    storage = get_storage()
    parser = DataParser()
    
    water_levels = []
    rainfalls = []
    pump_curves = []
    gate_limits = []
    
    if import_all:
        cwd = Path.cwd()
        for filepath in cwd.glob("*.csv"):
            filename = filepath.name.lower()
            try:
                if "water" in filename or "level" in filename:
                    wl = parser.parse_water_levels(str(filepath))
                    water_levels.extend(wl)
                    console.print(f"[green]✓ 自动导入水位数据: {filepath.name} ({len(wl)}条)[/green]")
                elif "rain" in filename or "rainfall" in filename:
                    rf = parser.parse_rainfall(str(filepath))
                    rainfalls.extend(rf)
                    console.print(f"[green]✓ 自动导入降雨数据: {filepath.name} ({len(rf)}条)[/green]")
                elif "pump" in filename or "curve" in filename:
                    pc = parser.parse_pump_curves(str(filepath))
                    pump_curves.extend(pc)
                    console.print(f"[green]✓ 自动导入泵站曲线: {filepath.name} ({len(pc)}台)[/green]")
                elif "gate" in filename or "limit" in filename:
                    gl = parser.parse_gate_limits(str(filepath))
                    gate_limits.extend(gl)
                    console.print(f"[green]✓ 自动导入闸门限制: {filepath.name} ({len(gl)}扇)[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠ 跳过文件 {filepath.name}: {e}[/yellow]")
    else:
        if water_levels_file:
            try:
                water_levels = parser.parse_water_levels(water_levels_file)
                console.print(f"[green]✓ 导入水位数据: {len(water_levels)}条[/green]")
            except Exception as e:
                ERROR_CONSOLE.print(f"[red]错误: 解析水位文件失败 - {e}[/red]")
                sys.exit(1)
        
        if rainfall_file:
            try:
                rainfalls = parser.parse_rainfall(rainfall_file)
                console.print(f"[green]✓ 导入降雨数据: {len(rainfalls)}条[/green]")
            except Exception as e:
                ERROR_CONSOLE.print(f"[red]错误: 解析降雨文件失败 - {e}[/red]")
                sys.exit(1)
        
        if pump_curves_file:
            try:
                pump_curves = parser.parse_pump_curves(pump_curves_file)
                console.print(f"[green]✓ 导入泵站曲线: {len(pump_curves)}台[/green]")
                
                site_config.pumps = [
                    {
                        "pump_id": pc.pump_id,
                        "pump_name": pc.pump_name,
                        "rated_flow_m3h": pc.rated_flow_m3h,
                        "rated_head_m": pc.rated_head_m,
                        "rated_power_kw": pc.rated_power_kw,
                    }
                    for pc in pump_curves
                ]
            except Exception as e:
                ERROR_CONSOLE.print(f"[red]错误: 解析泵站曲线文件失败 - {e}[/red]")
                sys.exit(1)
        
        if gate_limits_file:
            try:
                gate_limits = parser.parse_gate_limits(gate_limits_file)
                console.print(f"[green]✓ 导入闸门限制: {len(gate_limits)}扇[/green]")
                
                site_config.gates = [
                    {
                        "gate_id": gl.gate_id,
                        "gate_name": gl.gate_name,
                        "max_opening": gl.max_opening,
                        "min_opening": gl.min_opening,
                    }
                    for gl in gate_limits
                ]
            except Exception as e:
                ERROR_CONSOLE.print(f"[red]错误: 解析闸门限制文件失败 - {e}[/red]")
                sys.exit(1)
    
    imported_data = ImportedData(
        water_levels=water_levels,
        rainfalls=rainfalls,
        pump_curves=pump_curves,
        gate_limits=gate_limits,
    )
    
    if water_levels:
        imported_data.data_start = min(wl.timestamp for wl in water_levels)
        imported_data.data_end = max(wl.timestamp for wl in water_levels)
    
    storage.save_imported_data(imported_data)
    site_config.updated_at = datetime.now()
    storage.save_config(site_config)
    
    console.print("\n[bold]导入摘要:[/bold]")
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("数据类型")
    table.add_column("数量")
    table.add_column("时间范围")
    
    wl_range = f"{imported_data.data_start} 至 {imported_data.data_end}" if imported_data.data_start else "-"
    table.add_row("河道水位", f"{len(water_levels)}条", wl_range)
    table.add_row("降雨预报", f"{len(rainfalls)}条", "-")
    table.add_row("泵站曲线", f"{len(pump_curves)}台", "-")
    table.add_row("闸门限制", f"{len(gate_limits)}扇", "-")
    
    console.print(table)


@main.command()
@click.option("--start-time", "-s", help="演算开始时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--end-time", "-e", help="演算结束时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--step-hours", "-t", type=float, default=1.0, help="演算时间步长 (小时)，默认1小时")
@click.option("--initial-inner-level", type=float, help="初始内河水位 (米)")
@click.option("--initial-outer-level", type=float, help="初始外河水位 (米)")
def simulate(
    start_time: Optional[str],
    end_time: Optional[str],
    step_hours: float,
    initial_inner_level: Optional[float],
    initial_outer_level: Optional[float],
):
    """按小时演算库容、水位、泵流量和闸门流量。

    根据导入的水位、降雨、泵闸参数进行时序演算。
    """
    site_config = load_site_config()
    storage = get_storage()
    
    try:
        imported_data = storage.load_imported_data()
    except FileNotFoundError:
        ERROR_CONSOLE.print(
            "[red]错误: 未找到导入的数据。请先运行 'zha-beng import' 命令导入数据。[/red]"
        )
        sys.exit(1)
    
    scheduler = Scheduler(site_config, imported_data)
    
    start_dt = None
    end_dt = None
    
    if start_time:
        try:
            start_dt = datetime.strptime(start_time, "%Y-%m-%d %H:%M")
        except ValueError:
            ERROR_CONSOLE.print("[red]错误: 开始时间格式错误，请使用 YYYY-MM-DD HH:MM[/red]")
            sys.exit(1)
    elif imported_data.data_start:
        start_dt = imported_data.data_start
    else:
        ERROR_CONSOLE.print("[red]错误: 请指定开始时间或导入水位数据[/red]")
        sys.exit(1)
    
    if end_time:
        try:
            end_dt = datetime.strptime(end_time, "%Y-%m-%d %H:%M")
        except ValueError:
            ERROR_CONSOLE.print("[red]错误: 结束时间格式错误，请使用 YYYY-MM-DD HH:MM[/red]")
            sys.exit(1)
    elif imported_data.data_end:
        end_dt = imported_data.data_end
    else:
        ERROR_CONSOLE.print("[red]错误: 请指定结束时间或导入水位数据[/red]")
        sys.exit(1)
    
    if start_dt >= end_dt:
        ERROR_CONSOLE.print("[red]错误: 结束时间必须晚于开始时间[/red]")
        sys.exit(1)
    
    console.print(f"[bold]开始演算[/bold]")
    console.print(f"  时间范围: {start_dt} 至 {end_dt}")
    console.print(f"  时间步长: {step_hours} 小时")
    
    result = scheduler.run_simulation(
        start_time=start_dt,
        end_time=end_dt,
        step_hours=step_hours,
        initial_inner_level=initial_inner_level,
        initial_outer_level=initial_outer_level,
    )
    
    storage.save_simulation_result(result)
    
    console.print(f"\n[green]✓ 演算完成[/green]")
    console.print(f"  共演算 {len(result.states)} 个时间步")
    console.print(f"  最高内水位: {result.max_inner_level:.2f} 米")
    console.print(f"  最低内水位: {result.min_inner_level:.2f} 米")
    console.print(f"  总能耗: {result.total_energy_kwh:.2f} 千瓦时")
    
    if result.alerts:
        console.print(f"\n[yellow]⚠ 发现 {len(result.alerts)} 个告警，请运行 'zha-beng check' 查看详情[/yellow]")


@main.command()
@click.option("--detail", "-d", is_flag=True, help="显示详细告警信息")
@click.option("--type", "-t", "alert_type", type=click.Choice([e.value for e in AlertType]), help="只显示指定类型的告警")
def check(detail: bool, alert_type: Optional[str]):
    """检查并标出漫顶、倒灌、最小停机间隔、能耗超限和数据缺口。

    分析最新的演算结果，列出所有告警和预警。
    """
    storage = get_storage()
    
    try:
        result = storage.load_simulation_result()
    except FileNotFoundError:
        ERROR_CONSOLE.print(
            "[red]错误: 未找到演算结果。请先运行 'zha-beng simulate' 命令进行演算。[/red]"
        )
        sys.exit(1)
    
    alerts = result.alerts
    
    if alert_type:
        alerts = [a for a in alerts if a.alert_type == alert_type]
    
    if not alerts:
        console.print("[green]✓ 未发现告警，当前调度方案安全[/green]")
        return
    
    critical_count = sum(1 for a in alerts if a.level == AlertLevel.CRITICAL)
    warning_count = sum(1 for a in alerts if a.level == AlertLevel.WARNING)
    info_count = sum(1 for a in alerts if a.level == AlertLevel.INFO)
    
    console.print(f"[bold]告警摘要[/bold]")
    console.print(f"  严重: {critical_count} 个")
    console.print(f"  警告: {warning_count} 个")
    console.print(f"  提示: {info_count} 个")
    
    if detail:
        console.print("\n[bold]详细告警列表:[/bold]")
        
        for i, alert in enumerate(alerts, 1):
            level_style = {
                AlertLevel.CRITICAL: "bold red",
                AlertLevel.WARNING: "bold yellow",
                AlertLevel.INFO: "bold blue",
            }.get(alert.level, "white")
            
            type_display = {
                AlertType.OVERTOPPING: "漫顶风险",
                AlertType.BACKFLOW: "倒灌风险",
                AlertType.PUMP_CYCLE: "泵启停间隔",
                AlertType.ENERGY_LIMIT: "能耗超限",
                AlertType.DATA_GAP: "数据缺口",
            }.get(alert.alert_type, alert.alert_type)
            
            timestamp = alert.timestamp.strftime("%Y-%m-%d %H:%M") if alert.timestamp else "-"
            
            console.print(f"\n  [{level_style}]{i}. {type_display}[/{level_style}]")
            console.print(f"     级别: {alert.level.value}")
            console.print(f"     时间: {timestamp}")
            console.print(f"     描述: {alert.message}")
            if alert.details:
                console.print(f"     详情: {alert.details}")
    else:
        console.print("\n使用 'zha-beng check -d' 查看详细告警信息")


@main.command()
@click.option("--output-dir", "-o", default=".", help="输出目录路径，默认为当前目录")
@click.option("--format", "-f", "formats", multiple=True, 
              type=click.Choice(["markdown", "csv", "json", "all"]),
              default=["all"], help="输出格式 (可多次指定)")
@click.option("--name", "-n", help="输出文件名前缀")
def report(output_dir: str, formats: tuple, name: Optional[str]):
    """导出 Markdown 值班建议、CSV 时序表和 JSON 审计包。

    生成三种格式的报告文件供值班人员参考和审计。
    """
    storage = get_storage()
    site_config = load_site_config()
    
    try:
        result = storage.load_simulation_result()
    except FileNotFoundError:
        ERROR_CONSOLE.print(
            "[red]错误: 未找到演算结果。请先运行 'zha-beng simulate' 命令进行演算。[/red]"
        )
        sys.exit(1)
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    exporter = Exporter(site_config, result)
    
    file_prefix = name or f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    export_all = "all" in formats
    
    if export_all or "markdown" in formats:
        md_path = output_path / f"{file_prefix}_值班建议.md"
        exporter.export_markdown(str(md_path))
        console.print(f"[green]✓ 已生成 Markdown 值班建议: {md_path}[/green]")
    
    if export_all or "csv" in formats:
        csv_path = output_path / f"{file_prefix}_时序表.csv"
        exporter.export_csv(str(csv_path))
        console.print(f"[green]✓ 已生成 CSV 时序表: {csv_path}[/green]")
    
    if export_all or "json" in formats:
        json_path = output_path / f"{file_prefix}_审计包.json"
        exporter.export_json(str(json_path))
        console.print(f"[green]✓ 已生成 JSON 审计包: {json_path}[/green]")
    
    console.print(f"\n[bold]报告已导出到: {output_path.absolute()}[/bold]")


@main.command()
def status():
    """显示当前工作空间状态。"""
    workspace = get_workspace()
    storage = get_storage()
    
    console.print(f"[bold]闸泵联排演算器 - 工作空间状态[/bold]")
    console.print(f"  工作目录: {workspace}")
    console.print()
    
    config_path = get_config_path()
    if config_path.exists():
        config = storage.load_config()
        console.print(f"[green]✓ 站点已配置[/green]")
        console.print(f"  站点名称: {config.site_name}")
        console.print(f"  站点ID: {config.site_id}")
        console.print(f"  河道: {config.river_name}")
        console.print(f"  警戒水位: {config.inner_warning_level} 米")
        console.print(f"  保证水位: {config.inner_critical_level} 米")
    else:
        console.print(f"[red]✗ 站点未配置[/red]")
        console.print("  请运行 'zha-beng init' 初始化站点")
    
    console.print()
    
    try:
        imported = storage.load_imported_data()
        console.print(f"[green]✓ 数据已导入[/green]")
        console.print(f"  水位记录: {len(imported.water_levels)} 条")
        console.print(f"  降雨预报: {len(imported.rainfalls)} 条")
        console.print(f"  泵站: {len(imported.pump_curves)} 台")
        console.print(f"  闸门: {len(imported.gate_limits)} 扇")
    except FileNotFoundError:
        console.print(f"[yellow]⚠ 数据未导入[/yellow]")
        console.print("  请运行 'zha-beng import' 导入数据")
    
    console.print()
    
    try:
        result = storage.load_simulation_result()
        console.print(f"[green]✓ 演算结果存在[/green]")
        console.print(f"  演算时间: {result.simulation_start} 至 {result.simulation_end}")
        console.print(f"  时间步数: {len(result.states)}")
        console.print(f"  告警数量: {len(result.alerts)}")
    except FileNotFoundError:
        console.print(f"[yellow]⚠ 演算结果不存在[/yellow]")
        console.print("  请运行 'zha-beng simulate' 进行演算")


if __name__ == "__main__":
    main()
