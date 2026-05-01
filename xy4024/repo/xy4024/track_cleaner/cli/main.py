import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from track_cleaner import __version__
from track_cleaner.config import (
    AppConfig,
    load_config,
    save_config,
    get_default_config,
    CONFIG_FILENAME,
)
from track_cleaner.parsers import get_parser_for_file
from track_cleaner.rules import apply_all_rules
from track_cleaner.cleaning import create_clean_plan, execute_clean_plan, CleanedTrack
from track_cleaner.reports import (
    calculate_summary,
    check_checkpoints,
    load_checkpoints_from_csv,
    compare_tracks,
    export_all,
)
from track_cleaner.storage import HistoryDatabase, ImportStore


console = Console()


@click.group()
@click.version_option(__version__, prog_name="track-cleaner")
@click.pass_context
def main(ctx):
    """轨迹净化和行程报告器 - 一个给徒步领队用的本地命令行工具"""
    ctx.ensure_object(dict)
    try:
        ctx.obj["config"] = load_config()
    except Exception as e:
        ctx.obj["config"] = get_default_config()


@main.command()
@click.option("--timezone", default="Asia/Shanghai", help="时区设置，默认: Asia/Shanghai")
@click.option("--speed-threshold", type=float, default=15.0, help="速度阈值(km/h)，超过视为异常，默认: 15")
@click.option("--breakpoint-threshold", type=float, default=300.0, help="断点阈值(秒)，超过视为分段，默认: 300")
@click.option("--elevation-spike", type=float, default=100.0, help="海拔突变阈值(米)，默认: 100")
@click.option("--export-dir", default="./exports", help="默认导出目录，默认: ./exports")
@click.option("--data-dir", default="./data", help="数据存储目录，默认: ./data")
@click.option("--force", is_flag=True, help="覆盖现有配置")
@click.pass_context
def init(
    ctx,
    timezone: str,
    speed_threshold: float,
    breakpoint_threshold: float,
    elevation_spike: float,
    export_dir: str,
    data_dir: str,
    force: bool,
):
    """初始化项目配置"""
    config_path = Path.cwd() / CONFIG_FILENAME
    
    if config_path.exists() and not force:
        console.print(f"[yellow]配置文件已存在: {config_path}[/yellow]")
        console.print("使用 --force 覆盖现有配置")
        ctx.exit(1)
    
    config = AppConfig(
        timezone=timezone,
        speed_threshold=speed_threshold,
        breakpoint_threshold=breakpoint_threshold,
        elevation_spike_threshold=elevation_spike,
        default_export_dir=export_dir,
        data_dir=data_dir,
    )
    
    save_config(config, config_path)
    
    table = Table(title="配置已创建")
    table.add_column("配置项", style="cyan")
    table.add_column("值", style="green")
    table.add_row("时区", config.timezone)
    table.add_row("速度阈值", f"{config.speed_threshold} km/h")
    table.add_row("断点阈值", f"{config.breakpoint_threshold} 秒")
    table.add_row("海拔突变阈值", f"{config.elevation_spike_threshold} 米")
    table.add_row("导出目录", config.default_export_dir)
    table.add_row("数据目录", config.data_dir)
    console.print(table)
    console.print(f"[green]配置文件已保存到: {config_path}[/green]")


@main.command()
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--task-name", help="任务名称，用于组织导入的文件")
@click.option("--copy-only", is_flag=True, help="仅复制文件，不解析预览")
@click.pass_context
def import_(ctx, file_path: str, task_name: Optional[str], copy_only: bool):
    """导入轨迹文件 (GPX/KML/CSV) - 保留原始文件不被覆盖"""
    config = ctx.obj["config"]
    source_path = Path(file_path)
    
    data_dir = Path(config.data_dir)
    import_store = ImportStore(data_dir)
    
    console.print(f"[cyan]正在导入文件: {source_path.name}[/cyan]")
    
    dest_path = import_store.store_imported_file(source_path, task_name)
    console.print(f"[green]文件已复制到: {dest_path}[/green]")
    
    if not copy_only:
        try:
            parser_class = get_parser_for_file(dest_path)
            parser = parser_class()
            track = parser.parse(dest_path)
            
            table = Table(title="轨迹预览")
            table.add_column("属性", style="cyan")
            table.add_column("值", style="green")
            table.add_row("名称", track.name)
            table.add_row("源文件", track.source_file or "-")
            table.add_row("格式", track.source_format or "-")
            table.add_row("轨迹段数", str(len(track.segments)))
            table.add_row("总点数", str(len(track.all_points)))
            if track.start_time:
                table.add_row("开始时间", str(track.start_time))
            if track.end_time:
                table.add_row("结束时间", str(track.end_time))
            console.print(table)
            
            db = HistoryDatabase(data_dir / config.history_db)
            db.add_record(
                task_name=task_name or track.name,
                task_type="import",
                source_file=str(dest_path),
                summary={
                    "track_name": track.name,
                    "segments": len(track.segments),
                    "points": len(track.all_points),
                    "format": track.source_format,
                },
            )
            
        except Exception as e:
            console.print(f"[yellow]解析文件时出错: {e}[/yellow]")
            console.print("[yellow]文件已复制，但无法预览内容[/yellow]")


