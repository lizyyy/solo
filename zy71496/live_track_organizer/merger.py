from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import datetime

from .models import (
    ChannelGroup,
    ConflictRecord,
    ConflictType,
    InfoSource,
    OrganizeResult,
    TrackInfo,
)
from .scanner import PART_TABLE, _normalize_channel_name


def merge_channels(
    tracks: list[TrackInfo],
    channel_table: dict[int, str] | None = None,
    part_assignment: dict[str, str] | None = None,
) -> OrganizeResult:
    result = OrganizeResult(total_tracks=len(tracks), tracks=tracks)

    for track in tracks:
        _enrich_from_table(track, channel_table, part_assignment)
        _resolve_channel(track, result.conflicts)
        _resolve_part(track, result.conflicts)
        _resolve_timestamp(track, result.conflicts)

    _detect_duplicates(tracks, result)

    for group in result.channel_groups:
        if group.duplicate_count > 0:
            result.duplicate_channel_count += group.duplicate_count

    result.conflict_count = len(result.conflicts)
    result.misaligned_timestamp_count = sum(
        1 for c in result.conflicts if c.conflict_type == ConflictType.TIMESTAMP_MISALIGN
    )
    result.missing_part_count = sum(
        1 for c in result.conflicts if c.conflict_type == ConflictType.PART_MISSING
    )

    return result


def _enrich_from_table(
    track: TrackInfo,
    channel_table: dict[int, str] | None,
    part_assignment: dict[str, str] | None,
) -> None:
    if channel_table and track.track_index in channel_table:
        track.channel_name_from_table = channel_table[track.track_index]

    if part_assignment:
        for key, part in part_assignment.items():
            raw_names = [
                track.channel_name_from_filename,
                track.channel_name_from_metadata,
                track.channel_name_from_table,
            ]
            if key.lower() in [n.lower() for n in raw_names if n]:
                track.part_from_assignment = part
                break


def _resolve_channel(track: TrackInfo, conflicts: list[ConflictRecord]) -> None:
    sources: dict[str, str] = {}
    if track.channel_name_from_filename:
        norm = _normalize_channel_name(track.channel_name_from_filename)
        sources[InfoSource.FILENAME.value] = norm
    if track.channel_name_from_metadata:
        norm = _normalize_channel_name(track.channel_name_from_metadata)
        sources[InfoSource.METADATA.value] = norm
    if track.channel_name_from_table:
        norm = _normalize_channel_name(track.channel_name_from_table)
        sources[InfoSource.CHANNEL_TABLE.value] = norm

    unique_values = set(sources.values())

    if not unique_values:
        track.resolved_channel_name = f"Track_{track.track_index:03d}"
        return

    if len(unique_values) == 1:
        track.resolved_channel_name = unique_values.pop()
        return

    conflicts.append(
        ConflictRecord(
            conflict_type=ConflictType.TRIPLE_CONFLICT,
            track_indices=[track.track_index],
            description=f"通道名三源不一致: {sources}",
            sources=sources,
        )
    )

    priority = [
        InfoSource.CHANNEL_TABLE.value,
        InfoSource.METADATA.value,
        InfoSource.FILENAME.value,
    ]
    for p in priority:
        if p in sources:
            track.resolved_channel_name = sources[p]
            for c in conflicts:
                if (
                    c.conflict_type == ConflictType.TRIPLE_CONFLICT
                    and track.track_index in c.track_indices
                    and not c.resolved
                ):
                    c.resolution = f"优先采用 {p}: {sources[p]}"
                    c.resolved = True
            break


def _resolve_part(track: TrackInfo, conflicts: list[ConflictRecord]) -> None:
    candidates: list[str] = []

    if track.resolved_channel_name:
        canonical = _normalize_channel_name(track.resolved_channel_name)
        if canonical in PART_TABLE:
            candidates.append(PART_TABLE[canonical])

    if track.part_from_assignment:
        candidates.append(track.part_from_assignment)

    if track.part_from_filename:
        raw = track.part_from_filename.strip()
        if not re.match(r"^\d+$", raw) and len(raw) > 1 and raw.upper() not in {"L", "R", "LEFT", "RIGHT"}:
            candidates.append(raw)

    if not candidates:
        track.resolved_part = "Unknown"
        conflicts.append(
            ConflictRecord(
                conflict_type=ConflictType.PART_MISSING,
                track_indices=[track.track_index],
                description=f"声部缺失: {track.original_name} 无任何声部信息",
            )
        )
        return

    unique_parts = list(dict.fromkeys(candidates))
    track.resolved_part = unique_parts[0]

    if len(unique_parts) > 1:
        conflicts.append(
            ConflictRecord(
                conflict_type=ConflictType.TRIPLE_CONFLICT,
                track_indices=[track.track_index],
                description=f"声部信息不一致: {unique_parts}",
                sources={"candidates": str(unique_parts)},
                resolution=f"采用首个: {unique_parts[0]}",
                resolved=True,
            )
        )


def _resolve_timestamp(track: TrackInfo, conflicts: list[ConflictRecord]) -> None:
    ts_fn = track.timestamp_from_filename
    ts_meta = track.timestamp_from_metadata

    if ts_fn and ts_meta:
        diff = abs((ts_fn - ts_meta).total_seconds())
        if diff > 2.0:
            conflicts.append(
                ConflictRecord(
                    conflict_type=ConflictType.TIMESTAMP_MISALIGN,
                    track_indices=[track.track_index],
                    description=f"时间戳错位: 文件名={ts_fn}, 元数据={ts_meta}, 差={diff:.1f}s",
                    sources={
                        InfoSource.FILENAME.value: ts_fn.isoformat(),
                        InfoSource.METADATA.value: ts_meta.isoformat(),
                    },
                )
            )
            track.resolved_timestamp = ts_meta
            for c in conflicts:
                if (
                    c.conflict_type == ConflictType.TIMESTAMP_MISALIGN
                    and track.track_index in c.track_indices
                    and not c.resolved
                ):
                    c.resolution = f"采用元数据时间戳: {ts_meta.isoformat()}"
                    c.resolved = True
        else:
            track.resolved_timestamp = ts_meta
    elif ts_meta:
        track.resolved_timestamp = ts_meta
    elif ts_fn:
        track.resolved_timestamp = ts_fn
    else:
        track.resolved_timestamp = None


def _detect_duplicates(tracks: list[TrackInfo], result: OrganizeResult) -> None:
    name_map: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for pos, t in enumerate(tracks):
        key = t.resolved_channel_name.lower()
        name_map[key].append((pos, t.track_index))

    groups: list[ChannelGroup] = []
    for canonical_lower, pos_index_pairs in name_map.items():
        positions = [p for p, _ in pos_index_pairs]
        track_indices = [ti for _, ti in pos_index_pairs]
        representative = tracks[positions[0]] if positions else None
        if not representative:
            continue
        canonical = representative.resolved_channel_name
        group = ChannelGroup(
            canonical_name=canonical,
            part=representative.resolved_part,
            track_indices=track_indices,
            duplicate_count=max(0, len(positions) - 1),
        )
        groups.append(group)

        if len(positions) > 1:
            result.conflicts.append(
                ConflictRecord(
                    conflict_type=ConflictType.CHANNEL_DUPLICATE,
                    track_indices=track_indices,
                    description=f"通道重名: '{canonical}' 出现 {len(positions)} 次 (轨道 {track_indices})",
                    sources={"count": str(len(positions))},
                )
            )

    result.channel_groups = sorted(groups, key=lambda g: g.canonical_name)
