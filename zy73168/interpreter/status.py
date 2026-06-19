"""状态裁定：按“公式 → 单位 → 阈值 → 正常”顺序判定，确保算不出的记录不消失。

判定优先级（前者优先）：
1. 无记录 / 模型空 / 拟合失败  → STUCK_FORMULA（卡在公式）
2. 单位有歧义（如 "cm/mm"）    → STUCK_UNIT（卡在单位）
3. 单位缺失                      → PENDING_PM（挂起等项目经理，绝不给假稳定结论）
4. R² 低于阈值                   → STUCK_THRESHOLD（卡在阈值）
5. 否则                          → OK

influenced_by 只写“真正决定结论”的来源；仅备查/被覆盖的来源不进这里，进 audit_sources。
"""

from dataclasses import dataclass, field
from typing import List, Optional

from . import units
from .models import FitResult, RawRecord, SourceType, Status, VerbalNote


@dataclass
class StatusDecision:
    status: Status
    reason: str
    pending_items: List[str] = field(default_factory=list)
    influenced_by: List[str] = field(default_factory=list)


def decide(canon: Optional[RawRecord], fit: Optional[FitResult], notes: List[VerbalNote]) -> StatusDecision:
    if canon is None:
        return StatusDecision(
            Status.STUCK_FORMULA,
            "无拟合记录，仅有口头备注：无法确定公式与数据。",
            pending_items=["补充该题的拟合记录（含数据点与模型）"],
            influenced_by=[SourceType.VERBAL_NOTE.value],
        )

    influenced = [canon.source.value]

    model = (canon.model or "").strip().lower()
    if not model:
        return StatusDecision(
            Status.STUCK_FORMULA,
            "模型字段为空：无法确定拟合公式。建议补充 linear/quadratic/exponential 之一后重跑。",
            pending_items=[f"确认题 {canon.question_id} 的拟合模型"],
            influenced_by=influenced,
        )

    if fit is None or not fit.success:
        err = fit.error if fit else "未执行拟合"
        return StatusDecision(
            Status.STUCK_FORMULA,
            f"公式执行失败：{err}",
            pending_items=[f"修正题 {canon.question_id} 的数据或模型后重跑"],
            influenced_by=influenced,
        )

    if units.is_ambiguous(canon.x_unit) or units.is_ambiguous(canon.y_unit):
        bad = "x" if units.is_ambiguous(canon.x_unit) else "y"
        return StatusDecision(
            Status.STUCK_UNIT,
            f"{bad}轴单位有歧义：「{canon.x_unit if bad == 'x' else canon.y_unit}」，需明确单一单位。",
            pending_items=[f"明确题 {canon.question_id} 的 {bad} 轴单位"],
            influenced_by=influenced,
        )

    if units.is_missing(canon.x_unit) or units.is_missing(canon.y_unit):
        missing = []
        if units.is_missing(canon.x_unit):
            missing.append("x轴单位")
        if units.is_missing(canon.y_unit):
            missing.append("y轴单位")
        hints = units.verbal_unit_hints(notes)
        pending = [f"确认题 {canon.question_id} 的 {' / '.join(missing)}（口头备注不作为确认依据）"]
        pending.extend(hints)
        infl = list(influenced)
        if hints:
            infl.append(SourceType.VERBAL_NOTE.value)
        return StatusDecision(
            Status.PENDING_PM,
            f"单位缺失（{' / '.join(missing)}）：挂起等项目经理确认，暂不给稳定结论。",
            pending_items=pending,
            influenced_by=infl,
        )

    min_r2 = canon.threshold.get("min_r2")
    if min_r2 is not None and fit.r_squared is not None and fit.r_squared < float(min_r2):
        return StatusDecision(
            Status.STUCK_THRESHOLD,
            f"R² = {fit.r_squared:.4f} 低于阈值 {float(min_r2)}：拟合质量不达标。",
            pending_items=[f"复核题 {canon.question_id} 数据点或更换模型后重跑（目标 R² ≥ {min_r2}）"],
            influenced_by=influenced,
        )

    note_hint = ""
    if notes:
        note_hint = "（口头备注仅作说明用，未改变结论；详见报告口头备注栏）"
    return StatusDecision(
        Status.OK,
        f"拟合成功，单位齐全，R² 达标。{note_hint}".strip(),
        influenced_by=influenced,
    )
