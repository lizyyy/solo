import click
import logging
from pathlib import Path
from typing import Dict, List, Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .models import (
    CameraCheckReport,
    CheckStatus,
    AnomalyReport,
)
from .config import CalibrationRules
from .io import (
    read_all_detections,
    write_calibration_bundle,
    write_failures_csv,
    write_report_md,
)
from .calibrator import CameraCalibrator
from .anomaly_detector import AnomalyDetector
from .report_generator import ReportGenerator

console = Console()
logger = logging.getLogger(__name__)


def setup_logging(verbose: bool):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


@click.group()
@click.version_option()
def cli():
    """工业相机标定包离线复核工具"""
    pass


@cli.command()
@click.option(
    "--input-dir",
    "-i",
    required=True,
    type=click.Path(exists=True, file_okay=False),
    help="输入目录，包含 cameras.csv、calibration_rules.yaml 和 detections/ 子目录",
)
@click.option(
    "--output-dir",
    "-o",
    default="./output",
    type=click.Path(file_okay=False),
    help="输出目录 (默认: ./output)",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    help="显示详细日志",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="覆盖已存在的输出文件",
)
def check(input_dir: str, output_dir: str, verbose: bool, force: bool):
    """
    复核工业相机标定包，生成可下发的标定包和报告。

    输入目录结构:
        input_dir/
        ├── cameras.csv              # 相机设备档案
        ├── calibration_rules.yaml   # 标定规则配置
        └── detections/              # 检测数据目录
            ├── cam01.jsonl
            └── cam02.jsonl
    """
    setup_logging(verbose)

    input_path = Path(input_dir)
    output_path = Path(output_dir)

    cameras_csv = input_path / "cameras.csv"
    rules_yaml = input_path / "calibration_rules.yaml"
    detections_dir = input_path / "detections"

    for required in [cameras_csv, rules_yaml, detections_dir]:
        if not required.exists():
            console.print(f"[red]错误: 缺少必需文件/目录: {required}[/red]")
            return

    output_path.mkdir(parents=True, exist_ok=True)

    console.print(Panel.fit("[bold blue]工业相机标定复核工具[/bold blue]", border_style="blue"))
    console.print()

    with console.status("[bold green]加载配置文件...[/bold green]"):
        try:
            rules = CalibrationRules(str(rules_yaml))
            console.print(f"[green]✓[/green] 加载标定规则: {len(rules.cameras)} 个相机, {len(rules.patterns)} 个标定板配置")
        except Exception as e:
            console.print(f"[red]✗[/red] 加载标定规则失败: {e}")
            return

    with console.status("[bold green]读取检测数据...[/bold green]"):
        try:
            all_frames = read_all_detections(str(detections_dir), rules)
            total_frames = sum(len(frames) for frames in all_frames.values())
            console.print(f"[green]✓[/green] 读取检测数据: {len(all_frames)} 个相机, 共 {total_frames} 帧")
        except Exception as e:
            console.print(f"[red]✗[/red] 读取检测数据失败: {e}")
            return

    with console.status("[bold green]检测异常...[/bold green]"):
        anomaly_detector = AnomalyDetector(rules)
        anomalies = anomaly_detector.detect_all(all_frames)

        total_anomalies = sum(len(anom) for anom in anomalies.values())
        if total_anomalies > 0:
            console.print(f"[yellow]⚠[/yellow] 检测到 {total_anomalies} 个异常")
        else:
            console.print(f"[green]✓[/green] 未检测到异常")

    with console.status("[bold green]执行标定复核...[/bold green]"):
        calibrator = CameraCalibrator(rules)
        camera_reports: Dict[str, CameraCheckReport] = {}

        for camera_id in rules.get_all_camera_ids():
            frames = all_frames.get(camera_id, [])

            if not frames:
                camera_info = rules.get_camera(camera_id)
                serial = camera_info.serial_number if camera_info else "UNKNOWN"
                report = CameraCheckReport(
                    camera_id=camera_id,
                    serial_number=serial,
                    overall_status=CheckStatus.FAIL,
                    warnings=[f"没有找到该相机的检测数据"],
                )
                camera_reports[camera_id] = report
                continue

            first_frame = frames[0]
            camera_info = rules.get_camera(camera_id)
            serial = camera_info.serial_number if camera_info else "UNKNOWN"

            calib_result = calibrator.calibrate(camera_id, frames)

            report = CameraCheckReport(
                camera_id=camera_id,
                serial_number=serial,
                overall_status=CheckStatus.PASS,
                calibration_result=calib_result,
            )

            if calib_result:
                res_check, res_failure = calibrator.check_resolution(
                    camera_id,
                    calib_result.image_width,
                    calib_result.image_height,
                )
                report.check_results.append(res_check)
                if res_failure:
                    report.failures.append(res_failure)
                    report.overall_status = CheckStatus.FAIL

                rep_check, rep_failure = calibrator.check_reprojection_error(
                    camera_id,
                    calib_result.reprojection_error,
                )
                report.check_results.append(rep_check)
                if rep_failure:
                    report.failures.append(rep_failure)
                    report.overall_status = CheckStatus.FAIL

                focal_check, focal_failure = calibrator.check_focal_length(
                    camera_id,
                    calib_result.fx,
                    calib_result.fy,
                )
                report.check_results.append(focal_check)
                if focal_failure:
                    report.failures.append(focal_failure)
                    report.overall_status = CheckStatus.FAIL

                dist_check, dist_failure = calibrator.check_distortion(
                    camera_id,
                    calib_result.k1,
                    calib_result.k2,
                )
                report.check_results.append(dist_check)
                if dist_failure:
                    report.failures.append(dist_failure)
                    report.overall_status = CheckStatus.FAIL

                if len([f for f in frames if f.has_missing_corners]) > 0:
                    report.overall_status = CheckStatus.WARNING
                    report.warnings.append("部分帧存在缺角点问题")

            else:
                report.overall_status = CheckStatus.FAIL
                report.warnings.append(f"标定失败: 有效帧数不足或计算错误")

            camera_reports[camera_id] = report

        passed_count = sum(1 for r in camera_reports.values() if r.overall_status == CheckStatus.PASS)
        failed_count = len(camera_reports) - passed_count

        console.print(f"[green]✓[/green] 标定复核完成: 通过 {passed_count}, 失败/警告 {failed_count}")

    with console.status("[bold green]生成输出文件...[/bold green]"):
        report_gen = ReportGenerator()

        bundle = report_gen.generate_calibration_bundle(camera_reports)
        bundle_path = output_path / "calibration_bundle.json"
        write_calibration_bundle(str(bundle_path), bundle)
        console.print(f"[green]✓[/green] 生成标定包: {bundle_path}")

        failures_data = report_gen.generate_failures_csv_data(camera_reports, anomalies)
        if failures_data:
            failures_path = output_path / "failures.csv"
            write_failures_csv(str(failures_path), failures_data)
            console.print(f"[green]✓[/green] 生成失败记录: {failures_path}")
        else:
            console.print(f"[blue]ℹ[/blue] 无失败记录，跳过 failures.csv 生成")

        report_md = report_gen.generate_markdown_report(camera_reports, anomalies)
        report_path = output_path / "report.md"
        write_report_md(str(report_path), report_md)
        console.print(f"[green]✓[/green] 生成报告: {report_path}")

    console.print()
    console.print(Panel.fit("[bold green]复核完成![/bold green]", border_style="green"))

    table = Table(title="复核结果概览")
    table.add_column("相机ID", style="cyan")
    table.add_column("序列号", style="magenta")
    table.add_column("状态", style="bold")
    table.add_column("重投影误差", justify="right")
    table.add_column("有效帧数", justify="right")

    for camera_id, report in camera_reports.items():
        status_style = {
            CheckStatus.PASS: "green",
            CheckStatus.FAIL: "red",
            CheckStatus.WARNING: "yellow",
        }.get(report.overall_status, "white")

        status_emoji = {
            CheckStatus.PASS: "✓",
            CheckStatus.FAIL: "✗",
            CheckStatus.WARNING: "⚠",
        }.get(report.overall_status, "?")

        if report.calibration_result:
            reproj_error = f"{report.calibration_result.reprojection_error:.4f}"
            num_frames = str(report.calibration_result.num_frames)
        else:
            reproj_error = "-"
            num_frames = "-"

        table.add_row(
            camera_id,
            report.serial_number,
            f"[{status_style}]{status_emoji} {report.overall_status.value}[/{status_style}]",
            reproj_error,
            num_frames,
        )

    console.print(table)
    console.print()
    console.print(f"输出目录: [blue]{output_path.absolute()}[/blue]")


