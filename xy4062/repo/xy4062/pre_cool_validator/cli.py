"""预冷装车热负荷校验器 CLI

命令行接口，支持:
- init: 初始化/管理货品热参数和车辆配置
- import-plan: 导入装车计划CSV
- simulate: 执行时间步仿真
- check: 执行风险检测
- report: 导出报告
"""

import json
from pathlib import Path
from typing import Optional, Dict

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from pre_cool_validator import __version__
from pre_cool_validator.models import (
    ProductParams,
    VehicleConfig,
    LoadingPlan,
    ProjectConfig,
    RiskType,
    RiskSeverity,
)
from pre_cool_validator.csv_parser import (
    ProductParamsCSVParser,
    VehicleConfigCSVParser,
    LoadingPlanCSVParser,
    ProjectConfigIO,
    CSVParseError,
)
from pre_cool_validator.heat_calculator import HeatCalculator
from pre_cool_validator.risk_engine import RiskEngine
from pre_cool_validator.reporter import ReportExporter


console = Console()
err_console = Console(stderr=True)


DEFAULT_CONFIG_DIR = Path.home() / ".pre_cool_validator"
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "config.json"
DEFAULT_WORK_DIR = Path.cwd() / "pre_cool_work"


def get_config() -> ProjectConfig:
    """获取全局配置"""
    if DEFAULT_CONFIG_FILE.exists():
        return ProjectConfigIO.load(DEFAULT_CONFIG_FILE)
    return ProjectConfig()


def save_config(config: ProjectConfig) -> None:
    """保存全局配置"""
    DEFAULT_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    ProjectConfigIO.save(config, DEFAULT_CONFIG_FILE)


def print_header(title: str) -> None:
    """打印标题栏"""
    console.print(Panel(f"[bold blue]{title}[/bold blue]", expand=False))


def print_success(message: str) -> None:
    """打印成功消息"""
    console.print(f"[green]✓ {message}[/green]")


def print_error(message: str) -> None:
    """打印错误消息"""
    err_console.print(f"[red]✗ {message}[/red]")


def print_warning(message: str) -> None:
    """打印警告消息"""
    console.print(f"[yellow]⚠ {message}[/yellow]")


def print_info(message: str) -> None:
    """打印信息消息"""
    console.print(f"[cyan]ℹ {message}[/cyan]")


@click.group()
@click.version_option(__version__, '-v', '--version')
@click.pass_context
def main(ctx):
    """预冷装车热负荷校验器

    用于冷链仓配工程师的本地科学计算工具，用于：
    - 管理货品热参数和车辆配置
    - 导入装车计划
    - 仿真温度变化和热负荷
    - 检测预冷风险
    - 导出分析报告
    """
    ctx.ensure_object(dict)
    ctx.obj['config'] = get_config()


@main.command()
@click.option('--products', '-p', type=click.Path(exists=True, dir_okay=False),
              help='货品参数CSV文件路径')
@click.option('--vehicles', '-v', type=click.Path(exists=True, dir_okay=False),
              help='车辆配置CSV文件路径')
@click.option('--reset', '-r', is_flag=True, help='重置所有配置')
@click.pass_context
def init(ctx, products, vehicles, reset):
    """初始化或更新货品热参数和车辆配置

    从CSV文件导入货品热参数和车辆配置到全局配置。
    如果不提供 --reset，则先清除所有配置。
    """
    print_header("初始化配置")

    config = ctx.obj['config']

    if reset:
        config = ProjectConfig()
        print_info("已重置所有配置")

    if products:
        try:
            products_path = Path(products)
            parsed_products = ProductParamsCSVParser.parse(products_path)

            for p in parsed_products:
                config.add_product(p)

            print_success(f"已导入 {len(parsed_products)} 个货品参数")
        except CSVParseError as e:
            print_error(f"解析货品参数CSV失败: {e}")
            return
        except Exception as e:
            print_error(f"导入货品参数失败: {e}")
            return

    if vehicles:
        try:
            vehicles_path = Path(vehicles)
            parsed_vehicles = VehicleConfigCSVParser.parse(vehicles_path)

            for v in parsed_vehicles:
                config.add_vehicle(v)

            print_success(f"已导入 {len(parsed_vehicles)} 个车辆配置")
        except CSVParseError as e:
            print_error(f"解析车辆配置CSV失败: {e}")
            return
        except Exception as e:
            print_error(f"导入车辆配置失败: {e}")
            return

    save_config(config)
    print_success(f"配置已保存到: {DEFAULT_CONFIG_FILE}")

    table = Table(title="当前配置概览")
    table.add_column("类型", style="cyan")
    table.add_column("数量", style="green")
    table.add_row("货品参数", str(len(config.products)))
    table.add_row("车辆配置", str(len(config.vehicles)))
    console.print(table)


