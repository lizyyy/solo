import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from .parser import Intersection, PhasePlan, Rules
from .timeline import TimelineEvent
from .rules import Issue


def export_issues_csv(issues: List[Issue], output_path: str) -> None:
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "timestamp",
            "intersection_id",
            "issue_type",
            "severity",
            "description",
            "details",
            "phase_id",
            "plan_id",
        ])
        
        for issue in issues:
            writer.writerow([
                issue.timestamp.isoformat(),
                issue.intersection_id,
                issue.issue_type,
                issue.severity,
                issue.description,
                issue.details,
                issue.phase_id if issue.phase_id else "",
                issue.plan_id if issue.plan_id else "",
            ])


def export_signal_report_md(
    issues: List[Issue],
    intersections: Dict[str, Intersection],
    phase_plans: Dict[str, List[PhasePlan]],
    rules: Rules,
    analysis_date: datetime,
    output_path: str,
) -> None:
    lines = []
    
    lines.append("# 交通信号配时分析报告")
    lines.append("")
    lines.append(f"**分析日期**: {analysis_date.date().isoformat()}")
    lines.append(f"**生成时间**: {datetime.now().isoformat()}")
    lines.append("")
    
    high_count = sum(1 for i in issues if i.severity == "high")
    medium_count = sum(1 for i in issues if i.severity == "medium")
    info_count = sum(1 for i in issues if i.severity == "info")
    
    lines.append("## 问题概览")
    lines.append("")
    lines.append(f"- **高优先级问题**: {high_count} 个")
    lines.append(f"- **中优先级问题**: {medium_count} 个")
    lines.append(f"- **信息提示**: {info_count} 个")
    lines.append("")
    
    lines.append("## 规则配置")
    lines.append("")
    lines.append(f"- 行人清空时间最小值: {rules.pedestrian_clearance_min} 秒")
    lines.append(f"- 公交优先最大影响时间: {rules.bus_priority_max_impact} 秒")
    lines.append(f"- 检测器断采阈值: {rules.detector_gap_threshold} 秒")
    lines.append(f"- 午夜切换宽限时间: {rules.midnight_transition_grace} 秒")
    lines.append("")
    
    lines.append("## 路口概览")
    lines.append("")
    for intersection_id, intersection in intersections.items():
        plans = phase_plans.get(intersection_id, [])
        lines.append(f"### {intersection.name} ({intersection.id})")
        lines.append(f"- 位置: {intersection.location}")
        lines.append(f"- 相位总数: {intersection.total_phases}")
        if intersection.pedestrian_phases:
            lines.append(f"- 行人相位: {', '.join(map(str, intersection.pedestrian_phases))}")
        if intersection.bus_phases:
            lines.append(f"- 公交优先相位: {', '.join(map(str, intersection.bus_phases))}")
        lines.append(f"- 配时计划数: {len(plans)}")
        lines.append("")
    
    if issues:
        lines.append("## 问题详情")
        lines.append("")
        
        issues_by_intersection: Dict[str, List[Issue]] = {}
        for issue in issues:
            if issue.intersection_id not in issues_by_intersection:
                issues_by_intersection[issue.intersection_id] = []
            issues_by_intersection[issue.intersection_id].append(issue)
        
        for intersection_id, intersection_issues in issues_by_intersection.items():
            intersection = intersections.get(intersection_id)
            name = intersection.name if intersection else intersection_id
            
            lines.append(f"### {name} ({intersection_id})")
            lines.append("")
            lines.append("| 时间 | 类型 | 严重程度 | 描述 |")
            lines.append("|------|------|----------|------|")
            
            for issue in intersection_issues:
                severity_icon = {
                    "high": "🔴 高",
                    "medium": "🟡 中",
                    "low": "🟢 低",
                    "info": "ℹ️ 信息",
                }.get(issue.severity, issue.severity)
                
                lines.append(
                    f"| {issue.timestamp.strftime('%H:%M:%S')} | "
                    f"{issue.issue_type} | "
                    f"{severity_icon} | "
                    f"{issue.description} |"
                )
            
            lines.append("")
            
            lines.append("#### 详细信息")
            lines.append("")
            for issue in intersection_issues:
                lines.append(f"- **{issue.timestamp.strftime('%H:%M:%S')}**: {issue.details}")
            lines.append("")
    
    else:
        lines.append("## 问题详情")
        lines.append("")
        lines.append("本次分析未发现任何问题。")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append("*此报告由 signal_replay 工具自动生成*")
    
    content = "\n".join(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)


