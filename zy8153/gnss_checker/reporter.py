# -*- coding: utf-8 -*-
"""报告生成模块

负责生成：
- issues.csv: 问题列表
- rinex_report.md: 详细报告
- timeline.html: 时间线可视化
"""

import os
import csv
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict

from .rinex_parser import RinexParser, RinexStatistics
from .validator import DataValidator, ValidationIssue, StationInfo, SessionPlan


class ReportGenerator:
    """报告生成器"""

    def __init__(self, validator: DataValidator):
        self.validator = validator
        self.output_dir = "."

    def set_output_dir(self, output_dir: str):
        """设置输出目录"""
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def generate_all(self) -> Dict[str, str]:
        """生成所有报告"""
        outputs = {}

        outputs["issues_csv"] = self.generate_issues_csv()
        outputs["rinex_report_md"] = self.generate_rinex_report_md()
        outputs["timeline_html"] = self.generate_timeline_html()

        return outputs

    def generate_issues_csv(self) -> str:
        """生成 issues.csv"""
        output_path = os.path.join(self.output_dir, "issues.csv")

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)

            writer.writerow([
                "问题编号", "基站名", "测段名", "问题类型", "严重程度",
                "问题描述", "RINEX文件", "时间戳", "详细信息"
            ])

            for issue in self.validator.issues:
                timestamp_str = issue.timestamp.strftime("%Y-%m-%d %H:%M:%S") if issue.timestamp else ""
                details_str = json.dumps(issue.details, ensure_ascii=False) if issue.details else ""

                writer.writerow([
                    issue.issue_id,
                    issue.station_name,
                    issue.session_name,
                    issue.issue_type,
                    issue.severity,
                    issue.message,
                    issue.rinex_file,
                    timestamp_str,
                    details_str
                ])

        return output_path

    def generate_rinex_report_md(self) -> str:
        """生成 rinex_report.md"""
        output_path = os.path.join(self.output_dir, "rinex_report.md")

        summary = self.validator.get_validation_summary()

        content = self._generate_markdown_header(summary)
        content += self._generate_summary_section(summary)
        content += self._generate_issues_section()
        content += self._generate_station_details_section()
        content += self._generate_rinex_statistics_section()
        content += self._generate_footer()

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        return output_path

    def _generate_markdown_header(self, summary: Dict[str, Any]) -> str:
        """生成 Markdown 头部"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return f"""# GNSS 静态观测成果复核报告

**生成时间**: {now}

---

## 执行摘要

"""

    def _generate_summary_section(self, summary: Dict[str, Any]) -> str:
        """生成摘要部分"""
        content = """### 数据统计

| 项目 | 数量 |
|------|------|
"""

        content += f"| 基站总数 | {summary['total_stations']} |\n"
        content += f"| 测段总数 | {summary['total_sessions']} |\n"
        content += f"| RINEX 文件 | {summary['total_rinex_files']} |\n"
        content += f"| **问题总数** | **{summary['total_issues']}** |\n"

        content += """
### 问题严重程度分布

"""

        issues_by_severity = summary["issues_by_severity"]
        if issues_by_severity:
            content += "| 严重程度 | 数量 |\n|----------|------|\n"
            for severity in ["error", "warning", "info"]:
                count = issues_by_severity.get(severity, 0)
                if count > 0:
                    content += f"| {self._format_severity(severity)} | {count} |\n"
        else:
            content += "无问题发现。\n"

        return content

    def _generate_issues_section(self) -> str:
        """生成问题详情部分"""
        content = """
---

## 问题详情