@main.command(name='list-config')
@click.option('--type', '-t', type=click.Choice(['all', 'products', 'vehicles']),
              default='all', help='列出类型')
@click.pass_context
def list_config(ctx, type):
    """列出当前配置"""
    print_header("当前配置")

    config = ctx.obj['config']

    if type in ['all', 'products']:
        if config.products:
            table = Table(title="货品参数")
            table.add_column("ID", style="cyan")
            table.add_column("名称", style="green")
            table.add_column("比热容(kJ/kg·°C)")
            table.add_column("密度(kg/m³)")
            table.add_column("目标温度(°C)")

            for pid, p in config.products.items():
                table.add_row(
                    p.product_id,
                    p.product_name,
                    f"{p.specific_heat:.2f}",
                    f"{p.density:.0f}",
                    f"{p.default_target_temp:.1f}",
                )
            console.print(table)
        else:
            print_info("暂无货品参数配置")

    if type in ['all', 'vehicles']:
        if config.vehicles:
            table = Table(title="车辆配置")
            table.add_column("ID", style="cyan")
            table.add_column("名称", style="green")
            table.add_column("容积(m³)")
            table.add_column("制冷量(kW)")
            table.add_column("最大开门(分)")

            for vid, v in config.vehicles.items():
                table.add_row(
                    v.vehicle_id,
                    v.vehicle_name,
                    f"{v.cargo_volume:.1f}",
                    f"{v.cooling_capacity:.1f}",
                    f"{v.max_door_open_duration}",
                )
            console.print(table)
        else:
            print_info("暂无车辆配置")


@main.command(name='import-plan')
@click.argument('csv_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--output', '-o', type=click.Path(file_okay=False),
              help='输出目录，默认创建 pre_cool_work 目录')
@click.option('--name', '-n', help='计划名称')
@click.pass_context
def import_plan(ctx, csv_file, output, name):
    """导入装车计划CSV

    解析装车计划CSV文件并保存到工作目录。
    """
    print_header("导入装车计划")

    csv_path = Path(csv_file)

    try:
        plan = LoadingPlanCSVParser.parse(csv_path)

        if name:
            plan.plan_name = name

        print_success(f"成功解析装车计划: {plan.plan_id}")

        work_dir = Path(output) if output else DEFAULT_WORK_DIR
        work_dir.mkdir(parents=True, exist_ok=True)

        plan_file = work_dir / "loading_plan.json"
        with open(plan_file, 'w', encoding='utf-8') as f:
            json.dump(plan.model_dump(mode='json'), f, ensure_ascii=False, indent=2, default=str)

        print_success(f"计划已保存到: {plan_file}")

        table = Table(title="装车计划概览")
        table.add_column("项目", style="cyan")
        table.add_column("值", style="green")
        table.add_row("计划ID", plan.plan_id)
        table.add_row("计划名称", plan.plan_name or "未设置")
        table.add_row("车辆ID", plan.vehicle_id)
        table.add_row("环境温度", f"{plan.ambient_temp} °C")
        table.add_row("总预冷时间", f"{plan.total_precool_time} 分钟")
        table.add_row("开门时长", f"{plan.door_open_duration} 分钟")
        table.add_row("批次数量", str(len(plan.batches)))
        table.add_row("总货物体积", f"{plan.get_total_volume():.2f} m³")
        table.add_row("总货品质量", f"{plan.get_total_mass():.0f} kg")
        console.print(table)

        if plan.batches:
            batch_table = Table(title="批次详情")
            batch_table.add_column("批次ID", style="cyan")
            batch_table.add_column("货品", style="green")
            batch_table.add_column("体积(m³)")
            batch_table.add_column("质量(kg)")
            batch_table.add_column("初温(°C)")
            batch_table.add_column("目标(°C)")

            for batch in plan.batches:
                batch_table.add_row(
                    batch.batch_id,
                    batch.product_name,
                    f"{batch.volume:.2f}",
                    f"{batch.mass:.0f}",
                    f"{batch.initial_temp:.1f}",
                    f"{batch.target_temp:.1f}",
                )
            console.print(batch_table)

    except CSVParseError as e:
        print_error(f"解析装车计划失败: {e}")
        return
    except Exception as e:
        print_error(f"导入装车计划失败: {e}")
        return


