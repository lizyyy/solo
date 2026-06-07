from datetime import datetime, timedelta
from typing import Optional
from .models import FeatureSnapshot, TrainingLogCurve, RecordStatus


def detect_time_window_leak(
    snapshot: FeatureSnapshot,
    log: Optional[TrainingLogCurve]
) -> tuple[bool, str]:
    if log is None or len(log.points) == 0:
        return False, ""
    
    last_log_time = max(p.timestamp for p in log.points)
    
    if last_log_time > snapshot.data_range_end:
        leak_duration = last_log_time - snapshot.data_range_end
        details = (
            f"训练日志最后时间 {last_log_time.strftime('%Y-%m-%d %H:%M')} "
            f"晚于特征快照数据截止时间 {snapshot.data_range_end.strftime('%Y-%m-%d %H:%M')}，"
            f"穿越时长 {leak_duration}"
        )
        return True, details
    
    if last_log_time > snapshot.created_at:
        leak_duration = last_log_time - snapshot.created_at
        details = (
            f"训练日志最后时间 {last_log_time.strftime('%Y-%m-%d %H:%M')} "
            f"晚于快照创建时间 {snapshot.created_at.strftime('%Y-%m-%d %H:%M')}，"
            f"穿越时长 {leak_duration}"
        )
        return True, details
    
    return False, ""


def is_old_metric_log(log: TrainingLogCurve, reference_time: datetime) -> tuple[bool, str]:
    if len(log.points) == 0:
        return False, ""
    
    first_log_time = min(p.timestamp for p in log.points)
    cutoff = reference_time - timedelta(days=30)
    
    if first_log_time < cutoff:
        age = reference_time - first_log_time
        details = (
            f"训练日志起始时间 {first_log_time.strftime('%Y-%m-%d')} "
            f"早于参考时间 {reference_time.strftime('%Y-%m-%d')} 超过30天（间隔 {age.days} 天），"
            f"属于旧口径数据"
        )
        return True, details
    
    return False, ""


def classify_record(
    snapshot: FeatureSnapshot,
    log: Optional[TrainingLogCurve],
    reference_time: Optional[datetime] = None
) -> tuple[RecordStatus, str]:
    if reference_time is None:
        reference_time = datetime.now()
    
    leak_detected, leak_details = detect_time_window_leak(snapshot, log)
    if leak_detected:
        return RecordStatus.TIME_WINDOW_LEAK, leak_details
    
    if log is not None:
        is_old, old_details = is_old_metric_log(log, reference_time)
        if is_old:
            return RecordStatus.OLD_METRIC, old_details
    
    if log is None:
        return RecordStatus.PENDING, "等待补录训练日志曲线"
    
    return RecordStatus.NORMAL, "数据校验通过"