def export_timeline_html(
    timelines: Dict[str, List[TimelineEvent]],
    intersections: Dict[str, Intersection],
    issues: List[Issue],
    output_path: str,
) -> None:
    phase_colors = [
        "#4CAF50", "#2196F3", "#FF9800", "#F44336",
        "#9C27B0", "#00BCD4", "#8BC34A", "#FF5722",
    ]
    
    issues_by_time_and_intersection: Dict[str, Dict[str, List[Issue]]] = {}
    for issue in issues:
        time_key = issue.timestamp.strftime("%H:%M:%S")
        if time_key not in issues_by_time_and_intersection:
            issues_by_time_and_intersection[time_key] = {}
        if issue.intersection_id not in issues_by_time_and_intersection[time_key]:
            issues_by_time_and_intersection[time_key][issue.intersection_id] = []
        issues_by_time_and_intersection[time_key][issue.intersection_id].append(issue)
    
    html_parts = []
    
    html_parts.append('''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>交通信号时间线</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: #1976D2; color: white; padding: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .timeline-container { padding: 20px; overflow-x: auto; }
        .time-axis { display: flex; margin-bottom: 10px; padding-left: 180px; }
        .time-marker { width: 240px; text-align: center; font-size: 12px; color: #666; border-left: 1px solid #ddd; }
        .intersection-row { display: flex; margin-bottom: 8px; }
        .intersection-label { width: 180px; min-width: 180px; padding: 8px; background: #fafafa; border-right: 1px solid #ddd; font-weight: 600; font-size: 13px; }
        .phases-container { display: flex; position: relative; min-height: 40px; }
        .phase-block { height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 500; position: relative; cursor: pointer; transition: opacity 0.2s; }
        .phase-block:hover { opacity: 0.8; }
        .phase-block.pedestrian { border-top: 3px solid #FFD700; }
        .phase-block.bus { border-top: 3px solid #FF4081; }
        .issue-marker { position: absolute; width: 12px; height: 12px; border-radius: 50%; top: -6px; z-index: 10; }
        .issue-marker.high { background: #F44336; }
        .issue-marker.medium { background: #FF9800; }
        .issue-marker.info { background: #2196F3; }
        .legend { display: flex; gap: 20px; padding: 15px 20px; background: #fafafa; border-top: 1px solid #eee; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .legend-color { width: 20px; height: 20px; border-radius: 4px; }
        .stats { padding: 15px 20px; background: #fafafa; border-bottom: 1px solid #eee; display: flex; gap: 30px; }
        .stat-item { display: flex; flex-direction: column; }
        .stat-value { font-size: 24px; font-weight: 700; color: #1976D2; }
        .stat-label { font-size: 12px; color: #666; margin-top: 4px; }
        .tooltip { position: absolute; background: rgba(0,0,0,0.85); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 100; display: none; }
        .phase-block:hover .tooltip { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>交通信号时间线</h1>
            <p>按路口重放一整天的相位时间线</p>
        </div>
''')
    
    total_intersections = len(intersections)
    total_phases = sum(len([e for e in tl if e.event_type == "PHASE_START"]) for tl in timelines.values())
    total_issues = len(issues)
    
    html_parts.append(f'''        <div class="stats">
            <div class="stat-item">
                <span class="stat-value">{total_intersections}</span>
                <span class="stat-label">路口数量</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">{total_phases}</span>
                <span class="stat-label">相位变更次数</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">{total_issues}</span>
                <span class="stat-label">检测到的问题</span>
            </div>
        </div>
''')
    
    html_parts.append('''        <div class="timeline-container">
            <div class="time-axis">
''')
    
    for hour in range(0, 24, 2):
        html_parts.append(f'                <div class="time-marker">{hour:02d}:00</div>\n')
    
    html_parts.append('''            </div>
''')
    
    total_seconds = 86400
    display_width = 24 * 120
    
    for intersection_id, timeline in timelines.items():
        intersection = intersections.get(intersection_id)
        name = intersection.name if intersection else intersection_id
        
        html_parts.append(f'''            <div class="intersection-row">
                <div class="intersection-label">{name}</div>
                <div class="phases-container" style="width: {display_width}px;">
''')
        
        current_second = 0
        for i, event in enumerate(timeline):
            if event.event_type == "PHASE_START":
                end_event = None
                for j in range(i + 1, len(timeline)):
                    if (
                        timeline[j].event_type == "PHASE_END"
                        and timeline[j].phase_id == event.phase_id
                    ):
                        end_event = timeline[j]
                        break
                
                if end_event:
                    start_seconds = int((event.timestamp - event.timestamp.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds())
                    duration = end_event.duration or 0
                    color_index = (event.phase_id or 0) % len(phase_colors)
                    color = phase_colors[color_index]
                    
                    left_pct = (start_seconds / total_seconds) * 100
                    width_pct = (duration / total_seconds) * 100
                    
                    extra_classes = []
                    if event.is_pedestrian:
                        extra_classes.append("pedestrian")
                    if event.is_bus_priority:
                        extra_classes.append("bus")
                    class_str = " ".join(extra_classes)
                    
                    pedestrian_label = " (行人)" if event.is_pedestrian else ""
                    bus_label = " (公交优先)" if event.is_bus_priority else ""
                    
                    html_parts.append(f'''                    <div class="phase-block {class_str}" style="width: {width_pct}%; background: {color};">
                        <span class="tooltip">相位 {event.phase_id}{pedestrian_label}{bus_label}<br>开始: {event.timestamp.strftime('%H:%M:%S')}<br>时长: {duration}秒</span>
                        {event.phase_id}
                    </div>
''')
        
        time_key = "00:00:00"
        if time_key in issues_by_time_and_intersection and intersection_id in issues_by_time_and_intersection[time_key]:
            for issue in issues_by_time_and_intersection[time_key][intersection_id]:
                issue_seconds = int((issue.timestamp - issue.timestamp.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds())
                issue_left = (issue_seconds / total_seconds) * 100
                html_parts.append(f'''                    <div class="issue-marker {issue.severity}" style="left: {issue_left}%;" title="{issue.description}"></div>
''')
        
        html_parts.append('''                </div>
            </div>
''')
    
    html_parts.append('''        </div>
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #FFD700; border-top: 3px solid #FFD700; height: 3px; width: 30px;"></div>
                <span>行人相位</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #FF4081; border-top: 3px solid #FF4081; height: 3px; width: 30px;"></div>
                <span>公交优先相位</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #F44336;"></div>
                <span>高优先级问题</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #FF9800;"></div>
                <span>中优先级问题</span>
            </div>
        </div>
    </div>
</body>
</html>
''')
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("".join(html_parts))


def export_all(
    issues: List[Issue],
    intersections: Dict[str, Intersection],
    phase_plans: Dict[str, List[PhasePlan]],
    timelines: Dict[str, List[TimelineEvent]],
    rules: Rules,
    analysis_date: datetime,
    output_dir: str,
) -> Dict[str, str]:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    issues_csv = str(output_path / "issues.csv")
    export_issues_csv(issues, issues_csv)
    
    signal_report_md = str(output_path / "signal_report.md")
    export_signal_report_md(
        issues,
        intersections,
        phase_plans,
        rules,
        analysis_date,
        signal_report_md,
    )
    
    timeline_html = str(output_path / "timeline.html")
    export_timeline_html(timelines, intersections, issues, timeline_html)
    
    return {
        "issues_csv": issues_csv,
        "signal_report_md": signal_report_md,
        "timeline_html": timeline_html,
    }
