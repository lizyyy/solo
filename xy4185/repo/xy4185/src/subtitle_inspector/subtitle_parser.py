import re
from datetime import timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import chardet

from .models import SubtitleEntry, SubtitleFile


def detect_encoding(file_path: Path) -> str:
    with open(file_path, "rb") as f:
        raw_data = f.read(10000)
        result = chardet.detect(raw_data)
        encoding = result["encoding"] if result["encoding"] else "utf-8"
        return encoding.lower()


def parse_srt_time(time_str: str) -> timedelta:
    time_str = time_str.strip()
    parts = time_str.replace(",", ":").split(":")
    if len(parts) == 3:
        h, m, s_ms = parts
    elif len(parts) == 4:
        h, m, s, ms = parts
        s_ms = f"{s}.{ms}"
    else:
        raise ValueError(f"Invalid time format: {time_str}")
    
    s_parts = s_ms.split(".")
    if len(s_parts) == 2:
        s = s_parts[0]
        ms = s_parts[1].ljust(3, "0")[:3]
    else:
        s = s_parts[0]
        ms = "000"
    
    return timedelta(
        hours=int(h),
        minutes=int(m),
        seconds=int(s),
        milliseconds=int(ms)
    )


def clean_ass_text(text: str) -> str:
    text = re.sub(r"\{[^}]*\}", "", text)
    text = re.sub(r"\\N", "\n", text)
    text = re.sub(r"\\n", " ", text)
    return text.strip()


def clean_srt_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\{[^}]+\}", "", text)
    return text.strip()


class SRTSubtitleParser:
    def __init__(self, file_path: Path, encoding: Optional[str] = None):
        self.file_path = file_path
        self.encoding = encoding or detect_encoding(file_path)
    
    def parse(self) -> SubtitleFile:
        with open(self.file_path, "r", encoding=self.encoding) as f:
            content = f.read()
        
        entries = self._parse_content(content)
        language = self._detect_language_from_filename()
        
        return SubtitleFile(
            path=self.file_path,
            format="srt",
            encoding=self.encoding,
            language=language,
            entries=entries,
            metadata={"raw_content_length": len(content)}
        )
    
    def _parse_content(self, content: str) -> List[SubtitleEntry]:
        entries: List[SubtitleEntry] = []
        
        blocks = re.split(r"\n\n+", content.strip())
        
        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) < 3:
                continue
            
            try:
                index_line = lines[0].strip()
                index = int(index_line) if index_line.isdigit() else len(entries) + 1
                
                time_line = lines[1]
                time_match = re.match(
                    r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})",
                    time_line
                )
                
                if not time_match:
                    continue
                
                start_time = parse_srt_time(time_match.group(1))
                end_time = parse_srt_time(time_match.group(2))
                
                raw_text = "\n".join(lines[2:])
                clean_text = clean_srt_text(raw_text)
                
                if not clean_text.strip():
                    continue
                
                entry = SubtitleEntry(
                    index=index,
                    start_time=start_time,
                    end_time=end_time,
                    text=clean_text,
                    raw_text=raw_text,
                    language=self._detect_language_from_text(clean_text)
                )
                
                entries.append(entry)
            except (ValueError, IndexError):
                continue
        
        return entries
    
    def _detect_language_from_filename(self) -> str:
        name = self.file_path.stem.lower()
        
        lang_patterns = [
            (r"(zh|cn|chinese)", "zh-CN"),
            (r"(en|english)", "en-US"),
            (r"(ja|jp|japanese)", "ja-JP"),
            (r"(ko|kr|korean)", "ko-KR"),
            (r"(fr|french)", "fr-FR"),
            (r"(de|german)", "de-DE"),
            (r"(es|spanish)", "es-ES"),
        ]
        
        for pattern, lang in lang_patterns:
            if re.search(pattern, name):
                return lang
        
        return "unknown"
    
    def _detect_language_from_text(self, text: str) -> str:
        chinese_chars = len(re.findall(r"[\u4e00-\u9fff]", text))
        total_chars = len(re.findall(r"[^\s\d\p{P}]", text, re.UNICODE))
        
        if total_chars == 0:
            return "unknown"
        
        chinese_ratio = chinese_chars / max(total_chars, 1)
        
        if chinese_ratio > 0.5:
            return "zh-CN"
        elif re.search(r"[a-zA-Z]{3,}", text):
            return "en-US"
        
        return "unknown"


