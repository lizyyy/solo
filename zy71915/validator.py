from datetime import timedelta
from typing import List, Tuple
from models import ScheduleRecord, Issue, IssueType, ConfirmationStatus, Material, SilenceSegment


HUMAN_MESSAGES = {
    IssueType.MISSING_MATERIAL: {
        "single": "广告「{ad_name}」缺少素材：{material_name}",
        "multiple": "广告「{ad_name}」缺少 {count} 个素材：{names}",
        "reason": "素材库中找不到 {material_name}，请确认文件是否已上传，或素材ID是否正确。"
    },
    IssueType.TIMELINE_DRIFT: {
        "positive": "广告「{ad_name}」实际时长比预期多 {drift} 秒",
        "negative": "广告「{ad_name}」实际时长比预期少 {drift} 秒",
        "reason": "预期时长 {expected} 秒，但实际时段 {start} ~ {end} 算下来是 {actual} 秒，差了 {drift} 秒。超过了 {threshold} 秒的容错阈值。"
    },
    IssueType.SILENCE_DELETED: {
        "single": "广告「{ad_name}」的静音段被删除了",
        "multiple": "广告「{ad_name}」有 {count} 段静音被误删",
        "reason": "第 {segment} 段静音（{start}秒 ~ {end}秒）原本应该保留，但现在标记为已删除。请和剪辑同事确认这是否是故意的。"
    },
    IssueType.OVERLAP: {
        "message": "广告「{ad_name}」和「{other_ad}」时段重叠了",
        "reason": "{ad_name} 的时段是 {start1} ~ {end1}，{other_ad} 的时段是 {start2} ~ {end2}，重叠了 {overlap} 秒。"
    },
    IssueType.INVALID_DATA: {
        "message": "广告「{ad_name}」数据填写不完整",
        "reason": "{field} 是空的，请补全后再试。"
    }
}


def format_timedelta(td: timedelta) -> str:
    total_seconds = td.total_seconds()
    if abs(total_seconds) < 60:
        return f"{total_seconds:.1f}"
    minutes, seconds = divmod(abs(total_seconds), 60)
    sign = "-" if total_seconds < 0 else ""
    return f"{sign}{int(minutes)}分{seconds:.1f}秒"


def check_missing_materials(record: ScheduleRecord) -> List[Issue]:
    issues = []
    missing = [m for m in record.materials if not m.exists]
    if missing:
        names = [m.name for m in missing]
        if len(missing) == 1:
            message = HUMAN_MESSAGES[IssueType.MISSING_MATERIAL]["single"].format(
                ad_name=record.ad_name, material_name=names[0]
            )
            reason = HUMAN_MESSAGES[IssueType.MISSING_MATERIAL]["reason"].format(
                material_name=names[0]
            )
        else:
            message = HUMAN_MESSAGES[IssueType.MISSING_MATERIAL]["multiple"].format(
                ad_name=record.ad_name, count=len(missing), names="、".join(names)
            )
            reason = f"缺少的素材包括：{'、'.join(names)}。请逐一核对。"
        issues.append(Issue(
            issue_type=IssueType.MISSING_MATERIAL,
            severity="error",
            message=message,
            details={
                "missing_count": len(missing),
                "missing_materials": [{"id": m.material_id, "name": m.name} for m in missing]
            },
            reviewable_reason=reason
        ))
    return issues


def check_timeline_drift(record: ScheduleRecord) -> List[Issue]:
    issues = []
    drift = record.calculate_drift()
    if abs(drift) > record.drift_threshold:
        drift_seconds = abs(drift.total_seconds())
        expected_seconds = record.expected_duration.total_seconds() if record.expected_duration else 0
        actual_seconds = (record.slot_end - record.slot_start).total_seconds() if (record.slot_start and record.slot_end) else 0
        
        if drift.total_seconds() > 0:
            message = HUMAN_MESSAGES[IssueType.TIMELINE_DRIFT]["positive"].format(
                ad_name=record.ad_name, drift=f"{drift_seconds:.1f}"
            )
        else:
            message = HUMAN_MESSAGES[IssueType.TIMELINE_DRIFT]["negative"].format(
                ad_name=record.ad_name, drift=f"{drift_seconds:.1f}"
            )
        
        reason = HUMAN_MESSAGES[IssueType.TIMELINE_DRIFT]["reason"].format(
            expected=f"{expected_seconds:.1f}",
            start=record.slot_start.strftime("%H:%M:%S") if record.slot_start else "未知",
            end=record.slot_end.strftime("%H:%M:%S") if record.slot_end else "未知",
            actual=f"{actual_seconds:.1f}",
            drift=f"{drift_seconds:.1f}",
            threshold=f"{record.drift_threshold.total_seconds():.1f}"
        )
        
        issues.append(Issue(
            issue_type=IssueType.TIMELINE_DRIFT,
            severity="warning",
            message=message,
            details={
                "drift_seconds": drift.total_seconds(),
                "threshold_seconds": record.drift_threshold.total_seconds(),
                "expected_seconds": expected_seconds,
                "actual_seconds": actual_seconds
            },
            reviewable_reason=reason
        ))
    return issues