@main.command()
@click.option('--work-dir', '-w', type=click.Path(file_okay=False),
              help='工作目录，默认使用当前目录下的 pre_cool_work')
@click.option('--plan', '-p', type=click.Path(exists=True, dir_okay=False),
              help='装车计划JSON文件路径')
@click.option('--time-step', '-t', type=float, default=1.0,
              help='时间步长（分钟），默认1分钟')
@click.pass_context
def simulate(ctx, work_dir, plan, time_step):
    """执行时间步仿真

    按时间步计算各批次温度变化和剩余冷量。
    """
    print_header("执行仿真")

    config = ctx.obj['config']

    work_path = Path(work_dir) if work_dir else DEFAULT_WORK_DIR

    if plan:
        plan_path = Path(plan)
    else:
        plan_path = work_path / "loading_plan.json"

    if not plan_path.exists():
        print_error(f"找不到装车计划文件: {plan_path}")
        print_info("请先使用 import-plan 命令导入装车计划")
        return

    try:
        with open(plan_path, 'r', encoding='utf-8') as f:
            plan_data = json.load(f)
        loading_plan = LoadingPlan.model_validate(plan_data)
    except Exception as e:
        print_error(f"加载装车计划失败: {e}")
        return

    vehicle = config.get_vehicle(loading_plan.vehicle_id)
    if not vehicle:
        print_error(f"找不到车辆配置: {loading_plan.vehicle_id}")
        print_info("请先使用 init 命令导入车辆配置")
        return

    missing_products = []
    for batch in loading_plan.batches:
        if not config.get_product(batch.product_id):
            missing_products.append(batch.product_id)

    if missing_products:
        print_error(f"找不到以下货品参数: {', '.join(missing_products)}")
        print_info("请先使用 init 命令导入货品参数")
        return

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True
    ) as progress:
        task = progress.add_task("正在执行时间步仿真...", total=None)

        calculator = HeatCalculator(time_step_minutes=time_step)
        simulation = calculator.simulate(
            plan=loading_plan,
            vehicle=vehicle,
            products=config.products,
        )

    if not simulation.success:
        print_error(f"仿真失败: {simulation.error_message}")
        return

    print_success("仿真完成")

    work_path.mkdir(parents=True, exist_ok=True)
    sim_file = work_path / "simulation_result.json"
    with open(sim_file, 'w', encoding='utf-8') as f:
        json.dump(simulation.model_dump(mode='json'), f, ensure_ascii=False, indent=2, default=str)

    print_success(f"仿真结果已保存到: {sim_file}")

    table = Table(title="仿真结果概览")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")

    total_demand = (
        simulation.total_cooling_required
        + simulation.door_heat_infiltration
        + simulation.ambient_heat_infiltration
        + simulation.respiration_heat_total
    )

    table.add_row("总需冷量", f"{total_demand:.2f} kJ")
    table.add_row("总供冷量", f"{simulation.total_cooling_provided:.2f} kJ")

    surplus_status = "盈余" if simulation.cooling_surplus >= 0 else "不足"
    surplus_color = "green" if simulation.cooling_surplus >= 0 else "red"
    table.add_row(
        "冷量盈余",
        f"[{surplus_color}]{simulation.cooling_surplus:.2f} kJ ({surplus_status})[/{surplus_color}]"
    )
    table.add_row("开门热侵入", f"{simulation.door_heat_infiltration:.2f} kJ")
    table.add_row("箱体热侵入", f"{simulation.ambient_heat_infiltration:.2f} kJ")
    table.add_row("呼吸热", f"{simulation.respiration_heat_total:.2f} kJ")

    console.print(table)

    if simulation.batch_results:
        batch_table = Table(title="批次仿真结果")
        batch_table.add_column("批次ID", style="cyan")
        batch_table.add_column("货品", style="green")
        batch_table.add_column("初温(°C)")
        batch_table.add_column("终温(°C)")
        batch_table.add_column("目标(°C)")
        batch_table.add_column("达标")
        batch_table.add_column("达标时间(分)")

        for br in simulation.batch_results:
            status = "✅" if br.reached_target else "❌"
            time_str = f"{br.time_to_target:.1f}" if br.time_to_target else "-"

            final_temp_color = "green" if br.reached_target else "red"

            batch_table.add_row(
                br.batch_id,
                br.product_name,
                f"{br.initial_temp:.1f}",
                f"[{final_temp_color}]{br.final_temp:.1f}[/{final_temp_color}]",
                f"{br.target_temp:.1f}",
                status,
                time_str,
            )
        console.print(batch_table)


