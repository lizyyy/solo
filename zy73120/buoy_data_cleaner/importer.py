import os
import csv
from typing import List
from .models import BuoyRecord


def load_input_csv(path: str) -> List[BuoyRecord]:
    records: List[BuoyRecord] = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lat = row.get("latitude") or row.get("纬度") or row.get("latitude_raw") or ""
            lon = row.get("longitude") or row.get("经度") or row.get("longitude_raw") or ""
            rec = BuoyRecord(
                buoy_id=row.get("buoy_id") or row.get("浮标编号") or "",
                sample_bottle_id=row.get("sample_bottle_id") or row.get("采样瓶号") or "",
                timestamp=row.get("timestamp") or row.get("采样时间") or "",
                latitude_raw=lat,
                longitude_raw=lon,
                sea_state=row.get("sea_state") or row.get("海况") or "",
                wave_height=row.get("wave_height") or row.get("浪高") or "",
                water_temp=row.get("water_temp") or row.get("水温") or "",
                source_file=os.path.basename(path),
                is_late_arrival=(row.get("is_late_arrival") or row.get("晚到") or "").lower()
                in ("yes", "y", "1", "true", "是"),
                status="pending",
            )
            records.append(rec)
    return records
