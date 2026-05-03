"""流量配平小助手 - CLI入口"""

import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import print as rprint

from . import __version__
from .samples.generator import generate_sample_files
from .parsers.topology_parser import TopologyParser, topology_to_fluid_network
from .parsers.pump_parser import PumpProgramParser, pump_program_to_segments
from .parsers.viscosity_parser import ViscosityParser, get_average_viscosity
from .validators.topology_validator import TopologyValidator, ValidationSeverity
from .validators.pump_validator import PumpProgramValidator
from .core.fluidics import FluidicsSimulator, SimulationResult
from .core.rules import RuleEngine, RuleSeverity as RuleSeverityEnum
from .exporters.markdown_exporter import MarkdownExporter
from .exporters.csv_exporter import CSVExporter
from .exporters.json_exporter import JSONExporter


console = Console()


@click.group()
@click.version_option(version=__version__, prog_name="flow-balancer")
@click.pass_context
def main(ctx: click.Context):
    """
    流量配平小助手 - 微流控芯片调试工具
    
    用于生物实验室微流控芯片实验前的仿真调试，帮助发现：
    - 通道压降过大
    - 死体积残留
    - 泵速单位错误
    - 混合比例偏差
    """
    ctx.ensure_object(dict)


@main.command()
@click.option(
    "-o", "--output",
    type=click.Path(file_okay=False, writable=True),
    default=".",
    help="输出目录 (默认: 当前目录)",
)
@click.option(
    "--overwrite",
    is_flag=True,
    default=False,
    help="覆盖已存在的文件",
)
def init(output: str, overwrite: bool):
    """
    初始化示例项目
    
    生成示例数据文件：
    - topology.json: 芯片通道拓扑
    - pump_program.csv: 注射泵程序
    - viscosity.yaml: 试剂黏度配置
    """
    console.print(Panel.fit(
        "[bold blue]流量配平小助手 - 初始化示例项目[/bold blue]",
        border_style="blue"
    ))
    
    try:
        output_path = Path(output)
        output_path.mkdir(parents=True, exist_ok=True)
        
        files_created = generate_sample_files(str(output_path), overwrite)
        
        if files_created:
            console.print("\n[green]✓ 示例文件已生成:[/green]")
            for file_type, file_path in files_created.items():
                console.print(f"  - {file_type}: {file_path}")
            
            console.print("\n[bold yellow]下一步:[/bold yellow]")
            console.print("  1. 查看并编辑生成的示例文件")
            console.print("  2. 运行 'flow-balancer check' 校验配置")
            console.print("  3. 运行 'flow-balancer simulate' 进行仿真")
        else:
            console.print("\n[yellow]⚠ 没有新文件生成 (文件已存在且未使用 --overwrite)[/yellow]")
    
    except Exception as e:
        console.print(f"\n[red]✗ 初始化失败: {e}[/red]")
        sys.exit(1)


