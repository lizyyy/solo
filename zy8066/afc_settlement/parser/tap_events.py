import csv
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict


@dataclass
class TapEvent:
    card_id: str
    tap_type: str
    station_id: str
    timestamp: datetime
    device_id: str
    transaction_id: str


def parse_tap_events(file_path: str) -> List[TapEvent]:
    events = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            event = TapEvent(
                card_id=row['card_id'],
                tap_type=row['tap_type'],
                station_id=row['station_id'],
                timestamp=datetime.fromisoformat(row['timestamp']),
                device_id=row.get('device_id', ''),
                transaction_id=row.get('transaction_id', ''),
            )
            events.append(event)
    return events
