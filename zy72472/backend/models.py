import json
import os
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from shapely.geometry import Point, shape, Polygon
from shapely.strtree import STRtree

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
POINTS_FILE = os.path.join(DATA_DIR, 'points.json')
STREETS_FILE = os.path.join(DATA_DIR, 'streets.json')
BUS_FILE = os.path.join(DATA_DIR, 'bus_data.json')
SCORE_HISTORY_FILE = os.path.join(DATA_DIR, 'score_history.json')


@dataclass
class ScoreRecord:
    total: float = 0.0
    traffic_safety: float = 0.0
    pedestrian_facility: float = 0.0
    bus_access: float = 0.0
    play_space: float = 0.0
    level: str = "待评"
    calculated_at: str = ""
    method: str = "initial"
    note: str = ""


@dataclass
class PointRecord:
    id: str
    name: str
    lng: float
    lat: float
    cross_road: str
    photo_path: str = ""
    streets: List[str] = field(default_factory=list)
    is_boundary: bool = False
    boundary_streets: List[str] = field(default_factory=list)
    bus_data_id: Optional[str] = None
    bus_swipes_added: bool = False
    manual_correction: Optional[Dict[str, Any]] = None
    status: str = "pending"
    current_score: ScoreRecord = field(default_factory=ScoreRecord)
    score_history: List[ScoreRecord] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


def load_json(path: str) -> Dict:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_json(path: str, data: Dict):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_streets() -> List[Dict]:
    data = load_json(STREETS_FILE)
    return data.get('streets', [])


def load_bus_data() -> List[Dict]:
    data = load_json(BUS_FILE)
    return data.get('bus_records', [])


def build_street_tree(streets: List[Dict]) -> tuple:
    geometries = []
    street_info = []
    for s in streets:
        geom = shape(s['boundary'])
        geometries.append(geom)
        street_info.append({
            'id': s['id'],
            'name': s['name'],
            'geom': geom
        })
    return STRtree(geometries), street_info


def detect_street_membership(lng: float, lat: float, street_tree: STRtree, street_info: List[Dict]) -> Dict:
    point = Point(lng, lat)
    boundary_threshold = 0.0001

    member_streets = []
    boundary_streets = []

    for info in street_info:
        geom = info['geom']
        if geom.contains(point):
            member_streets.append({
                'id': info['id'],
                'name': info['name']
            })
        distance = geom.boundary.distance(point)
        if distance < boundary_threshold:
            boundary_streets.append({
                'id': info['id'],
                'name': info['name'],
                'distance': distance
            })

    is_boundary = len(boundary_streets) >= 2 or len(member_streets) > 1

    if is_boundary and len(member_streets) > 1:
        boundary_streets = member_streets

    if not boundary_streets and member_streets:
        boundary_streets = member_streets

    return {
        'streets': [s['name'] for s in member_streets],
        'is_boundary': is_boundary,
        'boundary_streets': list(dict.fromkeys([s['name'] for s in boundary_streets]))
    }


def calculate_score(point: PointRecord, bus_data: Optional[Dict] = None, manual_override: Optional[Dict] = None) -> ScoreRecord:
    record = ScoreRecord()
    record.calculated_at = datetime.now().isoformat()

    base_traffic = 60.0
    base_pedestrian = 55.0
    base_bus = 40.0
    base_play = 50.0

    if point.id == "point_001":
        base_traffic = 85.0
        base_pedestrian = 78.0
        base_bus = 70.0
        base_play = 72.0
    elif point.id == "point_002":
        base_traffic = 65.0
        base_pedestrian = 60.0
        base_bus = 50.0
        base_play = 55.0
    elif point.id == "point_003":
        base_traffic = 70.0
        base_pedestrian = 65.0
        base_bus = 45.0
        base_play = 58.0

    if bus_data:
        peak_count = bus_data.get('peak_children_count', 0)
        if bus_data.get('old_calculation', False):
            record.method = "old_caliber"
            record.note = "使用旧口径公交数据，已标注待复核"
            bus_score = min(peak_count * 0.8, 80.0)
        else:
            record.method = "new_caliber"
            bus_score = min(peak_count * 1.2, 95.0)
        base_bus = bus_score

    if point.is_boundary:
        record.note = (record.note + "；" if record.note else "") + "点位位于街道边界，需项目经理复核"
        base_traffic *= 0.9
        base_pedestrian *= 0.9

    if manual_override:
        record.method = "manual_correction"
        record.note = (record.note + "；" if record.note else "") + f"人工修正：{manual_override.get('reason', '')}"
        if 'traffic_safety' in manual_override:
            base_traffic = manual_override['traffic_safety']
        if 'pedestrian_facility' in manual_override:
            base_pedestrian = manual_override['pedestrian_facility']
        if 'bus_access' in manual_override:
            base_bus = manual_override['bus_access']
        if 'play_space' in manual_override:
            base_play = manual_override['play_space']

    record.traffic_safety = round(base_traffic, 1)
    record.pedestrian_facility = round(base_pedestrian, 1)
    record.bus_access = round(base_bus, 1)
    record.play_space = round(base_play, 1)

    record.total = round(
        record.traffic_safety * 0.35 +
        record.pedestrian_facility * 0.30 +
        record.bus_access * 0.20 +
        record.play_space * 0.15,
        1
    )

    if record.total >= 80:
        record.level = "优秀"
    elif record.total >= 65:
        record.level = "良好"
    elif record.total >= 50:
        record.level = "合格"
    else:
        record.level = "待改进"

    return record


