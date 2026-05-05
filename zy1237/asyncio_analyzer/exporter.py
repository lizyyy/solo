import json
from typing import Dict, List, Any
from datetime import datetime


class BaseExporter:
    def export(self, data: Dict[str, Any]) -> str:
        raise NotImplementedError


class JSONExporter(BaseExporter):
    def export(self, data: Dict[str, Any]) -> str:
        def convert_row(row: Any) -> Dict:
            if isinstance(row, dict):
                return {k: v for k, v in row.items()}
            return dict(row)

        export_data = {
            'run_id': data.get('run_id'),
            'exported_at': datetime.now().isoformat(),
            'summary': {
                'issues_count': len(data.get('issues', [])),
                'blocking_points_count': len(data.get('blocking_points', [])),
                'leak_risks_count': len(data.get('leak_risks', [])),
            },
            'issues': [convert_row(i) for i in data.get('issues', [])],
            'timeline': [convert_row(t) for t in data.get('timeline', [])],
            'blocking_points': [convert_row(b) for b in data.get('blocking_points', [])],
            'leak_risks': [convert_row(l) for l in data.get('leak_risks', [])],
        }

        return json.dumps(export_data, indent=2, ensure_ascii=False)


class MarkdownExporter(BaseExporter):
    SEVERITY_EMOJI = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🟢',
    }

    def export(self, data: Dict[str, Any]) -> str:
        lines = []

        lines.append(f"# Asyncio 分析报告")
        lines.append("")
        lines.append(f"- **Run ID**: `{data.get('run_id')}`")
        lines.append(f"- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        issues = data.get('issues', [])
        blocking_points = data.get('blocking_points', [])
        leak_risks = data.get('leak_risks', [])

        lines.append("## 摘要")
        lines.append("")
        lines.append("| 类型 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 问题 | {len(issues)} |")
        lines.append(f"| 阻塞点 | {len(blocking_points)} |")
        lines.append(f"| 泄漏风险 | {len(leak_risks)} |")
        lines.append("")

        if issues:
            lines.append("## 问题详情")
            lines.append("")

            issues_by_severity = self._group_by_severity(issues)

            for severity in ['critical', 'high', 'medium', 'low']:
                sev_issues = issues_by_severity.get(severity, [])
                if sev_issues:
                    emoji = self.SEVERITY_EMOJI.get(severity, '')
                    lines.append(f"### {emoji} {severity.upper()} ({len(sev_issues)})")
                    lines.append("")

                    for i, issue in enumerate(sev_issues, 1):
                        lines.append(f"#### {i}. {issue.get('title', 'Unknown')}")
                        lines.append("")

                        if issue.get('description'):
                            lines.append(f"**描述**: {issue['description']}")
                            lines.append("")

                        if issue.get('snippet_file'):
                            loc = f"{issue['snippet_file']}"
                            if issue.get('snippet_line'):
                                loc += f":{issue['snippet_line']}"
                            lines.append(f"**位置**: `{loc}`")
                            lines.append("")

                        if issue.get('suggestion'):
                            lines.append(f"**建议**: {issue['suggestion']}")
                            lines.append("")

                    lines.append("---")
                    lines.append("")

        if blocking_points:
            lines.append("## 阻塞点")
            lines.append("")
            lines.append("| 文件 | 行号 | 操作 | 持续时间 |")
            lines.append("|------|------|------|----------|")

            for bp in blocking_points:
                file_name = bp.get('snippet_file', 'Unknown')
                line = bp.get('snippet_line', '-')
                operation = bp.get('operation', 'Unknown')
                duration = f"{bp.get('duration', '-')}ms" if bp.get('duration') else '-'
                lines.append(f"| `{file_name}` | {line} | {operation} | {duration} |")

            lines.append("")

        if leak_risks:
            lines.append("## 泄漏风险")
            lines.append("")
            lines.append("| 风险类型 | 文件 | 行号 | 风险分数 | 描述 |")
            lines.append("|----------|------|------|----------|------|")

            for risk in sorted(leak_risks, key=lambda x: x.get('risk_score', 0), reverse=True):
                risk_type = risk.get('risk_type', 'Unknown')
                file_name = risk.get('snippet_file', 'Unknown')
                line = risk.get('snippet_line', '-')
                score = risk.get('risk_score', 0)
                description = risk.get('description', '') or '-'

                score_display = f"{score:.1f}"
                if score >= 0.8:
                    score_display = f"**{score_display}** 🔴"
                elif score >= 0.5:
                    score_display = f"{score_display} 🟡"
                else:
                    score_display = f"{score_display} 🟢"

                lines.append(f"| `{risk_type}` | `{file_name}` | {line} | {score_display} | {description} |")

            lines.append("")

        timeline = data.get('timeline', [])
        if timeline:
            lines.append("## 时间线")
            lines.append("")
            lines.append("| 时间 | 事件类型 | 任务ID | 详情 |")
            lines.append("|------|----------|--------|------|")

            for event in timeline:
                timestamp = event.get('timestamp', '-')
                event_type = event.get('event_type', 'Unknown')
                task_id = event.get('task_id') or '-'
                details = event.get('details', '{}')
                if isinstance(details, str):
                    try:
                        details = json.loads(details)
                    except:
                        pass
                details_str = str(details) if details else '-'

                lines.append(f"| {timestamp} | `{event_type}` | `{task_id}` | {details_str} |")

            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*此报告由 asyncio-analyzer 生成*")

        return "\n".join(lines)

    def _group_by_severity(self, issues: List[Dict]) -> Dict[str, List[Dict]]:
        result = {}
        for issue in issues:
            severity = issue.get('severity', 'low')
            if severity not in result:
                result[severity] = []
            result[severity].append(issue)
        return result
