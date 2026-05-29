from __future__ import annotations

import statistics

from ..models import Track, StepResult, BpmAdjustment, FlagStatus

BPM_TYPICAL_MIN = 60
BPM_TYPICAL_MAX = 200
BPM_HALF_BEAT_LOW = 50
BPM_HALF_BEAT_HIGH = 300
BPM_CLUSTER_THRESHOLD = 0.15


def _detect_half_beat(bpm: float, neighbor_bpms: list[float]) -> BpmAdjustment:
    if bpm < BPM_HALF_BEAT_LOW:
        doubled = bpm * 2
        if BPM_TYPICAL_MIN <= doubled <= BPM_TYPICAL_MAX:
            return BpmAdjustment.DOUBLED
    if bpm > BPM_HALF_BEAT_HIGH:
        halved = bpm / 2
        if BPM_TYPICAL_MIN <= halved <= BPM_TYPICAL_MAX:
            return BpmAdjustment.HALVED
    if neighbor_bpms and bpm > 0:
        median = statistics.median(neighbor_bpms)
        ratio = bpm / median if median > 0 else 1.0
        if ratio > 1.7:
            halved = bpm / 2
            if BPM_TYPICAL_MIN <= halved <= BPM_TYPICAL_MAX:
                return BpmAdjustment.HALVED
        if ratio < 0.55:
            doubled = bpm * 2
            if BPM_TYPICAL_MIN <= doubled <= BPM_TYPICAL_MAX:
                return BpmAdjustment.DOUBLED
    return BpmAdjustment.NONE


def _apply_bpm_adjustment(bpm: float, adjustment: BpmAdjustment) -> float:
    if adjustment == BpmAdjustment.HALVED:
        return round(bpm / 2, 1)
    if adjustment == BpmAdjustment.DOUBLED:
        return round(bpm * 2, 1)
    return round(bpm, 1)


def normalize_bpm(tracks: list[Track]) -> tuple[list[Track], StepResult]:
    result = StepResult(step_name="bpm_normalize")
    modified = 0
    issues: list[str] = []

    valid_bpms = [t.bpm_raw for t in tracks if t.bpm_raw is not None]
    median_bpm = statistics.median(valid_bpms) if valid_bpms else 128.0

    for track in tracks:
        if track.bpm_raw is None:
            track.bpm_normalized = None
            track.flags.append("bpm_missing")
            if track.status == FlagStatus.OK:
                track.status = FlagStatus.REVIEW
                track.flags.append("auto_review:bpm_missing")
            issues.append(f"Track {track.track_id} ({track.title}): BPM missing")
            continue

        neighbors = []
        pos = track.position
        for t in tracks:
            if t.track_id != track.track_id and t.bpm_raw is not None:
                if abs(t.position - pos) <= 2:
                    neighbors.append(t.bpm_raw)
        if not neighbors:
            neighbors = valid_bpms

        adjustment = _detect_half_beat(track.bpm_raw, neighbors)

        if adjustment != BpmAdjustment.NONE:
            original = track.bpm_raw
            track.bpm_adjustment = adjustment
            track.bpm_normalized = _apply_bpm_adjustment(track.bpm_raw, adjustment)
            track.flags.append(f"bpm_adjusted:{adjustment.value}")
            modified += 1

            if track.bpm_normalized and median_bpm > 0:
                ratio = track.bpm_normalized / median_bpm
                if ratio > 1.7 or ratio < 0.55:
                    track.status = FlagStatus.REVIEW
                    track.flags.append("auto_review:bpm_adjustment_uncertain")
                    issues.append(
                        f"Track {track.track_id} ({track.title}): "
                        f"BPM {original} -> {track.bpm_normalized} ({adjustment.value}), "
                        f"but still far from median {median_bpm:.0f} - flagged for review"
                    )
                else:
                    issues.append(
                        f"Track {track.track_id} ({track.title}): "
                        f"BPM {original} -> {track.bpm_normalized} ({adjustment.value})"
                    )
        else:
            track.bpm_normalized = round(track.bpm_raw, 1)
            if not (BPM_TYPICAL_MIN <= track.bpm_normalized <= BPM_TYPICAL_MAX):
                track.status = FlagStatus.REVIEW
                track.flags.append("auto_review:bpm_out_of_range")
                issues.append(
                    f"Track {track.track_id} ({track.title}): "
                    f"BPM {track.bpm_normalized} out of typical range "
                    f"[{BPM_TYPICAL_MIN}-{BPM_TYPICAL_MAX}]"
                )

    result.tracks_modified = modified
    result.issues = issues
    result.meta["median_bpm"] = median_bpm
    result.meta["total_tracks"] = len(tracks)
    result.meta["review_count"] = sum(
        1 for t in tracks if t.status == FlagStatus.REVIEW and "bpm" in " ".join(t.flags)
    )
    return tracks, result
