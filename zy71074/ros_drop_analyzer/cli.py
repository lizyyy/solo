import os
import sys
import traceback
from datetime import datetime

import click
from rich.console import Console
from rich.panel import Panel

from . import __version__
from .config import AnalyzerConfig
from .types import ExitCode, SensorType
from .bag_parser import BagParser
from .drop_analyzer import DropAnalyzer
from .report_generator import ReportGenerator

console = Console()


def print_banner():
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║                    ROS 传感器掉帧分析工具 v{__version__}           ║
║          ROS Sensor Frame Drop Analysis CLI Tool            ║
╚══════════════════════════════════════════════════════════════╝
    """
    console.print(f"[cyan]{banner}[/cyan]")


def validate_inputs(ctx, param, value):
    if value and not os.path.exists(value):
        raise click.BadParameter(f"文件不存在: {value}")
    return value


@click.command()
@click.argument("bag_file", type=click.Path(exists=True))
@click.option(
    "--output-dir", "-o",
    default="./output",
    type=click.Path(),
    help="输出目录 (默认: ./output)",
)
@click.option(
    "--config", "-c",
    type=click.Path(exists=True),
    callback=validate_inputs,
    help="YAML 配置文件路径",
)
@click.option(
    "--topic", "-t",
    multiple=True,
    help="指定要分析的 topic (可多次使用)",
)
@click.option(
    "--lidar-threshold",
    type=float,
    help="雷达掉帧阈值 (秒), 默认 0.2s",
)
@click.option(
    "--camera-threshold",
    type=float,
    help="相机掉帧阈值 (秒), 默认 0.1s",
)
@click.option(
    "--imu-threshold",
    type=float,
    help="IMU 掉帧阈值 (秒), 默认 0.01s",
)
@click.option(
    "--lidar-fps",
    type=float,
    help="雷达期望帧率 (Hz), 默认 10Hz",
)
@click.option(
    "--camera-fps",
    type=float,
    help="相机期望帧率 (Hz), 默认 30Hz",
)
@click.option(
    "--imu-fps",
    type=float,
    help="IMU 期望帧率 (Hz), 默认 200Hz",
)
@click.option(
    "--start-time",
    type=float,
    help="分析起始时间戳 (秒)",
)
@click.option(
    "--end-time",
    type=float,
    help="分析结束时间戳 (秒)",
)
@click.option(
    "--topic-alias",
    multiple=True,
    help="Topic 别名映射, 格式: 原名:新名 (可多次使用)",
)
@click.option(
    "--no-json",
    is_flag=True,
    help="不导出 JSON 报告",
)
@click.option(
    "--no-markdown",
    is_flag=True,
    help="不导出 Markdown 报告",
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="详细输出模式",
)
@click.version_option(__version__, prog_name="ros-drop-analyzer")
def main(
    bag_file,
    output_dir,
    config,
    topic,
    lidar_threshold,
    camera_threshold,
    imu_threshold,
    lidar_fps,
    camera_fps,
    imu_fps,
    start_time,
    end_time,
    topic_alias,
    no_json,
    no_markdown,
    verbose,
):
    """
    ROS 传感器掉帧分析工具 - 分析 rosbag 中雷达、相机和 IMU 的帧丢失情况

    BAG_FILE: rosbag 文件路径或 rosbag 摘要文本文件
    """
    print_banner()

    try:
        analyzer_config = _build_config(
            bag_file=bag_file,
            output_dir=output_dir,
            config_file=config,
            topics=list(topic),
            lidar_threshold=lidar_threshold,
            camera_threshold=camera_threshold,
            imu_threshold=imu_threshold,
            lidar_fps=lidar_fps,
            camera_fps=camera_fps,
            imu_fps=imu_fps,
            start_time=start_time,
            end_time=end_time,
            topic_aliases=list(topic_alias),
            no_json=no_json,
            no_markdown=no_markdown,
            verbose=verbose,
        )
    except Exception as e:
        console.print(f"[red]✗ 配置错误: {e}[/red]")
        if verbose:
            traceback.print_exc()
        sys.exit(ExitCode.INVALID_INPUT.value)

    try:
        analyzer_config.ensure_output_dir()
        console.print(f"[blue]ℹ 输出目录: {analyzer_config.output_dir}[/blue]")

        console.print("\n[yellow]━" * 60)
        console.print("[yellow]步骤 1/3: 解析 rosbag 数据...[/yellow]")
        parser = BagParser(analyzer_config)
        sensor_data = parser.parse()

        if not sensor_data:
            console.print("[red]✗ 未找到任何传感器数据[/red]")
            sys.exit(ExitCode.NO_DATA_FOUND.value)

        console.print(f"[green]✓ 成功解析 {len(sensor_data)} 个传感器的数据[/green]")
        for name, frames in sensor_data.items():
            console.print(f"  - {name}: {len(frames)} 帧")

        invalid_records = parser.get_invalid_records()
        if invalid_records:
            console.print(f"[yellow]⚠ 发现 {len(invalid_records)} 条无法解析的记录[/yellow]")
            for record in invalid_records[:5]:
                console.print(f"  - 第 {record.get('line_number', '?')} 行: {record.get('error', '未知错误')}")

        console.print("\n[yellow]━" * 60)
        console.print("[yellow]步骤 2/3: 分析掉帧情况...[/yellow]")
        analyzer = DropAnalyzer(analyzer_config)
        report = analyzer.analyze(sensor_data)

        for record in invalid_records:
            report.errors.append(
                f"无法解析的记录 - 第 {record.get('line_number', '?')} 行: {record.get('error', '未知错误')}"
            )

        console.print("[green]✓ 掉帧分析完成[/green]")

        console.print("\n[yellow]━" * 60)
        console.print("[yellow]步骤 3/3: 生成报告...[/yellow]")
        reporter = ReportGenerator(analyzer_config)

        reporter.print_console_summary(report)

        if analyzer_config.export_json:
            reporter.export_json(report)

        if analyzer_config.export_markdown:
            reporter.export_markdown(report)

        console.print("\n[green]━" * 60)
        console.print("[green]✓ 分析完成![/green]")

        total_drops = sum(s.total_missing_frames for s in report.sensors.values())
        if total_drops > 0:
            console.print(f"[yellow]⚠ 检测到总共 {total_drops} 帧丢失[/yellow]")
            sys.exit(1)
        else:
            console.print("[green]✓ 未检测到明显掉帧[/green]")
            sys.exit(ExitCode.SUCCESS.value)

    except FileNotFoundError as e:
        console.print(f"[red]✗ 文件错误: {e}[/red]")
        if verbose:
            traceback.print_exc()
        sys.exit(ExitCode.BAG_READ_ERROR.value)
    except Exception as e:
        console.print(f"[red]✗ 分析错误: {e}[/red]")
        if verbose:
            traceback.print_exc()
        sys.exit(ExitCode.ANALYSIS_ERROR.value)


def _build_config(**kwargs) -> AnalyzerConfig:
    if kwargs.get("config_file"):
        config = AnalyzerConfig.from_yaml(kwargs["config_file"])
        config.input_file = kwargs["bag_file"]
    else:
        config = AnalyzerConfig(input_file=kwargs["bag_file"])

    config.output_dir = kwargs["output_dir"]
    config.specific_topics = kwargs["topics"]
    config.start_time = kwargs["start_time"]
    config.end_time = kwargs["end_time"]
    config.export_json = not kwargs["no_json"]
    config.export_markdown = not kwargs["no_markdown"]
    config.verbose = kwargs["verbose"]

    if kwargs["lidar_threshold"]:
        config.thresholds[SensorType.LIDAR] = kwargs["lidar_threshold"]
    if kwargs["camera_threshold"]:
        config.thresholds[SensorType.CAMERA] = kwargs["camera_threshold"]
    if kwargs["imu_threshold"]:
        config.thresholds[SensorType.IMU] = kwargs["imu_threshold"]

    if kwargs["lidar_fps"]:
        config.expected_fps[SensorType.LIDAR] = kwargs["lidar_fps"]
    if kwargs["camera_fps"]:
        config.expected_fps[SensorType.CAMERA] = kwargs["camera_fps"]
    if kwargs["imu_fps"]:
        config.expected_fps[SensorType.IMU] = kwargs["imu_fps"]

    for alias in kwargs["topic_aliases"]:
        if ":" in alias:
            original, new = alias.split(":", 1)
            config.topic_aliases[original] = new

    return config


if __name__ == "__main__":
    main()
