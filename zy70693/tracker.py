from dataclasses import dataclass, field
from typing import List, Dict, Any
from parser import DataRow
from validator import ValidationIssue


@dataclass
class SourceReference:
    file_path: str
    line_number: int
    context: str = ''


class SourceTracker:
    def __init__(self):
        self.issue_sources: Dict[str, List[SourceReference]] = {}
        self.invalid_rows: List[DataRow] = []

    def track_issue_sources(self, issues: List[ValidationIssue]) -> None:
        for issue in issues:
            key = f"{issue.rule.value}_{issue.message[:50]}"
            self.issue_sources[key] = []
            for source_row in issue.source_rows:
                ref = SourceReference(
                    file_path=source_row.file_path,
                    line_number=source_row.line_number,
                    context=f"{source_row.source_type.value}: {str(source_row.raw_data)[:100]}"
                )
                self.issue_sources[key].append(ref)

    def track_invalid_rows(self, invalid_rows: List[DataRow]) -> None:
        self.invalid_rows = sorted(invalid_rows, key=lambda r: (r.file_path, r.line_number))

    def get_source_summary(self) -> Dict[str, Any]:
        files_with_invalid = set()
        for row in self.invalid_rows:
            files_with_invalid.add(row.file_path)

        return {
            'total_invalid_rows': len(self.invalid_rows),
            'files_with_invalid': sorted(files_with_invalid),
            'invalid_rows_by_file': self._group_invalid_by_file()
        }

    def _group_invalid_by_file(self) -> Dict[str, List[Dict[str, Any]]]:
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for row in self.invalid_rows:
            if row.file_path not in grouped:
                grouped[row.file_path] = []
            grouped[row.file_path].append({
                'line_number': row.line_number,
                'error_message': row.error_message,
                'raw_data': row.raw_data
            })
        return grouped

    def get_issue_sources(self, issue_key: str) -> List[SourceReference]:
        return self.issue_sources.get(issue_key, [])

    def format_invalid_rows_report(self) -> str:
        if not self.invalid_rows:
            return "没有发现坏行记录。\n"

        lines = ["=" * 80]
        lines.append("坏行来源追踪报告")
        lines.append("=" * 80)
        lines.append("")

        grouped = self._group_invalid_by_file()
        for file_path in sorted(grouped.keys()):
            lines.append(f"文件: {file_path}")
            lines.append("-" * 80)
            for row_info in grouped[file_path]:
                lines.append(f"  行号: {row_info['line_number']}")
                lines.append(f"  错误: {row_info['error_message']}")
                lines.append(f"  原始数据: {row_info['raw_data']}")
                lines.append("")
            lines.append("")

        return "\n".join(lines)
