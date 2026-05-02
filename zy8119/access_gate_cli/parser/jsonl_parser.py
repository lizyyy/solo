import json
from dataclasses import dataclass
from typing import Dict, Any
from datetime import datetime


@dataclass
class DeviceClock:
    device_id: str
    device_time: datetime
    server_time: datetime
    drift_seconds: float


def parse_device_clock_jsonl(file_path: str) -> Dict[str, DeviceClock]:
    device_clocks = {}
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            
            device_time = datetime.strptime(
                data['device_time'],
                "%Y-%m-%d %H:%M:%S"
            )
            server_time = datetime.strptime(
                data['server_time'],
                "%Y-%m-%d %H:%M:%S"
            )
            
            clock = DeviceClock(
                device_id=data['device_id'],
                device_time=device_time,
                server_time=server_time,
                drift_seconds=data['drift_seconds']
            )
            device_clocks[clock.device_id] = clock
    
    return device_clocks
