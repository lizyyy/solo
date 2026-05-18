import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Union


class SeatDataParser:
    def __init__(self):
        self.supported_formats = ['.csv', '.json']

    def parse(self, file_path: str) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        suffix = path.suffix.lower()
        if suffix not in self.supported_formats:
            raise ValueError(f"不支持的文件格式: {suffix}，支持格式: {self.supported_formats}")

        try:
            if suffix == '.csv':
                return self._parse_csv(path)
            elif suffix == '.json':
                return self._parse_json(path)
        except Exception as e:
            raise RuntimeError(f"解析文件失败: {str(e)}")

    def _parse_csv(self, path: Path) -> Dict[str, Any]:
        seats = []
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                seat = self._normalize_seat_row(row)
                seats.append(seat)
        
        return {
            'source_file': str(path),
            'format': 'csv',
            'total_seats': len(seats),
            'seats': seats
        }

    def _parse_json(self, path: Path) -> Dict[str, Any]:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'seats' not in data:
            raise ValueError("JSON 文件缺少 'seats' 字段")
        
        seats = [self._normalize_seat_row(seat) for seat in data['seats']]
        
        return {
            'source_file': str(path),
            'format': 'json',
            'total_seats': len(seats),
            'seats': seats
        }

    def _normalize_seat_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        for key, value in row.items():
            normalized[key.strip()] = self._parse_value(value)
        return normalized

    def _parse_value(self, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            if value.lower() in ('true', 'yes', '是'):
                return True
            if value.lower() in ('false', 'no', '否'):
                return False
            if value.isdigit():
                return int(value)
            try:
                return float(value)
            except ValueError:
                pass
        return value
