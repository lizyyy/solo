import json
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from .models import (
    CheckResult, SubtitleFile, Issue, IssueType, IssueSeverity
)


class BaseReporter(ABC):
    @abstractmethod
    def generate(self, check_result: CheckResult) -> str:
        pass
    
    @abstractmethod
    def format(self) -> str:
        pass


class JSONReporter(BaseReporter):
    def format(self) -> str:
        return 'json'
    
    def generate(self, check_result: CheckResult) -> str:
        data = check_result.to_dict()
        return json.dumps(data, ensure_ascii=False, indent=2)


class MarkdownReporter(BaseReporter):
    ISSUE_TYPE_DISPLAY = {
        IssueType.OVERLAPPING_TIMELINE: '时间轴重叠',
        IssueType.BROKEN_SEQUENCE: '序号断裂',
        IssueType.LINE_TOO_LONG: '单行过长',
        IssueType.READING_SPEED_TOO_FAST: '阅读速度过快',
        IssueType.SPEAKER_INCONSISTENT: '说话人不一致',
        IssueType.TERM_INCONSISTENT: '术语不一致',
        IssueType.FORBIDDEN_WORD: '禁用词命中',
        IssueType.TIMECODE_ERROR: '时间码错误',
        IssueType.EMPTY_SUBTITLE: '空字幕',
    }
    
    SEVERITY_DISPLAY = {
        IssueSeverity.CRITICAL: '严重',
        IssueSeverity.ERROR: '错误',
        IssueSeverity.WARNING: '警告',
        IssueSeverity.INFO: '提示',
    }
    
    SEVERITY_EMOJI = {
        IssueSeverity.CRITICAL: '🚨',
        IssueSeverity.ERROR: '❌',
        IssueSeverity.WARNING: '⚠️',
        IssueSeverity.INFO: 'ℹ️',
    }
    
    def format(self) -> str:
        return 'md'
    
    def generate(self, check_result: CheckResult) -> str:
        lines = []
        
        lines.append('# 字幕质检报告')
        lines.append('')
        lines.append(f'**检查时间**: {check_result.checked_at}')
        lines.append('')
        
        lines.append('## 检查摘要')
        lines.append('')
        
        lines.append('### 总体统计')
        lines.append('')
        lines.append(f'- **检查文件数**: {check_result.total_files}')
        lines.append(f'- **发现问题数**: {check_result.total_issues}')
        lines.append('')
        
        lines.append('### 按严重程度统计')
        lines.append('')
        lines.append('| 严重程度 | 数量 |')
        lines.append('|----------|------|')
        
        for severity in [IssueSeverity.CRITICAL, IssueSeverity.ERROR, IssueSeverity.WARNING, IssueSeverity.INFO]:
            count = check_result.issues_by_severity.get(severity, 0)
            lines.append(f"| {self.SEVERITY_EMOJI.get(severity, '')} {self.SEVERITY_DISPLAY.get(severity, severity.name)} | {count} |")
        
        lines.append('')
        
        lines.append('### 按问题类型统计')
        lines.append('')
        lines.append('| 问题类型 | 数量 |')
        lines.append('|----------|------|')
        
        for issue_type, count in sorted(check_result.issues_by_type.items(), key=lambda x: -x[1]):
            display_name = self.ISSUE_TYPE_DISPLAY.get(issue_type, issue_type.name)
            lines.append(f"| {display_name} | {count} |")
        
        lines.append('')
        
        lines.append('## 详细问题')
        lines.append('')
        
        for subtitle_file in check_result.files:
            if not subtitle_file.issues:
                continue
            
            lines.append(f"### 文件: `{subtitle_file.path.name}`")
            lines.append('')
            lines.append(f"- **路径**: `{subtitle_file.path}`")
            lines.append(f"- **字幕条目数**: {subtitle_file.item_count}")
            lines.append(f"- **问题数**: {subtitle_file.issue_count}")
            lines.append('')
            
            issues_by_severity: Dict[IssueSeverity, List[Issue]] = {}
            for issue in subtitle_file.issues:
                if issue.severity not in issues_by_severity:
                    issues_by_severity[issue.severity] = []
                issues_by_severity[issue.severity].append(issue)
            
            for severity in [IssueSeverity.CRITICAL, IssueSeverity.ERROR, IssueSeverity.WARNING, IssueSeverity.INFO]:
                if severity not in issues_by_severity:
                    continue
                
                severity_name = self.SEVERITY_DISPLAY.get(severity, severity.name)
                severity_emoji = self.SEVERITY_EMOJI.get(severity, '')
                lines.append(f"#### {severity_emoji} {severity_name}")
                lines.append('')
                
                for issue in issues_by_severity[severity]:
                    issue_type_name = self.ISSUE_TYPE_DISPLAY.get(issue.type, issue.type.name)
                    
                    lines.append(f"**{issue_type_name}**")
                    lines.append('')
                    
                    if issue.subtitle_index is not None:
                        lines.append(f"- **字幕序号**: {issue.subtitle_index}")
                    
                    lines.append(f"- **描述**: {issue.message}")
                    
                    if issue.original_text:
                        lines.append(f"- **原文**: `{issue.original_text}`")
                    
                    if issue.suggestion:
                        lines.append(f"- **建议**: {issue.suggestion}")
                    
                    lines.append('')
            
            lines.append('---')
            lines.append('')
        
        if check_result.total_issues == 0:
            lines.append('🎉 **所有文件检查通过，未发现问题！**')
            lines.append('')
        
        return '\n'.join(lines)


class Reporter:
    def __init__(self):
        self.reporters: Dict[str, BaseReporter] = {
            'json': JSONReporter(),
            'md': MarkdownReporter(),
            'markdown': MarkdownReporter(),
        }
    
    def generate_report(self, check_result: CheckResult, format_type: str) -> str:
        reporter = self.reporters.get(format_type.lower())
        if reporter is None:
            raise ValueError(f"Unsupported report format: {format_type}")
        
        return reporter.generate(check_result)
    
    def save_report(self, check_result: CheckResult, output_path: Path, format_type: Optional[str] = None) -> None:
        if format_type is None:
            suffix = output_path.suffix.lower().lstrip('.')
            format_type = suffix if suffix in self.reporters else 'json'
        
        content = self.generate_report(check_result, format_type)
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def list_formats(self) -> List[str]:
        return list(self.reporters.keys())


def create_check_result(files: List[SubtitleFile], config_hash: str = '') -> CheckResult:
    result = CheckResult(
        files=files,
        config_hash=config_hash,
        checked_at=datetime.now().isoformat()
    )
    return result
