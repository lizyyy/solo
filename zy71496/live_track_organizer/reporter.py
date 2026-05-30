from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from .models import ConflictType, OrganizeResult, TrackInfo


def print_summary(result: OrganizeResult) -> None:
    print("=" * 60)
    print("  现场多轨命名整理 — 终端摘要")
    print("=" * 60)
    print()
    print(f"  总轨道数:       {result.total_tracks}")
    print(f"  重命名数:       {result.renamed_count}")
    print(f"  通道分组数:     {len(result.channel_groups)}")
    print(f"  冲突总数:       {result.conflict_count}")
    print(f"  ├ 通道重名:     {result.duplicate_channel_count}")
    print(f"  ├ 时间戳错位:   {result.misaligned_timestamp_count}")
    print(f"  └ 声部缺失:     {result.missing_part_count}")
    print()

    if result.timestamp_anchor:
        print(f"  时间锚点:       {result.timestamp_anchor.isoformat()}")
    print()

    if result.conflicts:
        print("  ⚠ 冲突列表:")
        for i, c in enumerate(result.conflicts, 1):
            tag = {
                ConflictType.CHANNEL_DUPLICATE: "[重名]",
                ConflictType.TIMESTAMP_MISALIGN: "[错位]",
                ConflictType.PART_MISSING: "[缺失]",
                ConflictType.TRIPLE_CONFLICT: "[冲突]",
            }.get(c.conflict_type, "[?]")

            resolved_mark = "✓" if c.resolved else "✗"
            print(f"    {i:2d}. {tag} {c.description}")
            if c.resolution:
                print(f"        → {c.resolution} [{resolved_mark}]")
        print()

    print("  重命名预览:")
    for track in result.tracks:
        print(f"    {track.original_name:<40s} → {track.new_name}")
    print()
    print("=" * 60)


def export_detail_report(result: OrganizeResult, output_dir: str) -> str:
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = out_path / f"organize_report_{ts}.txt"
    json_file = out_path / f"organize_report_{ts}.json"

    _write_text_report(result, report_file)
    _write_json_report(result, json_file)

    return str(report_file)


