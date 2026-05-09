import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
from pathlib import Path

from .models import TollRecord, VehicleType, AuditStatus


class DataLoader:
    REQUIRED_FIELDS = [
        "record_id", "plate_number", "entry_station", "exit_station",
        "entry_time", "exit_time", "vehicle_type", "weight", "toll_amount"
    ]
    
    def __init__(self):
        self.invalid_records: List[Dict[str, Any]] = []
        self.duplicate_records: List[Dict[str, Any]] = []
        self.loaded_ids: set = set()
    
    def load_file(self, file_path: str) -> Tuple[List[TollRecord], Dict[str, Any]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        if path.suffix.lower() == ".csv":
            return self._load_csv(file_path)
        elif path.suffix.lower() == ".json":
            return self._load_json(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")
    
    def _load_csv(self, file_path: str) -> Tuple[List[TollRecord], Dict[str, Any]]:
        records: List[TollRecord] = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for line_num, row in enumerate(reader, start=2):
                try:
                    if not self._validate_required_fields(row, line_num):
                        continue
                    
                    if not self._check_duplicate(row, line_num):
                        continue
                    
                    record = self._parse_record(row)
                    if record:
                        records.append(record)
                        self.loaded_ids.add(record.record_id)
                except Exception as e:
                    self.invalid_records.append({
                        "line": line_num,
                        "error": str(e),
                        "data": row
                    })
        
        return records, self._get_stats(len(reader.fieldnames) if reader else 0)
    
    def _load_json(self, file_path: str) -> Tuple[List[TollRecord], Dict[str, Any]]:
        records: List[TollRecord] = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            raise ValueError("JSON 格式错误：期望是数组")
        
        for idx, item in enumerate(data):
            line_num = idx + 1
            try:
                if not self._validate_required_fields(item, line_num):
                    continue
                
                if not self._check_duplicate(item, line_num):
                    continue
                
                record = self._parse_record(item)
                if record:
                    records.append(record)
                    self.loaded_ids.add(record.record_id)
            except Exception as e:
                self.invalid_records.append({
                    "line": line_num,
                    "error": str(e),
                    "data": item
                })
        
        return records, self._get_stats(len(data))
    
    def _validate_required_fields(self, row: Dict[str, Any], line_num: int) -> bool:
        missing_fields = []
        for field in self.REQUIRED_FIELDS:
            if field not in row or row[field] is None or str(row[field]).strip() == "":
                missing_fields.append(field)
        
        if missing_fields:
            self.invalid_records.append({
                "line": line_num,
                "error": f"缺少必填字段: {', '.join(missing_fields)}",
                "data": row
            })
            return False
        
        return True
    
    def _check_duplicate(self, row: Dict[str, Any], line_num: int) -> bool:
        record_id = str(row.get("record_id", "")).strip()
        if record_id in self.loaded_ids:
            self.duplicate_records.append({
                "line": line_num,
                "error": f"重复的记录ID: {record_id}",
                "data": row
            })
            return False
        return True
    
    def _parse_record(self, row: Dict[str, Any]) -> TollRecord:
        try:
            return TollRecord(
                record_id=str(row["record_id"]).strip(),
                plate_number=str(row["plate_number"]).strip(),
                entry_station=str(row["entry_station"]).strip(),
                exit_station=str(row["exit_station"]).strip(),
                entry_time=datetime.fromisoformat(str(row["entry_time"]).replace(' ', 'T')),
                exit_time=datetime.fromisoformat(str(row["exit_time"]).replace(' ', 'T')),
                vehicle_type=self._parse_vehicle_type(row["vehicle_type"]),
                weight=float(row["weight"]),
                toll_amount=float(row["toll_amount"]),
                is_etc=bool(row.get("is_etc", False)),
                status=AuditStatus.PENDING,
                issues=[],
                raw_data=row
            )
        except Exception as e:
            raise ValueError(f"解析记录失败: {e}")
    
    def _parse_vehicle_type(self, value: str) -> VehicleType:
        value = str(value).strip()
        
        type_mapping = {
            "1型客车": VehicleType.TYPE_1,
            "2型客车": VehicleType.TYPE_2,
            "3型客车": VehicleType.TYPE_3,
            "4型客车": VehicleType.TYPE_4,
            "1型货车": VehicleType.TYPE_5,
            "2型货车": VehicleType.TYPE_6,
            "3型货车": VehicleType.TYPE_7,
            "4型货车": VehicleType.TYPE_8,
            "5型货车": VehicleType.TYPE_9,
            "6型货车": VehicleType.TYPE_10,
            "TYPE_1": VehicleType.TYPE_1,
            "TYPE_2": VehicleType.TYPE_2,
            "TYPE_3": VehicleType.TYPE_3,
            "TYPE_4": VehicleType.TYPE_4,
            "TYPE_5": VehicleType.TYPE_5,
            "TYPE_6": VehicleType.TYPE_6,
            "TYPE_7": VehicleType.TYPE_7,
            "TYPE_8": VehicleType.TYPE_8,
            "TYPE_9": VehicleType.TYPE_9,
            "TYPE_10": VehicleType.TYPE_10,
            "1": VehicleType.TYPE_1,
            "2": VehicleType.TYPE_2,
            "3": VehicleType.TYPE_3,
            "4": VehicleType.TYPE_4,
            "5": VehicleType.TYPE_5,
            "6": VehicleType.TYPE_6,
            "7": VehicleType.TYPE_7,
            "8": VehicleType.TYPE_8,
            "9": VehicleType.TYPE_9,
            "10": VehicleType.TYPE_10,
        }
        
        return type_mapping.get(value, VehicleType.UNKNOWN)
    
    def _get_stats(self, total_lines: int) -> Dict[str, Any]:
        return {
            "total_lines": total_lines,
            "valid_records": len(self.loaded_ids),
            "invalid_records": len(self.invalid_records),
            "duplicate_records": len(self.duplicate_records),
            "invalid_details": self.invalid_records,
            "duplicate_details": self.duplicate_records
        }
