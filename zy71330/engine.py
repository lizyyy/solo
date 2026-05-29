from typing import List, Optional, Tuple, Dict
from models import (
    RhythmScore, StudentTap, SingleBeatResult, BeatJudgment,
    TupletGroup, TempoChange, Level, ScoreReport, PlaybackHint,
)


PERFECT_WINDOW_MS = 50.0
GOOD_WINDOW_MS = 120.0
RUSHED_WINDOW_MS = 300.0
DRAGGED_WINDOW_MS = 300.0
TUPLET_PERFECT_WINDOW_MS = 40.0
TUPLET_GOOD_WINDOW_MS = 80.0


def compute_expected_times(score: RhythmScore) -> List[float]:
    times: List[float] = []
    current_bpm = score.bpm
    current_time_ms = 0.0
    tempo_map: Dict[int, float] = {}
    for tc in score.tempo_changes:
        tempo_map[tc.beat_index] = tc.new_bpm

    for note in score.notes:
        if note.beat_index in tempo_map:
            current_bpm = tempo_map[note.beat_index]
        if not note.is_rest or note.beat_index == 0:
            times.append(current_time_ms)
        beat_duration_ms = (60_000.0 / current_bpm) * note.duration_beats
        current_time_ms += beat_duration_ms

    return times


def _judge_offset(
    offset_ms: float,
    is_tuplet: bool = False,
) -> BeatJudgment:
    p_win = TUPLET_PERFECT_WINDOW_MS if is_tuplet else PERFECT_WINDOW_MS
    g_win = TUPLET_GOOD_WINDOW_MS if is_tuplet else GOOD_WINDOW_MS

    if abs(offset_ms) <= p_win:
        return BeatJudgment.PERFECT
    if abs(offset_ms) <= g_win:
        return BeatJudgment.GOOD
    if offset_ms < -g_win:
        return BeatJudgment.RUSHED
    return BeatJudgment.DRAGGED


def _match_taps_to_beats(
    expected_times: List[float],
    taps: List[StudentTap],
    score: RhythmScore,
) -> Tuple[List[SingleBeatResult], List[StudentTap]]:
    tuplet_lookup: Dict[str, TupletGroup] = {g.group_id: g for g in score.tuplet_groups}
    beat_tuplet: Dict[int, Tuple[str, TupletGroup]] = {}
    for g in score.tuplet_groups:
        for idx in g.beat_indices:
            beat_tuplet[idx] = (g.group_id, g)

    used_taps: List[bool] = [False] * len(taps)
    results: List[SingleBeatResult] = []

    for i, exp_time in enumerate(expected_times):
        best_idx: Optional[int] = None
        best_offset: float = float("inf")
        is_tuplet = i in beat_tuplet
        g_win = TUPLET_GOOD_WINDOW_MS if is_tuplet else GOOD_WINDOW_MS

        for j, tap in enumerate(taps):
            if used_taps[j]:
                continue
            offset = tap.timestamp_ms - exp_time
            if abs(offset) < abs(best_offset) and abs(offset) <= RUSHED_WINDOW_MS + g_win:
                best_idx = j
                best_offset = offset

        if best_idx is not None and abs(best_offset) <= RUSHED_WINDOW_MS + GOOD_WINDOW_MS:
            used_taps[best_idx] = True
            judgment = _judge_offset(best_offset, is_tuplet)
            tuplet_gid = beat_tuplet[i][0] if i in beat_tuplet else None
            results.append(SingleBeatResult(
                beat_index=i,
                expected_time_ms=exp_time,
                actual_time_ms=taps[best_idx].timestamp_ms,
                judgment=judgment,
                offset_ms=round(best_offset, 2),
                is_tuplet=is_tuplet,
                tuplet_group_id=tuplet_gid,
            ))
        else:
            tuplet_gid = beat_tuplet[i][0] if i in beat_tuplet else None
            is_tup = i in beat_tuplet
            results.append(SingleBeatResult(
                beat_index=i,
                expected_time_ms=exp_time,
                actual_time_ms=None,
                judgment=BeatJudgment.MISSING,
                offset_ms=None,
                is_tuplet=is_tup,
                tuplet_group_id=tuplet_gid,
            ))

    extra_taps = [taps[j] for j in range(len(taps)) if not used_taps[j]]
    return results, extra_taps


def _check_tuplet_integrity(
    results: List[SingleBeatResult],
    score: RhythmScore,
) -> int:
    error_count = 0
    for g in score.tuplet_groups:
        group_results = [r for r in results if r.tuplet_group_id == g.group_id]
        present_results = [r for r in group_results if r.judgment != BeatJudgment.MISSING]
        if len(present_results) < g.subdivision_count:
            error_count += g.subdivision_count - len(present_results)
            continue
        actual_offsets = [r.offset_ms for r in present_results if r.offset_ms is not None]
        if len(actual_offsets) >= 2:
            for k in range(1, len(actual_offsets)):
                if abs(actual_offsets[k] - actual_offsets[k - 1]) > TUPLET_GOOD_WINDOW_MS * 2:
                    error_count += 1
    return error_count