@main.command()
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--dry-run", is_flag=True, help="仅显示清洗计划，不执行清洗")
@click.option("--output", "-o", help="输出清洗后轨迹的文件路径(仅在非dry-run时使用)")
@click.option("--skip-rules", help="跳过指定规则，逗号分隔，如: duplicate_timestamp,speed_anomaly")
@click.pass_context
def clean(ctx, file_path: str, dry_run: bool, output: Optional[str], skip_rules: Optional[str]):
    """清洗轨迹 - 先给出dry-run清洗计划，再执行清洗"""
    config = ctx.obj["config"]
    source_path = Path(file_path)
    
    console.print(f"[cyan]正在解析轨迹: {source_path.name}[/cyan]")
    
    parser_class = get_parser_for_file(source_path)
    parser = parser_class()
    track = parser.parse(source_path)
    
    console.print(f"原始轨迹: {len(track.segments)} 段, {len(track.all_points)} 点")
    
    rule_results = apply_all_rules(track, config)
    
    if skip_rules:
        skip_list = [r.strip() for r in skip_rules.split(",")]
        rule_results = [r for r in rule_results if r.rule_name not in skip_list]
        console.print(f"[yellow]已跳过规则: {skip_list}[/yellow]")
    
    plan = create_clean_plan(track, config, rule_results)
    summary = plan.get_summary()
    
    table = Table(title="清洗计划")
    table.add_column("指标", style="cyan")
    table.add_column("数量", style="green")
    table.add_row("原始点数", str(summary["original_points"]))
    table.add_row("将移除点数", str(summary["points_to_remove"]))
    table.add_row("将分段点", str(summary["split_points"]))
    table.add_row("警告数", str(summary["warnings"]))
    table.add_row("总问题数", str(summary["total_issues"]))
    console.print(table)
    
    if plan.items:
        detail_table = Table(title="问题详情")
        detail_table.add_column("#", style="dim")
        detail_table.add_column("规则", style="cyan")
        detail_table.add_column("动作", style="yellow")
        detail_table.add_column("点索引", style="green")
        detail_table.add_column("消息", style="white")
        
        for i, item in enumerate(plan.items[:20]):
            detail_table.add_row(
                str(i + 1),
                item.rule_name,
                item.action.value,
                str(item.affected_point_indices),
                item.message,
            )
        
        if len(plan.items) > 20:
            detail_table.add_row(
                "...",
                f"... 还有 {len(plan.items) - 20} 个问题",
                "",
                "",
                "",
            )
        
        console.print(detail_table)
    
    if dry_run:
        console.print("[yellow]这是 dry-run 模式，未执行实际清洗[/yellow]")
        return
    
    console.print("\n[cyan]正在执行清洗...[/cyan]")
    cleaned = execute_clean_plan(plan)
    
    console.print(f"[green]清洗完成: {len(cleaned.segments)} 段, {len(cleaned.all_points)} 点[/green]")
    
    data_dir = Path(config.data_dir)
    db = HistoryDatabase(data_dir / config.history_db)
    db.add_record(
        task_name=track.name,
        task_type="clean",
        source_file=str(source_path),
        summary={
            "original_points": len(track.all_points),
            "cleaned_points": len(cleaned.all_points),
            "issues_removed": summary["points_to_remove"],
            "splits": summary["split_points"],
        },
        raw_data=json.dumps(plan.to_dict(), ensure_ascii=False),
    )
    
    if output:
        output_path = Path(output)
        from track_cleaner.reports.exporter import export_to_gpx
        
        output_track = track
        output_track.segments = cleaned.segments
        
        try:
            export_to_gpx(output_track, output_path)
            console.print(f"[green]清洗后轨迹已导出到: {output_path}[/green]")
        except Exception as e:
            console.print(f"[red]导出失败: {e}[/red]")