class ASSSubtitleParser:
    def __init__(self, file_path: Path, encoding: Optional[str] = None):
        self.file_path = file_path
        self.encoding = encoding or detect_encoding(file_path)
    
    def parse(self) -> SubtitleFile:
        with open(self.file_path, "r", encoding=self.encoding) as f:
            lines = f.readlines()
        
        styles, metadata = self._parse_header(lines)
        entries = self._parse_events(lines)
        language = self._detect_language_from_filename()
        
        return SubtitleFile(
            path=self.file_path,
            format="ass",
            encoding=self.encoding,
            language=language,
            entries=entries,
            styles=styles,
            metadata=metadata
        )
    
    def _parse_header(self, lines: List[str]) -> Tuple[Dict, Dict]:
        styles: Dict[str, Dict] = {}
        metadata: Dict[str, Any] = {}
        
        in_styles = False
        in_info = False
        
        for line in lines:
            line = line.strip()
            
            if line == "[V4+ Styles]" or line == "[V4 Styles]":
                in_styles = True
                continue
            elif line == "[Script Info]":
                in_info = True
                continue
            elif line.startswith("["):
                in_styles = False
                in_info = False
                continue
            
            if in_info and ":" in line:
                key, value = line.split(":", 1)
                metadata[key.strip()] = value.strip()
            
            if in_styles and line.startswith("Format:"):
                format_fields = [f.strip() for f in line[7:].split(",")]
                continue
            
            if in_styles and line.startswith("Style:"):
                style_data = line[6:].split(",", len(format_fields) - 1) if "format_fields" in dir() else []
                if len(style_data) > 0:
                    style_name = style_data[0].strip()
                    styles[style_name] = {
                        "raw": line,
                        "fields": dict(zip(format_fields if "format_fields" in dir() else [], style_data))
                    }
        
        return styles, metadata
    
    def _parse_events(self, lines: List[str]) -> List[SubtitleEntry]:
        entries: List[SubtitleEntry] = []
        format_fields = None
        index = 0
        
        for line in lines:
            line = line.strip()
            
            if line.startswith("[Events]"):
                continue
            
            if line.startswith("Format:"):
                format_fields = [f.strip() for f in line[7:].split(",")]
                continue
            
            if line.startswith("Dialogue:") and format_fields:
                try:
                    event_data = line[9:].split(",", len(format_fields) - 1)
                    event_dict = dict(zip(format_fields, event_data))
                    
                    start_time = self._parse_ass_time(event_dict.get("Start", "0:00:00.00"))
                    end_time = self._parse_ass_time(event_dict.get("End", "0:00:00.00"))
                    
                    raw_text = event_dict.get("Text", "")
                    clean_text = clean_ass_text(raw_text)
                    
                    if not clean_text.strip():
                        continue
                    
                    index += 1
                    style = event_dict.get("Style", "Default")
                    
                    entry = SubtitleEntry(
                        index=index,
                        start_time=start_time,
                        end_time=end_time,
                        text=clean_text,
                        raw_text=raw_text,
                        style=style,
                        language=self._detect_language_from_text(clean_text)
                    )
                    
                    entries.append(entry)
                except Exception:
                    continue
        
        return entries
    
    def _parse_ass_time(self, time_str: str) -> timedelta:
        time_str = time_str.strip()
        parts = time_str.split(":")
        if len(parts) == 3:
            h = int(parts[0])
            m = int(parts[1])
            s_ms = parts[2].split(".")
            s = int(s_ms[0])
            cs = int(s_ms[1]) if len(s_ms) > 1 else 0
            return timedelta(hours=h, minutes=m, seconds=s, milliseconds=cs * 10)
        return timedelta(0)
    
    def _detect_language_from_filename(self) -> str:
        name = self.file_path.stem.lower()
        
        lang_patterns = [
            (r"(zh|cn|chinese)", "zh-CN"),
            (r"(en|english)", "en-US"),
            (r"(ja|jp|japanese)", "ja-JP"),
            (r"(ko|kr|korean)", "ko-KR"),
        ]
        
        for pattern, lang in lang_patterns:
            if re.search(pattern, name):
                return lang
        
        return "unknown"
    
    def _detect_language_from_text(self, text: str) -> str:
        chinese_chars = len(re.findall(r"[\u4e00-\u9fff]", text))
        total_chars = len(re.findall(r"[^\s\d\p{P}]", text, re.UNICODE))
        
        if total_chars == 0:
            return "unknown"
        
        chinese_ratio = chinese_chars / max(total_chars, 1)
        
        if chinese_ratio > 0.5:
            return "zh-CN"
        elif re.search(r"[a-zA-Z]{3,}", text):
            return "en-US"
        
        return "unknown"


def parse_subtitle_file(file_path: Path, encoding: Optional[str] = None) -> SubtitleFile:
    ext = file_path.suffix.lower()
    
    if ext == ".srt":
        parser = SRTSubtitleParser(file_path, encoding)
    elif ext == ".ass":
        parser = ASSSubtitleParser(file_path, encoding)
    else:
        raise ValueError(f"Unsupported subtitle format: {ext}")
    
    return parser.parse()
