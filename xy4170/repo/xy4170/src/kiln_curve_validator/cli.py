"""CLI界面模块 - 命令行交互入口"""

import os
from pathlib import Path
from typing import Optional, List
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .models import (
    KilnParameters,
    FiringRecipe,
    FiringType,
    PlannedCurve,
    MeasuredCurve,
    ValidationResult,
    ComparisonResult,
    SimulationResult,
    CorrectionCurve,
)
from .parser import (
    CSVParser,
    PlanCurveParser,
    ConfigurationLoader,
)
from .simulator import (
    FullCurveSimulator,
    ThermalWorkCalculator,
)
from .validator import (
    FullValidator,
    CurveComparator,
)
from .exporter import (
    MarkdownExporter,
    CSVExporter,
    AdjustmentGenerator,
)


console = Console()


@click.group()
@click.version_option(version="0.1.0", prog_name="kiln-validator")
def main():
    """烧成曲线复核器 - 陶艺窑炉温度曲线科学计算与校验工具

    用于窑炉负责人在素烧、釉烧前复核温度曲线，避免升温太猛、
    保温不足或冷却开裂等问题。
    """
    pass


@main.command()
@click.argument('recipe_path', type=click.Path(exists=True, path_type=Path))
@click.argument('kiln_path', type=click.Path(exists=True, path_type=Path))
@click.option('--output', '-o', type=click.Path(path_type=Path), help='输出曲线JSON文件路径')
def generate(recipe_path: Path, kiln_path: Path, output: Optional[Path]):
    """根据配方和窑炉参数生成默认计划曲线

    RECIPE_PATH: 配方JSON文件路径
    KILN_PATH: 窑炉参数JSON文件路径
    """
    console.print(Panel("[bold blue]生成计划曲线[/bold blue]"))

    try:
        kiln = ConfigurationLoader.load_kiln_parameters(kiln_path)
        recipe = ConfigurationLoader.load_recipe(recipe_path)

        console.print(f"[green]✓[/green] 加载窑炉: {kiln.name}")
        console.print(f"[green]✓[/green] 加载配方: {recipe.name} ({'素烧' if recipe.firing_type == FiringType.BISQUE else '釉烧'})")

        parser = PlanCurveParser()
        planned_curve = parser.generate_default_curve(recipe, kiln)

        console.print("")
        console.print(f"[bold]生成的计划曲线:[/bold]")
        console.print(f"  总时长: {planned_curve.get_total_duration():.0f} 分钟")
        console.print(f"  峰值温度: {planned_curve.get_peak_temperature():.1f} °C")
        console.print(f"  曲线段数: {len(planned_curve.segments)}")

        table = Table(title="曲线段明细")
        table.add_column("段号", style="cyan")
        table.add_column("类型", style="magenta")
        table.add_column("起始温度", justify="right")
        table.add_column("结束温度", justify="right")
        table.add_column("时长", justify="right")
        table.add_column("速率", justify="right")

        type_names = {
            'ramp': '升温',
            'hold': '保温',
            'cool': '降温',
        }

        for idx, seg in enumerate(planned_curve.segments, 1):
            seg_type = type_names.get(seg.segment_type.value, seg.segment_type.value)
            rate_str = f"{seg.rate:+.2f}°C/min" if seg.rate else "-"
            table.add_row(
                str(idx),
                seg_type,
                f"{seg.start_temp:.1f}°C",
                f"{seg.end_temp:.1f}°C",
                f"{seg.duration:.0f}min",
                rate_str
            )

        console.print(table)

        if output:
            import json
            from datetime import datetime

            curve_dict = {
                'recipe_name': planned_curve.recipe_name,
                'kiln_name': planned_curve.kiln_name,
                'created_at': planned_curve.created_at.isoformat(),
                'preheat_included': planned_curve.preheat_included,
                'segments': [
                    {
                        'segment_type': s.segment_type.value,
                        'start_temp': s.start_temp,
                        'end_temp': s.end_temp,
                        'duration': s.duration,
                        'rate': s.rate
                    }
                    for s in planned_curve.segments
                ]
            }

            with open(output, 'w', encoding='utf-8') as f:
                json.dump(curve_dict, f, ensure_ascii=False, indent=2)

            console.print(f"[green]✓[/green] 曲线已保存到: {output}")

    except Exception as e:
        console.print(f"[red]✗[/red] 错误: {e}")
        raise click.Abort()