@main.command()
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--checkpoints", "-c", type=click.Path(exists=True, dir_okay=False), help="检查点 CSV 文件")
@click.option("--min-speed", type=float, default=1.0, help="最小移动速度(km/h)，低于此视为停留，默认: 1")
@click.pass_context
def summary(ctx, file_path: str, checkpoints: Optional[str], min_speed: float):
    """计算行程摘要 - 总距离、移动时间、累计爬升/下降、平均速度等"""
    config = ctx.obj["config"]
    source_path = Path(file_path)
    
    console.print(f"[cyan]正在解析轨迹: {source_path.name}[/cyan]")
    
    parser_class = get_parser_for_file(source_path)
    parser = parser_class()
    track = parser.parse(source_path)
    
    checkpoints_list = []
    if checkpoints:
        cp_path = Path(checkpoints)
        checkpoints_list = load_checkpoints_from_csv(cp_path)
        console.print(f"[green]已加载 {len(checkpoints_list)} 个检查点[/green]")
    
    if checkpoints_list:
        checked_cps = check_checkpoints(track, checkpoints_list)
        track_summary = calculate_summary(track, min_speed, checked_cps)
    else:
        track_summary = calculate_summary(track, min_speed)
    
    table = Table(title="行程摘要")
    table.add_column("指标", style="cyan")
    table.add_column("值", style="green")
    table.add_row("轨迹名称", track_summary.track_name)
    table.add_row("总距离", f"{track_summary.total_distance_km:.2f} 公里")
    table.add_row("总时间", f"{track_summary.total_time_hours:.2f} 小时")
    table.add_row("移动时间", f"{track_summary.moving_time_hours:.2f} 小时")
    table.add_row("停留时间", f"{track_summary.stopped_time_hours:.2f} 小时")
    table.add_row("累计爬升", f"{track_summary.elevation_gain_m:.1f} 米")
    table.add_row("累计下降", f"{track_summary.elevation_loss_m:.1f} 米")
    table.add_row("平均速度", f"{track_summary.average_speed_kmh:.2f} 公里/小时")
    table.add_row("移动速度", f"{track_summary.moving_speed_kmh:.2f} 公里/小时")
    table.add_row("轨迹点数", str(track_summary.point_count))
    table.add_row("轨迹段数", str(track_summary.segment_count))
    if track_summary.start_time:
        table.add_row("开始时间", str(track_summary.start_time))
    if track_summary.end_time:
        table.add_row("结束时间", str(track_summary.end_time))
    console.print(table)
    
    if track_summary.checkpoints:
        cp_table = Table(title="检查点状态")
        cp_table.add_column("检查点", style="cyan")
        cp_table.add_column("状态", style="green")
        cp_table.add_column("最近距离", style="yellow")
        cp_table.add_column("到达时间", style="white")
        
        for cp in track_summary.checkpoints:
            status = "✓ 已经过" if cp.visited else "✗ 未经过"
            status_style = "green" if cp.visited else "red"
            dist_str = f"{cp.distance_to_checkpoint:.1f}m" if cp.distance_to_checkpoint is not None else "-"
            time_str = str(cp.visited_time) if cp.visited_time else "-"
            
            cp_table.add_row(
                cp.name,
                f"[{status_style}]{status}[/{status_style}]",
                dist_str,
                time_str,
            )
        
        console.print(cp_table)
        
        visited_count = sum(1 for cp in track_summary.checkpoints if cp.visited)
        total_count = len(track_summary.checkpoints)
        console.print(f"[cyan]检查点完成率: {visited_count}/{total_count} ({visited_count/total_count*100:.1f}%)[/cyan]")
    
    data_dir = Path(config.data_dir)
    db = HistoryDatabase(data_dir / config.history_db)
    db.add_record(
        task_name=track.name,
        task_type="summary",
        source_file=str(source_path),
        summary=track_summary.to_dict(),
    )


