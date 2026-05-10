from typing import List, Dict
from pathlib import Path
from .database import Database
from .subtitle_parser import SubtitleParser, SubtitleItem
from .timeline_checker import TimelineChecker
from .term_checker import TermChecker
from .typo_checker import TypoChecker
from .glossary_manager import GlossaryManager


class QualityChecker:
    def __init__(self, db: Database = None):
        self.db = db or Database()
        self.timeline_checker = TimelineChecker()
        self.typo_checker = TypoChecker()

    def scan_file(self, file_path: str, doc_path: str = None, glossary_path: str = None):
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        if not SubtitleParser.is_supported(file_path):
            raise ValueError(f"Unsupported subtitle format: {path.suffix}")

        file_hash = SubtitleParser.get_file_hash(file_path)
        subtitles = SubtitleParser.parse(file_path)
        subtitle_file_id = self.db.save_subtitle_file(str(path.absolute()), file_hash)

        issues = []

        timeline_issues = self.timeline_checker.check(subtitles)
        for issue in timeline_issues:
            issue_data = {
                'issue_type': issue['type'],
                'subtitle_index': issue['subtitle_index'],
                'start_time': issue['start_time'],
                'end_time': issue['end_time'],
                'original_text': issue['original_text'],
                'description': issue['description'],
                'suggestion': issue['suggestion']
            }
            issue_id = self.db.save_issue(subtitle_file_id, issue_data)
            if issue_id:
                issues.append({**issue_data, 'id': issue_id})

        glossary_manager = GlossaryManager(self.db)
        if glossary_path:
            glossary_manager.load_from_file(glossary_path)
        
        term_checker = TermChecker(glossary_manager)
        if doc_path:
            term_checker.load_document_terms(doc_path)
        
        term_issues = term_checker.check_terms(subtitles)
        for issue in term_issues:
            issue_data = {
                'issue_type': issue['type'],
                'subtitle_index': issue['subtitle_index'],
                'start_time': issue['start_time'],
                'end_time': issue['end_time'],
                'original_text': issue['original_text'],
                'expected_text': issue['expected_term'],
                'description': issue['description'],
                'suggestion': issue['suggestion']
            }
            issue_id = self.db.save_issue(subtitle_file_id, issue_data)
            if issue_id:
                issues.append({**issue_data, 'id': issue_id})

        typo_issues = self.typo_checker.check(subtitles)
        for issue in typo_issues:
            issue_data = {
                'issue_type': issue['type'],
                'subtitle_index': issue['subtitle_index'],
                'start_time': issue['start_time'],
                'end_time': issue['end_time'],
                'original_text': issue['original_text'],
                'expected_text': issue['expected'],
                'description': issue['description'],
                'suggestion': issue['suggestion']
            }
            issue_id = self.db.save_issue(subtitle_file_id, issue_data)
            if issue_id:
                issues.append({**issue_data, 'id': issue_id})

        return {
            'file_path': str(path.absolute()),
            'file_hash': file_hash,
            'subtitle_count': len(subtitles),
            'issues_found': len(issues),
            'issues': issues
        }

    def scan_directory(self, dir_path: str, doc_path: str = None, glossary_path: str = None):
        dir = Path(dir_path)
        if not dir.is_dir():
            raise NotADirectoryError(f"Not a directory: {dir_path}")

        results = []
        for file_path in dir.rglob('*'):
            if file_path.is_file() and SubtitleParser.is_supported(str(file_path)):
                try:
                    result = self.scan_file(str(file_path), doc_path, glossary_path)
                    results.append(result)
                except Exception as e:
                    results.append({
                        'file_path': str(file_path.absolute()),
                        'error': str(e)
                    })

        return results

    def list_issues(self, file_path: str = None, status: str = 'open'):
        issues = self.db.get_issues(file_path=file_path, status=status)
        return [dict(issue) for issue in issues]

    def resolve_issue(self, issue_id: int, resolved_by: str = 'user'):
        return self.db.mark_issue_resolved(issue_id, resolved_by)

    def reopen_issue(self, issue_id: int):
        return self.db.mark_issue_open(issue_id)

    def export_report(self, output_path: str, file_path: str = None, status: str = None):
        issues = self.list_issues(file_path=file_path, status=status)
        
        if not issues:
            return {'error': 'No issues found'}

        from pathlib import Path
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        report_lines = []
        report_lines.append("# 课程视频字幕质检报告")
        report_lines.append(f"生成时间: {self._get_current_time()}")
        report_lines.append("")

        grouped_issues = {}
        for issue in issues:
            fp = issue['file_path']
            if fp not in grouped_issues:
                grouped_issues[fp] = []
            grouped_issues[fp].append(issue)

        for file_path, file_issues in grouped_issues.items():
            report_lines.append(f"## 视频文件: {file_path}")
            report_lines.append(f"问题数量: {len(file_issues)}")
            report_lines.append("")
            
            for issue in file_issues:
                issue_type_display = self._get_issue_type_display(issue['issue_type'])
                report_lines.append(f"### 问题 {issue['id']}: {issue_type_display}")
                report_lines.append(f"- 状态: {issue['status']}")
                if issue['start_time'] and issue['end_time']:
                    report_lines.append(f"- 时间点: {issue['start_time']} - {issue['end_time']}")
                if issue['subtitle_index']:
                    report_lines.append(f"- 字幕索引: {issue['subtitle_index']}")
                if issue['original_text']:
                    report_lines.append(f"- 原文: {issue['original_text']}")
                if issue['expected_text']:
                    report_lines.append(f"- 期望: {issue['expected_text']}")
                report_lines.append(f"- 描述: {issue['description']}")
                report_lines.append(f"- 建议: {issue['suggestion']}")
                report_lines.append("")

        with open(output, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))

        return {
            'report_path': str(output.absolute()),
            'total_issues': len(issues),
            'files_scanned': len(grouped_issues)
        }

    def _get_issue_type_display(self, issue_type: str) -> str:
        type_map = {
            'timeline_overlap': '时间轴重叠',
            'timeline_backward': '时间轴倒退',
            'term_inconsistency': '术语不一致',
            'typo_suspicious': '疑似错字（需人工确认）'
        }
        return type_map.get(issue_type, issue_type)

    def _get_current_time(self) -> str:
        from datetime import datetime
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
