import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import yaml

from classroom_cluster.models import Chapter, TimeRange, generate_id


@dataclass
class OutlineItem:
    title: str
    description: str = ""
    time_str: str = ""
    time_range: Optional[TimeRange] = None
    order: int = 0
    keywords: List[str] = None
    
    def __post_init__(self):
        if self.keywords is None:
            self.keywords = []


class OutlineParser:
    TIME_PATTERN = re.compile(
        r"(\d{1,2}:\d{2}(?::\d{2})?)",
    )
    
    HEADING_PATTERNS = [
        re.compile(r"^(#+)\s+(.+)$"),
        re.compile(r"^(\d+\.)\s+(.+)$"),
        re.compile(r"^([-*+])\s+(.+)$"),
    ]
    
    def __init__(self, file_path: Path, source_id: Optional[str] = None):
        self.file_path = file_path
        self.source_id = source_id or generate_id()
        self._chapters: List[Chapter] = []
    
    def parse(self) -> List[Chapter]:
        if self._chapters:
            return self._chapters
        
        ext = self.file_path.suffix.lower()
        
        if ext == ".yaml" or ext == ".yml":
            self._parse_yaml()
        elif ext == ".md" or ext == ".markdown":
            self._parse_markdown()
        elif ext == ".txt":
            self._parse_text()
        else:
            raise ValueError(f"不支持的大纲格式: {ext}")
        
        self._fill_time_ranges()
        self._extract_keywords()
        
        return self._chapters
    
    def _parse_yaml(self) -> None:
        with open(self.file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("chapters", data.get("sections", []))
        else:
            items = []
        
        for i, item in enumerate(items):
            if isinstance(item, dict):
                chapter = self._dict_to_chapter(item, i)
                self._chapters.append(chapter)
            elif isinstance(item, str):
                chapter = self._string_to_chapter(item, i)
                self._chapters.append(chapter)
    
    def _parse_markdown(self) -> None:
        content = self.file_path.read_text(encoding="utf-8")
        lines = content.splitlines()
        
        current_chapter: Optional[Chapter] = None
        order = 0
        
        for line in lines:
            line = line.rstrip()
            if not line:
                continue
            
            heading_match = self._match_heading(line)
            if heading_match:
                if current_chapter:
                    self._chapters.append(current_chapter)
                
                level, text = heading_match
                chapter = self._string_to_chapter(text, order)
                current_chapter = chapter
                order += 1
            elif current_chapter:
                if current_chapter.description:
                    current_chapter.description += "\n" + line
                else:
                    current_chapter.description = line
        
        if current_chapter:
            self._chapters.append(current_chapter)
    
    def _parse_text(self) -> None:
        content = self.file_path.read_text(encoding="utf-8")
        lines = content.splitlines()
        
        order = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            chapter = self._string_to_chapter(line, order)
            self._chapters.append(chapter)
            order += 1
    
    def _match_heading(self, line: str) -> Optional[Tuple[int, str]]:
        for pattern in self.HEADING_PATTERNS:
            match = pattern.match(line)
            if match:
                prefix = match.group(1)
                text = match.group(2)
                
                if prefix.startswith("#"):
                    level = len(prefix)
                else:
                    level = 1
                
                return (level, text)
        
        return None
    
    def _dict_to_chapter(self, data: Dict[str, Any], order: int) -> Chapter:
        title = data.get("title", data.get("name", data.get("section", "未命名章节")))
        description = data.get("description", data.get("content", ""))
        keywords = data.get("keywords", data.get("tags", []))
        
        time_range = None
        time_str = data.get("time", data.get("timestamp", data.get("start_time", ""))
        
        if time_str:
            time_match = self.TIME_PATTERN.search(str(time_str))
            if time_match:
                seconds = self._time_to_seconds(time_match.group(1))
                time_range = TimeRange(start_seconds=seconds)
        
        return Chapter(
            title=str(title),
            description=str(description),
            time_range=time_range,
            order=order,
            keywords=list(keywords) if keywords else [],
            metadata={"source": str(self.file_path)},
        )
    
    def _string_to_chapter(self, text: str, order: int) -> Chapter:
        time_range = None
        title = text
        description = ""
        keywords = []
        
        time_match = self.TIME_PATTERN.search(text)
        if time_match:
            time_str = time_match.group(1)
            seconds = self._time_to_seconds(time_str)
            time_range = TimeRange(start_seconds=seconds)
            
            title = text[:time_match.start()].strip() or text[time_match.end():].strip()
            if not title:
                title = f"章节 {order + 1}"
        
        if "-" in title:
            parts = title.split("-", 1)
            if len(parts) == 2:
                title = parts[0].strip()
                description = parts[1].strip()
        
        return Chapter(
            title=title,
            description=description,
            time_range=time_range,
            order=order,
            keywords=keywords,
            metadata={"source": str(self.file_path)},
        )
    
    def _time_to_seconds(self, time_str: str) -> float:
        parts = time_str.split(":")
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        return float(time_str)
    
    def _fill_time_ranges(self) -> None:
        chapters_with_time = [c for c in self._chapters if c.time_range is not None]
        
        for i in range(len(chapters_with_time) - 1):
            current = chapters_with_time[i]
            next_ch = chapters_with_time[i + 1]
            
            if current.time_range and next_ch.time_range:
                current.time_range.end_seconds = next_ch.time_range.start_seconds
        
        if chapters_with_time:
            last = chapters_with_time[-1]
            if last.time_range and last.time_range.end_seconds is None:
                last.time_range.end_seconds = last.time_range.start_seconds + 1800.0
    
    def _extract_keywords(self) -> None:
        for chapter in self._chapters:
            if chapter.keywords:
                continue
            
            words = []
            
            title_words = self._extract_chinese_words(chapter.title)
            words.extend(title_words)
            
            if chapter.description:
                desc_words = self._extract_chinese_words(chapter.description)
                words.extend([w for w in desc_words if w not in words])
            
            chapter.keywords = words[:10]
    
    def _extract_chinese_words(self, text: str) -> List[str]:
        chinese_pattern = re.compile(r"[\u4e00-\u9fa5]{2,}")
        matches = chinese_pattern.findall(text)
        return list(dict.fromkeys(matches))
    
    def get_chapters(self) -> List[Chapter]:
        return self._chapters
    
    def find_chapter_by_time(self, seconds: float) -> Optional[Chapter]:
        for chapter in self._chapters:
            if chapter.time_range is None:
                continue
            
            if chapter.time_range.start_seconds <= seconds:
                if chapter.time_range.end_seconds is None:
                    return chapter
                if seconds <= chapter.time_range.end_seconds:
                    return chapter
        
        return None
