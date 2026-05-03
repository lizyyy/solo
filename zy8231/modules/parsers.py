import json
import csv
import yaml
from datetime import datetime, time, date
from typing import List, Dict, Optional, Any
import os

from .data_models import (
    Layout, Zone, ZoneType, Schedule, Shift, 
    Heatmap, HeatmapPoint, CheckinLog, CheckinRecord, Rules
)


class LayoutParser:
    @staticmethod
    def parse(file_path: str) -> Layout:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        layout = Layout(
            pool_width=data.get('pool_width', 0.0),
            pool_length=data.get('pool_length', 0.0)
        )
        
        for zone_data in data.get('zones', []):
            zone = Zone(
                id=zone_data['id'],
                name=zone_data['name'],
                zone_type=ZoneType(zone_data['zone_type']),
                position=zone_data.get('position', {'x': 0.0, 'y': 0.0}),
                coverage_radius=zone_data.get('coverage_radius', 5.0),
                is_high_risk=zone_data.get('is_high_risk', False),
                min_lifeguards=zone_data.get('min_lifeguards', 1)
            )
            layout.zones[zone.id] = zone
        
        return layout


class ScheduleParser:
    @staticmethod
    def parse(file_path: str) -> Schedule:
        schedule = Schedule()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            shift_count = 0
            
            for row in reader:
                shift_count += 1
                
                start_time_str = row.get('start_time', '').strip()
                end_time_str = row.get('end_time', '').strip()
                
                try:
                    start_time = datetime.strptime(start_time_str, "%H:%M").time()
                except ValueError:
                    start_time = time(0, 0)
                
                try:
                    end_time = datetime.strptime(end_time_str, "%H:%M").time()
                except ValueError:
                    end_time = time(0, 0)
                
                is_cross_midnight = False
                if end_time < start_time:
                    is_cross_midnight = True
                
                shift = Shift(
                    id=row.get('shift_id', f'shift_{shift_count}'),
                    lifeguard_name=row.get('lifeguard_name', 'Unknown'),
                    start_time=start_time,
                    end_time=end_time,
                    assigned_zone_id=row.get('zone_id', ''),
                    is_cross_midnight=is_cross_midnight
                )
                
                schedule.shifts.append(shift)
        
        return schedule


class HeatmapParser:
    @staticmethod
    def parse(file_path: str) -> Heatmap:
        heatmap = Heatmap()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    
                    timestamp_str = data.get('timestamp', '')
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        try:
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S")
                        except ValueError:
                            timestamp = datetime.now()
                    
                    point = HeatmapPoint(
                        timestamp=timestamp,
                        zone_id=data.get('zone_id', ''),
                        visitor_count=data.get('visitor_count', 0),
                        density=data.get('density', 0.0)
                    )
                    heatmap.points.append(point)
                except json.JSONDecodeError:
                    continue
        
        return heatmap


class CheckinParser:
    @staticmethod
    def parse(file_path: str) -> CheckinLog:
        checkin_log = CheckinLog()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                timestamp_str = row.get('timestamp', '')
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S")
                    except ValueError:
                        timestamp = datetime.now()
                
                is_checkin_str = row.get('is_checkin', 'true').lower()
                is_checkin = is_checkin_str in ['true', '1', 'yes', 'checkin']
                
                record = CheckinRecord(
                    timestamp=timestamp,
                    lifeguard_name=row.get('lifeguard_name', 'Unknown'),
                    zone_id=row.get('zone_id', ''),
                    is_checkin=is_checkin
                )
                checkin_log.records.append(record)
        
        return checkin_log


class RulesParser:
    @staticmethod
    def parse(file_path: str) -> Rules:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if data is None:
            data = {}
        
        rules = Rules(
            max_shift_duration_minutes=data.get('max_shift_duration_minutes', 120),
            min_break_minutes=data.get('min_break_minutes', 15),
            children_area_min_lifeguards=data.get('children_area_min_lifeguards', 2),
            high_risk_zone_min_lifeguards=data.get('high_risk_zone_min_lifeguards', 2),
            checkin_grace_minutes=data.get('checkin_grace_minutes', 5),
            fatigue_alert_threshold_minutes=data.get('fatigue_alert_threshold_minutes', 90),
            time_slots=data.get('time_slots', [
                {"start": "09:00", "end": "11:00"},
                {"start": "11:00", "end": "13:00"},
                {"start": "13:00", "end": "15:00"},
                {"start": "15:00", "end": "17:00"},
                {"start": "17:00", "end": "19:00"},
                {"start": "19:00", "end": "21:00"}
            ])
        )
        
        return rules