"""

        if not self.validator.issues:
            content += "**所有检查项均通过，未发现问题。**\n\n"
            return content

        issues_by_station = defaultdict(list)
        for issue in self.validator.issues:
            issues_by_station[issue.station_name].append(issue)

        for station_name in sorted(issues_by_station.keys()):
            issues = issues_by_station[station_name]

            error_count = sum(1 for i in issues if i.severity == "error")
            warning_count = sum(1 for i in issues if i.severity == "warning")

            content += f"### 基站: {station_name}\n\n"
            if error_count > 0:
                content += f"**错误**: {error_count} 个 | "
            if warning_count > 0:
                content += f"**警告**: {warning_count} 个"
            content += "\n\n"

            content += "| 编号 | 严重程度 | 类型 | 描述 |\n"
            content += "|------|----------|------|------|\n"

            for issue in sorted(issues, key=lambda x: (x.severity != "error", x.issue_id)):
                severity_md = self._format_severity(issue.severity)
                desc = issue.message.replace("|", "\\|")
                content += f"| {issue.issue_id} | {severity_md} | {issue.issue_type} | {desc} |\n"

            content += "\n"

        return content

    def _generate_station_details_section(self) -> str:
        """生成基站详情部分"""
        if not self.validator.stations:
            return ""

        content = """
---

## 基站信息详情

"""

        for station_name, station in self.validator.stations.items():
            content += f"### {station_name}\n\n"

            content += "| 属性 | 值 |\n|------|-----|\n"
            if station.marker_number:
                content += f"| 点号 | {station.marker_number} |\n"
            if station.x != 0.0 or station.y != 0.0 or station.z != 0.0:
                content += f"| X坐标 | {station.x:.4f} m |\n"
                content += f"| Y坐标 | {station.y:.4f} m |\n"
                content += f"| Z坐标 | {station.z:.4f} m |\n"
            if station.lon is not None and station.lat is not None:
                content += f"| 经度 | {station.lon:.8f}° |\n"
                content += f"| 纬度 | {station.lat:.8f}° |\n"
            if station.height is not None:
                content += f"| 高程 | {station.height:.4f} m |\n"
            if station.antenna_height != 0.0:
                content += f"| 天线高 | {station.antenna_height:.4f} m |\n"
            if station.antenna_type:
                content += f"| 天线类型 | {station.antenna_type} |\n"
            if station.receiver_type:
                content += f"| 接收机类型 | {station.receiver_type} |\n"
            if station.notes:
                content += f"| 备注 | {station.notes} |\n"

            content += "\n"

        return content

    def _generate_rinex_statistics_section(self) -> str:
        """生成 RINEX 统计部分"""
        if not self.validator.rinex_parsers:
            return ""

        content = """
---

## RINEX 文件统计

"""

        for station_name, parser in self.validator.rinex_parsers.items():
            stats = parser.statistics
            header = parser.header

            if not stats:
                continue

            content += f"### {station_name}\n\n"
            content += f"**文件**: {os.path.basename(stats.file_path)}\n\n"

            content += "| 统计项 | 值 |\n|--------|-----|\n"

            if stats.first_epoch:
                content += f"| 首个历元 | {stats.first_epoch.strftime('%Y-%m-%d %H:%M:%S')} |\n"
            if stats.last_epoch:
                content += f"| 末个历元 | {stats.last_epoch.strftime('%Y-%m-%d %H:%M:%S')} |\n"

            duration_hours = stats.observation_duration_seconds / 3600
            content += f"| 观测时长 | {duration_hours:.2f} 小时 ({stats.observation_duration_seconds:.0f} 秒) |\n"
            content += f"| 总历元数 | {stats.total_epochs} |\n"
            content += f"| 有效历元 | {stats.valid_epochs} |\n"

            if stats.missing_epochs > 0:
                content += f"| **缺历元** | **{stats.missing_epochs}** |\n"

            if stats.nominal_interval:
                content += f"| 采样间隔 | {stats.nominal_interval:.1f} 秒 |\n"

            if stats.has_mixed_interval:
                content += f"| **采样率** | **混合采样率** |\n"

            if header:
                if header.approx_position != (0.0, 0.0, 0.0):
                    x, y, z = header.approx_position
                    content += f"| 近似坐标 | X: {x:.4f}, Y: {y:.4f}, Z: {z:.4f} |\n"
                if header.antenna_hen[0] != 0.0:
                    h, e, n = header.antenna_hen
                    content += f"| 天线高 (H/E/N) | {h:.4f} / {e:.4f} / {n:.4f} m |\n"

            if stats.satellite_epoch_counts:
                content += "\n**卫星观测历元数**:\n\n"
                content += "| 卫星 | 历元数 |\n|------|--------|\n"
                for prn, count in sorted(stats.satellite_epoch_counts.items()):
                    content += f"| {prn} | {count} |\n"

            content += "\n"

        return content

    def _generate_footer(self) -> str:
        """生成页脚"""
        return """
