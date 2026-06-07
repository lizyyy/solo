from datetime import datetime, timedelta
from typing import List, Tuple, Dict
from .models import (
    FeatureRecord,
    ConflictEvidence,
    CheckParameters,
    RecordStatus,
    ConflictResolution,
)


def detect_time_leakage(
    record: FeatureRecord,
    parameters: CheckParameters,
) -> Tuple[bool, str]:
    if record.feature_timestamp is None:
        return False, "特征时间戳缺失，无法检测穿越"

    gap = record.time_window_end - record.time_window_start
    safe_gap = timedelta(hours=parameters.time_window_gap_hours)

    if record.feature_timestamp > record.time_window_end:
        return True, f"特征时间({record.feature_timestamp})晚于窗口结束时间({record.time_window_end})"

    if record.feature_timestamp > record.time_window_end - safe_gap:
        hours_before_end = (record.time_window_end - record.feature_timestamp).total_seconds() / 3600
        return (
            True,
            f"特征时间距离窗口结束仅{hours_before_end:.1f}小时，小于安全间隔{parameters.time_window_gap_hours}小时",
        )

    return False, "无时间窗穿越"


def detect_conflicts(
    bucket_records: List[FeatureRecord],
    negative_records: List[FeatureRecord],
) -> List[ConflictEvidence]:
    conflicts = []

    bucket_map = {r.sample_id: r for r in bucket_records}
    negative_map = {r.sample_id: r for r in negative_records}

    all_sample_ids = set(bucket_map.keys()) | set(negative_map.keys())

    for sample_id in all_sample_ids:
        bucket_rec = bucket_map.get(sample_id)
        negative_rec = negative_map.get(sample_id)

        if bucket_rec is None:
            conflicts.append(
                ConflictEvidence(
                    record_id=sample_id,
                    bucket_value=None,
                    negative_value=negative_rec.feature_value if negative_rec else None,
                    description=f"样本{sample_id}存在于负样本列表但线上实验桶缺失",
                )
            )
            continue

        if negative_rec is None:
            conflicts.append(
                ConflictEvidence(
                    record_id=sample_id,
                    bucket_value=bucket_rec.feature_value,
                    negative_value=None,
                    description=f"样本{sample_id}存在于线上实验桶但负样本列表缺失",
                )
            )
            continue

        if bucket_rec.feature_value != negative_rec.feature_value:
            conflicts.append(
                ConflictEvidence(
                    record_id=sample_id,
                    bucket_value=bucket_rec.feature_value,
                    negative_value=negative_rec.feature_value,
                    description=(
                        f"样本{sample_id}特征值不一致："
                        f"线上桶={bucket_rec.feature_value}, "
                        f"负样本={negative_rec.feature_value}"
                    ),
                )
            )

        if bucket_rec.default_value_used != negative_rec.default_value_used:
            conflicts.append(
                ConflictEvidence(
                    record_id=sample_id,
                    bucket_value=bucket_rec.default_value_used,
                    negative_value=negative_rec.default_value_used,
                    description=(
                        f"样本{sample_id}默认值使用不一致："
                        f"线上桶={'是' if bucket_rec.default_value_used else '否'}, "
                        f"负样本={'是' if negative_rec.default_value_used else '否'}"
                    ),
                )
            )

    return conflicts


def process_record_status(
    record: FeatureRecord,
    parameters: CheckParameters,
) -> FeatureRecord:
    if record.feature_value is None or record.default_value_used:
        record.status = RecordStatus.FEATURE_MISSING_DEFAULT
        record.notes = (
            f"线上特征缺失，使用默认值填充。"
            f"参数版本: {parameters.parameter_version}, "
            f"填充策略: {parameters.default_fill_strategy}"
        )
        record.is_leakage = None
        return record

    is_leakage, reason = detect_time_leakage(record, parameters)
    record.is_leakage = is_leakage

    if is_leakage:
        record.status = RecordStatus.ABNORMAL
        record.notes = f"{reason}。参数版本: {parameters.parameter_version}"
    else:
        record.status = RecordStatus.NORMAL
        record.notes = f"{reason}。参数版本: {parameters.parameter_version}"

    return record


def process_all_records(
    bucket_records: List[FeatureRecord],
    negative_records: List[FeatureRecord],
    parameters: CheckParameters,
) -> Tuple[List[FeatureRecord], List[FeatureRecord], List[ConflictEvidence]]:
    processed_bucket = [process_record_status(r, parameters) for r in bucket_records]
    processed_negative = [process_record_status(r, parameters) for r in negative_records]
    conflicts = detect_conflicts(processed_bucket, processed_negative)

    for conflict in conflicts:
        for rec in processed_bucket:
            if rec.sample_id == conflict.record_id:
                rec.status = RecordStatus.CONFLICT
                rec.notes = f"与负样本列表存在冲突: {conflict.description}"
        for rec in processed_negative:
            if rec.sample_id == conflict.record_id:
                rec.status = RecordStatus.CONFLICT
                rec.notes = f"与线上实验桶存在冲突: {conflict.description}"

    return processed_bucket, processed_negative, conflicts
