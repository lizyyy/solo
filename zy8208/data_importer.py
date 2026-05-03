import csv
import json
import yaml
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from config import TIMEZONES
from models import (
    VoyagePlan, SensorReading, ZoneRule, ManualRecord,
    RiskLevel, RiskType
)


class DataImporter:
    def __init__(self):
        self.voyage_plan: Optional[VoyagePlan] = None
        self.sensor_readings: List[SensorReading] = []
        self.zone_rules: List[ZoneRule] = []
        self.manual_records: List[ManualRecord] = []
    
    def parse_datetime(self, dt_str: str, timezone: str = "UTC") -> datetime:
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return dt
    
    def convert_to_utc(self, dt: datetime, source_timezone: str) -> datetime:
        if source_timezone not in TIMEZONES:
            return dt
        offset = TIMEZONES[source_timezone]
        from datetime import timedelta
        return dt - timedelta(hours=offset)
    
    def import_voyage_plan(self, file_path: str) -> VoyagePlan:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                waypoints = json.loads(row['waypoints'].replace('""', '"'))
                self.voyage_plan = VoyagePlan(
                    voyage_id=row['voyage_id'],
                    vessel_name=row['vessel_name'],
                    departure_port=row['departure_port'],
                    departure_time=self.parse_datetime(row['departure_time'], row['timezone']),
                    arrival_port=row['arrival_port'],
                    arrival_time=self.parse_datetime(row['arrival_time'], row['timezone']),
                    waypoints=waypoints,
                    timezone=row['timezone']
                )
                return self.voyage_plan
        return None
    
    def import_sensor_data(self, file_path: str) -> List[SensorReading]:
        self.sensor_readings = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                data = json.loads(line)
                reading = SensorReading(
                    timestamp=self.parse_datetime(data['timestamp'], data.get('timezone', 'UTC')),
                    tank_id=data['tank_id'],
                    level=float(data['level']),
                    temperature=float(data['temperature']),
                    density=float(data['density']),
                    volume=float(data['volume']),
                    status=data['status'],
                    timezone=data.get('timezone', 'UTC')
                )
                self.sensor_readings.append(reading)
        
        self.sensor_readings.sort(key=lambda x: x.timestamp)
        return self.sensor_readings
    
    def import_zone_rules(self, file_path: str) -> List[ZoneRule]:
        self.zone_rules = []
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        for zone_data in data.get('zones', []):
            rule = ZoneRule(
                zone_id=zone_data['zone_id'],
                zone_name=zone_data['zone_name'],
                description=zone_data['description'],
                latitude_min=float(zone_data['latitude_min']),
                latitude_max=float(zone_data['latitude_max']),
                longitude_min=float(zone_data['longitude_min']),
                longitude_max=float(zone_data['longitude_max']),
                max_discharge_volume=float(zone_data['max_discharge_volume']),
                is_prohibited=bool(zone_data['is_prohibited']),
                effective_from=self.parse_datetime(zone_data['effective_from']) if zone_data.get('effective_from') else None,
                effective_to=self.parse_datetime(zone_data['effective_to']) if zone_data.get('effective_to') else None
            )
            self.zone_rules.append(rule)
        
        return self.zone_rules
    
    def import_manual_records(self, file_path: str) -> List[ManualRecord]:
        self.manual_records = []
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for record_data in data.get('records', []):
            record = ManualRecord(
                record_id=record_data['record_id'],
                timestamp=self.parse_datetime(record_data['timestamp'], record_data.get('timezone', 'UTC')),
                tank_id=record_data['tank_id'],
                operation_type=record_data['operation_type'],
                volume=float(record_data['volume']),
                operator=record_data['operator'],
                pump_status=record_data['pump_status'],
                valve_status=record_data['valve_status'],
                notes=record_data['notes'],
                timezone=record_data.get('timezone', 'UTC')
            )
            self.manual_records.append(record)
        
        self.manual_records.sort(key=lambda x: x.timestamp)
        return self.manual_records
    
    def get_sensor_readings_by_tank(self) -> Dict[str, List[SensorReading]]:
        result = {}
        for reading in self.sensor_readings:
            if reading.tank_id not in result:
                result[reading.tank_id] = []
            result[reading.tank_id].append(reading)
        return result
    
    def get_manual_records_by_tank(self) -> Dict[str, List[ManualRecord]]:
        result = {}
        for record in self.manual_records:
            if record.tank_id not in result:
                result[record.tank_id] = []
            result[record.tank_id].append(record)
        return result
    
    def get_all_tanks(self) -> List[str]:
        tanks = set()
        for reading in self.sensor_readings:
            tanks.add(reading.tank_id)
        for record in self.manual_records:
            tanks.add(record.tank_id)
        return sorted(list(tanks))
