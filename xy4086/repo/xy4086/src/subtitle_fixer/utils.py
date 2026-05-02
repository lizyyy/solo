from datetime import timedelta
from typing import Optional
import re


SRT_TIME_PATTERN = re.compile(
    r'(\d{2}):(\d{2}):(\d{2}),(\d{3})'
)


def srt_time_to_timedelta(time_str: str) -> timedelta:
    match = SRT_TIME_PATTERN.match(time_str.strip())
    if not match:
        raise ValueError(f"Invalid SRT time format: {time_str}")
    
    hours = int(match.group(1))
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    milliseconds = int(match.group(4))
    
    return timedelta(
        hours=hours,
        minutes=minutes,
        seconds=seconds,
        milliseconds=milliseconds
    )


def timedelta_to_srt_time(td: timedelta) -> str:
    total_seconds = td.total_seconds()
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def validate_time_order(start_time: timedelta, end_time: timedelta) -> bool:
    return start_time < end_time


def extract_speaker_from_text(text: str, speaker_list: list = None) -> Optional[str]:
    speaker_list = speaker_list or []
    patterns = [
        r'^([^:]+):\s*',
        r'^【([^】]+)】',
        r'^\[([^\]]+)\]',
        r'^\(([^\)]+)\)',
    ]
    
    for pattern in patterns:
        match = re.match(pattern, text.strip())
        if match:
            candidate = match.group(1).strip()
            if speaker_list:
                for speaker in speaker_list:
                    if candidate.lower() == speaker.name.lower():
                        return speaker.name
                    for alias in speaker.alias:
                        if candidate.lower() == alias.lower():
                            return speaker.name
            return candidate
    
    return None


def normalize_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[\n\r]+', ' ', text)
    return text


def is_empty_or_whitespace(text: str) -> bool:
    return not text or text.strip() == ''


def format_duration(td: timedelta) -> str:
    total_seconds = td.total_seconds()
    if total_seconds < 60:
        return f"{total_seconds:.2f}秒"
    elif total_seconds < 3600:
        minutes = int(total_seconds // 60)
        seconds = int(total_seconds % 60)
        return f"{minutes}分{seconds}秒"
    else:
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = int(total_seconds % 60)
        return f"{hours}小时{minutes}分{seconds}秒"
