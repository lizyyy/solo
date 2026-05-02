import re
from datetime import timedelta
from pathlib import Path
from typing import List, Optional, Tuple

from subtitle_checker.models import SubtitleEntry, SubtitleFile, Issue, IssueType, Severity


def parse_srt_time(time_str: str) -> timedelta:
    """
    解析 SRT 时间格式: HH:MM:SS,mmm
    兼容格式: HH:MM:SS.mmm
    """
    time_str = time_str.strip()
    if ',' in time_str:
        time_str = time_str.replace(',', '.')
    
    parts = time_str.split(':')
    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds, milliseconds = parts[2].split('.')
        seconds = int(seconds)
        milliseconds = int(milliseconds.ljust(3, '0')[:3])
    elif len(parts) == 2:
        hours = 0
        minutes = int(parts[0])
        seconds, milliseconds = parts[1].split('.')
        seconds = int(seconds)
        milliseconds = int(milliseconds.ljust(3, '0')[:3])
    else:
        raise ValueError(f"Invalid time format: {time_str}")
    
    return timedelta(
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        milliseconds=milliseconds
    )


def parse_vtt_time(time_str: str) -> timedelta:
    """
    解析 VTT 时间格式: HH:MM:SS.mmm 或 MM:SS.mmm
    """
    time_str = time_str.strip()
    
    parts = time_str.split(':')
    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds, milliseconds = parts[2].split('.')
        seconds = int(seconds)
        milliseconds = int(milliseconds.ljust(3, '0')[:3])
    elif len(parts) == 2:
        hours = 0
        minutes = int(parts[0])
        seconds, milliseconds = parts[1].split('.')
        seconds = int(seconds)
        milliseconds = int(milliseconds.ljust(3, '0')[:3])
    else:
        raise ValueError(f"Invalid time format: {time_str}")
    
    return timedelta(
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        milliseconds=milliseconds
    )


def format_srt_time(td: timedelta) -> str:
    """将 timedelta 格式化为 SRT 时间字符串"""
    total_seconds = td.total_seconds()
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds * 1000) % 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def format_vtt_time(td: timedelta) -> str:
    """将 timedelta 格式化为 VTT 时间字符串"""
    total_seconds = td.total_seconds()
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds * 1000) % 1000)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
    return f"{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


class SrtParser:
    """SRT 字幕文件解析器"""
    
    def __init__(self):
        self.time_pattern = re.compile(
            r'(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})'
        )
        self.index_pattern = re.compile(r'^\s*\d+\s*$')
    
    def parse(self, file_path: str) -> SubtitleFile:
        path = Path(file_path)
        content = path.read_text(encoding='utf-8')
        lines = content.split('\n')
        
        subtitle_file = SubtitleFile(
            file_path=str(path),
            format='srt',
            entries=[],
            parse_errors=[]
        )
        
        current_index = 0
        current_start: Optional[timedelta] = None
        current_end: Optional[timedelta] = None
        current_text_lines: List[str] = []
        original_index = 0
        
        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            if self.index_pattern.match(stripped):
                if current_start is not None and current_text_lines:
                    text = '\n'.join(current_text_lines).strip()
                    entry = SubtitleEntry(
                        index=current_index,
                        start_time=current_start,
                        end_time=current_end,
                        text=text,
                        file_path=str(path),
                        line_number=line_num - len(current_text_lines) - 2,
                        original_index=original_index
                    )
                    subtitle_file.entries.append(entry)
                
                current_index += 1
                original_index = int(stripped)
                current_start = None
                current_end = None
                current_text_lines = []
                continue
            
            time_match = self.time_pattern.search(line)
            if time_match:
                try:
                    current_start = parse_srt_time(time_match.group(1))
                    current_end = parse_srt_time(time_match.group(2))
                except ValueError as e:
                    issue = Issue(
                        issue_type=IssueType.PARSE_ERROR,
                        severity=Severity.ERROR,
                        message=f"时间格式解析失败: {time_match.group(0)}",
                        file_path=str(path),
                        line_number=line_num,
                        details={"error": str(e), "line_content": line}
                    )
                    subtitle_file.parse_errors.append(issue)
                continue
            
            if current_start is not None and (stripped or current_text_lines):
                current_text_lines.append(line.rstrip())
        
        if current_start is not None and current_text_lines:
            text = '\n'.join(current_text_lines).strip()
            entry = SubtitleEntry(
                index=current_index,
                start_time=current_start,
                end_time=current_end,
                text=text,
                file_path=str(path),
                line_number=len(lines) - len(current_text_lines),
                original_index=original_index
            )
            subtitle_file.entries.append(entry)
        
        return subtitle_file


