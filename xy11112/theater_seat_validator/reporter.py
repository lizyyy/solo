from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .validator import ValidationIssue, ValidationLevel


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

    def generate(self, parsed_data: Dict[str, Any], 
                 issues: List[ValidationIssue], 
                 run_id: Optional[str] = None) -> Dict[str, Any]:
        if run_id is None:
            run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        report = {
            'run_id': run_id,
            'timestamp': datetime.now().isoformat(),
            'source_file': parsed_data.get('source_file'),
            'summary': self._generate_summary(issues),
            'issues': self._format_issues(issues),
            'statistics': self._generate_statistics(parsed_data, issues)
        }

        return report

    def save_text_report(self, report: Dict[str, Any]) -> str:
        filename = f"validation_report_{report['run_id']}.txt"
        filepath = self.output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self._format_text_report(report))

        return str(filepath)

    def save_json_report(self, report: Dict[str, Any]) -> str:
        import json
        filename = f"validation_report_{report['run_id']}.json"
        filepath = self.output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return str(filepath)

    def _generate_summary(self, issues: List[ValidationIssue]) -> Dict[str, int]:
        summary = {
            'total': len(issues),
            'errors': 0,
            'warnings': 0,
            'infos': 0
        }

        for issue in issues:
            if issue.level == ValidationLevel.ERROR:
                summary['errors'] += 1
            elif issue.level == ValidationLevel.WARNING:
                summary['warnings'] += 1
            elif issue.level == ValidationLevel.INFO:
                summary['infos'] += 1

        return summary

    def _format_issues(self, issues: List[ValidationIssue]) -> List[Dict[str, Any]]:
        formatted = []
        for issue in issues:
            formatted.append({
                'level': issue.level.value,
                'code': issue.code.value,
                'message': issue.message,
                'seat_id': issue.seat_id,
                'row': issue.row,
                'details': issue.details
            })
        return formatted

    def _generate_statistics(self, parsed_data: Dict[str, Any], 
                             issues: List[ValidationIssue]) -> Dict[str, Any]:
        seats = parsed_data.get('seats', [])
        
        stats = {
            'total_seats': len(seats),
            'by_type': {},
            'by_row': {}
        }

        for seat in seats:
            seat_type = seat.get('type') or seat.get('类型', 'normal')
            row = seat.get('row') or seat.get('排号', '未知')
            
            stats['by_type'][seat_type] = stats['by_type'].get(seat_type, 0) + 1
            stats['by_row'][row] = stats['by_row'].get(row, 0) + 1

        return stats

    def _format_text_report(self, report: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("小剧场票务 - 剧场座位校验报告")
        lines.append("=" * 60)
        lines.append(f"运行编号: {report['run_id']}")
        lines.append(f"校验时间: {report['timestamp']}")
        lines.append(f"源文件: {report['source_file']}")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("校验摘要")
        lines.append("-" * 60)
        summary = report['summary']
        lines.append(f"总计问题数: {summary['total']}")
        lines.append(f"  错误 (必须修复): {summary['errors']}")
        lines.append(f"  警告 (建议修复): {summary['warnings']}")
        lines.append(f"  提示: {summary['infos']}")
        lines.append("")

        lines.append("-" * 60)
        lines.append("问题详情")
        lines.append("-" * 60)
        
        for issue in report['issues']:
            marker = "✗" if issue['level'] == "错误" else "⚠" if issue['level'] == "警告" else "ℹ"
            lines.append(f"[{marker}] [{issue['code']}] {issue['level']}")
            lines.append(f"    描述: {issue['message']}")
            if issue['seat_id']:
                lines.append(f"    座位: {issue['seat_id']}")
            if issue['row']:
                lines.append(f"    排号: {issue['row']}")
            if issue['details']:
                lines.append(f"    详情: {issue['details']}")
            lines.append("")

        lines.append("-" * 60)
        lines.append("统计信息")
        lines.append("-" * 60)
        stats = report['statistics']
        lines.append(f"总座位数: {stats['total_seats']}")
        lines.append("按类型分布:")
        for seat_type, count in stats['by_type'].items():
            lines.append(f"  {seat_type}: {count} 个")
        lines.append("按排分布:")
        for row, count in stats['by_row'].items():
            lines.append(f"  第 {row} 排: {count} 个")
        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
