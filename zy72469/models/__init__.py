from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from typing import List, Dict, Optional, Any
import uuid
import json
import os
from config import PROCESSED_DATA_DIR

def generate_id():
    return str(uuid.uuid4())[:8]

@dataclass
class GridInspection:
    id: str = field(default_factory=generate_id)
    inspector_name: str = ""
    inspection_date: str = ""
    location: str = ""
    lng: float = 0.0
    lat: float = 0.0
    road_condition: str = ""
    passable: bool = True
    obstacle: str = ""
    inspection_time: str = ""
    remarks: str = ""
    source_file: str = ""
    import_time: str = field(default_factory=lambda: datetime.now().isoformat())
    data_type: str = "normal"

    def to_dict(self):
        return asdict(self)

@dataclass
class ConstructionNotice:
    id: str = field(default_factory=generate_id)
    notice_no: str = ""
    project_name: str = ""
    construction_unit: str = ""
    location: str = ""
    lng: float = 0.0
    lat: float = 0.0
    start_date: str = ""
    end_date: str = ""
    construction_type: str = ""
    road_closure: bool = False
    affected_area: str = ""
    remarks: str = ""
    source_file: str = ""
    import_time: str = field(default_factory=lambda: datetime.now().isoformat())
    reviewed_by: str = ""
    review_time: str = ""

    def to_dict(self):
        return asdict(self)

@dataclass
class ConflictRecord:
    id: str = field(default_factory=generate_id)
    inspection_id: str = ""
    notice_id: str = ""
    conflict_type: str = ""
    description: str = ""
    location: str = ""
    inspection_data: Dict = field(default_factory=dict)
    notice_data: Dict = field(default_factory=dict)
    status: str = "pending"
    resolved_by: str = ""
    resolution: str = ""
    resolve_time: str = ""
    create_time: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return asdict(self)

@dataclass
class HeatmapData:
    id: str = field(default_factory=generate_id)
    grid_x: int = 0
    grid_y: int = 0
    lng: float = 0.0
    lat: float = 0.0
    weight: float = 0.0
    sample_count: int = 0
    hour: int = 0
    date: str = ""
    has_evening_gap: bool = False
    needs_review: bool = False
    reviewed_by: str = ""
    review_status: str = "normal"

    def to_dict(self):
        return asdict(self)

@dataclass
class DeliveryRoute:
    id: str = field(default_factory=generate_id)
    route_name: str = ""
    stations: List[Dict] = field(default_factory=list)
    total_distance: float = 0.0
    estimated_time: int = 0
    blocked_segments: List[Dict] = field(default_factory=list)
    heatmap_version: str = ""
    create_time: str = field(default_factory=lambda: datetime.now().isoformat())
    version: int = 1

    def to_dict(self):
        return asdict(self)

@dataclass
class ImportRecord:
    id: str = field(default_factory=generate_id)
    file_name: str = ""
    file_hash: str = ""
    data_type: str = ""
    import_type: str = ""
    record_count: int = 0
    success_count: int = 0
    duplicate_count: int = 0
    operator: str = ""
    import_time: str = field(default_factory=lambda: datetime.now().isoformat())
    status: str = "completed"
    message: str = ""

    def to_dict(self):
        return asdict(self)

@dataclass
class SelfCheckResult:
    id: str = field(default_factory=generate_id)
    check_type: str = ""
    check_name: str = ""
    status: str = "pass"
    message: str = ""
    details: Dict = field(default_factory=dict)
    check_time: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return asdict(self)

class DataStore:
    def __init__(self):
        self.inspections: List[GridInspection] = []
        self.notices: List[ConstructionNotice] = []
        self.conflicts: List[ConflictRecord] = []
        self.heatmaps: List[HeatmapData] = []
        self.routes: List[DeliveryRoute] = []
        self.import_records: List[ImportRecord] = []
        self.self_checks: List[SelfCheckResult] = []
        self.load()

    def save(self):
        data = {
            'inspections': [i.to_dict() for i in self.inspections],
            'notices': [n.to_dict() for n in self.notices],
            'conflicts': [c.to_dict() for c in self.conflicts],
            'heatmaps': [h.to_dict() for h in self.heatmaps],
            'routes': [r.to_dict() for r in self.routes],
            'import_records': [ir.to_dict() for ir in self.import_records],
            'self_checks': [sc.to_dict() for sc in self.self_checks],
        }
        with open(os.path.join(PROCESSED_DATA_DIR, 'datastore.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self):
        path = os.path.join(PROCESSED_DATA_DIR, 'datastore.json')
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.inspections = [GridInspection(**i) for i in data.get('inspections', [])]
            self.notices = [ConstructionNotice(**n) for n in data.get('notices', [])]
            self.conflicts = [ConflictRecord(**c) for c in data.get('conflicts', [])]
            self.heatmaps = [HeatmapData(**h) for h in data.get('heatmaps', [])]
            self.routes = [DeliveryRoute(**r) for r in data.get('routes', [])]
            self.import_records = [ImportRecord(**ir) for ir in data.get('import_records', [])]
            self.self_checks = [SelfCheckResult(**sc) for sc in data.get('self_checks', [])]

store = DataStore()
