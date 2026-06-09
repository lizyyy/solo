from __future__ import annotations

from typing import Dict, List, Tuple

from .models import (
    JudgmentType,
    RowJudgment,
    SparePartRow,
    StepName,
    StepSnapshot,
)


def locate_deviation_rows(
    rows: List[SparePartRow],
    snapshots: List[StepSnapshot],
    final_judgments: Dict[str, RowJudgment],
) -> List[Tuple[str, str, str, List[str]]]:
    row_index = {r.row_id: r for r in rows}
    result: List[Tuple[str, str, str, List[str]]] = []
    target_judgments = {JudgmentType.SUPPLEMENT, JudgmentType.HANG, JudgmentType.REJECT}
    for rid, judgment in final_judgments.items():
        if judgment.judgment not in target_judgments:
            continue
        first_appearance_step: str = ""
        contribution_steps: List[str] = []
        for snap in snapshots:
            sj = snap.row_judgments.get(rid)
            if sj is None:
                continue
            if sj.judgment in target_judgments and not first_appearance_step:
                first_appearance_step = snap.step.value
            if sj.judgment != judgment.judgment and snap.step != StepName.FINAL_JUDGMENT:
                if "翻转" not in sj.detail:
                    continue
            if sj.judgment == judgment.judgment and sj.reason_codes:
                contribution_steps.append(
                    f"{snap.step.value}({','.join(sj.reason_codes)})"
                )
        row = row_index.get(rid)
        part_desc = f"{row.part_name} / {row.part_no}" if row else rid
        reason_summary = "；".join(judgment.reason_codes) or judgment.detail
        if not contribution_steps and first_appearance_step:
            contribution_steps = [first_appearance_step]
        result.append(
            (rid, part_desc, reason_summary, contribution_steps)
        )
    result.sort(key=lambda x: x[0])
    return result


def format_deviation_report(
    deviations: List[Tuple[str, str, str, List[str]]],
) -> str:
    if not deviations:
        return "【偏差定位】本次复核无拖偏结果的备件行，所有材料结论均为放行。"
    lines = ["【偏差定位】以下备件行影响了「桥梁支座报告复核」的最终结论："]
    for idx, (rid, part, reason, steps) in enumerate(deviations, 1):
        lines.append(f"  {idx}. 行号 {rid} - {part}")
        lines.append(f"     偏差原因：{reason}")
        lines.append(f"     出现环节：{' → '.join(steps)}")
    lines.append(
        f"共 {len(deviations)} 行拖偏结论，老唐可按上述行号在备件清单中直接定位。"
    )
    return "\n".join(lines)


def compare_to_expected(
    final_judgments: Dict[str, RowJudgment],
    expected: Dict[str, JudgmentType],
) -> List[Tuple[str, str, str]]:
    diffs: List[Tuple[str, str, str]] = []
    all_keys = set(final_judgments.keys()) | set(expected.keys())
    for rid in all_keys:
        got = final_judgments.get(rid)
        want = expected.get(rid)
        got_val = got.judgment.value if got else "NONE"
        want_val = want.value if want else "NONE"
        if got_val != want_val:
            diffs.append((rid, want_val, got_val))
    return diffs
