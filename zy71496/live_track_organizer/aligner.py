from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta

from .models import ConflictRecord, ConflictType, OrganizeResult, TrackInfo


def align_timestamps(result: OrganizeResult, tolerance_seconds: float = 2.0) -> OrganizeResult:
    timestamps: list[datetime] = []
    for track in result.tracks:
        ts = track.resolved_timestamp
        if ts:
            timestamps.append(ts)

    if not timestamps:
        result.timestamp_anchor = None
        return result

    anchor = _find_anchor(timestamps, tolerance_seconds)
    result.timestamp_anchor = anchor

    for track in result.tracks:
        if track.resolved_timestamp is None:
            _infer_timestamp(track, result, anchor)
        else:
            diff = abs((track.resolved_timestamp - anchor).total_seconds())
            if diff > tolerance_seconds and diff <= 3600:
                already = any(
                    c.conflict_type == ConflictType.TIMESTAMP_MISALIGN
                    and track.track_index in c.track_indices
                    for c in result.conflicts
                )
                if not already:
                    result.conflicts.append(
                        ConflictRecord(
                            conflict_type=ConflictType.TIMESTAMP_MISALIGN,
                            track_indices=[track.track_index],
                            description=(
                                f"时间戳偏离锚点: 轨道={track.track_index}, "
                                f"当前={track.resolved_timestamp.isoformat()}, "
                                f"锚点={anchor.isoformat()}, 差={diff:.1f}s"
                            ),
                            sources={
                                "track_ts": track.resolved_timestamp.isoformat(),
                                "anchor_ts": anchor.isoformat(),
                            },
                            resolution=f"修正为锚点时间: {anchor.isoformat()}",
                            resolved=True,
                        )
                    )
                    track.resolved_timestamp = anchor
                    result.misaligned_timestamp_count += 1

    result.conflict_count = len(result.conflicts)
    _assign_new_names(result.tracks, result)
    return result


def _find_anchor(timestamps: list[datetime], tolerance: float) -> datetime:
    if not timestamps:
        return datetime.now()

    rounded: list[datetime] = []
    for ts in timestamps:
        epoch = ts.timestamp()
        rounded_ts = datetime.fromtimestamp(round(epoch / tolerance) * tolerance)
        rounded.append(rounded_ts)

    counter = Counter(rounded)
    most_common = counter.most_common(1)[0][0]

    candidates = [ts for ts in timestamps if abs((ts - most_common).total_seconds()) <= tolerance]
    if candidates:
        return min(candidates)

    return min(timestamps)


def _infer_timestamp(track: TrackInfo, result: OrganizeResult, anchor: datetime) -> None:
    part = track.resolved_part
    if part == "Drums":
        track.resolved_timestamp = anchor
    elif part == "Bass":
        track.resolved_timestamp = anchor
    elif part == "Vocals":
        track.resolved_timestamp = anchor + timedelta(milliseconds=50)
    else:
        track.resolved_timestamp = anchor

    result.conflicts.append(
        ConflictRecord(
            conflict_type=ConflictType.TIMESTAMP_MISALIGN,
            track_indices=[track.track_index],
            description=(
                f"时间戳缺失已推断: 轨道={track.track_index}, "
                f"推断值={track.resolved_timestamp.isoformat()}, 基于锚点推断"
            ),
            sources={"inferred_from": anchor.isoformat()},
            resolution=f"推断为锚点时间: {anchor.isoformat()}",
            resolved=True,
        )
    )


def _assign_new_names(tracks: list[TrackInfo], result: OrganizeResult) -> None:
    ts = result.timestamp_anchor
    ts_str = ts.strftime("%Y%m%d_%H%M%S") if ts else "UNKNOWN_TS"

    for track in tracks:
        part = track.resolved_part or "Unknown"
        channel = track.resolved_channel_name or f"Track_{track.track_index:03d}"

        dupe_count = 0
        for group in result.channel_groups:
            if track.track_index in group.track_indices:
                if group.duplicate_count > 0:
                    pos = group.track_indices.index(track.track_index)
                    if pos > 0:
                        dupe_count = pos
                break

        suffix = f"_{dupe_count}" if dupe_count > 0 else ""
        ext_idx = track.original_name.rfind(".")
        ext = track.original_name[ext_idx:] if ext_idx >= 0 else ".wav"

        track.new_name = f"{ts_str}_{part}_{channel}{suffix}{ext}"
        result.renamed_count += 1