@main.command()
@click.argument("actual_track", type=click.Path(exists=True, dir_okay=False))
@click.argument("planned_track", type=click.Path(exists=True, dir_okay=False))
@click.option("--checkpoints", "-c", type=click.Path(exists=True, dir_okay=False), help="检查点 CSV 文件")
@click.option("--deviation-threshold", type=float, default=50.0, help="偏离阈值(米)，默认: 50")
@click.option("--stop-threshold", type=float, default=10.0, help="停留阈值(分钟)，默认: 10")
@click.pass_context
def compare(
    ctx,
    actual_track: str,
    planned_track: str,
    checkpoints: Optional[str],
    deviation_threshold: float,
    stop_threshold: float,
):
    """对比计划路线和实际路线 - 提示偏离区间、漏掉的检查点和异常停留"""
    config = ctx.obj["config"]
    
    actual_path = Path(actual_track)
    planned_path = Path(planned_track)
    
    console.print(f"[cyan]解析实际路线: {actual_path.name}[/cyan]")
    parser_class = get_parser_for_file(actual_path)
    parser = parser_class()
    actual = parser.parse(actual_path)
    
    console.print(f"[cyan]解析计划路线: {planned_path.name}[/cyan]")
    parser_class2 = get_parser_for_file(planned_path)
    parser2 = parser_class2()
    planned = parser2.parse(planned_path)
    
    checkpoints_list = []
    actual_checked_cps = []
    if checkpoints:
        cp_path = Path(checkpoints)
        checkpoints_list = load_checkpoints_from_csv(cp_path)
        console.print(f"[green]已加载 {len(checkpoints_list)} 个检查点[/green]")
        actual_checked_cps = check_checkpoints(actual, checkpoints_list)
    
    comparison = compare_tracks(
        planned,
        actual,
        checkpoints_list if checkpoints_list else None,
        deviation_threshold,
        stop_threshold,
        actual_checked_cps if actual_checked_cps else None,
    )
    
    table = Table(title="路线对比摘要")
    table.add_column("指标", style="cyan")
    table.add_column("值", style="green")
    table.add_row("计划路线", comparison.planned_track_name)
    table.add_row("实际路线", comparison.actual_track_name)
    table.add_row("偏离路段", str(len(comparison.deviations)))
    table.add_row("遗漏检查点", str(len(comparison.missing_checkpoints)))
    table.add_row("异常停留", str(len(comparison.long_stops)))
    console.print(table)
    
    if comparison.deviations:
        dev_table = Table(title="偏离路段")
        dev_table.add_column("#", style="dim")
        dev_table.add_column("点范围", style="cyan")
        dev_table.add_column("最大偏离", style="yellow")
        dev_table.add_column("平均偏离", style="green")
        dev_table.add_column("偏离距离", style="white")
        
        for i, dev in enumerate(comparison.deviations):
            dev_table.add_row(
                str(i + 1),
                f"{dev.start_point_index} - {dev.end_point_index}",
                f"{dev.max_deviation_meters:.1f}m",
                f"{dev.avg_deviation_meters:.1f}m",
                f"{dev.distance_km:.2f}km",
            )
        console.print(dev_table)
    
    if comparison.missing_checkpoints:
        miss_table = Table(title="遗漏检查点")
        miss_table.add_column("#", style="dim")
        miss_table.add_column("名称", style="cyan")
        miss_table.add_column("位置", style="green")
        
        for i, cp in enumerate(comparison.missing_checkpoints):
            miss_table.add_row(
                str(i + 1),
                cp.name,
                f"({cp.latitude:.5f}, {cp.longitude:.5f})",
            )
        console.print(miss_table)
    
    if comparison.long_stops:
        stop_table = Table(title="异常停留")
        stop_table.add_column("#", style="dim")
        stop_table.add_column("位置", style="cyan")
        stop_table.add_column("时长", style="yellow")
        stop_table.add_column("开始", style="green")
        stop_table.add_column("结束", style="green")
        
        for i, stop in enumerate(comparison.long_stops):
            stop_table.add_row(
                str(i + 1),
                f"({stop.location[0]:.5f}, {stop.location[1]:.5f})",
                f"{stop.duration_seconds / 60:.1f} 分钟",
                str(stop.start_time) if stop.start_time else "-",
                str(stop.end_time) if stop.end_time else "-",
            )
        console.print(stop_table)
    
    data_dir = Path(config.data_dir)
    db = HistoryDatabase(data_dir / config.history_db)
    db.add_record(
        task_name=f"{actual.name} vs {planned.name}",
        task_type="compare",
        source_file=str(actual_path),
        summary=comparison.to_dict(),
    )


