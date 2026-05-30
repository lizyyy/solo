from __future__ import annotations

import csv
import os
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

from .models import (
    ActivityRecord,
    DataIssue,
    DataSource,
    ImportResult,
    IssueSeverity,
    PlaybackRecord,
    SharingRecord,
    SourceTrace,
)


def _make_trace(source_file: str, source_type: DataSource, row_num: int, raw_line: str) -> SourceTrace:
    return SourceTrace(
        source_file=os.path.basename(source_file),
        source_type=source_type,
        original_row=row_num,
        raw_line=raw_line.strip(),
    )


def _parse_date(val: str) -> Optional[date]:
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _validate_playback(row: Dict[str, str], trace: SourceTrace) -> Tuple[Optional[PlaybackRecord], List[DataIssue]]:
    issues: List[DataIssue] = []

    song_id = row.get("song_id", "").strip()
    platform = row.get("platform", "").strip()
    date_str = row.get("date", "").strip()
    plays_str = row.get("plays", "").strip()

    if not song_id:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "PB_001", "缺少 song_id", "song_id"))
    if not platform:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "PB_002", "缺少 platform", "platform"))
    parsed_date = _parse_date(date_str)
    if not date_str:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "PB_003", "缺少 date", "date"))
    elif parsed_date is None:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "PB_004", f"日期格式无法解析: {date_str}", "date"))

    plays = None
    if not plays_str:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "PB_005", "缺少 plays", "plays"))
    else:
        try:
            plays = int(plays_str)
            if plays < 0:
                issues.append(DataIssue(trace, IssueSeverity.ERROR, "PB_006", f"播放量为负: {plays}", "plays"))
                plays = None
        except ValueError:
            issues.append(DataIssue(trace, IssueSeverity.ERROR, "PB_007", f"播放量非整数: {plays_str}", "plays"))

    if issues:
        return None, issues

    return PlaybackRecord(
        song_id=song_id,
        platform=platform,
        date=parsed_date,
        plays=plays,
        trace=trace,
    ), []


def _validate_sharing(row: Dict[str, str], trace: SourceTrace) -> Tuple[Optional[SharingRecord], List[DataIssue]]:
    issues: List[DataIssue] = []

    platform = row.get("platform", "").strip()
    date_str = row.get("effective_date", "").strip()
    artist_str = row.get("artist_share", "").strip()
    label_str = row.get("label_share", "").strip()
    platform_share_str = row.get("platform_share", "").strip()

    if not platform:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "SH_001", "缺少 platform", "platform"))
    parsed_date = _parse_date(date_str)
    if not date_str:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "SH_002", "缺少 effective_date", "effective_date"))
    elif parsed_date is None:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "SH_003", f"日期格式无法解析: {date_str}", "effective_date"))

    artist_share = label_share = platform_share = None
    for label, val_str, code_prefix, field_name in [
        ("artist_share", artist_str, "SH_004", "artist_share"),
        ("label_share", label_str, "SH_006", "label_share"),
        ("platform_share", platform_share_str, "SH_008", "platform_share"),
    ]:
        if not val_str:
            issues.append(DataIssue(trace, IssueSeverity.ERROR, f"{code_prefix}", f"缺少 {field_name}", field_name))
        else:
            try:
                v = float(val_str)
                if v < 0 or v > 1:
                    issues.append(
                        DataIssue(trace, IssueSeverity.ERROR, f"{code_prefix}b", f"{field_name} 超出 [0,1] 范围: {v}", field_name)
                    )
                else:
                    if label == "artist_share":
                        artist_share = v
                    elif label == "label_share":
                        label_share = v
                    else:
                        platform_share = v
            except ValueError:
                issues.append(
                    DataIssue(trace, IssueSeverity.ERROR, f"{code_prefix}c", f"{field_name} 非数值: {val_str}", field_name)
                )

    if artist_share is not None and label_share is not None and platform_share is not None:
        total = artist_share + label_share + platform_share
        if abs(total - 1.0) > 0.02:
            issues.append(
                DataIssue(
                    trace,
                    IssueSeverity.ERROR,
                    "SH_010",
                    f"分成比例之和不等于1 (合计={total:.4f})",
                    "total_share",
                )
            )

    if issues:
        return None, issues

    return SharingRecord(
        platform=platform,
        effective_date=parsed_date,
        artist_share=artist_share,
        label_share=label_share,
        platform_share=platform_share,
        trace=trace,
    ), []


