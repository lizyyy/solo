from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path

from .models import PipelineResult, Track, StepResult
from .parsers import load_tracks_from_dir
from .steps.bpm_normalize import normalize_bpm
from .steps.key_compat import check_key_compat
from .steps.energy_curve import compute_energy_curve
from .steps.section_label import label_sections
from .steps.report_export import export_report


def _snapshot_tracks(tracks: list[Track]) -> str:
    data = json.dumps([t.to_dict() for t in tracks], sort_keys=True, ensure_ascii=False)
    return hashlib.md5(data.encode()).hexdigest()[:12]


def run_pipeline(
    input_dir: str | Path,
    output_dir: str | Path,
    run_id: str | None = None,
    steps: list[str] | None = None,
) -> PipelineResult:
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)

    all_steps = ["bpm_normalize", "key_compat", "energy_curve", "section_label", "report_export"]
    if steps is None:
        steps = all_steps
    steps_set = set(steps)

    tracks = load_tracks_from_dir(input_dir)
    if not tracks:
        result = PipelineResult()
        result.warnings.append(f"No tracks found in {input_dir}")
        return result

    pipeline_result = PipelineResult(tracks=tracks)

    if "bpm_normalize" in steps_set:
        before_hash = _snapshot_tracks(tracks)
        tracks, step_result = normalize_bpm(tracks)
        step_result.input_snapshot = before_hash
        step_result.output_snapshot = _snapshot_tracks(tracks)
        pipeline_result.step_results.append(step_result)
        pipeline_result.warnings.extend(step_result.issues)

    if "key_compat" in steps_set:
        before_hash = _snapshot_tracks(tracks)
        tracks, step_result = check_key_compat(tracks)
        step_result.input_snapshot = before_hash
        step_result.output_snapshot = _snapshot_tracks(tracks)
        pipeline_result.step_results.append(step_result)
        pipeline_result.warnings.extend(step_result.issues)

    transitions: list = []
    if "energy_curve" in steps_set:
        before_hash = _snapshot_tracks(tracks)
        tracks, transitions, step_result = compute_energy_curve(tracks)
        step_result.input_snapshot = before_hash
        step_result.output_snapshot = _snapshot_tracks(tracks)
        pipeline_result.transitions = transitions
        pipeline_result.step_results.append(step_result)
        pipeline_result.warnings.extend(step_result.issues)

    sections: list = []
    if "section_label" in steps_set:
        before_hash = _snapshot_tracks(tracks)
        tracks, sections, step_result = label_sections(tracks, transitions)
        step_result.input_snapshot = before_hash
        step_result.output_snapshot = _snapshot_tracks(tracks)
        pipeline_result.sections = sections
        pipeline_result.step_results.append(step_result)
        pipeline_result.warnings.extend(step_result.issues)

    pipeline_result.tracks = tracks

    if "report_export" in steps_set:
        output_files, step_result = export_report(
            pipeline_result, output_dir, run_id=run_id
        )
        step_result.input_snapshot = _snapshot_tracks(tracks)
        pipeline_result.step_results.append(step_result)
        pipeline_result.meta["output_files"] = output_files

    return pipeline_result
