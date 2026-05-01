import re
import csv
from datetime import timedelta
from typing import List, TextIO, Optional
from pathlib import Path

from .models import Subtitle, Chapter, SensitiveRule


def parse_srt_time(time_str: str) -> timedelta:
    time_str = time_str.strip()
    match = re.match(r"(\d+):(\d+):(\d+),(\d+)", time_str)
    if match:
        hours, minutes, seconds, milliseconds = map(int, match.groups())
        return timedelta(
            hours=hours,
            minutes=minutes,
            seconds=seconds,
            milliseconds=milliseconds
        )
    raise ValueError(f"Invalid SRT time format: {time_str}")


def parse_vtt_time(time_str: str) -> timedelta:
    time_str = time_str.strip()
    match = re.match(r"(\d+):(\d+):(\d+)\.(\d+)", time_str)
    if match:
        hours, minutes, seconds, milliseconds = map(int, match.groups())
        return timedelta(
            hours=hours,
            minutes=minutes,
            seconds=seconds,
            milliseconds=milliseconds
        )
    match = re.match(r"(\d+):(\d+)\.(\d+)", time_str)
    if match:
        minutes, seconds, milliseconds = map(int, match.groups())
        return timedelta(
            minutes=minutes,
            seconds=seconds,
            milliseconds=milliseconds
        )
    raise ValueError(f"Invalid VTT time format: {time_str}")


def parse_srt(content: str) -> List[Subtitle]:
    subtitles: List[Subtitle] = []
    blocks = re.split(r"\n\n+", content.strip())

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 2:
            continue

        try:
            sub_id = int(lines[0].strip())
            time_line = lines[1]

            time_match = re.match(r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})", time_line)
            if not time_match:
                continue

            start_time = parse_srt_time(time_match.group(1))
            end_time = parse_srt_time(time_match.group(2))

            text = "\n".join(lines[2:]).strip() if len(lines) > 2 else ""

            subtitles.append(Subtitle(
                id=len(subtitles) + 1,
                start_time=start_time,
                end_time=end_time,
                text=text,
                original_id=sub_id
            ))
        except (ValueError, IndexError):
            continue

    return subtitles


def parse_vtt(content: str) -> List[Subtitle]:
    subtitles: List[Subtitle] = []
    lines = content.split("\n")
    current_id = 1
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        if line.startswith("WEBVTT") or line == "":
            i += 1
            continue

        if "-->" in line:
            time_match = re.match(r"([\d:.]+)\s*-->\s*([\d:.]+)", line)
            if time_match:
                start_time = parse_vtt_time(time_match.group(1))
                end_time = parse_vtt_time(time_match.group(2))

                text_lines = []
                i += 1
                while i < len(lines) and lines[i].strip() != "" and "-->" not in lines[i]:
                    text_lines.append(lines[i].strip())
                    i += 1

                text = "\n".join(text_lines).strip()

                subtitles.append(Subtitle(
                    id=current_id,
                    start_time=start_time,
                    end_time=end_time,
                    text=text
                ))
                current_id += 1
                continue

        i += 1

    return subtitles


def parse_subtitle_file(file_path: str) -> List[Subtitle]:
    path = Path(file_path)
    content = path.read_text(encoding="utf-8")

    if path.suffix.lower() == ".srt":
        return parse_srt(content)
    elif path.suffix.lower() == ".vtt":
        return parse_vtt(content)
    else:
        raise ValueError(f"Unsupported subtitle format: {path.suffix}")


def parse_chapters_csv(content: str) -> List[Chapter]:
    chapters: List[Chapter] = []
    lines = content.split("\n")
    header_skipped = False

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if not header_skipped:
            header_skipped = True
            continue

        parts = line.split(",", 2)
        if len(parts) < 2:
            continue

        try:
            start_time_str = parts[0].strip()
            title = parts[1].strip()

            start_time = parse_vtt_time(start_time_str) if ":" in start_time_str and "." in start_time_str else parse_srt_time(start_time_str)

            end_time = None
            if len(parts) > 2 and parts[2].strip():
                end_time_str = parts[2].strip()
                end_time = parse_vtt_time(end_time_str) if ":" in end_time_str and "." in end_time_str else parse_srt_time(end_time_str)

            chapters.append(Chapter(
                id=len(chapters) + 1,
                title=title,
                start_time=start_time,
                end_time=end_time
            ))
        except (ValueError, IndexError):
            continue

    return chapters


def parse_chapters_file(file_path: str) -> List[Chapter]:
    path = Path(file_path)
    content = path.read_text(encoding="utf-8")
    return parse_chapters_csv(content)


def parse_rules_csv(content: str) -> List[SensitiveRule]:
    rules: List[SensitiveRule] = []
    lines = content.split("\n")
    header_skipped = False

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if not header_skipped:
            header_skipped = True
            continue

        parts = line.split(",", 3)
        if len(parts) < 3:
            continue

        try:
            pattern = parts[0].strip()
            category = parts[1].strip()
            description = parts[2].strip() if len(parts) > 2 else ""
            mask_template = parts[3].strip() if len(parts) > 3 else "[{category}_{index}]"

            rules.append(SensitiveRule(
                id=len(rules) + 1,
                pattern=pattern,
                category=category,
                description=description,
                mask_template=mask_template
            ))
        except (ValueError, IndexError):
            continue

    return rules


def parse_rules_file(file_path: str) -> List[SensitiveRule]:
    path = Path(file_path)
    content = path.read_text(encoding="utf-8")
    return parse_rules_csv(content)


def format_srt_time(td: timedelta) -> str:
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    milliseconds = int(td.microseconds / 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def format_vtt_time(td: timedelta) -> str:
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    milliseconds = int(td.microseconds / 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def export_srt(subtitles: List[Subtitle]) -> str:
    lines = []
    for sub in subtitles:
        lines.append(str(sub.id))
        lines.append(f"{format_srt_time(sub.start_time)} --> {format_srt_time(sub.end_time)}")
        lines.append(sub.text)
        lines.append("")
    return "\n".join(lines)


def export_vtt(subtitles: List[Subtitle]) -> str:
    lines = ["WEBVTT", ""]
    for sub in subtitles:
        lines.append(f"{format_vtt_time(sub.start_time)} --> {format_vtt_time(sub.end_time)}")
        lines.append(sub.text)
        lines.append("")
    return "\n".join(lines)