---

## 图例

### 严重程度

- **错误 (ERROR)**: 必须修复的严重问题，可能影响数据质量
- **警告 (WARNING)**: 需要关注的问题，建议检查确认
- **信息 (INFO)**: 仅供参考的提示信息

### 问题类型

| 类型 | 说明 |
|------|------|
| header_error | 文件头错误 |
| interval_mixed | 混合采样率 |
| missing_epochs | 缺历元 |
| cycle_slips | 周跳疑点 |
| short_duration | 观测时长短 |
| high_missing_rate | 缺历元率高 |
| cycle_slip | 周跳疑点详情 |
| coordinate_mismatch | 坐标不一致 |
| antenna_height_mismatch | 天线高不一致 |
| station_not_found | 基站未在台账中 |
| duration_shortfall | 观测时长不足 |
| missing_data | 缺少观测数据 |

---

*本报告由 GNSS Checker 自动生成*
"""

    def _format_severity(self, severity: str) -> str:
        """格式化严重程度显示"""
        severity_map = {
            "error": "**错误 (ERROR)**",
            "warning": "**警告 (WARNING)**",
            "info": "**信息 (INFO)**"
        }
        return severity_map.get(severity, severity)

    def generate_timeline_html(self) -> str:
        """生成 timeline.html"""
        output_path = os.path.join(self.output_dir, "timeline.html")

        timeline_data = self._prepare_timeline_data()

        html_content = self._generate_html_template(timeline_data)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        return output_path

    def _prepare_timeline_data(self) -> Dict[str, Any]:
        """准备时间线数据"""
        data = {
            "stations": [],
            "sessions": [],
            "issues": [],
            "time_range": {"min": None, "max": None}
        }

        all_times = []

        for station_name, parser in self.validator.rinex_parsers.items():
            stats = parser.statistics
            if not stats or not stats.first_epoch or not stats.last_epoch:
                continue

            station_data = {
                "name": station_name,
                "start": stats.first_epoch.isoformat(),
                "end": stats.last_epoch.isoformat(),
                "duration_hours": stats.observation_duration_seconds / 3600,
                "interval": stats.nominal_interval,
                "has_missing": stats.missing_epochs > 0,
                "has_cycle_slip": len(stats.cycle_slips) > 0,
                "file": os.path.basename(stats.file_path)
            }
            data["stations"].append(station_data)

            all_times.append(stats.first_epoch)
            all_times.append(stats.last_epoch)

        for session in self.validator.sessions:
            if not session.start_time or not session.end_time:
                continue

            session_data = {
                "name": session.session_name,
                "station": session.station_name,
                "start": session.start_time.isoformat(),
                "end": session.end_time.isoformat(),
                "duration_hours": session.expected_duration_seconds / 3600,
                "interval": session.expected_interval
            }
            data["sessions"].append(session_data)

            all_times.append(session.start_time)
            all_times.append(session.end_time)

        for issue in self.validator.issues:
            if issue.timestamp:
                issue_data = {
                    "id": issue.issue_id,
                    "station": issue.station_name,
                    "session": issue.session_name,
                    "type": issue.issue_type,
                    "severity": issue.severity,
                    "message": issue.message,
                    "time": issue.timestamp.isoformat()
                }
                data["issues"].append(issue_data)
                all_times.append(issue.timestamp)

        if all_times:
            data["time_range"]["min"] = min(all_times).isoformat()
            data["time_range"]["max"] = max(all_times).isoformat()

            min_time = min(all_times)
            max_time = max(all_times)
            padding = (max_time - min_time) * 0.1 if min_time != max_time else timedelta(hours=1)
            data["time_range"]["display_min"] = (min_time - padding).isoformat()
            data["time_range"]["display_max"] = (max_time + padding).isoformat()

        return data

    def _generate_html_template(self, data: Dict[str, Any]) -> str:
        """生成 HTML 模板"""
        data_json = json.dumps(data, ensure_ascii=False, indent=2)

        return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GNSS 观测时间线</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f5f7fa;
            color: #333;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        h1 {{
            text-align: center;
            margin-bottom: 30px;
            color: #2c3e50;
        }}
        
        .summary {{
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 30px;
            justify-content: center;
        }}
        
        .summary-card {{
            background: white;
            border-radius: 8px;
            padding: 15px 25px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }}
        
        .summary-card .value {{
            font-size: 24px;
            font-weight: bold;
            color: #3498db;
        }}
        
        .summary-card .label {{
            font-size: 12px;
            color: #7f8c8d;
            margin-top: 5px;
        }}
        
        .legend {{
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .legend-title {{
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
        }}
        
        .legend-items {{
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }}
        
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        
        .legend-color {{
            width: 20px;
            height: 12px;
            border-radius: 3px;
        }}
        
        .timeline-container {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        
        .timeline-header {{
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #ecf0f1;
        }}
        
        .station-labels {{
            width: 150px;
            flex-shrink: 0;
        }}
        
        .time-axis-header {{
            flex-grow: 1;
            position: relative;
            height: 30px;
        }}
        
        .time-marks {{
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            justify-content: space-between;
        }}
        
        .time-mark {{
            font-size: 11px;
            color: #7f8c8d;
            transform: translateX(-50%);
        }}
        
        .timeline-content {{
            display: flex;
        }}
        
        .station-list {{
            width: 150px;
            flex-shrink: 0;
        }}
        
        .station-item {{
            height: 50px;
            display: flex;
            align-items: center;
            padding-right: 10px;
            font-weight: 500;
            border-bottom: 1px solid #ecf0f1;
        }}
        
        .timeline-area {{
            flex-grow: 1;
            position: relative;
        }}
        
        .timeline-row {{
            height: 50px;
            border-bottom: 1px solid #ecf0f1;
            position: relative;
        }}
        
        .time-grid {{
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            justify-content: space-between;
            pointer-events: none;
        }}
        
        .grid-line {{
            width: 1px;
            height: 100%;
            background: #f0f0f0;
        }}
        
        .observation-bar {{
            position: absolute;
            top: 10px;
            height: 30px;
            border-radius: 5px;
            display: flex;
            align-items: center;
            padding: 0 8px;
            font-size: 11px;
            color: white;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            z-index: 10;
        }}
        
        .observation-bar:hover {{
            transform: scaleY(1.1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }}
        
        .observation-bar.normal {{
            background: #3498db;
        }}
        
        .observation-bar.warning {{
            background: #f39c12;
        }}
        
        .observation-bar.error {{
            background: #e74c3c;
        }}
        
        .observation-bar.plan {{
            background: rgba(52, 152, 219, 0.3);
            border: 2px dashed #3498db;
            color: #2980b9;
        }}
        
        .issue-marker {{
            position: absolute;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            top: -3px;
            transform: translateX(-50%);
            z-index: 20;
            cursor: pointer;
        }}
        
        .issue-marker.error {{
            background: #e74c3c;
            border: 2px solid #c0392b;
        }}
        
        .issue-marker.warning {{
            background: #f39c12;
            border: 2px solid #d68910;
        }}
        
        .tooltip {{
            position: fixed;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 13px;
            max-width: 300px;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        }}
        
        .tooltip.visible {{
            opacity: 1;
        }}
        
        .tooltip-title {{
            font-weight: bold;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        }}
        
        .tooltip-content {{
            line-height: 1.6;
        }}
        
        .issues-list {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .issues-list h3 {{
            margin-bottom: 15px;
            color: #2c3e50;
        }}
        
        .issue-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        
        .issue-table th,
        .issue-table td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }}
        
        .issue-table th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }}
        
        .issue-table tr:hover {{
            background: #f8f9fa;
        }}
        
        .severity-badge {{
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }}
        
        .severity-badge.error {{
            background: #fdf2f2;
            color: #dc2626;
        }}
        
        .severity-badge.warning {{
            background: #fffbeb;
            color: #d97706;
        }}
        
        .no-data {{
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>GNSS 静态观测时间线</h1>
        
        <div class="summary" id="summary">
        </div>
        
        <div class="legend">
            <div class="legend-title">图例</div>
            <div class="legend-items">
                <div class="legend-item">
                    <div class="legend-color" style="background: #3498db;"></div>
                    <span>实际观测 (正常)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f39c12;"></div>
                    <span>实际观测 (有警告)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: rgba(52, 152, 219, 0.3); border: 2px dashed #3498db;"></div>
                    <span>计划观测</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #e74c3c; border-radius: 50%;"></div>
                    <span>问题点 (错误)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f39c12; border-radius: 50%;"></div>
                    <span>问题点 (警告)</span>
                </div>
            </div>
        </div>
        
        <div class="timeline-container">
            <div class="timeline-header">
                <div class="station-labels">
                    <strong>基站</strong>
                </div>
                <div class="time-axis-header" id="timeAxisHeader">
                </div>
            </div>
            <div class="timeline-content">
                <div class="station-list" id="stationList">
                </div>
                <div class="timeline-area" id="timelineArea">
                </div>
            </div>
        </div>
        
        <div class="issues-list" id="issuesList">
        </div>
    </div>
    
    <div class="tooltip" id="tooltip"></div>
    
    <script>
        const data = {data_json};
        
        function formatTime(isoString) {{
            const date = new Date(isoString);
            return date.toLocaleString('zh-CN', {{
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }});
        }}
        
        function formatDuration(hours) {{
            if (hours < 1) {{
                return `${{(hours * 60).toFixed(1)}} 分钟`;
            }}
            return `${{hours.toFixed(2)}} 小时`;
        }}
        
        function initSummary() {{
            const summaryEl = document.getElementById('summary');
            
            const stats = [
                {{ label: '基站数', value: data.stations.length }},
                {{ label: '测段计划', value: data.sessions.length }},
                {{ label: '问题数', value: data.issues.length }}
            ];
            
            summaryEl.innerHTML = stats.map(s => `
                <div class="summary-card">
                    <div class="value">${{s.value}}</div>
                    <div class="label">${{s.label}}</div>
                </div>
            `).join('');
        }}
        
        function initTimeline() {{
            if (!data.time_range.display_min || !data.time_range.display_max) {{
                return;
            }}
            
            const minTime = new Date(data.time_range.display_min).getTime();
            const maxTime = new Date(data.time_range.display_max).getTime();
            const timeRange = maxTime - minTime;
            
            const stationListEl = document.getElementById('stationList');
            const timelineAreaEl = document.getElementById('timelineArea');
            const timeAxisHeaderEl = document.getElementById('timeAxisHeader');
            
            const allStations = new Set();
            data.stations.forEach(s => allStations.add(s.name));
            data.sessions.forEach(s => allStations.add(s.station));
            const stationNames = Array.from(allStations).sort();
            
            stationListEl.innerHTML = stationNames.map(name => `
                <div class="station-item">${{name}}</div>
            `).join('');
            
            let timelineHtml = '';
            stationNames.forEach((name, idx) => {{
                const y = idx * 50;
                
                timelineHtml += `
                    <div class="timeline-row" style="top: ${{y}}px;">
                        <div class="time-grid" id="grid-${{idx}}"></div>
                    </div>
                `;
            }});
            
            timelineAreaEl.innerHTML = timelineHtml;
            
            data.stations.forEach(station => {{
                const stationIdx = stationNames.indexOf(station.name);
                if (stationIdx < 0) return;
                
                const y = stationIdx * 50 + 10;
                const startTime = new Date(station.start).getTime();
                const endTime = new Date(station.end).getTime();
                
                const left = ((startTime - minTime) / timeRange) * 100;
                const width = ((endTime - startTime) / timeRange) * 100;
                
                let barClass = 'normal';
                if (station.has_cycle_slip) {{
                    barClass = 'warning';
                }}
                if (station.has_missing && station.missing_epochs > 10) {{
                    barClass = 'error';
                }}
                
                const bar = document.createElement('div');
                bar.className = `observation-bar ${{barClass}}`;
                bar.style.left = `${{left}}%`;
                bar.style.width = `${{width}}%`;
                bar.style.top = `${{y - 10}}px`;
                bar.innerHTML = `${{station.name}} (${{formatDuration(station.duration_hours)}})`;
                
                bar.dataset.tooltip = `
                    <div class="tooltip-title">${{station.name}}</div>
                    <div class="tooltip-content">
                        <strong>文件:</strong> ${{station.file}}<br>
                        <strong>开始:</strong> ${{formatTime(station.start)}}<br>
                        <strong>结束:</strong> ${{formatTime(station.end)}}<br>
                        <strong>时长:</strong> ${{formatDuration(station.duration_hours)}}<br>
                        <strong>采样间隔:</strong> ${{station.interval ? station.interval + 's' : 'N/A'}}<br>
                        ${{station.has_missing ? '<strong style="color:#f39c12;">有缺历元</strong><br>' : ''}}
                        ${{station.has_cycle_slip ? '<strong style="color:#f39c12;">有周跳疑点</strong>' : ''}}
                    </div>
                `;
                
                timelineAreaEl.appendChild(bar);
            }});
            
            data.sessions.forEach(session => {{
                const stationIdx = stationNames.indexOf(session.station);
                if (stationIdx < 0) return;
                
                const y = stationIdx * 50 + 10;
                const startTime = new Date(session.start).getTime();
                const endTime = new Date(session.end).getTime();
                
                const left = ((startTime - minTime) / timeRange) * 100;
                const width = ((endTime - startTime) / timeRange) * 100;
                
                const bar = document.createElement('div');
                bar.className = 'observation-bar plan';
                bar.style.left = `${{left}}%`;
                bar.style.width = `${{width}}%`;
                bar.style.top = `${{y - 10}}px`;
                bar.innerHTML = `${{session.name}} (计划)`;
                
                bar.dataset.tooltip = `
                    <div class="tooltip-title">${{session.name}} (计划)</div>
                    <div class="tooltip-content">
                        <strong>基站:</strong> ${{session.station}}<br>
                        <strong>计划开始:</strong> ${{formatTime(session.start)}}<br>
                        <strong>计划结束:</strong> ${{formatTime(session.end)}}<br>
                        <strong>计划时长:</strong> ${{formatDuration(session.duration_hours)}}
                    </div>
                `;
                
                timelineAreaEl.appendChild(bar);
            }});
            
            data.issues.forEach(issue => {{
                if (!issue.time) return;
                
                const stationIdx = stationNames.indexOf(issue.station);
                if (stationIdx < 0) return;
                
                const y = stationIdx * 50;
                const issueTime = new Date(issue.time).getTime();
                
                const left = ((issueTime - minTime) / timeRange) * 100;
                
                const marker = document.createElement('div');
                marker.className = `issue-marker ${{issue.severity}}`;
                marker.style.left = `${{left}}%`;
                marker.style.top = `${{y}}px`;
                
                marker.dataset.tooltip = `
                    <div class="tooltip-title">${{issue.id}} - ${{issue.severity === 'error' ? '错误' : '警告'}}</div>
                    <div class="tooltip-content">
                        <strong>基站:</strong> ${{issue.station}}<br>
                        <strong>类型:</strong> ${{issue.type}}<br>
                        <strong>时间:</strong> ${{formatTime(issue.time)}}<br>
                        <strong>描述:</strong> ${{issue.message}}
                    </div>
                `;
                
                timelineAreaEl.appendChild(marker);
            }});
            
            const numGridLines = 10;
            document.querySelectorAll('.time-grid').forEach(grid => {{
                let gridHtml = '';
                for (let i = 0; i <= numGridLines; i++) {{
                    gridHtml += `<div class="grid-line" style="left: ${{(i/numGridLines)*100}}%;"></div>`;
                }}
                grid.innerHTML = gridHtml;
            }});
            
            let timeMarksHtml = '<div class="time-marks">';
            for (let i = 0; i <= numGridLines; i++) {{
                const time = minTime + (timeRange * i / numGridLines);
                const date = new Date(time);
                const label = date.toLocaleString('zh-CN', {{
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }});
                timeMarksHtml += `<div class="time-mark" style="left: ${{(i/numGridLines)*100}}%;">${{label}}</div>`;
            }}
            timeMarksHtml += '</div>';
            timeAxisHeaderEl.innerHTML = timeMarksHtml;
            
            setupTooltips();
        }}
        
        function setupTooltips() {{
            const tooltip = document.getElementById('tooltip');
            
            document.querySelectorAll('.observation-bar, .issue-marker').forEach(el => {{
                el.addEventListener('mouseenter', (e) => {{
                    tooltip.innerHTML = el.dataset.tooltip;
                    tooltip.classList.add('visible');
                    positionTooltip(e);
                }});
                
                el.addEventListener('mousemove', positionTooltip);
                
                el.addEventListener('mouseleave', () => {{
                    tooltip.classList.remove('visible');
                }});
            }});
            
            function positionTooltip(e) {{
                const tooltipRect = tooltip.getBoundingClientRect();
                let x = e.clientX + 15;
                let y = e.clientY + 15;
                
                if (x + tooltipRect.width > window.innerWidth) {{
                    x = e.clientX - tooltipRect.width - 15;
                }}
                if (y + tooltipRect.height > window.innerHeight) {{
                    y = e.clientY - tooltipRect.height - 15;
                }}
                
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
            }}
        }}
        
        function initIssuesList() {{
            const issuesListEl = document.getElementById('issuesList');
            
            if (data.issues.length === 0) {{
                issuesListEl.innerHTML = `
                    <h3>问题列表</h3>
                    <div class="no-data">
                        <strong>所有检查项均通过，未发现问题。</strong>
                    </div>
                `;
                return;
            }}
            
            let tableHtml = `
                <h3>问题列表 (共 ${{data.issues.length}} 个)</h3>
                <table class="issue-table">
                    <thead>
                        <tr>
                            <th>编号</th>
                            <th>严重程度</th>
                            <th>基站</th>
                            <th>类型</th>
                            <th>描述</th>
                            <th>时间</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            data.issues
                .sort((a, b) => {{
                    const severityOrder = {{ error: 0, warning: 1, info: 2 }};
                    return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
                }})
                .forEach(issue => {{
                    const severityLabel = issue.severity === 'error' ? '错误' : 
                                          issue.severity === 'warning' ? '警告' : '信息';
                    tableHtml += `
                        <tr>
                            <td>${{issue.id}}</td>
                            <td><span class="severity-badge ${{issue.severity}}">${{severityLabel}}</span></td>
                            <td>${{issue.station}}</td>
                            <td>${{issue.type}}</td>
                            <td>${{issue.message}}</td>
                            <td>${{issue.time ? formatTime(issue.time) : '-'}}</td>
                        </tr>
                    `;
                }});
            
            tableHtml += `
                    </tbody>
                </table>
            `;
            
            issuesListEl.innerHTML = tableHtml;
        }}
        
        document.addEventListener('DOMContentLoaded', () => {{
            initSummary();
            initTimeline();
            initIssuesList();
        }});
    </script>
</body>
</html>
'''
