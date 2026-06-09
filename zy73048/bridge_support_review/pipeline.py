from __future__ import annotations

from copy import deepcopy
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from .models import (
    AlarmRecord,
    JudgmentType,
    ParameterChangeImpact,
    RemarkPatchImpact,
    ReviewParameters,
    ReviewResult,
    RowJudgment,
    SparePartRow,
    StepName,
    StepSnapshot,
    VersionLayer,
)
from .parameter_trace import (
    annotate_impact_with_flips,
    detect_parameter_change,
)
from .remark_impact import (
    apply_remark_patch,
    build_remark_impact,
    flip_judgment_by_remark,
)
from .substitution_hang import (
    create_hang_events_for_risks,
    detect_risky_substitution,
)


def _empty_judgments(rows: List[SparePartRow]) -> Dict[str, RowJudgment]:
    return {
        r.row_id: RowJudgment(
            row_id=r.row_id,
            judgment=JudgmentType.PASS,
            reason_codes=[],
            affected_by=[],
            detail="初始化，尚未进入任何复核步骤",
        )
        for r in rows
    }


def _summary(
    judgments: Dict[str, RowJudgment],
) -> Dict[str, int]:
    counter = {k: 0 for k in JudgmentType}
    for j in judgments.values():
        counter[j.judgment] += 1
    return {k.value: v for k, v in counter.items()}


def step_material_validation(
    rows: List[SparePartRow],
    params: ReviewParameters,
    prev: Dict[str, RowJudgment],
) -> Dict[str, RowJudgment]:
    judgments: Dict[str, RowJudgment] = {}
    for row in rows:
        j = deepcopy(prev.get(row.row_id, RowJudgment(row.row_id, JudgmentType.PASS, [], [])))
        reasons: List[str] = []
        affected: List[str] = []
        if params.require_supplier_cert:
            if "合格" not in row.supplier and "认证" not in row.supplier:
                if "合格供方" not in row.remark and "供方备案" not in row.remark:
                    reasons.append("supplier_cert_missing")
                    affected.append(f"supplier:{row.supplier}")
        warehouse_kw = {"在库", "充足", "正常"}
        if not any(kw in row.warehouse_status for kw in warehouse_kw):
            if row.quantity <= 0:
                reasons.append("warehouse_empty")
                affected.append(f"warehouse:{row.warehouse_status}")
            elif params.min_warehouse_ratio > 0.5 and "紧张" in row.warehouse_status:
                reasons.append("warehouse_tight")
                affected.append(f"warehouse:{row.warehouse_status}")
        if reasons:
            j.judgment = JudgmentType.SUPPLEMENT
            j.reason_codes = list(set(j.reason_codes + reasons))
            j.affected_by = list(set(j.affected_by + affected))
            j.detail = "材料校验未通过：" + "、".join(reasons)
        judgments[row.row_id] = j
    return judgments


def step_part_matching(
    rows: List[SparePartRow],
    params: ReviewParameters,
    prev: Dict[str, RowJudgment],
    hang_buffer: List,
) -> Dict[str, RowJudgment]:
    judgments: Dict[str, RowJudgment] = {}
    for row in rows:
        j = deepcopy(prev.get(row.row_id, RowJudgment(row.row_id, JudgmentType.PASS, [], [])))
        risks = detect_risky_substitution(row, params)
        if risks:
            hang_event, hang_judgment = create_hang_events_for_risks(row, risks)
            hang_buffer.append(hang_event)
            j.judgment = hang_judgment.judgment
            j.reason_codes = list(set(j.reason_codes + hang_judgment.reason_codes))
            j.affected_by = list(set(j.affected_by + hang_judgment.affected_by))
            j.detail = hang_judgment.detail
        else:
            if not params.allow_partial_match and "替代" in row.spec_model:
                j.judgment = JudgmentType.SUPPLEMENT
                j.reason_codes = list(set(j.reason_codes + ["partial_match_not_allowed"]))
                j.detail = "参数禁止部分匹配，替代型号需补充完整资料"
        judgments[row.row_id] = j
    return judgments


def _merge_judgment(
    current: JudgmentType, new: JudgmentType
) -> JudgmentType:
    priority = {
        JudgmentType.HANG: 4,
        JudgmentType.REJECT: 3,
        JudgmentType.SUPPLEMENT: 2,
        JudgmentType.PASS: 1,
    }
    return current if priority[current] >= priority[new] else new


def step_alarm_reconciliation(
    rows: List[SparePartRow],
    alarms: List[AlarmRecord],
    prev: Dict[str, RowJudgment],
) -> Dict[str, RowJudgment]:
    alarm_by_part: Dict[str, List[AlarmRecord]] = {}
    for a in alarms:
        alarm_by_part.setdefault(a.part_no, []).append(a)
    judgments: Dict[str, RowJudgment] = {}
    for row in rows:
        j = deepcopy(prev.get(row.row_id, RowJudgment(row.row_id, JudgmentType.PASS, [], [])))
        part_alarms = alarm_by_part.get(row.part_no, [])
        unresolved = [a for a in part_alarms if not a.resolved]
        if unresolved:
            manual_resolved = any(
                ("已处理" in row.manual_note)
                or ("人工关闭" in row.manual_note)
                for _ in [0]
            )
            alarm_ids = [a.alarm_id for a in unresolved]
            if manual_resolved:
                new_judgment = JudgmentType.SUPPLEMENT
                j.judgment = _merge_judgment(j.judgment, new_judgment)
                j.reason_codes = list(set(j.reason_codes + [
                    "alarm_manual_closed_need_verify",
                    "alarm_end_to_end_mismatch_risk",
                ]))
                j.affected_by = list(set(j.affected_by + [f"alarm:{aid}" for aid in alarm_ids]))
                j.detail = (
                    f"报警{alarm_ids}靠人工备注标记为已处理，"
                    f"为避免月底与报警系统导出对不上，仍需补充线下处理凭证留档"
                )
            else:
                new_judgment = JudgmentType.SUPPLEMENT
                j.judgment = _merge_judgment(j.judgment, new_judgment)
                j.reason_codes = list(set(j.reason_codes + ["alarm_unresolved"]))
                j.affected_by = list(set(j.affected_by + [f"alarm:{aid}" for aid in alarm_ids]))
                j.detail = (
                    f"未关闭报警：{alarm_ids}；"
                    f"如已线下处理请在备件清单备注写明，并上传处理凭证避免月底对账出错"
                )
        judgments[row.row_id] = j
    return judgments


