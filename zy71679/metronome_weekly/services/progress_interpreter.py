from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models import PracticeRecord


def interpret_progress(
    db: Session,
    student_id: int,
    current_week_start: datetime,
    current_week_end: datetime,
    prev_week_start: Optional[datetime] = None,
    prev_week_end: Optional[datetime] = None,
) -> dict:
    current_records = (
        db.query(PracticeRecord)
        .filter(
            PracticeRecord.student_id == student_id,
            PracticeRecord.practiced_at >= current_week_start,
            PracticeRecord.practiced_at <= current_week_end,
        )
        .all()
    )

    if not prev_week_start or not prev_week_end:
        prev_week_end = current_week_start
        prev_week_start = datetime(
            prev_week_end.year, prev_week_end.month, prev_week_end.day
        )
        prev_week_start = prev_week_start.replace(
            day=prev_week_start.day - 7
            if prev_week_start.day > 7
            else prev_week_start.day
        )

    prev_records = (
        db.query(PracticeRecord)
        .filter(
            PracticeRecord.student_id == student_id,
            PracticeRecord.practiced_at >= prev_week_start,
            PracticeRecord.practiced_at <= prev_week_end,
        )
        .all()
    )

    current_avg = _safe_avg(
        [r.mean_deviation_ms for r in current_records if r.mean_deviation_ms is not None]
    )
    prev_avg = _safe_avg(
        [r.mean_deviation_ms for r in prev_records if r.mean_deviation_ms is not None]
    )

    current_weak_avg = _safe_avg(
        _extract_weak_devs(current_records)
    )
    prev_weak_avg = _safe_avg(
        _extract_weak_devs(prev_records)
    )

    current_strong_avg = _safe_avg(
        _extract_strong_devs(current_records)
    )
    prev_strong_avg = _safe_avg(
        _extract_strong_devs(prev_records)
    )

    current_misjudgments = sum(
        1 for r in current_records if r.weak_beat_misjudgment_flagged
    )
    current_missing_segments = sum(
        1 for r in current_records if r.missing_segment_flagged
    )

    overall_trend = _classify_trend(current_avg, prev_avg)
    weak_beat_trend = _classify_trend(current_weak_avg, prev_weak_avg)
    strong_beat_trend = _classify_trend(current_strong_avg, prev_strong_avg)

    summary = _generate_parent_summary(
        overall_trend=overall_trend,
        weak_beat_trend=weak_beat_trend,
        strong_beat_trend=strong_beat_trend,
        current_avg=current_avg,
        prev_avg=prev_avg,
        current_sessions=len(current_records),
        prev_sessions=len(prev_records),
        current_misjudgments=current_misjudgments,
        current_missing_segments=current_missing_segments,
    )

    return {
        "student_id": student_id,
        "current_week": {
            "start": current_week_start.isoformat(),
            "end": current_week_end.isoformat(),
            "sessions": len(current_records),
            "avg_deviation_ms": current_avg,
        },
        "previous_week": {
            "start": prev_week_start.isoformat() if prev_records else None,
            "end": prev_week_end.isoformat() if prev_records else None,
            "sessions": len(prev_records),
            "avg_deviation_ms": prev_avg,
        },
        "trends": {
            "overall": overall_trend,
            "weak_beats": weak_beat_trend,
            "strong_beats": strong_beat_trend,
        },
        "detail": {
            "current_avg_deviation_ms": round(current_avg, 2),
            "prev_avg_deviation_ms": round(prev_avg, 2),
            "improvement_ms": round(prev_avg - current_avg, 2),
            "weak_beat_misjudgments": current_misjudgments,
            "missing_bpm_segments": current_missing_segments,
        },
        "parent_summary": summary,
    }


def _safe_avg(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _extract_weak_devs(records: list) -> list[float]:
    devs = []
    for r in records:
        if r.weak_beat_deviations:
            devs.extend([abs(d.get("deviation_ms", 0)) for d in r.weak_beat_deviations])
    return devs


def _extract_strong_devs(records: list) -> list[float]:
    devs = []
    for r in records:
        if r.strong_beat_deviations:
            devs.extend([abs(d.get("deviation_ms", 0)) for d in r.strong_beat_deviations])
    return devs


def _classify_trend(current: float, previous: float) -> str:
    if previous == 0 and current == 0:
        return "no_data"
    if previous == 0:
        return "needs_attention"
    change_pct = (current - previous) / previous * 100
    if change_pct < -10:
        return "improving"
    elif change_pct > 10:
        return "declining"
    else:
        return "stable"


def _generate_parent_summary(
    overall_trend: str,
    weak_beat_trend: str,
    strong_beat_trend: str,
    current_avg: float,
    prev_avg: float,
    current_sessions: int,
    prev_sessions: int,
    current_misjudgments: int,
    current_missing_segments: int,
) -> str:
    parts = []

    if overall_trend == "improving":
        parts.append(f"本周节拍偏差平均 {current_avg:.1f}ms，较上周减少 {prev_avg - current_avg:.1f}ms，进步明显！")
    elif overall_trend == "declining":
        parts.append(f"本周节拍偏差平均 {current_avg:.1f}ms，较上周增加 {current_avg - prev_avg:.1f}ms，需要多加练习。")
    elif overall_trend == "stable":
        parts.append(f"本周节拍偏差平均 {current_avg:.1f}ms，与上周基本持平，继续坚持！")
    else:
        parts.append("暂无足够数据判断趋势。")

    if current_sessions < prev_sessions and prev_sessions > 0:
        parts.append(f"练习次数从上周 {prev_sessions} 次降到 {current_sessions} 次，建议保持练习频率。")

    if current_misjudgments > 0:
        parts.append(f"本周有 {current_misjudgments} 次弱拍偏差被标记为疑似误判（可能是刻意弱化/重音），老师已关注。")

    if current_missing_segments > 0:
        parts.append(f"本周有 {current_missing_segments} 次练习在变速过程中存在未记录的过渡段，已自动补推中间BPM。")

    return " ".join(parts)
