"""
Validator module - detects gaps, overlaps, clock rewinds, low bitrate, missing frames.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from .parser import ParsedData, Clip, ClockEvent, FFProbeSummary


@dataclass
class Issue:
    camera_id: str
    issue_type: str
    detail: str
    timestamp: Optional[str] = None
    severity: str = "warning"


@dataclass
class CameraTimeline:
    camera_id: str
    clips: list[Clip]
    issues: list[Issue] = field(default_factory=list)


@dataclass
class ValidationResult:
    timelines: dict[str, CameraTimeline]
    all_issues: list[Issue]
    gap_count: int = 0
    overlap_count: int = 0
    clock_rewind_count: int = 0
    low_bitrate_count: int = 0
    suspected_dropped_frames_count: int = 0


def _parse_ts(ts: str) -> datetime:
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            pass
    raise ValueError(f"Cannot parse timestamp: {ts}")


def _clip_duration(clip: Clip) -> float:
    try:
        s = _parse_ts(clip.start_time)
        e = _parse_ts(clip.end_time)
        return (e - s).total_seconds()
    except Exception:
        return clip.duration


def _crosses_midnight(start: datetime, end: datetime) -> bool:
    return start.date() != end.date()


def _split_crossmidnight(clip: Clip) -> list[Clip]:
    start = _parse_ts(clip.start_time)
    end = _parse_ts(clip.end_time)
    if not _crosses_midnight(start, end):
        return [clip]

    midnight = datetime(start.year, start.month, start.day, 23, 59, 59, 999999)
    first = Clip(
        camera_id=clip.camera_id,
        filename=clip.filename,
        start_time=clip.start_time,
        end_time=midnight.isoformat() + "Z",
        duration=(midnight - start).total_seconds(),
        file_size=clip.file_size,
    )
    next_day_start = datetime(end.year, end.month, end.day, 0, 0, 0)
    second = Clip(
        camera_id=clip.camera_id,
        filename=clip.filename,
        start_time=next_day_start.isoformat() + "Z",
        end_time=clip.end_time,
        duration=(end - next_day_start).total_seconds(),
        file_size=clip.file_size,
    )
    return [first, second]


def _check_overlapping_filenames(clips: list[Clip]) -> list[Issue]:
    filename_camera: dict[str, set[str]] = {}
    for clip in clips:
        fn = clip.filename
        cid = clip.camera_id
        if fn not in filename_camera:
            filename_camera[fn] = set()
        filename_camera[fn].add(cid)

    issues = []
    for fn, cameras in filename_camera.items():
        if len(cameras) > 1:
            issues.append(Issue(
                camera_id=",".join(sorted(cameras)),
                issue_type="duplicate_filename_different_camera",
                detail=f"Filename '{fn}' used by multiple cameras: {sorted(cameras)}",
                severity="error",
            ))
    return issues


def build_timelines(data: ParsedData) -> dict[str, CameraTimeline]:
    by_camera: dict[str, list[Clip]] = {}
    for clip in data.clips:
        cid = clip.camera_id
        if cid not in by_camera:
            by_camera[cid] = []
        by_camera[cid].append(clip)

    timelines = {}
    for cid, clips in by_camera.items():
        flat: list[Clip] = []
        for c in clips:
            flat.extend(_split_crossmidnight(c))
        flat.sort(key=lambda x: _parse_ts(x.start_time).timestamp())
        timelines[cid] = CameraTimeline(camera_id=cid, clips=flat)

    for issue in _check_overlapping_filenames(data.clips):
        cid_parts = issue.camera_id.split(",")
        for cid in cid_parts:
            if cid in timelines:
                timelines[cid].issues.append(issue)

    return timelines


def _expected_duration(clip: Clip, ffprobe: FFProbeSummary | None) -> float:
    if ffprobe:
        return ffprobe.duration
    try:
        return _clip_duration(clip)
    except Exception:
        return 0.0


def _check_gaps_and_overlaps(timeline: CameraTimeline) -> tuple[list[Issue], int, int]:
    issues = []
    gap_count = 0
    overlap_count = 0
    clips = timeline.clips
    for i in range(len(clips) - 1):
        cur = clips[i]
        nxt = clips[i + 1]
        try:
            cur_end = _parse_ts(cur.end_time)
            nxt_start = _parse_ts(nxt.start_time)
        except Exception:
            continue
        diff = (nxt_start - cur_end).total_seconds()
        if diff > 1.0:
            issues.append(Issue(
                camera_id=timeline.camera_id,
                issue_type="gap",
                detail=f"Gap of {diff:.1f}s between {cur.filename} and {nxt.filename}",
                timestamp=cur_end.isoformat() + "Z",
                severity="warning",
            ))
            gap_count += 1
        elif diff < -0.1:
            overlap_sec = abs(diff)
            issues.append(Issue(
                camera_id=timeline.camera_id,
                issue_type="overlap",
                detail=f"Overlap of {overlap_sec:.1f}s between {cur.filename} and {nxt.filename}",
                timestamp=cur_end.isoformat() + "Z",
                severity="error",
            ))
            overlap_count += 1
    return issues, gap_count, overlap_count


def _check_clock_rewinds(timeline: CameraTimeline, events: list[ClockEvent]) -> tuple[list[Issue], int]:
    issues = []
    rewind_count = 0
    camera_events = [e for e in events if e.camera_id == timeline.camera_id and e.event_type == "clock_rewind"]
    for ev in camera_events:
        issues.append(Issue(
            camera_id=timeline.camera_id,
            issue_type="clock_rewind",
            detail=f"Device clock rewound from {ev.old_value} to {ev.new_value}",
            timestamp=ev.timestamp,
            severity="error",
        ))
        rewind_count += 1
    return issues, rewind_count


def _check_low_bitrate(
    timeline: CameraTimeline,
    ffprobe: dict[str, FFProbeSummary],
    threshold: int,
) -> tuple[list[Issue], int]:
    issues = []
    low_count = 0
    for clip in timeline.clips:
        probe = ffprobe.get(clip.filename)
        if probe and probe.bitrate < threshold:
            issues.append(Issue(
                camera_id=timeline.camera_id,
                issue_type="low_bitrate",
                detail=f"{clip.filename}: bitrate {probe.bitrate} < {threshold} kbps",
                timestamp=clip.start_time,
                severity="warning",
            ))
            low_count += 1
    return issues, low_count


def _check_suspected_dropped_frames(
    timeline: CameraTimeline,
    ffprobe: dict[str, FFProbeSummary],
    frame_drop_gap_threshold: float,
) -> tuple[list[Issue], int]:
    issues = []
    drop_count = 0
    for i in range(len(timeline.clips) - 1):
        cur = timeline.clips[i]
        nxt = timeline.clips[i + 1]
        try:
            cur_end = _parse_ts(cur.end_time)
            nxt_start = _parse_ts(nxt.start_time)
        except Exception:
            continue
        gap = (nxt_start - cur_end).total_seconds()
        if 0.1 < gap <= frame_drop_gap_threshold:
            issues.append(Issue(
                camera_id=timeline.camera_id,
                issue_type="suspected_dropped_frames",
                detail=f"Short gap {gap:.2f}s between {cur.filename} and {nxt.filename} - possible dropped frames",
                timestamp=cur_end.isoformat() + "Z",
                severity="info",
            ))
            drop_count += 1
    return issues, drop_count


def validate(
    timelines: dict[str, CameraTimeline],
    data: ParsedData,
    rules: dict[str, Any],
) -> ValidationResult:
    low_bitrate_threshold = rules.get("thresholds", {}).get("low_bitrate_kbps", 256)
    frame_drop_gap_threshold = rules.get("thresholds", {}).get("frame_drop_gap_sec", 2.0)

    all_issues: list[Issue] = []
    total_gaps = 0
    total_overlaps = 0
    total_rewinds = 0
    total_low_br = 0
    total_drops = 0

    for cid, timeline in timelines.items():
        g_issues, g_cnt, o_cnt = _check_gaps_and_overlaps(timeline)
        r_issues, r_cnt = _check_clock_rewinds(timeline, data.clock_events)
        lb_issues, lb_cnt = _check_low_bitrate(timeline, data.ffprobe_summaries, low_bitrate_threshold)
        fd_issues, fd_cnt = _check_suspected_dropped_frames(timeline, data.ffprobe_summaries, frame_drop_gap_threshold)

        combined = g_issues + r_issues + lb_issues + fd_issues
        timeline.issues.extend(combined)
        all_issues.extend(combined)
        total_gaps += g_cnt
        total_overlaps += o_cnt
        total_rewinds += r_cnt
        total_low_br += lb_cnt
        total_drops += fd_cnt

    return ValidationResult(
        timelines=timelines,
        all_issues=all_issues,
        gap_count=total_gaps,
        overlap_count=total_overlaps,
        clock_rewind_count=total_rewinds,
        low_bitrate_count=total_low_br,
        suspected_dropped_frames_count=total_drops,
    )
