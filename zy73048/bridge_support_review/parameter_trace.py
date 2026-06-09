from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List, Optional

from .models import (
    JudgmentType,
    ParameterChangeImpact,
    ReviewParameters,
    RowJudgment,
    StepName,
    StepSnapshot,
)


STEP_PARAM_DEPENDENCY: Dict[StepName, List[str]] = {
    StepName.MATERIAL_VALIDATION: ["require_supplier_cert", "min_warehouse_ratio"],
    StepName.PART_MATCHING: ["allow_partial_match", "strict_substitution_check"],
    StepName.ALARM_RECONCILIATION: ["require_supplier_cert"],
    StepName.REMARK_INJECTION: ["remark_weight"],
    StepName.FINAL_JUDGMENT: [
        "allow_partial_match",
        "require_supplier_cert",
        "strict_substitution_check",
        "min_warehouse_ratio",
        "remark_weight",
    ],
}


def detect_parameter_change(
    old_params: ReviewParameters, new_params: ReviewParameters
) -> List[ParameterChangeImpact]:
    impacts: List[ParameterChangeImpact] = []
    old_dict = asdict(old_params)
    new_dict = asdict(new_params)
    for field_name in STEP_PARAM_DEPENDENCY.get(StepName.FINAL_JUDGMENT, []):
        old_value = old_dict.get(field_name)
        new_value = new_dict.get(field_name)
        if old_value == new_value:
            continue
        affected_steps = [
            step
            for step, fields in STEP_PARAM_DEPENDENCY.items()
            if field_name in fields
        ]
        impacts.append(
            ParameterChangeImpact(
                changed_field=field_name,
                old_value=old_value,
                new_value=new_value,
                affected_steps=affected_steps,
                flipped_rows=[],
                flip_detail=[],
            )
        )
    return impacts


def compute_flipped_rows(
    baseline: Dict[str, RowJudgment],
    rerun: Dict[str, RowJudgment],
) -> List[str]:
    flipped: List[str] = []
    all_rows = set(baseline.keys()) | set(rerun.keys())
    for row_id in all_rows:
        b = baseline.get(row_id)
        r = rerun.get(row_id)
        if b is None or r is None:
            flipped.append(row_id)
            continue
        if b.judgment != r.judgment:
            flipped.append(row_id)
    return flipped


def annotate_impact_with_flips(
    impact: ParameterChangeImpact,
    baseline_final: Dict[str, RowJudgment],
    rerun_final: Dict[str, RowJudgment],
) -> ParameterChangeImpact:
    flipped_ids = compute_flipped_rows(baseline_final, rerun_final)
    impact.flipped_rows = flipped_ids
    detail: List[Dict[str, str]] = []
    for row_id in flipped_ids:
        b = baseline_final.get(row_id)
        r = rerun_final.get(row_id)
        detail.append(
            {
                "row_id": row_id,
                "from": b.judgment.value if b else "NONE",
                "to": r.judgment.value if r else "NONE",
            }
        )
    impact.flip_detail = detail
    return impact


def build_step_diff_brief(
    baseline_snapshots: List[StepSnapshot], rerun_snapshots: List[StepSnapshot]
) -> Dict[str, Dict[str, int]]:
    baseline_index = {s.step: s for s in baseline_snapshots}
    rerun_index = {s.step: s for s in rerun_snapshots}
    brief: Dict[str, Dict[str, int]] = {}
    all_steps = set(baseline_index.keys()) | set(rerun_index.keys())
    for step in all_steps:
        bs = baseline_index.get(step)
        rs = rerun_index.get(step)
        if bs is None or rs is None:
            brief[step.value] = {"status": "new_or_missing", "flip_count": 0}
            continue
        flipped = compute_flipped_rows(bs.row_judgments, rs.row_judgments)
        brief[step.value] = {
            "status": "changed" if flipped else "stable",
            "flip_count": len(flipped),
        }
    return brief


def format_parameter_trace_for_duty(
    impacts: List[ParameterChangeImpact],
    step_brief: Dict[str, Dict[str, int]],
) -> str:
    if not impacts:
        return "参数未变更，两次运行使用同一组复核参数。"
    lines = ["【参数变更追踪】算法值班人请重点关注以下变化："]
    for idx, impact in enumerate(impacts, 1):
        lines.append(
            f"  {idx}. 参数 {impact.changed_field}："
            f"{impact.old_value} → {impact.new_value}"
        )
        steps_str = "、".join(s.value for s in impact.affected_steps)
        lines.append(f"     影响步骤：{steps_str}")
        lines.append(f"     结论翻转行数：{len(impact.flipped_rows)}")
        for flip in impact.flip_detail[:5]:
            lines.append(
                f"       - 行 {flip['row_id']}：{flip['from']} → {flip['to']}"
            )
        if len(impact.flip_detail) > 5:
            lines.append(f"       - ……另有 {len(impact.flip_detail) - 5} 行翻转")
    lines.append("【步骤级变化总览】")
    for step, info in step_brief.items():
        lines.append(
            f"  - {step}：{info['status']}（翻转 {info['flip_count']} 行）"
        )
    return "\n".join(lines)