@cli.command()
@click.option(
    "--output-dir",
    "-o",
    default="./example_data",
    type=click.Path(file_okay=False),
    help="输出目录 (默认: ./example_data)",
)
def init_example(output_dir: str):
    """
    生成示例数据，用于演示和测试。
    """
    from datetime import datetime, timedelta
    import json
    import csv
    import yaml

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    detections_path = output_path / "detections"
    detections_path.mkdir(exist_ok=True)

    cameras_csv_content = """camera_id,serial_number,model,expected_width,expected_height,expected_fx_min,expected_fx_max,expected_fy_min,expected_fy_max,expected_k1_min,expected_k1_max,expected_k2_min,expected_k2_max
CAM001,SN20240001,USB3Vision-12MP,4096,3000,900,1100,900,1100,-0.2,0.2,-0.1,0.1
CAM002,SN20240002,USB3Vision-12MP,4096,3000,900,1100,900,1100,-0.2,0.2,-0.1,0.1
CAM003,SN20240003,GigE-5MP,2592,1944,600,800,600,800,-0.3,0.1,-0.15,0.05
"""

    with open(output_path / "cameras.csv", "w", encoding="utf-8", newline="") as f:
        f.write(cameras_csv_content)

    rules_yaml_content = """max_reprojection_error: 1.0
min_valid_frames: 5

cameras:
  - camera_id: CAM001
    serial_number: SN20240001
    model: USB3Vision-12MP
    resolution:
      width: 4096
      height: 3000
    focal_length:
      fx_min: 900.0
      fx_max: 1100.0
      fy_min: 900.0
      fy_max: 1100.0
    distortion:
      k1_min: -0.2
      k1_max: 0.2
      k2_min: -0.1
      k2_max: 0.1

  - camera_id: CAM002
    serial_number: SN20240002
    model: USB3Vision-12MP
    resolution:
      width: 4096
      height: 3000
    focal_length:
      fx_min: 900.0
      fx_max: 1100.0
      fy_min: 900.0
      fy_max: 1100.0
    distortion:
      k1_min: -0.2
      k1_max: 0.2
      k2_min: -0.1
      k2_max: 0.1

  - camera_id: CAM003
    serial_number: SN20240003
    model: GigE-5MP
    resolution:
      width: 2592
      height: 1944
    focal_length:
      fx_min: 600.0
      fx_max: 800.0
      fy_min: 600.0
      fy_max: 800.0
    distortion:
      k1_min: -0.3
      k1_max: 0.1
      k2_min: -0.15
      k2_max: 0.05

patterns:
  - pattern_id: PAT_001
    sequence_id: SEQ_2024_CALIB_01
    camera_id: CAM001
    board_width: 9
    board_height: 6
    square_size: 25.0

  - pattern_id: PAT_002
    sequence_id: SEQ_2024_CALIB_02
    camera_id: CAM002
    board_width: 9
    board_height: 6
    square_size: 25.0

  - pattern_id: PAT_003
    sequence_id: SEQ_2024_CALIB_03
    camera_id: CAM003
    board_width: 7
    board_height: 5
    square_size: 30.0
"""

    with open(output_path / "calibration_rules.yaml", "w", encoding="utf-8") as f:
        f.write(rules_yaml_content)

    def generate_chessboard_points(width: int, height: int, square_size: float):
        points = []
        for i in range(height):
            for j in range(width):
                points.append([j * square_size, i * square_size, 0.0])
        return points

    def generate_image_points(
        width: int,
        height: int,
        square_size: float,
        fx: float,
        fy: float,
        cx: float,
        cy: float,
        k1: float,
        k2: float,
        noise: float = 0.3,
    ):
        points = []
        for i in range(height):
            for j in range(width):
                x_world = j * square_size
                y_world = i * square_size

                x_cam = x_world + 50.0 + np.random.randn() * 5.0
                y_cam = y_world + 30.0 + np.random.randn() * 5.0
                z_cam = 500.0 + np.random.randn() * 20.0

                x_norm = x_cam / z_cam
                y_norm = y_cam / z_cam

                r2 = x_norm * x_norm + y_norm * y_norm
                r4 = r2 * r2
                distortion = 1.0 + k1 * r2 + k2 * r4

                x_dist = x_norm * distortion
                y_dist = y_norm * distortion

                u = fx * x_dist + cx + np.random.randn() * noise
                v = fy * y_dist + cy + np.random.randn() * noise

                points.append([u, v])
        return points

    import numpy as np

    np.random.seed(42)

    base_time = datetime(2024, 1, 15, 10, 0, 0)

    cam01_frames = []
    for frame_idx in range(12):
        timestamp = base_time + timedelta(seconds=frame_idx * 2)
        has_missing = frame_idx == 5

        if has_missing:
            num_points = 48
        else:
            num_points = 54

        object_points = generate_chessboard_points(9, 6, 25.0)[:num_points]
        image_points = generate_image_points(
            9, 6, 25.0,
            fx=1020.5 + np.random.randn() * 5,
            fy=1018.3 + np.random.randn() * 5,
            cx=2048.0,
            cy=1500.0,
            k1=0.05,
            k2=-0.03,
            noise=0.3,
        )[:num_points]

        frame_data = {
            "frame_id": f"CAM001_FRAME_{frame_idx:03d}",
            "camera_id": "CAM001",
            "sequence_id": "SEQ_2024_CALIB_01",
            "pattern_id": "PAT_001",
            "timestamp": timestamp.isoformat() + "Z",
            "image_width": 4096,
            "image_height": 3000,
            "object_points": object_points,
            "image_points": image_points,
        }
        cam01_frames.append(frame_data)

    with open(detections_path / "CAM001.jsonl", "w", encoding="utf-8") as f:
        for frame in cam01_frames:
            f.write(json.dumps(frame, ensure_ascii=False) + "\n")

    cam02_frames = []
    for frame_idx in range(10):
        timestamp = base_time + timedelta(minutes=5, seconds=frame_idx * 2)

        if frame_idx < 8:
            camera_id = "CAM002"
            sequence_id = "SEQ_2024_CALIB_02"
            pattern_id = "PAT_002"
        else:
            camera_id = "CAM003"
            sequence_id = "SEQ_2024_CALIB_02"
            pattern_id = "PAT_002"

        object_points = generate_chessboard_points(9, 6, 25.0)
        image_points = generate_image_points(
            9, 6, 25.0,
            fx=1050.0 + np.random.randn() * 5,
            fy=1045.0 + np.random.randn() * 5,
            cx=2050.0,
            cy=1490.0,
            k1=0.08,
            k2=-0.05,
            noise=0.4,
        )

        frame_data = {
            "frame_id": f"CAM002_FRAME_{frame_idx:03d}",
            "camera_id": camera_id,
            "sequence_id": sequence_id,
            "pattern_id": pattern_id,
            "timestamp": timestamp.isoformat() + "Z",
            "image_width": 4096,
            "image_height": 3000,
            "object_points": object_points,
            "image_points": image_points,
        }
        cam02_frames.append(frame_data)

    with open(detections_path / "CAM002.jsonl", "w", encoding="utf-8") as f:
        for frame in cam02_frames:
            f.write(json.dumps(frame, ensure_ascii=False) + "\n")

    cam03_frames = []
    for frame_idx in range(8):
        timestamp = base_time + timedelta(minutes=10, seconds=frame_idx * 2)

        object_points = generate_chessboard_points(7, 5, 30.0)
        image_points = generate_image_points(
            7, 5, 30.0,
            fx=700.0 + np.random.randn() * 3,
            fy=695.0 + np.random.randn() * 3,
            cx=1296.0,
            cy=972.0,
            k1=-0.1,
            k2=0.02,
            noise=0.25,
        )

        frame_data = {
            "frame_id": f"CAM003_FRAME_{frame_idx:03d}",
            "camera_id": "CAM003",
            "sequence_id": "SEQ_2024_CALIB_03",
            "pattern_id": "PAT_003",
            "timestamp": timestamp.isoformat() + "Z",
            "image_width": 2592,
            "image_height": 1944,
            "object_points": object_points,
            "image_points": image_points,
        }
        cam03_frames.append(frame_data)

    with open(detections_path / "CAM003.jsonl", "w", encoding="utf-8") as f:
        for frame in cam03_frames:
            f.write(json.dumps(frame, ensure_ascii=False) + "\n")

    console.print()
    console.print(Panel.fit("[bold green]示例数据生成完成![/bold green]", border_style="green"))
    console.print()
    console.print(f"生成的示例数据目录: [blue]{output_path.absolute()}[/blue]")
    console.print()
    console.print("文件结构:")
    console.print(f"""
{output_path.name}/
├── cameras.csv              # 3台相机的设备档案
├── calibration_rules.yaml   # 标定规则配置
└── detections/
    ├── CAM001.jsonl         # 含1帧缺角点异常 (CAM001_FRAME_005)
    ├── CAM002.jsonl         # 含跨相机误归属异常 (后2帧错误分配给CAM003)
    └── CAM003.jsonl         # 正常数据 (8帧)
""")
    console.print()
    console.print("使用示例数据进行复核:")
    console.print(f"  [bold]calib-check check -i {output_path} -o ./output[/bold]")


def main():
    cli()


if __name__ == "__main__":
    main()