@main.command()
@click.argument('csv_path', type=click.Path(exists=True, path_type=Path))
@click.option('--kiln', '-k', help='窑炉名称')
@click.option('--output', '-o', type=click.Path(path_type=Path), help='输出摘要JSON文件')
def parse(csv_path: Path, kiln: Optional[str], output: Optional[Path]):
    """解析温度记录CSV文件

    CSV_PATH: 温度记录CSV文件路径
    """
    console.print(Panel("[bold blue]解析温度记录[/bold blue]"))

    try:
        parser = CSVParser()
        measured_curve = parser.parse_file(csv_path, kiln_name=kiln or "Unknown")

        console.print(f"[green]✓[/green] 成功解析 {len(measured_curve.data_points)} 个数据点")
        console.print(f"  窑炉: {measured_curve.kiln_name}")
        console.print(f"  开始时间: {measured_curve.start_time}")
        if measured_curve.end_time:
            console.print(f"  结束时间: {measured_curve.end_time}")
        console.print(f"  总时长: {measured_curve.get_duration_minutes():.1f} 分钟")
        console.print(f"  采样间隔: {measured_curve.sampling_interval:.1f} 分钟" if measured_curve.sampling_interval else "  采样间隔: 未知")
        console.print(f"  传感器数量: {measured_curve.sensor_count}")

        temps = measured_curve.get_temperatures_array()
        if temps:
            console.print(f"  温度范围: {min(temps):.1f} ~ {max(temps):.1f} °C")

        if output:
            import json
            data = {
                'kiln_name': measured_curve.kiln_name,
                'start_time': measured_curve.start_time.isoformat(),
                'end_time': measured_curve.end_time.isoformat() if measured_curve.end_time else None,
                'data_points_count': len(measured_curve.data_points),
                'duration_minutes': measured_curve.get_duration_minutes(),
                'sampling_interval_minutes': measured_curve.sampling_interval,
                'sensor_count': measured_curve.sensor_count,
            }
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            console.print(f"[green]✓[/green] 摘要已保存到: {output}")

    except Exception as e:
        console.print(f"[red]✗[/red] 错误: {e}")
        raise click.Abort()


