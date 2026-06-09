from __future__ import annotations

from typing import Dict, List, Tuple

from .models import (
    HangEvent,
    JudgmentType,
    ParameterChangeImpact,
    RemarkPatchImpact,
    ReviewResult,
    RowJudgment,
    SparePartRow,
)
from .deviation_locator import format_deviation_report, locate_deviation_rows
from .parameter_trace import format_parameter_trace_for_duty


REPORT_HEADER = "=" * 60 + "\n桥梁支座报告复核（安全员老唐专用版）\n" + "=" * 60


def _collect_action_lists(
    rows: List[SparePartRow],
    judgments: Dict[str, RowJudgment],
) -> Tuple[List[str], List[str], List[str]]:
    row_index = {r.row_id: r for r in rows}
    to_supplement: List[str] = []
    to_pass: List[str] = []
    to_hang: List[str] = []
    for rid, j in judgments.items():
        row = row_index.get(rid)
        label = (
            f"{row.part_name}（{row.part_no}，行 {rid}）"
            if row
            else f"行 {rid}"
        )
        if j.judgment == JudgmentType.PASS:
            to_pass.append(f"  √ {label}：{j.detail or '各项指标正常'}")
        elif j.judgment == JudgmentType.SUPPLEMENT:
            reason = "；".join(j.reason_codes) or j.detail or "材料不全"
            to_supplement.append(f"  ！ {label}：需补【{reason}】")
        elif j.judgment == JudgmentType.HANG:
            to_hang.append(f"  ? {label}：{j.detail or '待值班人确认'}")
        elif j.judgment == JudgmentType.REJECT:
            to_supplement.append(f"  × {label}：不予放行（{j.detail or '原因未明'}）")
    return to_supplement, to_pass, to_hang


def build_tang_report(
    result: ReviewResult,
    rows: List[SparePartRow],
    previous_result: ReviewResult | None = None,
    step_diff_brief: Dict[str, Dict[str, int]] | None = None,
) -> str:
    lines = [REPORT_HEADER]
    lines.append(
        f"复核编号：{result.review_id}    参数指纹：{result.param_fingerprint}"
    )
    lines.append(f"导出层级：{result.export_layer.value}    生成时间：{result.generated_at:%Y-%m-%d %H:%M}")
    lines.append("")

    to_supplement, to_pass, to_hang = _collect_action_lists(rows, result.final_judgments)

    lines.append("——" * 30)
    lines.append("一、老唐先看：哪些材料该补，哪些可以放行")
    lines.append("——" * 30)
    lines.append("")
    if to_supplement:
        lines.append(f"【需补材料】共 {len(to_supplement)} 项，月底前必须闭环，否则报警持续：")
        lines.extend(to_supplement)
    else:
        lines.append("【需补材料】0 项，材料齐全，无需补单。")
    lines.append("")
    if to_pass:
        lines.append(f"【可放行材料】共 {len(to_pass)} 项，可直接走下一道工序：")
        lines.extend(to_pass)
    else:
        lines.append("【可放行材料】0 项，暂无可放行材料。")
    lines.append("")
    if to_hang:
        lines.append(f"【挂起待确认】共 {len(to_hang)} 项，不要擅自放行，请先找算法值班人：")
        lines.extend(to_hang)
    else:
        lines.append("【挂起待确认】0 项，无挂起事项。")
    lines.append("")

    lines.append("——" * 30)
    lines.append("二、偏差定位：哪一行备件拖偏了复核结论")
    lines.append("——" * 30)
    deviations = locate_deviation_rows(
        rows, result.snapshots, result.final_judgments
    )
    lines.append(format_deviation_report(deviations))
    lines.append("")

    if result.remark_patch_impact:
        lines.append("——" * 30)
        lines.append("三、彩排补记备注：这些补记改变了哪些判断")
        lines.append("——" * 30)
        lines.append(result.remark_patch_impact.description)
        lines.append("")

    if result.parameter_change_impact or step_diff_brief:
        lines.append("——" * 30)
        lines.append("四、参数变化：换参数跑时哪一步让结果变了")
        lines.append("——" * 30)
        impacts: List[ParameterChangeImpact] = []
        if result.parameter_change_impact:
            impacts = [result.parameter_change_impact]
        elif previous_result:
            from .parameter_trace import detect_parameter_change
            impacts = detect_parameter_change(
                previous_result.parameters, result.parameters
            )
        step_brief = step_diff_brief or {}
        if previous_result:
            from .parameter_trace import build_step_diff_brief
            step_brief = build_step_diff_brief(
                previous_result.snapshots, result.snapshots
            )
        lines.append(format_parameter_trace_for_duty(impacts, step_brief))
        lines.append("")

    if result.hang_events:
        lines.append("——" * 30)
        lines.append("五、备件型号替换：这些挂起事项等值班人拍板")
        lines.append("——" * 30)
        for idx, hang in enumerate(result.hang_events, 1):
            status = "已确认" if hang.confirmed else "待确认"
            lines.append(
                f"  {idx}. 行 {hang.row_id}（{hang.hang_id}） [{status}]"
            )
            lines.append(f"     原因：{hang.reason}")
            lines.append(f"     触发方：{hang.require_confirm_from}")
            if hang.confirmed:
                lines.append(
                    f"     处理：{hang.confirmed_by} 于 {hang.confirmed_at:%Y-%m-%d %H:%M} 确认"
                )
        lines.append("")

    lines.append("——" * 30)
    lines.append("收尾（给老唐的人话版）")
    lines.append("——" * 30)
    total = len(result.final_judgments)
    pass_n = len(to_pass)
    supp_n = len(to_supplement)
    hang_n = len(to_hang)
    lines.append(
        f"本次共复核 {total} 条备件，放行 {pass_n} 条，需补 {supp_n} 条，挂起 {hang_n} 条。"
    )
    if supp_n:
        lines.append(
            f"老唐重点盯紧上面那 {supp_n} 条需补材料，清单里的行号都给了，直接去问对应的供应商/班组要材料，"
            f"免得月底被报警和人工备注对不上拖住你加班。"
        )
    if hang_n:
        lines.append(
            "型号替换那些别自己说了算，一定先喊算法值班人点了确认再放行，"
            "确认单要留底归档，月底对不上报警少不了你。"
        )
    if not supp_n and not hang_n:
        lines.append("材料全齐、替换无风险，安心走流程，月底不会被报警拖下班。")
    lines.append("")
    return "\n".join(lines)
