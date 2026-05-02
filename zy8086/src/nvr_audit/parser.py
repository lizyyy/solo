"""
Parser module - reads all input files and returns structured data.
"""
import csv
import json
from pathlib import Path
from typing import Any, Optional, Union
from dataclasses import dataclass, field


@dataclass
class Clip:
    camera_id: str
    filename: str
    start_time: str
    end_time: str
    duration: float = 0.0
    file_size: int = 0


@dataclass
class ClockEvent:
    camera_id: str
    event_type: str
    timestamp: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None


@dataclass
class FFProbeSummary:
    filename: str
    duration: float
    bitrate: int
    width: int = 0
    height: int = 0
    fps: float = 0.0


@dataclass
class ParsedData:
    clips: list[Clip] = field(default_factory=list)
    clock_events: list[ClockEvent] = field(default_factory=list)
    ffprobe_summaries: dict[str, FFProbeSummary] = field(default_factory=dict)
    rules: dict[str, Any] = field(default_factory=dict)


def parse_clips_manifest(csv_path: Union[str, Path]) -> list[Clip]:
    clips = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            clips.append(Clip(
                camera_id=row.get('camera_id', '').strip(),
                filename=row.get('filename', '').strip(),
                start_time=row.get('start_time', '').strip(),
                end_time=row.get('end_time', '').strip(),
                duration=float(row.get('duration', 0)),
                file_size=int(row.get('file_size', 0)),
            ))
    return clips


def parse_device_clock_events(jsonl_path: Union[str, Path]) -> list[ClockEvent]:
    events = []
    with open(jsonl_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            events.append(ClockEvent(
                camera_id=obj.get('camera_id', ''),
                event_type=obj.get('event_type', ''),
                timestamp=obj.get('timestamp', ''),
                old_value=obj.get('old_value'),
                new_value=obj.get('new_value'),
            ))
    return events


def parse_ffprobe_summaries(json_path: Union[str, Path]) -> dict[str, FFProbeSummary]:
    summaries = {}
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)
    for item in data if isinstance(data, list) else [data]:
        filename = item.get('filename', '')
        summaries[filename] = FFProbeSummary(
            filename=filename,
            duration=float(item.get('duration', 0)),
            bitrate=int(item.get('bitrate', 0)),
            width=int(item.get('width', 0)),
            height=int(item.get('height', 0)),
            fps=float(item.get('fps', 0)),
        )
    return summaries


def parse_rules(yaml_path: Union[str, Path]) -> dict[str, Any]:
    import yaml
    with open(yaml_path, encoding='utf-8') as f:
        return yaml.safe_load(f)


def parse_all(
    clips_path: Union[str, Path],
    clock_path: Union[str, Path],
    ffprobe_path: Union[str, Path],
    rules_path: Union[str, Path],
) -> ParsedData:
    return ParsedData(
        clips=parse_clips_manifest(clips_path),
        clock_events=parse_device_clock_events(clock_path),
        ffprobe_summaries=parse_ffprobe_summaries(ffprobe_path),
        rules=parse_rules(rules_path),
    )
