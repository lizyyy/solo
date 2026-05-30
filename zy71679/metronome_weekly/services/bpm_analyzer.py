from schemas import DeviationPoint, BPMSegment


def get_weak_beat_indices(time_signature: str) -> list[int]:
    ts_map = {
        "4/4": [1, 3],
        "3/4": [2],
        "6/8": [1, 3, 5],
        "2/4": [1],
    }
    return ts_map.get(time_signature, [1, 3])


def classify_deviations(
    raw_deviations: list[DeviationPoint],
    time_signature: str,
) -> tuple[list, list]:
    weak_indices = get_weak_beat_indices(time_signature)
    weak_beat_devs = []
    strong_beat_devs = []
    for d in raw_deviations:
        entry = {"beat_index": d.beat_index, "deviation_ms": d.deviation_ms}
        if d.beat_index % len(get_beat_pattern(time_signature)) in weak_indices:
            weak_beat_devs.append(entry)
        else:
            strong_beat_devs.append(entry)
    return weak_beat_devs, strong_beat_devs


def get_beat_pattern(time_signature: str) -> list[int]:
    patterns = {
        "4/4": [0, 1, 2, 3],
        "3/4": [0, 1, 2],
        "6/8": [0, 1, 2, 3, 4, 5],
        "2/4": [0, 1],
    }
    return patterns.get(time_signature, [0, 1, 2, 3])


def detect_weak_beat_misjudgment(
    weak_beat_deviations: list[dict],
    strong_beat_deviations: list[dict],
    threshold_ratio: float = 1.8,
) -> bool:
    if not weak_beat_deviations or not strong_beat_deviations:
        return False
    avg_weak = sum(d["deviation_ms"] for d in weak_beat_deviations) / len(
        weak_beat_deviations
    )
    avg_strong = sum(abs(d["deviation_ms"]) for d in strong_beat_deviations) / len(
        strong_beat_deviations
    )
    if avg_strong == 0:
        return avg_weak > 30.0
    ratio = avg_weak / avg_strong
    return ratio > threshold_ratio and avg_weak > 20.0


def detect_missing_bpm_segments(
    bpm_segments: list[BPMSegment],
    total_beats: int,
    gap_threshold: int = 8,
) -> tuple[list[dict], bool]:
    if not bpm_segments:
        return [], False

    sorted_segments = sorted(bpm_segments, key=lambda s: s.start_beat)
    result = []
    missing_flagged = False

    for seg in sorted_segments:
        entry = {
            "start_beat": seg.start_beat,
            "end_beat": seg.end_beat,
            "bpm": seg.bpm,
            "is_inferred": seg.is_inferred,
        }
        result.append(entry)

    for i in range(1, len(sorted_segments)):
        prev_end = sorted_segments[i - 1].end_beat
        curr_start = sorted_segments[i].start_beat
        gap = curr_start - prev_end - 1
        if gap > gap_threshold:
            inferred_bpm = _infer_transitional_bpm(
                sorted_segments[i - 1].bpm, sorted_segments[i].bpm
            )
            result.insert(
                i,
                {
                    "start_beat": prev_end + 1,
                    "end_beat": curr_start - 1,
                    "bpm": inferred_bpm,
                    "is_inferred": True,
                },
            )
            missing_flagged = True

    if sorted_segments and sorted_segments[0].start_beat > gap_threshold:
        result.insert(
            0,
            {
                "start_beat": 0,
                "end_beat": sorted_segments[0].start_beat - 1,
                "bpm": sorted_segments[0].bpm,
                "is_inferred": True,
            },
        )
        missing_flagged = True

    last_seg = sorted_segments[-1] if sorted_segments else None
    if last_seg and last_seg.end_beat < total_beats - gap_threshold:
        result.append(
            {
                "start_beat": last_seg.end_beat + 1,
                "end_beat": total_beats,
                "bpm": last_seg.bpm,
                "is_inferred": True,
            }
        )
        missing_flagged = True

    return result, missing_flagged


def _infer_transitional_bpm(bpm_low: int, bpm_high: int) -> int:
    return (bpm_low + bpm_high) // 2


def compute_deviations(
    raw_deviations: list[DeviationPoint],
) -> tuple[float, float]:
    if not raw_deviations:
        return 0.0, 0.0
    abs_devs = [abs(d.deviation_ms) for d in raw_deviations]
    return sum(abs_devs) / len(abs_devs), max(abs_devs)