@main.command()
@click.option(
    "-t", "--topology",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="topology.json",
    help="拓扑JSON文件路径 (默认: topology.json)",
)
@click.option(
    "-p", "--pump",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="pump_program.csv",
    help="泵程序CSV文件路径 (默认: pump_program.csv)",
)
@click.option(
    "-v", "--viscosity",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="viscosity.yaml",
    help="黏度YAML文件路径 (默认: viscosity.yaml)",
)
def check(topology: str, pump: str, viscosity: str):
    """
    校验拓扑和程序配置
    
    检查：
    - 拓扑结构完整性
    - 泵程序格式
    - 黏度数据格式
    - 单位一致性
    """
    console.print(Panel.fit(
        "[bold blue]流量配平小助手 - 配置校验[/bold blue]",
        border_style="blue"
    ))
    
    errors_found = False
    
    # 1. 校验拓扑
    console.print("\n[bold]1. 校验拓扑配置...[/bold]")
    try:
        topology_data = TopologyParser.parse_file(topology)
        result = TopologyValidator.validate(topology_data)
        
        if result.is_valid:
            console.print(f"  [green]✓ 拓扑校验通过[/green] ({len(topology_data.nodes)} 节点, {len(topology_data.channels)} 通道)")
        else:
            console.print(f"  [red]✗ 拓扑校验发现问题[/red]")
            errors_found = True
        
        # 显示问题
        if result.errors:
            console.print(f"\n  [red]错误 ({len(result.errors)}):[/red]")
            for e in result.errors:
                console.print(f"    - [{e.code}] {e.message}")
                if e.location:
                    console.print(f"      位置: {e.location}")
        
        if result.warnings:
            console.print(f"\n  [yellow]警告 ({len(result.warnings)}):[/yellow]")
            for w in result.warnings:
                console.print(f"    - [{w.code}] {w.message}")
                if w.location:
                    console.print(f"      位置: {w.location}")
    
    except Exception as e:
        console.print(f"  [red]✗ 拓扑解析失败: {e}[/red]")
        errors_found = True
    
    # 2. 校验泵程序
    console.print("\n[bold]2. 校验泵程序...[/bold]")
    try:
        pump_program = PumpProgramParser.parse_file(pump)
        
        # 尝试获取拓扑数据用于关联校验
        topology_data = None
        try:
            topology_data = TopologyParser.parse_file(topology)
        except Exception:
            pass
        
        result = PumpProgramValidator.validate(pump_program, topology_data)
        
        segment_count = len(pump_program.segments)
        console.print(f"  [green]✓ 泵程序解析成功[/green] ({segment_count} 个时间段)")
        
        # 显示问题
        if result.errors:
            console.print(f"\n  [red]错误 ({len(result.errors)}):[/red]")
            for e in result.errors:
                console.print(f"    - [{e.code}] {e.message}")
                if e.location:
                    console.print(f"      位置: {e.location}")
            errors_found = True
        
        if result.warnings:
            console.print(f"\n  [yellow]警告 ({len(result.warnings)}):[/yellow]")
            for w in result.warnings:
                console.print(f"    - [{w.code}] {w.message}")
                if w.location:
                    console.print(f"      位置: {w.location}")
        
        if result.infos:
            for info in result.infos:
                console.print(f"  [cyan]ℹ {info.message}[/cyan]")
    
    except Exception as e:
        console.print(f"  [red]✗ 泵程序解析失败: {e}[/red]")
        errors_found = True
    
    # 3. 校验黏度配置
    console.print("\n[bold]3. 校验黏度配置...[/bold]")
    try:
        viscosity_data = ViscosityParser.parse_file(viscosity)
        reagent_count = len(viscosity_data.reagents)
        console.print(f"  [green]✓ 黏度配置解析成功[/green] ({reagent_count} 种试剂)")
        
        # 显示试剂信息
        table = Table(title="试剂详情", show_header=True, header_style="bold magenta")
        table.add_column("ID", style="cyan")
        table.add_column("名称", style="green")
        table.add_column("黏度", style="yellow")
        table.add_column("目标比例", style="blue")
        
        for reagent_id, reagent in viscosity_data.reagents.items():
            target_ratio = viscosity_data.default_ratios.get(reagent_id, reagent.target_ratio)
            ratio_str = f"{target_ratio:.1%}" if target_ratio is not None else "-"
            table.add_row(
                reagent_id,
                reagent.name,
                f"{reagent.viscosity_value} {reagent.viscosity_unit}",
                ratio_str,
            )
        
        console.print(table)
    
    except Exception as e:
        console.print(f"  [red]✗ 黏度配置解析失败: {e}[/red]")
        errors_found = True
    
    # 总结
    console.print("\n" + "-" * 50)
    if errors_found:
        console.print("[bold red]✗ 校验发现错误，请修复后重试[/bold red]")
        sys.exit(1)
    else:
        console.print("[bold green]✓ 所有校验通过！[/bold green]")
        console.print("\n[bold yellow]下一步:[/bold yellow]")
        console.print("  运行 'flow-balancer simulate' 进行流体仿真")


