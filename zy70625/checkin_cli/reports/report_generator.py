import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from jinja2 import Template

from ..models import QualificationReport, ValidationStatus, IssueSeverity


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>检录资格校验报告 - {{ report.report_id }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-card { padding: 20px; border-radius: 6px; text-align: center; }
        .summary-card h3 { font-size: 2em; margin-bottom: 5px; }
        .summary-card p { color: #666; font-size: 0.9em; }
        .total { background: #e3f2fd; color: #1976d2; }
        .pass { background: #e8f5e9; color: #388e3c; }
        .fail { background: #ffebee; color: #d32f2f; }
        .warning { background: #fff3e0; color: #f57c00; }
        h2 { color: #444; margin: 30px 0 15px; border-left: 4px solid #4CAF50; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: 600; color: #333; }
        tr:hover { background: #f5f5f5; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 500; }
        .status-PASS { background: #c8e6c9; color: #2e7d32; }
        .status-FAIL { background: #ffcdd2; color: #c62828; }
        .status-WARNING { background: #ffe0b2; color: #ef6c00; }
        .severity-ERROR { color: #d32f2f; font-weight: 600; }
        .severity-WARNING { color: #f57c00; font-weight: 600; }
        .severity-INFO { color: #1976d2; }
        .issues-list { list-style: none; }
        .issues-list li { padding: 8px 12px; margin: 5px 0; background: #fafafa; border-left: 3px solid; border-radius: 0 4px 4px 0; }
        .issues-list li.ERROR { border-color: #d32f2f; }
        .issues-list li.WARNING { border-color: #f57c00; }
        .issues-list li.INFO { border-color: #1976d2; }
        .meta-info { color: #666; font-size: 0.9em; margin-bottom: 20px; }
        .parse-errors { background: #ffebee; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .parse-errors h4 { color: #c62828; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏆 检录资格校验报告</h1>
        <div class="meta-info">
            <p><strong>报告编号:</strong> {{ report.report_id }}</p>
            <p><strong>生成时间:</strong> {{ report.generated_at.strftime('%Y-%m-%d %H:%M:%S') }}</p>
        </div>

        <h2>📊 校验概览</h2>
        <div class="summary">
            <div class="summary-card total">
                <h3>{{ report.total_players }}</h3>
                <p>总选手数</p>
            </div>
            <div class="summary-card pass">
                <h3>{{ report.qualified_count }}</h3>
                <p>资格通过</p>
            </div>
            <div class="summary-card fail">
                <h3>{{ report.disqualified_count }}</h3>
                <p>资格不通过</p>
            </div>
            <div class="summary-card warning">
                <h3>{{ report.warning_count }}</h3>
                <p>存在警告</p>
            </div>
        </div>

        {% if report.parse_errors %}
        <div class="parse-errors">
            <h4>⚠️ 文件解析错误 ({{ report.parse_errors|length }} 条)</h4>
            <table>
                <tr>
                    <th>文件</th>
                    <th>行号</th>
                    <th>错误信息</th>
                </tr>
                {% for err in report.parse_errors %}
                <tr>
                    <td>{{ Path(err.file_path).name }}</td>
                    <td>{{ err.row_number }}</td>
                    <td>{{ err.error_message }}</td>
                </tr>
                {% endfor %}
            </table>
        </div>
        {% endif %}

        <h2>👥 选手资格明细</h2>
        <table>
            <tr>
                <th>选手ID</th>
                <th>姓名</th>
                <th>组别</th>
                <th>状态</th>
                <th>检录次数</th>
                <th>是否替补</th>
            </tr>
            {% for pq in report.player_qualifications %}
            <tr>
                <td>{{ pq.player.player_id }}</td>
                <td>{{ pq.player.name }}</td>
                <td>{{ pq.player.group_id }}</td>
                <td><span class="status-badge status-{{ pq.overall_status }}">{{ pq.overall_status }}</span></td>
                <td>{{ pq.checkin_count }}</td>
                <td>{{ "是" if pq.is_substitute else "否" }}</td>
            </tr>
            {% if pq.issues %}
            <tr>
                <td colspan="6">
                    <ul class="issues-list">
                        {% for issue in pq.issues %}
                        <li class="{{ issue.severity }}">
                            <span class="severity-{{ issue.severity }}">[{{ issue.rule_type }}]</span>
                            {{ issue.message }}
                            {% if issue.source %}
                            <small>({{ Path(issue.source.file_path).name }}:{{ issue.source.row_number }})</small>
                            {% endif %}
                        </li>
                        {% endfor %}
                    </ul>
                </td>
            </tr>
            {% endif %}
            {% endfor %}
        </table>

        <h2>❌ 所有问题汇总</h2>
        <table>
            <tr>
                <th>规则类型</th>
                <th>严重程度</th>
                <th>消息</th>
                <th>来源</th>
            </tr>
            {% for issue in report.all_issues %}
            <tr>
                <td>{{ issue.rule_type }}</td>
                <td><span class="severity-{{ issue.severity }}">{{ issue.severity }}</span></td>
                <td>{{ issue.message }}</td>
                <td>
                    {% if issue.source %}
                    {{ Path(issue.source.file_path).name }}:{{ issue.source.row_number }}
                    {% endif %}
                </td>
            </tr>
            {% endfor %}
        </table>
    </div>
</body>
</html>
"""


class ReportGenerator:
    def __init__(self, report: QualificationReport):
        self.report = report

    def to_html(self, output_path: str):
        template = Template(HTML_TEMPLATE)
        html_content = template.render(
            report=self.report,
            datetime=datetime,
            Path=Path,
        )
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

    def to_excel(self, output_path: str):
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            summary_data = {
                "指标": ["总选手数", "资格通过", "资格不通过", "存在警告", "报告编号", "生成时间"],
                "数值": [
                    self.report.total_players,
                    self.report.qualified_count,
                    self.report.disqualified_count,
                    self.report.warning_count,
                    self.report.report_id,
                    self.report.generated_at.strftime("%Y-%m-%d %H:%M:%S"),
                ],
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name="概览", index=False)

            players_data = []
            for pq in sorted(self.report.player_qualifications, key=lambda x: x.player.player_id):
                issue_messages = "; ".join([i.message for i in pq.issues]) if pq.issues else ""
                players_data.append({
                    "选手ID": pq.player.player_id,
                    "姓名": pq.player.name,
                    "组别": pq.player.group_id,
                    "状态": pq.overall_status,
                    "是否合格": "是" if pq.is_qualified else "否",
                    "检录次数": pq.checkin_count,
                    "是否替补": "是" if pq.is_substitute else "否",
                    "替补优先级": pq.substitute_priority if pq.substitute_priority else "",
                    "问题明细": issue_messages,
                })
            pd.DataFrame(players_data).to_excel(writer, sheet_name="选手明细", index=False)

            issues_data = []
            for issue in sorted(self.report.all_issues, key=lambda x: (x.severity, x.rule_type)):
                source_info = ""
                if issue.source:
                    source_info = f"{Path(issue.source.file_path).name}:{issue.source.row_number}"
                issues_data.append({
                    "规则类型": issue.rule_type,
                    "严重程度": issue.severity,
                    "消息": issue.message,
                    "来源": source_info,
                    "选手ID": issue.details.get("player_id", "") if issue.details else "",
                })
            pd.DataFrame(issues_data).to_excel(writer, sheet_name="问题汇总", index=False)

            if self.report.parse_errors:
                errors_data = []
                for err in self.report.parse_errors:
                    errors_data.append({
                        "文件": Path(err["file_path"]).name,
                        "行号": err["row_number"],
                        "错误信息": err["error_message"],
                    })
                pd.DataFrame(errors_data).to_excel(writer, sheet_name="解析错误", index=False)

    def to_json(self, output_path: str, indent: int = 2):
        report_dict = {
            "report_id": self.report.report_id,
            "generated_at": self.report.generated_at.isoformat(),
            "summary": {
                "total_players": self.report.total_players,
                "qualified_count": self.report.qualified_count,
                "disqualified_count": self.report.disqualified_count,
                "warning_count": self.report.warning_count,
            },
            "player_qualifications": [],
            "all_issues": [],
            "parse_errors": self.report.parse_errors,
        }

        for pq in self.report.player_qualifications:
            report_dict["player_qualifications"].append({
                "player_id": pq.player.player_id,
                "name": pq.player.name,
                "group_id": pq.player.group_id,
                "overall_status": pq.overall_status,
                "is_qualified": pq.is_qualified,
                "checkin_count": pq.checkin_count,
                "is_substitute": pq.is_substitute,
                "substitute_priority": pq.substitute_priority,
                "issues_count": len(pq.issues),
            })

        for issue in self.report.all_issues:
            source_info = None
            if issue.source:
                source_info = {
                    "file_path": issue.source.file_path,
                    "row_number": issue.source.row_number,
                }
            report_dict["all_issues"].append({
                "rule_type": issue.rule_type,
                "severity": issue.severity,
                "message": issue.message,
                "source": source_info,
                "details": issue.details,
            })

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=indent)


def generate_html_report(report: QualificationReport, output_path: str):
    generator = ReportGenerator(report)
    generator.to_html(output_path)


def generate_excel_report(report: QualificationReport, output_path: str):
    generator = ReportGenerator(report)
    generator.to_excel(output_path)


def generate_json_report(report: QualificationReport, output_path: str):
    generator = ReportGenerator(report)
    generator.to_json(output_path)