@main.command()
@click.option('--work-dir', '-w', type=click.Path(file_okay=False),
              help='工作目录，默认使用当前目录下的 pre_cool_work')
@click.option('--simulation', '-s', type=click.Path(exists=True, dir_okay=False),
              help='仿真结果JSON文件路径')
@click.pass_context
def check(ctx, work_dir, simulation):
    """执行风险检测

    标出预冷不足、制冷量不够、开门过久、目标温度冲突和批次超时风险。
    """
    print_header("风险检测")

    config = ctx.obj['config']

    work_path = Path(work_dir) if work_dir else DEFAULT_WORK_DIR

    if simulation:
        sim_path = Path(simulation)
    else:
        sim_path = work_path / "simulation_result.json"

    if not sim_path.exists():
        print_error(f"找不到仿真结果文件: {sim_path}")
        print_info("请先使用 simulate 命令执行仿真")
        return

    plan_path = work_path / "loading_plan.json"
    if not plan_path.exists():
        print_error(f"找不到装车计划文件: {plan_path}")
        return

    try:
        with open(sim_path, 'r', encoding='utf-8') as f:
            sim_data = json.load(f)
        simulation_result = __import__('pre_cool_validator.models', fromlist=['SimulationResult']).SimulationResult.model_validate(sim_data)

        with open(plan_path, 'r', encoding='utf-8') as f:
            plan_data = json.load(f)
        loading_plan = __import__('pre_cool_validator.models', fromlist=['LoadingPlan']).LoadingPlan.model_validate(plan_data)
    except Exception as e:
        print_error(f"加载数据失败: {e}")
        return

    vehicle = config.get_vehicle(loading_plan.vehicle_id)
    if not vehicle:
        print_error(f"找不到车辆配置: {loading_plan.vehicle_id}")
        return

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True
    ) as progress:
        task = progress.add_task("正在执行风险检测...", total=None)

        risk_engine = RiskEngine()
        risk_report = risk_engine.evaluate(
            simulation=simulation_result,
            plan=loading_plan,
            vehicle=vehicle,
            products=config.products,
        )

    print_success("风险检测完成")

    work_path.mkdir(parents=True, exist_ok=True)
    risk_file = work_path / "risk_report.json"
    with open(risk_file, 'w', encoding='utf-8') as f:
        json.dump(risk_report.model_dump(mode='json'), f, ensure_ascii=False, indent=2, default=str)

    print_success(f"风险报告已保存到: {risk_file}")

    status_badge = "✅ 通过" if risk_report.overall_pass else "❌ 不通过"
    status_color = "green" if risk_report.overall_pass else "red"

    console.print(f"\n[bold]整体状态: [/{bold}][{status_color}]{status_badge}[/{status_color}]")

    summary_table = Table(title="风险统计")
    summary_table.add_column("风险等级", style="cyan")
    summary_table.add_column("数量", style="green")
    summary_table.add_row("🔴 高风险", str(risk_report.high_severity))
    summary_table.add_row("🟡 中风险", str(risk_report.medium_severity))
    summary_table.add_row("🟢 低风险", str(risk_report.low_severity))
    summary_table.add_row("**总计**", str(risk_report.total_risks))
    console.print(summary_table)

    if risk_report.risks:
        console.print("\n[bold]风险详情:[/bold]")

        risk_type_labels = {
            RiskType.PRECOOL_INSUFFICIENT: "预冷不足",
            RiskType.COOLING_CAPACITY_INSUFFICIENT: "制冷量不够",
            RiskType.DOOR_OPEN_TOO_LONG: "开门过久",
            RiskType.TARGET_TEMP_CONFLICT: "目标温度冲突",
            RiskType.BATCH_TIMEOUT: "批次超时",
            RiskType.AMBIENT_TEMP_HIGH: "环境温度过高",
        }

        severity_colors = {
            RiskSeverity.HIGH: "red",
            RiskSeverity.MEDIUM: "yellow",
            RiskSeverity.LOW: "green",
        }

        for i, risk in enumerate(risk_report.risks, 1):
            type_label = risk_type_labels.get(risk.risk_type, str(risk.risk_type))
            severity_color = severity_colors.get(risk.severity, "white")

            console.print(f"\n[bold #{i}: {type_label}[/bold]")
            console.print(f"  严重程度: [{severity_color}]{risk.severity.value}[/{severity_color}]")
            console.print(f"  描述: {risk.message}")

            if risk.affected_batches:
                console.print(f"  受影响批次: {', '.join(risk.affected_batches)}")

            if risk.suggestion:
                console.print(f"  建议: {risk.suggestion}")
    else:
        print_success("未检测到任何风险！")


