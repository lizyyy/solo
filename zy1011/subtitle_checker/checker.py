from typing import List, Dict, Any
from datetime import timedelta

from subtitle_checker.models import (
    SubtitleEntry, SubtitleFile, Chapter, Issue, 
    IssueType, Severity, ScanResult
)


class CheckerConfig:
    """检查规则配置"""
    
    def __init__(self):
        self.long_gap_threshold_ms = 5000
        self.duplicate_time_window_ms = 1000
        self.min_gap_between_subtitles_ms = 50
        self.chapter_boundary_margin_ms = 1000


class RuleChecker:
    """字幕规则检查器"""
    
    def __init__(self, config: CheckerConfig = None):
        self.config = config or CheckerConfig()
    
    def check_all(self, files: List[SubtitleFile], chapters: List[Chapter] = None) -> List[Issue]:
        issues: List[Issue] = []
        
        for subtitle_file in files:
            issues.extend(self.check_file(subtitle_file, chapters or []))
        
        return issues
    
    def check_file(self, subtitle_file: SubtitleFile, chapters: List[Chapter]) -> List[Issue]:
        issues: List[Issue] = []
        
        issues.extend(subtitle_file.parse_errors)
        
        entries = subtitle_file.entries
        if not entries:
            return issues
        
        for i, entry in enumerate(entries):
            issues.extend(self.check_single_entry(entry, i, chapters))
        
        issues.extend(self.check_adjacent_entries(entries, subtitle_file.file_path))
        
        issues.extend(self.check_duplicate_entries(entries, subtitle_file.file_path))
        
        issues.extend(self.check_chapter_crossing(entries, chapters, subtitle_file.file_path))
        
        return issues
    
    def check_single_entry(self, entry: SubtitleEntry, index: int, chapters: List[Chapter]) -> List[Issue]:
        issues: List[Issue] = []
        
        if entry.end_time < entry.start_time:
            issues.append(Issue(
                issue_type=IssueType.INVALID_TIME,
                severity=Severity.ERROR,
                message=f"结束时间早于开始时间",
                file_path=entry.file_path,
                subtitle_index=entry.index,
                line_number=entry.line_number,
                suggestion="将结束时间调整为开始时间之后",
                original={
                    "start": self._format_time(entry.start_time),
                    "end": self._format_time(entry.end_time)
                },
                fixed={
                    "start": self._format_time(entry.start_time),
                    "end": self._format_time(entry.start_time + timedelta(milliseconds=500))
                },
                details={
                    "start_ms": entry.start_ms,
                    "end_ms": entry.end_ms,
                    "duration_ms": entry.end_ms - entry.start_ms
                }
            ))
        
        if not entry.text.strip():
            issues.append(Issue(
                issue_type=IssueType.EMPTY_TEXT,
                severity=Severity.WARNING,
                message=f"字幕文本为空",
                file_path=entry.file_path,
                subtitle_index=entry.index,
                line_number=entry.line_number,
                suggestion="删除空字幕或补充文本",
                original={"text": entry.text},
                fixed={"text": "[删除此字幕]"},
                details={}
            ))
        
        if entry.duration().total_seconds() == 0:
            issues.append(Issue(
                issue_type=IssueType.INVALID_TIME,
                severity=Severity.ERROR,
                message=f"字幕时长为0",
                file_path=entry.file_path,
                subtitle_index=entry.index,
                line_number=entry.line_number,
                suggestion="增加字幕时长或删除",
                original={
                    "start": self._format_time(entry.start_time),
                    "end": self._format_time(entry.end_time),
                    "duration": "0ms"
                },
                fixed={
                    "start": self._format_time(entry.start_time),
                    "end": self._format_time(entry.start_time + timedelta(milliseconds=500)),
                    "duration": "500ms"
                },
                details={}
            ))
        
        return issues
    
    def check_adjacent_entries(self, entries: List[SubtitleEntry], file_path: str) -> List[Issue]:
        issues: List[Issue] = []
        
        for i in range(len(entries) - 1):
            current = entries[i]
            next_entry = entries[i + 1]
            
            if next_entry.start_ms < current.end_ms:
                overlap_ms = current.end_ms - next_entry.start_ms
                issues.append(Issue(
                    issue_type=IssueType.OVERLAP,
                    severity=Severity.ERROR,
                    message=f"字幕 {current.index} 与 {next_entry.index} 时间重叠",
                    file_path=file_path,
                    subtitle_index=current.index,
                    subtitle_indices=[current.index, next_entry.index],
                    line_number=current.line_number,
                    suggestion=f"调整时间消除 {overlap_ms}ms 的重叠",
                    original={
                        "current_start": self._format_time(current.start_time),
                        "current_end": self._format_time(current.end_time),
                        "next_start": self._format_time(next_entry.start_time),
                        "next_end": self._format_time(next_entry.end_time),
                        "overlap_ms": overlap_ms
                    },
                    fixed={
                        "current_end": self._format_time(next_entry.start_time),
                        "next_start": self._format_time(next_entry.start_time)
                    },
                    details={
                        "current_index": current.index,
                        "next_index": next_entry.index,
                        "overlap_ms": overlap_ms
                    }
                ))
            
            gap_ms = next_entry.start_ms - current.end_ms
            if gap_ms > self.config.long_gap_threshold_ms:
                issues.append(Issue(
                    issue_type=IssueType.LONG_GAP,
                    severity=Severity.WARNING,
                    message=f"字幕 {current.index} 与 {next_entry.index} 间隔过长",
                    file_path=file_path,
                    subtitle_index=current.index,
                    subtitle_indices=[current.index, next_entry.index],
                    line_number=current.line_number,
                    suggestion=f"检查是否有遗漏字幕，当前间隔 {gap_ms}ms",
                    original={
                        "current_end": self._format_time(current.end_time),
                        "next_start": self._format_time(next_entry.start_time),
                        "gap_ms": gap_ms
                    },
                    fixed=None,
                    details={
                        "current_index": current.index,
                        "next_index": next_entry.index,
                        "gap_ms": gap_ms,
                        "threshold_ms": self.config.long_gap_threshold_ms
                    }
                ))
        
        return issues
    
    def check_duplicate_entries(self, entries: List[SubtitleEntry], file_path: str) -> List[Issue]:
        issues: List[Issue] = []
        
        if len(entries) < 2:
            return issues
        
        sorted_entries = sorted(entries, key=lambda e: e.start_ms)
        
        for i in range(len(sorted_entries)):
            for j in range(i + 1, len(sorted_entries)):
                entry1 = sorted_entries[i]
                entry2 = sorted_entries[j]
                
                time_diff = entry2.start_ms - entry1.start_ms
                if time_diff > self.config.duplicate_time_window_ms:
                    break
                
                if entry1.text.strip() == entry2.text.strip() and entry1.index != entry2.index:
                    issues.append(Issue(
                        issue_type=IssueType.DUPLICATE,
                        severity=Severity.WARNING,
                        message=f"字幕 {entry1.index} 与 {entry2.index} 内容重复",
                        file_path=file_path,
                        subtitle_index=entry1.index,
                        subtitle_indices=[entry1.index, entry2.index],
                        line_number=entry1.line_number,
                        suggestion="删除重复的字幕",
                        original={
                            "index1": entry1.index,
                            "index2": entry2.index,
                            "text": entry1.text,
                            "time_diff_ms": time_diff
                        },
                        fixed={
                            "action": f"删除字幕 {entry2.index}"
                        },
                        details={
                            "indices": [entry1.index, entry2.index],
                            "time_diff_ms": time_diff
                        }
                    ))
        
        return issues
    
    def check_chapter_crossing(self, entries: List[SubtitleEntry], chapters: List[Chapter], file_path: str) -> List[Issue]:
        issues: List[Issue] = []
        
        if not chapters:
            return issues
        
        for entry in entries:
            for chapter in chapters:
                if entry.start_ms < chapter.end_ms and entry.end_ms > chapter.end_ms:
                    issues.append(Issue(
                        issue_type=IssueType.CROSS_CHAPTER,
                        severity=Severity.WARNING,
                        message=f"字幕 {entry.index} 跨越章节边界: {chapter.title}",
                        file_path=file_path,
                        subtitle_index=entry.index,
                        line_number=entry.line_number,
                        suggestion="将字幕拆分或调整到边界前",
                        original={
                            "start": self._format_time(entry.start_time),
                            "end": self._format_time(entry.end_time),
                            "chapter": chapter.title,
                            "chapter_end": self._format_time(chapter.end_time)
                        },
                        fixed={
                            "suggestion": "将字幕拆分或结束时间调整为章节边界前"
                        },
                        details={
                            "chapter_title": chapter.title,
                            "chapter_start_ms": chapter.start_ms,
                            "chapter_end_ms": chapter.end_ms,
                            "entry_start_ms": entry.start_ms,
                            "entry_end_ms": entry.end_ms
                        }
                    ))
        
        return issues
    
    def _format_time(self, td: timedelta) -> str:
        total_seconds = td.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = int(total_seconds % 60)
        milliseconds = int((total_seconds * 1000) % 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def load_chapters(chapters_file: str) -> List[Chapter]:
    import json
    from pathlib import Path
    
    path = Path(chapters_file)
    if not path.exists():
        return []
    
    data = json.loads(path.read_text(encoding='utf-8'))
    
    chapters = []
    for item in data.get('chapters', []):
        start_time = _parse_chapter_time(item.get('start', '00:00:00'))
        end_time = _parse_chapter_time(item.get('end', '00:00:00'))
        
        chapters.append(Chapter(
            title=item.get('title', ''),
            start_time=start_time,
            end_time=end_time
        ))
    
    return chapters


def _parse_chapter_time(time_str: str) -> timedelta:
    from subtitle_checker.parser import parse_srt_time
    
    time_str = time_str.strip()
    try:
        return parse_srt_time(time_str)
    except ValueError:
        pass
    
    if '.' not in time_str:
        time_str = time_str + '.000'
    if ',' in time_str:
        time_str = time_str.replace(',', '.')
    
    return parse_srt_time(time_str)