def check_silence_segments(record: ScheduleRecord) -> List[Issue]:
    issues = []
    deleted = [s for s in record.silence_segments if not s.preserved]
    if deleted:
        reasons = []
        for i, seg in enumerate(deleted, 1):
            reasons.append(HUMAN_MESSAGES[IssueType.SILENCE_DELETED]["reason"].format(
                segment=i,
                start=f"{seg.start.total_seconds():.1f}",
                end=f"{seg.end.total_seconds():.1f}"
            ))
        
        if len(deleted) == 1:
            message = HUMAN_MESSAGES[IssueType.SILENCE_DELETED]["single"].format(
                ad_name=record.ad_name
            )
        else:
            message = HUMAN_MESSAGES[IssueType.SILENCE_DELETED]["multiple"].format(
                ad_name=record.ad_name, count=len(deleted)
            )
        
        issues.append(Issue(
            issue_type=IssueType.SILENCE_DELETED,
            severity="warning",
            message=message,
            details={
                "deleted_count": len(deleted),
                "deleted_segments": [
                    {"start": s.start.total_seconds(), "end": s.end.total_seconds()}
                    for s in deleted
                ]
            },
            reviewable_reason="\n".join(reasons)
        ))
    return issues


def check_overlaps(records: List[ScheduleRecord]) -> List[Tuple[ScheduleRecord, ScheduleRecord, Issue]]:
    overlap_issues = []
    sorted_records = sorted(
        [r for r in records if r.slot_start and r.slot_end],
        key=lambda r: r.slot_start
    )
    
    for i in range(len(sorted_records)):
        for j in range(i + 1, len(sorted_records)):
            r1, r2 = sorted_records[i], sorted_records[j]
            if r1.slot_end <= r2.slot_start:
                break
            overlap = min(r1.slot_end, r2.slot_end) - max(r1.slot_start, r2.slot_start)
            if overlap > timedelta(0):
                message = HUMAN_MESSAGES[IssueType.OVERLAP]["message"].format(
                    ad_name=r1.ad_name, other_ad=r2.ad_name
                )
                reason = HUMAN_MESSAGES[IssueType.OVERLAP]["reason"].format(
                    ad_name=r1.ad_name,
                    other_ad=r2.ad_name,
                    start1=r1.slot_start.strftime("%H:%M:%S"),
                    end1=r1.slot_end.strftime("%H:%M:%S"),
                    start2=r2.slot_start.strftime("%H:%M:%S"),
                    end2=r2.slot_end.strftime("%H:%M:%S"),
                    overlap=f"{overlap.total_seconds():.1f}"
                )
                issue = Issue(
                    issue_type=IssueType.OVERLAP,
                    severity="error",
                    message=message,
                    details={
                        "overlap_seconds": overlap.total_seconds(),
                        "other_record_id": r2.record_id,
                        "other_ad_name": r2.ad_name
                    },
                    reviewable_reason=reason
                )
                overlap_issues.append((r1, r2, issue))
    return overlap_issues


def validate_record(record: ScheduleRecord) -> ScheduleRecord:
    record.issues = []
    
    if not record.ad_name or not record.slot_start or not record.slot_end or not record.expected_duration:
        missing_fields = []
        if not record.ad_name:
            missing_fields.append("广告名称")
        if not record.slot_start:
            missing_fields.append("开始时间")
        if not record.slot_end:
            missing_fields.append("结束时间")
        if not record.expected_duration:
            missing_fields.append("预期时长")
        
        message = HUMAN_MESSAGES[IssueType.INVALID_DATA]["message"].format(ad_name=record.ad_name or "未命名")
        reason = HUMAN_MESSAGES[IssueType.INVALID_DATA]["reason"].format(field="、".join(missing_fields))
        record.issues.append(Issue(
            issue_type=IssueType.INVALID_DATA,
            severity="error",
            message=message,
            details={"missing_fields": missing_fields},
            reviewable_reason=reason
        ))
        record.status = ConfirmationStatus.PENDING
        return record
    
    record.issues.extend(check_missing_materials(record))
    record.issues.extend(check_timeline_drift(record))
    record.issues.extend(check_silence_segments(record))
    
    if any(i.severity == "error" for i in record.issues):
        record.status = ConfirmationStatus.NEEDS_REVIEW
    elif any(i.severity == "warning" for i in record.issues):
        record.status = ConfirmationStatus.PENDING
    else:
        record.status = ConfirmationStatus.CONFIRMED
    
    return record


def validate_all(records: List[ScheduleRecord]) -> List[ScheduleRecord]:
    validated = [validate_record(r) for r in records]
    overlaps = check_overlaps(validated)
    
    for r1, r2, issue in overlaps:
        r1.issues.append(issue)
        if r1.status == ConfirmationStatus.CONFIRMED:
            r1.status = ConfirmationStatus.NEEDS_REVIEW
        
        issue2 = Issue(
            issue_type=issue.issue_type,
            severity=issue.severity,
            message=HUMAN_MESSAGES[IssueType.OVERLAP]["message"].format(
                ad_name=r2.ad_name, other_ad=r1.ad_name
            ),
            details={
                "overlap_seconds": issue.details["overlap_seconds"],
                "other_record_id": r1.record_id,
                "other_ad_name": r1.ad_name
            },
            reviewable_reason=issue.reviewable_reason
        )
        r2.issues.append(issue2)
        if r2.status == ConfirmationStatus.CONFIRMED:
            r2.status = ConfirmationStatus.NEEDS_REVIEW
    
    return validated
