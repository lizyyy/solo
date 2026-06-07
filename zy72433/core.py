import uuid
from datetime import datetime
from typing import List, Optional, Tuple
from models import (
    DemoReview,
    TunerComment,
    RehearsalSignup,
    RehearsalChangeRecord,
    ReviewReport,
    ChangeReason,
    NextStep,
    TrackStatus,
)


REWORK_KEYWORDS = ["返工", "重录", "重唱", "重新", "不对", "错", "口径", "补录", "再来", "不行", "有问题", "需要改"]


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


def detect_rework_reason(comment: str) -> Tuple[bool, Optional[str]]:
    for keyword in REWORK_KEYWORDS:
        if keyword in comment:
            return True, f"检测到关键词: {keyword}"
    return False, None


def import_tuner_comment(
    song_name: str, track_name: str, comment: str
) -> DemoReview:
    has_rework, reason = detect_rework_reason(comment)

    tuner_comment = TunerComment(
        id=generate_id(),
        song_name=song_name,
        track_name=track_name,
        comment=comment,
        import_time=datetime.now(),
        has_rework_reason=has_rework,
        rework_reason=reason,
    )

    review = DemoReview(
        id=generate_id(),
        song_name=song_name,
        tuner_comment=tuner_comment,
    )

    if has_rework:
        change_record = RehearsalChangeRecord(
            id=generate_id(),
            song_name=song_name,
            track_name=track_name,
            why_kept="调音师留言中发现返工原因，待复核确认",
            missing_materials=["版权运营复核意见"],
            next_step=NextStep.CONTACT_XIAOLU,
            reason=ChangeReason.SUPPLEMENT_REWORK if "补录" in comment else ChangeReason.WRONG_CALIBER,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            operator="系统",
        )
        review.change_records.append(change_record)
    else:
        change_record = RehearsalChangeRecord(
            id=generate_id(),
            song_name=song_name,
            track_name=track_name,
            why_kept="调音师留言无明显问题，待排练群接龙补充确认",
            missing_materials=["排练群接龙信息"],
            next_step=NextStep.WAIT_FOR_REHEARSAL,
            reason=ChangeReason.WRONG_CALIBER,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            operator="系统",
        )
        review.change_records.append(change_record)

    review.review_report = ReviewReport(
        id=generate_id(),
        song_name=song_name,
        import_tuner_time=datetime.now(),
        change_records=review.change_records,
        status="第一步完成: 调音师留言已导入",
    )

    return review


def supplement_rehearsal_signup(
    review: DemoReview, signer: str, remark: str
) -> DemoReview:
    signup = RehearsalSignup(
        id=generate_id(),
        song_name=review.song_name,
        signer=signer,
        remark=remark,
        signup_time=datetime.now(),
    )
    review.rehearsal_signups.append(signup)

    has_rework_in_remark, rework_reason = detect_rework_reason(remark)

    if review.tuner_comment and review.tuner_comment.has_rework_reason:
        why_kept = "调音师留言有返工原因，排练接龙备注需交叉验证"
        missing_materials = ["版权运营复核意见"]
        next_step = NextStep.CONTACT_XIAOLU
        reason = ChangeReason.SUPPLEMENT_REWORK
    elif has_rework_in_remark:
        why_kept = f"排练接龙备注发现问题: {rework_reason}"
        missing_materials = ["版权运营复核意见"]
        next_step = NextStep.CONTACT_XIAOLU
        reason = ChangeReason.SUPPLEMENT_REWORK
    else:
        why_kept = "调音师留言与排练接龙信息一致，无明显问题"
        missing_materials = []
        next_step = NextStep.NO_ACTION
        reason = ChangeReason.WRONG_CALIBER

    new_change_record = RehearsalChangeRecord(
        id=generate_id(),
        song_name=review.song_name,
        track_name=review.tuner_comment.track_name if review.tuner_comment else "未知",
        why_kept=why_kept,
        missing_materials=missing_materials,
        next_step=next_step,
        reason=reason,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        operator="版权运营小鹿",
    )
    review.change_records.append(new_change_record)

    if review.review_report:
        review.review_report.supplement_signup_time = datetime.now()
        review.review_report.change_records = review.change_records
        if has_rework_in_remark or (review.tuner_comment and review.tuner_comment.has_rework_reason):
            review.review_report.status = "第二步完成: 排练接龙已补录，发现返工原因待版权运营复核"
        else:
            review.review_report.status = "第二步完成: 排练接龙已补录，信息一致"

    review.updated_at = datetime.now()
    return review


