import click
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
from datetime import datetime
import json

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import (
    BatterySpec, Load, SolarPanel, Plan, SimulationResult,
    LoadPriority, DeviceType, BatteryChemistry, WeatherCondition,
    WEATHER_FACTORS
)
from .parser import (
    parse_battery_json, parse_loads_csv, parse_solar_csv,
    parse_plan_json, parse_all_configs, ParseError
)
from .calculator import (
    BatterySimulator, SimulationState, UnitConverter, LoadScheduler
)
from .risk_analyzer import RiskAnalyzer, Risk, RiskLevel
from .exporter import ReportExporter


console = Console()


def create_simulation_result(
    battery: BatterySpec,
    plan: Plan,
    state: SimulationState
) -> SimulationResult:
    """创建模拟结果对象"""
    soc_values = [h.get("soc_percent", 100) for h in state.hourly_data]
    
    return SimulationResult(
        plan_name=plan.name,
        battery_name=battery.name,
        timestamp=datetime.now().isoformat(),
        hourly_data=state.hourly_data,
        initial_soc_percent=battery.initial_soc_percent,
        final_soc_percent=state.current_soc_percent,
        min_soc_percent=min(soc_values) if soc_values else battery.min_soc_percent,
        max_soc_percent=max(soc_values) if soc_values else battery.max_soc_percent,
        total_consumption_wh=state.total_consumption_wh,
        total_solar_generation_wh=state.total_solar_generation_wh,
        blackout_hour=state.blackout_hour,
        risks=[],
        recommendations=[]
    )


@click.group()
@click.version_option()
def main():
    """
    户外电源模拟工具 - 帮助你在露营、摆摊或外拍前预演户外电源到底够不够用。
    
    支持的命令:
      validate  - 验证输入文件格式
      simulate  - 执行单个方案模拟
      compare   - 对比多个方案
      export    - 导出模拟报告
    """
    pass


@main.command()
@click.option('--battery', '-b', type=click.Path(exists=True, dir_okay=False),
              default='battery.json', help='电池配置 JSON 文件')
@click.option('--loads', '-l', type=click.Path(exists=True, dir_okay=False),
              default='loads.csv', help='负载配置 CSV 文件')
@click.option('--solar', '-s', type=click.Path(exists=True, dir_okay=False),
              default=None, help='太阳能配置 CSV 文件 (可选)')
