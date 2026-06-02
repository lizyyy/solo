import csv
import io
import uuid
from datetime import datetime

from .models import ParkingSpot, ApprovalRecord


def _normalize_row(row):
    cleaned = {}
    for k, v in row.items():
        k = k.strip()
        if v is None:
            v = ""
        v = str(v).strip()
        cleaned[k] = v
    return cleaned


def import_parking_spots(file_content, filename, batch_id=None):
    if not batch_id:
        batch_id = f"batch-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    spots = []
    if filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(file_content))
        for row in reader:
            row = _normalize_row(row)
            try:
                lon = float(row.get("经度", 0) or 0)
            except (ValueError, TypeError):
                lon = 0.0
            try:
                lat = float(row.get("纬度", 0) or 0)
            except (ValueError, TypeError):
                lat = 0.0
            try:
                cap = int(float(row.get("容量", 0) or 0))
            except (ValueError, TypeError):
                cap = 0
            spot = ParkingSpot(
                点位名称=row.get("点位名称", ""),
                路口名称=row.get("路口名称", ""),
                地址=row.get("地址", ""),
                经度=lon,
                纬度=lat,
                时段=row.get("时段", ""),
                容量=cap,
                小区名称=row.get("小区名称", ""),
                来源=row.get("来源", "导入"),
                来源详情=f"从文件 {filename} 导入，批次 {batch_id}",
                照片=[],
                备注=row.get("备注", ""),
                数据时段=row.get("数据时段", ""),
                来源批次=batch_id,
            )
            spots.append(spot)
    return spots, batch_id


def import_approval_records(file_content, filename):
    records = []
    if filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(file_content))
        for row in reader:
            row = _normalize_row(row)
            try:
                cap = int(float(row.get("批准容量", 0) or 0))
            except (ValueError, TypeError):
                cap = 0
            rec = ApprovalRecord(
                项目名称=row.get("项目名称", ""),
                路口名称=row.get("路口名称", ""),
                地址=row.get("地址", ""),
                批准时段=row.get("批准时段", ""),
                批准容量=cap,
                审批日期=row.get("审批日期", ""),
                审批文号=row.get("审批文号", ""),
                备注=row.get("备注", ""),
                数据时段=row.get("数据时段", ""),
            )
            records.append(rec)
    return records
