"""
Exporter module - generates audit_report.md, gaps.csv, timeline.html.
"""
from __future__ import annotations
import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Union

from .parser import ParsedData, Clip
from .validator import ValidationResult, Issue, CameraTimeline


def export_audit_report(
    result: ValidationResult,
    data: ParsedData,
    output_path: Union[str, Path],
    rules: dict[str, Any],
) -> None:
    lines = [
        "# NVR 监控录像审计报告",
        "",
        f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## 概览",
        "",
        f"| 指标 | 数量 |",
        f"|------|------|",
        f"| 摄像头数 | {len(result.timelines)} |",
        f"| 片段总数 | {len(data.clips)} |",
        f"| 断档数 | {result.gap_count} |",
        f"| 重叠数 | {result.overlap_count} |",
        f"| 时钟回拨数 | {result.clock_rewind_count} |",
        f"| 低码率数 | {result.low_bitrate_count} |",
        f"| 疑似缺帧数 | {result.suspected_dropped_frames_count} |",
        "",
        "## 规则阈值",
        "",
    ]
    t = rules.get("thresholds", {})
    lines += [
        f"- 低码率阈值: {t.get('low_bitrate_kbps', 256)} kbps",
        f"- 缺帧判定间隙: {t.get('frame_drop_gap_sec', 2.0)} s",
        f"- 重叠容差: {t.get('overlap_tolerance_sec', 0.5)} s",
    ]
    lines += ["", "## 问题清单", ""]

    if not result.all_issues:
        lines.append("* 未发现问题 *")
    else:
        lines.append("| 摄像头 | 类型 | 严重级别 | 详情 | 时间戳 |")
        lines.append("|--------|------|----------|------|--------|")
        for iss in result.all_issues:
            lines.append(
                f"| {iss.camera_id} | {iss.issue_type} | {iss.severity} | "
                f"{iss.detail} | {iss.timestamp or '-'} |"
            )

    lines += ["", "## 各摄像头时间线", ""]
    for cid, tl in result.timelines.items():
        lines.append(f"### 摄像头: {cid}")
        lines.append("")
        if not tl.issues:
            lines.append("* 此摄像头未发现问题 *")
        else:
            lines.append("| 片段 | 开始时间 | 结束时间 | 时长 | 问题 |")
            lines.append("|------|----------|----------|------|------|")
            for clip in tl.clips:
                clip_issues = [i.issue_type for i in tl.issues
                               if i.timestamp and clip.start_time <= i.timestamp <= clip.end_time]
                issue_str = "; ".join(clip_issues) if clip_issues else "-"
                try:
                    s = _parse_ts(clip.start_time)
                    e = _parse_ts(clip.end_time)
                    dur = (e - s).total_seconds()
                    dur_str = f"{dur:.1f}s"
                except Exception:
                    dur_str = f"{clip.duration:.1f}s"
                lines.append(
                    f"| {clip.filename} | {clip.start_time} | {clip.end_time} "
                    f"| {dur_str} | {issue_str} |"
                )
        lines.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def export_gaps_csv(
    result: ValidationResult,
    output_path: Union[str, Path],
) -> None:
    gap_issues = [i for i in result.all_issues if i.issue_type == "gap"]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["camera_id", "gap_start", "gap_end", "gap_duration_sec", "detail"])
        for iss in gap_issues:
            parts = iss.detail.split(" between ")[-1].split(" and ")
            before_clip = parts[0] if len(parts) > 0 else ""
            after_clip = parts[1] if len(parts) > 1 else ""
            gap_str = ""
            if "Gap of " in iss.detail and "s between" in iss.detail:
                gap_str = iss.detail.split("Gap of ")[1].split("s")[0]
            writer.writerow([
                iss.camera_id,
                before_clip.strip(),
                after_clip.strip(),
                gap_str.strip(),
                iss.detail,
            ])


