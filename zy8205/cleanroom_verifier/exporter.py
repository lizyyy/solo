import csv
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from collections import defaultdict

from .parser import Room, PressureReading, DoorEvent
from .calculator import PressureGradient, ACHResult, DoorImpact
from .rules import Issue, IssueSeverity, IssueCategory


class Exporter:
    def __init__(self):
        pass

    def export_issues_csv(
        self,
        issues: List[Issue],
        output_path: Path
    ) -> None:
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'issue_id',
                'category',
                'severity',
                'room_id',
                'adjacent_room_id',
                'message',
                'expected',
                'actual',
                'unit',
                'timestamp',
                'metadata'
            ])
            
            for issue in issues:
                writer.writerow([
                    issue.id,
                    issue.category.value,
                    issue.severity.value,
                    issue.room_id,
                    issue.adjacent_room_id or '',
                    issue.message,
                    f"{issue.expected:.2f}" if issue.expected is not None else '',
                    f"{issue.actual:.2f}" if issue.actual is not None else '',
                    issue.unit or '',
                    issue.timestamp.strftime('%Y-%m-%d %H:%M:%S') if issue.timestamp else '',
                    json.dumps(issue.metadata, ensure_ascii=False, default=str) if issue.metadata else ''
                ])

    def export_pressure_report_md(
        self,
        rooms: Dict[str, Room],
        pressure_gradients: List[PressureGradient],
        ach_results: List[ACHResult],
        door_impacts: List[DoorImpact],
        issues: List[Issue],
        output_path: Path,
        generated_at: Optional[datetime] = None
    ) -> None:
        if generated_at is None:
            generated_at = datetime.now()
        
        by_severity: Dict[IssueSeverity, List[Issue]] = defaultdict(list)
        for issue in issues:
            by_severity[issue.severity].append(issue)
        
        critical_count = len(by_severity.get(IssueSeverity.CRITICAL, []))
        high_count = len(by_severity.get(IssueSeverity.HIGH, []))
        medium_count = len(by_severity.get(IssueSeverity.MEDIUM, []))
        low_count = len(by_severity.get(IssueSeverity.LOW, []))
        
        valid_gradients = [g for g in pressure_gradients if g.is_valid]
        invalid_gradients = [g for g in pressure_gradients if not g.is_valid]
        
        valid_ach = [a for a in ach_results if a.is_valid]
        invalid_ach = [a for a in ach_results if not a.is_valid]
        
        significant_impacts = [i for i in door_impacts if not i.is_transient]
        transient_impacts = [i for i in door_impacts if i.is_transient]
        
        content = f"""# 洁净厂房压差级联与换气配置复核报告

**生成时间**: {generated_at.strftime('%Y-%m-%d %H:%M:%S')}

---

## 执行摘要

### 问题统计

| 严重级别 | 数量 |
|---------|------|
| 🔴 严重 (Critical) | {critical_count} |
| 🟠 高 (High) | {high_count} |
| 🟡 中 (Medium) | {medium_count} |
| 🟢 低 (Low) | {low_count} |
| **总计** | **{len(issues)}** |

### 复核状态

- **压差梯度检查**: {len(valid_gradients)} 个有效, {len(invalid_gradients)} 个数据缺失
- **换气次数检查**: {len(valid_ach)} 个有效, {len(invalid_ach)} 个数据缺失
- **门开启影响**: {len(significant_impacts)} 个显著影响, {len(transient_impacts)} 个瞬态变化

---

## 1. 压差梯度检查

### 1.1 压差梯度详情

| 房间 ID | 相邻房间 | 测量压差 ({valid_gradients[0].unit if valid_gradients else 'Pa'}) | 要求压差 ({valid_gradients[0].unit if valid_gradients else 'Pa'}) | 状态 |
|---------|---------|-------------------|-------------------|------|
"""
        
        for gradient in pressure_gradients:
            if gradient.is_valid:
                status = "✅ 通过" if gradient.measured_diff >= gradient.required_diff else "❌ 不通过"
                measured = f"{gradient.measured_diff:.2f}"
                required = f"{gradient.required_diff:.2f}"
            else:
                status = "⚠️ 数据缺失"
                measured = "N/A"
                required = f"{gradient.required_diff:.2f}"
            
            content += f"| {gradient.room_id} | {gradient.adjacent_room_id} | {measured} | {required} | {status} |\n"
        
        content += f"""
### 1.2 压差梯度问题

"""
        
        pressure_issues = [i for i in issues if i.category == IssueCategory.PRESSURE_GRADIENT]
        if pressure_issues:
            for issue in pressure_issues:
                severity_icon = self._get_severity_icon(issue.severity)
                content += f"- {severity_icon} **{issue.id}** ({issue.severity.value.upper()})\n"
                content += f"  - 房间: {issue.room_id}"
                if issue.adjacent_room_id:
                    content += f" -> {issue.adjacent_room_id}"
                content += "\n"
                content += f"  - 问题: {issue.message}\n"
                if issue.expected is not None and issue.actual is not None:
                    content += f"  - 期望: {issue.expected:.2f} {issue.unit}, 实际: {issue.actual:.2f} {issue.unit}\n"
                content += "\n"
        else:
            content += "✅ 未发现压差梯度问题\n\n"
        
        content += f"""---

## 2. 换气次数 (ACH) 检查

### 2.1 ACH 详情

| 房间 ID | 计算 ACH | 要求 ACH | 送风流量 (m³/h) | 房间体积 (m³) | 状态 |
|---------|---------|---------|----------------|--------------|------|
"""
        
        for result in ach_results:
            if result.is_valid:
                status = "✅ 通过" if result.ach >= result.required_ach else "❌ 不通过"
                ach_str = f"{result.ach:.2f}"
            else:
                status = "⚠️ 数据缺失"
                ach_str = "N/A"
            
            content += f"| {result.room_id} | {ach_str} | {result.required_ach:.2f} | {result.supply_air:.2f} | {result.volume:.2f} | {status} |\n"
        
        content += f"""
### 2.2 ACH 问题

"""
        
        ach_issues = [i for i in issues if i.category == IssueCategory.ACH]
        if ach_issues:
            for issue in ach_issues:
                severity_icon = self._get_severity_icon(issue.severity)
                content += f"- {severity_icon} **{issue.id}** ({issue.severity.value.upper()})\n"
                content += f"  - 房间: {issue.room_id}\n"
                content += f"  - 问题: {issue.message}\n"
                if issue.expected is not None and issue.actual is not None:
                    content += f"  - 期望: {issue.expected:.2f} ACH, 实际: {issue.actual:.2f} ACH\n"
                content += "\n"
        else:
            content += "✅ 未发现 ACH 问题\n\n"
        
        content += f"""---

## 3. 门开启影响分析

### 3.1 门开启事件统计

- 显著影响事件: {len(significant_impacts)} 个
- 瞬态变化事件: {len(transient_impacts)} 个

### 3.2 门开启影响问题

"""
        
        door_issues = [i for i in issues if i.category in [IssueCategory.DOOR_IMPACT, IssueCategory.DOOR_TRANSIENT]]
        if door_issues:
            for issue in door_issues:
                severity_icon = self._get_severity_icon(issue.severity)
                content += f"- {severity_icon} **{issue.id}** ({issue.severity.value.upper()})\n"
                content += f"  - 房间: {issue.room_id}"
                if issue.adjacent_room_id:
                    content += f" -> {issue.adjacent_room_id}"
                content += "\n"
                content += f"  - 问题: {issue.message}\n"
                if issue.actual is not None:
                    content += f"  - 压差影响: {issue.actual:.2f} {issue.unit}\n"
                content += "\n"
        else:
            content += "✅ 未发现门开启相关问题\n\n"
        
        content += f"""---

## 4. 数据质量问题

### 4.1 传感器问题

"""
        
        sensor_issues = [i for i in issues if i.category == IssueCategory.SENSOR_MISSING]
        if sensor_issues:
            for issue in sensor_issues:
                severity_icon = self._get_severity_icon(issue.severity)
                content += f"- {severity_icon} **{issue.id}** ({issue.severity.value.upper()})\n"
                content += f"  - 房间: {issue.room_id}\n"
                content += f"  - 问题: {issue.message}\n"
                content += "\n"
        else:
            content += "✅ 未发现传感器数据问题\n\n"
        
        content += f"""### 4.2 单位问题

"""
        
        unit_issues = [i for i in issues if i.category == IssueCategory.UNIT_MIXED]
        if unit_issues:
            for issue in unit_issues:
                severity_icon = self._get_severity_icon(issue.severity)
                content += f"- {severity_icon} **{issue.id}** ({issue.severity.value.upper()})\n"
                content += f"  - 问题: {issue.message}\n"
                content += "\n"
        else:
            content += "✅ 单位使用一致\n\n"
        
        content += f"""---

## 5. 建议行动

"""
        
        critical_issues = by_severity.get(IssueSeverity.CRITICAL, [])
        high_issues = by_severity.get(IssueSeverity.HIGH, [])
        
        if critical_issues:
            content += "### 🔴 立即处理 (严重问题)\n\n"
            for issue in critical_issues:
                content += f"1. **{issue.id}**: {issue.message}\n"
            content += "\n"
        
        if high_issues:
            content += "### 🟠 尽快处理 (高优先级问题)\n\n"
            for issue in high_issues:
                content += f"1. **{issue.id}**: {issue.message}\n"
            content += "\n"
        
        if not critical_issues and not high_issues:
            content += "✅ 无高优先级问题需要立即处理\n\n"
        
        content += f"""---

## 附录

### 复核房间列表

| 房间 ID | 房间名称 | 洁净级别 | 要求压差 (Pa) | 要求 ACH |
|---------|---------|---------|--------------|---------|
"""
        
        for room_id, room in rooms.items():
            content += f"| {room.id} | {room.name} | {room.classification} | {room.required_pressure_diff:.1f} | {room.required_ach:.1f} |\n"
        
        content += f"""
### 术语说明

- **压差梯度**: 相邻房间之间的压力差，用于防止交叉污染
- **ACH (Air Changes per Hour)**: 每小时换气次数，衡量空气流通效率
- **瞬态变化**: 门开启后压力快速恢复的正常波动

---

*本报告由 cleanroom-verifier 工具自动生成*
"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def export_html_trend(
        self,
        rooms: Dict[str, Room],
        pressure_readings: List[PressureReading],
        door_events: List[DoorEvent],
        issues: List[Issue],
        output_path: Path,
        generated_at: Optional[datetime] = None
    ) -> None:
        if generated_at is None:
            generated_at = datetime.now()
        
        readings_by_room: Dict[str, List[PressureReading]] = defaultdict(list)
        for reading in pressure_readings:
            if reading.is_valid:
                readings_by_room[reading.room_id].append(reading)
        
        for room_id in readings_by_room:
            readings_by_room[room_id].sort(key=lambda x: x.timestamp)
        
        chart_datasets = []
        for room_id, readings in readings_by_room.items():
            labels = [r.timestamp.strftime('%Y-%m-%d %H:%M:%S') for r in readings]
            data = [r.pressure for r in readings]
            chart_datasets.append({
                'room_id': room_id,
                'labels': labels,
                'data': data,
                'unit': readings[0].unit if readings else 'Pa'
            })
        
        door_events_json = []
        for event in door_events:
            door_events_json.append({
                'timestamp': event.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'room_id': event.room_id,
                'event_type': event.event_type,
                'duration': event.duration
            })
        
        issues_json = []
        for issue in issues:
            issues_json.append({
                'id': issue.id,
                'category': issue.category.value,
                'severity': issue.severity.value,
                'room_id': issue.room_id,
                'adjacent_room_id': issue.adjacent_room_id,
                'message': issue.message,
                'expected': issue.expected,
                'actual': issue.actual,
                'unit': issue.unit,
                'timestamp': issue.timestamp.strftime('%Y-%m-%d %H:%M:%S') if issue.timestamp else None
            })
        
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>洁净厂房压差趋势分析</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }}
        header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
        }}
        header h1 {{
            font-size: 28px;
            margin-bottom: 10px;
        }}
        header .meta {{
            opacity: 0.9;
            font-size: 14px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            text-align: center;
        }}
        .stat-card .value {{
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        .stat-card .label {{
            color: #666;
            font-size: 14px;
        }}
        .stat-card.critical .value {{ color: #e74c3c; }}
        .stat-card.high .value {{ color: #f39c12; }}
        .stat-card.medium .value {{ color: #f1c40f; }}
        .stat-card.low .value {{ color: #27ae60; }}
        .section {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            margin-bottom: 30px;
        }}
        .section h2 {{
            font-size: 20px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
            color: #333;
        }}
        .chart-container {{
            position: relative;
            height: 400px;
            margin-bottom: 30px;
        }}
        .chart-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
            gap: 30px;
        }}
        .room-chart {{
            background: #fafbfc;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #eaecef;
        }}
        .room-chart h3 {{
            margin-bottom: 15px;
            color: #555;
            font-size: 16px;
        }}
        .issues-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .issues-table th,
        .issues-table td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }}
        .issues-table th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
        }}
        .issues-table tr:hover {{
            background: #f8f9fa;
        }}
        .severity-badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }}
        .severity-critical {{ background: #fee; color: #c00; }}
        .severity-high {{ background: #fff3e0; color: #e65100; }}
        .severity-medium {{ background: #fffde7; color: #f57f17; }}
        .severity-low {{ background: #e8f5e9; color: #2e7d32; }}
        .tabs {{
            display: flex;
            gap: 5px;
            margin-bottom: 20px;
        }}
        .tab {{
            padding: 10px 20px;
            background: #f5f7fa;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            color: #666;
            transition: all 0.2s;
        }}
        .tab:hover {{
            background: #eaecef;
        }}
        .tab.active {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        .tab-content {{
            display: none;
        }}
        .tab-content.active {{
            display: block;
        }}
        .door-events {{
            max-height: 300px;
            overflow-y: auto;
        }}
        .door-event {{
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #667eea;
        }}
        .door-event .time {{
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }}
        .door-event .detail {{
            font-size: 14px;
        }}
        @media (max-width: 768px) {{
            .chart-grid {{
                grid-template-columns: 1fr;
            }}
            .stats-grid {{
                grid-template-columns: repeat(2, 1fr);
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🏭 洁净厂房压差趋势分析</h1>
            <div class="meta">生成时间: {generated_at.strftime('%Y-%m-%d %H:%M:%S')}</div>
        </header>

        <div class="stats-grid">
            <div class="stat-card critical">
                <div class="value">{len([i for i in issues if i.severity.value == 'critical'])}</div>
                <div class="label">严重问题</div>
            </div>
            <div class="stat-card high">
                <div class="value">{len([i for i in issues if i.severity.value == 'high'])}</div>
                <div class="label">高优先级问题</div>
            </div>
            <div class="stat-card medium">
                <div class="value">{len([i for i in issues if i.severity.value == 'medium'])}</div>
                <div class="label">中优先级问题</div>
            </div>
            <div class="stat-card low">
                <div class="value">{len([i for i in issues if i.severity.value == 'low'])}</div>
                <div class="label">低优先级问题</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 压力趋势图</h2>
            <div class="chart-grid">
                {''.join([f'''
                <div class="room-chart">
                    <h3>房间: {ds['room_id']}</h3>
                    <div class="chart-container">
                        <canvas id="chart-{ds['room_id']}"></canvas>
                    </div>
                </div>
                ''' for ds in chart_datasets])}
            </div>
        </div>

        <div class="section">
            <h2>⚠️ 问题列表</h2>
            <div class="tabs">
                <button class="tab active" onclick="showTab('all')">全部问题</button>
                <button class="tab" onclick="showTab('critical')">严重问题</button>
                <button class="tab" onclick="showTab('high')">高优先级</button>
                <button class="tab" onclick="showTab('others')">其他</button>
            </div>
            
            <div id="tab-all" class="tab-content active">
                {self._render_issues_table(issues)}
            </div>
            <div id="tab-critical" class="tab-content">
                {self._render_issues_table([i for i in issues if i.severity.value == 'critical'])}
            </div>
            <div id="tab-high" class="tab-content">
                {self._render_issues_table([i for i in issues if i.severity.value == 'high'])}
            </div>
            <div id="tab-others" class="tab-content">
                {self._render_issues_table([i for i in issues if i.severity.value in ['medium', 'low', 'info']])}
            </div>
        </div>

        <div class="section">
            <h2>🚪 门开启事件</h2>
            <div class="door-events">
                {''.join([f'''
                <div class="door-event">
                    <div class="time">{event['timestamp']}</div>
                    <div class="detail">
                        房间 <strong>{event['room_id']}</strong> - {event['event_type']}
                        {f" (持续 {event['duration']} 秒)" if event['duration'] else ""}
                    </div>
                </div>
                ''' for event in door_events_json]) if door_events_json else '<p>无门开启事件记录</p>'}
            </div>
        </div>
    </div>

    <script>
        const chartData = {json.dumps(chart_datasets)};
        
        chartData.forEach(ds => {{
            const ctx = document.getElementById('chart-' + ds.room_id);
            if (ctx) {{
                new Chart(ctx, {{
                    type: 'line',
                    data: {{
                        labels: ds.labels,
                        datasets: [{{
                            label: ds.room_id + ' 压力 (' + ds.unit + ')',
                            data: ds.data,
                            borderColor: 'rgb(102, 126, 234)',
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        }}]
                    }},
                    options: {{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {{
                            intersect: false,
                            mode: 'index'
                        }},
                        plugins: {{
                            legend: {{
                                display: true
                            }},
                            tooltip: {{
                                enabled: true
                            }}
                        }},
                        scales: {{
                            x: {{
                                display: true,
                                ticks: {{
                                    maxRotation: 45,
                                    minRotation: 45,
                                    maxTicksLimit: 10
                                }}
                            }},
                            y: {{
                                display: true,
                                title: {{
                                    display: true,
                                    text: '压力 (' + ds.unit + ')'
                                }}
                            }}
                        }}
                    }}
                }});
            }}
        }});

        function showTab(tabName) {{
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            
            document.getElementById('tab-' + tabName).classList.add('active');
            event.target.classList.add('active');
        }}
    </script>
</body>
</html>
"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

    def _get_severity_icon(self, severity: IssueSeverity) -> str:
        icons = {
            IssueSeverity.CRITICAL: "🔴",
            IssueSeverity.HIGH: "🟠",
            IssueSeverity.MEDIUM: "🟡",
            IssueSeverity.LOW: "🟢",
            IssueSeverity.INFO: "ℹ️"
        }
        return icons.get(severity, "⚪")

    def _render_issues_table(self, issues: List[Issue]) -> str:
        if not issues:
            return '<p style="color: #27ae60; font-weight: 600;">✅ 无问题</p>'
        
        html = '<table class="issues-table"><thead><tr>'
        html += '<th>ID</th><th>级别</th><th>分类</th><th>房间</th><th>问题描述</th>'
        html += '</tr></thead><tbody>'
        
        for issue in issues:
            severity_class = f'severity-{issue.severity.value}'
            html += '<tr>'
            html += f'<td><strong>{issue.id}</strong></td>'
            html += f'<td><span class="severity-badge {severity_class}">{issue.severity.value.upper()}</span></td>'
            html += f'<td>{issue.category.value}</td>'
            html += f'<td>{issue.room_id}'
            if issue.adjacent_room_id:
                html += f' → {issue.adjacent_room_id}'
            html += '</td>'
            html += f'<td>{issue.message}'
            if issue.expected is not None and issue.actual is not None:
                html += f' (期望: {issue.expected:.2f} {issue.unit}, 实际: {issue.actual:.2f} {issue.unit})'
            html += '</td>'
            html += '</tr>'
        
        html += '</tbody></table>'
        return html
