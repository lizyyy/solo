import csv
from dataclasses import dataclass
from typing import List, Dict, Any
from datetime import datetime


@dataclass
class Personnel:
    personnel_id: str
    name: str
    department: str
    card_id: str
    role: str


@dataclass
class AccessRequest:
    request_id: str
    personnel_id: str
    zone_id: str
    start_time: datetime
    end_time: datetime
    request_type: str  # 'grant' or 'revoke'
    priority: int = 0


def parse_personnel_csv(file_path: str) -> Dict[str, Personnel]:
    personnel_dict = {}
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            personnel = Personnel(
                personnel_id=row['personnel_id'].strip(),
                name=row['name'].strip(),
                department=row['department'].strip(),
                card_id=row['card_id'].strip(),
                role=row['role'].strip()
            )
            personnel_dict[personnel.personnel_id] = personnel
    return personnel_dict


def parse_access_requests_csv(file_path: str) -> List[AccessRequest]:
    requests = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            start_time = datetime.strptime(
                row['start_time'].strip(),
                "%Y-%m-%d %H:%M:%S"
            )
            end_time = datetime.strptime(
                row['end_time'].strip(),
                "%Y-%m-%d %H:%M:%S"
            )
            request = AccessRequest(
                request_id=row['request_id'].strip(),
                personnel_id=row['personnel_id'].strip(),
                zone_id=row['zone_id'].strip(),
                start_time=start_time,
                end_time=end_time,
                request_type=row['request_type'].strip().lower(),
                priority=int(row.get('priority', 0))
            )
            requests.append(request)
    return requests
