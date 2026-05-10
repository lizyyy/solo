import hashlib
from pathlib import Path
from typing import List, Dict, Optional
import srt
import webvtt


class SubtitleItem:
    def __init__(self, index: int, start_time: str, end_time: str, text: str, 
                 start_seconds: float, end_seconds: float):
        self.index = index
        self.start_time = start_time
        self.end_time = end_time
        self.text = text
        self.start_seconds = start_seconds
        self.end_seconds = end_seconds

    def to_dict(self) -> Dict:
        return {
            'index': self.index,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'text': self.text,
            'start_seconds': self.start_seconds,
            'end_seconds': self.end_seconds
        }


class SubtitleParser:
    @staticmethod
    def parse_srt(file_path: str) -> List[SubtitleItem]:
        content = Path(file_path).read_text(encoding='utf-8')
        subtitles = srt.parse(content)
        items = []
        for sub in subtitles:
            start_seconds = sub.start.total_seconds()
            end_seconds = sub.end.total_seconds()
            items.append(SubtitleItem(
                index=sub.index,
                start_time=str(sub.start),
                end_time=str(sub.end),
                text=sub.content.replace('\n', ' ').strip(),
                start_seconds=start_seconds,
                end_seconds=end_seconds
            ))
        return items

    @staticmethod
    def parse_vtt(file_path: str) -> List[SubtitleItem]:
        subtitles = webvtt.read(file_path)
        items = []
        for i, cue in enumerate(subtitles, start=1):
            start_seconds = cue.start_in_seconds
            end_seconds = cue.end_in_seconds
            items.append(SubtitleItem(
                index=i,
                start_time=cue.start,
                end_time=cue.end,
                text=cue.text.replace('\n', ' ').strip(),
                start_seconds=start_seconds,
                end_seconds=end_seconds
            ))
        return items

    @classmethod
    def parse(cls, file_path: str) -> List[SubtitleItem]:
        path = Path(file_path)
        suffix = path.suffix.lower()
        
        if suffix == '.srt':
            return cls.parse_srt(file_path)
        elif suffix == '.vtt':
            return cls.parse_vtt(file_path)
        else:
            raise ValueError(f"Unsupported subtitle format: {suffix}")

    @staticmethod
    def get_file_hash(file_path: str) -> str:
        path = Path(file_path)
        content = path.read_bytes()
        return hashlib.md5(content).hexdigest()

    @staticmethod
    def is_supported(file_path: str) -> bool:
        path = Path(file_path)
        return path.suffix.lower() in ('.srt', '.vtt')
