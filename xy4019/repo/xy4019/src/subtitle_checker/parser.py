import re
from abc import ABC, abstractmethod
from datetime import timedelta
from pathlib import Path
from typing import List, Optional, Tuple

from .models import SubtitleItem, SubtitleFile


class SubtitleParser(ABC):
    @abstractmethod
    def parse(self, content: str, file_path: Optional[Path] = None) -> SubtitleFile:
        pass
    
    @abstractmethod
    def format(self) -> str:
        pass
    
    @classmethod
    def get_parser_for_format(cls, format_name: str) -> Optional['SubtitleParser']:
        format_name = format_name.lower()
        if format_name == 'srt':
            return SRTParser()
        elif format_name == 'vtt':
            return VTTTParser()
        return None
    
    @classmethod
    def get_parser_for_file(cls, file_path: Path) -> Optional['SubtitleParser']:
        suffix = file_path.suffix.lower().lstrip('.')
        return cls.get_parser_for_format(suffix)
    
    @staticmethod
    def timecode_to_timedelta(timecode: str, format_type: str = 'srt') -> timedelta:
        if format_type == 'vtt':
            timecode = timecode.replace('.', ',')
        
        parts = timecode.split(':')
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds_part = parts[2].split(',')
            seconds = int(seconds_part[0])
            milliseconds = int(seconds_part[1]) if len(seconds_part) > 1 else 0
        elif len(parts) == 2:
            hours = 0
            minutes = int(parts[0])
            seconds_part = parts[1].split(',')
            seconds = int(seconds_part[0])
            milliseconds = int(seconds_part[1]) if len(seconds_part) > 1 else 0
        else:
            raise ValueError(f"Invalid timecode format: {timecode}")
        
        return timedelta(
            hours=hours,
            minutes=minutes,
            seconds=seconds,
            milliseconds=milliseconds
        )
    
    @staticmethod
    def timedelta_to_timecode(td: timedelta, format_type: str = 'srt') -> str:
        total_seconds = td.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = int(total_seconds % 60)
        milliseconds = int((total_seconds * 1000) % 1000)
        
        if format_type == 'vtt':
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
        else:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


class SRTParser(SubtitleParser):
    def format(self) -> str:
        return 'srt'
    
    def parse(self, content: str, file_path: Optional[Path] = None) -> SubtitleFile:
        items: List[SubtitleItem] = []
        
        blocks = re.split(r'\n\n+', content.strip())
        
        for block in blocks:
            if not block.strip():
                continue
            
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue
            
            try:
                index = int(lines[0].strip())
            except ValueError:
                continue
            
            timecode_line = lines[1].strip()
            timecode_match = re.match(r'(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})', timecode_line)
            
            if not timecode_match:
                continue
            
            start_timecode = timecode_match.group(1)
            end_timecode = timecode_match.group(2)
            
            try:
                start_time = self.timecode_to_timedelta(start_timecode, 'srt')
                end_time = self.timecode_to_timedelta(end_timecode, 'srt')
            except ValueError:
                continue
            
            text = '\n'.join(lines[2:]).strip()
            
            item = SubtitleItem(
                index=index,
                start_time=start_time,
                end_time=end_time,
                text=text,
                original_index=index
            )
            items.append(item)
        
        subtitle_file = SubtitleFile(
            path=file_path or Path('.'),
            format='srt',
            items=items
        )
        
        return subtitle_file
    
    def generate(self, subtitle_file: SubtitleFile) -> str:
        lines = []
        for i, item in enumerate(subtitle_file.items, 1):
            lines.append(str(i))
            start_timecode = self.timedelta_to_timecode(item.start_time, 'srt')
            end_timecode = self.timedelta_to_timecode(item.end_time, 'srt')
            lines.append(f"{start_timecode} --> {end_timecode}")
            lines.append(item.text)
            lines.append('')
        
        return '\n'.join(lines)


class VTTTParser(SubtitleParser):
    def format(self) -> str:
        return 'vtt'
    
    def parse(self, content: str, file_path: Optional[Path] = None) -> SubtitleFile:
        items: List[SubtitleItem] = []
        
        lines = content.strip().split('\n')
        current_index = 0
        in_header = True
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            
            if in_header:
                if line == 'WEBVTT':
                    in_header = False
                i += 1
                continue
            
            if not line:
                i += 1
                continue
            
            if re.match(r'^(\d+)$', line):
                try:
                    current_index = int(line)
                except ValueError:
                    current_index += 1
                i += 1
                if i < len(lines):
                    line = lines[i].strip()
            else:
                current_index += 1
            
            timecode_match = re.match(r'(\d{2}:\d{2}:\d{2}[\.,]\d{3}|\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.,]\d{3}|\d{2}:\d{2}[\.,]\d{3})', line)
            
            if timecode_match:
                start_timecode = timecode_match.group(1)
                end_timecode = timecode_match.group(2)
                
                try:
                    start_time = self.timecode_to_timedelta(start_timecode, 'vtt')
                    end_time = self.timecode_to_timedelta(end_timecode, 'vtt')
                except ValueError:
                    i += 1
                    continue
                
                i += 1
                text_lines = []
                while i < len(lines) and lines[i].strip():
                    text_lines.append(lines[i].strip())
                    i += 1
                
                text = '\n'.join(text_lines).strip()
                
                item = SubtitleItem(
                    index=current_index,
                    start_time=start_time,
                    end_time=end_time,
                    text=text,
                    original_index=current_index
                )
                items.append(item)
            else:
                i += 1
        
        subtitle_file = SubtitleFile(
            path=file_path or Path('.'),
            format='vtt',
            items=items
        )
        
        return subtitle_file
    
    def generate(self, subtitle_file: SubtitleFile) -> str:
        lines = ['WEBVTT', '']
        
        for i, item in enumerate(subtitle_file.items, 1):
            lines.append(str(i))
            start_timecode = self.timedelta_to_timecode(item.start_time, 'vtt')
            end_timecode = self.timedelta_to_timecode(item.end_time, 'vtt')
            lines.append(f"{start_timecode} --> {end_timecode}")
            lines.append(item.text)
            lines.append('')
        
        return '\n'.join(lines)


def parse_file(file_path: Path, encoding: str = 'utf-8') -> SubtitleFile:
    parser = SubtitleParser.get_parser_for_file(file_path)
    if parser is None:
        raise ValueError(f"Unsupported subtitle format: {file_path.suffix}")
    
    with open(file_path, 'r', encoding=encoding) as f:
        content = f.read()
    
    subtitle_file = parser.parse(content, file_path)
    subtitle_file.encoding = encoding
    
    return subtitle_file


def generate_file(subtitle_file: SubtitleFile, output_path: Path, encoding: str = 'utf-8') -> None:
    parser = SubtitleParser.get_parser_for_format(subtitle_file.format)
    if parser is None:
        raise ValueError(f"Unsupported subtitle format: {subtitle_file.format}")
    
    if hasattr(parser, 'generate'):
        content = parser.generate(subtitle_file)
        with open(output_path, 'w', encoding=encoding) as f:
            f.write(content)
    else:
        raise ValueError(f"Parser for format {subtitle_file.format} does not support generation")