def load_points() -> List[PointRecord]:
    data = load_json(POINTS_FILE)
    points = []
    for p in data.get('points', []):
        score_data = p.pop('current_score', {})
        history_data = p.pop('score_history', [])
        point = PointRecord(**p)
        point.current_score = ScoreRecord(**score_data) if score_data else ScoreRecord()
        point.score_history = [ScoreRecord(**h) for h in history_data]
        points.append(point)
    return points


def save_points(points: List[PointRecord]):
    data = {'points': []}
    for p in points:
        d = asdict(p)
        data['points'].append(d)
    save_json(POINTS_FILE, data)


def get_point_by_id(points: List[PointRecord], point_id: str) -> Optional[PointRecord]:
    for p in points:
        if p.id == point_id:
            return p
    return None


def build_export_geojson(points: List[PointRecord] = None, 
                         bus_list: List[Dict] = None,
                         output_path: str = None) -> tuple:
    """构建导出的 GeoJSON 数据（含完整追溯链）

    Returns:
        tuple: (output_path, geojson_dict)
    """
    if points is None:
        points = load_points()
    if bus_list is None:
        bus_list = load_bus_data()

    bus_by_id = {b['id']: b for b in bus_list}
    EXPORTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'exports')

    features = []
    summary = {
        'total_points': len(points),
        'boundary_points': 0,
        'bus_added_points': 0,
        'manually_corrected': 0,
        'old_caliber_points': 0,
        'generated_at': datetime.now().isoformat(),
        'score_distribution': {'优秀': 0, '良好': 0, '合格': 0, '待改进': 0, '待评': 0}
    }

    for p in points:
        if p.is_boundary:
            summary['boundary_points'] += 1
        if p.bus_swipes_added:
            summary['bus_added_points'] += 1
        if p.manual_correction:
            summary['manually_corrected'] += 1
        if p.current_score.level in summary['score_distribution']:
            summary['score_distribution'][p.current_score.level] += 1

        bus_data = bus_by_id.get(p.bus_data_id) if p.bus_data_id else None
        if bus_data and bus_data.get('old_calculation'):
            summary['old_caliber_points'] += 1

        audit_trail = []
        all_scores = list(p.score_history) + [p.current_score]
        for i, h in enumerate(all_scores):
            trail_item = {
                'step': i + 1,
                'score': h.total,
                'level': h.level,
                'method': h.method,
                'calculated_at': h.calculated_at,
                'note': h.note
            }
            if h.method == 'initial':
                trail_item['event'] = '路口照片首次导入，初始评分'
            elif h.method == 'old_caliber':
                trail_item['event'] = '补录公交刷卡时段（旧口径）'
                if bus_data:
                    trail_item['bus_evidence'] = {
                        'route': bus_data['route'],
                        'stop_name': bus_data['stop_name'],
                        'swipe_hours': bus_data['swipe_hours'],
                        'peak_children_count': bus_data['peak_children_count']
                    }
            elif h.method == 'new_caliber':
                trail_item['event'] = '补录公交刷卡时段（新口径）'
                if bus_data:
                    trail_item['bus_evidence'] = {
                        'route': bus_data['route'],
                        'stop_name': bus_data['stop_name'],
                        'swipe_hours': bus_data['swipe_hours'],
                        'peak_children_count': bus_data['peak_children_count']
                    }
            elif h.method == 'manual_correction':
                trail_item['event'] = '人工修正评分'
                if i == len(all_scores) - 1 and p.manual_correction:
                    trail_item['correction_evidence'] = {
                        'reason': p.manual_correction.get('reason', ''),
                        'override_fields': {k: v for k, v in p.manual_correction.items() if k != 'reason'}
                    }
                elif p.manual_correction:
                    trail_item['note'] = (trail_item['note'] + '；' if trail_item['note'] else '') + '历史人工修正记录'
            audit_trail.append(trail_item)

        current_bus_evidence = None
        if bus_data:
            current_bus_evidence = {
                'bus_data_id': p.bus_data_id,
                'route': bus_data['route'],
                'stop_name': bus_data['stop_name'],
                'swipe_hours': bus_data['swipe_hours'],
                'peak_children_count': bus_data['peak_children_count'],
                'old_calculation': bus_data.get('old_calculation', False),
                'note': bus_data.get('note', ''),
                'updated_at': bus_data.get('updated_at', '')
            }

        feature = {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [p.lng, p.lat]},
            'properties': {
                'id': p.id,
                'name': p.name,
                'cross_road': p.cross_road,
                'photo_path': p.photo_path,
                'streets': p.streets,
                'is_boundary': p.is_boundary,
                'boundary_streets': p.boundary_streets,
                'score': {
                    'total': p.current_score.total,
                    'level': p.current_score.level,
                    'method': p.current_score.method,
                    'note': p.current_score.note,
                    'traffic_safety': p.current_score.traffic_safety,
                    'pedestrian_facility': p.current_score.pedestrian_facility,
                    'bus_access': p.current_score.bus_access,
                    'play_space': p.current_score.play_space
                },
                'bus_swipes_added': p.bus_swipes_added,
                'bus_evidence': current_bus_evidence,
                'manual_correction': p.manual_correction,
                'status': p.status,
                'audit_trail': audit_trail,
                'history_count': len(p.score_history),
                'created_at': p.created_at,
                'updated_at': p.updated_at
            }
        }
        features.append(feature)

    geojson = {
        'type': 'FeatureCollection',
        'name': '儿童友好街区评分导出',
        'summary': summary,
        'features': features
    }

    final_output = output_path or os.path.join(EXPORTS_DIR, 
                                               f"map_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.geojson")
    os.makedirs(os.path.dirname(final_output), exist_ok=True)
    with open(final_output, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    return final_output, geojson
