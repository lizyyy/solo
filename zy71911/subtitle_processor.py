import re
from typing import List, Optional
from models import SubtitleLine, TimeSegment
from utils import parse_time


class SubtitleParser:
    def __init__(self):
        self.srt_pattern = re.compile(
            r"(\d+)\n"
            r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\n"
            r"(.*?)(?=\n\n|\Z)",
            re.DOTALL,
        )
        self.speaker_pattern = re.compile(r"^【(.*?)】\s*(.*)$")

    def parse_srt(self, content: str) -> List[SubtitleLine]:
        lines = []
        for match in self.srt_pattern.finditer(content):
            idx = int(match.group(1))
            start_time = parse_time(match.group(2))
            end_time = parse_time(match.group(3))
            text = match.group(4).strip()

            speaker = None
            speaker_match = self.speaker_pattern.match(text)
            if speaker_match:
                speaker = speaker_match.group(1)
                text = speaker_match.group(2)

            lines.append(
                SubtitleLine(
                    index=idx,
                    time_segment=TimeSegment(start_time, end_time),
                    text=text,
                    speaker=speaker,
                )
            )
        return lines

    def parse_file(self, filepath: str) -> List[SubtitleLine]:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return self.parse_srt(content)


class MuteSegmentDetector:
    def __init__(self, threshold_seconds: float = 3.0):
        self.threshold = threshold_seconds

    def detect_gaps(self, subtitles: List[SubtitleLine]) -> List[TimeSegment]:
        gaps = []
        for i in range(len(subtitles) - 1):
            current_end = subtitles[i].time_segment.end_time
            next_start = subtitles[i + 1].time_segment.start_time
            gap_duration = next_start - current_end

            if gap_duration >= self.threshold:
                gaps.append(TimeSegment(current_end, next_start))

        return gaps

    def detect_long_mutes(self, audio_energy_data: List[tuple]) -> List[TimeSegment]:
        mutes = []
        current_mute_start = None

        for timestamp, energy in audio_energy_data:
            if energy < 0.01:
                if current_mute_start is None:
                    current_mute_start = timestamp
            else:
                if current_mute_start is not None:
                    duration = timestamp - current_mute_start
                    if duration >= self.threshold:
                        mutes.append(TimeSegment(current_mute_start, timestamp))
                    current_mute_start = None

        return mutes
