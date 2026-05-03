from pathlib import Path
from typing import List, Dict, Any
import csv
from datetime import datetime

from .analysis import TransferAnalysis, AnalysisSummary


def _format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        return f"{seconds/60:.1f}m"
    else:
        return f"{seconds/3600:.1f}h"


def export_issues_csv(analyses: List[TransferAnalysis], output_path: Path) -> None:
    all_issues = []
    for analysis in analyses:
        for issue in analysis.issues:
            row = {
                'foup_id': analysis.foup_id,
                'issue_type': issue.get('issue_type', ''),
                'description': issue.get('description', ''),
                'timestamp': issue.get('timestamp', ''),
                'node_id': issue.get('node_id', ''),
                'equipment_id': issue.get('equipment_id', ''),
                'reason': issue.get('reason', ''),
                'duration_seconds': issue.get('duration_seconds', ''),
                'source_node': analysis.source_node or '',
                'target_node': analysis.target_node or '',
                'final_status': analysis.final_status.value,
            }
            all_issues.append(row)
    
    if not all_issues:
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'foup_id', 'issue_type', 'description', 'timestamp',
                'node_id', 'equipment_id', 'reason', 'duration_seconds',
                'source_node', 'target_node', 'final_status'
            ])
            writer.writeheader()
        return
    
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = list(all_issues[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in all_issues:
            writer.writerow(row)


def export_report_md(
    summary: AnalysisSummary,
    analyses: List[TransferAnalysis],
    output_path: Path,
    generation_time: datetime
) -> None:
    lines = []
    
    lines.append("# AMHS 堵塞复盘分析报告")
    lines.append("")
    lines.append(f"**生成时间**: {generation_time.isoformat()}")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    lines.append("## 概览")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 总搬运任务数 | {summary.total_transfers} |")
    lines.append(f"| 已完成 | {summary.completed_transfers} |")
    lines.append(f"| 失败 | {summary.failed_transfers} |")
    lines.append(f"| 总排队时间 | {_format_duration(summary.total_queue_time_seconds)} |")
    lines.append(f"| 平均排队时间 | {_format_duration(summary.average_queue_time_seconds)} |")
    lines.append(f"| 受设备停机影响 | {summary.affected_by_downtime} |")
    lines.append(f"| 乱序事件数 | {summary.out_of_order_events} |")
    lines.append("")
    
    lines.append("---")
    lines.append("")
    
    lines.append("## 问题统计")
    lines.append("")
    lines.append(f"**总问题数**: {summary.total_issues}")
    lines.append("")
    lines.append("| 问题类型 | 数量 |")
    lines.append("|----------|------|")
    lines.append(f"| 节点排队 | {summary.node_queue_issues} |")
    lines.append(f"| 绕行失败 | {summary.reroute_failures} |")
    lines.append(f"| 设备占用超时 | {summary.equipment_occupation_issues} |")
    lines.append(f"| 缺少到达事件 | {summary.missing_arrival_issues} |")
    lines.append("")
    
    lines.append("---")
    lines.append("")
    
    lines.append("## 热点节点 (Top 10)")
    lines.append("")
    if summary.hotspot_nodes:
        lines.append("| 节点 | 排队次数 |")
        lines.append("|------|----------|")
        for node, count in list(summary.hotspot_nodes.items())[:10]:
            lines.append(f"| {node} | {count} |")
    else:
        lines.append("无热点节点数据")
    lines.append("")
    
    lines.append("---")
    lines.append("")
    
    lines.append("## 热点设备 (Top 10)")
    lines.append("")
    if summary.hotspot_equipments:
        lines.append("| 设备 | 占用超时次数 |")
        lines.append("|------|--------------|")
        for eq, count in list(summary.hotspot_equipments.items())[:10]:
            lines.append(f"| {eq} | {count} |")
    else:
        lines.append("无热点设备数据")
    lines.append("")
    
    lines.append("---")
    lines.append("")
    
    lines.append("## 详细搬运记录")
    lines.append("")
    
    issues_analyses = [a for a in analyses if len(a.issues) > 0]
    normal_analyses = [a for a in analyses if len(a.issues) == 0]
    
    if issues_analyses:
        lines.append("### 有问题的搬运")
        lines.append("")
        lines.append("| FOUP ID | 起点 | 终点 | 状态 | 问题数 | 排队时间 |")
        lines.append("|---------|------|------|------|--------|----------|")
        for a in sorted(issues_analyses, key=lambda x: len(x.issues), reverse=True):
            lines.append(
                f"| {a.foup_id} | {a.source_node or '-'} | {a.target_node or '-'} | "
                f"{a.final_status.value} | {len(a.issues)} | {_format_duration(a.queue_time_seconds)} |"
            )
        lines.append("")
        
        lines.append("#### 问题详情")
        lines.append("")
        for a in issues_analyses:
            lines.append(f"##### FOUP: {a.foup_id}")
            lines.append("")
            for issue in a.issues:
                ts = issue.get('timestamp', '-')
                itype = issue.get('issue_type', 'unknown')
                desc = issue.get('description', '-')
                lines.append(f"- **[{itype}]** {ts}: {desc}")
            lines.append("")
    
    if normal_analyses:
        lines.append("### 正常完成的搬运")
        lines.append("")
        lines.append("| FOUP ID | 起点 | 终点 | 状态 | 总时长 | 排队时间 |")
        lines.append("|---------|------|------|------|--------|----------|")
        for a in sorted(normal_analyses, key=lambda x: x.foup_id):
            lines.append(
                f"| {a.foup_id} | {a.source_node or '-'} | {a.target_node or '-'} | "
                f"{a.final_status.value} | {_format_duration(a.total_duration_seconds)} | "
                f"{_format_duration(a.queue_time_seconds)} |"
            )
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append("## 数据说明")
    lines.append("")
    lines.append("- **节点排队**: FOUP 在轨道节点等待超过 10 秒")
    lines.append("- **绕行失败**: 动态路径规划失败，无法到达目标")
    lines.append("- **设备占用超时**: 在设备端口等待超过 120 秒")
    lines.append("- **缺少到达事件**: 检测到出发事件但无对应到达事件")
    lines.append("- **乱序事件**: 事件时间戳晚于已处理事件")
    lines.append("")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def export_timeline_html(
    analyses: List[TransferAnalysis],
    summary: AnalysisSummary,
    output_path: Path,
    generation_time: datetime
) -> None:
    all_events = []
    for analysis in analyses:
        for event in analysis.timeline:
            all_events.append({
                'foup_id': analysis.foup_id,
                'timestamp': event['timestamp'],
                'event_type': event['event_type'],
                'node_id': event.get('node_id', ''),
                'target_node': event.get('target_node', ''),
                'equipment_id': event.get('equipment_id', ''),
                'is_issue': any(
                    issue.get('timestamp') == event['timestamp'] 
                    for issue in analysis.issues
                ),
            })
    
    all_events.sort(key=lambda x: x['timestamp'])
    
    all_foups = sorted(set([a.foup_id for a in analyses]))
    
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AMHS 搬运时间线</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; padding: 20px; }}
        .container {{ max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px 30px; }}
        .header h1 {{ font-size: 24px; margin-bottom: 8px; }}
        .header .meta {{ opacity: 0.9; font-size: 14px; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 20px 30px; background: #fafbfc; border-bottom: 1px solid #eaecef; }}
        .stat-card {{ background: white; border-radius: 6px; padding: 16px; border-left: 4px solid #667eea; }}
        .stat-card .label {{ font-size: 12px; color: #6a737d; text-transform: uppercase; letter-spacing: 0.5px; }}
        .stat-card .value {{ font-size: 28px; font-weight: bold; color: #24292e; margin-top: 4px; }}
        .timeline-container {{ padding: 20px 30px; }}
        .controls {{ margin-bottom: 20px; padding: 16px; background: #f6f8fa; border-radius: 6px; }}
        .controls label {{ margin-right: 20px; font-size: 14px; cursor: pointer; }}
        .controls input {{ margin-right: 6px; }}
        .search-box {{ margin-top: 12px; }}
        .search-box input {{ padding: 8px 12px; border: 1px solid #e1e4e8; border-radius: 6px; width: 300px; font-size: 14px; }}
        .timeline {{ position: relative; }}
        .timeline-header {{ display: grid; grid-template-columns: 150px 1fr; background: #f6f8fa; padding: 10px 0; font-weight: bold; font-size: 13px; color: #586069; border-bottom: 2px solid #e1e4e8; }}
        .timeline-row {{ display: grid; grid-template-columns: 150px 1fr; border-bottom: 1px solid #eaecef; }}
        .foup-label {{ padding: 12px 8px; font-weight: 600; font-size: 13px; color: #24292e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
        .foup-label.has-issues {{ color: #d73a4a; }}
        .events-track {{ position: relative; padding: 12px 0; min-height: 40px; }}
        .event-marker {{ position: absolute; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; border-radius: 50%; cursor: pointer; z-index: 10; transition: transform 0.15s, box-shadow 0.15s; }}
        .event-marker:hover {{ transform: translateY(-50%) scale(1.5); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }}
        .event-marker.task_created {{ background: #959da5; }}
        .event-marker.assigned {{ background: #0366d6; }}
        .event-marker.departed {{ background: #28a745; }}
        .event-marker.arrived {{ background: #6f42c1; }}
        .event-marker.queue_start {{ background: #f66a0a; }}
        .event-marker.queue_end {{ background: #f66a0a; opacity: 0.6; }}
        .event-marker.reroute {{ background: #d73a4a; }}
        .event-marker.reroute_failed {{ background: #cb2431; }}
        .event-marker.load_start {{ background: #005cc5; }}
        .event-marker.load_end {{ background: #005cc5; opacity: 0.6; }}
        .event-marker.unload_start {{ background: #005cc5; }}
        .event-marker.unload_end {{ background: #005cc5; opacity: 0.6; }}
        .event-marker.completed {{ background: #22863a; }}
        .event-marker.failed {{ background: #cb2431; }}
        .event-marker.is-issue {{ border: 3px solid #cb2431; box-sizing: content-box; }}
        .tooltip {{ position: fixed; background: #24292e; color: white; padding: 12px 16px; border-radius: 6px; font-size: 13px; z-index: 1000; max-width: 300px; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }}
        .tooltip .title {{ font-weight: bold; margin-bottom: 8px; color: #9ecbff; }}
        .tooltip .row {{ margin-top: 4px; color: #d1d5da; }}
        .legend {{ display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; background: #f6f8fa; border-radius: 6px; margin-bottom: 20px; }}
        .legend-item {{ display: flex; align-items: center; gap: 6px; font-size: 12px; color: #586069; }}
        .legend-dot {{ width: 12px; height: 12px; border-radius: 50%; }}
        .no-data {{ text-align: center; padding: 60px 20px; color: #6a737d; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AMHS 搬运时间线</h1>
            <div class="meta">生成时间: {generation_time.isoformat()} | 共 {len(analyses)} 个搬运任务</div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="label">总搬运</div>
                <div class="value">{summary.total_transfers}</div>
            </div>
            <div class="stat-card">
                <div class="label">已完成</div>
                <div class="value">{summary.completed_transfers}</div>
            </div>
            <div class="stat-card">
                <div class="label">有问题</div>
                <div class="value">{len([a for a in analyses if len(a.issues) > 0])}</div>
            </div>
            <div class="stat-card">
                <div class="label">总排队时间</div>
                <div class="value">{_format_duration(summary.total_queue_time_seconds)}</div>
            </div>
        </div>
        
        <div class="timeline-container">
            <div class="legend">
                <div class="legend-item"><span class="legend-dot" style="background: #28a745"></span>出发</div>
                <div class="legend-item"><span class="legend-dot" style="background: #6f42c1"></span>到达</div>
                <div class="legend-item"><span class="legend-dot" style="background: #f66a0a"></span>排队</div>
                <div class="legend-item"><span class="legend-dot" style="background: #d73a4a"></span>绕行</div>
                <div class="legend-item"><span class="legend-dot" style="background: #22863a"></span>完成</div>
                <div class="legend-item"><span class="legend-dot" style="background: #cb2431"></span>失败/问题</div>
            </div>
            
            <div class="controls">
                <div>
                    <label><input type="checkbox" id="show-issues" checked> 只显示有问题的 FOUP</label>
                    <label><input type="checkbox" id="highlight-issues" checked> 高亮问题事件</label>
                </div>
                <div class="search-box">
                    <input type="text" id="search-foup" placeholder="搜索 FOUP ID...">
                </div>
            </div>
"""
    
    if all_events:
        min_ts = min(all_events, key=lambda x: x['timestamp'])['timestamp']
        max_ts = max(all_events, key=lambda x: x['timestamp'])['timestamp']
        from datetime import datetime
        min_dt = datetime.fromisoformat(min_ts)
        max_dt = datetime.fromisoformat(max_ts)
        total_seconds = (max_dt - min_dt).total_seconds()
        
        html += f"""
            <div class="timeline">
                <div class="timeline-header">
                    <div>FOUP ID</div>
                    <div style="position: relative; height: 20px;">
                        <span style="position: absolute; left: 0;">{min_ts[11:19]}</span>
                        <span style="position: absolute; left: 50%; transform: translateX(-50%);">{min_dt + (max_dt - min_dt)/2}</span>
                        <span style="position: absolute; right: 0;">{max_ts[11:19]}</span>
                    </div>
                </div>
"""
        
        for foup_id in all_foups:
            foup_analysis = next((a for a in analyses if a.foup_id == foup_id), None)
            has_issues = foup_analysis and len(foup_analysis.issues) > 0
            foup_events = [e for e in all_events if e['foup_id'] == foup_id]
            
            issues_class = 'has-issues' if has_issues else ''
            data_attrs = f'data-has-issues="{str(has_issues).lower()}"'
            
            html += f"""
                <div class="timeline-row" {data_attrs} data-foup="{foup_id}">
                    <div class="foup-label {issues_class}">{foup_id}</div>
                    <div class="events-track">
"""
            
            for event in foup_events:
                try:
                    event_dt = datetime.fromisoformat(event['timestamp'])
                    position = 0
                    if total_seconds > 0:
                        position = ((event_dt - min_dt).total_seconds() / total_seconds) * 100
                    
                    css_classes = f"event-marker {event['event_type']}"
                    if event['is_issue']:
                        css_classes += " is-issue"
                    
                    tooltip_title = f"{event['event_type']} - {foup_id}"
                    tooltip_rows = []
                    if event['node_id']:
                        tooltip_rows.append(f"节点: {event['node_id']}")
                    if event['target_node']:
                        tooltip_rows.append(f"目标: {event['target_node']}")
                    if event['equipment_id']:
                        tooltip_rows.append(f"设备: {event['equipment_id']}")
                    if event['is_issue']:
                        tooltip_rows.append("<strong style='color: #f97583'>问题事件</strong>")
                    
                    tooltip_content = f"<div class='title'>{tooltip_title}</div><div class='row'>时间: {event['timestamp']}</div>"
                    for row in tooltip_rows:
                        tooltip_content += f"<div class='row'>{row}</div>"
                    
                    html += f"""
                        <div class="{css_classes}" 
                             style="left: {position}%;" 
                             data-tooltip='{tooltip_content}'
                             title="{event['timestamp']}: {event['event_type']}">
                        </div>
"""
                except Exception:
                    pass
            
            html += """
                    </div>
                </div>
"""
        
        html += """
            </div>
"""
    else:
        html += """
            <div class="no-data">
                <p>暂无时间线数据</p>
            </div>
"""
    
    html += """
        </div>
    </div>
    
    <div class="tooltip" id="tooltip" style="display: none;"></div>
    
    <script>
        (function() {
            const tooltip = document.getElementById('tooltip');
            const showIssuesCheckbox = document.getElementById('show-issues');
            const highlightIssuesCheckbox = document.getElementById('highlight-issues');
            const searchInput = document.getElementById('search-foup');
            const timelineRows = document.querySelectorAll('.timeline-row');
            
            function updateFilter() {
                const showIssues = showIssuesCheckbox.checked;
                const highlightIssues = highlightIssuesCheckbox.checked;
                const searchText = searchInput.value.toLowerCase();
                
                timelineRows.forEach(row => {
                    const hasIssues = row.dataset.hasIssues === 'true';
                    const foupId = row.dataset.foup.toLowerCase();
                    
                    let visible = true;
                    
                    if (showIssues && !hasIssues) {
                        visible = false;
                    }
                    
                    if (searchText && !foupId.includes(searchText)) {
                        visible = false;
                    }
                    
                    row.style.display = visible ? '' : 'none';
                });
                
                document.querySelectorAll('.event-marker.is-issue').forEach(marker => {
                    marker.style.boxShadow = highlightIssues ? '0 0 0 2px #fff, 0 0 0 4px #cb2431' : '';
                });
            }
            
            showIssuesCheckbox.addEventListener('change', updateFilter);
            highlightIssuesCheckbox.addEventListener('change', updateFilter);
            searchInput.addEventListener('input', updateFilter);
            
            document.querySelectorAll('.event-marker').forEach(marker => {
                marker.addEventListener('mouseenter', function(e) {
                    const tooltipHtml = this.dataset.tooltip;
                    if (tooltipHtml) {
                        tooltip.innerHTML = tooltipHtml;
                        tooltip.style.display = 'block';
                    }
                });
                
                marker.addEventListener('mousemove', function(e) {
                    tooltip.style.left = (e.clientX + 15) + 'px';
                    tooltip.style.top = (e.clientY + 15) + 'px';
                });
                
                marker.addEventListener('mouseleave', function() {
                    tooltip.style.display = 'none';
                });
            });
            
            updateFilter();
        })();
    </script>
</body>
</html>
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