@main.command()
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--output-dir", "-o", help="导出目录，默认使用配置中的 default_export_dir")
@click.option("--format", "-f", "fmt", multiple=True, default=["all"], help="导出格式: gpx, geojson, markdown, csv. 使用 --format 多次指定多个格式，或 'all' 导出全部")
@click.option("--base-name", help="导出文件名前缀，默认使用轨迹名称")
@click.option("--comparison", type=click.Path(exists=True, dir_okay=False), help="计划路线文件，用于对比报告")
@click.option("--checkpoints", "-c", type=click.Path(exists=True, dir_okay=False), help="检查点 CSV 文件")
@click.option("--cleaned", is_flag=True, help="输入是已清洗的轨迹，跳过清洗步骤")
@click.pass_context
def export(
    ctx,
    file_path: str,
    output_dir: Optional[str],
    fmt: tuple,
    base_name: Optional[str],
    comparison: Optional[str],
    checkpoints: Optional[str],
    cleaned: bool,
):
    """导出清洗后的轨迹和报告 - GPX、GeoJSON、Markdown报告、CSV摘要"""
    config = ctx.obj["config"]
    source_path = Path(file_path)
    
    if output_dir:
        out_dir = Path(output_dir)
    else:
        out_dir = Path(config.default_export_dir)
    
    out_dir.mkdir(parents=True, exist_ok=True)
    console.print(f"[cyan]导出目录: {out_dir}[/cyan]")
    
    console.print(f"[cyan]解析轨迹: {source_path.name}[/cyan]")
    parser_class = get_parser_for_file(source_path)
    parser = parser_class()
    track = parser.parse(source_path)
    
    cleaned_track_obj = None
    if not cleaned:
        rule_results = apply_all_rules(track, config)
        plan = create_clean_plan(track, config, rule_results)
        cleaned_track_obj = execute_clean_plan(plan)
        
        summary = plan.get_summary()
        console.print(f"[green]清洗摘要: 原始 {summary['original_points']} 点 -> 清洗后 {len(cleaned_track_obj.all_points)} 点[/green]")
    else:
        console.print("[yellow]跳过清洗步骤，直接使用输入轨迹[/yellow]")
        from track_cleaner.cleaning import CleanPlan
        fake_plan = create_clean_plan(track, config, [])
        cleaned_track_obj = CleanedTrack(
            original_track=track,
            clean_plan=fake_plan,
            segments=track.segments,
        )
    
    checkpoints_list = []
    actual_checked_cps = []
    if checkpoints:
        cp_path = Path(checkpoints)
        checkpoints_list = load_checkpoints_from_csv(cp_path)
        actual_checked_cps = check_checkpoints(track, checkpoints_list)
        console.print(f"[green]已加载 {len(checkpoints_list)} 个检查点[/green]")
    
    track_summary = calculate_summary(track, 1.0, actual_checked_cps if actual_checked_cps else None)
    
    comparison_result = None
    if comparison:
        planned_path = Path(comparison)
        parser_class2 = get_parser_for_file(planned_path)
        parser2 = parser_class2()
        planned = parser2.parse(planned_path)
        
        comparison_result = compare_tracks(
            planned,
            track,
            checkpoints_list if checkpoints_list else None,
            50.0,
            10.0,
            actual_checked_cps if actual_checked_cps else None,
        )
        console.print(f"[green]已加载计划路线用于对比[/green]")
    
    export_formats = list(fmt)
    if "all" in export_formats:
        export_formats = ["gpx", "geojson", "markdown", "csv"]
    
    console.print(f"[cyan]导出格式: {export_formats}[/cyan]")
    
    from track_cleaner.reports.exporter import (
        export_to_gpx,
        export_to_geojson,
        export_to_markdown,
        export_to_csv_summary,
    )
    
    output_name = base_name or track.name or "track"
    output_name = output_name.replace(" ", "_").replace("/", "_").replace("\\", "_")
    
    export_track = track
    export_track.segments = cleaned_track_obj.segments
    
    exported_files = {}
    
    if "gpx" in export_formats:
        try:
            gpx_path = out_dir / f"{output_name}.gpx"
            export_to_gpx(export_track, gpx_path)
            exported_files["gpx"] = gpx_path
            console.print(f"[green]✓ GPX: {gpx_path}[/green]")
        except Exception as e:
            console.print(f"[red]✗ GPX 导出失败: {e}[/red]")
    
    if "geojson" in export_formats:
        try:
            geojson_path = out_dir / f"{output_name}.geojson"
            export_to_geojson(export_track, geojson_path)
            exported_files["geojson"] = geojson_path
            console.print(f"[green]✓ GeoJSON: {geojson_path}[/green]")
        except Exception as e:
            console.print(f"[red]✗ GeoJSON 导出失败: {e}[/red]")
    
    if "markdown" in export_formats:
        try:
            md_path = out_dir / f"{output_name}_report.md"
            export_to_markdown(
                track_summary,
                md_path,
                cleaned_track_obj.clean_plan.get_summary(),
                comparison_result,
            )
            exported_files["markdown"] = md_path
            console.print(f"[green]✓ Markdown: {md_path}[/green]")
        except Exception as e:
            console.print(f"[red]✗ Markdown 导出失败: {e}[/red]")
    
    if "csv" in export_formats:
        try:
            csv_path = out_dir / f"{output_name}_summary.csv"
            export_to_csv_summary(track_summary, csv_path)
            exported_files["csv"] = csv_path
            console.print(f"[green]✓ CSV: {csv_path}[/green]")
        except Exception as e:
            console.print(f"[red]✗ CSV 导出失败: {e}[/red]")
    
    data_dir = Path(config.data_dir)
    db = HistoryDatabase(data_dir / config.history_db)
    db.add_record(
        task_name=output_name,
        task_type="export",
        source_file=str(source_path),
        summary={
            "exported_files": {k: str(v) for k, v in exported_files.items()},
            "formats": export_formats,
            "output_dir": str(out_dir),
        },
    )
    
    console.print(f"\n[green]导出完成！共导出 {len(exported_files)} 个文件[/green]")