def _validate_activity(row: Dict[str, str], trace: SourceTrace) -> Tuple[Optional[ActivityRecord], List[DataIssue]]:
    issues: List[DataIssue] = []

    activity_id = row.get("activity_id", "").strip()
    song_id = row.get("song_id", "").strip()
    activity_type = row.get("activity_type", "").strip()
    start_str = row.get("start_date", "").strip()
    end_str = row.get("end_date", "").strip()
    multiplier_str = row.get("exposure_multiplier", "").strip()

    if not activity_id:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_001", "缺少 activity_id", "activity_id"))
    if not song_id:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_002", "缺少 song_id", "song_id"))
    if not activity_type:
        issues.append(DataIssue(trace, IssueSeverity.WARNING, "ACT_003", "缺少 activity_type", "activity_type"))

    start_date = _parse_date(start_str)
    end_date = _parse_date(end_str)
    if not start_str:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_004", "缺少 start_date", "start_date"))
    elif start_date is None:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_005", f"开始日期格式无法解析: {start_str}", "start_date"))
    if not end_str:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_006", "缺少 end_date", "end_date"))
    elif end_date is None:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_007", f"结束日期格式无法解析: {end_str}", "end_date"))
    elif start_date and end_date and end_date < start_date:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_008", f"结束日期早于开始日期: {end_str} < {start_str}", "end_date"))

    multiplier = None
    if not multiplier_str:
        issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_009", "缺少 exposure_multiplier", "exposure_multiplier"))
    else:
        try:
            multiplier = float(multiplier_str)
            if multiplier < 0:
                issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_010", f"曝光倍数为负: {multiplier}", "exposure_multiplier"))
            elif multiplier > 100:
                issues.append(
                    DataIssue(trace, IssueSeverity.WARNING, "ACT_011", f"曝光倍数异常偏高: {multiplier}", "exposure_multiplier")
                )
        except ValueError:
            issues.append(DataIssue(trace, IssueSeverity.ERROR, "ACT_012", f"曝光倍数非数值: {multiplier_str}", "exposure_multiplier"))

    if issues:
        return None, issues

    return ActivityRecord(
        activity_id=activity_id,
        song_id=song_id,
        activity_type=activity_type,
        start_date=start_date,
        end_date=end_date,
        exposure_multiplier=multiplier,
        trace=trace,
    ), []


def import_playback_history(filepath: str) -> ImportResult:
    return _import_csv(filepath, DataSource.PLAYBACK_HISTORY, _validate_playback)


def import_platform_sharing(filepath: str) -> ImportResult:
    return _import_csv(filepath, DataSource.PLATFORM_SHARING, _validate_sharing)


def import_activity_calendar(filepath: str) -> ImportResult:
    return _import_csv(filepath, DataSource.ACTIVITY_CALENDAR, _validate_activity)


IMPORTERS = {
    DataSource.PLAYBACK_HISTORY: import_playback_history,
    DataSource.PLATFORM_SHARING: import_platform_sharing,
    DataSource.ACTIVITY_CALENDAR: import_activity_calendar,
}


def _import_csv(filepath: str, source_type: DataSource, validator) -> ImportResult:
    result = ImportResult(source_type=source_type, source_file=os.path.basename(filepath))
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            raw_line = ",".join(f"{k}={v}" for k, v in row.items())
            trace = _make_trace(filepath, source_type, row_num, raw_line)
            record, issues = validator(row, trace)
            result.issues.extend(issues)
            if record is not None:
                result.valid_records.append(record)
    return result


def detect_cross_source_issues(
    playbacks: List[PlaybackRecord],
    sharings: List[SharingRecord],
    activities: List[ActivityRecord],
) -> List[DataIssue]:
    issues: List[DataIssue] = []

    platform_set = set(s.platform for s in sharings)
    for pb in playbacks:
        if pb.platform not in platform_set:
            issues.append(
                DataIssue(
                    pb.trace,
                    IssueSeverity.WARNING,
                    "CROSS_001",
                    f"播放记录的平台 '{pb.platform}' 在分成数据中无对应条目",
                    "platform",
                )
            )

    seen: Dict[str, ActivityRecord] = {}
    for act in activities:
        key = f"{act.activity_id}"
        if key in seen:
            existing = seen[key]
            issues.append(
                DataIssue(
                    act.trace,
                    IssueSeverity.ERROR,
                    "CROSS_002",
                    f"活动ID重复: {act.activity_id} (首见于行 {existing.trace.original_row})",
                    "activity_id",
                )
            )
        else:
            seen[key] = act

    duration_key = lambda a: f"{a.song_id}:{a.activity_type}:{a.start_date}:{a.end_date}"
    duration_seen: Dict[str, ActivityRecord] = {}
    for act in activities:
        dkey = duration_key(act)
        if dkey in duration_seen:
            existing = duration_seen[dkey]
            issues.append(
                DataIssue(
                    act.trace,
                    IssueSeverity.WARNING,
                    "CROSS_003",
                    f"疑似重复活动: {act.activity_id} 与 {existing.activity_id} 的歌曲/类型/时段完全一致",
                    "activity_id",
                )
            )
        else:
            duration_seen[dkey] = act

    song_ids_in_playback = set(pb.song_id for pb in playbacks)
    for act in activities:
        if act.song_id not in song_ids_in_playback:
            issues.append(
                DataIssue(
                    act.trace,
                    IssueSeverity.WARNING,
                    "CROSS_004",
                    f"活动关联的歌曲 {act.song_id} 在播放历史中无记录",
                    "song_id",
                )
            )

    return issues
