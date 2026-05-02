import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


@dataclass
class TranscriptSegment:
    id: str
    start_time: Optional[timedelta] = None
    end_time: Optional[timedelta] = None
    text: str = ""
    speaker: Optional[str] = None
    language: Optional[str] = None
    source: str = "unknown"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "start_time": self._timedelta_to_str(self.start_time) if self.start_time else None,
            "end_time": self._timedelta_to_str(self.end_time) if self.end_time else None,
            "text": self.text,
            "speaker": self.speaker,
            "language": self.language,
            "source": self.source,
            "metadata": self.metadata,
        }

    def _timedelta_to_str(self, td: timedelta) -> str:
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        milliseconds = td.microseconds // 1000
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


class TranscriptParser:
    def __init__(self):
        self.segments: List[TranscriptSegment] = []
        self.full_text: str = ""

    def parse_srt(self, file_path: Union[str, Path], source: str = "unknown") -> List[TranscriptSegment]:
        file_path = Path(file_path)
        segments = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        srt_pattern = re.compile(
            r"(\d+)\s*\n"
            r"(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*\n"
            r"(.*?)(?=\n\n\d+\s*\n|\n*$)",
            re.DOTALL,
        )

        for match in srt_pattern.finditer(content):
            seg_id = match.group(1)
            start_str = match.group(2).replace(",", ".")
            end_str = match.group(3).replace(",", ".")
            text = match.group(4).strip()

            start_time = self._parse_time(start_str)
            end_time = self._parse_time(end_str)

            speaker, clean_text = self._extract_speaker(text)

            segment = TranscriptSegment(
                id=seg_id,
                start_time=start_time,
                end_time=end_time,
                text=clean_text,
                speaker=speaker,
                source=source,
            )
            segments.append(segment)

        self.segments.extend(segments)
        self._update_full_text()

        return segments

    def parse_txt(self, file_path: Union[str, Path], source: str = "unknown") -> List[TranscriptSegment]:
        file_path = Path(file_path)
        segments = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()

        current_segment_id = 1
        current_text_parts: List[str] = []
        current_speaker: Optional[str] = None
        current_start_time: Optional[timedelta] = None

        for line_num, line in enumerate(lines, 1):
            line = line.strip()

            if not line:
                if current_text_parts:
                    full_text = " ".join(current_text_parts)
                    speaker, clean_text = self._extract_speaker(full_text)
                    if not speaker:
                        speaker = current_speaker

                    segment = TranscriptSegment(
                        id=str(current_segment_id),
                        start_time=current_start_time,
                        text=clean_text,
                        speaker=speaker,
                        source=source,
                        metadata={"line_number": line_num},
                    )
                    segments.append(segment)
                    current_segment_id += 1
                    current_text_parts = []
                continue

            time_match = re.match(r"\[?(\d{2}:\d{2}(?::\d{2})?)\]?", line)
            if time_match:
                if current_text_parts:
                    full_text = " ".join(current_text_parts)
                    speaker, clean_text = self._extract_speaker(full_text)
                    segment = TranscriptSegment(
                        id=str(current_segment_id),
                        start_time=current_start_time,
                        text=clean_text,
                        speaker=speaker if speaker else current_speaker,
                        source=source,
                        metadata={"line_number": line_num},
                    )
                    segments.append(segment)
                    current_segment_id += 1
                    current_text_parts = []

                time_str = time_match.group(1)
                if len(time_str.split(":")) == 2:
                    time_str = f"00:{time_str}"
                current_start_time = self._parse_time(f"{time_str}.000")
                line = line[time_match.end() :].strip()

            speaker_match = re.match(r"^([^\s:：]+)\s*[：:]\s*(.*)$", line)
            if speaker_match:
                possible_speaker = speaker_match.group(1).strip()
                rest_text = speaker_match.group(2).strip()

                if self._is_likely_speaker(possible_speaker):
                    if current_text_parts:
                        full_text = " ".join(current_text_parts)
                        s, clean_text = self._extract_speaker(full_text)
                        segment = TranscriptSegment(
                            id=str(current_segment_id),
                            start_time=current_start_time,
                            text=clean_text,
                            speaker=s if s else current_speaker,
                            source=source,
                            metadata={"line_number": line_num},
                        )
                        segments.append(segment)
                        current_segment_id += 1
                        current_text_parts = []

                    current_speaker = possible_speaker
                    line = rest_text

            if line:
                current_text_parts.append(line)

        if current_text_parts:
            full_text = " ".join(current_text_parts)
            speaker, clean_text = self._extract_speaker(full_text)
            segment = TranscriptSegment(
                id=str(current_segment_id),
                start_time=current_start_time,
                text=clean_text,
                speaker=speaker if speaker else current_speaker,
                source=source,
            )
            segments.append(segment)

        self.segments.extend(segments)
        self._update_full_text()

        return segments

    def import_transcript(self, file_path: Union[str, Path], source: str = "unknown") -> List[TranscriptSegment]:
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix == ".srt":
            return self.parse_srt(file_path, source)
        elif suffix == ".txt":
            return self.parse_txt(file_path, source)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

    def get_text_by_speaker(self, speaker: str) -> List[TranscriptSegment]:
        return [s for s in self.segments if s.speaker == speaker]

    def get_speakers(self) -> List[str]:
        return list({s.speaker for s in self.segments if s.speaker})

    def search_text(self, keyword: str, case_sensitive: bool = False) -> List[TranscriptSegment]:
        if case_sensitive:
            return [s for s in self.segments if keyword in s.text]
        else:
            keyword_lower = keyword.lower()
            return [s for s in self.segments if keyword_lower in s.text.lower()]

    def _parse_time(self, time_str: str) -> Optional[timedelta]:
        time_str = time_str.strip()
        try:
            if "." in time_str:
                time_part, ms_part = time_str.split(".")
            elif "," in time_str:
                time_part, ms_part = time_str.split(",")
            else:
                time_part = time_str
                ms_part = "0"

            parts = time_part.split(":")
            if len(parts) == 3:
                hours, minutes, seconds = map(int, parts)
            elif len(parts) == 2:
                hours = 0
                minutes, seconds = map(int, parts)
            else:
                return None

            milliseconds = int(ms_part.ljust(3, "0")[:3])

            return timedelta(
                hours=hours,
                minutes=minutes,
                seconds=seconds,
                milliseconds=milliseconds,
            )
        except (ValueError, AttributeError):
            return None

    def _extract_speaker(self, text: str) -> tuple[Optional[str], str]:
        patterns = [
            r"^([^\s:：]{2,10})\s*[：:]\s*(.+)$",
            r"^\[([^\]]+)\]\s*(.+)$",
            r"^【([^】]+)】\s*(.+)$",
            r"^<([^>]+)>\s*(.+)$",
        ]

        for pattern in patterns:
            match = re.match(pattern, text)
            if match:
                possible_speaker = match.group(1).strip()
                rest_text = match.group(2).strip()
                if self._is_likely_speaker(possible_speaker):
                    return possible_speaker, rest_text

        return None, text

    def _is_likely_speaker(self, text: str) -> bool:
        if not text or len(text) < 2:
            return False

        if re.match(r"^\d+$", text):
            return False

        if re.match(r"^\d{2}:\d{2}:\d{2}", text):
            return False

        if re.match(r"^[A-Za-z]{2,}$", text):
            return True

        chinese_chars = len(re.findall(r"[\u4e00-\u9fff]", text))
        if 2 <= chinese_chars <= 5:
            return True

        return False

    def _update_full_text(self):
        self.full_text = " ".join(s.text for s in self.segments)
