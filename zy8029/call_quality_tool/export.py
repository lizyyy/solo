import csv
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from rule_engine import Issue


class MarkdownExporter:
    def __init__(self, issues: List[Issue], summary: Dict[str, Any],
                 agent_metrics: Dict[str, Any], call_metrics: Dict[str, Any]):
        self.issues = issues
        self.summary = summary
        self.agent_metrics = agent_metrics
        self.call_metrics = call_metrics

    def generate_report(self) -> str:
        lines = []
        lines.append(f"# 客服录音质检复盘报告\n")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        lines.append("## 概览\n")
        lines.append(f"- 总通话数: {self.summary.get('total_calls', 0)}")
        lines.append(f"- 总问题数: {self.summary.get('total_issues', 0)}")
        lines.append(f"- 涉及问题的通话: {self.summary.get('calls_with_issues', 0)}")
        lines.append(f"- 平均每通话问题数: {self.summary.get('average_issues_per_call', 0):.2f}")
        lines.append(f"- 问题率: {self.summary.get('issue_rate', 0)*100:.1f}%\n")

        lines.append("### 问题类型分布\n")
        type_dist = self.summary.get('issue_type_distribution', {})
        for issue_type, count in type_dist.items():
            lines.append(f"- {issue_type}: {count}")

        lines.append("\n### 严重程度分布\n")
        severity_dist = self.summary.get('severity_distribution', {})
        for severity, count in severity_dist.items():
            lines.append(f"- {severity}: {count}")

        lines.append("\n## 按坐席统计\n")
        for agent_id, metrics in self.agent_metrics.items():
            lines.append(f"\n### 坐席 {agent_id}\n")
            lines.append(f"- 问题总数: {metrics['total_issues']}")
            lines.append(f"- 通话数: {metrics['call_count']}")
            lines.append(f"- 问题类型:")
            for itype, count in metrics['issue_types'].items():
                lines.append(f"  - {itype}: {count}")

        lines.append("\n## 按通话详情\n")
        for call_id, metrics in self.call_metrics.items():
            lines.append(f"\n### 通话 {call_id}\n")
            lines.append(f"- 问题数: {metrics['total_issues']}")
            for issue in metrics['issues']:
                lines.append(f"  - [{issue['severity']}] {issue['rule_name']}: {issue['description']}")

        if self.issues:
            lines.append("\n## 问题明细\n")
            lines.append("| 通话ID | 坐席 | 类型 | 严重程度 | 描述 |")
            lines.append("|--------|------|------|----------|------|")
            for issue in self.issues:
                lines.append(f"| {issue.call_id} | {issue.agent_id} | {issue.issue_type} | {issue.severity} | {issue.description} |")

        return "\n".join(lines)

    def export(self, file_path: str):
        report = self.generate_report()
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(report)


class CSVExporter:
    def __init__(self, issues: List[Issue]):
        self.issues = issues

    def export(self, file_path: str):
        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'call_id', 'agent_id', 'issue_type', 'rule_name',
                'severity', 'description', 'utterance_index', 'timestamp'
            ])
            for issue in self.issues:
                writer.writerow([
                    issue.call_id,
                    issue.agent_id,
                    issue.issue_type,
                    issue.rule_name,
                    issue.severity,
                    issue.description,
                    issue.utterance_index,
                    issue.timestamp
                ])


class ReportExporter:
    def __init__(self, issues: List[Issue], summary: Dict[str, Any],
                 agent_metrics: Dict[str, Any], call_metrics: Dict[str, Any],
                 type_metrics: Dict[str, Any], stage_analysis: Dict[str, Any]):
        self.issues = issues
        self.summary = summary
        self.agent_metrics = agent_metrics
        self.call_metrics = call_metrics
        self.type_metrics = type_metrics
        self.stage_analysis = stage_analysis

    def export_markdown(self, file_path: str):
        exporter = MarkdownExporter(
            self.issues, self.summary,
            self.agent_metrics, self.call_metrics
        )
        exporter.export(file_path)

    def export_csv(self, file_path: str):
        exporter = CSVExporter(self.issues)
        exporter.export(file_path)

    def export_both(self, base_path: str):
        md_path = base_path if base_path.endswith('.md') else f"{base_path}.md"
        csv_path = base_path if base_path.endswith('.csv') else f"{base_path}.csv"

        self.export_markdown(md_path)
        self.export_csv(csv_path)

        return {'markdown': md_path, 'csv': csv_path}
