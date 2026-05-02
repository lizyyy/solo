from typing import List, Dict, Optional, Tuple
from datetime import timedelta
from pathlib import Path
import shutil

from subtitle_checker.models import (
    SubtitleEntry, SubtitleFile, Issue, IssueType, Severity, ScanResult
)
from subtitle_checker.parser import format_srt_time, format_vtt_time


class FixerConfig:
    """修复规则配置"""
    
    def __init__(self):
        self.min_subtitle_duration_ms = 500
        self.gap_between_subtitles_ms = 50
        self.auto_fix_invalid_time = True
        self.auto_fix_overlap = True
        self.auto_fix_empty = False
        self.auto_fix_duplicate = False


class SubtitleFixer:
    """字幕修复器"""
    
    def __init__(self, config: FixerConfig = None):
        self.config = config or FixerConfig()
    
    def fix_all(self, scan_result: ScanResult, output_dir: str) -> Dict[str, str]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        results: Dict[str, str] = {}
        
        for subtitle_file in scan_result.files:
            fixed_entries = self._fix_file_entries(subtitle_file)
            fixed_file_path = self._write_fixed_file(subtitle_file, fixed_entries, output_path)
            results[subtitle_file.file_path] = fixed_file_path
        
        return results
    
    def _fix_file_entries(self, subtitle_file: SubtitleFile) -> List[SubtitleEntry]:
        entries = subtitle_file.entries.copy()
        
        if not entries:
            return []
        
        entries = self._fix_invalid_times(entries)
        
        entries = self._fix_overlaps(entries)
        
        entries = self._remove_empty_entries(entries)
        
        entries = self._remove_duplicates(entries)
        
        for i, entry in enumerate(entries):
            entry.index = i + 1
        
        return entries
    
    def _fix_invalid_times(self, entries: List[SubtitleEntry]) -> List[SubtitleEntry]:
        fixed_entries = []
        
        for entry in entries:
            new_entry = SubtitleEntry(
                index=entry.index,
                start_time=entry.start_time,
                end_time=entry.end_time,
                text=entry.text,
                file_path=entry.file_path,
                line_number=entry.line_number,
                original_index=entry.original_index
            )
            
            if entry.end_time < entry.start_time:
                new_entry.end_time = new_entry.start_time + timedelta(
                    milliseconds=self.config.min_subtitle_duration_ms
                )
            
            if new_entry.duration().total_seconds() * 1000 < self.config.min_subtitle_duration_ms:
                new_entry.end_time = new_entry.start_time + timedelta(
                    milliseconds=self.config.min_subtitle_duration_ms
                )
            
            fixed_entries.append(new_entry)
        
        return fixed_entries
    
    def _fix_overlaps(self, entries: List[SubtitleEntry]) -> List[SubtitleEntry]:
        if len(entries) < 2:
            return entries
        
        sorted_entries = sorted(entries, key=lambda e: e.start_ms)
        
        fixed_entries = [sorted_entries[0]]
        
        for i in range(1, len(sorted_entries)):
            prev = fixed_entries[-1]
            current = sorted_entries[i]
            
            current_start = current.start_ms
            prev_end = prev.end_ms
            
            if current_start < prev_end:
                gap = self.config.gap_between_subtitles_ms
                new_start = prev_end + gap
                
                current.start_time = timedelta(milliseconds=new_start)
                
                duration = current.end_ms - current.start_ms
                if duration < self.config.min_subtitle_duration_ms:
                    current.end_time = current.start_time + timedelta(
                        milliseconds=self.config.min_subtitle_duration_ms
                    )
            
            fixed_entries.append(current)
        
        return fixed_entries
    
    def _remove_empty_entries(self, entries: List[SubtitleEntry]) -> List[SubtitleEntry]:
        if not self.config.auto_fix_empty:
            return entries
        
        return [e for e in entries if e.text.strip()]
    
    def _remove_duplicates(self, entries: List[SubtitleEntry]) -> List[SubtitleEntry]:
        if not self.config.auto_fix_duplicate:
            return entries
        
        if len(entries) < 2:
            return entries
        
        sorted_entries = sorted(entries, key=lambda e: e.start_ms)
        seen = set()
        result = []
        
        for entry in sorted_entries:
            key = (entry.start_ms, entry.text.strip())
            if key not in seen:
                seen.add(key)
                result.append(entry)
        
        return result
    
    def _write_fixed_file(self, subtitle_file: SubtitleFile, entries: List[SubtitleEntry], output_dir: Path) -> str:
        source_path = Path(subtitle_file.file_path)
        output_file = output_dir / source_path.name
        
        if subtitle_file.format == 'srt':
            self._write_srt(output_file, entries)
        elif subtitle_file.format == 'vtt':
            self._write_vtt(output_file, entries)
        
        return str(output_file)
    
    def _write_srt(self, file_path: Path, entries: List[SubtitleEntry]):
        lines = []
        for i, entry in enumerate(entries, 1):
            lines.append(str(i))
            lines.append(
                f"{format_srt_time(entry.start_time)} --> {format_srt_time(entry.end_time)}"
            )
            lines.append(entry.text)
            lines.append('')
        
        file_path.write_text('\n'.join(lines), encoding='utf-8')
    
    def _write_vtt(self, file_path: Path, entries: List[SubtitleEntry]):
        lines = ['WEBVTT', '']
        for i, entry in enumerate(entries, 1):
            lines.append(
                f"{format_vtt_time(entry.start_time)} --> {format_vtt_time(entry.end_time)}"
            )
            lines.append(entry.text)
            lines.append('')
        
        file_path.write_text('\n'.join(lines), encoding='utf-8')


