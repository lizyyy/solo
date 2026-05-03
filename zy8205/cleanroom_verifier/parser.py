import json
import csv
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Room:
    id: str
    name: str
    area: float
    height: float
    volume: float
    adjacent_rooms: List[str] = field(default_factory=list)
    classification: str = "Grade C"
    required_pressure_diff: float = 10.0
    required_ach: float = 20.0


@dataclass
class PressureReading:
    timestamp: datetime
    room_id: str
    pressure: float
    unit: str
    is_valid: bool = True


@dataclass
class AirflowSetpoint:
    room_id: str
    supply_air: float
    exhaust_air: float
    supply_unit: str = "m3/h"
    exhaust_unit: str = "m3/h"


@dataclass
class DoorEvent:
    timestamp: datetime
    room_id: str
    event_type: str
    duration: Optional[float] = None


class Parser:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.pressure_readings: List[PressureReading] = []
        self.airflow_setpoints: Dict[str, AirflowSetpoint] = {}
        self.door_events: List[DoorEvent] = []

    def parse_rooms(self, file_path: Path) -> Dict[str, Room]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        rooms = {}
        for room_data in data.get('rooms', []):
            room = Room(
                id=room_data['id'],
                name=room_data.get('name', room_data['id']),
                area=room_data['area'],
                height=room_data['height'],
                volume=room_data.get('volume', room_data['area'] * room_data['height']),
                adjacent_rooms=room_data.get('adjacent_rooms', []),
                classification=room_data.get('classification', 'Grade C'),
                required_pressure_diff=room_data.get('required_pressure_diff', 10.0),
                required_ach=room_data.get('required_ach', 20.0)
            )
            rooms[room.id] = room

        self.rooms = rooms
        return rooms

    def parse_pressure_readings(self, file_path: Path) -> List[PressureReading]:
        readings = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    timestamp = self._parse_timestamp(row.get('timestamp', row.get('time', '')))
                    room_id = row.get('room_id', row.get('room', ''))
                    pressure = self._safe_float(row.get('pressure', row.get('value', '')))
                    unit = row.get('unit', 'Pa')
                    is_valid = self._is_valid_reading(row)

                    if room_id and pressure is not None:
                        readings.append(PressureReading(
                            timestamp=timestamp,
                            room_id=room_id,
                            pressure=pressure,
                            unit=unit,
                            is_valid=is_valid
                        ))
                except (ValueError, KeyError) as e:
                    continue

        self.pressure_readings = readings
        return readings

    def parse_airflow_setpoints(self, file_path: Path) -> Dict[str, AirflowSetpoint]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        setpoints = {}
        for room_id, airflow_data in data.get('setpoints', {}).items():
            setpoint = AirflowSetpoint(
                room_id=room_id,
                supply_air=airflow_data.get('supply_air', airflow_data.get('supply', 0)),
                exhaust_air=airflow_data.get('exhaust_air', airflow_data.get('exhaust', 0)),
                supply_unit=airflow_data.get('supply_unit', 'm3/h'),
                exhaust_unit=airflow_data.get('exhaust_unit', 'm3/h')
            )
            setpoints[room_id] = setpoint

        self.airflow_setpoints = setpoints
        return setpoints

    def parse_door_events(self, file_path: Path) -> List[DoorEvent]:
        events = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    timestamp = self._parse_timestamp(data.get('timestamp', data.get('time', '')))
                    room_id = data.get('room_id', data.get('room', ''))
                    event_type = data.get('event_type', data.get('type', 'unknown'))
                    duration = data.get('duration')

                    if room_id:
                        events.append(DoorEvent(
                            timestamp=timestamp,
                            room_id=room_id,
                            event_type=event_type,
                            duration=duration
                        ))
                except json.JSONDecodeError:
                    continue

        self.door_events = events
        return events

    def _parse_timestamp(self, ts: str) -> datetime:
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%dT%H:%M',
        ]
        for fmt in formats:
            try:
                return datetime.strptime(ts.strip(), fmt)
            except ValueError:
                continue
        return datetime.now()

    def _safe_float(self, value: str) -> Optional[float]:
        if not value or value.strip() == '':
            return None
        try:
            return float(value.strip())
        except ValueError:
            return None

    def _is_valid_reading(self, row: Dict[str, Any]) -> bool:
        status = row.get('status', '').lower()
        is_valid = row.get('is_valid', row.get('valid', 'true'))
        
        if status in ['error', 'fault', 'invalid']:
            return False
        if isinstance(is_valid, bool):
            return is_valid
        if isinstance(is_valid, str):
            return is_valid.lower() not in ['false', '0', 'no', 'invalid']
        return True

    def parse_all(self, rooms_path: Path, pressure_path: Path, 
                  airflow_path: Path, door_path: Path) -> Dict[str, Any]:
        return {
            'rooms': self.parse_rooms(rooms_path),
            'pressure_readings': self.parse_pressure_readings(pressure_path),
            'airflow_setpoints': self.parse_airflow_setpoints(airflow_path),
            'door_events': self.parse_door_events(door_path)
        }
