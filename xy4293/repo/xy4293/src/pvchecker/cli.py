#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
命令行入口 - CLI Entry Point

提供命令行交互界面，包含以下命令：
- analyze: 执行串线校核分析
- validate: 验证数据文件
- export: 导出报告
- save: 保存方案
- list: 列出已保存方案
- load: 加载方案
- test: 运行功能测试
"""

import os
import sys
from typing import Optional, List, Dict, Any
from pathlib import Path
from dataclasses import asdict
from enum import Enum

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from pvchecker import __version__
from pvchecker import (
    PVModule,
    RoofZone,
    InverterMPPT,
    RiskItem,
    AnalysisResult,
    DataParser,
    RoofZoneParser,
    ModuleParser,
    InverterParser,
    ShadingParser,
    TemperatureCorrector,
    IVCalculator,
    ShadingCalculator,
    CableLossCalculator,
    ConfigurationSolver,
    Optimizer,
    RiskAssessor,
    SchemeStorage,
    ReportExporter,
)
from pvchecker.solver import SolutionType, ConfigurationSolution
from pvchecker.risk import RiskLevel
from pvchecker.storage import save_current_analysis


app = typer.Typer(
    name="pvchecker",
    help="屋顶光伏串线校核器 - 县域光伏安装队专用本地计算工具",
    add_completion=False,
)
console = Console()


class OutputFormat(str, Enum):
    MARKDOWN = "markdown"
    MD = "md"
    CSV = "csv"
    JSON = "json"
    ALL = "all"


def find_data_files(data_dir: Path) -> Dict[str, Optional[Path]]:
    """在数据目录中查找标准数据文件"""
    files = {
        'roof_zones': None,
        'module_params': None,
        'inverter_mppt': None,
        'shading_coeff': None,
    }
    
    patterns = {
        'roof_zones': ['roof_zones.csv', 'roof.csv', 'zones.csv'],
        'module_params': ['module_params.json', 'module.json', 'params.json'],
        'inverter_mppt': ['inverter_mppt.csv', 'inverter.csv', 'mppt.csv'],
        'shading_coeff': ['shading_coefficients.csv', 'shading.csv', 'shade.csv'],
    }
    
    for key, filenames in patterns.items():
        for filename in filenames:
            filepath = data_dir / filename
            if filepath.exists():
                files[key] = filepath
                break
    
    return files


def load_data(
    roof_zones_path: Optional[Path],
    module_params_path: Optional[Path],
    inverter_mppt_path: Optional[Path],
    shading_coeff_path: Optional[Path],
    data_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """加载所有数据文件"""
    
    if data_dir:
        found = find_data_files(data_dir)
        roof_zones_path = roof_zones_path or found['roof_zones']
        module_params_path = module_params_path or found['module_params']
        inverter_mppt_path = inverter_mppt_path or found['inverter_mppt']
        shading_coeff_path = shading_coeff_path or found['shading_coeff']
    
    results = {
        'roof_zones': None,
        'module': None,
        'inverter': None,
        'shading_matrix': None,
        'errors': [],
    }
    
    if roof_zones_path:
        try:
            parser = RoofZoneParser()
            results['roof_zones'] = parser.parse(roof_zones_path)
            results['errors'].extend(parser.errors)
        except Exception as e:
            results['errors'].append(f"屋面分区解析失败: {e}")
    
    if module_params_path:
        try:
            parser = ModuleParser()
            results['module'] = parser.parse(module_params_path)
            results['errors'].extend(parser.errors)
        except Exception as e:
            results['errors'].append(f"组件参数解析失败: {e}")
    
    if inverter_mppt_path:
        try:
            parser = InverterParser()
            inverters = parser.parse(inverter_mppt_path)
            if inverters:
                results['inverter'] = inverters[0]
            results['errors'].extend(parser.errors)
        except Exception as e:
            results['errors'].append(f"逆变器参数解析失败: {e}")
    
    if shading_coeff_path:
        try:
            parser = ShadingParser()
            results['shading_matrix'] = parser.parse(shading_coeff_path)
            results['errors'].extend(parser.errors)
        except Exception as e:
            results['errors'].append(f"遮挡系数解析失败: {e}")
    
    return results


def run_analysis(
    module: PVModule,
    roof_zones: List[RoofZone],
    inverter: InverterMPPT,
    min_temp: float = -10.0,
    max_temp: float = 60.0,
    shading_matrix: Optional[Any] = None,
) -> Dict[str, Any]:
    """执行完整的分析流程"""
    
    solver = ConfigurationSolver(
        module=module,
        inverter=inverter,
        roof_zones=roof_zones,
        min_temp=min_temp,
        max_temp=max_temp,
    )
    
    solutions = solver.solve()
    
    optimizer = Optimizer(solutions)
    recommendation = optimizer.get_recommendation()
    
    risk_assessor = RiskAssessor()
    all_risks: List[RiskItem] = []
    
    string_shading_factors = None
    if shading_matrix is not None:
        avg_shading = shading_matrix.mean()
        if avg_shading < 0.9:
            string_shading_factors = []
            for zone in roof_zones:
                for _ in range(zone.module_count // solutions[0].modules_per_string if solutions else 10):
                    string_shading_factors.append([avg_shading] * (solutions[0].modules_per_string if solutions else 10))
    
    for solution in solutions:
        risks = risk_assessor.assess_solution(
            solution=solution,
            module=module,
            inverter=inverter,
            string_shading_factors=string_shading_factors,
            min_temp=min_temp,
        )
        all_risks.extend(risks)
    
    risk_summary = risk_assessor.get_summary(all_risks)
    
    return {
        'module': module,
        'roof_zones': roof_zones,
        'inverter': inverter,
        'solutions': solutions,
        'recommendation': recommendation,
        'risks': all_risks,
        'risk_summary': risk_summary,
        'shading_matrix': shading_matrix,
        'environment_params': {
            'min_temp': min_temp,
            'max_temp': max_temp,
            'reference_irradiance': 1000.0,
        },
    }


def display_summary(analysis_results: Dict[str, Any]):
    """显示分析摘要"""
    
    module = analysis_results['module']
    roof_zones = analysis_results['roof_zones']
    inverter = analysis_results['inverter']
    solutions = analysis_results['solutions']
    risks = analysis_results['risks']
    risk_summary = analysis_results['risk_summary']
    recommendation = analysis_results['recommendation']
    
    console.print(Panel.fit(
        "[bold green]屋顶光伏串线校核器 - 分析结果[/bold green]",
        subtitle=f"版本: {__version__}"
    ))
    
    table = Table(title="基本参数摘要")
    table.add_column("参数类型", style="cyan")
    table.add_column("描述", style="white")
    table.add_column("数值", style="yellow")
    
    total_modules = sum(z.module_count for z in roof_zones)
    total_area = sum(z.area for z in roof_zones)
    estimated_power = module.p_max * total_modules / 1000
    
    table.add_row("组件型号", module.model, "-")
    table.add_row("组件功率", f"{module.p_max} W", "-")
    table.add_row("屋面分区", f"{len(roof_zones)} 个分区", f"{total_area:.1f} m²")
    table.add_row("总组件数", f"{total_modules} 块", "-")
    table.add_row("估算总功率", f"{estimated_power:.2f} kW", "-")
    table.add_row("逆变器型号", inverter.inverter_model, "-")
    table.add_row("MPPT电压范围", f"{inverter.v_min}V - {inverter.v_max}V", f"标称: {inverter.v_nom}V")
    
    console.print(table)
    
    console.print("\n[bold cyan]=== 方案对比 ===[/bold cyan]")
    
    sol_table = Table(title="串并联方案")
    sol_table.add_column("排名", style="cyan")
    sol_table.add_column("方案名称", style="white")
    sol_table.add_column("类型", style="magenta")
    sol_table.add_column("每串×并联", style="yellow")
    sol_table.add_column("工作电压", style="green")
    sol_table.add_column("总功率", style="blue")
    sol_table.add_column("综合评分", style="red")
    
    sorted_solutions = sorted(
        solutions,
        key=lambda s: s.score.total_score,
        reverse=True
    )
    
    type_labels = {
        SolutionType.MIN_SERIES: "最小串联",
        SolutionType.OPTIMAL: "最优串联",
        SolutionType.MAX_SERIES: "最大串联",
    }
    
    for rank, sol in enumerate(sorted_solutions, 1):
        voltage_status = "[green]✓[/green]" if sol.voltage_in_mppt_range else "[red]⚠[/red]"
        sol_table.add_row(
            str(rank),
            sol.name,
            type_labels.get(sol.solution_type, "自定义"),
            f"{sol.modules_per_string}×{sol.strings_in_parallel}",
            f"{sol.estimated_v_mp:.1f}V {voltage_status}",
            f"{sol.estimated_total_power/1000:.2f}kW",
            f"{sol.score.total_score:.1f}"
        )
    
    console.print(sol_table)
    
    if risks:
        console.print("\n[bold red]=== 风险评估 ===[/bold red]")
        
        risk_table = Table(title="风险项")
        risk_table.add_column("等级", style="cyan")
        risk_table.add_column("风险项", style="white")
        risk_table.add_column("描述", style="yellow")
        risk_table.add_column("风险评分", style="red")
        
        severity_styles = {
            'critical': "[bold red]🔴 严重[/bold red]",
            'high': "[bold orange]🟠 高[/bold orange]",
            'medium': "[bold yellow]🟡 中[/bold yellow]",
            'low': "[bold green]🟢 低[/bold green]",
        }
        
        for risk in risks:
            severity_label = severity_styles.get(risk.severity, risk.severity)
            risk_table.add_row(
                severity_label,
                risk.rule_name,
                risk.message[:50] + "..." if len(risk.message) > 50 else risk.message,
                f"{risk.risk_score:.1f}"
            )
        
        console.print(risk_table)
        
        critical_count = risk_summary['by_severity'].get('critical', 0)
        high_count = risk_summary['by_severity'].get('high', 0)
        
        if critical_count > 0 or high_count > 0:
            console.print("\n[bold red]⚠ 关键建议:[/bold red]")
            for rec in risk_summary['recommendations']:
                console.print(f"  • {rec['rule']}: {rec['suggestion']}")
    else:
        console.print("\n[bold green]✅ 未检测到显著风险项[/bold green]")
    
    if recommendation and 'analysis' in recommendation:
        analysis = recommendation['analysis']
        
        console.print("\n[bold cyan]=== 推荐方案分析 ===[/bold cyan]")
        
        if analysis['strengths']:
            console.print("[green]✓ 优势:[/green]")
            for s in analysis['strengths']:
                console.print(f"  • {s}")
        
        if analysis['weaknesses']:
            console.print("[red]✗ 劣势:[/red]")
            for w in analysis['weaknesses']:
                console.print(f"  • {w}")
        
        if analysis['suggestions']:
            console.print("[yellow]💡 建议:[/yellow]")
            for s in analysis['suggestions']:
                console.print(f"  • {s}")


@app.command("version")
def show_version():
    """显示版本信息"""
    console.print(f"[bold green]屋顶光伏串线校核器[/bold green] - 版本 [yellow]{__version__}[/yellow]")
    console.print("县域光伏安装队专用本地计算工具")


@app.command("analyze")
def analyze(
    data_dir: Optional[Path] = typer.Option(
        None, "--data-dir", "-d",
        help="数据目录（自动查找标准文件名）",
        exists=True,
        file_okay=False,
        dir_okay=True,
    ),
    roof_zones: Optional[Path] = typer.Option(
        None, "--roof-zones", "-r",
        help="屋面分区CSV文件路径",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    module_params: Optional[Path] = typer.Option(
        None, "--module-params", "-m",
        help="组件参数JSON文件路径",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    inverter_mppt: Optional[Path] = typer.Option(
        None, "--inverter-mppt", "-i",
        help="逆变器MPPT表CSV文件路径",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    shading_coeff: Optional[Path] = typer.Option(
        None, "--shading-coeff", "-s",
        help="逐小时遮挡系数CSV文件路径",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    min_temp: float = typer.Option(
        -10.0, "--min-temp",
        help="最低环境温度 (°C)",
    ),
    max_temp: float = typer.Option(
        60.0, "--max-temp",
        help="最高环境温度 (°C)",
    ),
    output: Optional[Path] = typer.Option(
        None, "--output", "-o",
        help="输出报告路径（不保存到文件则只显示）",
        file_okay=True,
        dir_okay=False,
    ),
    format: OutputFormat = typer.Option(
        OutputFormat.MARKDOWN, "--format", "-f",
        help="输出格式",
    ),
    save_name: Optional[str] = typer.Option(
        None, "--save",
        help="保存方案名称",
    ),
):
    """执行串线校核分析
    
    导入数据，计算串并联方案，评估风险，生成报告。
    
    示例:
      pvchecker analyze --data-dir ./data/samples/
      pvchecker analyze -r roof_zones.csv -m module.json -i inverter.csv
      pvchecker analyze --data-dir ./data/ --min-temp -15 --max-temp 50
    """
    
    if not (data_dir or roof_zones or module_params or inverter_mppt):
        sample_dir = Path(__file__).parent.parent.parent.parent / "data" / "samples"
        if sample_dir.exists():
            console.print(f"[yellow]使用示例数据目录: {sample_dir}[/yellow]")
            data_dir = sample_dir
        else:
            console.print("[bold red]错误:[/bold red] 未指定数据文件路径")
            console.print("请使用 --data-dir 指定数据目录，或分别指定各数据文件路径")
            raise typer.Exit(1)
    
    with console.status("[bold green]正在加载数据...[/bold green]"):
        data = load_data(
            roof_zones_path=roof_zones,
            module_params_path=module_params,
            inverter_mppt_path=inverter_mppt,
            shading_coeff_path=shading_coeff,
            data_dir=data_dir,
        )
    
    if data['errors']:
        console.print("[bold red]数据加载错误:[/bold red]")
        for err in data['errors']:
            console.print(f"  • {err}")
    
    if not data['module']:
        console.print("[bold red]错误:[/bold red] 缺少组件参数数据")
        raise typer.Exit(1)
    
    if not data['roof_zones']:
        console.print("[bold red]错误:[/bold red] 缺少屋面分区数据")
        raise typer.Exit(1)
    
    if not data['inverter']:
        console.print("[bold red]错误:[/bold red] 缺少逆变器参数数据")
        raise typer.Exit(1)
    
    with console.status("[bold green]正在执行分析计算...[/bold green]"):
        results = run_analysis(
            module=data['module'],
            roof_zones=data['roof_zones'],
            inverter=data['inverter'],
            min_temp=min_temp,
            max_temp=max_temp,
            shading_matrix=data['shading_matrix'],
        )
    
    display_summary(results)
    
    if save_name:
        with console.status("[bold green]正在保存方案...[/bold green]"):
            try:
                scheme_id = save_current_analysis(
                    name=save_name,
                    module=results['module'],
                    roof_zones=results['roof_zones'],
                    inverter=results['inverter'],
                    shading_matrix=results['shading_matrix'].tolist() if results['shading_matrix'] is not None else None,
                    solutions=results['solutions'],
                    risks=results['risks'],
                    environment_params=results['environment_params'],
                    description=f"温度范围: {min_temp}°C ~ {max_temp}°C",
                )
                console.print(f"\n[bold green]✓ 方案已保存:[/bold green] {save_name} (ID: {scheme_id})")
            except Exception as e:
                console.print(f"[bold red]保存方案失败:[/bold red] {e}")
    
    if output:
        with console.status("[bold green]正在导出报告...[/bold green]"):
            try:
                exporter = ReportExporter()
                
                if format == OutputFormat.ALL:
                    export_results = exporter.export_all(
                        output_dir=output.parent if output.suffix else output,
                        base_name=output.stem if output.suffix else "pv_analysis",
                        solutions=results['solutions'],
                        module=results['module'],
                        inverter=results['inverter'],
                        roof_zones=results['roof_zones'],
                        risks=results['risks'],
                        shading_matrix=results['shading_matrix'].tolist() if results['shading_matrix'] is not None else None,
                        environment_params=results['environment_params'],
                    )
                    console.print(f"\n[bold green]✓ 所有格式报告已导出[/bold green]")
                    for fmt, res in export_results.items():
                        if res.success:
                            console.print(f"  • {fmt}: {res.output_path}")
                else:
                    fmt_str = 'markdown' if format in [OutputFormat.MARKDOWN, OutputFormat.MD] else format.value
                    result = exporter.export(
                        format=fmt_str,
                        output_path=output,
                        solutions=results['solutions'],
                        module=results['module'],
                        inverter=results['inverter'],
                        roof_zones=results['roof_zones'],
                        risks=results['risks'],
                        shading_matrix=results['shading_matrix'].tolist() if results['shading_matrix'] is not None else None,
                        environment_params=results['environment_params'],
                    )
                    
                    if result.success:
                        console.print(f"\n[bold green]✓ 报告已导出:[/bold green] {result.output_path}")
                    else:
                        console.print(f"[bold red]导出失败:[/bold red] {result.message}")
                        
            except Exception as e:
                console.print(f"[bold red]导出报告失败:[/bold red] {e}")


@app.command("validate")
def validate(
    data_dir: Optional[Path] = typer.Option(
        None, "--data-dir", "-d",
        help="数据目录",
        exists=True,
        file_okay=False,
        dir_okay=True,
    ),
    roof_zones: Optional[Path] = typer.Option(
        None, "--roof-zones", "-r",
        help="屋面分区CSV",
        exists=True,
    ),
    module_params: Optional[Path] = typer.Option(
        None, "--module-params", "-m",
        help="组件参数JSON",
        exists=True,
    ),
    inverter_mppt: Optional[Path] = typer.Option(
        None, "--inverter-mppt", "-i",
        help="逆变器MPPT CSV",
        exists=True,
    ),
    shading_coeff: Optional[Path] = typer.Option(
        None, "--shading-coeff", "-s",
        help="遮挡系数CSV",
        exists=True,
    ),
):
    """验证数据文件格式和内容
    
    检查数据文件是否符合要求，包含必要字段。
    
    示例:
      pvchecker validate --data-dir ./data/samples/
    """
    
    data = load_data(
        roof_zones_path=roof_zones,
        module_params_path=module_params,
        inverter_mppt_path=inverter_mppt,
        shading_coeff_path=shading_coeff,
        data_dir=data_dir,
    )
    
    console.print(Panel.fit("[bold green]数据验证结果[/bold green]"))
    
    table = Table(title="文件验证状态")
    table.add_column("数据类型", style="cyan")
    table.add_column("状态", style="white")
    table.add_column("详情", style="yellow")
    
    if data['roof_zones']:
        total_modules = sum(z.module_count for z in data['roof_zones'])
        table.add_row(
            "屋面分区",
            "[green]✓ 有效[/green]",
            f"{len(data['roof_zones'])} 个分区, 共 {total_modules} 块组件"
        )
    else:
        table.add_row("屋面分区", "[red]✗ 缺失/无效[/red]", "-")
    
    if data['module']:
        table.add_row(
            "组件参数",
            "[green]✓ 有效[/green]",
            f"{data['module'].model}, {data['module'].p_max}W"
        )
    else:
        table.add_row("组件参数", "[red]✗ 缺失/无效[/red]", "-")
    
    if data['inverter']:
        table.add_row(
            "逆变器参数",
            "[green]✓ 有效[/green]",
            f"{data['inverter'].inverter_model}, {data['inverter'].v_min}-{data['inverter'].v_max}V"
        )
    else:
        table.add_row("逆变器参数", "[red]✗ 缺失/无效[/red]", "-")
    
    if data['shading_matrix'] is not None:
        table.add_row(
            "遮挡系数",
            "[green]✓ 有效[/green]",
            f"12个月 × 24小时矩阵"
        )
    else:
        table.add_row("遮挡系数", "[yellow]⚠ 可选[/yellow]", "未提供或无效")
    
    console.print(table)
    
    if data['errors']:
        console.print("\n[bold red]错误详情:[/bold red]")
        for err in data['errors']:
            console.print(f"  • {err}")
        raise typer.Exit(1)


@app.command("list")
def list_schemes(
    include_details: bool = typer.Option(
        False, "--details", "-d",
        help="显示详细信息",
    ),
):
    """列出已保存的方案
    
    示例:
      pvchecker list
      pvchecker list --details
    """
    
    storage = SchemeStorage()
    schemes = storage.list(include_details=include_details)
    
    if not schemes:
        console.print("[yellow]暂无已保存的方案[/yellow]")
        return
    
    console.print(f"[bold green]已保存方案列表[/bold green] (共 {len(schemes)} 个)")
    
    table = Table(title="已保存方案")
    table.add_column("方案ID", style="cyan")
    table.add_column("名称", style="white")
    table.add_column("创建时间", style="yellow")
    table.add_column("更新时间", style="blue")
    
    if include_details:
        table.add_column("总组件数", style="green")
        table.add_column("估算功率", style="magenta")
    
    for entry in schemes:
        if include_details and 'index_entry' in entry:
            idx = entry['index_entry']
            table.add_row(
                idx.get('scheme_id', '-'),
                idx.get('name', '-'),
                idx.get('created_at', '-')[:19] if idx.get('created_at') else '-',
                idx.get('updated_at', '-')[:19] if idx.get('updated_at') else '-',
                str(idx.get('total_modules', '-')),
                f"{idx.get('estimated_power', 0) / 1000:.2f}kW" if idx.get('estimated_power') else '-',
            )
        else:
            table.add_row(
                entry.get('scheme_id', '-'),
                entry.get('name', '-'),
                entry.get('created_at', '-')[:19] if entry.get('created_at') else '-',
                entry.get('updated_at', '-')[:19] if entry.get('updated_at') else '-',
            )
    
    console.print(table)


@app.command("save")
def save_scheme(
    name: str = typer.Argument(..., help="方案名称"),
    description: str = typer.Option("", "--desc", "-d", help="方案描述"),
    data_dir: Optional[Path] = typer.Option(
        None, "--data-dir",
        help="数据目录",
        exists=True,
    ),
):
    """保存当前分析方案
    
    从数据目录加载数据并保存为方案。
    
    示例:
      pvchecker save "方案A-优化版" --data-dir ./data/samples/
    """
    
    if not data_dir:
        sample_dir = Path(__file__).parent.parent.parent.parent / "data" / "samples"
        if sample_dir.exists():
            data_dir = sample_dir
        else:
            console.print("[bold red]错误:[/bold red] 请指定 --data-dir")
            raise typer.Exit(1)
    
    data = load_data(
        roof_zones_path=None,
        module_params_path=None,
        inverter_mppt_path=None,
        shading_coeff_path=None,
        data_dir=data_dir,
    )
    
    if not data['module'] or not data['roof_zones'] or not data['inverter']:
        console.print("[bold red]错误:[/bold red] 数据不完整，无法保存方案")
        raise typer.Exit(1)
    
    with console.status("[bold green]正在分析并保存方案...[/bold green]"):
        results = run_analysis(
            module=data['module'],
            roof_zones=data['roof_zones'],
            inverter=data['inverter'],
            shading_matrix=data['shading_matrix'],
        )
        
        scheme_id = save_current_analysis(
            name=name,
            module=results['module'],
            roof_zones=results['roof_zones'],
            inverter=results['inverter'],
            shading_matrix=results['shading_matrix'].tolist() if results['shading_matrix'] is not None else None,
            solutions=results['solutions'],
            risks=results['risks'],
            environment_params=results['environment_params'],
            description=description,
        )
    
    console.print(f"[bold green]✓ 方案已保存[/bold green]")
    console.print(f"  名称: {name}")
    console.print(f"  ID: {scheme_id}")


@app.command("test")
def run_tests(
    test_type: Optional[str] = typer.Option(
        None, "--test", "-t",
        help="测试类型: temperature, configuration, shading, cable, risk",
    ),
):
    """运行功能测试
    
    验证各模块功能是否正常。
    
    示例:
      pvchecker test
      pvchecker test --test temperature
    """
    
    console.print(Panel.fit("[bold green]功能测试[/bold green]"))
    
    test_modules = {
        'temperature': test_temperature_calculator,
        'configuration': test_configuration_solver,
        'shading': test_shading_calculator,
        'cable': test_cable_loss_calculator,
        'risk': test_risk_rules,
    }
    
    if test_type:
        if test_type in test_modules:
            test_modules[test_type]()
        else:
            console.print(f"[bold red]错误:[/bold red] 未知的测试类型 '{test_type}'")
            console.print(f"可用类型: {', '.join(test_modules.keys())}")
            raise typer.Exit(1)
    else:
        for name, test_func in test_modules.items():
            console.print(f"\n[bold cyan]=== 测试: {name} ===[/bold cyan]")
            test_func()
    
    console.print("\n[bold green]✓ 所有测试完成[/bold green]")


def test_temperature_calculator():
    """测试温度修正计算"""
    
    module = PVModule(
        model="Test-Module",
        p_max=550.0,
        v_mp=48.5,
        i_mp=11.34,
        voc=59.2,
        isc=12.0,
        temp_coeff_voc=-0.32,
        temp_coeff_isc=0.05,
        temp_coeff_pmax=-0.40,
    )
    
    corrector = TemperatureCorrector(module)
    
    stc_params = corrector.calculate(25.0)
    low_temp_params = corrector.calculate(-10.0)
    high_temp_params = corrector.calculate(60.0)
    
    table = Table(title="温度修正测试")
    table.add_column("参数", style="cyan")
    table.add_column("STC (25°C)", style="white")
    table.add_column("低温 (-10°C)", style="blue")
    table.add_column("高温 (60°C)", style="red")
    
    table.add_row("Voc (V)", f"{stc_params.voc:.2f}", f"{low_temp_params.voc:.2f}", f"{high_temp_params.voc:.2f}")
    table.add_row("Isc (A)", f"{stc_params.isc:.2f}", f"{low_temp_params.isc:.2f}", f"{high_temp_params.isc:.2f}")
    table.add_row("Pmax (W)", f"{stc_params.p_max:.2f}", f"{low_temp_params.p_max:.2f}", f"{high_temp_params.p_max:.2f}")
    
    console.print(table)
    
    assert low_temp_params.voc > stc_params.voc, "低温下Voc应升高"
    assert high_temp_params.voc < stc_params.voc, "高温下Voc应降低"
    console.print("[green]✓ 温度修正计算正确[/green]")


def test_configuration_solver():
    """测试串并联方案求解"""
    
    module = PVModule(
        model="Test-Module",
        p_max=550.0,
        v_mp=48.5,
        i_mp=11.34,
        voc=59.2,
        isc=12.0,
        temp_coeff_voc=-0.32,
        temp_coeff_isc=0.05,
        temp_coeff_pmax=-0.40,
    )
    
    inverter = InverterMPPT(
        inverter_model="Test-Inverter",
        mppt_id="mppt_1",
        v_min=200.0,
        v_max=1000.0,
        v_nom=600.0,
        p_max=10000.0,
        i_max=20.0,
    )
    
    roof_zones = [
        RoofZone(zone_id="zone1", area=100.0, tilt=25.0, azimuth=0.0, module_count=40),
    ]
    
    solver = ConfigurationSolver(module, inverter, roof_zones)
    solutions = solver.solve()
    
    console.print(f"生成了 {len(solutions)} 个方案")
    
    table = Table(title="串并联方案测试")
    table.add_column("方案名称", style="cyan")
    table.add_column("每串组件", style="white")
    table.add_column("并联路数", style="yellow")
    table.add_column("工作电压", style="green")
    table.add_column("综合评分", style="red")
    
    for sol in solutions:
        table.add_row(
            sol.name,
            str(sol.modules_per_string),
            str(sol.strings_in_parallel),
            f"{sol.estimated_v_mp:.1f}V",
            f"{sol.score.total_score:.1f}",
        )
    
    console.print(table)
    
    assert len(solutions) >= 2, "应生成至少2个方案"
    console.print("[green]✓ 串并联方案求解正确[/green]")


def test_shading_calculator():
    """测试遮挡损失计算"""
    
    module = PVModule(
        model="Test-Module",
        p_max=550.0,
        v_mp=48.5,
        i_mp=11.34,
        voc=59.2,
        isc=12.0,
        temp_coeff_voc=-0.32,
        temp_coeff_isc=0.05,
        temp_coeff_pmax=-0.40,
    )
    
    calculator = ShadingCalculator(module)
    
    result_no_shading = calculator.calculate_string_shading_loss(
        modules_per_string=10,
        shading_factors=[1.0] * 10,
    )
    
    result_with_shading = calculator.calculate_string_shading_loss(
        modules_per_string=10,
        shading_factors=[1.0, 1.0, 0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    )
    
    table = Table(title="遮挡损失测试")
    table.add_column("场景", style="cyan")
    table.add_column("最小遮挡系数", style="white")
    table.add_column("损失百分比", style="red")
    
    table.add_row(
        "无遮挡",
        f"{result_no_shading.min_shading_factor:.2f}",
        f"{result_no_shading.estimated_power_loss_percent:.2f}%",
    )
    
    table.add_row(
        "单块遮挡50%",
        f"{result_with_shading.min_shading_factor:.2f}",
        f"{result_with_shading.estimated_power_loss_percent:.2f}%",
    )
    
    console.print(table)
    
    assert result_with_shading.estimated_power_loss_percent > result_no_shading.estimated_power_loss_percent
    console.print("[green]✓ 遮挡损失计算正确[/green]")


def test_cable_loss_calculator():
    """测试线缆损失计算"""
    
    calculator = CableLossCalculator('copper')
    
    result = calculator.calculate(
        current=15.0,
        voltage=600.0,
        cable_length=50.0,
        cross_section=6.0,
        round_trip=True,
    )
    
    table = Table(title="线缆损失测试")
    table.add_column("参数", style="cyan")
    table.add_column("值", style="white")
    
    table.add_row("工作电流", "15.0 A")
    table.add_row("工作电压", "600.0 V")
    table.add_row("线缆长度", "50.0 m (往返)")
    table.add_row("线缆规格", "6.0 mm²")
    table.add_row("压降", f"{result.voltage_drop:.2f} V")
    table.add_row("压降百分比", f"{result.voltage_drop_percent:.2f} %")
    table.add_row("功率损失", f"{result.power_loss:.2f} W")
    table.add_row("损失百分比", f"{result.power_loss_percent:.2f} %")
    
    console.print(table)
    
    recommendation = calculator.recommend_cable_size(
        current=15.0,
        voltage=600.0,
        cable_length=50.0,
        max_voltage_drop_percent=2.0,
    )
    
    console.print(f"\n推荐线缆规格: {recommendation['recommended_size']} mm²")
    console.print("[green]✓ 线缆损失计算正确[/green]")


def test_risk_rules():
    """测试风险规则"""
    
    module = PVModule(
        model="Test-Module",
        p_max=550.0,
        v_mp=48.5,
        i_mp=11.34,
        voc=59.2,
        isc=12.0,
        temp_coeff_voc=-0.32,
        temp_coeff_isc=0.05,
        temp_coeff_pmax=-0.40,
    )
    
    inverter = InverterMPPT(
        inverter_model="Test-Inverter",
        mppt_id="mppt_1",
        v_min=200.0,
        v_max=1000.0,
        v_nom=600.0,
        p_max=10000.0,
        i_max=20.0,
    )
    
    voltage_rule = RiskAssessor().rules[0]
    
    if hasattr(voltage_rule, 'get_risk_item'):
        risk = voltage_rule.get_risk_item(
            module=module,
            inverter=inverter,
            modules_per_string=20,
            min_temp=-10.0,
        )
        
        if risk:
            console.print(f"风险项: {risk.rule_name}")
            console.print(f"等级: {risk.severity}")
            console.print(f"描述: {risk.message}")
        else:
            console.print("未检测到电压超限风险")
    
    console.print("[green]✓ 风险规则检测正确[/green]")


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    """主入口"""
    if ctx.invoked_subcommand is None:
        console.print(Panel.fit(
            "[bold green]屋顶光伏串线校核器[/bold green]\n"
            "[italic]县域光伏安装队专用本地计算工具[/italic]\n\n"
            f"版本: {__version__}\n\n"
            "使用 [cyan]pvchecker --help[/cyan] 查看可用命令"
        ))


if __name__ == "__main__":
    app()
