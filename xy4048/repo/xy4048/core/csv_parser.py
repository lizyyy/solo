import csv
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from config import CONFIG


@dataclass
class ParsedReading:
    device_id: str
    reading_time: datetime
    temperature: float
    box_number: str
    battery: Optional[float]
    raw_data: str
    row_number: int


@dataclass
class ParseResult:
    readings: List[ParsedReading]
    errors: List[Dict[str, Any]]
    total_rows: int
    valid_rows: int
    invalid_rows: int


class CSVFieldMapping(Enum):
    DEVICE_ID = ["设备号", "设备ID", "device_id", "deviceId", "DeviceID", "设备编号"]
    TIMESTAMP = ["时间戳", "时间", "timestamp", "Timestamp", "Time", "日期时间", "记录时间"]
    TEMPERATURE = ["温度", "temperature", "Temperature", "Temp", "温度值", "当前温度"]
    BOX_NUMBER = ["箱号", "箱号", "box_number", "boxNumber", "BoxID", "冷藏箱号"]
    BATTERY = ["电量", "电池", "battery", "Battery", "电量百分比", "电池电量"]


class TemperatureCSVParser:
    def __init__(self):
        self.config = CONFIG
        self.field_mappings = self._build_field_mappings()
    
    def _build_field_mappings(self) -> Dict[str, List[str]]:
        mappings = {}
        for mapping in CSVFieldMapping:
            mappings[mapping.name.lower()] = mapping.value
        return mappings
    
    def _detect_encoding(self, file_path: Path) -> str:
        encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'utf-8-sig', 'latin1']
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    f.read(1000)
                return encoding
            except (UnicodeDecodeError, UnicodeError):
                continue
        return 'utf-8'
    
    def _guess_delimiter(self, line: str) -> str:
        delimiters = [',', ';', '\t', '|']
        counts = {d: line.count(d) for d in delimiters}
        return max(counts, key=counts.get) if max(counts.values()) > 0 else ','
    
    def _parse_header(self, headers: List[str]) -> Dict[str, int]:
        column_map = {}
        headers_lower = [h.strip().lower() for h in headers]
        
        for field_name, possible_names in self.field_mappings.items():
            for possible in possible_names:
                possible_lower = possible.lower()
                for idx, header in enumerate(headers_lower):
                    if possible_lower in header or header in possible_lower:
                        column_map[field_name] = idx
                        break
                if field_name in column_map:
                    break
        
        return column_map
    
    def _parse_datetime(self, value: str) -> Optional[datetime]:
        if not value or not value.strip():
            return None
        
        value = value.strip()
        
        for fmt in self.config.date_formats:
            try:
                return datetime.strptime(value, fmt)
            except (ValueError, TypeError):
                continue
        
        try:
            if re.match(r'^\d{13}$', value):
                return datetime.fromtimestamp(int(value) / 1000)
            if re.match(r'^\d{10}$', value):
                return datetime.fromtimestamp(int(value))
        except (ValueError, TypeError):
            pass
        
        return None
    
    def _parse_temperature(self, value: str) -> Optional[float]:
        if not value or not value.strip():
            return None
        
        value = value.strip()
        
        value = re.sub(r'[°℃℉]', '', value).strip()
        
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _parse_battery(self, value: str) -> Optional[float]:
        if not value or not value.strip():
            return None
        
        value = value.strip()
        
        value = re.sub(r'[%]', '', value).strip()
        
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _get_column_value(self, row: List[str], column_map: Dict[str, int], field: str) -> str:
        if field in column_map and column_map[field] < len(row):
            return row[column_map[field]].strip()
        return ""
    
    def parse(self, file_path: Path) -> ParseResult:
        readings: List[ParsedReading] = []
        errors: List[Dict[str, Any]] = []
        total_rows = 0
        valid_rows = 0
        invalid_rows = 0
        
        encoding = self._detect_encoding(file_path)
        
        try:
            with open(file_path, 'r', encoding=encoding, newline='') as f:
                content = f.read()
                
                lines = content.splitlines()
                if not lines:
                    return ParseResult(
                        readings=[],
                        errors=[{"row": 0, "reason": "空文件"}],
                        total_rows=0,
                        valid_rows=0,
                        invalid_rows=0
                    )
                
                first_line = lines[0] if lines else ""
                delimiter = self._guess_delimiter(first_line)
                
                f.seek(0)
                reader = csv.reader(f, delimiter=delimiter)
                
                try:
                    headers = next(reader)
                except StopIteration:
                    return ParseResult(
                        readings=[],
                        errors=[{"row": 0, "reason": "无法读取表头"}],
                        total_rows=0,
                        valid_rows=0,
                        invalid_rows=0
                    )
                
                column_map = self._parse_header(headers)
                
                required_fields = ['device_id', 'timestamp', 'temperature']
                missing_fields = [f for f in required_fields if f not in column_map]
                
                if missing_fields:
                    field_names = {
                        'device_id': '设备号',
                        'timestamp': '时间戳',
                        'temperature': '温度'
                    }
                    errors.append({
                        "row": 0,
                        "reason": f"缺少必要字段: {', '.join([field_names[f] for f in missing_fields])}",
                        "category": "格式错误"
                    })
                    return ParseResult(
                        readings=[],
                        errors=errors,
                        total_rows=0,
                        valid_rows=0,
                        invalid_rows=0
                    )
                
                for row_number, row in enumerate(reader, start=2):
                    total_rows += 1
                    
                    try:
                        raw_data = delimiter.join(row)
                        
                        device_id = self._get_column_value(row, column_map, 'device_id')
                        timestamp_str = self._get_column_value(row, column_map, 'timestamp')
                        temperature_str = self._get_column_value(row, column_map, 'temperature')
                        box_number = self._get_column_value(row, column_map, 'box_number')
                        battery_str = self._get_column_value(row, column_map, 'battery')
                        
                        if not device_id:
                            errors.append({
                                "row": row_number,
                                "reason": "设备号为空",
                                "raw_data": raw_data,
                                "category": "数据缺失"
                            })
                            invalid_rows += 1
                            continue
                        
                        reading_time = self._parse_datetime(timestamp_str)
                        if reading_time is None:
                            errors.append({
                                "row": row_number,
                                "reason": f"无法解析时间戳: {timestamp_str}",
                                "raw_data": raw_data,
                                "category": "格式错误"
                            })
                            invalid_rows += 1
                            continue
                        
                        temperature = self._parse_temperature(temperature_str)
                        if temperature is None:
                            errors.append({
                                "row": row_number,
                                "reason": f"无法解析温度值: {temperature_str}",
                                "raw_data": raw_data,
                                "category": "格式错误"
                            })
                            invalid_rows += 1
                            continue
                        
                        battery = self._parse_battery(battery_str) if battery_str else None
                        
                        reading = ParsedReading(
                            device_id=device_id,
                            reading_time=reading_time,
                            temperature=temperature,
                            box_number=box_number,
                            battery=battery,
                            raw_data=raw_data,
                            row_number=row_number
                        )
                        
                        readings.append(reading)
                        valid_rows += 1
                        
                    except Exception as e:
                        errors.append({
                            "row": row_number,
                            "reason": f"解析错误: {str(e)}",
                            "raw_data": delimiter.join(row) if row else "",
                            "category": "解析异常"
                        })
                        invalid_rows += 1
                        continue
                        
        except Exception as e:
            errors.append({
                "row": 0,
                "reason": f"文件读取错误: {str(e)}",
                "category": "文件错误"
            })
        
        return ParseResult(
            readings=readings,
            errors=errors,
            total_rows=total_rows,
            valid_rows=valid_rows,
            invalid_rows=invalid_rows
        )
    
    def parse_pharmacy_csv(self, file_path: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        tasks = []
        errors = []
        
        encoding = self._detect_encoding(file_path)
        
        try:
            with open(file_path, 'r', encoding=encoding, newline='') as f:
                first_line = f.readline()
                delimiter = self._guess_delimiter(first_line)
                
                f.seek(0)
                reader = csv.DictReader(f, delimiter=delimiter)
                
                for row_number, row in enumerate(reader, start=2):
                    try:
                        task = {
                            'task_number': row.get('任务编号', row.get('task_number', '')).strip(),
                            'cooler_box_number': row.get('冷藏箱号', row.get('box_number', '')).strip(),
                            'drug_batch_number': row.get('药品批号', row.get('batch_number', '')).strip(),
                            'drug_name': row.get('药品名称', row.get('drug_name', '')).strip(),
                            'quantity': int(row.get('数量', row.get('quantity', '0')).strip() or '0'),
                            'unit': row.get('单位', row.get('unit', '支')).strip() or '支',
                            'pharmacist': row.get('药师', row.get('pharmacist', '')).strip(),
                            'courier': row.get('配送员', row.get('courier', '')).strip(),
                            'delivery_point': row.get('收货点', row.get('delivery_point', '')).strip(),
                            'route': row.get('路线', row.get('route', '')).strip(),
                            'notes': row.get('备注', row.get('notes', '')).strip(),
                        }
                        
                        if not task['task_number']:
                            errors.append({
                                'row': row_number,
                                'reason': '任务编号为空',
                                'data': dict(row)
                            })
                            continue
                        
                        tasks.append(task)
                        
                    except Exception as e:
                        errors.append({
                            'row': row_number,
                            'reason': f'解析错误: {str(e)}',
                            'data': dict(row)
                        })
                        
        except Exception as e:
            errors.append({
                'row': 0,
                'reason': f'文件读取错误: {str(e)}'
            })
        
        return tasks, errors
