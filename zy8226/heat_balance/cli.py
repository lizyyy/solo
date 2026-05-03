import argparse
import sys
from pathlib import Path
from datetime import datetime

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .__init__ import __version__
from .readers import DataReader
from .calculator import HydraulicBalanceCalculator
from .exporters import ReportExporter


console = Console()


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="heat-balance",
        description="供热换热站水力平衡复算工具 - 寒潮前预评估",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 使用 sample 数据运行完整分析
  heat-balance run --topology data/topology.csv --sensor data/sensor.jsonl 
    --valve data/valves.yaml --weather data/weather.csv --output reports/

  # 指定项目名称和平衡阈值
  heat-balance run -t data/topology.csv -s data/sensor.jsonl -v data/valves.yaml 
    -w data/weather.csv -o reports/ --name "阳光小区冬季供热" --threshold 0.15
        """,
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    run_parser = subparsers.add_parser(
        "run",
        help="运行水力平衡分析",
        description="读取输入数据并运行完整的水力平衡分析",
    )

    run_parser.add_argument(
        "-t", "--topology",
        required=True,
        help="楼栋拓扑 CSV 文件路径",
        metavar="CSV_FILE",
    )

    run_parser.add_argument(
        "-s", "--sensor",
        required=True,
        help="分户/楼栋流量温度 JSONL 文件路径",
        metavar="JSONL_FILE",
    )

    run_parser.add_argument(
        "-v", "--valve",
        required=True,
        help="阀门设定 YAML 文件路径",
        metavar="YAML_FILE",
    )

    run_parser.add_argument(
        "-w", "--weather",
        required=True,
        help="天气负荷曲线 CSV 文件路径",
        metavar="CSV_FILE",
    )

    run_parser.add_argument(
        "-o", "--output",
        required=True,
        help="输出目录路径（会自动创建）",
        metavar="DIR",
    )

    run_parser.add_argument(
        "-n", "--name",
        default="未命名项目",
        help="项目名称（默认：未命名项目）",
        metavar="NAME",
    )

    run_parser.add_argument(
        "--threshold",
        type=float,
        default=0.15,
        help="平衡判定阈值比例（默认：0.15，即15%%偏差以内为平衡）",
        metavar="FLOAT",
    )

    run_parser.add_argument(
        "--no-console",
        action="store_true",
        help="禁用控制台详细输出",
    )

    demo_parser = subparsers.add_parser(
        "demo",
        help="使用 sample 数据运行演示",
        description="自动使用内置 sample 数据运行完整分析演示",
    )

    demo_parser.add_argument(
        "-o", "--output",
        default="demo_reports",
        help="输出目录路径（默认：demo_reports）",
        metavar="DIR",
    )

    return parser


def validate_files(args) -> bool:
    files_to_check = [
        ("拓扑文件", getattr(args, "topology", None)),
        ("传感器数据文件", getattr(args, "sensor", None)),
        ("阀门设定文件", getattr(args, "valve", None)),
        ("天气负荷文件", getattr(args, "weather", None)),
    ]

    all_valid = True
    for name, path in files_to_check:
        if path and not Path(path).exists():
            console.print(f"[red]错误: {name} 不存在: {path}[/red]")
            all_valid = False

    return all_valid


def run_analysis(args):
    if not validate_files(args):
        sys.exit(1)

    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    if not args.no_console:
        console.print(Panel.fit(
            "[bold blue]供热换热站水力平衡复算工具[/bold blue]\n"
            f"版本: {__version__}",
            title="初始化",
        ))

    reader = DataReader()

    with console.status("[green]正在读取数据...[/green]"):
        units = reader.read_topology(args.topology)
        if not args.no_console:
            console.print(f"✓ 读取拓扑数据: {len(units)} 个单元")

        valves = reader.read_valve_settings(args.valve)
        if not args.no_console:
            console.print(f"✓ 读取阀门设定: {len(valves)} 个阀门")

        sensor_readings = reader.read_sensor_data(args.sensor)
        if not args.no_console:
            console.print(f"✓ 读取传感器数据: {len(sensor_readings)} 条记录")

        weather_points = reader.read_weather_load(args.weather)
        if not args.no_console:
            console.print(f"✓ 读取天气负荷曲线: {len(weather_points)} 个时间点")

        if reader.anomalies:
            console.print(f"\n[yellow]⚠  读取数据时发现 {len(reader.anomalies)} 个异常[/yellow]")

    with console.status("[green]正在进行水力平衡计算...[/green]"):
        calculator = HydraulicBalanceCalculator(
            units=units,
            valves=valves,
            sensor_readings=sensor_readings,
            weather_points=weather_points,
            balance_threshold=args.threshold,
        )

        result = calculator.run_full_analysis(project_name=args.name)

    if not args.no_console:
        summary = result.summary
        console.print("\n[bold]分析摘要[/bold]")

        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("指标")
        table.add_column("数值", justify="right")

        table.add_row("总单元数", str(summary["total_units"]))
        table.add_row("时间片数", str(summary["total_time_slices"]))
        table.add_row("总测量次数", str(summary["total_measurements"]))
        table.add_row("失衡次数", str(summary["unbalanced_count"]))

        ratio = summary["unbalanced_ratio"] * 100
        ratio_str = f"{ratio:.1f}%"
        if ratio > 30:
            ratio_str = f"[red]{ratio_str}[/red]"
        elif ratio > 15:
            ratio_str = f"[yellow]{ratio_str}[/yellow]"
        else:
            ratio_str = f"[green]{ratio_str}[/green]"
        table.add_row("失衡比例", ratio_str)

        table.add_row("有问题单元数", str(summary["units_with_issues_count"]))
        table.add_row("传感器缺失", str(summary["sensor_missing_count"]))
        table.add_row("阀门越界", str(summary["valve_out_of_bounds_count"]))

        console.print(table)

        stats = summary["heat_deficit_stats"]
        if stats["average"] is not None:
            console.print(f"\n[bold]热量缺口统计[/bold]")
            console.print(f"  平均: {stats['average']:.2f} kW")
            console.print(f"  最大: {stats['maximum']:.2f} kW")
            console.print(f"  最小: {stats['minimum']:.2f} kW")

    with console.status("[green]正在导出报告...[/green]"):
        exporter = ReportExporter(result)
        exported_files = exporter.export_all(str(output_path))

    if not args.no_console:
        console.print("\n[bold green]✓ 报告导出完成[/bold green]")
        for name, path in exported_files.items():
            console.print(f"  {name}: {path}")

        console.print(f"\n[bold]提示[/bold]")
        console.print(f"- 用文本编辑器打开 imbalance_report.md 查看详细分析")
        console.print(f"- 用 Excel 或文本编辑器打开 issues.csv 查看问题列表")
        console.print(f"- 用浏览器打开 hydraulic_balance_charts.html 查看交互式图表")

    return exported_files


def run_demo(args):
    script_dir = Path(__file__).parent.parent
    sample_dir = script_dir / "sample_data"

    if not sample_dir.exists():
        console.print(f"[red]错误: Sample 数据目录不存在: {sample_dir}[/red]")
        console.print("请确保已正确安装 heat-balance-calculator 包")
        sys.exit(1)

    topology_file = sample_dir / "topology.csv"
    sensor_file = sample_dir / "sensor.jsonl"
    valve_file = sample_dir / "valves.yaml"
    weather_file = sample_dir / "weather.csv"

    class DemoArgs:
        topology = str(topology_file)
        sensor = str(sensor_file)
        valve = str(valve_file)
        weather = str(weather_file)
        output = args.output
        name = "Demo 项目 - 阳光小区供热分析"
        threshold = 0.15
        no_console = False

    console.print(Panel.fit(
        "[bold green]供热换热站水力平衡复算 - 演示模式[/bold green]\n"
        "将使用内置 sample 数据运行完整分析",
        title="Demo 模式",
    ))

    return run_analysis(DemoArgs())


def main():
    parser = create_parser()
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    try:
        if args.command == "run":
            run_analysis(args)
        elif args.command == "demo":
            run_demo(args)
    except KeyboardInterrupt:
        console.print("\n[yellow]操作已取消[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
