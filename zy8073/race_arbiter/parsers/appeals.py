import json
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional


@dataclass
class Appeal:
    bib: str
    type: str
    mat_id: str
    timestamp: Optional[datetime] = None
    note: str = ""
    action: str = "add"


def parse_appeals_json(file_path: str) -> List[Appeal]:
    appeals = []
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for appeal_data in data:
            ts = None
            if appeal_data.get('timestamp'):
                ts = datetime.fromisoformat(appeal_data['timestamp'])
            appeals.append(Appeal(
                bib=appeal_data['bib'],
                type=appeal_data['type'],
                mat_id=appeal_data['mat_id'],
                timestamp=ts,
                note=appeal_data.get('note', ''),
                action=appeal_data.get('action', 'add')
            ))
    return appeals
