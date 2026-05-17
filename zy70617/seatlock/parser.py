import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Callable, Any
import uuid

from .models import (
    Show, Seat, GroupOrder, HoldWindow, SeatLock, SeatChangeRequest,
    BadRecord, SourceTrace, SeatStatus, LockStatus, ChangeStatus
)


class DataParser:
    def __init__(self):
        self.bad_records: List[BadRecord] = []
        self.shows: List[Show] = []
        self.seats: List[Seat] = []
        self.orders: List[GroupOrder] = []
        self.windows: List[HoldWindow] = []
        self.locks: List[SeatLock] = []
        self.changes: List[SeatChangeRequest] = []
        self.processed_files: List[str] = []
        
        self._parsing_handlers: Dict[str, Callable] = {
            "shows": self._parse_show_row,
            "seats": self._parse_seat_row,
            "orders": self._parse_order_row,
            "windows": self._parse_window_row,
            "locks": self._parse_lock_row,
            "changes": self._parse_change_row,
        }
    
    def _parse_datetime(self, value: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y%m%d%H%M%S",
            "%Y-%m-%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期时间: {value}")
    
    def _parse_seat_ids(self, value: str) -> List[str]:
        if not value:
            return []
        return [s.strip() for s in value.replace(";", ",").split(",") if s.strip()]
    
    def _add_bad_record(self, source_trace: SourceTrace, error_type: str, error_message: str):
        bad_record = BadRecord(
            source_trace=source_trace,
            error_type=error_type,
            error_message=error_message
        )
        self.bad_records.append(bad_record)
    
    def _parse_show_row(self, row: Dict[str, str], source_trace: SourceTrace) -> Optional[Show]:
        try:
            required_fields = ["show_id", "title", "venue", "show_time", "total_seats"]
            for field in required_fields:
                if field not in row or not row[field].strip():
                    raise ValueError(f"缺少必填字段: {field}")
            
            return Show(
                show_id=row["show_id"].strip(),
                title=row["title"].strip(),
                venue=row["venue"].strip(),
                show_time=self._parse_datetime(row["show_time"].strip()),
                total_seats=int(row["total_seats"].strip()),
                is_active=row.get("is_active", "true").lower() in ["true", "1", "yes"],
                source_trace=source_trace
            )
        except Exception as e:
            self._add_bad_record(source_trace, "PARSE_ERROR_SHOW", str(e))
            return None
    
    def _parse_seat_row(self, row: Dict[str, str], source_trace: SourceTrace) -> Optional[Seat]:
        try:
            required_fields = ["seat_id", "show_id", "section", "row", "number"]
            for field in required_fields:
                if field not in row or not row[field].strip():
                    raise ValueError(f"缺少必填字段: {field}")
            
            status_str = row.get("status", "AVAILABLE").strip().upper()
            try:
                status = SeatStatus[status_str]
            except KeyError:
                raise ValueError(f"无效座位状态: {status_str}")
            
            return Seat(
                seat_id=row["seat_id"].strip(),
                show_id=row["show_id"].strip(),
                section=row["section"].strip(),
                row=row["row"].strip(),
                number=row["number"].strip(),
                seat_type=row.get("seat_type", "NORMAL").strip(),
                status=status,
                price=float(row.get("price", "0").strip() or "0"),
                source_trace=source_trace
            )
        except Exception as e:
            self._add_bad_record(source_trace, "PARSE_ERROR_SEAT", str(e))
            return None
    
    def _parse_order_row(self, row: Dict[str, str], source_trace: SourceTrace) -> Optional[GroupOrder]:
        try:
            required_fields = ["order_id", "group_name", "show_id", "contact_name", "contact_phone", "total_tickets", "created_at"]
            for field in required_fields:
                if field not in row or not row[field].strip():
                    raise ValueError(f"缺少必填字段: {field}")
            
            return GroupOrder(
                order_id=row["order_id"].strip(),
                group_name=row["group_name"].strip(),
                show_id=row["show_id"].strip(),
                contact_name=row["contact_name"].strip(),
                contact_phone=row["contact_phone"].strip(),
                total_tickets=int(row["total_tickets"].strip()),
                created_at=self._parse_datetime(row["created_at"].strip()),
                is_active=row.get("is_active", "true").lower() in ["true", "1", "yes"],
                source_trace=source_trace
            )
        except Exception as e:
            self._add_bad_record(source_trace, "PARSE_ERROR_ORDER", str(e))
            return None
    
    def _parse_window_row(self, row: Dict[str, str], source_trace: SourceTrace) -> Optional[HoldWindow]:
        try:
            required_fields = ["window_id", "show_id", "order_id", "seat_ids", "hold_start", "hold_end"]
            for field in required_fields:
                if field not in row or not row[field].strip():
                    raise ValueError(f"缺少必填字段: {field}")
            
            return HoldWindow(
                window_id=row["window_id"].strip(),
                show_id=row["show_id"].strip(),
                order_id=row["order_id"].strip(),
                seat_ids=self._parse_seat_ids(row["seat_ids"].strip()),
                hold_start=self._parse_datetime(row["hold_start"].strip()),
                hold_end=self._parse_datetime(row["hold_end"].strip()),
                hold_reason=row.get("hold_reason", "GROUP_HOLD").strip(),
                created_by=row.get("created_by", "SYSTEM").strip(),
                source_trace=source_trace
            )
        except Exception as e:
            self._add_bad_record(source_trace, "PARSE_ERROR_WINDOW", str(e))
            return None
    
    def _parse_lock_row(self, row: Dict[str, str], source_trace: SourceTrace) -> Optional[SeatLock]:
        try:
            required_fields = ["lock_id", "show_id", "seat_id", "order_id", "window_id", "locked_at", "lock_timeout"]
            for field in required_fields:
                if field not in row or not row[field].strip():
                    raise ValueError(f"缺少必填字段: {field}")
            
            status_str = row.get("status", "ACTIVE").strip().upper()
            try:
                status = LockStatus[status_str]
            except KeyError:
                raise ValueError(f"无效锁状态: {status_str}")
            
            released_at = row.get("released_at", "").strip()
            released_at = self._parse_datetime(released_at) if released_at else None
            
            return SeatLock(
                lock_id=row["lock_id"].strip(),
                show_id=row["show_id"].strip(),
                seat_id=row["seat_id"].strip(),
                order_id=row["order_id"].strip(),
                window_id=row["window_id"].strip(),
                locked_at=self._parse_datetime(row["locked_at"].strip()),
                lock_timeout=self._parse_datetime(row["lock_timeout"].strip()),
                status=status,
                locked_by=row.get("locked_by", "SYSTEM").strip(),
                released_at=released_at,
                released_by=row.get("released_by", "").strip() or None,
                release_reason=row.get("release_reason", "").strip() or None,
                source_trace=source_trace
            )
        except Exception as e:
            self._add_bad_record(source_trace, "PARSE_ERROR_LOCK", str(e))
            return None
    
    def _parse_change_row(self, row: Dict[str, str], source_trace: SourceTrace) -> Optional[SeatChangeRequest]:
        try:
            required_fields = ["change_id", "show_id", "order_id", "from_seat_ids", "to_seat_ids", "requested_at", "requested_by"]
            for field in required_fields:
                if field not in row or not row[field].strip():
                    raise ValueError(f"缺少必填字段: {field}")
            
            status_str = row.get("status", "PENDING").strip().upper()
            try:
                status = ChangeStatus[status_str]
            except KeyError:
                raise ValueError(f"无效换座状态: {status_str}")
            
            approved_at = row.get("approved_at", "").strip()
            approved_at = self._parse_datetime(approved_at) if approved_at else None
            
            executed_at = row.get("executed_at", "").strip()
            executed_at = self._parse_datetime(executed_at) if executed_at else None
            
            return SeatChangeRequest(
                change_id=row["change_id"].strip(),
                show_id=row["show_id"].strip(),
                order_id=row["order_id"].strip(),
                from_seat_ids=self._parse_seat_ids(row["from_seat_ids"].strip()),
                to_seat_ids=self._parse_seat_ids(row["to_seat_ids"].strip()),
                requested_at=self._parse_datetime(row["requested_at"].strip()),
                requested_by=row["requested_by"].strip(),
                status=status,
                approved_at=approved_at,
                approved_by=row.get("approved_by", "").strip() or None,
                executed_at=executed_at,
                reject_reason=row.get("reject_reason", "").strip() or None,
                source_trace=source_trace
            )
        except Exception as e:
            self._add_bad_record(source_trace, "PARSE_ERROR_CHANGE", str(e))
            return None
    
    def parse_csv_file(self, file_path: str, data_type: str) -> int:
        if data_type not in self._parsing_handlers:
            raise ValueError(f"不支持的数据类型: {data_type}, 支持类型: {list(self._parsing_handlers.keys())}")
        
        handler = self._parsing_handlers[data_type]
        target_list = getattr(self, data_type)
        
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        self.processed_files.append(str(file_path))
        success_count = 0
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                source_trace = SourceTrace(
                    source_file=str(file_path),
                    line_number=line_num,
                    raw_content=json.dumps(row, ensure_ascii=False)
                )
                result = handler(row, source_trace)
                if result:
                    target_list.append(result)
                    success_count += 1
        
        return success_count
    
    def parse_directory(self, dir_path: str) -> Dict[str, int]:
        dir_path = Path(dir_path)
        if not dir_path.exists():
            raise FileNotFoundError(f"目录不存在: {dir_path}")
        
        file_patterns = {
            "show": "shows",
            "seat": "seats",
            "order": "orders",
            "window": "windows",
            "lock": "locks",
            "change": "changes",
        }
        
        results = {}
        for pattern, data_type in file_patterns.items():
            for file in dir_path.glob(f"*{pattern}*.csv"):
                count = self.parse_csv_file(str(file), data_type)
                results[str(file)] = count
        
        return results
    
    def get_parse_summary(self) -> Dict[str, Any]:
        return {
            "total_files": len(self.processed_files),
            "processed_files": self.processed_files,
            "shows_parsed": len(self.shows),
            "seats_parsed": len(self.seats),
            "orders_parsed": len(self.orders),
            "windows_parsed": len(self.windows),
            "locks_parsed": len(self.locks),
            "changes_parsed": len(self.changes),
            "bad_records_count": len(self.bad_records),
            "bad_records": [br.to_dict() for br in self.bad_records]
        }