@main.command()
@click.argument('measured_csv', type=click.Path(exists=True, path_type=Path))
@click.option('--recipe', '-r', required=True, type=click.Path(exists=True, path_type=Path), help='配方JSON文件')
@click.option('--kiln', '-k', required=True, type=click.Path(exists=True, path_type=Path), help='窑炉参数JSON文件')
@click.option('--planned', '-p', type=click.Path(exists=True, path_type=Path), help='计划曲线JSON文件（可选）')
@click.option('--output-dir', '-o', type=click.Path(path_type=Path), default=Path('.'), help='输出目录')
@click.option('--name', '-n', help='报告名称前缀')
@click.option('--no-simulate', is_flag=True, help='跳过热惯性模拟')
def validate(
    measured_csv: Path,
    recipe: Path,
    kiln: Path,
    planned: Optional[Path],
    output_dir: Path,
    name: Optional[str],
    no_simulate: bool
):
    """运行完整的曲线复核流程

    MEASURED_CSV: 实测温度记录CSV文件路径
    """
    console.print(Panel("[bold blue]烧成曲线复核[/bold blue]"))

    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        base_name = name or measured_csv.stem

        console.print("[bold]步骤 1/5: 加载配置...[/bold]")
        kiln_params = ConfigurationLoader.load_kiln_parameters(kiln)
        recipe_params = ConfigurationLoader.load_recipe(recipe)

        console.print(f"  [green]✓[/green] 窑炉: {kiln_params.name}")
        console.print(f"  [green]✓[/green] 配方: {recipe_params.name}")

        console.print("")
        console.print("[bold]步骤 2/5: 解析实测数据...[/bold]")
        csv_parser = CSVParser()
        measured_curve = csv_parser.parse_file(measured_csv, kiln_name=kiln_params.name)
        console.print(f"  [green]✓[/green] 解析到 {len(measured_curve.data_points)} 个数据点")
        console.print(f"  [green]✓[/green] 时长: {measured_curve.get_duration_minutes():.1f} 分钟")

        console.print("")
        console.print("[bold]步骤 3/5: 准备计划曲线...[/bold]")
        planned_curve: Optional[PlannedCurve] = None

        if planned:
            plan_parser = PlanCurveParser()
            planned_curve = plan_parser.parse_json_file(planned)
            console.print(f"  [green]✓[/green] 加载计划曲线: {planned_curve.recipe_name}")
        else:
            plan_parser = PlanCurveParser()
            planned_curve = plan_parser.generate_default_curve(recipe_params, kiln_params)
            console.print(f"  [green]✓[/green] 自动生成计划曲线")

        console.print(f"  计划时长: {planned_curve.get_total_duration():.1f} 分钟")
        console.print(f"  计划峰值: {planned_curve.get_peak_temperature():.1f} °C")

        simulation_result: Optional[SimulationResult] = None
        if not no_simulate:
            console.print("")
            console.print("[bold]步骤 4/5: 热惯性模拟...[/bold]")
            simulator = FullCurveSimulator(kiln_params, recipe_params)
            simulation_result = simulator.simulate_planned_curve(planned_curve)
            console.print(f"  [green]✓[/green] 模拟完成")

            if simulation_result.core_surface_diff:
                max_diff = max(abs(d) for d in simulation_result.core_surface_diff)
                console.print(f"  最大表里温差: {max_diff:.2f} °C")

        else:
            console.print("")
            console.print("[bold]步骤 4/5: 跳过热惯性模拟[/bold]")

        console.print("")
        console.print("[bold]步骤 5/5: 运行校验...[/bold]")

        validator = FullValidator(kiln_params, recipe_params)
        validation_result = validator.run_full_validation(
            measured_curve=measured_curve,
            planned_curve=planned_curve,
            simulation_result=simulation_result
        )

        comparison_result: Optional[ComparisonResult] = None
        if planned_curve:
            comparison_result = CurveComparator.compare(planned_curve, measured_curve)

        status_color = {
            "pass": "green",
            "warning": "yellow",
            "fail": "red",
        }.get(validation_result.overall_status, "white")

        status_text = {
            "pass": "通过",
            "warning": "存在警告",
            "fail": "未通过",
        }.get(validation_result.overall_status, "未知")

        console.print("")
        console.print(Panel(f"[{status_color}][bold]复核结果: {status_text}[/bold][/{status_color}]\n\n{validation_result.summary}"))

        critical = [i for i in validation_result.issues if i.severity == "critical"]
        warning = [i for i in validation_result.issues if i.severity == "warning"]

        if critical:
            console.print("")
            console.print("[red][bold]严重问题:[/bold][/red]")
            for i in critical:
                console.print(f"  • {i.message}")
                if i.suggested_action:
                    console.print(f"    建议: {i.suggested_action}")

        if warning:
            console.print("")
            console.print("[yellow][bold]警告项:[/bold][/yellow]")
            for i in warning:
                console.print(f"  • {i.message}")

        console.print("")
        console.print("[bold]生成报告...[/bold]")

        report_path = output_dir / f"{base_name}_复核报告.md"
        md_exporter = MarkdownExporter()
        md_exporter.export_report(
            output_path=report_path,
            validation_result=validation_result,
            comparison_result=comparison_result,
            simulation_result=simulation_result,
            kiln=kiln_params,
            recipe=recipe_params,
            planned_curve=planned_curve,
            measured_curve=measured_curve,
        )
        console.print(f"  [green]✓[/green] Markdown报告: {report_path}")

        adj_generator = AdjustmentGenerator(kiln_params, recipe_params)
        correction_curve = adj_generator.generate_correction_curve(
            original_curve=planned_curve,
            validation_result=validation_result,
            comparison_result=comparison_result
        )

        correction_path = output_dir / f"{base_name}_修正曲线.csv"
        CSVExporter.export_correction_curve(correction_path, correction_curve)
        console.print(f"  [green]✓[/green] 修正曲线CSV: {correction_path}")

        console.print("")
        console.print(Panel("[green][bold]复核完成！[/bold][/green]"))

    except Exception as e:
        console.print(f"[red]✗[/red] 错误: {e}")
        import traceback
        traceback.print_exc()
        raise click.Abort()


