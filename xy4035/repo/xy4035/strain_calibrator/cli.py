import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

import click
import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from . import __version__
from .models import (
    ProjectConfig,
    Sensor,
    SensorType,
    Unit,
    CrossSection,
    Material,
    ImportRecord,
    CalibrationRecord,
    AlignmentRecord,
    AnalysisRecord,
)
from .storage import ProjectStorage, HistoryManager, Workspace, generate_id
from .quarantine import QuarantineManager
from .parser import CSVParser
from .validator import DataValidator
from .calibration import CalibrationPipeline
from .analysis import StructuralAnalyzer
from .exporter import ReportExporter


console = Console()


def get_project_path() -> Path:
    env_path = os.environ.get("STRAIN_PROJECT_PATH")
    if env_path:
        return Path(env_path)
    return Path.cwd()


def ensure_project_initialized(storage: ProjectStorage) -> None:
    if not storage.is_project_initialized():
        console.print("[red]错误: 项目未初始化，请先运行 init 命令[/red]")
        sys.exit(1)


@click.group()
@click.version_option(__version__)
@click.pass_context
def main(ctx: click.Context) -> None:
    """梁板应变漂移校准器 - 土木实验室科学计算命令行工具"""
    project_path = get_project_path()
    storage = ProjectStorage(project_path)
    ctx.ensure_object(dict)
    ctx.obj["storage"] = storage
    ctx.obj["project_path"] = project_path


@main.command()
@click.option("--name", "-n", required=True, help="项目名称")
@click.option("--id", "-i", "project_id", help="项目唯一标识（默认自动生成）")
@click.option("--description", "-d", help="项目描述")
@click.option("--sampling-rate", "-sr", type=float, default=10.0, help="默认采样率 (Hz)")
@click.option("--section-width", "-sw", type=float, help="截面宽度 (m)")
@click.option("--section-height", "-sh", type=float, help="截面高度 (m)")
@click.option("--elastic-modulus", "-em", type=float, default=2.06e11, help="弹性模量 (Pa)")
@click.pass_context
def init(
    ctx: click.Context,
    name: str,
    project_id: Optional[str],
    description: Optional[str],
    sampling_rate: float,
    section_width: Optional[float],
    section_height: Optional[float],
    elastic_modulus: float,
) -> None:
    """初始化项目配置"""
    storage = ctx.obj["storage"]

    if storage.is_project_initialized():
        console.print("[yellow]警告: 项目已存在，将覆盖配置[/yellow]")
        if not click.confirm("是否继续？"):
            return

    storage.init_directories()

    if not project_id:
        project_id = f"proj_{generate_id()}"

    cross_section = None
    if section_width and section_height:
        cross_section = CrossSection(
            width=section_width,
            height=section_height,
        )

    config = ProjectConfig(
        project_name=name,
        project_id=project_id,
        description=description,
        default_sampling_rate=sampling_rate,
        cross_section=cross_section,
        material=Material(elastic_modulus=elastic_modulus),
    )

    storage.save_config(config)

    console.print(Panel.fit(
        f"[green]项目初始化成功![/green]\n"
        f"项目名称: {name}\n"
        f"项目ID: {project_id}\n"
        f"采样率: {sampling_rate} Hz",
        title="项目信息"
    ))


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option("--encoding", "-e", default="utf-8", help="文件编码")
@click.option("--skip-rows", "-s", type=int, default=0, help="跳过的行数")
@click.pass_context
def import_cmd(
    ctx: click.Context,
    files: List[Path],
    encoding: str,
    skip_rows: int,
) -> None:
    """导入CSV数据文件"""
    storage = ctx.obj["storage"]
    ensure_project_initialized(storage)

    if not files:
        console.print("[red]错误: 请指定要导入的CSV文件[/red]")
        return

    config = storage.load_config()
    history_manager = HistoryManager(storage)
    parser = CSVParser()

    imported_count = 0

    for file_path in files:
        try:
            stored_filename = storage.copy_data_file(file_path, file_path.name)
            stored_path = storage.get_data_file_path(stored_filename)

            df, metadata = parser.parse_csv(
                stored_path,
                encoding=encoding,
                skip_rows=skip_rows,
            )

            df, time_errors = parser.normalize_time_column(df, metadata.get("time_column"))

            sensor_ids = []
            for sc in metadata.get("sensor_columns", []):
                if sc.get("sensor_id"):
                    sensor_ids.append(sc.get("sensor_id"))

            time_range = None
            if not df.empty:
                time_range = {
                    "start": df.index[0],
                    "end": df.index[-1],
                }

            record = ImportRecord(
                import_id=generate_id(),
                original_filename=file_path.name,
                stored_filename=stored_filename,
                row_count=len(df),
                column_count=len(df.columns),
                sensor_ids=sensor_ids,
                time_range=time_range,
            )
            history_manager.add_import(record)

            console.print(f"[green]✓[/green] 已导入: {file_path.name} ({len(df)} 行)")
            imported_count += 1

        except Exception as e:
            console.print(f"[red]✗[/red] 导入失败 {file_path.name}: {e}")

    console.print(f"\n[green]共导入 {imported_count} 个文件[/green]")


