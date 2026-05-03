import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

from .models import Issue, ReleaseWindow, IssueSeverity, FluidType


class CSVWriter:
    def write_issues(self, issues: List[Issue], file_path: str):
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if not issues:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "issue_id", "issue_type", "severity", "flight_number",
                    "aircraft_registration", "runway", "timestamp", "description",
                    "recommendation", "metadata"
                ])
            return
        
        rows = [issue.to_csv_row() for issue in issues]
        fieldnames = list(rows[0].keys())
        
        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)


class MarkdownWriter:
    def __init__(self):
        self.lines: List[str] = []

    def h1(self, text: str):
        self.lines.append(f"# {text}")
        self.lines.append("")

    def h2(self, text: str):
        self.lines.append(f"## {text}")
        self.lines.append("")

    def h3(self, text: str):
        self.lines.append(f"### {text}")
        self.lines.append("")

    def p(self, text: str):
        self.lines.append(text)
        self.lines.append("")

    def table(self, headers: List[str], rows: List[List[Any]]):
        self.lines.append(f"| {' | '.join(str(h) for h in headers)} |")
        self.lines.append(f"| {' | '.join(['---'] * len(headers))} |")
        for row in rows:
            self.lines.append(f"| {' | '.join(str(cell) for cell in row)} |")
        self.lines.append("")

    def bullet(self, text: str, level: int = 0):
        indent = "  " * level
        self.lines.append(f"{indent}- {text}")
        if level == 0:
            self.lines.append("")

    def code_block(self, code: str, language: str = ""):
        self.lines.append(f"```{language}")
        self.lines.append(code)
        self.lines.append("```")
        self.lines.append("")

    def divider(self):
        self.lines.append("---")
        self.lines.append("")

    def render(self) -> str:
        return "\n".join(self.lines)

    def write(self, file_path: str):
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(self.render())


class ReportGenerator:
    def generate_report(
        self,
        summary: Dict[str, Any],
        issues: List[Issue],
        release_windows: List[ReleaseWindow],
        respray_recommendations: List[Dict[str, Any]],
        output_path: str
    ):
        writer = MarkdownWriter()
        
        writer.h1("跑道除冰作业复核报告")
        writer.p(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        writer.divider()
        
        self._write_executive_summary(writer, summary, issues)
        
        self._write_release_windows(writer, release_windows)
        
        self._write_issues_by_severity(writer, issues)
        
        self._write_respray_recommendations(writer, respray_recommendations)
        
        self._write_statistics(writer, summary)
        
        writer.write(output_path)

    def _write_executive_summary(self, writer: MarkdownWriter, summary: Dict, issues: List[Issue]):
        writer.h2("执行摘要")
        
        critical = summary.get('critical_issues', 0)
        warning = summary.get('warning_issues', 0)
        info = summary.get('info_issues', 0)
        total = summary.get('total_flights', 0)
        cross_midnight = summary.get('cross_midnight_flights', 0)
        
        if critical > 0:
            writer.p(f"⚠️ **发现 {critical} 个严重问题**，需要立即处理！")
        elif warning > 0:
            writer.p(f"⚠️ 发现 {warning} 个警告事项，建议关注。")
        else:
            writer.p("✅ 所有检查项均通过，无异常发现。")
        
        stats_headers = ["指标", "数值"]
        stats_rows = [
            ["总航班数", total],
            ["跨午夜航班", cross_midnight],
            ["严重问题", critical],
            ["警告事项", warning],
            ["提示信息", info],
        ]
        writer.table(stats_headers, stats_rows)

    def _write_release_windows(self, writer: MarkdownWriter, windows: List[ReleaseWindow]):
        if not windows:
            return
        
        writer.h2("放行窗口概览")
        
        headers = [
            "航班号", "注册号", "跑道", "喷洒时间", 
            "计划起飞", "保持截止(最小)", "保持截止(最大)",
            "液型", "批次", "温度"
        ]
        
        rows = []
        for w in sorted(windows, key=lambda x: x.scheduled_departure):
            rows.append([
                w.flight_number,
                w.aircraft_registration,
                w.runway,
                w.spray_time.strftime('%H:%M'),
                w.scheduled_departure.strftime('%H:%M'),
                w.hold_end_time_min.strftime('%H:%M'),
                w.hold_end_time_max.strftime('%H:%M'),
                w.fluid_type.value,
                w.batch_id,
                f"{w.temperature_at_spray}°C"
            ])
        
        writer.table(headers, rows)

    def _write_issues_by_severity(self, writer: MarkdownWriter, issues: List[Issue]):
        if not issues:
            writer.h2("问题清单")
            writer.p("无异常发现。")
            return
        
        severity_order = [IssueSeverity.CRITICAL, IssueSeverity.WARNING, IssueSeverity.INFO]
        severity_names = {
            IssueSeverity.CRITICAL: "严重问题",
            IssueSeverity.WARNING: "警告事项",
            IssueSeverity.INFO: "提示信息"
        }
        
        for sev in severity_order:
            sev_issues = [i for i in issues if i.severity == sev]
            if not sev_issues:
                continue
            
            writer.h2(f"{severity_names[sev]} ({len(sev_issues)})")
            
            for issue in sorted(sev_issues, key=lambda x: x.timestamp):
                writer.h3(f"问题 {issue.issue_id}: {issue.flight_number}")
                writer.p(f"**类型**: {issue.issue_type.value}")
                writer.p(f"**时间**: {issue.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                writer.p(f"**跑道**: {issue.runway}")
                writer.p(f"**描述**: {issue.description}")
                writer.p(f"**建议**: {issue.recommendation}")
                
                if issue.metadata:
                    writer.p("**元数据**:")
                    for key, value in issue.metadata.items():
                        writer.bullet(f"{key}: {value}", level=1)

    def _write_respray_recommendations(self, writer: MarkdownWriter, recommendations: List[Dict]):
        if not recommendations:
            return
        
        writer.h2("补喷建议")
        
        urgency_names = {
            "HIGH": "高优先级 ⚠️",
            "MEDIUM": "中优先级",
            "LOW": "低优先级"
        }
        
        headers = ["优先级", "航班号", "注册号", "跑道", "建议措施"]
        rows = []
        
        for rec in recommendations:
            rows.append([
                urgency_names.get(rec['urgency'], rec['urgency']),
                rec['flight_number'],
                rec['registration'],
                rec['runway'],
                rec['recommended_action']
            ])
        
        writer.table(headers, rows)
        
        for rec in recommendations:
            if rec['urgency'] in ['HIGH', 'MEDIUM']:
                writer.h3(f"航班 {rec['flight_number']} - 详细说明")
                writer.p(f"**原因**: {rec['reason']}")
                writer.p(f"**建议**: {rec['recommended_action']}")

    def _write_statistics(self, writer: MarkdownWriter, summary: Dict):
        writer.h2("统计信息")
        
        issues_by_type = summary.get('issues_by_type', {})
        if issues_by_type:
            writer.h3("问题类型分布")
            headers = ["问题类型", "数量"]
            rows = [[k, v] for k, v in sorted(issues_by_type.items(), key=lambda x: x[1], reverse=True)]
            writer.table(headers, rows)
        
        writer.h3("分析详情")
        writer.p(f"分析时间: {summary.get('analysis_time', 'N/A')}")
        writer.p(f"总航班数: {summary.get('total_flights', 0)}")
        writer.p(f"总喷洒记录: {summary.get('total_sprays', 0)}")