def export_timeline_html(
    result: ValidationResult,
    data: ParsedData,
    output_path: Union[str, Path],
) -> None:
    camera_ids = sorted(result.timelines.keys())
    rows = ""
    for cid in camera_ids:
        tl = result.timelines[cid]
        for clip in tl.clips:
            try:
                s = _parse_ts(clip.start_time)
                e = _parse_ts(clip.end_time)
                dur = (e - s).total_seconds()
            except Exception:
                dur = clip.duration
            probe = data.ffprobe_summaries.get(clip.filename)
            bitrate_str = str(probe.bitrate) if probe else "-"
            fps_str = f"{probe.fps:.2f}" if probe and probe.fps else "-"
            clip_issues = [i.issue_type for i in tl.issues
                           if i.timestamp and clip.start_time <= i.timestamp <= clip.end_time]
            issue_badge = ""
            for itype in clip_issues:
                badge_cls = {"gap": "warn", "overlap": "error", "clock_rewind": "error",
                             "low_bitrate": "warn", "suspected_dropped_frames": "info"}.get(itype, "")
                issue_badge += f'<span class="badge {badge_cls}">{itype}</span> '
            rows += f"""
            <tr>
                <td>{cid}</td>
                <td>{clip.filename}</td>
                <td>{clip.start_time}</td>
                <td>{clip.end_time}</td>
                <td>{dur:.1f}s</td>
                <td>{bitrate_str}</td>
                <td>{fps_str}</td>
                <td>{issue_badge or '-'}</td>
            </tr>
"""

    html = f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>NVR 监控时间线审计</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 20px; }}
h1 {{ color: #333; }}
table {{ border-collapse: collapse; width: 100%; margin-top: 20px; }}
th, td {{ border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }}
th {{ background: #f5f5f5; }}
tr:hover {{ background: #fafafa; }}
.badge {{ padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 4px; }}
.error {{ background: #ffe0e0; color: #c00; }}
.warn {{ background: #fff3cd; color: #856404; }}
.info {{ background: #e0f0ff; color: #0066cc; }}
.summary {{ margin-bottom: 20px; }}
.summary span {{ margin-right: 20px; }}
</style>
</head>
<body>
<h1>NVR 监控时间线审计</h1>
<div class="summary">
  <span><strong>摄像头数:</strong> {len(camera_ids)}</span>
  <span><strong>片段总数:</strong> {len(data.clips)}</span>
  <span><strong>断档:</strong> {result.gap_count}</span>
  <span><strong>重叠:</strong> {result.overlap_count}</span>
  <span><strong>时钟回拨:</strong> {result.clock_rewind_count}</span>
  <span><strong>低码率:</strong> {result.low_bitrate_count}</span>
  <span><strong>疑似缺帧:</strong> {result.suspected_dropped_frames_count}</span>
</div>
<table>
<thead>
<tr>
  <th>摄像头ID</th>
  <th>文件名</th>
  <th>开始时间</th>
  <th>结束时间</th>
  <th>时长</th>
  <th>码率(kbps)</th>
  <th>帧率</th>
  <th>问题标记</th>
</tr>
</thead>
<tbody>
{rows}
</tbody>
</table>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def export_all(
    result: ValidationResult,
    data: ParsedData,
    rules: dict[str, Any],
    output_dir: Union[str, Path],
) -> dict[str, Path]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    md_path = output_dir / "audit_report.md"
    export_audit_report(result, data, md_path, rules)
    paths["audit_report.md"] = md_path

    gaps_path = output_dir / "gaps.csv"
    export_gaps_csv(result, gaps_path)
    paths["gaps.csv"] = gaps_path

    html_path = output_dir / "timeline.html"
    export_timeline_html(result, data, html_path)
    paths["timeline.html"] = html_path

    return paths


def _parse_ts(ts: str) -> datetime:
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            pass
    raise ValueError(f"Cannot parse timestamp: {ts}")
