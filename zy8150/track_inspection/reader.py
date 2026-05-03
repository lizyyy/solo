import csv
import json
from typing import Dict, List, Any

from .models import TrackSection, GeometryPoint


def read_track_sections(filepath: str) -> List[TrackSection]:
    """读取 track_sections.csv，返回区间定义列表"""
    sections = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            section = TrackSection(
                section_id=row['section_id'],
                start_km=float(row['start_km']),
                end_km=float(row['end_km']),
                section_type=row['section_type'],
                curve_direction=row.get('curve_direction'),
                curve_radius=float(row['curve_radius']) if row.get('curve_radius') else None
            )
            sections.append(section)
    sections.sort(key=lambda s: s.start_km)
    return sections


def read_geometry_points(filepath: str) -> List[GeometryPoint]:
    """读取 geometry_points.jsonl，返回检测点列表"""
    points = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            point = GeometryPoint(
                mileage=float(data['mileage']),
                track_gauge=float(data['track_gauge']),
                level=float(data['level']),
                alignment_left=float(data['alignment_left']),
                alignment_right=float(data['alignment_right']),
                profile_left=float(data['profile_left']),
                profile_right=float(data['profile_right'])
            )
            points.append(point)
    points.sort(key=lambda p: p.mileage)
    return points


def read_rules(filepath: str) -> Dict[str, Any]:
    """读取 rules.yaml，返回规则配置"""
    import yaml
    with open(filepath, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)
