from __future__ import annotations

from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from .models import (
    HangEvent,
    JudgmentType,
    ReviewParameters,
    RowJudgment,
    SparePartRow,
)


SUBSTITUTION_RISK_REASONS = {
    "spec_mismatch": "替换件规格参数与原要求存在偏差",
    "supplier_unknown": "替换供应商未列入合格供方名录",
    "cert_missing": "替换件缺少原厂质量证明文件",
    "history_bad": "该型号替换件曾在过往复核中出现稳定性问题",
    "cross_brand": "跨品牌替换未通过兼容性试验",
}


def detect_risky_substitution(
    row: SparePartRow, params: ReviewParameters
) -> Optional[List[str]]:
    if not row.is_substituted:
        return None
    risks: List[str] = []
    if params.strict_substitution_check:
        if "替代" in row.spec_model or "兼容" not in row.spec_model:
            if "同规格" not in row.remark and "参数一致" not in row.remark:
                risks.append("spec_mismatch")
    if params.require_supplier_cert:
        if "合格供方" not in row.remark and "供方名录" not in row.remark:
            if "备案" not in row.supplier:
                risks.append("supplier_unknown")
        if "质量证明" not in row.remark and "合格证" not in row.remark:
            if "原厂证明" not in row.remark:
                risks.append("cert_missing")
    if "曾用" in row.remark and "问题" in row.remark:
        risks.append("history_bad")
    if row.original_part_no and row.original_part_no[:3] != row.part_no[:3]:
        if "兼容试验" not in row.remark and "匹配验证" not in row.remark:
            risks.append("cross_brand")
    return risks or None


def create_hang_events_for_risks(
    row: SparePartRow, risks: List[str]
) -> Tuple[HangEvent, RowJudgment]:
    detail_items = {
        risk: SUBSTITUTION_RISK_REASONS.get(risk, risk) for risk in risks
    }
    reason_lines = [f"- {k}：{v}" for k, v in detail_items.items()]
    reason_summary = "；".join(detail_items.values())
    hang = HangEvent(
        hang_id=f"H-{uuid4().hex[:8]}",
        row_id=row.row_id,
        reason=reason_summary,
        substitution_detail={
            "part_no": row.part_no,
            "original_part_no": row.original_part_no,
            "spec_model": row.spec_model,
            "risks": detail_items,
        },
    )
    judgment = RowJudgment(
        row_id=row.row_id,
        judgment=JudgmentType.HANG,
        reason_codes=risks,
        affected_by=[f"substitution:{row.part_no}"],
        detail="备件型号替换触发挂起：\n" + "\n".join(reason_lines) + "\n请算法值班人确认后方可进入下一步。",
    )
    return hang, judgment


def confirm_hang_event(
    hang: HangEvent,
    confirmed_by: str,
    allow_pass: bool,
    note: str = "",
) -> Tuple[HangEvent, JudgmentType, str]:
    hang.confirmed = True
    hang.confirmed_by = confirmed_by
    from datetime import datetime
    hang.confirmed_at = datetime.now()
    if allow_pass:
        return (
            hang,
            JudgmentType.PASS,
            f"值班人{confirmed_by}确认放行：{note or '替换件风险已核实通过'}",
        )
    return (
        hang,
        JudgmentType.REJECT,
        f"值班人{confirmed_by}拒绝放行：{note or '替换件风险不可接受'}",
    )
