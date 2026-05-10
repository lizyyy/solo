"""数据加载模块"""

import os
from datetime import datetime
from typing import List, Optional, Tuple

import pandas as pd

from .models import (
    DevicePoint,
    InspectionStatus,
    ScanRecord,
    SourceType,
    SupplementaryRecord,
)


def read_file(file_path: str) -> pd.DataFrame:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        return pd.read_csv(file_path)
    elif ext in [".xlsx", ".xls"]:
        return pd.read_excel(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {ext}，请使用 CSV 或 Excel 文件")


def parse_datetime(value) -> Optional[datetime]:
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        for fmt in [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    try:
        return pd.to_datetime(value).to_pydatetime()
    except Exception:
        return None


def parse_status(value) -> InspectionStatus:
    if pd.isna(value):
        return InspectionStatus.NORMAL
    value = str(value).strip()
    mapping = {
        "正常": InspectionStatus.NORMAL,
        "异常": InspectionStatus.ABNORMAL,
        "漏检": InspectionStatus.MISSING,
        "补录": InspectionStatus.SUPPLEMENTARY,
        "已完成": InspectionStatus.COMPLETED,
        "待巡检": InspectionStatus.PENDING,
    }
    return mapping.get(value, InspectionStatus.NORMAL)


def safe_int(value, default: int = 0) -> int:
    if pd.isna(value):
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_str(value) -> str:
    if pd.isna(value):
        return ""
    return str(value)


def safe_bool(value, default: bool = True) -> bool:
    if pd.isna(value):
        return default
    try:
        return bool(value)
    except (ValueError, TypeError):
        return default


def load_device_points(file_path: str) -> List[DevicePoint]:
    df = read_file(file_path)
    points = []
    for _, row in df.iterrows():
        point_order_val = safe_int(row.get("点位顺序", row.get("point_order")), 0)
        required_val = safe_bool(row.get("必检", row.get("required")), True)
        inspector_val = row.get("负责人", row.get("inspector", ""))

        point = DevicePoint(
            route_id=safe_str(row.get("路线ID", row.get("route_id"))),
            route_name=safe_str(row.get("路线名称", row.get("route_name"))),
            point_id=safe_str(row.get("点位ID", row.get("point_id"))),
            point_name=safe_str(row.get("点位名称", row.get("point_name"))),
            point_order=point_order_val,
            required=required_val,
            shift_start=parse_datetime(
                row.get("班次开始时间", row.get("shift_start", None))
            ),
            shift_end=parse_datetime(row.get("班次结束时间", row.get("shift_end", None))),
            inspector=safe_str(inspector_val) if not pd.isna(inspector_val) else None,
        )
        points.append(point)
    return points


def load_scan_records(file_path: str) -> List[ScanRecord]:
    df = read_file(file_path)
    records = []
    for _, row in df.iterrows():
        record = ScanRecord(
            record_id=str(row.get("记录ID", row.get("record_id", ""))),
            point_id=str(row.get("点位ID", row.get("point_id", ""))),
            scan_time=parse_datetime(row.get("扫码时间", row.get("scan_time", None))),
            status=parse_status(row.get("巡检状态", row.get("status", "正常"))),
            remark=str(row.get("备注", row.get("remark", "")))
            if not pd.isna(row.get("备注", row.get("remark", "")))
            else None,
            inspector=str(row.get("巡检人", row.get("inspector", "")))
            if not pd.isna(row.get("巡检人", row.get("inspector", "")))
            else None,
            source=SourceType.SCAN,
        )
        records.append(record)
    return records


def load_supplementary_records(file_path: str) -> List[SupplementaryRecord]:
    df = read_file(file_path)
    records = []
    for _, row in df.iterrows():
        record = SupplementaryRecord(
            record_id=str(row.get("记录ID", row.get("record_id", ""))),
            point_id=str(row.get("点位ID", row.get("point_id", ""))),
            supplementary_time=parse_datetime(
                row.get("补录时间", row.get("supplementary_time", None))
            ),
            status=parse_status(row.get("巡检状态", row.get("status", "正常"))),
            remark=str(row.get("备注", row.get("remark", "")))
            if not pd.isna(row.get("备注", row.get("remark", "")))
            else None,
            inspector=str(row.get("补录人", row.get("inspector", "")))
            if not pd.isna(row.get("补录人", row.get("inspector", "")))
            else None,
        )
        records.append(record)
    return records


def load_all_data(
    points_file: str, scan_file: Optional[str], supplementary_file: Optional[str]
) -> Tuple[List[DevicePoint], List[ScanRecord], List[SupplementaryRecord]]:
    points = load_device_points(points_file)
    scan_records = load_scan_records(scan_file) if scan_file else []
    supplementary_records = (
        load_supplementary_records(supplementary_file) if supplementary_file else []
    )
    return points, scan_records, supplementary_records