def _write_text_report(result: OrganizeResult, path: Path) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write("现场多轨命名整理 — 详细报告\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 72 + "\n\n")

        f.write("一、总体统计\n")
        f.write("-" * 40 + "\n")
        f.write(f"  总轨道数:       {result.total_tracks}\n")
        f.write(f"  重命名数:       {result.renamed_count}\n")
        f.write(f"  通道分组数:     {len(result.channel_groups)}\n")
        f.write(f"  冲突总数:       {result.conflict_count}\n")
        f.write(f"    通道重名:     {result.duplicate_channel_count}\n")
        f.write(f"    时间戳错位:   {result.misaligned_timestamp_count}\n")
        f.write(f"    声部缺失:     {result.missing_part_count}\n")
        if result.timestamp_anchor:
            f.write(f"  时间锚点:       {result.timestamp_anchor.isoformat()}\n")
        f.write("\n")

        f.write("二、通道分组\n")
        f.write("-" * 40 + "\n")
        for group in result.channel_groups:
            dup_info = f" (重复×{group.duplicate_count})" if group.duplicate_count > 0 else ""
            f.write(f"  {group.canonical_name:<20s} | 声部: {group.part:<10s} | 轨道: {group.track_indices}{dup_info}\n")
        f.write("\n")

        f.write("三、重命名明细\n")
        f.write("-" * 40 + "\n")
        f.write(f"  {'原始文件名':<40s} → {'新文件名'}\n")
        f.write(f"  {'─' * 40} → {'─' * 50}\n")
        for track in result.tracks:
            f.write(f"  {track.original_name:<40s} → {track.new_name}\n")
        f.write("\n")

        f.write("四、冲突与问题\n")
        f.write("-" * 40 + "\n")
        if not result.conflicts:
            f.write("  无冲突\n")
        for i, c in enumerate(result.conflicts, 1):
            f.write(f"  {i}. [{c.conflict_type.value}] {c.description}\n")
            if c.sources:
                for k, v in c.sources.items():
                    f.write(f"      来源 {k}: {v}\n")
            if c.resolution:
                mark = "已解决" if c.resolved else "待确认"
                f.write(f"      处置: {c.resolution} ({mark})\n")
            f.write("\n")

        f.write("五、轨道详细信息\n")
        f.write("-" * 40 + "\n")
        for track in result.tracks:
            f.write(f"  文件: {track.original_name}\n")
            f.write(f"    轨道号:     {track.track_index}\n")
            f.write(f"    通道名(文件名): {track.channel_name_from_filename or '(无)'}\n")
            f.write(f"    通道名(元数据): {track.channel_name_from_metadata or '(无)'}\n")
            f.write(f"    通道名(通道表): {track.channel_name_from_table or '(无)'}\n")
            f.write(f"    声部(文件名):   {track.part_from_filename or '(无)'}\n")
            f.write(f"    声部(声部表):   {track.part_from_assignment or '(无)'}\n")
            f.write(f"    归结通道名:     {track.resolved_channel_name}\n")
            f.write(f"    归结声部:       {track.resolved_part}\n")
            ts_fn = track.timestamp_from_filename.isoformat() if track.timestamp_from_filename else "(无)"
            ts_meta = track.timestamp_from_metadata.isoformat() if track.timestamp_from_metadata else "(无)"
            ts_res = track.resolved_timestamp.isoformat() if track.resolved_timestamp else "(无)"
            f.write(f"    时间戳(文件名): {ts_fn}\n")
            f.write(f"    时间戳(元数据): {ts_meta}\n")
            f.write(f"    归结时间戳:     {ts_res}\n")
            f.write(f"    采样率:         {track.sample_rate or '(未知)'}\n")
            f.write(f"    声道数:         {track.channels or '(未知)'}\n")
            f.write(f"    时长:           {track.duration_seconds:.2f}s\n")
            f.write("\n")

        f.write("=" * 72 + "\n")
        f.write("报告结束\n")


def _write_json_report(result: OrganizeResult, path: Path) -> None:
    data = {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "total_tracks": result.total_tracks,
            "renamed_count": result.renamed_count,
            "channel_group_count": len(result.channel_groups),
            "conflict_count": result.conflict_count,
            "duplicate_channel_count": result.duplicate_channel_count,
            "misaligned_timestamp_count": result.misaligned_timestamp_count,
            "missing_part_count": result.missing_part_count,
            "timestamp_anchor": result.timestamp_anchor.isoformat() if result.timestamp_anchor else None,
        },
        "channel_groups": [
            {
                "name": g.canonical_name,
                "part": g.part,
                "track_indices": g.track_indices,
                "duplicate_count": g.duplicate_count,
            }
            for g in result.channel_groups
        ],
        "renames": [
            {
                "original": t.original_name,
                "new_name": t.new_name,
                "track_index": t.track_index,
                "resolved_channel": t.resolved_channel_name,
                "resolved_part": t.resolved_part,
            }
            for t in result.tracks
        ],
        "conflicts": [
            {
                "type": c.conflict_type.value,
                "track_indices": c.track_indices,
                "description": c.description,
                "sources": c.sources,
                "resolution": c.resolution,
                "resolved": c.resolved,
            }
            for c in result.conflicts
        ],
        "tracks": [
            {
                "original_name": t.original_name,
                "track_index": t.track_index,
                "channel_from_filename": t.channel_name_from_filename,
                "channel_from_metadata": t.channel_name_from_metadata,
                "channel_from_table": t.channel_name_from_table,
                "part_from_filename": t.part_from_filename,
                "part_from_assignment": t.part_from_assignment,
                "resolved_channel": t.resolved_channel_name,
                "resolved_part": t.resolved_part,
                "timestamp_from_filename": t.timestamp_from_filename.isoformat() if t.timestamp_from_filename else None,
                "timestamp_from_metadata": t.timestamp_from_metadata.isoformat() if t.timestamp_from_metadata else None,
                "resolved_timestamp": t.resolved_timestamp.isoformat() if t.resolved_timestamp else None,
                "sample_rate": t.sample_rate,
                "channels": t.channels,
                "duration_seconds": round(t.duration_seconds, 2),
                "new_name": t.new_name,
            }
            for t in result.tracks
        ],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
