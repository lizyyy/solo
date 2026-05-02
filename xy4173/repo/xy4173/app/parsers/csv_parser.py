import csv
import io
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, TextIO

from app.parsers.base import BaseParser, ParseResult, ParseError


@dataclass
class ReservationImportRow:
    reservation_code: str
    instrument_code: Optional[str]
    user_id: Optional[str]
    user_name: Optional[str]
    group_code: Optional[str]
    start_time: datetime
    end_time: datetime
    purpose: Optional[str]
    status: str


@dataclass
class SwipeLogImportRow:
    swipe_code: Optional[str]
    card_number: str
    swipe_time: datetime
    instrument_code: Optional[str]
    user_id: Optional[str]
    user_name: Optional[str]
    reservation_code: Optional[str]
    swipe_type: str
    device_id: Optional[str]


@dataclass
class SampleRegistrationImportRow:
    sample_code: str
    user_id: Optional[str]
    user_name: Optional[str]
    sample_type: Optional[str]
    description: Optional[str]
    registered_at: datetime
    expected_pickup_at: Optional[datetime]
    actual_pickup_at: Optional[datetime]
    max_storage_hours: int
    status: str
    notes: Optional[str]


class CSVParser(BaseParser):
    
    def __init__(self, encoding: str = "utf-8"):
        super().__init__()
        self.encoding = encoding
    
    def parse(self, content: str) -> ParseResult[Dict[str, Any]]:
        result = ParseResult[Dict[str, Any]]()
        reader = csv.DictReader(io.StringIO(content))
        
        rows = list(reader)
        result.total_count = len(rows)
        
        for row_num, row in enumerate(rows, start=2):
            row_dict = {k.strip(): v.strip() if v else None for k, v in row.items()}
            result.data.append(row_dict)
            result.success_count += 1
        
        return result
    
    def parse_file(self, file_path: str) -> ParseResult[Dict[str, Any]]:
        with open(file_path, 'r', encoding=self.encoding) as f:
            return self.parse(f.read())


def _normalize_field_name(name: str) -> str:
    mapping = {
        "预约编号": "reservation_code", "预约单号": "reservation_code",
        "预约号": "reservation_code", "reservation_no": "reservation_code",
        
        "仪器编号": "instrument_code", "设备编号": "instrument_code",
        "instrument_no": "instrument_code",
        
        "用户编号": "user_id", "用户ID": "user_id", "学号": "user_id",
        "工号": "user_id", "user_no": "user_id",
        
        "用户姓名": "user_name", "姓名": "user_name", "user": "user_name",
        
        "课题组编号": "group_code", "课题组": "group_code",
        "group_no": "group_code",
        
        "开始时间": "start_time", "预约开始": "start_time",
        "start": "start_time",
        
        "结束时间": "end_time", "预约结束": "end_time",
        "end": "end_time",
        
        "使用目的": "purpose", "用途": "purpose",
        "purpose": "purpose",
        
        "状态": "status", "状态值": "status",
        
        "卡号": "card_number", "刷卡编号": "card_number",
        "card_no": "card_number",
        
        "刷卡时间": "swipe_time", "进门时间": "swipe_time",
        "swipe_at": "swipe_time",
        
        "刷卡类型": "swipe_type", "类型": "swipe_type",
        
        "设备ID": "device_id", "门禁编号": "device_id",
        
        "样品编号": "sample_code", "sample_no": "sample_code",
        
        "样品类型": "sample_type", "类型": "sample_type",
        
        "描述": "description", "说明": "description",
        
        "登记时间": "registered_at", "入库时间": "registered_at",
        
        "预计取出": "expected_pickup_at", "预计取出时间": "expected_pickup_at",
        
        "实际取出": "actual_pickup_at", "取出时间": "actual_pickup_at",
        
        "最大存储小时": "max_storage_hours", "存储时长": "max_storage_hours",
        
        "备注": "notes", "说明": "notes",
    }
    normalized = name.strip().lower().replace('_', '').replace('-', '')
    for original, mapped in mapping.items():
        if normalized == original.lower().replace('_', ''):
            return mapped
    return name.strip().lower().replace(' ', '_')