def _detect_rushed_misjudgment(
    results: List[SingleBeatResult],
    taps: List[StudentTap],
    expected_times: List[float],
) -> List[SingleBeatResult]:
    corrected = list(results)
    for i, r in enumerate(corrected):
        if r.judgment == BeatJudgment.RUSHED and r.offset_ms is not None:
            if i + 1 < len(expected_times):
                next_exp = expected_times[i + 1]
                if r.actual_time_ms is not None:
                    dist_to_next = next_exp - r.actual_time_ms
                    if dist_to_next < PERFECT_WINDOW_MS:
                        corrected[i] = r.model_copy(update={
                            "judgment": BeatJudgment.GOOD,
                            "offset_ms": round(dist_to_next, 2),
                        })
    return corrected


def judge_level(
    level: Level,
    score: RhythmScore,
) -> Tuple[List[SingleBeatResult], List[StudentTap], int, Optional[float]]:
    expected_times = compute_expected_times(score)
    results, extra_taps = _match_taps_to_beats(expected_times, level.taps, score)
    results = _detect_rushed_misjudgment(results, level.taps, expected_times)

    for tap in extra_taps:
        closest = min(expected_times, key=lambda e: abs(tap.timestamp_ms - e))
        offset = tap.timestamp_ms - closest
        results.append(SingleBeatResult(
            beat_index=-1,
            expected_time_ms=closest,
            actual_time_ms=tap.timestamp_ms,
            judgment=BeatJudgment.EXTRA,
            offset_ms=round(offset, 2),
            is_tuplet=False,
            tuplet_group_id=None,
        ))

    tuplet_errors = _check_tuplet_integrity(results, score)

    tempo_score = _compute_tempo_adaptation(level, score, results)

    return results, extra_taps, tuplet_errors, tempo_score


def _compute_tempo_adaptation(
    level: Level,
    score: RhythmScore,
    results: List[SingleBeatResult],
) -> Optional[float]:
    if not score.tempo_changes:
        return None

    tempo_beat_indices = {tc.beat_index for tc in score.tempo_changes}
    adaptation_scores: List[float] = []

    for r in results:
        if r.beat_index in tempo_beat_indices and r.offset_ms is not None:
            if r.judgment in (BeatJudgment.PERFECT, BeatJudgment.GOOD):
                adaptation_scores.append(100.0)
            elif r.judgment == BeatJudgment.RUSHED:
                adaptation_scores.append(40.0)
            elif r.judgment == BeatJudgment.DRAGGED:
                adaptation_scores.append(50.0)
            else:
                adaptation_scores.append(0.0)

        for tc in score.tempo_changes:
            if r.beat_index >= tc.beat_index and r.beat_index <= tc.beat_index + 4:
                if r.offset_ms is not None:
                    if r.judgment == BeatJudgment.PERFECT:
                        adaptation_scores.append(100.0)
                    elif r.judgment == BeatJudgment.GOOD:
                        adaptation_scores.append(80.0)
                    elif r.judgment in (BeatJudgment.RUSHED, BeatJudgment.DRAGGED):
                        adaptation_scores.append(30.0)

    if not adaptation_scores:
        return None
    return round(sum(adaptation_scores) / len(adaptation_scores), 2)


def compute_score(results: List[SingleBeatResult], tuplet_errors: int, tempo_score: Optional[float]) -> float:
    total = len(results)
    if total == 0:
        return 0.0

    points = 0.0
    for r in results:
        if r.judgment == BeatJudgment.PERFECT:
            points += 1.0
        elif r.judgment == BeatJudgment.GOOD:
            points += 0.8
        elif r.judgment == BeatJudgment.RUSHED:
            points += 0.3
        elif r.judgment == BeatJudgment.DRAGGED:
            points += 0.3
        elif r.judgment == BeatJudgment.MISSING:
            points += 0.0
        elif r.judgment == BeatJudgment.EXTRA:
            points -= 0.2

    base_score = max(0.0, (points / total) * 80.0)
    tuplet_penalty = tuplet_errors * 5.0
    tempo_bonus = 0.0
    if tempo_score is not None:
        tempo_bonus = (tempo_score / 100.0) * 20.0

    final = base_score - tuplet_penalty + tempo_bonus
    return round(max(0.0, min(100.0, final)), 2)


def generate_playback_hints(results: List[SingleBeatResult], tuplet_errors: int) -> List[PlaybackHint]:
    hints: List[PlaybackHint] = []
    for r in results:
        if r.judgment == BeatJudgment.RUSHED:
            hints.append(PlaybackHint(
                beat_index=r.beat_index,
                message=f"第{r.beat_index + 1}拍抢拍{abs(r.offset_ms):.0f}ms，需要稳住节奏",
                severity="warning",
            ))
        elif r.judgment == BeatJudgment.DRAGGED:
            hints.append(PlaybackHint(
                beat_index=r.beat_index,
                message=f"第{r.beat_index + 1}拍拖拍{abs(r.offset_ms):.0f}ms，注意跟上节拍",
                severity="warning",
            ))
        elif r.judgment == BeatJudgment.MISSING:
            hints.append(PlaybackHint(
                beat_index=r.beat_index,
                message=f"第{r.beat_index + 1}拍漏敲了" + ("（连音）" if r.is_tuplet else ""),
                severity="error",
            ))
        elif r.judgment == BeatJudgment.EXTRA:
            hints.append(PlaybackHint(
                beat_index=r.beat_index,
                message="多敲了一拍，注意节拍数量",
                severity="warning",
            ))
    if tuplet_errors > 0:
        hints.append(PlaybackHint(
            beat_index=-1,
            message=f"连音部分有{tuplet_errors}处均匀度问题，注意三连音等分",
            severity="warning",
        ))
    return hints