def step_remark_injection(
    rows: List[SparePartRow],
    params: ReviewParameters,
    prev: Dict[str, RowJudgment],
    before_map: Optional[Dict[str, JudgmentType]] = None,
) -> Tuple[Dict[str, RowJudgment], Dict[str, JudgmentType]]:
    judgments: Dict[str, RowJudgment] = {}
    before_snapshot: Dict[str, JudgmentType] = {}
    for row in rows:
        j = deepcopy(prev.get(row.row_id, RowJudgment(row.row_id, JudgmentType.PASS, [], [])))
        before_snapshot[row.row_id] = j.judgment
        if row.remark:
            new_judgment, explanation = flip_judgment_by_remark(
                j.judgment, row.remark, params.remark_weight
            )
            if explanation:
                j.affected_by = list(set(j.affected_by + ["remark"]))
                j.detail = (j.detail + "；" if j.detail else "") + explanation
            if new_judgment != j.judgment:
                j.reason_codes = list(set(j.reason_codes + ["remark_override"]))
                j.judgment = new_judgment
        judgments[row.row_id] = j
    effective_before = before_map if before_map is not None else before_snapshot
    return judgments, effective_before


def step_final_judgment(
    prev: Dict[str, RowJudgment],
) -> Dict[str, RowJudgment]:
    judgments: Dict[str, RowJudgment] = {}
    for rid, j in prev.items():
        final_j = deepcopy(j)
        if not final_j.reason_codes and final_j.judgment == JudgmentType.PASS:
            final_j.detail = "所有步骤校验通过，予以放行"
        judgments[rid] = final_j
    return judgments


def run_review_pipeline(
    rows: List[SparePartRow],
    alarms: List[AlarmRecord],
    params: ReviewParameters,
    export_layer: VersionLayer = VersionLayer.LATEST_EXPORT,
    remark_patch: Optional[Dict[str, str]] = None,
    previous_result: Optional[ReviewResult] = None,
) -> Tuple[ReviewResult, Optional[RemarkPatchImpact]]:
    prepared_rows = rows
    patched_content: Dict[str, str] = {}
    if remark_patch:
        prepared_rows, patched_content = apply_remark_patch(rows, remark_patch)

    for r in prepared_rows:
        if not r.data_hash:
            r.data_hash = r.compute_hash()

    hang_events: List = []
    snapshots: List[StepSnapshot] = []
    current = _empty_judgments(prepared_rows)
    param_fp = params.fingerprint()

    step_funcs: List[Tuple[StepName, callable]] = [
        (StepName.MATERIAL_VALIDATION, lambda p: step_material_validation(prepared_rows, params, p)),
        (StepName.PART_MATCHING, lambda p: step_part_matching(prepared_rows, params, p, hang_events)),
        (StepName.ALARM_RECONCILIATION, lambda p: step_alarm_reconciliation(prepared_rows, alarms, p)),
    ]
    for step_name, func in step_funcs:
        current = func(current)
        snapshots.append(
            StepSnapshot(
                step=step_name,
                param_fingerprint=param_fp,
                row_judgments=deepcopy(current),
                summary=_summary(current),
            )
        )

    before_remark_map: Optional[Dict[str, JudgmentType]] = None
    if patched_content:
        before_remark_map = {rid: current[rid].judgment for rid in current}
    current, before_map_used = step_remark_injection(prepared_rows, params, current, before_remark_map)
    snapshots.append(
        StepSnapshot(
            step=StepName.REMARK_INJECTION,
            param_fingerprint=param_fp,
            row_judgments=deepcopy(current),
            summary=_summary(current),
        )
    )

    current = step_final_judgment(current)
    snapshots.append(
        StepSnapshot(
            step=StepName.FINAL_JUDGMENT,
            param_fingerprint=param_fp,
            row_judgments=deepcopy(current),
            summary=_summary(current),
        )
    )

    remark_impact: Optional[RemarkPatchImpact] = None
    if patched_content and before_map_used:
        after_map = {rid: current[rid] for rid in current}
        remark_impact = build_remark_impact(
            list(patched_content.keys()),
            {rid: RowJudgment(rid, j, [], []) for rid, j in before_map_used.items()},
            after_map,
            patched_content,
        )

    param_change_impact: Optional[ParameterChangeImpact] = None
    if previous_result:
        changes = detect_parameter_change(previous_result.parameters, params)
        if changes:
            main_change = changes[0]
            param_change_impact = annotate_impact_with_flips(
                main_change,
                previous_result.final_judgments,
                current,
            )

    result = ReviewResult(
        review_id=f"R-{uuid4().hex[:8]}",
        param_fingerprint=param_fp,
        parameters=params,
        snapshots=snapshots,
        final_judgments=current,
        hang_events=hang_events,
        remark_patch_impact=remark_impact,
        parameter_change_impact=param_change_impact,
        export_layer=export_layer,
    )
    return result, remark_impact