def apply_fix_for_issue(issue: Issue, entries: List[SubtitleEntry]) -> Tuple[List[SubtitleEntry], Dict]:
    """针对单个问题应用修复（用于报告中的修复建议）"""
    fixed_entries = entries.copy()
    fix_info = {}
    
    if issue.issue_type == IssueType.OVERLAP:
        indices = issue.subtitle_indices
        if len(indices) >= 2:
            idx1, idx2 = indices[0], indices[1]
            for i, entry in enumerate(fixed_entries):
                if entry.index == idx1:
                    entry1 = entry
                if entry.index == idx2:
                    entry2 = entry
            
            if entry1 and entry2:
                gap = 50
                new_end = entry2.start_ms - gap
                entry1.end_time = timedelta(milliseconds=new_end)
                fix_info = {
                    "action": f"将字幕 {idx1} 的结束时间调整为 {format_srt_time(entry1.end_time)}",
                    "old_end": format_srt_time(timedelta(milliseconds=issue.details.get("overlap_ms", 0) + entry2.start_ms - 50)),
                    "new_end": format_srt_time(entry1.end_time)
                }
    
    elif issue.issue_type == IssueType.INVALID_TIME:
        if issue.subtitle_index is not None:
            for entry in fixed_entries:
                if entry.index == issue.subtitle_index:
                    if entry.end_time < entry.start_time:
                        entry.end_time = entry.start_time + timedelta(milliseconds=500)
                        fix_info = {
                            "action": f"将字幕 {entry.index} 的结束时间调整为开始时间后 500ms",
                            "old": f"{format_srt_time(entry.start_time)} --> {format_srt_time(issue.original.get('end', ''))}",
                            "new": f"{format_srt_time(entry.start_time)} --> {format_srt_time(entry.end_time)}"
                        }
    
    elif issue.issue_type == IssueType.EMPTY_TEXT:
        if issue.subtitle_index is not None:
            fixed_entries = [e for e in fixed_entries if e.index != issue.subtitle_index]
            fix_info = {
                "action": f"删除字幕 {issue.subtitle_index}（内容为空）"
            }
    
    elif issue.issue_type == IssueType.DUPLICATE:
        indices = issue.subtitle_indices
        if len(indices) >= 2:
            keep_idx = indices[0]
            remove_idx = indices[1]
            fixed_entries = [e for e in fixed_entries if e.index != remove_idx]
            fix_info = {
                "action": f"删除重复字幕 {remove_idx}，保留字幕 {keep_idx}"
            }
    
    return fixed_entries, fix_info
