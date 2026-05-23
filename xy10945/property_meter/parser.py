import csv
from pathlib import Path
from typing import Optional, Tuple
from .models import MeterRecord, ValidationError, ErrorType, MeterType


def parse_numeric(value: str) -> Optional[float]:
    if not value or value.strip() == "":
        return None
    cleaned = value.strip().replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


class CSVParser:
    REQUIRED_FIELDS = ["住户", "表号", "上月读数", "本月读数"]
    OPTIONAL_FIELDS = ["倍率", "表类型"]
    
    def __init__(self, encoding: str = "utf-8", delimiter: str = ","):
        self.encoding = encoding
        self.delimiter = delimiter
    
    def parse(self, file_path: str) -> Tuple[list, list]:
        records = []
        errors = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"输入文件不存在: {file_path}")
        
        with open(path, "r", encoding=self.encoding, errors="replace") as f:
            reader = csv.DictReader(f, delimiter=self.delimiter)
            actual_fields = reader.fieldnames or []
            
            if not all(f in actual_fields for f in self.REQUIRED_FIELDS):
                missing = [f for f in self.REQUIRED_FIELDS if f not in actual_fields]
                raise ValueError(f"CSV 缺少必要列: {', '.join(missing)}")
            
            for row_num, row in enumerate(reader, start=2):
                raw_data = dict(row)
                record, error = self._parse_row(row_num, raw_data)
                
                if error:
                    errors.append(error)
                if record:
                    records.append(record)
        
        return records, errors
    
    def _parse_row(self, row_num: int, raw_data: dict) -> Tuple[Optional[MeterRecord], Optional[ValidationError]]:
        household = raw_data.get("住户", "").strip()
        meter_number = raw_data.get("表号", "").strip()
        
        if not household:
            return None, ValidationError(
                row_number=row_num,
                error_type=ErrorType.MISSING_FIELD,
                field_name="住户",
                message="住户名称不能为空",
                raw_data=raw_data
            )
        
        if not meter_number:
            return None, ValidationError(
                row_number=row_num,
                error_type=ErrorType.MISSING_FIELD,
                field_name="表号",
                message="表号不能为空",
                raw_data=raw_data
            )
        
        prev_reading_str = raw_data.get("上月读数", "")
        curr_reading_str = raw_data.get("本月读数", "")
        
        prev_reading = parse_numeric(prev_reading_str)
        curr_reading = parse_numeric(curr_reading_str)
        
        if prev_reading is None and prev_reading_str.strip():
            return None, ValidationError(
                row_number=row_num,
                error_type=ErrorType.INVALID_NUMBER,
                field_name="上月读数",
                message=f"上月读数值无效: {prev_reading_str}",
                raw_data=raw_data
            )
        
        if curr_reading is None and curr_reading_str.strip():
            return None, ValidationError(
                row_number=row_num,
                error_type=ErrorType.INVALID_NUMBER,
                field_name="本月读数",
                message=f"本月读数值无效: {curr_reading_str}",
                raw_data=raw_data
            )
        
        if prev_reading is not None and prev_reading < 0:
            return None, ValidationError(
                row_number=row_num,
                error_type=ErrorType.NEGATIVE_READING,
                field_name="上月读数",
                message=f"上月读数不能为负数: {prev_reading}",
                raw_data=raw_data
            )
        
        if curr_reading is not None and curr_reading < 0:
            return None, ValidationError(
                row_number=row_num,
                error_type=ErrorType.NEGATIVE_READING,
                field_name="本月读数",
                message=f"本月读数不能为负数: {curr_reading}",
                raw_data=raw_data
            )
        
        if prev_reading is not None and curr_reading is not None:
            if curr_reading < prev_reading:
                return None, ValidationError(
                    row_number=row_num,
                    error_type=ErrorType.READING_DECREASED,
                    message=f"本月读数小于上月读数 ({curr_reading} < {prev_reading})",
                    raw_data=raw_data
                )
        
        multiplier_str = raw_data.get("倍率", "1")
        multiplier_raw = multiplier_str.strip() if multiplier_str else ""
        
        if multiplier_raw:
            multiplier = parse_numeric(multiplier_str)
            if multiplier is None:
                return None, ValidationError(
                    row_number=row_num,
                    error_type=ErrorType.INVALID_NUMBER,
                    field_name="倍率",
                    message=f"倍率值无效: {multiplier_str}",
                    raw_data=raw_data
                )
            if multiplier <= 0:
                return None, ValidationError(
                    row_number=row_num,
                    error_type=ErrorType.NEGATIVE_READING,
                    field_name="倍率",
                    message=f"倍率必须大于0: {multiplier}",
                    raw_data=raw_data
                )
        else:
            multiplier = 1.0
        
        meter_type_str = raw_data.get("表类型", "electric").lower()
        meter_type = MeterType.ELECTRIC
        if meter_type_str in ["水", "water", "w"]:
            meter_type = MeterType.WATER
        
        record = MeterRecord(
            row_number=row_num,
            household=household,
            meter_number=meter_number,
            meter_type=meter_type,
            previous_reading=prev_reading,
            current_reading=curr_reading,
            multiplier=multiplier,
            raw_data=raw_data
        )
        
        if prev_reading is None or curr_reading is None:
            error = ValidationError(
                row_number=row_num,
                error_type=ErrorType.MISSING_FIELD,
                message="缺少上月读数或本月读数",
                raw_data=raw_data
            )
            return record, error
        
        return record, None


def load_reference_meters(file_path: str) -> set:
    path = Path(file_path)
    meters = set()
    
    if not path.exists():
        return meters
    
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            meter_num = row.get("表号", "").strip()
            if meter_num:
                meters.add(meter_num)
    
    return meters