def parse_reservation_csv(content: str) -> ParseResult[ReservationImportRow]:
    parser = CSVParser()
    raw_result = parser.parse(content)
    
    result = ParseResult[ReservationImportRow]()
    result.total_count = raw_result.total_count
    
    required_fields = ["start_time", "end_time"]
    
    for idx, row in enumerate(raw_result.data):
        row_num = idx + 2
        
        normalized_row = {_normalize_field_name(k): v for k, v in row.items()}
        
        if not parser._validate_required(normalized_row, required_fields, row_num):
            result.error_count += 1
            continue
        
        start_time = parser._parse_datetime(
            normalized_row.get("start_time"), row_num, "start_time"
        )
        end_time = parser._parse_datetime(
            normalized_row.get("end_time"), row_num, "end_time"
        )
        
        if start_time is None or end_time is None:
            result.error_count += 1
            continue
        
        reservation_code = normalized_row.get("reservation_code") or f"R{row_num:06d}"
        
        if start_time >= end_time:
            parser.errors.append(ParseError(
                row_number=row_num,
                field="end_time",
                message=f"结束时间必须晚于开始时间: {start_time} >= {end_time}",
                code="INVALID_TIME_RANGE"
            ))
            result.error_count += 1
            continue
        
        result.data.append(ReservationImportRow(
            reservation_code=reservation_code,
            instrument_code=normalized_row.get("instrument_code"),
            user_id=normalized_row.get("user_id"),
            user_name=normalized_row.get("user_name"),
            group_code=normalized_row.get("group_code"),
            start_time=start_time,
            end_time=end_time,
            purpose=normalized_row.get("purpose"),
            status=normalized_row.get("status") or "pending"
        ))
        result.success_count += 1
    
    result.errors = parser.errors
    result.warnings = parser.warnings
    result.success = result.error_count == 0
    
    return result


def parse_swipe_log_csv(content: str) -> ParseResult[SwipeLogImportRow]:
    parser = CSVParser()
    raw_result = parser.parse(content)
    
    result = ParseResult[SwipeLogImportRow]()
    result.total_count = raw_result.total_count
    
    required_fields = ["card_number", "swipe_time"]
    
    for idx, row in enumerate(raw_result.data):
        row_num = idx + 2
        
        normalized_row = {_normalize_field_name(k): v for k, v in row.items()}
        
        if not parser._validate_required(normalized_row, required_fields, row_num):
            result.error_count += 1
            continue
        
        card_number = normalized_row.get("card_number")
        if not card_number:
            parser.errors.append(ParseError(
                row_number=row_num,
                field="card_number",
                message="卡号不能为空",
                code="MISSING_CARD_NUMBER"
            ))
            result.error_count += 1
            continue
        
        swipe_time = parser._parse_datetime(
            normalized_row.get("swipe_time"), row_num, "swipe_time"
        )
        
        if swipe_time is None:
            result.error_count += 1
            continue
        
        result.data.append(SwipeLogImportRow(
            swipe_code=normalized_row.get("swipe_code"),
            card_number=card_number,
            swipe_time=swipe_time,
            instrument_code=normalized_row.get("instrument_code"),
            user_id=normalized_row.get("user_id"),
            user_name=normalized_row.get("user_name"),
            reservation_code=normalized_row.get("reservation_code"),
            swipe_type=normalized_row.get("swipe_type") or "enter",
            device_id=normalized_row.get("device_id")
        ))
        result.success_count += 1
    
    result.errors = parser.errors
    result.warnings = parser.warnings
    result.success = result.error_count == 0
    
    return result


def parse_sample_registration_csv(content: str) -> ParseResult[SampleRegistrationImportRow]:
    parser = CSVParser()
    raw_result = parser.parse(content)
    
    result = ParseResult[SampleRegistrationImportRow]()
    result.total_count = raw_result.total_count
    
    required_fields = ["sample_code", "registered_at"]
    
    for idx, row in enumerate(raw_result.data):
        row_num = idx + 2
        
        normalized_row = {_normalize_field_name(k): v for k, v in row.items()}
        
        if not parser._validate_required(normalized_row, required_fields, row_num):
            result.error_count += 1
            continue
        
        registered_at = parser._parse_datetime(
            normalized_row.get("registered_at"), row_num, "registered_at"
        )
        
        if registered_at is None:
            result.error_count += 1
            continue
        
        expected_pickup_at = parser._parse_datetime(
            normalized_row.get("expected_pickup_at"), row_num, "expected_pickup_at"
        )
        actual_pickup_at = parser._parse_datetime(
            normalized_row.get("actual_pickup_at"), row_num, "actual_pickup_at"
        )
        
        max_storage_hours = 72
        max_storage = normalized_row.get("max_storage_hours")
        if max_storage:
            parsed = parser._parse_int(max_storage, row_num, "max_storage_hours")
            if parsed is not None:
                max_storage_hours = parsed
        
        status = normalized_row.get("status") or "in_storage"
        
        result.data.append(SampleRegistrationImportRow(
            sample_code=normalized_row.get("sample_code") or f"S{row_num:06d}",
            user_id=normalized_row.get("user_id"),
            user_name=normalized_row.get("user_name"),
            sample_type=normalized_row.get("sample_type"),
            description=normalized_row.get("description"),
            registered_at=registered_at,
            expected_pickup_at=expected_pickup_at,
            actual_pickup_at=actual_pickup_at,
            max_storage_hours=max_storage_hours,
            status=status,
            notes=normalized_row.get("notes")
        ))
        result.success_count += 1
    
    result.errors = parser.errors
    result.warnings = parser.warnings
    result.success = result.error_count == 0
    
    return result
