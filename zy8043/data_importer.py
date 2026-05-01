import csv
import json
import yaml
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class ChannelInfo:
    fixture_id: str
    fixture_name: str
    dmx_channel: int
    channel_name: str
    channel_type: str


@dataclass
class Cue:
    cue_id: str
    name: str
    fixture_values: Dict[str, Dict[str, int]]
    fade_in: float
    fade_out: float


@dataclass
class TimelineItem:
    cue_id: str
    start_time: float
    end_time: float


@dataclass
class ShowData:
    patch: List[ChannelInfo] = field(default_factory=list)
    cues: List[Cue] = field(default_factory=list)
    timeline: List[TimelineItem] = field(default_factory=list)
    total_duration: float = 30.0
    show_name: str = "Show"


def load_patch(file_path: str) -> List[ChannelInfo]:
    patch = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            patch.append(ChannelInfo(
                fixture_id=row['fixture_id'],
                fixture_name=row['fixture_name'],
                dmx_channel=int(row['dmx_channel']),
                channel_name=row['channel_name'],
                channel_type=row['channel_type']
            ))
    return patch


def load_cues(file_path: str) -> List[Cue]:
    cues = []
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        for cue_data in data:
            cues.append(Cue(
                cue_id=cue_data['cue_id'],
                name=cue_data['name'],
                fixture_values=cue_data['fixture_values'],
                fade_in=cue_data['fade_in'],
                fade_out=cue_data['fade_out']
            ))
    return cues


def load_timeline(file_path: str) -> Tuple[List[TimelineItem], float, str]:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        timeline_items = []
        for item in data['cues']:
            timeline_items.append(TimelineItem(
                cue_id=item['cue_id'],
                start_time=item['start_time'],
                end_time=item['end_time']
            ))
        return timeline_items, data.get('total_duration', 30.0), data.get('show_name', 'Show')


def load_show_data(patch_path: str, cues_path: str, timeline_path: str) -> ShowData:
    patch = load_patch(patch_path)
    cues = load_cues(cues_path)
    timeline, total_duration, show_name = load_timeline(timeline_path)
    return ShowData(
        patch=patch,
        cues=cues,
        timeline=timeline,
        total_duration=total_duration,
        show_name=show_name
    )