@main.command()
@click.option('--work-dir', '-w', type=click.Path(file_okay=False),
              help='工作目录，默认使用当前目录下的 pre_cool_work')
@click.option('--output', '-o', type=click.Path(file_okay=False),
              help='报告输出目录，默认使用工作目录')
@click.option('--prefix', '-p', help='报告文件名前缀')
@click.option('--format', '-f', type=click.Choice(['all', 'md', 'csv']),
              default='all', help='报告格式')
@click.pass_context
def report(ctx, work_dir, output, prefix, format):
    """导出报告

    导出Markdown和CSV格式的报告。
    """
    print_header("导出报告")

    config = ctx.obj['config']

    work_path = Path(work_dir) if work_dir else DEFAULT_WORK_DIR
    output_path = Path(output) if output else work_path

    sim_path = work_path / "simulation_result.json"
    if not sim_path.exists():
        print_error(f"找不到仿真结果文件: {sim_path}")
        print_info("请先使用 simulate 命令执行仿真")
        return

    try:
        with open(sim_path, 'r', encoding='utf-8') as f:
            sim_data = json.load(f)
        simulation_result = __import__('pre_cool_validator.models', fromlist=['SimulationResult']).SimulationResult.model_validate(sim_data)
    except Exception as e:
        print_error(f"加载仿真结果失败: {e}")
        return

    plan_path = work_path / "loading_plan.json"
    loading_plan = None
    if plan_path.exists():
        try:
            with open(plan_path, 'r', encoding='utf-8') as f:
                plan_data = json.load(f)
            loading_plan = __import__('pre_cool_validator.models', fromlist=['LoadingPlan']).LoadingPlan.model_validate(plan_data)
        except Exception as e:
            print_warning(f"加载装车计划失败: {e}")

    risk_path = work_path / "risk_report.json"
    risk_report = None
    if risk_path.exists():
        try:
            with open(risk_path, 'r', encoding='utf-8') as f:
                risk_data = json.load(f)
            risk_report = __import__('pre_cool_validator.models', fromlist=['RiskReport']).RiskReport.model_validate(risk_data)
        except Exception as e:
            print_warning(f"加载风险报告失败: {e}")

    vehicle = None
    if loading_plan:
        vehicle = config.get_vehicle(loading_plan.vehicle_id)

    exporter = ReportExporter()

    output_path.mkdir(parents=True, exist_ok=True)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True
    ) as progress:
        task = progress.add_task("正在导出报告...", total=None)

        exported_files = exporter.export_all(
            output_dir=output_path,
            simulation=simulation_result,
            risk_report=risk_report,
            plan=loading_plan,
            vehicle=vehicle,
            prefix=prefix,
        )

    print_success("报告导出完成")

    table = Table(title="已导出的文件")
    table.add_column("类型", style="cyan")
    table.add_column("文件路径", style="green")

    for file_type, file_path in exported_files.items():
        if format == 'md' and file_type != 'markdown':
            continue
        if format == 'csv' and file_type == 'markdown':
            continue
        table.add_row(file_type, str(file_path))

    console.print(table)


if __name__ == '__main__':
    main()