def manual_correct(
    review: DemoReview,
    track_name: Optional[str] = None,
    why_kept: Optional[str] = None,
    missing_materials: Optional[List[str]] = None,
    next_step: Optional[NextStep] = None,
) -> DemoReview:
    current_track = track_name or (
        review.tuner_comment.track_name if review.tuner_comment else "未知"
    )

    last_record = review.change_records[-1] if review.change_records else None

    change_record = RehearsalChangeRecord(
        id=generate_id(),
        song_name=review.song_name,
        track_name=current_track,
        why_kept=why_kept or (last_record.why_kept if last_record else "人工修正"),
        missing_materials=missing_materials or (last_record.missing_materials if last_record else []),
        next_step=next_step or (last_record.next_step if last_record else NextStep.NO_ACTION),
        reason=ChangeReason.MANUAL_CORRECTION,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        operator="版权运营小鹿",
    )
    review.change_records.append(change_record)

    if review.review_report:
        review.review_report.change_records = review.change_records
        review.review_report.status = "人工修正已应用"
        review.review_report.notes = "经过人工复核，状态已更新"

    review.updated_at = datetime.now()
    return review


def rerun_review(review: DemoReview) -> DemoReview:
    if review.tuner_comment:
        has_rework, reason = detect_rework_reason(review.tuner_comment.comment)
        review.tuner_comment.has_rework_reason = has_rework
        review.tuner_comment.rework_reason = reason

    all_remarks = " ".join([s.remark for s in review.rehearsal_signups])
    has_rework_in_remarks, _ = detect_rework_reason(all_remarks)

    if review.tuner_comment and review.tuner_comment.has_rework_reason:
        why_kept = "重跑检测: 调音师留言仍有返工原因"
        missing_materials = ["版权运营复核意见"]
        next_step = NextStep.CONTACT_XIAOLU
        reason = ChangeReason.RERUN
    elif has_rework_in_remarks:
        why_kept = "重跑检测: 排练接龙备注有问题"
        missing_materials = ["版权运营复核意见"]
        next_step = NextStep.CONTACT_XIAOLU
        reason = ChangeReason.RERUN
    else:
        why_kept = "重跑检测: 所有信息正常"
        missing_materials = []
        next_step = NextStep.NO_ACTION
        reason = ChangeReason.RERUN

    change_record = RehearsalChangeRecord(
        id=generate_id(),
        song_name=review.song_name,
        track_name=review.tuner_comment.track_name if review.tuner_comment else "未知",
        why_kept=why_kept,
        missing_materials=missing_materials,
        next_step=next_step,
        reason=reason,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        operator="系统(重跑)",
    )
    review.change_records.append(change_record)

    if review.review_report:
        review.review_report.change_records = review.change_records
        review.review_report.status = "重跑完成"

    review.updated_at = datetime.now()
    return review


def review_rework_complete(review: DemoReview) -> DemoReview:
    change_record = RehearsalChangeRecord(
        id=generate_id(),
        song_name=review.song_name,
        track_name=review.tuner_comment.track_name if review.tuner_comment else "未知",
        why_kept="版权运营已复核，返工问题已解决",
        missing_materials=[],
        next_step=NextStep.NO_ACTION,
        reason=ChangeReason.MANUAL_CORRECTION,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        operator="版权运营",
    )
    review.change_records.append(change_record)

    if review.review_report:
        review.review_report.change_records = review.change_records
        review.review_report.status = "已完成 - 返工复核通过"

    review.updated_at = datetime.now()
    return review


def get_track_status(review: DemoReview) -> TrackStatus:
    if not review.change_records:
        return TrackStatus.NORMAL

    last_record = review.change_records[-1]

    if last_record.next_step in [NextStep.CONTACT_XIAOLU, NextStep.CONTACT_COPYRIGHT_OPS]:
        return TrackStatus.PENDING_REVIEW
    elif last_record.reason in [ChangeReason.SUPPLEMENT_REWORK, ChangeReason.WRONG_CALIBER]:
        if last_record.missing_materials:
            return TrackStatus.NEEDS_REWORK
        return TrackStatus.NORMAL
    elif last_record.reason == ChangeReason.MANUAL_CORRECTION and not last_record.missing_materials:
        return TrackStatus.COMPLETED
    else:
        return TrackStatus.NORMAL
