import json
import csv
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import re


@dataclass
class SensorRecord:
    timestamp: str
    sensor_id: str
    location: str
    heat_release_rate: Optional[float] = None
    temperature: Optional[float] = None
    co_concentration: Optional[float] = None
    smoke_opacity: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)
    source: str = "sensor"


@dataclass
class EquipmentParams:
    fan_id: str
    fan_power: float
    rated_airflow: float
    operational_status: str
    last_maintenance: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OnSiteNote:
    timestamp: str
    author: str
    content: str
    category: str = "general"
    manual_corrections: Dict[str, Any] = field(default_factory=dict)
    is_manual_correction: bool = False


@dataclass
class ImportedData:
    sensor_records: List[SensorRecord]
    equipment_params: List[EquipmentParams]
    on_site_notes: List[OnSiteNote]
    raw_wechat_messages: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class DataImporter:
    def __init__(self):
        self.imported_data = ImportedData([], [], [])

    def parse_wechat_message(self, message: str) -> Optional[OnSiteNote]:
        self.imported_data.raw_wechat_messages.append(message)

        patterns = [
            r'(?P<time>\d{2}:\d{2}|\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})',
            r'HRR[：:]\s*(?P<hrr>[\d.]+)',
            r'CO[：:]\s*(?P<co>[\d.]+)',
            r'温度[：:]\s*(?P<temp>[\d.]+)',
            r'风速[：:]\s*(?P<wind>[\d.]+)',
            r'风向[：:]\s*(?P<dir>[正负+-]|up|down|in|out)',
            r'修正[：:]\s*(?P<correction>.+)',
        ]

        extracted = {}
        for pattern in patterns:
            match = re.search(pattern, message)
            if match:
                extracted.update(match.groupdict())

        timestamp = extracted.get('time', datetime.now().strftime('%Y-%m-%d %H:%M'))
        author = "微信群用户"

        manual_corrections = {}
        if 'hrr' in extracted:
            manual_corrections['heat_release_rate'] = float(extracted['hrr'])
        if 'co' in extracted:
            manual_corrections['co_concentration'] = float(extracted['co'])
        if 'temp' in extracted:
            manual_corrections['temperature'] = float(extracted['temp'])
        if 'wind' in extracted:
            manual_corrections['wind_speed'] = float(extracted['wind'])
        if 'dir' in extracted:
            manual_corrections['wind_direction'] = extracted['dir']

        is_manual = bool(manual_corrections) or '修正' in message or '人工' in message

        note = OnSiteNote(
            timestamp=timestamp,
            author=author,
            content=message,
            category="wechat" if "微信群" in message else "field",
            manual_corrections=manual_corrections,
            is_manual_correction=is_manual
        )

        return note

    def import_json(self, file_path: str) -> ImportedData:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if 'sensor_records' in data:
            for record in data['sensor_records']:
                sensor = SensorRecord(
                    timestamp=record.get('timestamp', ''),
                    sensor_id=record.get('sensor_id', ''),
                    location=record.get('location', ''),
                    heat_release_rate=record.get('heat_release_rate'),
                    temperature=record.get('temperature'),
                    co_concentration=record.get('co_concentration'),
                    smoke_opacity=record.get('smoke_opacity'),
                    wind_speed=record.get('wind_speed'),
                    wind_direction=record.get('wind_direction'),
                    raw_data=record,
                    source="json_import"
                )
                self.imported_data.sensor_records.append(sensor)

        if 'equipment_params' in data:
            for equip in data['equipment_params']:
                eq = EquipmentParams(
                    fan_id=equip.get('fan_id', ''),
                    fan_power=equip.get('fan_power', 0),
                    rated_airflow=equip.get('rated_airflow', 0),
                    operational_status=equip.get('operational_status', 'unknown'),
                    last_maintenance=equip.get('last_maintenance'),
                    notes=equip.get('notes', []),
                    raw_data=equip
                )
                self.imported_data.equipment_params.append(eq)

        if 'on_site_notes' in data:
            for note in data['on_site_notes']:
                on_site = OnSiteNote(
                    timestamp=note.get('timestamp', ''),
                    author=note.get('author', ''),
                    content=note.get('content', ''),
                    category=note.get('category', 'general'),
                    manual_corrections=note.get('manual_corrections', {}),
                    is_manual_correction=note.get('is_manual_correction', False)
                )
                self.imported_data.on_site_notes.append(on_site)

        if 'wechat_messages' in data:
            for msg in data['wechat_messages']:
                note = self.parse_wechat_message(msg)
                if note:
                    self.imported_data.on_site_notes.append(note)

        self.imported_data.metadata['import_time'] = datetime.now().isoformat()
        self.imported_data.metadata['source_file'] = file_path

        return self.imported_data

    def import_csv(self, file_path: str, data_type: str = "sensor") -> ImportedData:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if data_type == "sensor":
                    sensor = SensorRecord(
                        timestamp=row.get('timestamp', row.get('time', '')),
                        sensor_id=row.get('sensor_id', row.get('id', '')),
                        location=row.get('location', row.get('loc', '')),
                        heat_release_rate=self._safe_float(row.get('heat_release_rate', row.get('hrr'))),
                        temperature=self._safe_float(row.get('temperature', row.get('temp'))),
                        co_concentration=self._safe_float(row.get('co_concentration', row.get('co'))),
                        smoke_opacity=self._safe_float(row.get('smoke_opacity', row.get('opacity'))),
                        wind_speed=self._safe_float(row.get('wind_speed', row.get('wind'))),
                        wind_direction=row.get('wind_direction', row.get('direction')),
                        raw_data=dict(row),
                        source="csv_import"
                    )
                    self.imported_data.sensor_records.append(sensor)
                elif data_type == "equipment":
                    eq = EquipmentParams(
                        fan_id=row.get('fan_id', row.get('id', '')),
                        fan_power=self._safe_float(row.get('fan_power', row.get('power'), 0)),
                        rated_airflow=self._safe_float(row.get('rated_airflow', row.get('airflow'), 0)),
                        operational_status=row.get('operational_status', row.get('status', 'unknown')),
                        last_maintenance=row.get('last_maintenance'),
                        notes=[row.get('notes', '')] if row.get('notes') else [],
                        raw_data=dict(row)
                    )
                    self.imported_data.equipment_params.append(eq)

        return self.imported_data

    def import_wechat_messages(self, messages: List[str]) -> ImportedData:
        for msg in messages:
            note = self.parse_wechat_message(msg)
            if note:
                self.imported_data.on_site_notes.append(note)

        return self.imported_data

    @staticmethod
    def _safe_float(value: Optional[str], default: float = None) -> Optional[float]:
        if value is None or value == '':
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default

    def merge_data(self) -> ImportedData:
        for note in self.imported_data.on_site_notes:
            if note.is_manual_correction and note.manual_corrections:
                for sensor in self.imported_data.sensor_records:
                    if note.timestamp in sensor.timestamp or sensor.timestamp in note.timestamp:
                        for key, value in note.manual_corrections.items():
                            if hasattr(sensor, key):
                                setattr(sensor, key, value)

        return self.imported_data

    def get_import_summary(self) -> Dict[str, Any]:
        return {
            'sensor_records_count': len(self.imported_data.sensor_records),
            'equipment_count': len(self.imported_data.equipment_params),
            'notes_count': len(self.imported_data.on_site_notes),
            'wechat_messages_count': len(self.imported_data.raw_wechat_messages),
            'manual_corrections_count': sum(1 for n in self.imported_data.on_site_notes if n.is_manual_correction),
            'metadata': self.imported_data.metadata
        }
