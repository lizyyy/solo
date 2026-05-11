"""数据导入模块"""

import csv
import json
from datetime import datetime
from typing import List, Dict, Any
import uuid

from .models import (
    Booking, CancellationRecord, CancellationType,
    CustomerLevel, ScheduleRule
)
from .datastore import DataStore


class DataImporter:
    def __init__(self, store: DataStore):
        self.store = store

    def import_bookings_from_csv(self, file_path: str) -> int:
        count = 0
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                booking = Booking(
                    booking_no=row["订舱号"],
                    customer_id=row["客户编号"],
                    customer_name=row["客户名称"],
                    customer_level=CustomerLevel(row["客户等级"].upper()),
                    vessel_name=row["船名"],
                    voyage_no=row["航次"],
                    origin_port=row["起运港"],
                    destination_port=row["目的港"],
                    container_qty=int(row["柜量"]),
                    container_type=row["柜型"],
                    freight_rate=float(row["海运费单价"]),
                    booking_date=self._parse_datetime(row["订舱日期"])
                )
                self.store.save_booking(booking)
                count += 1
        return count

    def import_schedules_from_csv(self, file_path: str) -> int:
        count = 0
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rule = ScheduleRule(
                    vessel_name=row["船名"],
                    voyage_no=row["航次"],
                    etd=self._parse_datetime(row["ETD"]),
                    cutoff_time=self._parse_datetime(row["截关时间"]),
                    free_cancel_hours=int(row["免费取消小时数"]),
                    charge_rate=float(row["取消费比例"]),
                    compensation_rate=float(row["赔付比例"])
                )
                self.store.save_schedule_rule(rule)
                count += 1
        return count

    def import_cancellations_from_csv(self, file_path: str) -> List[Dict[str, Any]]:
        results = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = CancellationRecord(
                    id=row.get("记录ID") or str(uuid.uuid4()),
                    booking_no=row["订舱号"],
                    customer_id=row["客户编号"],
                    cancellation_type=CancellationType(row["取消类型"]),
                    cancellation_time=self._parse_datetime(row["取消/改船时间"]),
                    new_vessel_name=row.get("新船名") or None,
                    new_voyage_no=row.get("新航次") or None,
                    original_vessel_released=row.get("原舱释放", "是") == "是"
                )
                results.append({
                    "record": record,
                    "original_row": dict(row)
                })
        return results

    def _parse_datetime(self, value: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期时间: {value}")
