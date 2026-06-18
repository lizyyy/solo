"""记录状态分类与复核逻辑."""

from typing import List, Dict
from .models import SamplingRecord, RecordStatus


def classify_records(records: List[SamplingRecord]) -> Dict[str, List[SamplingRecord]]:
    """按状态分类记录.

    分类规则:
    - 已确认: 经纬度正常、关键字段完整、无重大问题
    - 待补件: 缺少部分字段但可补充
    - 退回: 经纬度无法解析或存在严重问题
    """
    confirmed = []
    pending = []
    returned = []

    for record in records:
        status = _judge_status(record)
        record.status = status
        if status == RecordStatus.CONFIRMED:
            confirmed.append(record)
        elif status == RecordStatus.PENDING:
            pending.append(record)
        else:
            returned.append(record)

    return {
        "已确认": confirmed,
        "待补件": pending,
        "退回": returned,
    }


def _judge_status(record: SamplingRecord) -> RecordStatus:
    """判断单条记录的状态.

    分类规则:
    - 退回: 经纬度完全无法解析（乱写的），且不是反写问题
    - 待补件: 经纬度反写、缺部分字段，可以补
    - 已确认: 经纬度正常，关键字段齐全
    """
    has_lat = record.latitude is not None
    has_lon = record.longitude is not None
    has_station = bool(record.station_name)
    has_time = bool(record.sample_time)

    unparseable_issues = [
        i for i in record.coordinate_issues
        if i.issue_type in ("纬度格式无法识别", "经度格式无法识别")
    ]

    missing_issues = [
        i for i in record.coordinate_issues
        if i.issue_type in ("纬度缺失", "经度缺失")
    ]

    if record.lat_lon_reversed:
        return RecordStatus.PENDING

    if unparseable_issues:
        return RecordStatus.RETURNED

    if missing_issues or not has_station or not has_time:
        return RecordStatus.PENDING

    if has_lat and has_lon and has_station and has_time:
        return RecordStatus.CONFIRMED

    return RecordStatus.PENDING


def get_status_summary(records: List[SamplingRecord]) -> Dict[str, int]:
    """获取各状态记录数量统计."""
    counts = {
        "已确认": 0,
        "待补件": 0,
        "退回": 0,
        "总计": len(records),
    }
    for r in records:
        status_val = r.status.value if hasattr(r.status, 'value') else r.status
        if status_val in counts:
            counts[status_val] += 1
    return counts
