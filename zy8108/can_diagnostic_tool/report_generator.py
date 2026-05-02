"""
报告生成模块
负责导出issues.csv、生成timeline.html和report.md
"""

import csv
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from .log_parser import format_timestamp
from .rule_engine import Issue, IssueType, IssueSeverity
from .state_aggregator import StateAggregator, TimelineEvent, DeviceState


class ReportGenerator:
    """报告生成器
    
    生成三种格式的输出：
    1. issues.csv - 问题列表
    2. timeline.html - 交互式时间线
    3. report.md - 完整分析报告
    """
    
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_issues_csv(self, issues: List[Issue], filename: str = "issues.csv") -> str:
        """
        导出问题列表为CSV文件
        
        Args:
            issues: 问题列表
            filename: 输出文件名
            
        Returns:
            输出文件路径
        """
        filepath = self.output_dir / filename
        
        # 按时间排序
        sorted_issues = sorted(issues, key=lambda x: x.timestamp)
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            if not sorted_issues:
                # 没有问题时，只写入表头
                writer = csv.writer(f)
                writer.writerow([
                    'timestamp', 'issue_type', 'severity', 'device_id',
                    'can_id', 'signal_name', 'message', 'details'
                ])
            else:
                # 使用字典写入
                fieldnames = [
                    'timestamp', 'issue_type', 'severity', 'device_id',
                    'can_id', 'signal_name', 'message', 'details'
                ]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for issue in sorted_issues:
                    writer.writerow(issue.to_dict())
        
        return str(filepath)
    
    def generate_timeline_html(self, 
                                timeline_events: List[TimelineEvent],
                                issues: List[Issue],
                                device_states: List[DeviceState],
                                filename: str = "timeline.html") -> str:
        """
        生成交互式时间线HTML文件
        
        Args:
            timeline_events: 时间线事件列表
            issues: 问题列表
            device_states: 设备状态列表
            filename: 输出文件名
            
        Returns:
            输出文件路径
        """
        filepath = self.output_dir / filename
        
        # 准备事件数据
        all_events = []
        
        # 添加时间线事件
        for event in timeline_events:
            event_data = {
                'timestamp': event.timestamp,
                'time': format_timestamp(event.timestamp),
                'type': event.event_type,
                'device': event.device_id or '',
                'can_id': f'0x{event.can_id:X}' if event.can_id else '',
                'signal': event.signal_name or '',
                'value': str(event.value),
                'category': 'signal',
                'severity': 'info'
            }
            all_events.append(event_data)
        
        # 添加问题事件
        for issue in issues:
            severity_color = {
                IssueSeverity.CRITICAL: '#dc3545',
                IssueSeverity.WARNING: '#ffc107',
                IssueSeverity.INFO: '#17a2b8'
            }.get(issue.severity, '#6c757d')
            
            issue_data = {
                'timestamp': issue.timestamp,
                'time': format_timestamp(issue.timestamp),
                'type': issue.issue_type.value,
                'device': issue.device_id or '',
                'can_id': f'0x{issue.can_id:X}' if issue.can_id else '',
                'signal': issue.signal_name or '',
                'value': issue.message,
                'category': 'issue',
                'severity': issue.severity.value,
                'severity_color': severity_color
            }
            all_events.append(issue_data)
        
        # 按时间排序
        all_events.sort(key=lambda x: x['timestamp'])
        
        # 准备设备信息
        devices_info = []
        for ds in device_states:
            devices_info.append({
                'device_id': ds.device_id,
                'device_name': ds.device_name,
                'frame_count': ds.frame_count,
                'signals_count': len(ds.signals),
                'can_ids': [f'0x{cid:X}' for cid in ds.can_ids_seen],
                'first_seen': format_timestamp(ds.first_seen) if ds.first_seen else 'N/A',
                'last_seen': format_timestamp(ds.last_seen) if ds.last_seen else 'N/A'
            })
        
        # 生成HTML
        html_content = self._build_timeline_html(all_events, devices_info, issues)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return str(filepath)
    
    def _build_timeline_html(self, events: List[Dict], devices: List[Dict], issues: List[Issue]) -> str:
        """
        构建时间线HTML内容
        """
        # 统计信息
        critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == IssueSeverity.INFO)
        
        # 准备JavaScript数据
        import json
        events_json = json.dumps(events, ensure_ascii=False, indent=2)
        devices_json = json.dumps(devices, ensure_ascii=False, indent=2)
        
        # 生成时间范围
        time_start = events[0]['time'] if events else 'N/A'
        time_end = events[-1]['time'] if events else 'N/A'
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CAN总线诊断时间线</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1 {{
            text-align: center;
            color: #2c3e50;
            margin-bottom: 30px;
        }}
        .stats-bar {{
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }}
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            flex: 1;
            min-width: 150px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 2em;
            font-weight: bold;
        }}
        .stat-critical {{ color: #dc3545; }}
        .stat-warning {{ color: #ffc107; }}
        .stat-info {{ color: #17a2b8; }}
        .stat-normal {{ color: #28a745; }}
        .controls {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        .filter-group {{
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
        }}
        .filter-group label {{
            font-weight: 600;
            margin-right: 5px;
        }}
        .filter-group select, .filter-group input {{
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }}
        .timeline-container {{
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .timeline-header {{
            background: #2c3e50;
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .timeline-scroll {{
            max-height: 600px;
            overflow-y: auto;
        }}
        .timeline {{
            position: relative;
            padding: 20px;
        }}
        .timeline::before {{
            content: '';
            position: absolute;
            left: 30px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e0e0e0;
        }}
        .timeline-item {{
            position: relative;
            margin-bottom: 15px;
            padding-left: 60px;
        }}
        .timeline-dot {{
            position: absolute;
            left: 22px;
            top: 5px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }}
        .dot-signal {{ background: #28a745; }}
        .dot-critical {{ background: #dc3545; }}
        .dot-warning {{ background: #ffc107; }}
        .dot-info {{ background: #17a2b8; }}
        .timeline-content {{
            background: #f8f9fa;
            padding: 12px 15px;
            border-radius: 6px;
            border-left: 4px solid #dee2e6;
        }}
        .timeline-content:hover {{
            background: #e9ecef;
        }}
        .content-critical {{ border-left-color: #dc3545; }}
        .content-warning {{ border-left-color: #ffc107; }}
        .content-info {{ border-left-color: #17a2b8; }}
        .content-signal {{ border-left-color: #28a745; }}
        .time-badge {{
            display: inline-block;
            background: #6c757d;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            margin-bottom: 5px;
        }}
        .type-badge {{
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.8em;
            margin-left: 8px;
        }}
        .badge-signal {{ background: #d4edda; color: #155724; }}
        .badge-issue {{ background: #f8d7da; color: #721c24; }}
        .event-details {{
            margin-top: 8px;
            font-size: 0.9em;
            color: #6c757d;
        }}
        .event-details span {{
            margin-right: 15px;
        }}
        .no-events {{
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }}
        .legend {{
            display: flex;
            gap: 20px;
            margin-top: 10px;
            flex-wrap: wrap;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.9em;
        }}
        .legend-dot {{
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>CAN总线诊断时间线</h1>
        
        <div class="stats-bar">
            <div class="stat-card">
                <div class="stat-value stat-critical">{critical_count}</div>
                <div>严重问题</div>
            </div>
            <div class="stat-card">
                <div class="stat-value stat-warning">{warning_count}</div>
                <div>警告</div>
            </div>
            <div class="stat-card">
                <div class="stat-value stat-info">{info_count}</div>
                <div>信息</div>
            </div>
            <div class="stat-card">
                <div class="stat-value stat-normal">{len(devices)}</div>
                <div>监控设备</div>
            </div>
            <div class="stat-card">
                <div class="stat-value stat-normal">{len(events)}</div>
                <div>总事件</div>
            </div>
        </div>
        
        <div class="controls">
            <h3>筛选控制</h3>
            <div class="filter-group">
                <label>设备:</label>
                <select id="deviceFilter">
                    <option value="">全部</option>
                </select>
                
                <label>事件类型:</label>
                <select id="typeFilter">
                    <option value="">全部</option>
                    <option value="signal">信号变化</option>
                    <option value="issue">问题</option>
                </select>
                
                <label>严重程度:</label>
                <select id="severityFilter">
                    <option value="">全部</option>
                    <option value="critical">严重</option>
                    <option value="warning">警告</option>
                    <option value="info">信息</option>
                </select>
                
                <label>搜索:</label>
                <input type="text" id="searchInput" placeholder="搜索消息或信号...">
            </div>
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-dot" style="background: #28a745;"></div>
                    信号变化
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #dc3545;"></div>
                    严重问题
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #ffc107;"></div>
                    警告
                </div>
                <div class="legend-item">
                    <div class="legend-dot" style="background: #17a2b8;"></div>
                    信息
                </div>
            </div>
        </div>
        
        <div class="timeline-container">
            <div class="timeline-header">
                <div>时间线: {time_start} ~ {time_end}</div>
                <div id="eventCount">显示 {len(events)} 个事件</div>
            </div>
            <div class="timeline-scroll">
                <div class="timeline" id="timeline">
                    <!-- 事件将通过JavaScript填充 -->
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const events = {events_json};
        const devices = {devices_json};
        
        // 填充设备筛选器
        const deviceFilter = document.getElementById('deviceFilter');
        const uniqueDevices = [...new Set(events.map(e => e.device).filter(d => d))];
        uniqueDevices.sort().forEach(device => {{
            const option = document.createElement('option');
            option.value = device;
            option.textContent = device;
            deviceFilter.appendChild(option);
        }});
        
        function renderTimeline() {{
            const timeline = document.getElementById('timeline');
            const deviceValue = deviceFilter.value;
            const typeValue = document.getElementById('typeFilter').value;
            const severityValue = document.getElementById('severityFilter').value;
            const searchValue = document.getElementById('searchInput').value.toLowerCase();
            
            const filteredEvents = events.filter(event => {{
                // 设备筛选
                if (deviceValue && event.device !== deviceValue) return false;
                
                // 类型筛选
                if (typeValue && event.category !== typeValue) return false;
                
                // 严重程度筛选
                if (severityValue && event.category === 'issue' && event.severity !== severityValue) return false;
                
                // 搜索筛选
                if (searchValue) {{
                    const searchText = [
                        event.value,
                        event.signal,
                        event.type,
                        event.can_id,
                        event.device
                    ].join(' ').toLowerCase();
                    if (!searchText.includes(searchValue)) return false;
                }}
                
                return true;
            }});
            
            document.getElementById('eventCount').textContent = `显示 ${{filteredEvents.length}} 个事件`;
            
            if (filteredEvents.length === 0) {{
                timeline.innerHTML = '<div class="no-events">没有匹配的事件</div>';
                return;
            }}
            
            timeline.innerHTML = filteredEvents.map(event => {{
                let dotClass = 'dot-info';
                let contentClass = 'content-info';
                let badgeClass = 'badge-issue';
                
                if (event.category === 'signal') {{
                    dotClass = 'dot-signal';
                    contentClass = 'content-signal';
                    badgeClass = 'badge-signal';
                }} else if (event.severity === 'critical') {{
                    dotClass = 'dot-critical';
                    contentClass = 'content-critical';
                }} else if (event.severity === 'warning') {{
                    dotClass = 'dot-warning';
                    contentClass = 'content-warning';
                }}
                
                const details = [];
                if (event.device) details.push(`<span>设备: ${{event.device}}</span>`);
                if (event.can_id) details.push(`<span>CAN ID: ${{event.can_id}}</span>`);
                if (event.signal) details.push(`<span>信号: ${{event.signal}}</span>`);
                
                return `
                    <div class="timeline-item">
                        <div class="timeline-dot ${{dotClass}}"></div>
                        <div class="timeline-content ${{contentClass}}">
                            <div class="time-badge">${{event.time}}</div>
                            <span class="type-badge ${{badgeClass}}">${{event.type}}</span>
                            <div>${{event.value}}</div>
                            ${{details.length ? '<div class="event-details">' + details.join('') + '</div>' : ''}}
                        </div>
                    </div>
                `;
            }}).join('');
        }}
        
        // 绑定筛选器事件
        document.getElementById('deviceFilter').addEventListener('change', renderTimeline);
        document.getElementById('typeFilter').addEventListener('change', renderTimeline);
        document.getElementById('severityFilter').addEventListener('change', renderTimeline);
        document.getElementById('searchInput').addEventListener('input', renderTimeline);
        
        // 初始渲染
        renderTimeline();
    </script>
</body>
</html>
"""
        
        return html
    
    def generate_report_md(self,
                           log_stats: Dict[str, Any],
                           rule_stats: Dict[str, Any],
                           state_stats: Dict[str, Any],
                           issues: List[Issue],
                           id_conflicts: List[Dict],
                           unknown_ids: List[int],
                           filename: str = "report.md") -> str:
        """
        生成Markdown格式的分析报告
        
        Args:
            log_stats: 日志解析统计
            rule_stats: 规则引擎统计
            state_stats: 状态聚合统计
            issues: 问题列表
            id_conflicts: ID冲突列表
            unknown_ids: 未知ID列表
            filename: 输出文件名
            
        Returns:
            输出文件路径
        """
        filepath = self.output_dir / filename
        
        # 统计信息
        critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == IssueSeverity.INFO)
        
        # 按类型分组
        issues_by_type: Dict[str, List[Issue]] = {}
        for issue in issues:
            issue_type = issue.issue_type.value
            if issue_type not in issues_by_type:
                issues_by_type[issue_type] = []
            issues_by_type[issue_type].append(issue)
        
        # 生成报告内容
        report_lines = []
        
        # 标题
        report_lines.append("# CAN总线诊断报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        # 概览
        report_lines.append("## 1. 概览")
        report_lines.append("")
        
        # 问题统计表格
        report_lines.append("### 1.1 问题统计")
        report_lines.append("")
        report_lines.append("| 严重程度 | 数量 |")
        report_lines.append("|----------|------|")
        report_lines.append(f"| 🔴 严重 | {critical_count} |")
        report_lines.append(f"| 🟡 警告 | {warning_count} |")
        report_lines.append(f"| 🔵 信息 | {info_count} |")
        report_lines.append(f"| **总计** | **{len(issues)}** |")
        report_lines.append("")
        
        # 按类型统计
        if issues_by_type:
            report_lines.append("### 1.2 问题类型分布")
            report_lines.append("")
            report_lines.append("| 问题类型 | 数量 |")
            report_lines.append("|----------|------|")
            for issue_type, type_issues in sorted(issues_by_type.items(), key=lambda x: -len(x[1])):
                type_name = {
                    'heartbeat_miss': '心跳丢失',
                    'signal_out_of_range': '信号越界',
                    'counter_jump_back': '计数器回跳',
                    'id_conflict': 'ID冲突',
                    'unknown_can_id': '未知CAN ID',
                    'cycle_violation': '周期违规'
                }.get(issue_type, issue_type)
                report_lines.append(f"| {type_name} | {len(type_issues)} |")
            report_lines.append("")
        
        # 时间范围
        time_range = rule_stats.get('time_range', {})
        if time_range.get('start'):
            report_lines.append("### 1.3 分析时间范围")
            report_lines.append("")
            report_lines.append(f"- **开始时间**: {time_range.get('start', 'N/A')}")
            report_lines.append(f"- **结束时间**: {time_range.get('end', 'N/A')}")
            duration = time_range.get('duration_seconds', 0)
            if duration > 0:
                hours = int(duration // 3600)
                minutes = int((duration % 3600) // 60)
                seconds = int(duration % 60)
                report_lines.append(f"- **持续时间**: {hours}小时 {minutes}分钟 {seconds}秒")
            report_lines.append("")
        
        # 日志解析统计
        report_lines.append("## 2. 日志解析统计")
        report_lines.append("")
        report_lines.append(f"- **总帧数**: {log_stats.get('total_frames', 0)}")
        report_lines.append(f"- **未知格式帧数**: {log_stats.get('unknown_frames', 0)}")
        if log_stats.get('unknown_ids'):
            report_lines.append(f"- **未知CAN ID**: {', '.join([f'0x{cid:X}' for cid in log_stats.get('unknown_ids', [])])}")
        report_lines.append(f"- **跨天处理**: {log_stats.get('day_offsets_applied', 0)} 次")
        report_lines.append("")
        
        # 设备统计
        report_lines.append("## 3. 设备状态")
        report_lines.append("")
        
        device_stats = state_stats.get('device_statistics', {})
        if device_stats:
            report_lines.append("| 设备ID | 设备名称 | 帧数 | 信号数 | 首次出现 | 最后出现 |")
            report_lines.append("|--------|----------|------|--------|----------|----------|")
            for device_id, stats in sorted(device_stats.items()):
                report_lines.append(f"| {device_id} | {stats.get('name', '')} | {stats.get('frame_count', 0)} | {stats.get('signals_monitored', 0)} | {stats.get('first_seen', 'N/A')} | {stats.get('last_seen', 'N/A')} |")
            report_lines.append("")
        
        # ID冲突
        if id_conflicts:
            report_lines.append("## 4. ID冲突检测")
            report_lines.append("")
            report_lines.append("### ⚠️ 检测到ID冲突")
            report_lines.append("")
            for conflict in id_conflicts:
                report_lines.append(f"#### CAN ID: {conflict.get('can_id_hex')}")
                report_lines.append("")
                report_lines.append(f"**占用设备**: {', '.join(conflict.get('devices', []))}")
                report_lines.append("")
                report_lines.append("**使用详情**:")
                report_lines.append("")
                for usage in conflict.get('usage_details', []):
                    device = usage.get('device_id') or '未知设备'
                    report_lines.append(f"- {device}: {usage.get('frame_count', 0)} 帧, 时间: {format_timestamp(usage.get('first_seen', 0))} ~ {format_timestamp(usage.get('last_seen', 0))}")
                report_lines.append("")
        
        # 未知ID
        if unknown_ids:
            report_lines.append("## 5. 未知CAN ID")
            report_lines.append("")
            report_lines.append("以下CAN ID在日志中出现，但未在设备台账中注册:")
            report_lines.append("")
            for cid in unknown_ids:
                report_lines.append(f"- 0x{cid:X}")
            report_lines.append("")
        
        # 详细问题列表
        if issues:
            report_lines.append("## 6. 问题详情")
            report_lines.append("")
            
            # 按严重程度排序
            sorted_issues = sorted(issues, key=lambda x: (
                0 if x.severity == IssueSeverity.CRITICAL else 
                1 if x.severity == IssueSeverity.WARNING else 2,
                x.timestamp
            ))
            
            for idx, issue in enumerate(sorted_issues, 1):
                severity_icon = "🔴" if issue.severity == IssueSeverity.CRITICAL else \
                                "🟡" if issue.severity == IssueSeverity.WARNING else "🔵"
                severity_name = "严重" if issue.severity == IssueSeverity.CRITICAL else \
                               "警告" if issue.severity == IssueSeverity.WARNING else "信息"
                
                issue_type_name = {
                    IssueType.HEARTBEAT_MISS: '心跳丢失',
                    IssueType.SIGNAL_OUT_OF_RANGE: '信号越界',
                    IssueType.COUNTER_JUMP_BACK: '计数器回跳',
                    IssueType.ID_CONFLICT: 'ID冲突',
                    IssueType.UNKNOWN_CAN_ID: '未知CAN ID',
                    IssueType.CYCLE_VIOLATION: '周期违规'
                }.get(issue.issue_type, issue.issue_type.value)
                
                report_lines.append(f"### {idx}. {severity_icon} [{severity_name}] {issue_type_name}")
                report_lines.append("")
                report_lines.append(f"- **时间**: {format_timestamp(issue.timestamp)}")
                if issue.device_id:
                    report_lines.append(f"- **设备**: {issue.device_id}")
                if issue.can_id:
                    report_lines.append(f"- **CAN ID**: 0x{issue.can_id:X}")
                if issue.signal_name:
                    report_lines.append(f"- **信号**: {issue.signal_name}")
                report_lines.append(f"- **消息**: {issue.message}")
                if issue.details:
                    report_lines.append(f"- **详情**: `{str(issue.details)}`")
                report_lines.append("")
        
        # 总结
        report_lines.append("## 7. 总结")
        report_lines.append("")
        
        if critical_count > 0:
            report_lines.append(f"⚠️ **检测到 {critical_count} 个严重问题**，建议优先处理。")
            report_lines.append("")
        elif warning_count > 0:
            report_lines.append(f"⚠️ 检测到 {warning_count} 个警告，建议关注。")
            report_lines.append("")
        else:
            report_lines.append("✅ 本次分析未检测到严重问题。")
            report_lines.append("")
        
        report_lines.append("---")
        report_lines.append("")
        report_lines.append("*本报告由CAN总线诊断工具自动生成*")
        
        # 写入文件
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
        
        return str(filepath)
