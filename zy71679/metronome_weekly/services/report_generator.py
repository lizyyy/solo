from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models import PracticeRecord, TeacherComment, WeeklyReport
from services.deviation_stats import compute_weekly_stats, compute_segment_comparison
from services.progress_interpreter import interpret_progress


def generate_weekly_report(
    db: Session,
    student_id: int,
    week_start: datetime,
    week_end: datetime,
) -> dict:
    stats = compute_weekly_stats(db, student_id, week_start, week_end)
    segments = compute_segment_comparison(db, student_id, week_start, week_end)
    progress = interpret_progress(db, student_id, week_start, week_end)

    existing_report = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.student_id == student_id,
            WeeklyReport.week_start == week_start,
            WeeklyReport.week_end == week_end,
        )
        .first()
    )

    current_comment = (
        db.query(TeacherComment)
        .filter(
            TeacherComment.student_id == student_id,
            TeacherComment.week_start == week_start,
            TeacherComment.is_current == True,
        )
        .first()
    )

    records = (
        db.query(PracticeRecord)
        .filter(
            PracticeRecord.student_id == student_id,
            PracticeRecord.practiced_at >= week_start,
            PracticeRecord.practiced_at <= week_end,
        )
        .all()
    )

    bpm_values = [r.bpm for r in records]
    bpm_range = {
        "min": min(bpm_values) if bpm_values else 0,
        "max": max(bpm_values) if bpm_values else 0,
    }

    report_data = {
        "student_id": student_id,
        "week_start": week_start,
        "week_end": week_end,
        "total_practice_sessions": stats["session_count"],
        "total_duration_seconds": stats["total_duration_seconds"],
        "avg_deviation_ms": stats["avg_deviation_ms"],
        "best_deviation_ms": stats["best_deviation_ms"],
        "bpm_range": bpm_range,
        "segment_summary": segments,
        "progress_interpretation": progress,
        "comment_id": current_comment.id if current_comment else None,
    }

    if existing_report:
        for key, value in report_data.items():
            setattr(existing_report, key, value)
        existing_report.generated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_report)
        report = existing_report
    else:
        report = WeeklyReport(**report_data)
        db.add(report)
        db.commit()
        db.refresh(report)

    return {
        "id": report.id,
        "student_id": report.student_id,
        "week_start": report.week_start.isoformat(),
        "week_end": report.week_end.isoformat(),
        "total_practice_sessions": report.total_practice_sessions,
        "total_duration_seconds": report.total_duration_seconds,
        "avg_deviation_ms": report.avg_deviation_ms,
        "best_deviation_ms": report.best_deviation_ms,
        "bpm_range": report.bpm_range,
        "segment_summary": report.segment_summary,
        "progress_interpretation": report.progress_interpretation,
        "comment_id": report.comment_id,
        "generated_at": report.generated_at.isoformat(),
    }


def export_report(
    db: Session,
    student_id: int,
    week_start: datetime,
    week_end: datetime,
    fmt: str = "json",
) -> dict:
    report_data = generate_weekly_report(db, student_id, week_start, week_end)
    current_comment = None
    if report_data.get("comment_id"):
        current_comment = db.query(TeacherComment).get(report_data["comment_id"])

    export_data = {
        "id": report_data["id"],
        "student_id": report_data["student_id"],
        "week_start": report_data["week_start"],
        "week_end": report_data["week_end"],
        "total_practice_sessions": report_data["total_practice_sessions"],
        "total_duration_seconds": report_data["total_duration_seconds"],
        "avg_deviation_ms": report_data["avg_deviation_ms"],
        "best_deviation_ms": report_data["best_deviation_ms"],
        "bpm_range": report_data["bpm_range"],
        "segment_summary": report_data["segment_summary"],
        "progress_interpretation": report_data["progress_interpretation"],
        "teacher_comment": current_comment.content if current_comment else None,
        "comment_version": current_comment.version if current_comment else None,
        "generated_at": report_data["generated_at"],
    }

    if fmt == "csv":
        lines = []
        lines.append("字段,值")
        lines.append(f"学生ID,{export_data['student_id']}")
        lines.append(f"周开始,{export_data['week_start']}")
        lines.append(f"周结束,{export_data['week_end']}")
        lines.append(f"练习次数,{export_data['total_practice_sessions']}")
        lines.append(f"总时长(秒),{export_data['total_duration_seconds']}")
        lines.append(f"平均偏差(ms),{export_data['avg_deviation_ms']}")
        lines.append(f"最佳偏差(ms),{export_data['best_deviation_ms']}")
        lines.append(f"BPM范围,{export_data['bpm_range']}")
        lines.append(f"家长总结,{export_data['progress_interpretation'].get('parent_summary', '')}")
        if export_data["teacher_comment"]:
            lines.append(f"老师点评,{export_data['teacher_comment']}")
        return {"format": "csv", "data": "\n".join(lines)}

    return {"format": "json", "data": export_data}
