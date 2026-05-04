import os
import csv
import json
import glob
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dateutil.parser import parse as parse_date

from database import Database


class DataImporter:
    TEMPERATURE_FIELDS = ['temperature', 'temp', 't', 'value', '摄氏温度', '温度']
    TIMESTAMP_FIELDS = ['timestamp', 'time', 'datetime', 'date', '记录时间', '时间']
    SENSOR_FIELDS = ['sensor_id', 'sensor', 'id', 'device', '传感器ID', '传感器']

    def __init__(self, db: Database, data_dir: str):
        self.db = db
        self.data_dir = data_dir
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def parse_timestamp(self, value: Any) -> str:
        if isinstance(value, (int, float)):
            if value > 1e12:
                value = value / 1000
            return datetime.fromtimestamp(value).isoformat()
        
        if isinstance(value, str):
            try:
                dt = parse_date(value)
                return dt.isoformat()
            except ValueError:
                pass
        
        return str(value)

    def parse_temperature(self, value: Any) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        
        if isinstance(value, str):
            value = value.strip()
            value = value.replace('℃', '').replace('°C', '').replace('°', '')
            try:
                return float(value)
            except ValueError:
                pass
        
        return 0.0

    def _find_field(self, row: Dict[str, Any], candidates: List[str]) -> Optional[str]:
        row_lower = {k.lower(): k for k in row.keys()}
        for candidate in candidates:
            if candidate.lower() in row_lower:
                return row_lower[candidate.lower()]
        return None

    def parse_csv_file(self, file_path: str) -> List[Dict[str, Any]]:
        records = []
        sensor_id_from_filename = self._extract_sensor_from_filename(file_path)
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        
        lines = content.strip().split('\n')
        if not lines:
            return records
        
        has_header = self._guess_has_header(lines[0])
        
        if has_header:
            reader = csv.DictReader(lines)
            for row in reader:
                record = self._parse_csv_row(row, sensor_id_from_filename)
                if record:
                    records.append(record)
        else:
            for line in lines:
                record = self._parse_simple_csv_line(line, sensor_id_from_filename)
                if record:
                    records.append(record)
        
        return records

    def _guess_has_header(self, first_line: str) -> bool:
        parts = first_line.split(',')
        if len(parts) < 2:
            return False
        
        for part in parts:
            part_lower = part.lower().strip()
            for field_list in [self.TEMPERATURE_FIELDS, self.TIMESTAMP_FIELDS, self.SENSOR_FIELDS]:
                if any(f.lower() in part_lower for f in field_list):
                    return True
        
        try:
            for part in parts:
                float(part.strip())
            return False
        except ValueError:
            pass
        
        return True

    def _parse_csv_row(self, row: Dict[str, Any], default_sensor: Optional[str]) -> Optional[Dict[str, Any]]:
        temp_field = self._find_field(row, self.TEMPERATURE_FIELDS)
        time_field = self._find_field(row, self.TIMESTAMP_FIELDS)
        sensor_field = self._find_field(row, self.SENSOR_FIELDS)

        if not temp_field or not time_field:
            return None

        sensor_id = row.get(sensor_field, default_sensor) if sensor_field else default_sensor
        if not sensor_id:
            return None

        try:
            return {
                'sensor_id': str(sensor_id).strip(),
                'timestamp': self.parse_timestamp(row[time_field]),
                'temperature': self.parse_temperature(row[temp_field])
            }
        except Exception:
            return None

    def _parse_simple_csv_line(self, line: str, default_sensor: Optional[str]) -> Optional[Dict[str, Any]]:
        if not default_sensor:
            return None
        
        parts = line.split(',')
        if len(parts) < 2:
            return None
        
        for i, part in enumerate(parts):
            try:
                temp = self.parse_temperature(part)
                for j, other_part in enumerate(parts):
                    if i != j:
                        try:
                            timestamp = self.parse_timestamp(other_part)
                            return {
                                'sensor_id': default_sensor,
                                'timestamp': timestamp,
                                'temperature': temp
                            }
                        except Exception:
                            continue
            except Exception:
                continue
        
        return None

    def parse_json_file(self, file_path: str) -> List[Dict[str, Any]]:
        records = []
        sensor_id_from_filename = self._extract_sensor_from_filename(file_path)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            for item in data:
                record = self._parse_json_item(item, sensor_id_from_filename)
                if record:
                    records.append(record)
        
        elif isinstance(data, dict):
            if 'records' in data or 'data' in data:
                key = 'records' if 'records' in data else 'data'
                sensor_id = data.get('sensor_id') or data.get('sensor') or sensor_id_from_filename
                for item in data[key]:
                    record = self._parse_json_item(item, sensor_id)
                    if record:
                        records.append(record)
            else:
                record = self._parse_json_item(data, sensor_id_from_filename)
                if record:
                    records.append(record)
        
        return records

    def _parse_json_item(self, item: Dict[str, Any], default_sensor: Optional[str]) -> Optional[Dict[str, Any]]:
        if not isinstance(item, dict):
            return None
        
        temp_field = self._find_field(item, self.TEMPERATURE_FIELDS)
        time_field = self._find_field(item, self.TIMESTAMP_FIELDS)
        sensor_field = self._find_field(item, self.SENSOR_FIELDS)

        if not temp_field or not time_field:
            return None

        sensor_id = item.get(sensor_field, default_sensor) if sensor_field else default_sensor
        if not sensor_id:
            return None

        try:
            return {
                'sensor_id': str(sensor_id).strip(),
                'timestamp': self.parse_timestamp(item[time_field]),
                'temperature': self.parse_temperature(item[temp_field])
            }
        except Exception:
            return None

    def _extract_sensor_from_filename(self, file_path: str) -> Optional[str]:
        filename = os.path.basename(file_path)
        name, _ = os.path.splitext(filename)
        
        name = name.replace('_', '-').replace(' ', '-')
        parts = name.split('-')
        
        for part in parts:
            part_upper = part.upper()
            if part_upper.startswith('SENSOR') or part_upper.startswith('SENS'):
                return part
            if part.isdigit():
                continue
        
        return None

    def get_files_to_import(self) -> List[str]:
        files = []
        
        csv_pattern = os.path.join(self.data_dir, '**', '*.csv')
        json_pattern = os.path.join(self.data_dir, '**', '*.json')
        
        files.extend(glob.glob(csv_pattern, recursive=True))
        files.extend(glob.glob(json_pattern, recursive=True))
        
        files.sort(key=lambda f: os.path.getmtime(f))
        
        return files

    def import_file(self, file_path: str) -> Tuple[int, int]:
        if self.db.is_file_imported(file_path):
            return (0, 0)
        
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        try:
            if ext == '.csv':
                records = self.parse_csv_file(file_path)
            elif ext == '.json':
                records = self.parse_json_file(file_path)
            else:
                return (0, 0)
            
            total_records = len(records)
            inserted_count = self.db.insert_temperature_records(records)
            
            self.db.mark_file_imported(file_path, inserted_count)
            
            return (total_records, inserted_count)
            
        except Exception as e:
            print(f"Error importing {file_path}: {e}")
            return (0, 0)

    def import_all(self) -> Dict[str, Any]:
        files = self.get_files_to_import()
        results = {
            'total_files': len(files),
            'imported_files': 0,
            'total_records': 0,
            'inserted_records': 0,
            'files': []
        }
        
        for file_path in files:
            if self.db.is_file_imported(file_path):
                continue
            
            total, inserted = self.import_file(file_path)
            
            if total > 0 or inserted > 0:
                results['imported_files'] += 1
                results['total_records'] += total
                results['inserted_records'] += inserted
                results['files'].append({
                    'path': file_path,
                    'total_records': total,
                    'inserted_records': inserted
                })
        
        last_import_time = datetime.now().isoformat()
        self.db.set_import_state('last_import_time', last_import_time)
        results['last_import_time'] = last_import_time
        
        return results