@main.command()
@click.option(
    "-t", "--topology",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="topology.json",
    help="拓扑JSON文件路径 (默认: topology.json)",
)
@click.option(
    "-p", "--pump",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="pump_program.csv",
    help="泵程序CSV文件路径 (默认: pump_program.csv)",
)
@click.option(
    "-v", "--viscosity",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="viscosity.yaml",
    help="黏度YAML文件路径 (默认: viscosity.yaml)",
)
@click.option(
    "--ratio",
    type=(str, float),
    multiple=True,
    help="指定目标混合比例 (如: --ratio reagent_a 0.5 --ratio reagent_b 0.5)",
)
@click.option(
    "--save-json",
    type=click.Path(file_okay=True, writable=True),
    default=None,
    help="保存仿真结果到JSON文件",
)
def simulate(
    topology: str,
    pump: str,
    viscosity: str,
    ratio: tuple,
    save_json: Optional[str],
):
    """
    仿真各时间段的流量、压降、延迟体积和比例偏差
    
    计算：
    - 各通道流量分配
    - 通道压降
    - 混合比例偏差
    - 风险评估
    """
    console.print(Panel.fit(
        "[bold blue]流量配平小助手 - 流体仿真[/bold blue]",
        border_style="blue"
    ))
    
    # 解析输入文件
    console.print("\n[bold]1. 解析输入文件...[/bold]")
    
    try:
        topology_data = TopologyParser.parse_file(topology)
        console.print(f"  [green]✓ 拓扑: {topology_data.name}[/green]")
    except Exception as e:
        console.print(f"  [red]✗ 拓扑解析失败: {e}[/red]")
        sys.exit(1)
    
    try:
        pump_program = PumpProgramParser.parse_file(pump)
        console.print(f"  [green]✓ 泵程序: {len(pump_program.segments)} 个时间段[/green]")
    except Exception as e:
        console.print(f"  [red]✗ 泵程序解析失败: {e}[/red]")
        sys.exit(1)
    
    try:
        viscosity_data = ViscosityParser.parse_file(viscosity)
        console.print(f"  [green]✓ 黏度: {len(viscosity_data.reagents)} 种试剂[/green]")
    except Exception as e:
        console.print(f"  [red]✗ 黏度解析失败: {e}[/red]")
        sys.exit(1)
    
    # 准备目标比例 (使用试剂ID作为键，用于黏度计算)
    target_ratios_by_reagent: Dict[str, float] = {}
    target_ratios_by_reagent.update(viscosity_data.default_ratios)
    for i in range(0, len(ratio), 2):
        if i + 1 < len(ratio):
            reagent_id, ratio_value = ratio[i], ratio[i + 1]
            target_ratios_by_reagent[reagent_id] = ratio_value
    
    # 转换目标比例为节点ID键 (用于仿真，因为 inlet_flows 使用节点ID)
    # topology_data.inlet_reagents 格式: {node_id: reagent_id}
    target_ratios: Dict[str, float] = {}  # node_id -> ratio
    reagent_names: Dict[str, str] = {}  # node_id -> name
    
    if topology_data.inlet_reagents:
        for node_id, reagent_id in topology_data.inlet_reagents.items():
            # 目标比例
            if reagent_id in target_ratios_by_reagent:
                target_ratios[node_id] = target_ratios_by_reagent[reagent_id]
            # 试剂名称
            if reagent_id in viscosity_data.reagents:
                reagent_names[node_id] = viscosity_data.reagents[reagent_id].name
            else:
                reagent_names[node_id] = node_id
    
    # 构建流体网络
    console.print("\n[bold]2. 构建流体网络...[/bold]")
    try:
        network = topology_to_fluid_network(topology_data)
        console.print(f"  [green]✓ 网络构建成功: {len(network.nodes)} 节点, {len(network.channels)} 通道[/green]")
    except Exception as e:
        console.print(f"  [red]✗ 网络构建失败: {e}[/red]")
        sys.exit(1)
    
    # 转换泵程序为仿真格式
    console.print("\n[bold]3. 准备仿真数据...[/bold]")
    try:
        program_segments = pump_program_to_segments(pump_program, topology_data)
        console.print(f"  [green]✓ 程序转换成功: {len(program_segments)} 个时间段[/green]")
    except Exception as e:
        console.print(f"  [red]✗ 程序转换失败: {e}[/red]")
        sys.exit(1)
    
    # 计算平均黏度 (使用试剂ID键)
    try:
        avg_viscosity = get_average_viscosity(viscosity_data, target_ratios_by_reagent)
        from .core.units import convert
        avg_viscosity_cp = convert(avg_viscosity, "Pa·s", "cP", "viscosity")
        console.print(f"  [green]✓ 平均黏度: {avg_viscosity_cp:.3f} cP[/green]")
    except Exception as e:
        console.print(f"  [yellow]⚠ 黏度计算警告: {e}[/yellow]")
        avg_viscosity = 0.001  # 默认 1 cP
    
    # 执行仿真
    console.print("\n[bold]4. 执行流体仿真...[/bold]")
    try:
        simulator = FluidicsSimulator(network)
        
        # 执行仿真 (target_ratios 和 reagent_names 已使用节点ID键)
        sim_result = simulator.simulate(
            program_segments=program_segments,
            viscosity=avg_viscosity,
            target_ratios=target_ratios,
            reagent_names=reagent_names,
            mixing_node_id=topology_data.mixing_node,
        )
        
        console.print(f"  [green]✓ 仿真完成[/green]")
    
    except Exception as e:
        console.print(f"  [red]✗ 仿真失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # 执行规则评估
    console.print("\n[bold]5. 风险评估...[/bold]")
    try:
        rule_engine = RuleEngine.create_default()
        rule_context = {
            "simulation_result": sim_result,
            "fluid_network": network,
            "pump_program": pump_program,
        }
        rule_results = rule_engine.evaluate_all(rule_context)
        
        # 汇总风险
        all_violations = rule_engine.get_all_violations(rule_results)
        
        if all_violations:
            console.print(f"  [yellow]⚠ 发现 {len(all_violations)} 个潜在风险[/yellow]")
            
            # 按严重程度分类
            severity_counts = {
                "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0
            }
            for v in all_violations:
                sev = v.severity.value if hasattr(v.severity, 'value') else str(v.severity)
                if sev in severity_counts:
                    severity_counts[sev] += 1
            
            table = Table(title="风险汇总", show_header=True, header_style="bold magenta")
            table.add_column("严重程度", style="cyan")
            table.add_column("数量", style="yellow")
            table.add_row("🔴 Critical (严重)", str(severity_counts["critical"]))
            table.add_row("🟠 High (高)", str(severity_counts["high"]))
            table.add_row("🟡 Medium (中)", str(severity_counts["medium"]))
            table.add_row("🔵 Low (低)", str(severity_counts["low"]))
            table.add_row("ℹ️ Info (信息)", str(severity_counts["info"]))
            console.print(table)
            
            # 显示详细风险
            console.print("\n[bold]风险详情:[/bold]")
            for v in sorted(all_violations, key=lambda x: {
                "critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4
            }.get(x.severity.value if hasattr(x.severity, 'value') else str(x.severity), 999)):
                sev_icon = {
                    "critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "ℹ️"
                }.get(v.severity.value if hasattr(v.severity, 'value') else str(v.severity), "❓")
                console.print(f"  {sev_icon} [{v.rule_name}] {v.message}")
                if v.suggestion:
                    console.print(f"     💡 建议: {v.suggestion}")
        else:
            console.print(f"  [green]✓ 未检测到明显风险[/green]")
    
    except Exception as e:
        console.print(f"  [yellow]⚠ 风险评估警告: {e}[/yellow]")
        rule_results = []
    
    # 显示仿真结果摘要
    console.print("\n[bold]6. 仿真结果摘要[/bold]")
    from .core.units import convert
    
    summary_table = Table(show_header=True, header_style="bold magenta")
    summary_table.add_column("指标", style="cyan")
    summary_table.add_column("数值", style="green")
    
    total_time_min = sim_result.total_time / 60.0
    summary_table.add_row("总仿真时间", f"{sim_result.total_time:.1f} 秒 ({total_time_min:.2f} 分钟)")
    
    max_p_bar = convert(sim_result.max_pressure_drop, "Pa", "bar", "pressure")
    summary_table.add_row("最大压降", f"{max_p_bar:.4f} bar ({sim_result.max_pressure_drop:.2e} Pa)")
    
    summary_table.add_row("最大比例偏差", f"{sim_result.max_relative_deviation:.2f}%")
    
    total_dead_ul = convert(sim_result.total_dead_volume, "m3", "uL", "volume")
    summary_table.add_row("系统死体积", f"{total_dead_ul:.4f} μL")
    
    console.print(summary_table)
    
    # 显示各时间段详情
    if sim_result.time_segments:
        console.print("\n[bold]7. 各时间段详情[/bold]")
        
        for seg_idx, segment in enumerate(sim_result.time_segments):
            console.print(f"\n  [cyan]时间段 {seg_idx + 1}[/cyan]: {segment.time_start:.1f}s - {segment.time_end:.1f}s (持续 {segment.duration:.1f}s)")
            
            # 入口流量
            if segment.inlet_flow_rates:
                console.print(f"    [green]入口流量:[/green]")
                for inlet_id, flow_m3s in segment.inlet_flow_rates.items():
                    flow_ul_min = convert(flow_m3s, "m3/s", "μL/min", "flow_rate")
                    console.print(f"      - {inlet_id}: {flow_ul_min:.4f} μL/min")
            
            # 混合比例
            if segment.mixing_ratios:
                console.print(f"    [green]混合比例:[/green]")
                for ratio in segment.mixing_ratios:
                    status = "✓" if abs(ratio.relative_deviation) < 5 else "⚠"
                    console.print(
                        f"      {status} {ratio.reagent_name}: "
                        f"目标 {ratio.target_ratio:.1%}, "
                        f"实际 {ratio.actual_ratio:.1%}, "
                        f"偏差 {ratio.relative_deviation:+.2f}%"
                    )
    
    # 保存JSON结果
    if save_json:
        try:
            from .exporters.json_exporter import JSONExporter
            JSONExporter.export(
                output_path=save_json,
                simulation_result=sim_result,
                rule_results=rule_results,
                topology_data=topology_data,
                pump_program=pump_program,
                viscosity_data=viscosity_data,
                metadata={
                    "chip_name": topology_data.name,
                    "version": topology_data.version,
                },
            )
            console.print(f"\n[green]✓ 仿真结果已保存到: {save_json}[/green]")
        except Exception as e:
            console.print(f"\n[yellow]⚠ 保存JSON失败: {e}[/yellow]")
    
    # 保存到上下文供后续命令使用
    console.print("\n" + "-" * 50)
    console.print("[bold green]✓ 仿真完成！[/bold green]")
    console.print("\n[bold yellow]下一步:[/bold yellow]")
    console.print("  运行 'flow-balancer report' 导出详细报告")


@main.command()
@click.option(
    "-t", "--topology",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="topology.json",
    help="拓扑JSON文件路径 (默认: topology.json)",
)
@click.option(
    "-p", "--pump",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="pump_program.csv",
    help="泵程序CSV文件路径 (默认: pump_program.csv)",
)
@click.option(
    "-v", "--viscosity",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default="viscosity.yaml",
    help="黏度YAML文件路径 (默认: viscosity.yaml)",
)
@click.option(
    "-o", "--output",
    type=click.Path(file_okay=False, writable=True),
    default="report",
    help="输出目录 (默认: report)",
)
@click.option(
    "--ratio",
    type=(str, float),
    multiple=True,
    help="指定目标混合比例",
)
@click.option(
    "--skip-simulate",
    is_flag=True,
    default=False,
    help="跳过仿真，直接使用之前保存的结果 (需要提供 --input-json)",
)
@click.option(
    "--input-json",
    type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
    default=None,
    help="输入的仿真结果JSON文件 (与 --skip-simulate 配合使用)",
)
def report(
    topology: str,
    pump: str,
    viscosity: str,
    output: str,
    ratio: tuple,
    skip_simulate: bool,
    input_json: Optional[str],
):
    """
    导出Markdown报告、CSV风险表和JSON审计包
    
    生成：
    - report.md: 完整分析报告
    - risks.csv: 风险表
    - timeseries.csv: 时间序列数据
    - summary.csv: 汇总表
    - audit.json: 完整审计包
    """
    console.print(Panel.fit(
        "[bold blue]流量配平小助手 - 生成报告[/bold blue]",
        border_style="blue"
    ))
    
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    sim_result: Optional[SimulationResult] = None
    rule_results: List = []
    topology_data = None
    pump_program = None
    viscosity_data = None
    
    if skip_simulate:
        if not input_json:
            console.print("[red]✗ --skip-simulate 需要配合 --input-json 使用[/red]")
            sys.exit(1)
        
        console.print(f"\n[bold]从JSON加载仿真结果: {input_json}[/bold]")
        # TODO: 从JSON加载结果
        console.print("[yellow]⚠ 从JSON加载功能尚未完全实现[/yellow]")
        sys.exit(1)
    else:
        # 执行完整的仿真流程
        console.print("\n[bold]执行完整仿真流程...[/bold]")
        
        # 解析文件
        try:
            topology_data = TopologyParser.parse_file(topology)
            pump_program = PumpProgramParser.parse_file(pump)
            viscosity_data = ViscosityParser.parse_file(viscosity)
        except Exception as e:
            console.print(f"[red]✗ 输入文件解析失败: {e}[/red]")
            sys.exit(1)
        
        # 准备目标比例 (使用试剂ID作为键，用于黏度计算)
        target_ratios_by_reagent: Dict[str, float] = {}
        target_ratios_by_reagent.update(viscosity_data.default_ratios)
        for i in range(0, len(ratio), 2):
            if i + 1 < len(ratio):
                reagent_id, ratio_value = ratio[i], ratio[i + 1]
                target_ratios_by_reagent[reagent_id] = ratio_value
        
        # 转换目标比例为节点ID键 (用于仿真，因为 inlet_flows 使用节点ID)
        target_ratios: Dict[str, float] = {}  # node_id -> ratio
        reagent_names: Dict[str, str] = {}  # node_id -> name
        
        if topology_data.inlet_reagents:
            for node_id, reagent_id in topology_data.inlet_reagents.items():
                if reagent_id in target_ratios_by_reagent:
                    target_ratios[node_id] = target_ratios_by_reagent[reagent_id]
                if reagent_id in viscosity_data.reagents:
                    reagent_names[node_id] = viscosity_data.reagents[reagent_id].name
                else:
                    reagent_names[node_id] = node_id
        
        # 构建网络和仿真
        try:
            network = topology_to_fluid_network(topology_data)
            program_segments = pump_program_to_segments(pump_program, topology_data)
            avg_viscosity = get_average_viscosity(viscosity_data, target_ratios_by_reagent)
            
            simulator = FluidicsSimulator(network)
            sim_result = simulator.simulate(
                program_segments=program_segments,
                viscosity=avg_viscosity,
                target_ratios=target_ratios,
                reagent_names=reagent_names,
                mixing_node_id=topology_data.mixing_node,
            )
            
            # 规则评估
            rule_engine = RuleEngine.create_default()
            rule_context = {
                "simulation_result": sim_result,
                "fluid_network": network,
                "pump_program": pump_program,
            }
            rule_results = rule_engine.evaluate_all(rule_context)
        
        except Exception as e:
            console.print(f"[red]✗ 仿真失败: {e}[/red]")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    
    if sim_result is None:
        console.print("[red]✗ 没有有效的仿真结果[/red]")
        sys.exit(1)
    
    # 导出报告
    console.print("\n[bold]导出报告...[/bold]")
    files_created: List[str] = []
    
    # 1. Markdown报告
    try:
        md_exporter = MarkdownExporter()
        md_path = md_exporter.export(
            output_path=str(output_path / "report.md"),
            simulation_result=sim_result,
            rule_results=rule_results,
            metadata={
                "chip_name": topology_data.name if topology_data else "未知",
                "version": topology_data.version if topology_data else "1.0",
            },
        )
        files_created.append(md_path)
        console.print(f"  [green]✓ Markdown报告: {md_path}[/green]")
    except Exception as e:
        console.print(f"  [red]✗ Markdown报告导出失败: {e}[/red]")
    
    # 2. CSV风险表
    try:
        csv_risks_path = CSVExporter.export_risks(
            output_path=str(output_path / "risks.csv"),
            rule_results=rule_results,
            simulation_result=sim_result,
        )
        files_created.append(csv_risks_path)
        console.print(f"  [green]✓ 风险表CSV: {csv_risks_path}[/green]")
    except Exception as e:
        console.print(f"  [yellow]⚠ 风险表导出警告: {e}[/yellow]")
    
    # 3. CSV时间序列
    try:
        csv_timeseries_path = CSVExporter.export_time_series(
            output_path=str(output_path / "timeseries.csv"),
            simulation_result=sim_result,
        )
        files_created.append(csv_timeseries_path)
        console.print(f"  [green]✓ 时间序列CSV: {csv_timeseries_path}[/green]")
    except Exception as e:
        console.print(f"  [yellow]⚠ 时间序列导出警告: {e}[/yellow]")
    
    # 4. CSV汇总表
    try:
        csv_summary_path = CSVExporter.export_summary(
            output_path=str(output_path / "summary.csv"),
            simulation_result=sim_result,
            rule_results=rule_results,
            metadata={
                "chip_name": topology_data.name if topology_data else "未知",
                "version": topology_data.version if topology_data else "1.0",
            },
        )
        files_created.append(csv_summary_path)
        console.print(f"  [green]✓ 汇总表CSV: {csv_summary_path}[/green]")
    except Exception as e:
        console.print(f"  [yellow]⚠ 汇总表导出警告: {e}[/yellow]")
    
    # 5. JSON审计包
    try:
        json_path = JSONExporter.export(
            output_path=str(output_path / "audit.json"),
            simulation_result=sim_result,
            rule_results=rule_results,
            topology_data=topology_data,
            pump_program=pump_program,
            viscosity_data=viscosity_data,
            metadata={
                "chip_name": topology_data.name if topology_data else "未知",
                "version": topology_data.version if topology_data else "1.0",
            },
        )
        files_created.append(json_path)
        console.print(f"  [green]✓ 审计包JSON: {json_path}[/green]")
    except Exception as e:
        console.print(f"  [yellow]⚠ 审计包导出警告: {e}[/yellow]")
    
    # 总结
    console.print("\n" + "-" * 50)
    console.print(f"[bold green]✓ 报告生成完成！[/bold green]")
    console.print(f"\n[bold]生成的文件:[/bold]")
    for f in files_created:
        console.print(f"  - {f}")
    
    console.print(f"\n[bold yellow]报告目录:[/bold yellow] {output_path.absolute()}")


if __name__ == "__main__":
    main()
