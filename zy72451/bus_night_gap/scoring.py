from typing import List, Tuple, Optional
from .models import ScoreResult, RampRecord, ConstructionNotice
from .store import store


def calculate_score(notice_id: str) -> Tuple[ScoreResult, Optional[ScoreResult]]:
    notice = store.get_notice(notice_id)
    if not notice:
        raise ValueError(f"Notice {notice_id} not found")

    ramp_records = store.get_ramp_records_for_notice(notice_id)
    previous_score = store.get_latest_score(notice_id)

    factors = {}
    score = 0.0

    factors["has_any_ramp_record"] = 0.0
    if ramp_records:
        factors["has_any_ramp_record"] = 20.0
        score += 20.0

    ramp_count = len([r for r in ramp_records if r.has_ramp])
    factors["ramp_count"] = min(ramp_count * 15.0, 30.0)
    score += factors["ramp_count"]

    good_condition_count = len([r for r in ramp_records if r.has_ramp and r.ramp_condition == "good"])
    factors["good_condition"] = min(good_condition_count * 10.0, 20.0)
    score += factors["good_condition"]

    wide_enough_count = len([r for r in ramp_records if r.has_ramp and r.width_cm and r.width_cm >= 90])
    factors["width_compliant"] = min(wide_enough_count * 10.0, 20.0)
    score += factors["width_compliant"]

    has_raw_notes = any(r.raw_notes.strip() for r in ramp_records) or notice.raw_notes.strip()
    factors["has_original_notes"] = 10.0 if has_raw_notes else 0.0
    score += factors["has_original_notes"]

    score = min(score, 100.0)

    new_score = ScoreResult(
        notice_id=notice_id,
        score=score,
        factors=factors,
        version=(previous_score.version + 1) if previous_score else 1,
        ramp_records_used=[r.id for r in ramp_records],
    )

    store.add_score(new_score)
    return new_score, previous_score


def check_score_changed(notice_id: str) -> Tuple[bool, Optional[ScoreResult], Optional[ScoreResult]]:
    all_scores = store.get_all_scores(notice_id)
    if len(all_scores) < 2:
        return True, all_scores[-1] if all_scores else None, None

    latest = all_scores[-1]
    previous = all_scores[-2]

    return abs(latest.score - previous.score) > 0.001, latest, previous
