from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .models import EvalResult, Judgement, RerunDiff, RunSummary
from .store import Store


def _judgement_icon(j: Judgement) -> str:
    return {
        Judgement.PASS: "✓",
        Judgement.FAIL: "✗",
        Judgement.BORDERLINE: "△",
        Judgement.CONFLICT: "⚡",
        Judgement.SKIPPED: "○",
    }.get(j, "?")


def format_run_summary(summary: RunSummary) -> str:
    lines: list[str] = []
    lines.append(f"=== 评测汇总 run_id={summary.run_id} ===")
    lines.append(f"评测时间: {summary.evaluated_at.isoformat()}")
    lines.append(f"总样本: {summary.total_samples}")
    lines.append(f"去重后: {summary.unique_samples}")
    lines.append(f"重复项: {summary.duplicate_count}")
    lines.append(f"空值项: {summary.null_count}")
    lines.append(f"例外项: {summary.exception_count}")
    lines.append(f"冲突项: {summary.conflict_count}")
    lines.append("")
    lines.append("--- 按分层 ---")
    for s, c in sorted(summary.stratum_counts.items()):
        lines.append(f"  {s}: {c}")
    lines.append("")
    lines.append("--- 按判定 ---")
    for j, c in sorted(summary.judgement_counts.items()):
        icon = _judgement_icon(Judgement(j))
        lines.append(f"  {icon} {j}: {c}")
    return "\n".join(lines)


def format_result_detail(result: EvalResult) -> str:
    lines: list[str] = []
    icon = _judgement_icon(result.judgement)
    lines.append(f"[{icon}] {result.creative_id} / {result.arm_name}")
    lines.append(f"  判定: {result.judgement.value}")
    lines.append(f"  分层: {result.stratum.value}")
    lines.append(f"  重复: {'是 (→{})'.format(result.duplicate_of) if result.is_duplicate else '否'}")
    lines.append(f"  例外: {'是 — ' + result.exception_reason if result.is_exception else '否'}")
    lines.append(f"  来源日志: {result.source_log_id} ({result.source_file})")
    lines.append(f"  评测时间: {result.evaluated_at.isoformat()}")
    lines.append(f"  run_id: {result.run_id}")

    lines.append("  指标:")
    for m, v in result.metric_values.items():
        lines.append(f"    {m}: {v if v is not None else '<空>'}")

    if result.threshold_results:
        lines.append("  阈值检查:")
        for tr in result.threshold_results:
            status = "通过" if tr["passed"] is True else "未通过" if tr["passed"] is False else "无法判定(空值)"
            lines.append(
                f"    {tr['metric']} {tr['operator']} {tr['threshold']}: "
                f"{status} (值={tr['value']}) [{tr['note_id']}]"
            )

    lines.append("  证据链接:")
    for ev in result.evidence_links:
        lines.append(f"    [{ev.source_type}] {ev.source_id} | {ev.source_file} | {ev.detail}")

    return "\n".join(lines)


def format_rerun_diff(diff: RerunDiff) -> str:
    lines: list[str] = []
    s = diff.summary
    lines.append(f"=== 重跑对比 {s['previous_run_id']} → {s['current_run_id']} ===")
    lines.append(f"当前批次样本数: {s['total_current']}")
    lines.append(f"前次批次样本数: {s['total_previous']}")
    lines.append(f"新增样本: {s['samples_added_count']}")
    lines.append(f"移除样本: {s['samples_removed_count']}")
    lines.append(f"变化样本: {s['samples_changed_count']}")
    lines.append(f"  仅指标变化: {s['metric_only_change_count']}")
    lines.append(f"  仅样本属性变化: {s['sample_only_change_count']}")

    if diff.sample_added:
        lines.append("")
        lines.append("--- 新增样本 ---")
        for fp in diff.sample_added:
            lines.append(f"  + {fp}")

    if diff.sample_removed:
        lines.append("")
        lines.append("--- 移除样本 ---")
        for fp in diff.sample_removed:
            lines.append(f"  - {fp}")

    if diff.metric_only_changes:
        lines.append("")
        lines.append("--- 仅指标变化（样本未变）---")
        for mc in diff.metric_only_changes:
            lines.append(f"  {mc['creative_id']} / {mc['arm_name']}:")
            for m, delta in mc["metrics"].items():
                if delta["delta"] is not None:
                    lines.append(f"    {m}: {delta['previous']} → {delta['current']} (Δ={delta['delta']:.6f})")
                else:
                    lines.append(f"    {m}: {delta['previous']} → {delta['current']}")

    if diff.sample_only_changes:
        lines.append("")
        lines.append("--- 仅样本属性变化（指标未变）---")
        for sc in diff.sample_only_changes:
            parts = []
            if sc["judgement_changed"]:
                parts.append(f"判定 {sc['previous_judgement']}→{sc['current_judgement']}")
            if sc["stratum_changed"]:
                parts.append(f"分层 {sc['previous_stratum']}→{sc['current_stratum']}")
            if sc["exception_changed"]:
                parts.append("例外状态变化")
            lines.append(f"  {sc['creative_id']} / {sc['arm_name']}: {', '.join(parts)}")

    return "\n".join(lines)


def export_results_csv(results: list[EvalResult], output_path: str | Path) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "result_id",
        "creative_id",
        "arm_name",
        "judgement",
        "stratum",
        "is_duplicate",
        "duplicate_of",
        "is_exception",
        "exception_reason",
        "impressions",
        "clicks",
        "conversions",
        "revenue",
        "ctr",
        "cvr",
        "threshold_results_json",
        "evidence_links_json",
        "source_log_id",
        "source_file",
        "run_id",
        "evaluated_at",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            row = {
                "result_id": r.result_id,
                "creative_id": r.creative_id,
                "arm_name": r.arm_name,
                "judgement": r.judgement.value,
                "stratum": r.stratum.value,
                "is_duplicate": r.is_duplicate,
                "duplicate_of": r.duplicate_of or "",
                "is_exception": r.is_exception,
                "exception_reason": r.exception_reason,
                "impressions": r.metric_values.get("impressions"),
                "clicks": r.metric_values.get("clicks"),
                "conversions": r.metric_values.get("conversions"),
                "revenue": r.metric_values.get("revenue"),
                "ctr": r.metric_values.get("ctr"),
                "cvr": r.metric_values.get("cvr"),
                "threshold_results_json": json.dumps(r.threshold_results, ensure_ascii=False),
                "evidence_links_json": json.dumps(
                    [
                        {
                            "source_type": e.source_type,
                            "source_id": e.source_id,
                            "source_file": e.source_file,
                            "detail": e.detail,
                        }
                        for e in r.evidence_links
                    ],
                    ensure_ascii=False,
                ),
                "source_log_id": r.source_log_id,
                "source_file": r.source_file,
                "run_id": r.run_id,
                "evaluated_at": r.evaluated_at.isoformat(),
            }
            writer.writerow(row)

    return output_path


def export_rerun_diff_json(diff: RerunDiff, output_path: str | Path) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "current_run_id": diff.current_run_id,
        "previous_run_id": diff.previous_run_id,
        "sample_added": diff.sample_added,
        "sample_removed": diff.sample_removed,
        "sample_changed": diff.sample_changed,
        "metric_only_changes": diff.metric_only_changes,
        "sample_only_changes": diff.sample_only_changes,
        "metric_diffs": diff.metric_diffs,
        "summary": diff.summary,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return output_path
