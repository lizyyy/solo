"""CSV 解析模块"""

import csv
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from rov_tension_checker.data_import.unit_converters import (
    UnitConverter,
    parse_depth,
    parse_length,
    parse_speed,
)
from rov_tension_checker.data_import.validators import (
    DataValidator,
    ValidationError,
    ValidationResult,
)


@dataclass
class ParsedData:
    data_type: str
    valid_rows: List[Dict[str, Any]]
    invalid_rows: List[Dict[str, Any]]
    errors: List[ValidationError]
    source_file: str
    parse_time: datetime
    
    @property
    def total_rows(self) -> int:
        return len(self.valid_rows) + len(self.invalid_rows)
    
    @property
    def valid_count(self) -> int:
        return len(self.valid_rows)
    
    @property
    def invalid_count(self) -> int:
        return len(self.invalid_rows)
    
    def to_quarantine_dict(self) -> Dict[str, Any]:
        return {
            "source_file": self.source_file,
            "parse_time": self.parse_time.isoformat(),
            "data_type": self.data_type,
            "total_rows": self.total_rows,
            "valid_count": self.valid_count,
            "invalid_count": self.invalid_count,
            "invalid_rows": self.invalid_rows,
            "errors": [
                {
                    "row_index": e.row_index,
                    "error_type": e.error_type.value,
                    "field_name": e.field_name,
                    "value": str(e.value) if e.value else None,
                    "message": e.message
                }
                for e in self.errors
            ]
        }


class CSVParser:
    FIELD_MAPPINGS = {
        "track": {
            "timestamp": ["timestamp", "time", "datetime", "date_time", "ts"],
            "latitude": ["latitude", "lat", "gps_lat", "gps_latitude"],
            "longitude": ["longitude", "lon", "lng", "gps_lon", "gps_longitude"],
            "x": ["x", "local_x", "x_coord", "coord_x"],
            "y": ["y", "local_y", "y_coord", "coord_y"],
            "heading": ["heading", "hdg", "bow", "vessel_heading"],
            "speed": ["speed", "spd", "vessel_speed", "sog", "speed_over_ground"],
        },
        "rov_telemetry": {
            "timestamp": ["timestamp", "time", "datetime", "date_time", "ts"],
            "depth": ["depth", "dep", "rov_depth", "d"],
            "cable_length": ["cable_length", "cable_len", "umbilical_length", "out_length", "payed_out"],
            "heading": ["heading", "hdg", "rov_heading"],
            "thrust_forward": ["thrust_forward", "forward_thrust", "thrust_x", "thrust_h"],
            "thrust_vertical": ["thrust_vertical", "vertical_thrust", "thrust_z", "thrust_v"],
            "thrust_total": ["thrust_total", "total_thrust", "thrust"],
            "altitude": ["altitude", "alt", "seabed_distance", "height"],
        },
        "current_profile": {
            "depth_from": ["depth_from", "start_depth", "depth_start", "from_depth"],
            "depth_to": ["depth_to", "end_depth", "depth_end", "to_depth"],
            "speed": ["speed", "current_speed", "velocity", "curr_speed"],
            "direction": ["direction", "dir", "current_dir", "current_direction"],
            "depth": ["depth", "dep", "d"],
        }
    }
    
    def __init__(self):
        self.validator = DataValidator()
    
    def normalize_row(
        self,
        row: Dict[str, Any],
        data_type: str
    ) -> Dict[str, Any]:
        mapping = self.FIELD_MAPPINGS.get(data_type, {})
        normalized = {}
        
        for standard_field, possible_fields in mapping.items():
            for possible_field in possible_fields:
                possible_field_lower = possible_field.lower()
                if possible_field_lower in row:
                    value = row[possible_field_lower]
                    if value is not None and value != '':
                        normalized[standard_field] = value
                        break
        
        for key, value in row.items():
            key_lower = key.lower()
            if key_lower not in [
                f for fields in mapping.values() for f in fields
            ]:
                normalized[key] = value
        
        return normalized
    
    def convert_units(
        self,
        row: Dict[str, Any],
        data_type: str
    ) -> Dict[str, Any]:
        converted = row.copy()
        
        if data_type == "track":
            if 'speed' in converted and converted['speed'] is not None:
                converted['speed'] = parse_speed(str(converted['speed']))
            if 'heading' in converted and converted['heading'] is not None:
                try:
                    converted['heading'] = float(converted['heading'])
                    if converted['heading'] < 0:
                        converted['heading'] += 360
                except (ValueError, TypeError):
                    pass
        
        elif data_type == "rov_telemetry":
            if 'depth' in converted and converted['depth'] is not None:
                converted['depth'] = parse_depth(str(converted['depth']))
            if 'cable_length' in converted and converted['cable_length'] is not None:
                converted['cable_length'] = parse_length(str(converted['cable_length']))
            if 'altitude' in converted and converted['altitude'] is not None:
                converted['altitude'] = parse_length(str(converted['altitude']))
        
        elif data_type == "current_profile":
            if 'speed' in converted and converted['speed'] is not None:
                converted['speed'] = parse_speed(str(converted['speed']))
            if 'direction' in converted and converted['direction'] is not None:
                try:
                    d = float(converted['direction'])
                    while d < 0:
                        d += 360
                    while d >= 360:
                        d -= 360
                    converted['direction'] = d
                except (ValueError, TypeError):
                    pass
        
        return converted
    
    def parse_file(
        self,
        file_path: str,
        data_type: str,
        encoding: str = 'utf-8'
    ) -> ParsedData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        rows: List[Dict[str, Any]] = []
        
        try:
            with open(path, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cleaned_row = {k.strip(): v.strip() if v else v for k, v in row.items()}
                    rows.append(cleaned_row)
        except UnicodeDecodeError:
            with open(path, 'r', encoding='gbk') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cleaned_row = {k.strip(): v.strip() if v else v for k, v in row.items()}
                    rows.append(cleaned_row)
        
        normalized_rows = [
            self.normalize_row(row, data_type)
            for row in rows
        ]
        
        converted_rows = [
            self.convert_units(row, data_type)
            for row in normalized_rows
        ]
        
        if data_type == "track":
            validation_result = self.validator.validate_track_data(converted_rows)
        elif data_type == "rov_telemetry":
            validation_result = self.validator.validate_rov_telemetry(converted_rows)
        elif data_type == "current_profile":
            validation_result = self.validator.validate_current_profile(converted_rows)
        else:
            validation_result = ValidationResult(
                valid_rows=converted_rows,
                errors=[]
            )
        
        return ParsedData(
            data_type=data_type,
            valid_rows=validation_result.valid_rows,
            invalid_rows=validation_result.invalid_rows,
            errors=validation_result.errors,
            source_file=file_path,
            parse_time=datetime.now()
        )
    
    def parse_track(self, file_path: str) -> ParsedData:
        return self.parse_file(file_path, "track")
    
    def parse_rov_telemetry(self, file_path: str) -> ParsedData:
        return self.parse_file(file_path, "rov_telemetry")
    
    def parse_current_profile(self, file_path: str) -> ParsedData:
        return self.parse_file(file_path, "current_profile")


def save_quarantine(
    parsed_data: ParsedData,
    quarantine_path: Path
) -> Path:
    quarantine_data = parsed_data.to_quarantine_dict()
    filename = f"quarantine_{parsed_data.data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    output_path = quarantine_path / filename
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(quarantine_data, f, ensure_ascii=False, indent=2)
    
    return output_path