@main.command()
@click.argument('planned_json', type=click.Path(exists=True, path_type=Path))
@click.option('--recipe', '-r', required=True, type=click.Path(exists=True, path_type=Path), help='配方JSON文件')
@click.option('--kiln', '-k', required=True, type=click.Path(exists=True, path_type=Path), help='窑炉参数JSON文件')
@click.option('--output', '-o', type=click.Path(path_type=Path), help='输出模拟结果CSV')
def simulate(planned_json: Path, recipe: Path, kiln: Path, output: Optional[Path]):
    """运行热惯性模拟

    PLANNED_JSON: 计划曲线JSON文件路径
    """
    console.print(Panel("[bold blue]热惯性模拟[/bold blue]"))

    try:
        kiln_params = ConfigurationLoader.load_kiln_parameters(kiln)
        recipe_params = ConfigurationLoader.load_recipe(recipe)

        plan_parser = PlanCurveParser()
        planned_curve = plan_parser.parse_json_file(planned_json)

        console.print(f"[green]✓[/green] 窑炉: {kiln_params.name}")
        console.print(f"[green]✓[/green] 配方: {recipe_params.name}")
        console.print(f"[green]✓[/green] 计划曲线: {planned_curve.recipe_name}")

        console.print("")
        console.print("运行模拟...")

        simulator = FullCurveSimulator(kiln_params, recipe_params)
        simulation_result = simulator.simulate_planned_curve(planned_curve)

        console.print(f"[green]✓[/green] 模拟完成")
        console.print(f"  模拟时长: {simulation_result.time_points[-1]:.1f} 分钟")
        console.print(f"  数据点数: {len(simulation_result.simulated_temperatures)}")

        if simulation_result.core_surface_diff:
            max_diff = max(abs(d) for d in simulation_result.core_surface_diff)
            avg_diff = sum(abs(d) for d in simulation_result.core_surface_diff) / len(simulation_result.core_surface_diff)
            console.print(f"  最大表里温差: {max_diff:.2f} °C")
            console.print(f"  平均表里温差: {avg_diff:.2f} °C")

        if simulation_result.lag_times:
            max_lag = max(simulation_result.lag_times)
            console.print(f"  最大滞后时间: {max_lag:.2f} 分钟")

        thermal_work = ThermalWorkCalculator.calculate_total_thermal_work(
            planned_curve, kiln_params
        )
        console.print("")
        console.print("[bold]热功分析:[/bold]")
        console.print(f"  总加热能量: {thermal_work['total_heating_energy_kj']:.1f} kJ")
        console.print(f"  总保温能量: {thermal_work['total_hold_energy_kj']:.1f} kJ")
        console.print(f"  总输入能量: {thermal_work['total_input_energy_kj']:.1f} kJ")
        console.print(f"  估算效率: {thermal_work['estimated_efficiency']:.1%}")

        if output:
            core_temps = None
            if simulation_result.core_surface_diff and len(simulation_result.core_surface_diff) == len(simulation_result.simulated_temperatures):
                core_temps = [
                    simulation_result.simulated_temperatures[i] + simulation_result.core_surface_diff[i]
                    for i in range(len(simulation_result.simulated_temperatures))
                ]

            CSVExporter.export_detailed_curve(
                output_path=output,
                time_points=simulation_result.time_points,
                temperatures=simulation_result.simulated_temperatures,
                core_temps=core_temps
            )
            console.print(f"[green]✓[/green] 模拟结果已保存到: {output}")

    except Exception as e:
        console.print(f"[red]✗[/red] 错误: {e}")
        import traceback
        traceback.print_exc()
        raise click.Abort()


