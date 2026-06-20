from datetime import datetime, timedelta
from typing import List, Tuple, Dict
from .models import (
    FeatureRecord,
    ConflictEvidence,
    CheckParameters,
    RecordStatus,
    ConflictResolution,
    StatusChangeEvent,
)


def _append_status_history(
    record: FeatureRecord,
    from_status: RecordStatus,
    to_status: RecordStatus,
    reason: str,
    parameters: CheckParameters,
    triggered_by: str = "system",
    trigger_step: str = "checker",
    extra_info: str = None,
) -> None:
    if from_status == to_status:
        return
    record.status_history.append(
        StatusChangeEvent(
            event_time=datetime.now(),
            from_status=from_status.value if from_status else None,
            to_status=to_status.value,
            triggered_by=triggered_by,
            trigger_step=trigger_step,
            reason=reason,
            parameter_version=parameters.parameter_version,
            extra_info=extra_info,
        )
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

    bucket_map: Dict[Tuple[str, str], FeatureRecord] = {}
    for r in bucket_records:
        key = (r.sample_id, r.feature_id)
        bucket_map[key] = r

    negative_map: Dict[Tuple[str, str], FeatureRecord] = {}
    for r in negative_records:
        key = (r.sample_id, r.feature_id)
        negative_map[key] = r

    all_keys = set(bucket_map.keys()) | set(negative_map.keys())

    for (sample_id, feature_id) in all_keys:
        bucket_rec = bucket_map.get((sample_id, feature_id))
        negative_rec = negative_map.get((sample_id, feature_id))
        feature_name = bucket_rec.feature_name if bucket_rec else (negative_rec.feature_name if negative_rec else "")
        record_id = f"{sample_id}:{feature_id}"

        if bucket_rec is None:
            conflicts.append(
                ConflictEvidence(
                    record_id=record_id,
                    sample_id=sample_id,
                    feature_id=feature_id,
                    feature_name=feature_name,
                    conflict_type="bucket_missing",
                    bucket_value=None,
                    negative_value=negative_rec.feature_value if negative_rec else None,
                    description=f"样本{sample_id}的特征{feature_name}({feature_id})存在于负样本列表但线上实验桶缺失",
                )
            )
            continue

        if negative_rec is None:
            conflicts.append(
                ConflictEvidence(
                    record_id=record_id,
                    sample_id=sample_id,
                    feature_id=feature_id,
                    feature_name=feature_name,
                    conflict_type="negative_missing",
                    bucket_value=bucket_rec.feature_value,
                    negative_value=None,
                    description=f"样本{sample_id}的特征{feature_name}({feature_id})存在于线上实验桶但负样本列表缺失",
                )
            )
            continue

        if bucket_rec.feature_value != negative_rec.feature_value:
            conflicts.append(
                ConflictEvidence(
                    record_id=record_id,
                    sample_id=sample_id,
                    feature_id=feature_id,
                    feature_name=feature_name,
                    conflict_type="value_mismatch",
                    bucket_value=bucket_rec.feature_value,
                    negative_value=negative_rec.feature_value,
                    description=(
                        f"样本{sample_id}的特征{feature_name}({feature_id})特征值不一致："
                        f"线上桶={bucket_rec.feature_value}, "
                        f"负样本={negative_rec.feature_value}"
                    ),
                )
            )

        if bucket_rec.default_value_used != negative_rec.default_value_used:
            conflicts.append(
                ConflictEvidence(
                    record_id=record_id,
                    sample_id=sample_id,
                    feature_id=feature_id,
                    feature_name=feature_name,
                    conflict_type="default_usage_mismatch",
                    bucket_value=bucket_rec.default_value_used,
                    negative_value=negative_rec.default_value_used,
                    description=(
                        f"样本{sample_id}的特征{feature_name}({feature_id})默认值使用不一致："
                        f"线上桶={'是' if bucket_rec.default_value_used else '否'}, "
                        f"负样本={'是' if negative_rec.default_value_used else '否'}"
                    ),
                )
            )

    return conflicts


def process_record_status(
    record: FeatureRecord,
    parameters: CheckParameters,
    triggered_by: str = "system",
    trigger_step: str = "step_unknown",
) -> FeatureRecord:
    old_status = record.status
    record.parameter_version_applied = parameters.parameter_version

    if record.original_feature_value is None:
        record.original_feature_value = record.feature_value

    if record.feature_value is None or record.default_value_used:
        record.default_filled_value = parameters.default_fill_value
        if record.feature_value is None:
            record.feature_value = parameters.default_fill_value

        explanation = (
            f"【线上特征缺失→默认分填充】"
            f"原始值={record.original_feature_value}, "
            f"填充值={parameters.default_fill_value}, "
            f"填充策略={parameters.default_fill_strategy}, "
            f"参数版本={parameters.parameter_version}。"
            f"结论依据：特征在时间窗内未回传，按{parameters.default_fill_strategy}策略补默认分，"
            f"该记录暂不归正常，留待推荐负责人复核。"
        )
        record.result_explanation = explanation

        new_status = RecordStatus.FEATURE_MISSING_DEFAULT
        _append_status_history(
            record, old_status, new_status,
            reason="线上特征缺失，按默认值填充",
            parameters=parameters,
            triggered_by=triggered_by,
            trigger_step=trigger_step,
            extra_info=f"填充策略={parameters.default_fill_strategy}, 填充值={parameters.default_fill_value}",
        )
        record.status = new_status
        record.is_leakage = None
        return record

    is_leakage, reason = detect_time_leakage(record, parameters)
    record.is_leakage = is_leakage

    if is_leakage:
        new_status = RecordStatus.ABNORMAL
        explanation = (
            f"【时间窗特征穿越→异常】{reason}。"
            f"参数版本={parameters.parameter_version}，"
            f"安全间隔={parameters.time_window_gap_hours}h。"
            f"结论依据：特征产生时间落入标签时间窗的安全缓冲区内，存在穿越风险。"
        )
        record.result_explanation = explanation
        _append_status_history(
            record, old_status, new_status,
            reason=reason,
            parameters=parameters,
            triggered_by=triggered_by,
            trigger_step=trigger_step,
        )
        record.status = new_status
    else:
        new_status = RecordStatus.NORMAL
        explanation = (
            f"【正常】{reason}。"
            f"参数版本={parameters.parameter_version}，"
            f"安全间隔={parameters.time_window_gap_hours}h。"
            f"结论依据：特征产生时间与标签时间窗满足安全间隔要求，无穿越风险。"
        )
        record.result_explanation = explanation
        _append_status_history(
            record, old_status, new_status,
            reason=reason,
            parameters=parameters,
            triggered_by=triggered_by,
            trigger_step=trigger_step,
        )
        record.status = new_status

    return record


def process_all_records(
    bucket_records: List[FeatureRecord],
    negative_records: List[FeatureRecord],
    parameters: CheckParameters,
    triggered_by: str = "system",
    trigger_step: str = "step_unknown",
) -> Tuple[List[FeatureRecord], List[FeatureRecord], List[ConflictEvidence]]:
    processed_bucket = [
        process_record_status(r, parameters, triggered_by, trigger_step)
        for r in bucket_records
    ]
    processed_negative = [
        process_record_status(r, parameters, triggered_by, trigger_step)
        for r in negative_records
    ]
    conflicts = detect_conflicts(processed_bucket, processed_negative)

    for conflict in conflicts:
        for rec in processed_bucket:
            if rec.sample_id == conflict.sample_id and rec.feature_id == conflict.feature_id:
                old = rec.status
                _append_status_history(
                    rec, old, RecordStatus.CONFLICT,
                    reason=f"与负样本列表存在冲突: {conflict.description}",
                    parameters=parameters,
                    triggered_by=triggered_by,
                    trigger_step=f"{trigger_step}_conflict_check",
                )
                rec.status = RecordStatus.CONFLICT
                rec.result_explanation = (
                    f"{rec.result_explanation or ''}。"
                    f"【冲突警告】{conflict.description}。"
                    f"需要人工确认或驳回，系统不自动拍板。"
                ).strip("。")
        for rec in processed_negative:
            if rec.sample_id == conflict.sample_id and rec.feature_id == conflict.feature_id:
                old = rec.status
                _append_status_history(
                    rec, old, RecordStatus.CONFLICT,
                    reason=f"与线上实验桶存在冲突: {conflict.description}",
                    parameters=parameters,
                    triggered_by=triggered_by,
                    trigger_step=f"{trigger_step}_conflict_check",
                )
                rec.status = RecordStatus.CONFLICT
                rec.result_explanation = (
                    f"{rec.result_explanation or ''}。"
                    f"【冲突警告】{conflict.description}。"
                    f"需要人工确认或驳回，系统不自动拍板。"
                ).strip("。")

    return processed_bucket, processed_negative, conflicts
