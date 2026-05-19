import json
import uuid
import pandas as pd
from typing import List, Tuple, Dict, Any
from datetime import datetime

from app.models import (
    DeviceEvent,
    CustomerServiceTicket,
    BadRecord,
    ImportSource,
)
from app.utils.storage import DataStorage


class DataImporter:
    def __init__(self, storage: DataStorage):
        self.storage = storage

    def import_device_events_json(
        self, file_path: str
    ) -> Tuple[int, int, List[BadRecord]]:
        success_count = 0
        failed_count = 0
        bad_records = []

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            events = data if isinstance(data, list) else [data]

            for idx, event_data in enumerate(events):
                try:
                    event = DeviceEvent(
                        event_id=event_data.get("event_id", f"evt_{uuid.uuid4().hex[:8]}"),
                        device_id=event_data.get("device_id", ""),
                        station_id=event_data.get("station_id", ""),
                        event_type=event_data.get("event_type", ""),
                        event_time=event_data.get("event_time"),
                        status=event_data.get("status", "unknown"),
                        bay_number=event_data.get("bay_number"),
                        battery_id=event_data.get("battery_id"),
                        user_id=event_data.get("user_id"),
                        details=event_data.get("details", {}),
                        raw_data=json.dumps(event_data, ensure_ascii=False),
                    )
                    self.storage.save_device_event(event)
                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    bad_record = BadRecord(
                        bad_record_id=f"bad_{uuid.uuid4().hex[:12]}",
                        source=ImportSource.DEVICE_EVENT_JSON,
                        file_name=file_path,
                        row_number=idx + 1,
                        raw_data=json.dumps(event_data, ensure_ascii=False),
                        error_message=str(e),
                        suggestion=self._generate_suggestion(str(e), "json"),
                    )
                    self.storage.save_bad_record(bad_record)
                    bad_records.append(bad_record)

        except Exception as e:
            failed_count += 1
            bad_record = BadRecord(
                bad_record_id=f"bad_{uuid.uuid4().hex[:12]}",
                source=ImportSource.DEVICE_EVENT_JSON,
                file_name=file_path,
                raw_data=f"File read error: {str(e)}",
                error_message=f"Failed to parse JSON file: {str(e)}",
                suggestion="请检查JSON文件格式是否正确，确保是有效的JSON数组或对象",
            )
            self.storage.save_bad_record(bad_record)
            bad_records.append(bad_record)

        return success_count, failed_count, bad_records

    def import_customer_service_csv(
        self, file_path: str
    ) -> Tuple[int, int, List[BadRecord]]:
        success_count = 0
        failed_count = 0
        bad_records = []

        try:
            df = pd.read_csv(file_path, encoding="utf-8")

            for idx, row in df.iterrows():
                try:
                    ticket = CustomerServiceTicket(
                        ticket_id=row.get("ticket_id", f"tkt_{uuid.uuid4().hex[:8]}"),
                        station_id=str(row.get("station_id", "")),
                        user_id=str(row.get("user_id", "")) if pd.notna(row.get("user_id")) else None,
                        user_phone=str(row.get("user_phone", "")) if pd.notna(row.get("user_phone")) else None,
                        title=str(row.get("title", "")),
                        description=str(row.get("description", "")),
                        create_time=row.get("create_time"),
                        status=row.get("status", "pending"),
                        assignee=str(row.get("assignee", "")) if pd.notna(row.get("assignee")) else None,
                        priority=int(row.get("priority", 1)) if pd.notna(row.get("priority")) else 1,
                        tags=str(row.get("tags", "")).split("|") if pd.notna(row.get("tags")) else [],
                        raw_data=json.dumps(row.to_dict(), ensure_ascii=False),
                    )
                    self.storage.save_customer_ticket(ticket)
                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    bad_record = BadRecord(
                        bad_record_id=f"bad_{uuid.uuid4().hex[:12]}",
                        source=ImportSource.CUSTOMER_SERVICE_CSV,
                        file_name=file_path,
                        row_number=idx + 2,
                        raw_data=json.dumps(row.to_dict(), ensure_ascii=False),
                        error_message=str(e),
                        suggestion=self._generate_suggestion(str(e), "csv"),
                    )
                    self.storage.save_bad_record(bad_record)
                    bad_records.append(bad_record)

        except Exception as e:
            failed_count += 1
            bad_record = BadRecord(
                bad_record_id=f"bad_{uuid.uuid4().hex[:12]}",
                source=ImportSource.CUSTOMER_SERVICE_CSV,
                file_name=file_path,
                raw_data=f"File read error: {str(e)}",
                error_message=f"Failed to parse CSV file: {str(e)}",
                suggestion="请检查CSV文件格式是否正确，确保列名和数据格式匹配",
            )
            self.storage.save_bad_record(bad_record)
            bad_records.append(bad_record)

        return success_count, failed_count, bad_records

    def _generate_suggestion(self, error_message: str, file_type: str) -> str:
        error_lower = error_message.lower()

        if "time" in error_lower or "date" in error_lower or "datetime" in error_lower:
            return "时间格式不正确，请使用 YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DDTHH:MM:SS 格式"
        elif "missing" in error_lower or "required" in error_lower or "none" in error_lower:
            return "缺少必填字段，请检查数据中是否包含所有必要的字段"
        elif "type" in error_lower or "int" in error_lower or "integer" in error_lower:
            return "数据类型错误，请确保数字字段包含有效的数值"
        elif "json" in error_lower:
            return "JSON格式错误，请检查括号、引号是否匹配"
        else:
            return f"请检查数据格式，确保所有字段符合要求。错误详情: {error_message[:100]}"