@main.command()
@click.option('--output-dir', '-o', type=click.Path(path_type=Path), default=Path('.'), help='输出目录')
def examples(output_dir: Path):
    """生成示例配置文件"""
    console.print(Panel("[bold blue]生成示例配置[/bold blue]"))

    try:
        output_dir.mkdir(parents=True, exist_ok=True)

        import json

        kiln_example = {
            "name": "小型电窑 0.06m³",
            "max_temperature": 1320.0,
            "chamber_volume": 60.0,
            "power_rating": 6.0,
            "thermal_inertia_factor": 2.5,
            "max_heating_rate": 8.0,
            "max_cooling_rate": 5.0,
            "sensor_accuracy": 2.0,
            "heating_elements_count": 4
        }

        kiln_path = output_dir / "示例窑炉.json"
        with open(kiln_path, 'w', encoding='utf-8') as f:
            json.dump(kiln_example, f, ensure_ascii=False, indent=2)
        console.print(f"[green]✓[/green] 窑炉参数示例: {kiln_path}")

        recipe_example = {
            "name": "中温釉烧 - 艺术瓷",
            "firing_type": "glaze",
            "target_temperature": 1240.0,
            "total_thickness": 1.5,
            "max_allowed_heating_rate": 4.0,
            "notes": "适用于1-2cm厚的艺术瓷器皿",
            "body": {
                "name": "高白泥",
                "thickness_range": [0.5, 3.0],
                "thermal_conductivity": 1.2,
                "porosity": 0.25,
                "recommended_bisque_temp": 980.0,
                "critical_cooling_rate": 2.5
            },
            "glaze": {
                "name": "透明釉",
                "maturing_temp_range": [1220.0, 1260.0],
                "hold_time_recommended": 30.0,
                "expansion_coefficient": 5.2,
                "is_matte": false
            }
        }

        recipe_path = output_dir / "示例配方.json"
        with open(recipe_path, 'w', encoding='utf-8') as f:
            json.dump(recipe_example, f, ensure_ascii=False, indent=2)
        console.print(f"[green]✓[/green] 配方示例: {recipe_path}")

        import csv
        from datetime import datetime, timedelta

        csv_path = output_dir / "示例温度记录.csv"
        start_time = datetime(2026, 5, 1, 8, 0, 0)

        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["时间", "温度(°C)", "传感器"])

            current_temp = 25.0
            total_minutes = 0

            phases = [
                (180, 4.0),
                (120, 5.0),
                (60, 2.0),
                (30, 0.0),
                (120, -2.0),
            ]

            for duration, rate in phases:
                for _ in range(duration):
                    time_str = (start_time + timedelta(minutes=total_minutes)).strftime("%Y-%m-%d %H:%M:%S")
                    writer.writerow([time_str, f"{current_temp:.1f}", "0"])

                    current_temp += rate
                    total_minutes += 1

        console.print(f"[green]✓[/green] 温度记录示例: {csv_path}")

        console.print("")
        console.print("[bold]使用示例:[/bold]")
        console.print(f"  1. 生成计划曲线: kiln-validator generate {recipe_path} {kiln_path} -o 计划曲线.json")
        console.print(f"  2. 运行复核: kiln-validator validate {csv_path} -r {recipe_path} -k {kiln_path}")

    except Exception as e:
        console.print(f"[red]✗[/red] 错误: {e}")
        raise click.Abort()


if __name__ == "__main__":
    main()
