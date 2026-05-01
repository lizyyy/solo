import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

try:
    import gpxpy
    import gpxpy.gpx
    GPXPY_AVAILABLE = True
except ImportError:
    GPXPY_AVAILABLE = False

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from track_cleaner.models.track import Track, TrackPoint, TrackSegment
from track_cleaner.cleaning import CleanedTrack
from track_cleaner.reports.summary import TrackSummary
from track_cleaner.reports.comparison import ComparisonResult


def export_to_gpx(
    track: Track,
    output_path: Path,
) -> Path:
    if not GPXPY_AVAILABLE:
        raise ImportError("gpxpy 库未安装，请运行: pip install gpxpy")
    
    gpx = gpxpy.gpx.GPX()
    
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_track.name = track.name
    gpx.tracks.append(gpx_track)
    
    for segment in track.segments:
        gpx_segment = gpxpy.gpx.GPXTrackSegment()
        gpx_track.segments.append(gpx_segment)
        
        for point in segment.points:
            gpx_point = gpxpy.gpx.GPXTrackPoint(
                latitude=point.latitude,
                longitude=point.longitude,
                elevation=point.elevation,
                time=point.timestamp,
            )
            gpx_segment.points.append(gpx_point)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(gpx.to_xml())
    
    return output_path


def export_to_geojson(
    track: Track,
    output_path: Path,
) -> Path:
    features = []
    
    for seg_idx, segment in enumerate(track.segments):
        if len(segment.points) >= 2:
            coordinates = []
            for point in segment.points:
                coord = [point.longitude, point.latitude]
                if point.elevation is not None:
                    coord.append(point.elevation)
                coordinates.append(coord)
            
            feature = {
                "type": "Feature",
                "properties": {
                    "name": segment.name or f"Segment {seg_idx + 1}",
                    "point_count": len(segment.points),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coordinates,
                },
            }
            features.append(feature)
        
        for pt_idx, point in enumerate(segment.points):
            coord = [point.longitude, point.latitude]
            if point.elevation is not None:
                coord.append(point.elevation)
            
            properties = {
                "type": "waypoint",
                "segment_idx": seg_idx,
                "point_idx": pt_idx,
            }
            if point.timestamp:
                properties["timestamp"] = point.timestamp.isoformat()
            if point.elevation is not None:
                properties["elevation"] = point.elevation
            
            feature = {
                "type": "Feature",
                "properties": properties,
                "geometry": {
                    "type": "Point",
                    "coordinates": coord,
                },
            }
            features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "name": track.name,
        "features": features,
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    return output_path


