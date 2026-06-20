#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from probreplay import materials, sorter, simulator, audit, report
from probreplay.models import SimParams


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _summary_block(baseline, adjusted, attribution, stance_changes, sort_instabilities, records):
    n_total = len(records)
    n_boundary = sum(1 for r in baseline.records if r.is_boundary)
    n_fail = sum(1 for r in baseline.records if r.passed is False)
    lines = []
    lines.append("==== 概率模拟参数回放 · 终端摘要（详细时间线见 timeline.json）====")
    lines.append(f"基线通过率: {baseline.aggregate_pass_rate*100:.2f}%  (n={baseline.params.n_trials}, seed={baseline.params.seed}, unit={baseline.unit})")
    lines.append(f"记录 {n_total} 条 | 边界样本 {n_boundary} | 未通过 {n_fail} | 口径变更 {len(stance_changes)} | 排序不稳定 {len(sort_instabilities)}")
    if adjusted is not None and attribution is not None:
        d = attribution.delta
        arrow = "↑" if d >= 0 else "↓"
        lines.append(
            f"参数复算: {attribution.param_name} {attribution.baseline_value}→{attribution.adjusted_value}  "
            f"通过率 {baseline.aggregate_pass_rate*100:.2f}%→{adjusted.aggregate_pass_rate*100:.2f}% ({arrow}{abs(d)*100:.2f}pp)"
        )
        lines.append(
            f"  归因: 边界样本贡献 {attribution.boundary_effect:+.4f} / 非边界 {attribution.non_boundary_effect:+.4f}  "
            f"翻转样本 {attribution.boundary_flips or '无'}"
        )
    for sc in stance_changes:
        lines.append(f"  [口径变更] {sc.title} ({sc.author}): {sc.from_stance} → {sc.to_stance} | 原因: {sc.reason}")
    for si in sort_instabilities:
        lines.append(f"  [排序不稳定] {si.sort_key} 并列 {si.tied_value} 涉及 {','.join(si.record_ids)} | 待确认: 见报告处理去向")
    lines.append("报告: report.html | 审计: audit_trail.jsonl | 时间线: timeline.json")
    return "\n".join(lines)


def run(input_dir: str, output_dir: str, operator: str, adjust: str | None, trials: int | None):
    mats = materials.load_materials(input_dir)
    if not mats:
        print(f"[警告] 输入目录未发现材料: {input_dir}", file=sys.stderr)
    stance_changes = materials.detect_stance_changes(mats)
    records, adjustments = materials.derive_records(mats)
    sorted_records, sort_instabilities = sorter.sort_records(records, "effective_score", True)
    params = materials.load_params(input_dir, mats)
    if trials:
        params.n_trials = trials
    max_score = 100.0
    for m in mats:
        if m.type == "scoring_notes":
            max_score = float(m.payload.get("max_score", 100.0))

    baseline = simulator.simulate(sorted_records, params, max_score=max_score)

    adjusted = None
    attribution = None
    adjusted_param_name = None
    if adjust:
        name, old_val, new_val = simulator.parse_adjust(adjust, params)
        adjusted_param_name = name
        adj_params = simulator.apply_adjustment(params, name, new_val)
        adjusted = simulator.simulate(sorted_records, adj_params, max_score=max_score)
        attribution = simulator.attribute_delta(baseline, adjusted, name, old_val, new_val, max_score)

    meta = {
        "run_id": None,
        "operator": operator,
        "at": _now(),
        "input_dir": os.path.abspath(input_dir),
        "output_dir": os.path.abspath(output_dir),
    }

    summary = {
        "baseline_rate": baseline.aggregate_pass_rate,
        "adjusted_rate": adjusted.aggregate_pass_rate if adjusted else None,
        "delta": attribution.delta if attribution else None,
        "n_records": len(records),
        "n_boundary": sum(1 for r in baseline.records if r.is_boundary),
        "n_stance_changes": len(stance_changes),
        "n_sort_instabilities": len(sort_instabilities),
        "adjusted_param": adjusted_param_name,
    }

    entry = audit.build_entry(
        operator=operator,
        input_dir=meta["input_dir"],
        output_dir=meta["output_dir"],
        params=params,
        adjusted_param=adjusted_param_name,
        materials=mats,
        stance_changes=stance_changes,
        sort_instabilities=sort_instabilities,
        summary=summary,
    )
    meta["run_id"] = entry.run_id

    existing_audit = audit.read_audit(output_dir)
    audit_path = audit.append_audit(output_dir, entry)

    report_data = report.build_report_data(
        meta=meta,
        baseline=baseline,
        adjusted=adjusted,
        attribution=attribution,
        materials=mats,
        stance_changes=stance_changes,
        sort_instabilities=sort_instabilities,
        records=sorted_records,
        adjustments=adjustments,
        audit_entries=existing_audit + [entry.to_dict()],
        max_score=max_score,
    )
    os.makedirs(output_dir, exist_ok=True)
    report_path = report.write_report(output_dir, report_data)

    timeline = {
        "run_id": entry.run_id,
        "at": meta["at"],
        "operator": operator,
        "params_baseline": params.to_dict(),
        "params_adjusted": adjusted.params.to_dict() if adjusted else None,
        "adjusted_param": (
            {"name": attribution.param_name, "old": attribution.baseline_value, "new": attribution.adjusted_value}
            if attribution
            else None
        ),
        "baseline": baseline.to_dict(),
        "adjusted": adjusted.to_dict() if adjusted else None,
        "attribution": attribution.to_dict() if attribution else None,
        "stance_changes": [s.to_dict() for s in stance_changes],
        "sort_instabilities": [s.to_dict() for s in sort_instabilities],
        "records": [r.to_dict() for r in sorted_records],
        "materials": [m.to_dict() for m in mats],
        "adjustments": adjustments,
    }
    timeline_path = os.path.join(output_dir, "timeline.json")
    with open(timeline_path, "w", encoding="utf-8") as fh:
        json.dump(timeline, fh, ensure_ascii=False, indent=2)

    print(_summary_block(baseline, adjusted, attribution, stance_changes, sort_instabilities, sorted_records))
    print(f"输出目录: {output_dir}")
    print(f"  report: {report_path}")
    print(f"  timeline: {timeline_path}")
    print(f"  audit: {audit_path}")
    return entry


def main(argv=None):
    p = argparse.ArgumentParser(
        prog="概率模拟参数回放",
        description="概率模拟参数回放：加载材料、检测口径变更/排序不稳定、蒙特卡洛模拟通过概率、参数复算与归因，产出可点击交互报告。",
    )
    p.add_argument("--input", "-i", required=True, help="输入目录（含 scoring_notes/normal_record/oral_explanation 材料 + 可选 params_baseline.json）")
    p.add_argument("--output", "-o", required=True, help="输出目录（写入 report.html / timeline.json / audit_trail.jsonl）")
    p.add_argument("--adjust", "-a", default=None, help="参数复算，如 pass_threshold=58 / sigma=2 / unit=percent；仅给参数名则自动取下一档")
    p.add_argument("--operator", default="unknown", help="操作员标识（写入审计）")
    p.add_argument("--trials", type=int, default=None, help="覆盖蒙特卡洛试验次数")
    args = p.parse_args(argv)
    run(args.input, args.output, args.operator, args.adjust, args.trials)


if __name__ == "__main__":
    main()
