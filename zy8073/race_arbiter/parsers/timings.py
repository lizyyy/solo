import json
from dataclasses import dataclass
from datetime import datetime
from typing import List


@dataclass
class TimingPoint:
    chip_id: str
    mat_id: str
    timestamp: datetime
    bib: str = None


def parse_timings_jsonl(file_path: str) -> List[TimingPoint]:
    timings = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            tp = TimingPoint(
                chip_id=data['chip_id'],
                mat_id=data['mat_id'],
                timestamp=datetime.fromisoformat(data['timestamp']),
                bib=data.get('bib')
            )
            timings.append(tp)
    return sorted(timings, key=lambda x: x.timestamp)
