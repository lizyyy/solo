from datetime import timedelta
from typing import List, Optional, Tuple
import csv
import re
import os

from .models import SubtitleItem, Speaker, Chapter
from .utils import (
    srt_time_to_timedelta,
    extract_speaker_from_text,
    normalize_text,
    is_empty_or_whitespace
)


class ParseError(Exception):
    pass


class SRTParser:
    SRT_BLOCK_PATTERN = re.compile(
        r'(\d+)\s*\n'
        r'(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\n'
        r'(.*?)(?:\n\n|\Z)',
        re.DOTALL
    )
    
    def __init__(self, auto_extract_speaker: bool = True):
        self.auto_extract_speaker = auto_extract_speaker
        self.speaker_list: List[Speaker] = []
    
    def set_speaker_list(self, speakers: List[Speaker]) -> None:
        self.speaker_list = speakers
    
    def parse_string(self, content: str) -> List[SubtitleItem]:
        subtitles: List[SubtitleItem] = []
        blocks = self._split_into_blocks(content)
        
        for block_idx, block in enumerate(blocks):
            try:
                subtitle = self._parse_block(block, expected_index=len(subtitles) + 1)
                subtitles.append(subtitle)
            except Exception as e:
                raise ParseError(f"解析字幕块 {block_idx + 1} 时出错: {e}")
        
        return subtitles
    
    def parse_file(self, filepath: str) -> List[SubtitleItem]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return self.parse_string(content)
    
    def _split_into_blocks(self, content: str) -> List[str]:
        content = content.strip()
        content = re.sub(r'\r\n', '\n', content)
        blocks = re.split(r'\n\n+', content)
        return [b.strip() for b in blocks if b.strip()]
    
    def _parse_block(self, block: str, expected_index: int) -> SubtitleItem:
        lines = block.split('\n')
        
        if len(lines) < 2:
            raise ParseError(f"字幕块格式错误，至少需要2行: {block[:50]}...")
        
        index_line = lines[0].strip()
        try:
            index = int(index_line)
        except ValueError:
            raise ParseError(f"无效的字幕索引: {index_line}")
        
        time_line_idx = 1
        time_line = lines[time_line_idx].strip()
        while '-->' not in time_line and time_line_idx < len(lines) - 1:
            time_line_idx += 1
            time_line = lines[time_line_idx].strip()
        
        if '-->' not in time_line:
            raise ParseError(f"找不到时间轴行: {block[:100]}...")
        
        start_str, end_str = self._parse_time_line(time_line)
        
        try:
            start_time = srt_time_to_timedelta(start_str)
            end_time = srt_time_to_timedelta(end_str)
        except ValueError as e:
            raise ParseError(f"时间格式错误: {e}")
        
        text_lines = lines[time_line_idx + 1:]
        text = '\n'.join(text_lines).strip()
        original_text = text
        
        speaker = None
        if self.auto_extract_speaker:
            speaker = extract_speaker_from_text(text, self.speaker_list)
        
        text = normalize_text(text)
        
        return SubtitleItem(
            index=index,
            start_time=start_time,
            end_time=end_time,
            text=text,
            speaker=speaker,
            original_text=original_text,
            metadata={
                "line_count": len(text_lines),
                "expected_index": expected_index
            }
        )
    
    def _parse_time_line(self, time_line: str) -> Tuple[str, str]:
        match = re.search(
            r'(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})',
            time_line
        )
        if not match:
            raise ParseError(f"时间轴格式错误: {time_line}")
        
        return match.group(1), match.group(2)


