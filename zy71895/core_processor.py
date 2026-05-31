import uuid
from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Optional
from collections import defaultdict

from models import (
    InspectionRecord, ProcessingResult, RecordStatus, AlertLevel,
    AuditTrail, DuplicateGroup, RecordSource
)
from config import PV_THRESHOLDS, LATE_ARRIVAL_THRESHOLD_HOURS, FLUCTUATION_THRESHOLD_PERCENT


def get_alert_level(metric_name: str, value: float) -> Tuple[AlertLevel, Optional[str]]:
    if metric_name not in PV_THRESHOLDS:
        return AlertLevel.NORMAL, None
    
    thresholds = PV_THRESHOLDS[metric_name]
    
    for threshold in thresholds:
        if threshold.min_value <= value < threshold.max_value:
            return threshold.level, threshold.description
    
    return AlertLevel.NORMAL, None


def check_threshold_cross(
    current_value: float,
    previous_value: Optional[float],
    metric_name: str
) -> Tuple[bool, Optional[AlertLevel], Optional[AlertLevel], str]:
    if previous_value is None:
        return False, None, None, "无历史数据，无法判断阈值跨档"
    
    current_level, _ = get_alert_level(metric_name, current_value)
    previous_level, _ = get_alert_level(metric_name, previous_value)
    
    if current_level != previous_level:
        level_order = [AlertLevel.NORMAL, AlertLevel.NOTICE, AlertLevel.WARNING, 
                       AlertLevel.ALARM, AlertLevel.CRITICAL]
        current_idx = level_order.index(current_level)
        previous_idx = level_order.index(previous_level)
        direction = "升高" if current_idx > previous_idx else "降低"
        reason = (f"指标从{previous_level.value}({previous_value})"
                  f"{direction}至{current_level.value}({current_value})，跨越阈值档位")
        return True, previous_level, current_level, reason
    
    return False, None, None, "未跨越阈值档位"


def check_late_arrival(record: InspectionRecord) -> Tuple[bool, str]:
    time_diff = record.receive_time - record.collect_time
    threshold = timedelta(hours=LATE_ARRIVAL_THRESHOLD_HOURS)
    
    if time_diff > threshold:
        hours = time_diff.total_seconds() / 3600
        reason = f"数据于{record.collect_time.strftime('%Y-%m-%d %H:%M')}采集，" \
                 f"{record.receive_time.strftime('%Y-%m-%d %H:%M')}才收到，" \
                 f"延迟{hours:.1f}小时，超过{ LATE_ARRIVAL_THRESHOLD_HOURS}小时阈值"
        return True, reason
    return False, ""


def check_duplicates(records: List[InspectionRecord]) -> Dict[str, DuplicateGroup]:
    groups: Dict[str, List[InspectionRecord]] = defaultdict(list)
    
    for record in records:
        key = f"{record.device_id}_{record.metric_name}_{record.collect_time.strftime('%Y%m%d%H%M')}"
        groups[key].append(record)
    
    result: Dict[str, DuplicateGroup] = {}
    for key, group_records in groups.items():
        if len(group_records) > 1:
            group_records.sort(key=lambda r: r.receive_time)
            kept = group_records[0]
            result[key] = DuplicateGroup(
                group_key=key,
                records=group_records,
                kept_record_id=kept.record_id,
                duplicate_count=len(group_records) - 1
            )
    
    return result


def check_sequence_errors(
    records: List[InspectionRecord],
    window_minutes: int = 60
) -> List[Tuple[InspectionRecord, InspectionRecord, str]]:
    device_records: Dict[str, List[InspectionRecord]] = defaultdict(list)
    for record in records:
        device_records[record.device_id].append(record)
    
    errors = []
    window = timedelta(minutes=window_minutes)
    
    for device_id, dev_records in device_records.items():
        dev_records.sort(key=lambda r: r.collect_time)
        for i in range(len(dev_records) - 1):
            for j in range(i + 1, len(dev_records)):
                time_diff = dev_records[j].collect_time - dev_records[i].collect_time
                if time_diff > window:
                    break
                
                level_order = [AlertLevel.NORMAL, AlertLevel.NOTICE, AlertLevel.WARNING, 
                               AlertLevel.ALARM, AlertLevel.CRITICAL]
                
                level_i, _ = get_alert_level(dev_records[i].metric_name, dev_records[i].metric_value)
                level_j, _ = get_alert_level(dev_records[j].metric_name, dev_records[j].metric_value)
                
                idx_i = level_order.index(level_i)
                idx_j = level_order.index(level_j)
                
                if idx_i > idx_j and dev_records[i].metric_name == dev_records[j].metric_name:
                    reason = (f"故障复现顺序异常：{dev_records[i].collect_time.strftime('%H:%M')}"
                              f"记录为{level_i.value}({dev_records[i].metric_value})，"
                              f"但{dev_records[j].collect_time.strftime('%H:%M')}"
                              f"记录反而为{level_j.value}({dev_records[j].metric_value})，"
                              f"严重级别不升反降")
                    errors.append((dev_records[i], dev_records[j], reason))
    
    return errors


def check_fluctuation(
    current_record: InspectionRecord,
    previous_records: List[InspectionRecord],
    threshold_percent: float = FLUCTUATION_THRESHOLD_PERCENT
) -> Tuple[bool, str, List[float]]:
    if not previous_records:
        return False, "无历史数据，无法判断波动", []
    
    relevant_history = [
        r for r in previous_records
        if r.device_id == current_record.device_id
        and r.metric_name == current_record.metric_name
        and r.collect_time < current_record.collect_time
    ]
    
    if not relevant_history:
        return False, f"无{current_record.metric_name}的历史数据，无法判断波动", []
    
    relevant_history.sort(key=lambda r: r.collect_time, reverse=True)
    recent_values = [r.metric_value for r in relevant_history[:5]]
    
    if not recent_values:
        return False, "近期数据不足，无法判断波动", []
    
    avg_recent = sum(recent_values) / len(recent_values)
    if avg_recent == 0:
        return False, "历史平均值为零，无法计算波动百分比", recent_values
    
    change_percent = abs(current_record.metric_value - avg_recent) / avg_recent * 100
    
    if change_percent >= threshold_percent:
        direction = "上升" if current_record.metric_value > avg_recent else "下降"
        reason = (f"{current_record.metric_name}波动剧烈：当前值{current_record.metric_value}"
                  f"{current_record.unit}，较近期平均值{avg_recent:.2f}{current_record.unit}"
                  f"{direction}{change_percent:.1f}%，超过{threshold_percent}%波动阈值")
        return True, reason, recent_values
    
    return False, f"波动幅度{change_percent:.1f}%，在正常范围内", recent_values


def create_audit_trail(
    record_id: str,
    action: str,
    old_level: Optional[AlertLevel],
    new_level: Optional[AlertLevel],
    reason: str,
    evidence: Dict,
    operator: Optional[str] = None
) -> AuditTrail:
    return AuditTrail(
        trail_id=str(uuid.uuid4()),
        record_id=record_id,
        action=action,
        old_level=old_level,
        new_level=new_level,
        reason=reason,
        evidence=evidence,
        operator=operator
    )
