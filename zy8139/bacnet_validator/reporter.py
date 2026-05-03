import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict

from .rules import ValidationResult, ValidationIssue, IssueType, IssueSeverity
from .parser import PointMapping, BACnetReading


class Reporter:
    def __init__(self, result: ValidationResult):
        self.result = result

    def generate_all(
        self,
        output_dir: str,
        issues_filename: str = "issues.csv",
        report_filename: str = "mapping_report.md",
        timeline_filename: str = "timeline.html",
    ):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        issues_path = output_path / issues_filename
        self.generate_issues_csv(str(issues_path))

        report_path = output_path / report_filename
        self.generate_mapping_report_md(str(report_path))

        timeline_path = output_path / timeline_filename
        self.generate_timeline_html(str(timeline_path))

        return {
            "issues_csv": str(issues_path),
            "mapping_report_md": str(report_path),
            "timeline_html": str(timeline_path),
        }

    def generate_issues_csv(self, filepath: str):
        issues = sorted(
            self.result.all_issues,
            key=lambda i: (
                self._severity_order(i.severity),
                i.point_identifier,
                i.reading_timestamp or datetime.min.replace(tzinfo=timezone.utc),
            ),
        )

        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Severity",
                "Issue Type",
                "Point Identifier",
                "Floor",
                "Device ID",
                "Reading Timestamp (UTC)",
                "Message",
                "Expected Value",
                "Actual Value",
                "Details JSON",
            ])

            for issue in issues:
                writer.writerow([
                    issue.severity.value,
                    issue.issue_type.value,
                    issue.point_identifier,
                    issue.floor or "",
                    issue.device_id or "",
                    issue.reading_timestamp.isoformat() if issue.reading_timestamp else "",
                    issue.message,
                    str(issue.expected_value) if issue.expected_value is not None else "",
                    str(issue.actual_value) if issue.actual_value is not None else "",
                    json.dumps(issue.details, ensure_ascii=False, default=str),
                ])

    def _severity_order(self, severity: IssueSeverity) -> int:
        order = {
            IssueSeverity.CRITICAL: 0,
            IssueSeverity.HIGH: 1,
            IssueSeverity.MEDIUM: 2,
            IssueSeverity.LOW: 3,
        }
        return order.get(severity, 99)

    def generate_mapping_report_md(self, filepath: str):
        lines = []

        lines.append("# BACnet Gateway Upgrade Validation Report")
        lines.append("")
        lines.append(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append("")

        lines.append("## Summary")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total Points in Mapping | {self.result.total_points} |")
        lines.append(f"| Total Readings Processed | {self.result.total_readings} |")
        lines.append(f"| Points with Readings | {self.result.points_with_readings} |")
        lines.append(f"| Points without Readings | {self.result.points_without_readings} |")
        lines.append(f"| Time Range | {self.result.start_time.strftime('%Y-%m-%d %H:%M:%S')} to {self.result.end_time.strftime('%Y-%m-%d %H:%M:%S')} |")
        lines.append("")

        lines.append("## Issues Summary")
        lines.append("")
        lines.append("| Severity | Count |")
        lines.append("|----------|-------|")
        lines.append(f"| Critical | {self.result.critical_count} |")
        lines.append(f"| High | {self.result.high_count} |")
        lines.append(f"| Medium | {self.result.medium_count} |")
        lines.append(f"| Low | {self.result.low_count} |")
        lines.append(f"| **Total** | **{len(self.result.all_issues)}** |")
        lines.append("")

        if self.result.critical_count > 0:
            lines.append("### Critical Issues")
            lines.append("")
            critical_issues = [i for i in self.result.all_issues if i.severity == IssueSeverity.CRITICAL]
            for issue in critical_issues[:20]:
                lines.append(f"- **{issue.point_identifier}**: {issue.message}")
                if issue.reading_timestamp:
                    lines.append(f"  - Time: {issue.reading_timestamp}")
                if issue.details:
                    lines.append(f"  - Details: {json.dumps(issue.details, default=str)}")
                lines.append("")
            if len(critical_issues) > 20:
                lines.append(f"... and {len(critical_issues) - 20} more critical issues. See issues.csv for full list.")
                lines.append("")

        if self.result.high_count > 0:
            lines.append("### High Priority Issues")
            lines.append("")
            high_issues = [i for i in self.result.all_issues if i.severity == IssueSeverity.HIGH]
            for issue in high_issues[:20]:
                lines.append(f"- **{issue.point_identifier}**: {issue.message}")
                if issue.reading_timestamp:
                    lines.append(f"  - Time: {issue.reading_timestamp}")
                lines.append("")
            if len(high_issues) > 20:
                lines.append(f"... and {len(high_issues) - 20} more high priority issues.")
                lines.append("")

        lines.append("## Point Mapping Details")
        lines.append("")
        lines.append("### Points with Issues")
        lines.append("")

        points_with_issues = defaultdict(list)
        for issue in self.result.all_issues:
            if issue.point_identifier != "TIMEZONE_WARNING":
                points_with_issues[issue.point_identifier].append(issue)

        if points_with_issues:
            for point_id, issues in sorted(points_with_issues.items()):
                lines.append(f"#### {point_id}")
                lines.append("")
                for issue in issues:
                    lines.append(f"- [{issue.severity.value.upper()}] {issue.issue_type.value}: {issue.message}")
                lines.append("")
        else:
            lines.append("No points have issues.")
            lines.append("")

        lines.append("### Sample Mappings")
        lines.append("")
        lines.append("| Full Identifier | Old Name | New Name | Unit | Multiplier | Floor |")
        lines.append("|-----------------|----------|----------|------|------------|-------|")
        for mapping in list(self.result.all_mappings)[:20]:
            lines.append(f"| {mapping.full_identifier} | {mapping.old_name} | {mapping.new_name} | {mapping.unit} | {mapping.unit_multiplier} | {mapping.floor or 'N/A'} |")
        if len(self.result.all_mappings) > 20:
            lines.append(f"| ... | ... | ... | ... | ... | ... |")
            lines.append(f"| *{len(self.result.all_mappings)} total mappings* | | | | | |")
        lines.append("")

        lines.append("## Warnings")
        lines.append("")

        warnings = [i for i in self.result.warnings if i.severity == IssueSeverity.WARNING]
        if warnings:
            for warning in warnings:
                lines.append(f"- **{warning.issue_type.value}**: {warning.message}")
                if warning.details:
                    lines.append(f"  - Details: {json.dumps(warning.details, default=str)}")
                lines.append("")
        else:
            lines.append("No warnings detected.")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*This report was generated by BACnet Upgrade Validator.*")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def generate_timeline_html(self, filepath: str):
        issues_by_time = defaultdict(list)
        for issue in self.result.all_issues:
            if issue.reading_timestamp:
                ts_key = issue.reading_timestamp.strftime("%Y-%m-%d %H:%M")
                issues_by_time[ts_key].append(issue)

        all_readings_by_time = defaultdict(lambda: {"count": 0, "points": set()})
        for reading in self.result.all_readings:
            ts_key = reading.timestamp.strftime("%Y-%m-%d %H:%M")
            all_readings_by_time[ts_key]["count"] += 1
            all_readings_by_time[ts_key]["points"].add(reading.full_identifier)

        for ts_key, data in all_readings_by_time.items():
            data["points"] = len(data["points"])

        issues_json = json.dumps([
            {
                "timestamp": issue.reading_timestamp.isoformat() if issue.reading_timestamp else None,
                "severity": issue.severity.value,
                "type": issue.issue_type.value,
                "point": issue.point_identifier,
                "message": issue.message,
                "floor": issue.floor,
            }
            for issue in self.result.all_issues
            if issue.reading_timestamp
        ], default=str)

        summary_data = {
            "timeRange": {
                "start": self.result.start_time.isoformat(),
                "end": self.result.end_time.isoformat(),
            },
            "totalPoints": self.result.total_points,
            "totalReadings": self.result.total_readings,
            "criticalCount": self.result.critical_count,
            "highCount": self.result.high_count,
            "mediumCount": self.result.medium_count,
            "lowCount": self.result.low_count,
        }

        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BACnet Upgrade Validation Timeline</title>
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
            padding: 20px;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        h1 {{
            text-align: center;
            color: #2c3e50;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 2px solid #3498db;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .summary-card {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }}
        .summary-card .label {{
            font-size: 14px;
            color: #7f8c8d;
            margin-bottom: 8px;
        }}
        .summary-card .value {{
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
        }}
        .summary-card.critical .value {{ color: #e74c3c; }}
        .summary-card.high .value {{ color: #e67e22; }}
        .summary-card.medium .value {{ color: #f1c40f; }}
        .summary-card.low .value {{ color: #3498db; }}
        
        .timeline-section {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }}
        h2 {{
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }}
        
        .timeline {{
            position: relative;
            padding-left: 40px;
        }}
        .timeline::before {{
            content: '';
            position: absolute;
            left: 20px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e0e0e0;
        }}
        .timeline-item {{
            position: relative;
            margin-bottom: 30px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }}
        .timeline-item::before {{
            content: '';
            position: absolute;
            left: -30px;
            top: 20px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #3498db;
            border: 2px solid white;
            box-shadow: 0 0 0 2px #3498db;
        }}
        .timeline-item.critical {{ border-left-color: #e74c3c; }}
        .timeline-item.critical::before {{ background: #e74c3c; box-shadow: 0 0 0 2px #e74c3c; }}
        .timeline-item.high {{ border-left-color: #e67e22; }}
        .timeline-item.high::before {{ background: #e67e22; box-shadow: 0 0 0 2px #e67e22; }}
        .timeline-item.medium {{ border-left-color: #f1c40f; }}
        .timeline-item.medium::before {{ background: #f1c40f; box-shadow: 0 0 0 2px #f1c40f; }}
        
        .timeline-time {{
            font-size: 12px;
            color: #7f8c8d;
            margin-bottom: 8px;
        }}
        .timeline-point {{
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }}
        .timeline-type {{
            font-size: 12px;
            color: #95a5a6;
            margin-right: 10px;
        }}
        .timeline-message {{
            color: #555;
        }}
        .timeline-floor {{
            font-size: 12px;
            color: #7f8c8d;
            margin-left: 10px;
        }}
        
        .filters {{
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }}
        .filter-btn {{
            padding: 8px 16px;
            border: 2px solid #ddd;
            background: white;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }}
        .filter-btn:hover {{
            border-color: #3498db;
        }}
        .filter-btn.active {{
            background: #3498db;
            color: white;
            border-color: #3498db;
        }}
        .filter-btn.critical.active {{ background: #e74c3c; border-color: #e74c3c; }}
        .filter-btn.high.active {{ background: #e67e22; border-color: #e67e22; }}
        .filter-btn.medium.active {{ background: #f1c40f; border-color: #f1c40f; }}
        .filter-btn.low.active {{ background: #3498db; border-color: #3498db; }}
        
        .no-issues {{
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
            font-size: 18px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>BACnet Upgrade Validation Timeline</h1>
        
        <div class="summary-grid">
            <div class="summary-card">
                <div class="label">Total Points</div>
                <div class="value">{summary_data['totalPoints']}</div>
            </div>
            <div class="summary-card">
                <div class="label">Total Readings</div>
                <div class="value">{summary_data['totalReadings']}</div>
            </div>
            <div class="summary-card critical">
                <div class="label">Critical Issues</div>
                <div class="value">{summary_data['criticalCount']}</div>
            </div>
            <div class="summary-card high">
                <div class="label">High Issues</div>
                <div class="value">{summary_data['highCount']}</div>
            </div>
            <div class="summary-card medium">
                <div class="label">Medium Issues</div>
                <div class="value">{summary_data['mediumCount']}</div>
            </div>
            <div class="summary-card low">
                <div class="label">Low Issues</div>
                <div class="value">{summary_data['lowCount']}</div>
            </div>
        </div>
        
        <div class="timeline-section">
            <h2>Issue Timeline</h2>
            
            <div class="filters">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn critical" data-filter="critical">Critical ({summary_data['criticalCount']})</button>
                <button class="filter-btn high" data-filter="high">High ({summary_data['highCount']})</button>
                <button class="filter-btn medium" data-filter="medium">Medium ({summary_data['mediumCount']})</button>
                <button class="filter-btn low" data-filter="low">Low ({summary_data['lowCount']})</button>
            </div>
            
            <div id="timeline-container" class="timeline">
            </div>
            
            <div id="no-issues" class="no-issues" style="display: none;">
                No issues found for the selected filter.
            </div>
        </div>
    </div>

    <script>
        const issuesData = {issues_json};
        
        function formatTime(isoString) {{
            if (!isoString) return 'N/A';
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
        
        function renderIssues(filter = 'all') {{
            const container = document.getElementById('timeline-container');
            const noIssues = document.getElementById('no-issues');
            
            let filteredIssues = issuesData;
            if (filter !== 'all') {{
                filteredIssues = issuesData.filter(issue => issue.severity === filter);
            }}
            
            filteredIssues.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            if (filteredIssues.length === 0) {{
                container.innerHTML = '';
                noIssues.style.display = 'block';
                return;
            }}
            
            noIssues.style.display = 'none';
            
            let html = '';
            for (const issue of filteredIssues) {{
                html += `
                    <div class="timeline-item ${{issue.severity}}">
                        <div class="timeline-time">${{formatTime(issue.timestamp)}}</div>
                        <div class="timeline-point">
                            ${{issue.point}}
                            ${{issue.floor ? `<span class="timeline-floor">Floor: ${{issue.floor}}</span>` : ''}}
                        </div>
                        <div>
                            <span class="timeline-type">[${{issue.severity.toUpperCase()}}] ${{issue.type}}</span>
                            <span class="timeline-message">${{issue.message}}</span>
                        </div>
                    </div>
                `;
            }}
            
            container.innerHTML = html;
        }}
        
        document.querySelectorAll('.filter-btn').forEach(btn => {{
            btn.addEventListener('click', function() {{
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                renderIssues(this.dataset.filter);
            }});
        }});
        
        renderIssues();
    </script>
</body>
</html>
"""

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
