import csv
import json
from datetime import date
from pathlib import Path
from typing import List, Optional, Dict, Any

import yaml

from .geo import Point
from .models import SurveyLine, TrackPoint, SonarParameters, ExclusionZone
from .time_utils import parse_time, resolve_time_sequence
from .units import to_meters, to_knots


def load_survey_lines_csv(file_path: str, unit: str = "meters") -> List[SurveyLine]:
    lines = []
    path = Path(file_path)
    
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            line_id = row.get('line_id', row.get('id', ''))
            if not line_id:
                continue
            
            try:
                start_lat = float(row.get('start_lat', row.get('slat', 0)))
                start_lon = float(row.get('start_lon', row.get('slon', 0)))
                end_lat = float(row.get('end_lat', row.get('elat', 0)))
                end_lon = float(row.get('end_lon', row.get('elon', 0)))
                
                swath_left = float(row.get('swath_left', row.get('left_swath', 0)))
                swath_right = float(row.get('swath_right', row.get('right_swath', 0)))
                
                swath_unit = row.get('swath_unit', unit)
                swath_left = to_meters(swath_left, swath_unit)
                swath_right = to_meters(swath_right, swath_unit)
                
                planned_speed = float(row.get('planned_speed', row.get('speed', 0)))
                speed_unit = row.get('speed_unit', 'knots')
                planned_speed = to_knots(planned_speed, speed_unit)
                
                priority = int(row.get('priority', 1))
                notes = row.get('notes', '')
                
                lines.append(SurveyLine(
                    line_id=line_id,
                    start_point=Point(start_lat, start_lon),
                    end_point=Point(end_lat, end_lon),
                    planned_swath_left=swath_left,
                    planned_swath_right=swath_right,
                    planned_speed=planned_speed,
                    priority=priority,
                    notes=notes
                ))
            except (ValueError, KeyError) as e:
                continue
    
    return lines


def load_track_jsonl(file_path: str, base_date: Optional[date] = None) -> List[TrackPoint]:
    points = []
    path = Path(file_path)
    
    with open(path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            try:
                data = json.loads(line)
                
                time_str = data.get('timestamp', data.get('time', data.get('datetime', '')))
                if not time_str:
                    continue
                
                timestamp = parse_time(time_str)
                
                lat = float(data.get('latitude', data.get('lat', 0)))
                lon = float(data.get('longitude', data.get('lon', 0)))
                
                speed = float(data.get('speed', data.get('spd', 0)))
                speed_unit = data.get('speed_unit', 'knots')
                speed = to_knots(speed, speed_unit)
                
                heading = float(data.get('heading', data.get('hdg', 0)))
                depth = float(data.get('depth', data.get('dep', 0)))
                source = data.get('source', '')
                
                points.append(TrackPoint(
                    timestamp=timestamp,
                    point=Point(lat, lon),
                    speed=speed,
                    heading=heading,
                    depth=depth,
                    source=source
                ))
            except (json.JSONDecodeError, ValueError, KeyError) as e:
                continue
    
    if base_date and points:
        timestamps = [p.timestamp for p in points]
        resolved_timestamps = resolve_time_sequence(timestamps, base_date)
        for i, ts in enumerate(resolved_timestamps):
            points[i].timestamp = ts
    
    points.sort(key=lambda p: p.timestamp)
    
    return points


def load_sonar_params_yaml(file_path: str) -> SonarParameters:
    path = Path(file_path)
    
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    
    sonar = data.get('sonar', data)
    
    unit = sonar.get('unit', sonar.get('distance_unit', 'meters'))
    
    swath_left = float(sonar.get('swath_left', sonar.get('left_swath', 100)))
    swath_right = float(sonar.get('swath_right', sonar.get('right_swath', 100)))
    
    swath_left = to_meters(swath_left, unit)
    swath_right = to_meters(swath_right, unit)
    
    return SonarParameters(
        frequency=float(sonar.get('frequency', 100.0)),
        swath_width_left=swath_left,
        swath_width_right=swath_right,
        range_scale=to_meters(float(sonar.get('range_scale', 100)), unit),
        tvg=float(sonar.get('tvg', sonar.get('time_varied_gain', 0))),
        gain=float(sonar.get('gain', 0)),
        unit=unit,
        along_track_resolution=to_meters(float(sonar.get('along_track_resolution', 0.5)), unit),
        across_track_resolution=to_meters(float(sonar.get('across_track_resolution', 0.1)), unit)
    )


def load_exclusion_zones_yaml(file_path: str) -> List[ExclusionZone]:
    zones = []
    path = Path(file_path)
    
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    
    zones_data = data.get('exclusion_zones', data.get('zones', []))
    
    for zone_data in zones_data:
        zone_id = zone_data.get('zone_id', zone_data.get('id', ''))
        if not zone_id:
            continue
        
        name = zone_data.get('name', zone_id)
        reason = zone_data.get('reason', '')
        priority = int(zone_data.get('priority', 1))
        
        polygon_data = zone_data.get('polygon', [])
        polygon = []
        
        for point_data in polygon_data:
            if isinstance(point_data, dict):
                lat = float(point_data.get('latitude', point_data.get('lat', 0)))
                lon = float(point_data.get('longitude', point_data.get('lon', 0)))
                polygon.append(Point(lat, lon))
            elif isinstance(point_data, (list, tuple)) and len(point_data) >= 2:
                polygon.append(Point(float(point_data[0]), float(point_data[1])))
        
        if len(polygon) >= 3:
            zones.append(ExclusionZone(
                zone_id=zone_id,
                name=name,
                polygon=polygon,
                reason=reason,
                priority=priority
            ))
    
    return zones


def load_config_yaml(file_path: str) -> Dict[str, Any]:
    path = Path(file_path)
    
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f) or {}