class CSVParser:
    DEFAULT_COLUMN_MAPPING = {
        "name": ["姓名", "名字", "name", "speaker", "嘉宾", "主持人"],
        "alias": ["别名", "昵称", "alias", "nickname"],
        "role": ["角色", "职位", "role", "position"],
        "is_guest": ["嘉宾", "是否嘉宾", "is_guest", "guest"]
    }
    
    def __init__(self, column_mapping: dict = None):
        self.column_mapping = column_mapping or self.DEFAULT_COLUMN_MAPPING.copy()
    
    def parse_string(self, content: str) -> List[Speaker]:
        import io
        f = io.StringIO(content)
        return self._parse_csv(f)
    
    def parse_file(self, filepath: str) -> List[Speaker]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            return self._parse_csv(f)
    
    def _parse_csv(self, file_obj) -> List[Speaker]:
        speakers: List[Speaker] = []
        reader = csv.DictReader(file_obj)
        
        if reader.fieldnames is None:
            raise ParseError("CSV文件没有表头")
        
        column_map = self._detect_columns(list(reader.fieldnames))
        
        for row_idx, row in enumerate(reader, start=2):
            try:
                speaker = self._parse_row(row, column_map, row_idx)
                speakers.append(speaker)
            except Exception as e:
                raise ParseError(f"解析CSV第 {row_idx} 行时出错: {e}")
        
        return speakers
    
    def _detect_columns(self, headers: List[str]) -> dict:
        column_map = {}
        headers_lower = [h.lower().strip() for h in headers]
        
        for field, possible_names in self.column_mapping.items():
            for possible_name in possible_names:
                possible_name_lower = possible_name.lower().strip()
                if possible_name_lower in headers_lower:
                    idx = headers_lower.index(possible_name_lower)
                    column_map[field] = headers[idx]
                    break
        
        if "name" not in column_map:
            raise ParseError("找不到姓名列，请确保CSV包含'姓名'或'name'列")
        
        return column_map
    
    def _parse_row(self, row: dict, column_map: dict, row_idx: int) -> Speaker:
        name = row.get(column_map.get("name", ""), "").strip()
        
        if not name:
            raise ParseError(f"姓名不能为空")
        
        alias_str = row.get(column_map.get("alias", ""), "").strip()
        alias = []
        if alias_str:
            alias = [a.strip() for a in re.split(r'[,，;/]', alias_str) if a.strip()]
        
        role = row.get(column_map.get("role", ""), "").strip() or None
        
        is_guest = False
        guest_col = column_map.get("is_guest")
        if guest_col:
            guest_val = row.get(guest_col, "").strip().lower()
            is_guest = guest_val in ["是", "yes", "true", "1", "嘉宾"]
        
        return Speaker(
            name=name,
            alias=alias,
            role=role,
            is_guest=is_guest
        )


class ChapterParser:
    TIME_PATTERNS = [
        re.compile(r'^(\d{2}):(\d{2}):(\d{2})\s+(.+)$'),
        re.compile(r'^(\d{2}):(\d{2})\s+(.+)$'),
        re.compile(r'^(\d+):(\d{2}):(\d{2})\s+(.+)$'),
        re.compile(r'^(\d+):(\d{2})\s+(.+)$'),
    ]
    
    def __init__(self, default_duration_minutes: float = 5.0):
        self.default_duration = timedelta(minutes=default_duration_minutes)
    
    def parse_string(self, content: str) -> List[Chapter]:
        lines = content.strip().split('\n')
        chapters: List[Chapter] = []
        
        for line_idx, line in enumerate(lines):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            chapter = self._parse_line(line, line_idx + 1)
            if chapter:
                chapters.append(chapter)
        
        self._fill_chapter_end_times(chapters)
        return chapters
    
    def parse_file(self, filepath: str) -> List[Chapter]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return self.parse_string(content)
    
    def _parse_line(self, line: str, line_num: int) -> Optional[Chapter]:
        for pattern in self.TIME_PATTERNS:
            match = pattern.match(line)
            if match:
                groups = match.groups()
                
                if len(groups) == 4:
                    hours = int(groups[0])
                    minutes = int(groups[1])
                    seconds = int(groups[2])
                    title = groups[3].strip()
                elif len(groups) == 3:
                    hours = 0
                    minutes = int(groups[0])
                    seconds = int(groups[1])
                    title = groups[2].strip()
                else:
                    continue
                
                start_time = timedelta(
                    hours=hours,
                    minutes=minutes,
                    seconds=seconds
                )
                
                return Chapter(
                    title=title,
                    start_time=start_time,
                    description=None
                )
        
        return None
    
    def _fill_chapter_end_times(self, chapters: List[Chapter]) -> None:
        if not chapters:
            return
        
        chapters.sort(key=lambda c: c.start_time)
        
        for i in range(len(chapters) - 1):
            chapters[i].end_time = chapters[i + 1].start_time
        
        if chapters and chapters[-1].end_time is None:
            chapters[-1].end_time = chapters[-1].start_time + self.default_duration
