from __future__ import annotations

from copy import deepcopy
from typing import Dict, List, Tuple

from .models import (
    JudgmentType,
    RemarkPatchImpact,
    RowJudgment,
    SparePartRow,
    VersionLayer,
)


KEYWORDS_THAT_SOFTEN_PASS = [
    "已备案",
    "合格证明",
    "彩排补充",
    "现场确认",
    "质量承诺",
    "原厂替换",
]

KEYWORDS_THAT_SOFTEN_BLOCK = [
    "待核实",
    "无证明",
    "缺证书",
    "供应商更换",
    "规格存疑",
]


def apply_remark_patch(
    rows: List[SparePartRow],
    patch_map: Dict[str, str],
) -> Tuple[List[SparePartRow], Dict[str, str]]:
    patched: List[SparePartRow] = []
    patched_rows: Dict[str, str] = {}
    for row in rows:
        new_row = deepcopy(row)
        if row.row_id in patch_map:
            extra_remark = patch_map[row.row_id]
            original_remark = new_row.remark
            new_row.remark = (
                f"{original_remark} | [彩排补记]{extra_remark}"
                if original_remark
                else f"[彩排补记]{extra_remark}"
            )
            new_row.source_layer = VersionLayer.REMARK_PATCHED
            patched_rows[row.row_id] = extra_remark
        patched.append(new_row)
    return patched, patched_rows


def build_remark_impact(
    patched_row_ids: List[str],
    before: Dict[str, RowJudgment],
    after: Dict[str, RowJudgment],
    patch_content: Dict[str, str],
) -> RemarkPatchImpact:
    before_map = {rid: before[rid].judgment for rid in patched_row_ids if rid in before}
    after_map = {rid: after[rid].judgment for rid in patched_row_ids if rid in after}
    flipped = sum(1 for rid in before_map if before_map.get(rid) != after_map.get(rid))
    description_parts = [
        f"本次共对 {len(patched_row_ids)} 行补记了彩排备注，",
        f"其中 {flipped} 行的复核结论发生变化。",
    ]
    changed_rows = [
        rid
        for rid in patched_row_ids
        if before_map.get(rid) != after_map.get(rid)
    ]
    for rid in changed_rows:
        b = before_map.get(rid)
        a = after_map.get(rid)
        note = patch_content.get(rid, "")
        description_parts.append(
            f"- 行 {rid}：因备注「{note}」，由 {b.value if b else '未知'} 改为 {a.value if a else '未知'}"
        )
    stable = len(patched_row_ids) - flipped
    if stable:
        description_parts.append(
            f"另有 {stable} 行虽补记了备注，但结论未变（仍按原判断执行）。"
        )
    return RemarkPatchImpact(
        patched_row_ids=patched_row_ids,
        before_judgments=before_map,
        after_judgments=after_map,
        flipped_count=flipped,
        description="\n".join(description_parts),
    )


def hint_from_remark(remark: str) -> str:
    for kw in KEYWORDS_THAT_SOFTEN_PASS:
        if kw in remark:
            return f"备注含关键词「{kw}」，倾向放行"
    for kw in KEYWORDS_THAT_SOFTEN_BLOCK:
        if kw in remark:
            return f"备注含关键词「{kw}」，倾向补充或挂起"
    return ""


def flip_judgment_by_remark(
    current: JudgmentType, remark: str, weight: float
) -> Tuple[JudgmentType, str]:
    hint = hint_from_remark(remark)
    if not hint:
        return current, ""
    if current == JudgmentType.HANG:
        return current, "当前为挂起状态，备注不得擅自解除挂起，必须由算法值班人确认"
    if weight < 0.3:
        return current, "备注权重较低，不改变判断"
    if "倾向放行" in hint:
        if current == JudgmentType.SUPPLEMENT and weight >= 0.5:
            return JudgmentType.PASS, hint + "，补记足够有力，予以放行"
    if "倾向补充或挂起" in hint:
        if current == JudgmentType.PASS and weight >= 0.5:
            return JudgmentType.SUPPLEMENT, hint + "，原放行收回，转为补充材料"
        if current == JudgmentType.SUPPLEMENT and weight >= 0.7:
            return JudgmentType.HANG, hint + "，情况升级，需挂起确认"
    return current, hint + "，但权重或阈值未达到翻转条件"