def export_to_markdown(
    summary: TrackSummary,
    output_path: Path,
    clean_plan_summary: Optional[Dict[str, Any]] = None,
    comparison: Optional[ComparisonResult] = None,
) -> Path:
    lines = []
    
    lines.append(f"# {summary.track_name}")
    lines.append("")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    lines.append("## 行程摘要")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 总距离 | {summary.total_distance_km:.2f} 公里 |")
    lines.append(f"| 总时间 | {summary.total_time_hours:.2f} 小时 |")
    lines.append(f"| 移动时间 | {summary.moving_time_hours:.2f} 小时 |")
    lines.append(f"| 停留时间 | {summary.stopped_time_hours:.2f} 小时 |")
    lines.append(f"| 累计爬升 | {summary.elevation_gain_m:.1f} 米 |")
    lines.append(f"| 累计下降 | {summary.elevation_loss_m:.1f} 米 |")
    lines.append(f"| 平均速度 | {summary.average_speed_kmh:.2f} 公里/小时 |")
    lines.append(f"| 移动速度 | {summary.moving_speed_kmh:.2f} 公里/小时 |")
    lines.append(f"| 轨迹点数 | {summary.point_count} |")
    lines.append(f"| 轨迹段数 | {summary.segment_count} |")
    if summary.start_time:
        lines.append(f"| 开始时间 | {summary.start_time.strftime('%Y-%m-%d %H:%M:%S')} |")
    if summary.end_time:
        lines.append(f"| 结束时间 | {summary.end_time.strftime('%Y-%m-%d %H:%M:%S')} |")
    lines.append("")
    
    if summary.checkpoints:
        lines.append("## 检查点")
        lines.append("")
        lines.append("| 检查点 | 状态 | 最近距离 | 到达时间 |")
        lines.append("|--------|------|----------|----------|")
        for cp in summary.checkpoints:
            status = "✓ 已经过" if cp.visited else "✗ 未经过"
            dist_str = f"{cp.distance_to_checkpoint:.1f}m" if cp.distance_to_checkpoint is not None else "-"
            time_str = cp.visited_time.strftime('%Y-%m-%d %H:%M:%S') if cp.visited_time else "-"
            lines.append(f"| {cp.name} | {status} | {dist_str} | {time_str} |")
        lines.append("")
    
    if clean_plan_summary:
        lines.append("## 清洗摘要")
        lines.append("")
        lines.append(f"原始点数: {clean_plan_summary.get('original_points', 0)}")
        lines.append(f"移除点数: {clean_plan_summary.get('points_to_remove', 0)}")
        lines.append(f"分段数: {clean_plan_summary.get('split_points', 0)}")
        lines.append(f"警告数: {clean_plan_summary.get('warnings', 0)}")
        
        by_rule = clean_plan_summary.get('by_rule', {})
        if by_rule:
            lines.append("")
            lines.append("### 按规则分类")
            lines.append("")
            for rule, count in by_rule.items():
                lines.append(f"- {rule}: {count}")
        lines.append("")
    
    if comparison:
        lines.append("## 路线对比")
        lines.append("")
        
        if comparison.deviations:
            lines.append(f"### 偏离路段 ({len(comparison.deviations)} 处)")
            lines.append("")
            for i, dev in enumerate(comparison.deviations):
                lines.append(f"#### 偏离段 {i + 1}")
                lines.append(f"- 点范围: {dev.start_point_index} - {dev.end_point_index}")
                lines.append(f"- 最大偏离: {dev.max_deviation_meters:.1f} 米")
                lines.append(f"- 平均偏离: {dev.avg_deviation_meters:.1f} 米")
                lines.append(f"- 偏离距离: {dev.distance_km:.2f} 公里")
                lines.append("")
        
        if comparison.missing_checkpoints:
            lines.append(f"### 遗漏检查点 ({len(comparison.missing_checkpoints)} 个)")
            lines.append("")
            for cp in comparison.missing_checkpoints:
                lines.append(f"- {cp.name} ({cp.latitude:.5f}, {cp.longitude:.5f})")
            lines.append("")
        
        if comparison.long_stops:
            lines.append(f"### 异常停留 ({len(comparison.long_stops)} 处)")
            lines.append("")
            for i, stop in enumerate(comparison.long_stops):
                lines.append(f"#### 停留 {i + 1}")
                lines.append(f"- 位置: ({stop.location[0]:.5f}, {stop.location[1]:.5f})")
                lines.append(f"- 时长: {stop.duration_seconds / 60:.1f} 分钟")
                if stop.start_time:
                    lines.append(f"- 开始: {stop.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
                if stop.end_time:
                    lines.append(f"- 结束: {stop.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append("")
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    
    return output_path


def export_to_csv_summary(
    summary: TrackSummary,
    output_path: Path,
) -> Path:
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas 库未安装，请运行: pip install pandas")
    
    data = {
        "metric": [
            "track_name",
            "total_distance_km",
            "total_time_hours",
            "moving_time_hours",
            "stopped_time_hours",
            "elevation_gain_m",
            "elevation_loss_m",
            "average_speed_kmh",
            "moving_speed_kmh",
            "point_count",
            "segment_count",
        ],
        "value": [
            summary.track_name,
            round(summary.total_distance_km, 2),
            round(summary.total_time_hours, 2),
            round(summary.moving_time_hours, 2),
            round(summary.stopped_time_hours, 2),
            round(summary.elevation_gain_m, 1),
            round(summary.elevation_loss_m, 1),
            round(summary.average_speed_kmh, 2),
            round(summary.moving_speed_kmh, 2),
            summary.point_count,
            summary.segment_count,
        ],
    }
    
    df = pd.DataFrame(data)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False, encoding="utf-8")
    
    return output_path


def export_all(
    cleaned_track: CleanedTrack,
    summary: TrackSummary,
    output_dir: Path,
    base_filename: Optional[str] = None,
    comparison: Optional[ComparisonResult] = None,
) -> Dict[str, Path]:
    if base_filename is None:
        base_filename = cleaned_track.original_track.name
        if not base_filename:
            base_filename = "track_cleaned"
    
    base_filename = base_filename.replace(" ", "_").replace("/", "_").replace("\\", "_")
    
    results = {}
    
    original_track = Track(
        name=cleaned_track.original_track.name,
        segments=cleaned_track.segments,
        source_file=cleaned_track.original_track.source_file,
        source_format=cleaned_track.original_track.source_format,
    )
    
    gpx_path = output_dir / f"{base_filename}.gpx"
    try:
        results["gpx"] = export_to_gpx(original_track, gpx_path)
    except ImportError:
        pass
    
    geojson_path = output_dir / f"{base_filename}.geojson"
    results["geojson"] = export_to_geojson(original_track, geojson_path)
    
    md_path = output_dir / f"{base_filename}_report.md"
    results["markdown"] = export_to_markdown(
        summary,
        md_path,
        cleaned_track.clean_plan.get_summary() if cleaned_track.clean_plan else None,
        comparison,
    )
    
    try:
        csv_path = output_dir / f"{base_filename}_summary.csv"
        results["csv_summary"] = export_to_csv_summary(summary, csv_path)
    except ImportError:
        pass
    
    return results