@click.option('--plan', '-p', type=click.Path(exists=True, dir_okay=False),
              default=None, help='方案配置 JSON 文件 (可选)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def validate(battery, loads, solar, plan, verbose):
    """验证输入文件格式是否正确"""
    battery_path = Path(battery)
    loads_path = Path(loads)
    solar_path = Path(solar) if solar else None
    plan_path = Path(plan) if plan else None
    
    errors = []
    warnings = []
    
    try:
        console.print("[bold blue]正在验证配置文件...[/bold blue]")
        console.print()
        
        with console.status("[bold green]验证电池配置..."):
            battery_spec = parse_battery_json(battery_path)
            console.print(f"✅ [green]电池配置: {battery_spec.name}[/green]")
            if verbose:
                console.print(f"   容量: {battery_spec.capacity_ah} Ah ({battery_spec.capacity_wh:.0f} Wh)")
                console.print(f"   电压: {battery_spec.voltage} V")
                console.print(f"   化学类型: {battery_spec.chemistry.value}")
        
        with console.status("[bold green]验证负载配置..."):
            loads_list = parse_loads_csv(loads_path)
            console.print(f"✅ [green]负载配置: {len(loads_list)} 个设备[/green]")
            
            ac_total = sum(l.actual_power_w for l in loads_list if l.device_type == DeviceType.AC)
            dc_total = sum(l.actual_power_w for l in loads_list if l.device_type == DeviceType.DC)
            
            if ac_total > battery_spec.inverter_max_power_w:
                warnings.append(f"⚠️  所有 AC 设备总功率 ({ac_total:.0f}W) 可能超过逆变器上限 ({battery_spec.inverter_max_power_w}W)")
            
            overlapping = LoadScheduler.check_overlapping_loads(loads_list)
            if overlapping:
                for load1, load2 in overlapping:
                    warnings.append(f"⚠️  设备 '{load1.name}' 和 '{load2.name}' 时间可能重叠")
            
            if verbose:
                for load in loads_list:
                    console.print(f"   - {load.name}: {load.actual_power_w:.0f}W ({load.device_type.value.upper()})")
        
        if solar_path and solar_path.exists():
            with console.status("[bold green]验证太阳能配置..."):
                solar_list = parse_solar_csv(solar_path)
                console.print(f"✅ [green]太阳能配置: {len(solar_list)} 块板[/green]")
                if verbose:
                    for panel in solar_list:
                        console.print(f"   - {panel.name}: {panel.max_power_w:.0f}W")
        else:
            console.print("ℹ️  未提供太阳能配置，模拟时将不考虑太阳能补电")
        
        if plan_path and plan_path.exists():
            with console.status("[bold green]验证方案配置..."):
                plan_spec = parse_plan_json(plan_path)
                console.print(f"✅ [green]方案配置: {plan_spec.name}[/green]")
                if verbose:
                    console.print(f"   天气: {plan_spec.weather.condition.value}")
                    console.print(f"   模拟时长: {plan_spec.simulation_duration_hours} 小时")
        
        console.print()
        
        if warnings:
            console.print("[bold yellow]警告:[/bold yellow]")
            for w in warnings:
                console.print(f"  {w}")
            console.print()
        
        if errors:
            console.print("[bold red]错误:[/bold red]")
            for e in errors:
                console.print(f"  {e}")
            raise click.ClickException("验证失败")
        
        console.print("[bold green]✓ 所有配置文件验证通过！[/bold green]")
        
    except ParseError as e:
        console.print(f"\n[bold red]解析错误:[/bold red]\n{str(e)}")
        raise click.ClickException("验证失败")
    except Exception as e:
        console.print(f"\n[bold red]错误:[/bold red] {str(e)}")
        raise click.ClickException("验证失败")


def run_single_simulation(
    battery_path: Path,
    loads_path: Path,
    solar_path: Optional[Path],
    plan_path: Optional[Path],
    plan_override: Optional[Dict[str, Any]] = None
) -> Tuple[BatterySpec, List[Load], List[SolarPanel], Plan, SimulationState, List[Risk], List[str]]:
    """运行单次模拟，返回所有相关数据"""
    battery = parse_battery_json(battery_path)
    loads = parse_loads_csv(loads_path)
    
    solar_panels = []
    if solar_path and solar_path.exists():
        solar_panels = parse_solar_csv(solar_path)
    
    plan = None
    if plan_path and plan_path.exists():
        plan = parse_plan_json(plan_path)
    
    if plan is None:
        plan = Plan(name="默认方案")
    
    if plan_override:
        for key, value in plan_override.items():
            if hasattr(plan, key):
                setattr(plan, key, value)
    
    simulator = BatterySimulator(battery, loads, solar_panels, plan)
    state = simulator.simulate()
    
    analyzer = RiskAnalyzer(battery, loads, solar_panels, plan)
    risks = analyzer.analyze_all(state)
    recommendations = analyzer.generate_recommendations(risks)
    
    return battery, loads, solar_panels, plan, state, risks, recommendations


@main.command()
@click.option('--battery', '-b', type=click.Path(exists=True, dir_okay=False),
              default='battery.json', help='电池配置 JSON 文件')
@click.option('--loads', '-l', type=click.Path(exists=True, dir_okay=False),
              default='loads.csv', help='负载配置 CSV 文件')
@click.option('--solar', '-s', type=click.Path(exists=True, dir_okay=False),
              default=None, help='太阳能配置 CSV 文件 (可选)')
@click.option('--plan', '-p', type=click.Path(exists=True, dir_okay=False),
              default=None, help='方案配置 JSON 文件 (可选)')
@click.option('--export', '-e', type=click.Path(), default=None,
              help='导出报告的文件路径 (可选)')
@click.option('--format', '-f', type=click.Choice(['markdown', 'html', 'json']),
              default='markdown', help='导出格式 (默认: markdown)')
@click.option('--show-hourly', is_flag=True, help='显示每小时详细数据')
def simulate(battery, loads, solar, plan, export, format, show_hourly):
    """执行单个方案模拟"""
    battery_path = Path(battery)
    loads_path = Path(loads)
    solar_path = Path(solar) if solar else None
    plan_path = Path(plan) if plan else None
    
    try:
        with console.status("[bold green]正在执行模拟..."):
            battery_spec, loads_list, solar_list, plan_spec, state, risks, recommendations = run_single_simulation(
                battery_path, loads_path, solar_path, plan_path
            )
        
        console.print()
        console.print(Panel.fit(
            f"[bold blue]模拟结果: {plan_spec.name}[/bold blue]\n"
            f"[dim]电池: {battery_spec.name} | 时长: {plan_spec.simulation_duration_hours} 小时[/dim]",
            border_style="blue"
        ))
        console.print()
        
        summary_table = Table(title="模拟摘要", show_header=True, header_style="bold magenta")
        summary_table.add_column("指标", style="cyan")
        summary_table.add_column("值", style="green")
        
        summary_table.add_row("初始 SOC", f"{battery_spec.initial_soc_percent:.1f}%")
        summary_table.add_row("最终 SOC", f"{state.current_soc_percent:.1f}%")
        
        min_soc = min(h.get("soc_percent", 100) for h in state.hourly_data)
        summary_table.add_row("最低 SOC", f"{min_soc:.1f}%")
        
        summary_table.add_row("总耗电量", f"{state.total_consumption_wh:.0f} Wh")
        summary_table.add_row("太阳能发电", f"{state.total_solar_generation_wh:.0f} Wh")
        
        if state.blackout_hour is not None:
            summary_table.add_row("预计断电时间", f"[bold red]{state.blackout_hour:02d}:00[/bold red]")
        else:
            summary_table.add_row("预计断电时间", "[bold green]无[/bold green]")
        
        console.print(summary_table)
        console.print()
        
        if risks:
            console.print("[bold red]⚠️  检测到风险:[/bold red]")
            
            critical_risks = [r for r in risks if r.level == RiskLevel.CRITICAL]
            high_risks = [r for r in risks if r.level == RiskLevel.HIGH]
            medium_risks = [r for r in risks if r.level == RiskLevel.MEDIUM]
            
            if critical_risks:
                console.print("\n  [bold red]🔴 严重风险:[/bold red]")
                for r in critical_risks:
                    console.print(f"    - {r.message}")
            
            if high_risks:
                console.print("\n  [bold yellow]🟠 高风险:[/bold yellow]")
                for r in high_risks:
                    console.print(f"    - {r.message}")
            
            if medium_risks:
                console.print("\n  [bold blue]🟡 中等风险:[/bold blue]")
                for r in medium_risks:
                    console.print(f"    - {r.message}")
            
            console.print()
            console.print("[bold green]💡 建议:[/bold green]")
            for i, rec in enumerate(recommendations, 1):
                console.print(f"  {i}. {rec}")
        else:
            console.print("[bold green]✅ 未检测到风险。[/bold green]")
        
        console.print()
        
        if show_hourly:
            hourly_table = Table(title="每小时详细数据", show_header=True, header_style="bold magenta")
            hourly_table.add_column("时间", style="cyan")
            hourly_table.add_column("SOC (%)", style="green")
            hourly_table.add_column("负载 (W)", style="yellow")
            hourly_table.add_column("太阳能 (W)", style="blue")
            hourly_table.add_column("净功率 (W)", style="magenta")
            hourly_table.add_column("活跃设备", style="dim")
            
            for hourly in state.hourly_data:
                hour = hourly.get("hour", 0)
                soc = hourly.get("soc_percent", 0)
                load = hourly.get("total_load_w", 0)
                solar_gen = hourly.get("solar_input_w", 0)
                net = hourly.get("net_power_w", 0)
                is_blackout = hourly.get("is_blackout", False)
                
                dc_loads = hourly.get("dc_loads", [])
                ac_loads = hourly.get("ac_loads", [])
                all_loads = dc_loads + ac_loads
                devices_str = ", ".join(all_loads) if all_loads else "-"
                
                time_str = f"{hour:02d}:00"
                if is_blackout:
                    time_str = f"[bold red]{time_str} ⚡[/bold red]"
                
                net_str = f"{net:+.0f}"
                if net > 0:
                    net_str = f"[bold green]{net_str}[/bold green]"
                elif net < 0:
                    net_str = f"[bold red]{net_str}[/bold red]"
                
                hourly_table.add_row(
                    time_str,
                    f"{soc:.1f}",
                    f"{load:.0f}",
                    f"{solar_gen:.0f}",
                    net_str,
                    devices_str[:30]
                )
            
            console.print(hourly_table)
        
        if export:
            export_path = Path(export)
            sim_result = create_simulation_result(battery_spec, plan_spec, state)
            
            exporter = ReportExporter(
                battery=battery_spec,
                loads=loads_list,
                solar_panels=solar_list,
                plan=plan_spec,
                simulation_result=sim_result,
                risks=risks,
                recommendations=recommendations
            )
            
            exporter.export(export_path, format)
            console.print(f"\n[bold green]✓ 报告已导出到: {export_path}[/bold green]")
        
    except ParseError as e:
        console.print(f"\n[bold red]解析错误:[/bold red]\n{str(e)}")
        raise click.ClickException("模拟失败")
    except Exception as e:
        console.print(f"\n[bold red]错误:[/bold red] {str(e)}")
        raise click.ClickException("模拟失败")


@main.command()
@click.option('--battery', '-b', type=click.Path(exists=True, dir_okay=False),
              default='battery.json', help='电池配置 JSON 文件')
@click.option('--loads', '-l', multiple=True, required=True,
              help='负载配置 CSV 文件 (可多次指定不同方案)')
@click.option('--solar', '-s', type=click.Path(exists=True, dir_okay=False),
              default=None, help='太阳能配置 CSV 文件 (可选)')
@click.option('--plan', '-p', type=click.Path(exists=True, dir_okay=False),
              default=None, help='方案配置 JSON 文件 (可选)')
@click.option('--names', '-n', multiple=True, help='各方案的名称 (顺序与 --loads 对应)')
@click.option('--export', '-e', type=click.Path(), default=None,
              help='导出对比报告的文件路径 (可选)')
def compare(battery, loads, solar, plan, names, export):
    """对比多个方案的模拟结果"""
    battery_path = Path(battery)
    solar_path = Path(solar) if solar else None
    plan_path = Path(plan) if plan else None
    
    if len(loads) < 2:
        raise click.ClickException("请至少指定 2 个负载配置文件进行对比")
    
    if names and len(names) != len(loads):
        raise click.ClickException(f"名称数量 ({len(names)}) 与负载文件数量 ({len(loads)}) 不匹配")
    
    try:
        results = []
        
        for i, loads_file in enumerate(loads):
            loads_path = Path(loads_file)
            name = names[i] if names else f"方案 {i + 1}"
            
            with console.status(f"[bold green]正在模拟: {name}..."):
                battery_spec, loads_list, solar_list, plan_spec, state, risks, recommendations = run_single_simulation(
                    battery_path, loads_path, solar_path, plan_path
                )
            
            results.append({
                "name": name,
                "battery": battery_spec,
                "loads": loads_list,
                "solar": solar_list,
                "plan": plan_spec,
                "state": state,
                "risks": risks,
                "recommendations": recommendations
            })
        
        console.print()
        console.print(Panel.fit(
            "[bold blue]多方案对比结果[/bold blue]",
            border_style="blue"
        ))
        console.print()
        
        compare_table = Table(title="方案对比", show_header=True, header_style="bold magenta")
        compare_table.add_column("方案", style="cyan")
        compare_table.add_column("初始 SOC", style="green")
        compare_table.add_column("最终 SOC", style="green")
        compare_table.add_column("最低 SOC", style="yellow")
        compare_table.add_column("总耗电 (Wh)", style="red")
        compare_table.add_column("太阳能 (Wh)", style="blue")
        compare_table.add_column("断电时间", style="bold red")
        
        best_soc = -1
        best_index = 0
        
        for i, result in enumerate(results):
            state = result["state"]
            min_soc = min(h.get("soc_percent", 100) for h in state.hourly_data)
            
            if state.current_soc_percent > best_soc:
                best_soc = state.current_soc_percent
                best_index = i
            
            blackout_str = f"{state.blackout_hour:02d}:00" if state.blackout_hour is not None else "无"
            
            style = "bold green" if i == best_index else ""
            
            compare_table.add_row(
                Text(result["name"], style=style),
                f"{result['battery'].initial_soc_percent:.1f}%",
                Text(f"{state.current_soc_percent:.1f}%", style=style),
                f"{min_soc:.1f}%",
                f"{state.total_consumption_wh:.0f}",
                f"{state.total_solar_generation_wh:.0f}",
                blackout_str
            )
        
        console.print(compare_table)
        console.print()
        
        console.print("[bold green]💡 分析结论:[/bold green]")
        if best_soc >= 0:
            console.print(f"  方案 '{results[best_index]['name']}' 的剩余电量最多 ({best_soc:.1f}%)，推荐优先考虑。")
        
        for result in results:
            if result["risks"]:
                console.print(f"\n  方案 '{result['name']}' 存在风险:")
                for risk in result["risks"][:3]:
                    console.print(f"    - {risk.message}")
        
        console.print()
        
    except ParseError as e:
        console.print(f"\n[bold red]解析错误:[/bold red]\n{str(e)}")
        raise click.ClickException("对比失败")
    except Exception as e:
        console.print(f"\n[bold red]错误:[/bold red] {str(e)}")
        raise click.ClickException("对比失败")


@main.command()
@click.option('--battery', '-b', type=click.Path(exists=True, dir_okay=False),
              default='battery.json', help='电池配置 JSON 文件')
@click.option('--loads', '-l', type=click.Path(exists=True, dir_okay=False),
              default='loads.csv', help='负载配置 CSV 文件')
@click.option('--solar', '-s', type=click.Path(exists=True, dir_okay=False),
              default=None, help='太阳能配置 CSV 文件 (可选)')
@click.option('--plan', '-p', type=click.Path(exists=True, dir_okay=False),
              default=None, help='方案配置 JSON 文件 (可选)')
@click.option('--output', '-o', type=click.Path(), required=True,
              help='导出报告的文件路径')
@click.option('--format', '-f', type=click.Choice(['markdown', 'html', 'json']),
              default='markdown', help='导出格式 (默认: markdown)')
def export(battery, loads, solar, plan, output, format):
    """执行模拟并导出报告"""
    battery_path = Path(battery)
    loads_path = Path(loads)
    solar_path = Path(solar) if solar else None
    plan_path = Path(plan) if plan else None
    output_path = Path(output)
    
    try:
        with console.status("[bold green]正在执行模拟并导出报告..."):
            battery_spec, loads_list, solar_list, plan_spec, state, risks, recommendations = run_single_simulation(
                battery_path, loads_path, solar_path, plan_path
            )
        
        sim_result = create_simulation_result(battery_spec, plan_spec, state)
        
        exporter = ReportExporter(
            battery=battery_spec,
            loads=loads_list,
            solar_panels=solar_list,
            plan=plan_spec,
            simulation_result=sim_result,
            risks=risks,
            recommendations=recommendations
        )
        
        exporter.export(output_path, format)
        console.print(f"[bold green]✓ 报告已成功导出到: {output_path}[/bold green]")
        
    except ParseError as e:
        console.print(f"\n[bold red]解析错误:[/bold red]\n{str(e)}")
        raise click.ClickException("导出失败")
    except Exception as e:
        console.print(f"\n[bold red]错误:[/bold red] {str(e)}")
        raise click.ClickException("导出失败")


if __name__ == "__main__":
    main()