@main.command()
@click.option("--checks", "-c", help="指定检查类型 (逗号分隔: time_order,sampling_rate,sensor_ids,missing_values,value_range)")
@click.pass_context
def check(ctx: click.Context, checks: Optional[str]) -> None:
    """校验数据质量"""
    storage = ctx.obj["storage"]
    ensure_project_initialized(storage)

    config = storage.load_config()
    history_manager = HistoryManager(storage)
    quarantine_manager = QuarantineManager(storage.quarantine_path)
    parser = CSVParser()

    check_list = None
    if checks:
        check_list = [c.strip() for c in checks.split(",")]

    imports = history_manager.get_imports()
    if not imports:
        console.print("[yellow]没有找到已导入的数据文件[/yellow]")
        return

    total_issues = 0
    total_quarantine = 0

    for import_rec in imports:
        record_data = import_rec.get("record", {})
        stored_filename = record_data.get("stored_filename")
        if not stored_filename:
            continue

        file_path = storage.get_data_file_path(stored_filename)
        if not file_path.exists():
            continue

        try:
            df, metadata = parser.parse_csv(file_path)
            df, _ = parser.normalize_time_column(df, metadata.get("time_column"))

            validator = DataValidator(config)
            df, issues = validator.validate_all(df, stored_filename, check_list)
            summary = validator.get_issues_summary()

            quarantine_data = validator.get_quarantine_data()
            for entry in quarantine_data:
                quarantine_manager.add_entry(
                    raw_data=entry.get("raw_data", {}),
                    reason=entry.get("reason", ""),
                    severity=entry.get("severity", "warning"),
                    source_file=stored_filename,
                    original_row=entry.get("row"),
                )

            issue_count = summary.get("total", 0)
            quar_count = summary.get("quarantine_count", 0)
            total_issues += issue_count
            total_quarantine += quar_count

            status_color = "green" if issue_count == 0 else ("yellow" if issue_count < 10 else "red")
            console.print(f"[{status_color}]●[/{status_color}] {stored_filename}: {issue_count} 个问题, {quar_count} 行隔离")

            if issues:
                by_severity: Dict[str, int] = {}
                for issue in issues[:10]:
                    sev = issue.severity
                    by_severity[sev] = by_severity.get(sev, 0) + 1
                    console.print(f"  [{sev}] {issue.reason}")

        except Exception as e:
            console.print(f"[red]✗[/red] 校验失败 {stored_filename}: {e}")

    table = Table(title="校验结果汇总")
    table.add_column("统计项", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_row("总问题数", str(total_issues))
    table.add_row("隔离区行数", str(total_quarantine))
    console.print(table)


@main.command()
@click.option("--zero-start", "-zs", help="空载区间开始时间 (格式: 'YYYY-MM-DD HH:MM:SS')")
@click.option("--zero-duration", "-zd", type=float, help="空载区间时长 (秒)")
@click.pass_context
def calibrate(
    ctx: click.Context,
    zero_start: Optional[str],
    zero_duration: Optional[float],
) -> None:
    """零点漂移校正和温度补偿"""
    storage = ctx.obj["storage"]
    ensure_project_initialized(storage)

    config = storage.load_config()
    history_manager = HistoryManager(storage)
    workspace = Workspace(storage)
    parser = CSVParser()

    imports = history_manager.get_imports()
    if not imports:
        console.print("[yellow]没有找到已导入的数据文件[/yellow]")
        return

    pipeline = CalibrationPipeline(config)
    all_dataframes: Dict[str, pd.DataFrame] = {}
    import_ids: List[str] = []

    for import_rec in imports:
        record_data = import_rec.get("record", {})
        stored_filename = record_data.get("stored_filename")
        import_id = record_data.get("import_id")
        if not stored_filename:
            continue

        import_ids.append(import_id)
        file_path = storage.get_data_file_path(stored_filename)
        if not file_path.exists():
            continue

        try:
            df, metadata = parser.parse_csv(file_path)
            df, _ = parser.normalize_time_column(df, metadata.get("time_column"))
            all_dataframes[stored_filename] = df
            console.print(f"[green]✓[/green] 已加载: {stored_filename} ({len(df)} 行)")
        except Exception as e:
            console.print(f"[red]✗[/red] 加载失败 {stored_filename}: {e}")

    if not all_dataframes:
        console.print("[red]没有可校准的数据[/red]")
        return

    combined_df = pd.concat(all_dataframes.values())
    combined_df = combined_df.sort_index()

    zero_load_interval = None
    if zero_start:
        try:
            start_time = datetime.strptime(zero_start, "%Y-%m-%d %H:%M:%S")
            if zero_duration:
                end_time = start_time + timedelta(seconds=zero_duration)
            else:
                end_time = start_time + timedelta(seconds=config.zero_load_duration)
            zero_load_interval = (start_time, end_time)
        except ValueError:
            console.print(f"[red]错误: 无法解析时间 '{zero_start}'，使用自动检测[/red]")

    try:
        calibrated_df, calibration_info = pipeline.calibrate(
            combined_df,
            config.sensors,
            zero_load_interval,
        )

        workspace.save_dataframe("calibrated", calibrated_df)
        workspace.save_json("calibration_info", calibration_info)

        record = CalibrationRecord(
            calibration_id=generate_id(),
            import_ids=import_ids,
            zero_load_interval={
                "start": calibration_info["zero_load_interval"]["start"],
                "end": calibration_info["zero_load_interval"]["end"],
            },
            drift_correction=calibration_info.get("drift_correction", {}),
            temperature_compensation=calibration_info.get("temperature_compensation", {}),
        )
        history_manager.add_calibration(record)

        console.print(Panel.fit(
            "[green]校准完成![/green]\n"
            f"零点漂移校正传感器数: {len(calibration_info.get('drift_correction', {}))}\n"
            f"温度补偿传感器数: {len(calibration_info.get('temperature_compensation', {}))}",
            title="校准结果"
        ))

    except Exception as e:
        console.print(f"[red]校准失败: {e}[/red]")
        import traceback
        traceback.print_exc()


@main.command()
@click.option("--target-rate", "-tr", type=float, help="目标采样率 (Hz)，默认使用配置值")
@click.option("--method", "-m", default="linear", help="插值方法: linear, time")
@click.pass_context
def align(
    ctx: click.Context,
    target_rate: Optional[float],
    method: str,
) -> None:
    """时间轴对齐并插值到统一步长"""
    storage = ctx.obj["storage"]
    ensure_project_initialized(storage)

    config = storage.load_config()
    history_manager = HistoryManager(storage)
    workspace = Workspace(storage)

    latest_calibration = history_manager.get_latest_calibration()
    if not latest_calibration:
        console.print("[red]请先执行 calibrate 命令[/red]")
        return

    try:
        calibrated_df = workspace.load_dataframe("calibrated")
    except Exception as e:
        console.print(f"[red]无法加载校准数据: {e}[/red]")
        return

    if target_rate is None:
        target_rate = config.default_sampling_rate

    pipeline = CalibrationPipeline(config)

    all_dataframes = {"data": calibrated_df}

    try:
        aligned_df = pipeline.align(all_dataframes, target_rate, method)

        workspace.save_dataframe("aligned", aligned_df)

        time_range = {
            "start": aligned_df.index[0],
            "end": aligned_df.index[-1],
        }

        record = AlignmentRecord(
            alignment_id=generate_id(),
            calibration_id=latest_calibration.get("calibration_id", ""),
            target_sampling_rate=target_rate,
            time_range=time_range,
            aligned_sensors=list(aligned_df.columns),
        )
        history_manager.add_alignment(record)

        console.print(Panel.fit(
            "[green]时间对齐完成![/green]\n"
            f"目标采样率: {target_rate} Hz\n"
            f"数据点数: {len(aligned_df)}\n"
            f"对齐传感器数: {len(aligned_df.columns)}",
            title="对齐结果"
        ))

    except Exception as e:
        console.print(f"[red]对齐失败: {e}[/red]")
        import traceback
        traceback.print_exc()


@main.command()
@click.option("--load-sensor", "-ls", help="指定荷载传感器编号")
@click.pass_context
def analyze(
    ctx: click.Context,
    load_sensor: Optional[str],
) -> None:
    """计算峰值应变、残余变形、曲率、中性轴位置和弯矩估算"""
    storage = ctx.obj["storage"]
    ensure_project_initialized(storage)

    config = storage.load_config()
    history_manager = HistoryManager(storage)
    workspace = Workspace(storage)

    latest_alignment = history_manager.get_latest_alignment()
    if not latest_alignment:
        console.print("[red]请先执行 align 命令[/red]")
        return

    try:
        aligned_df = workspace.load_dataframe("aligned")
    except Exception as e:
        console.print(f"[red]无法加载对齐数据: {e}[/red]")
        return

    try:
        analyzer = StructuralAnalyzer(config)
        analysis_result = analyzer.analyze(
            aligned_df,
            config.sensors,
            load_sensor,
        )

        workspace.save_json("analysis_result", analysis_result)

        load_levels = analysis_result.get("load_levels", [])
        alerts = analysis_result.get("alerts", [])
        critical_count = sum(1 for a in alerts if a.get("severity") == "critical")
        warning_count = sum(1 for a in alerts if a.get("severity") == "warning")

        record = AnalysisRecord(
            analysis_id=generate_id(),
            alignment_id=latest_alignment.get("alignment_id", ""),
            load_levels=len(load_levels),
            peak_strains=analysis_result.get("peak_strains", {}),
            residual_deformations=analysis_result.get("residual_deformations", {}),
            neutral_axis_positions=[
                analysis_result.get("neutral_axis_statistics", {}).get("mean"),
            ],
            moments=[
                analysis_result.get("moment_statistics", {}).get("max"),
            ],
            alerts=alerts,
        )
        history_manager.add_analysis(record)

        table = Table(title="分析结果汇总")
        table.add_column("项目", style="cyan")
        table.add_column("值", style="magenta")
        table.add_row("检测加载级数", str(len(load_levels)))
        table.add_row("峰值应变传感器数", str(len(analysis_result.get("peak_strains", {}))))
        table.add_row("残余变形传感器数", str(len(analysis_result.get("residual_deformations", {}))))
        table.add_row("严重告警", f"[red]{critical_count}[/red]")
        table.add_row("警告", f"[yellow]{warning_count}[/yellow]")
        console.print(table)

        na_stats = analysis_result.get("neutral_axis_statistics", {})
        if na_stats.get("mean") is not None:
            mean_na = na_stats.get("mean", 0)
            std_na = na_stats.get("std", 0)
            console.print(f"\n[cyan]中性轴平均位置:[/cyan] {mean_na * 1000:.2f} mm (标准差: {std_na * 1000:.2f} mm)")

        moment_stats = analysis_result.get("moment_statistics", {})
        if moment_stats.get("max") is not None:
            max_moment = moment_stats.get("max", 0)
            console.print(f"[cyan]最大弯矩:[/cyan] {max_moment / 1000:.2f} kN·m")

    except Exception as e:
        console.print(f"[red]分析失败: {e}[/red]")
        import traceback
        traceback.print_exc()


@main.command()
@click.option("--output-dir", "-o", type=click.Path(path_type=Path), help="输出目录")
@click.option("--prefix", "-p", default="result", help="输出文件名前缀")
@click.pass_context
def export_cmd(
    ctx: click.Context,
    output_dir: Optional[Path],
    prefix: str,
) -> None:
    """导出Markdown试验报告、清洗后的CSV和JSON计算结果"""
    storage = ctx.obj["storage"]
    ensure_project_initialized(storage)

    config = storage.load_config()
    history_manager = HistoryManager(storage)
    workspace = Workspace(storage)

    if output_dir is None:
        output_dir = Path(storage.output_path)

    try:
        aligned_df = workspace.load_dataframe("aligned")
        analysis_result = workspace.load_json("analysis_result")
    except Exception as e:
        console.print(f"[red]无法加载数据，请确保已执行 analyze 命令: {e}[/red]")
        return

    calibration_info = None
    try:
        calibration_info = workspace.load_json("calibration_info")
    except Exception:
        pass

    try:
        exporter = ReportExporter(config)
        output_paths = exporter.export_all(
            output_dir,
            aligned_df,
            analysis_result,
            calibration_info,
            prefix=prefix,
        )

        console.print(Panel.fit(
            "[green]导出完成![/green]\n"
            f"Markdown报告: {output_paths['report']}\n"
            f"清洗后CSV: {output_paths['csv']}\n"
            f"分析结果JSON: {output_paths['json']}",
            title="导出结果"
        ))

    except Exception as e:
        console.print(f"[red]导出失败: {e}[/red]")
        import traceback
        traceback.print_exc()


@main.command()
@click.option("--type", "-t", "record_type", help="记录类型: import, calibration, alignment, analysis")
@click.option("--limit", "-n", type=int, default=20, help="显示条数")
@click.pass_context
def history(
    ctx: click.Context,
    record_type: Optional[str],
    limit: int,
) -> None:
    """查询过去的导入、校准和分析记录"""
    storage = ctx.obj["storage"]
    ensure_project_initialized(storage)

    history_manager = HistoryManager(storage)

    if record_type:
        records = history_manager.get_by_type(record_type, limit=limit)
    else:
        records = history_manager.get_all(limit=limit)

    if not records:
        console.print("[yellow]没有找到历史记录[/yellow]")
        return

    table = Table(title="历史记录")
    table.add_column("序号", style="cyan")
    table.add_column("类型", style="magenta")
    table.add_column("时间", style="green")
    table.add_column("详情", style="white")

    for i, rec in enumerate(reversed(records[-limit:]), 1):
        rec_type = rec.get("record_type", "unknown")
        timestamp = rec.get("timestamp", "")
        record_data = rec.get("record", {})

        type_name = {
            "import": "导入",
            "calibration": "校准",
            "alignment": "对齐",
            "analysis": "分析",
        }.get(rec_type, rec_type)

        detail = ""
        if rec_type == "import":
            detail = f"文件: {record_data.get('original_filename', '-')}"
        elif rec_type == "calibration":
            detail = f"校正传感器: {len(record_data.get('drift_correction', {}))}"
        elif rec_type == "alignment":
            detail = f"采样率: {record_data.get('target_sampling_rate', '-')} Hz"
        elif rec_type == "analysis":
            detail = f"加载级: {record_data.get('load_levels', 0)}"

        table.add_row(
            str(i),
            type_name,
            str(timestamp)[:19],
            detail,
        )

    console.print(table)


if __name__ == "__main__":
    main()