@main.command()
@click.option("--task-type", type=click.Choice(["import", "clean", "summary", "compare", "export", "all"]), default="all", help="筛选任务类型")
@click.option("--limit", type=int, default=20, help="显示最近的 N 条记录，默认: 20")
@click.option("--offset", type=int, default=0, help="偏移量，用于分页，默认: 0")
@click.option("--id", "record_id", type=int, help="查看指定 ID 的详细记录")
@click.pass_context
def history(ctx, task_type: str, limit: int, offset: int, record_id: Optional[int]):
    """查询历史清洗任务"""
    config = ctx.obj["config"]
    data_dir = Path(config.data_dir)
    db = HistoryDatabase(data_dir / config.history_db)
    
    if record_id is not None:
        record = db.get_record(record_id)
        if not record:
            console.print(f"[red]未找到 ID 为 {record_id} 的记录[/red]")
            ctx.exit(1)
        
        console.print(Panel.fit(
            f"[cyan]记录 ID: {record.id}[/cyan]",
            title="历史记录详情",
        ))
        
        table = Table()
        table.add_column("属性", style="cyan")
        table.add_column("值", style="green")
        table.add_row("任务名称", record.task_name)
        table.add_row("任务类型", record.task_type)
        table.add_row("源文件", record.source_file)
        table.add_row("创建时间", str(record.created_at))
        console.print(table)
        
        if record.summary:
            console.print("\n[cyan]摘要数据:[/cyan]")
            try:
                import json
                console.print(json.dumps(record.summary, ensure_ascii=False, indent=2))
            except Exception:
                console.print(record.summary)
        return
    
    filter_type = None if task_type == "all" else task_type
    total = db.count_records(filter_type)
    records = db.get_records(filter_type, limit, offset)
    
    if not records:
        console.print("[yellow]暂无历史记录[/yellow]")
        return
    
    console.print(f"[cyan]共 {total} 条记录，显示第 {offset + 1}-{offset + len(records)} 条[/cyan]")
    
    table = Table(title="历史记录")
    table.add_column("ID", style="dim")
    table.add_column("任务名称", style="cyan")
    table.add_column("类型", style="yellow")
    table.add_column("源文件", style="green")
    table.add_column("创建时间", style="white")
    
    for record in records:
        table.add_row(
            str(record.id),
            record.task_name,
            record.task_type,
            record.source_file[:40] + "..." if len(record.source_file) > 40 else record.source_file,
            str(record.created_at)[:19] if record.created_at else "-",
        )
    
    console.print(table)


if __name__ == "__main__":
    main()
