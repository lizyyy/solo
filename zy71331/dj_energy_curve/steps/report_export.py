from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from ..models import Track, Section, Transition, PipelineResult, StepResult, FlagStatus


def export_report(
    result: PipelineResult,
    output_dir: str | Path,
    run_id: str | None = None,
) -> tuple[dict[str, str], StepResult]:
    step_result = StepResult(step_name="report_export")
    output_dir = Path(output_dir)

    if not run_id:
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    output_files: dict[str, str] = {}

    data_path = run_dir / "full_result.json"
    with open(data_path, "w", encoding="utf-8") as f:
        f.write(result.to_json())
    output_files["full_result"] = str(data_path)

    tracks_path = run_dir / "tracks.json"
    tracks_data = [t.to_dict() for t in result.tracks]
    with open(tracks_path, "w", encoding="utf-8") as f:
        json.dump(tracks_data, f, indent=2, ensure_ascii=False)
    output_files["tracks"] = str(tracks_path)

    review_tracks = result.review_tracks()
    if review_tracks:
        review_path = run_dir / "review_tracks.json"
        review_data = [t.to_dict() for t in review_tracks]
        with open(review_path, "w", encoding="utf-8") as f:
            json.dump(review_data, f, indent=2, ensure_ascii=False)
        output_files["review"] = str(review_path)

    text_path = run_dir / "report.txt"
    with open(text_path, "w", encoding="utf-8") as f:
        _write_text_report(f, result)
    output_files["report"] = str(text_path)

    state_path = output_dir / "pipeline_state.json"
    state = {
        "last_run_id": run_id,
        "last_run_time": datetime.now().isoformat(),
        "track_count": len(result.tracks),
        "review_count": len(review_tracks),
        "step_names": [sr.step_name for sr in result.step_results],
    }
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
    output_files["state"] = str(state_path)

    step_result.meta["run_id"] = run_id
    step_result.meta["output_files"] = output_files
    step_result.meta["review_count"] = len(review_tracks)
    step_result.issues = result.warnings[:]

    return output_files, step_result


def _write_text_report(f, result: PipelineResult) -> None:
    f.write("=" * 60 + "\n")
    f.write("  DJ 歌单能量曲线分析报告\n")
    f.write("=" * 60 + "\n\n")

    f.write(f"总曲目数: {len(result.tracks)}\n")
    review_count = len(result.review_tracks())
    f.write(f"待复核曲目: {review_count}\n")
    f.write(f"段落数: {len(result.sections)}\n")
    f.write(f"过渡数: {len(result.transitions)}\n\n")

    if result.warnings:
        f.write("--- 警告 ---\n")
        for w in result.warnings:
            f.write(f"  ⚠ {w}\n")
        f.write("\n")

    f.write("--- 段落标注 ---\n")
    for section in result.sections:
        f.write(
            f"  [{section.section_type.value.upper():12s}] "
            f"pos {section.start_position:3d}-{section.end_position:3d}  "
            f"avg_E={section.avg_energy:.1f}  avg_BPM={section.avg_bpm:.0f}  "
            f"key={section.dominant_key or '?'}\n"
        )
        for note in section.notes:
            f.write(f"    -> {note}\n")
    f.write("\n")

    f.write("--- 过渡检测 ---\n")
    rough = [t for t in result.transitions if not t.is_smooth]
    smooth = [t for t in result.transitions if t.is_smooth]
    f.write(f"  平滑过渡: {len(smooth)}\n")
    f.write(f"  粗糙过渡: {len(rough)}\n\n")

    if rough:
        f.write("  粗糙过渡详情:\n")
        for t in rough:
            f.write(
                f"    pos {t.from_position}->{t.to_position}: "
                f"ΔE={t.energy_delta:+.1f} ΔBPM={t.bpm_delta:.0f} "
                f"key={t.key_relation.value}\n"
            )
            for issue in t.issues:
                f.write(f"      -> {issue}\n")
        f.write("\n")

    f.write("--- 能量曲线 ---\n")
    f.write("  ")
    for track in result.tracks:
        if track.energy is not None:
            bars = int(track.energy)
            f.write("█" * bars + "░" * (10 - bars))
        else:
            f.write("??????????")
        f.write(" ")
    f.write("\n  ")
    for track in result.tracks:
        label = track.title[:8] if track.title else track.track_id[:8]
        f.write(f"{label:<10s}")
    f.write("\n\n")

    review_tracks = result.review_tracks()
    if review_tracks:
        f.write("--- 待复核曲目 ---\n")
        for t in review_tracks:
            f.write(
                f"  pos {t.position:3d} | {t.track_id} | {t.title[:30]} | "
                f"flags: {', '.join(t.flags)}\n"
            )
        f.write("\n")

    f.write("--- 处理步骤追踪 ---\n")
    for sr in result.step_results:
        f.write(
            f"  [{sr.step_name}] modified={sr.tracks_modified} issues={len(sr.issues)}"
        )
        if sr.meta:
            f.write(f" meta={json.dumps(sr.meta, ensure_ascii=False)}")
        f.write("\n")
    f.write("\n")

    f.write("=" * 60 + "\n")
