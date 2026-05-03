from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass
import re


@dataclass
class SubtitleEntry:
    index: int
    start_time: float
    end_time: float
    text: str
    original_lines: List[str]


@dataclass
class ParseResult:
    entries: List[SubtitleEntry]
    errors: List[dict]


class SRTParser:
    TIMECODE_PATTERN = re.compile(
        r'(\d{1,2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2}),(\d{3})'
    )

    def parse(self, srt_path: Path) -> ParseResult:
        entries: List[SubtitleEntry] = []
        errors: List[dict] = []

        try:
            with open(srt_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(srt_path, 'r', encoding='gbk') as f:
                    content = f.read()
            except Exception as e:
                errors.append({
                    'type': 'parse',
                    'file': str(srt_path),
                    'line': 0,
                    'message': f"无法解析字幕文件编码: {e}"
                })
                return ParseResult(entries=[], errors=errors)

        lines = content.replace('\r\n', '\n').replace('\r', '\n').split('\n')

        current_index = 0
        current_start: Optional[float] = None
        current_end: Optional[float] = None
        current_text_lines: List[str] = []
        current_original_lines: List[str] = []
        expected_index = 1
        in_entry = False

        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()

            if not stripped and not in_entry:
                continue

            if not stripped:
                if in_entry and current_start is not None and current_text_lines:
                    entry = SubtitleEntry(
                        index=current_index,
                        start_time=current_start,
                        end_time=current_end or current_start,
                        text='\n'.join(current_text_lines),
                        original_lines=current_original_lines
                    )
                    entries.append(entry)
                in_entry = False
                current_index = 0
                current_start = None
                current_end = None
                current_text_lines = []
                current_original_lines = []
                continue

            time_match = self.TIMECODE_PATTERN.match(stripped)
            if time_match:
                if in_entry and current_start is not None and current_text_lines:
                    entry = SubtitleEntry(
                        index=current_index,
                        start_time=current_start,
                        end_time=current_end or current_start,
                        text='\n'.join(current_text_lines),
                        original_lines=current_original_lines
                    )
                    entries.append(entry)

                h1, m1, s1, ms1, h2, m2, s2, ms2 = time_match.groups()
                current_start = self._timecode_to_seconds(h1, m1, s1, ms1)
                current_end = self._timecode_to_seconds(h2, m2, s2, ms2)
                current_original_lines = [line]
                current_text_lines = []
                in_entry = True
                continue

            if stripped.isdigit() and not in_entry:
                current_index = int(stripped)
                if current_index != expected_index:
                    errors.append({
                        'type': 'parse',
                        'file': str(srt_path),
                        'line': line_num,
                        'message': f"序号不连续: 期望 {expected_index}，实际 {current_index}"
                    })
                expected_index = current_index + 1
                in_entry = True
                current_original_lines = [line]
                continue

            if in_entry:
                current_text_lines.append(line)
                current_original_lines.append(line)

        if in_entry and current_start is not None and current_text_lines:
            entry = SubtitleEntry(
                index=current_index,
                start_time=current_start,
                end_time=current_end or current_start,
                text='\n'.join(current_text_lines),
                original_lines=current_original_lines
            )
            entries.append(entry)

        return ParseResult(entries=entries, errors=errors)

    def _timecode_to_seconds(self, h: str, m: str, s: str, ms: str) -> float:
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    @staticmethod
    def seconds_to_timecode(seconds: float) -> str:
        hours = int(seconds // 3600)
        remaining = seconds % 3600
        minutes = int(remaining // 60)
        secs = int(remaining % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