class VttParser:
    """VTT 字幕文件解析器"""
    
    def __init__(self):
        self.time_pattern = re.compile(
            r'(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})'
        )
        self.vtt_header = re.compile(r'^WEBVTT')
    
    def parse(self, file_path: str) -> SubtitleFile:
        path = Path(file_path)
        content = path.read_text(encoding='utf-8')
        lines = content.split('\n')
        
        subtitle_file = SubtitleFile(
            file_path=str(path),
            format='vtt',
            entries=[],
            parse_errors=[]
        )
        
        current_index = 0
        current_start: Optional[timedelta] = None
        current_end: Optional[timedelta] = None
        current_text_lines: List[str] = []
        in_header = True
        line_num_start = 0
        
        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            if in_header:
                if self.vtt_header.match(stripped) or not stripped:
                    continue
                else:
                    in_header = False
            
            if stripped and '-->' not in line and not any(c.isdigit() for c in stripped.split(':')[0] if c != ':'):
                if current_start is not None:
                    continue
            
            time_match = self.time_pattern.search(line)
            if time_match:
                if current_start is not None and current_text_lines:
                    text = '\n'.join(current_text_lines).strip()
                    entry = SubtitleEntry(
                        index=current_index,
                        start_time=current_start,
                        end_time=current_end,
                        text=text,
                        file_path=str(path),
                        line_number=line_num_start,
                        original_index=current_index + 1
                    )
                    subtitle_file.entries.append(entry)
                
                current_index += 1
                current_text_lines = []
                line_num_start = line_num
                
                try:
                    current_start = parse_vtt_time(time_match.group(1))
                    current_end = parse_vtt_time(time_match.group(2))
                except ValueError as e:
                    issue = Issue(
                        issue_type=IssueType.PARSE_ERROR,
                        severity=Severity.ERROR,
                        message=f"时间格式解析失败: {time_match.group(0)}",
                        file_path=str(path),
                        line_number=line_num,
                        details={"error": str(e), "line_content": line}
                    )
                    subtitle_file.parse_errors.append(issue)
                    current_start = None
                    current_end = None
                continue
            
            if current_start is not None and (stripped or current_text_lines):
                if not stripped and not current_text_lines:
                    continue
                current_text_lines.append(line.rstrip())
        
        if current_start is not None and current_text_lines:
            text = '\n'.join(current_text_lines).strip()
            entry = SubtitleEntry(
                index=current_index,
                start_time=current_start,
                end_time=current_end,
                text=text,
                file_path=str(path),
                line_number=line_num_start,
                original_index=current_index + 1
            )
            subtitle_file.entries.append(entry)
        
        return subtitle_file


class SubtitleParser:
    """统一的字幕解析器"""
    
    def __init__(self):
        self.parsers = {
            '.srt': SrtParser(),
            '.vtt': VttParser()
        }
    
    def parse_file(self, file_path: str) -> SubtitleFile:
        path = Path(file_path)
        suffix = path.suffix.lower()
        
        if suffix not in self.parsers:
            raise ValueError(f"不支持的字幕格式: {suffix}")
        
        return self.parsers[suffix].parse(file_path)
    
    def can_parse(self, file_path: str) -> bool:
        path = Path(file_path)
        return path.suffix.lower() in self.parsers
