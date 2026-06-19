"""报告生成：编排“解析→冲突→拟合→单位→状态”，产出“接口返回”。

接口返回 = output/reports/<batch>_report.txt（人读）+ <batch>_report.json（程序读）
          + output/charts/<question_id>.svg（每题拟合图）。

关键体现需求：
- 分清谁影响了结论：influenced_by vs audit_sources。
- 两组参数对照：冲突题同时给出正式记录与学生草稿旧版两套参数 + 中间计算 + 单位换算。
- 算不出的不消失：每题必有 status 与 reason。
"""

import json
import math
import os
from typing import Any, Dict, List, Optional, Tuple

from . import conflict, fitting, sources, status, units
from .models import (
    BatchReport,
    FitResult,
    ParameterSet,
    QuestionBundle,
    QuestionReport,
    RawRecord,
    SOURCE_LABEL,
    SourceType,
    STATUS_LABEL,
    Status,
    VerbalNote,
)

CHART_W = 760
CHART_H = 480
PAD_L, PAD_R, PAD_T, PAD_B = 64, 24, 40, 64


# --------------------------------------------------------------------------- #
# 拟合预测（用于画曲线）
# --------------------------------------------------------------------------- #
def _predict(model: str, coeffs: Dict[str, float], x: float) -> Optional[float]:
    if model == "linear":
        return coeffs.get("intercept", 0.0) + coeffs.get("slope", 0.0) * x
    if model == "quadratic":
        return coeffs.get("c0", 0.0) + coeffs.get("c1", 0.0) * x + coeffs.get("c2", 0.0) * x * x
    if model == "exponential":
        try:
            return coeffs.get("a", 0.0) * math.exp(coeffs.get("b", 0.0) * x)
        except OverflowError:
            return None
    return None


def _model_text(model: str, coeffs: Dict[str, float]) -> str:
    if model == "linear":
        return f"y = {coeffs.get('intercept', 0):.4g} + {coeffs.get('slope', 0):.4g}·x"
    if model == "quadratic":
        return f"y = {coeffs.get('c0', 0):.4g} + {coeffs.get('c1', 0):.4g}·x + {coeffs.get('c2', 0):.4g}·x²"
    if model == "exponential":
        return f"y = {coeffs.get('a', 0):.4g}·exp({coeffs.get('b', 0):.4g}·x)"
    return f"（模型「{model or '(空)'}」无解析式）"


# --------------------------------------------------------------------------- #
# 单题编排
# --------------------------------------------------------------------------- #
def _build_parameter_set(
    record: RawRecord, fit: FitResult, label: str, target_y_unit: Optional[str]
) -> ParameterSet:
    unit_conversion: Dict[str, Any] = {}
    inter: List[str] = [f"=== {label}（来源：{SOURCE_LABEL[record.source]}）==="]
    inter.append(f"文件来源：{record.file_origin or '(内存)'}")
    inter.append(f"来源元数据：{json.dumps(record.source_meta, ensure_ascii=False)}")
    inter.append(f"模型：{record.model or '(空)'}，x单位「{record.x_unit or '(缺失)'}」，y单位「{record.y_unit or '(缺失)'}」")
    inter.append("拟合中间计算：")
    inter.extend(fit.solve_steps or ["（无中间步骤）"])

    if fit.success and target_y_unit and not units.is_missing(record.y_unit) \
            and not units.is_missing(target_y_unit) and record.y_unit != target_y_unit:
        conv = units.apply_y_conversion(fit, record.y_unit, target_y_unit)
        if conv:
            unit_conversion = conv
            inter.append("")
            inter.append(f"单位换算（用于与基准单位「{target_y_unit}」对齐）：")
            inter.extend(conv["steps"])
            inter.append(f"换算后系数：{json.dumps(conv['converted_coefficients'], ensure_ascii=False)}")

    return ParameterSet(
        label=label,
        source=record.source,
        source_meta=record.source_meta,
        unit_x=record.x_unit,
        unit_y=record.y_unit,
        fit=fit,
        unit_conversion=unit_conversion,
        intermediate_calculations=inter,
    )


def interpret_question(bundle: QuestionBundle, charts_dir: str) -> QuestionReport:
    canon = bundle.canonical_record
    notes = bundle.notes

    canon_fit = fitting.fit_record(canon.model, canon.points) if canon else None
    decision = status.decide(canon, canon_fit, notes)

    target_y_unit = canon.y_unit if canon else ""

    parameter_sets: List[ParameterSet] = []
    if canon and canon_fit is not None:
        parameter_sets.append(_build_parameter_set(canon, canon_fit, "参数集A：正式记录（基准）", target_y_unit))

    conflicting = conflict.conflicting_drafts(canon, bundle.records) if canon else []
    has_conflict = bool(conflicting)
    conflict_detail = ""
    if has_conflict and canon:
        _, conflict_detail = conflict.summarize(canon, conflicting)
        for idx, draft in enumerate(conflicting, start=1):
            draft_fit = fitting.fit_record(draft.model, draft.points)
            parameter_sets.append(
                _build_parameter_set(
                    draft, draft_fit, f"参数集B{idx if len(conflicting) > 1 else ''}：学生草稿旧版（备查）",
                    target_y_unit,
                )
            )

    audit = {r.source.value for r in bundle.records}
    if notes:
        audit.add(SourceType.VERBAL_NOTE.value)
    audit_sources = sorted(audit)

    chart_path = os.path.join(charts_dir, f"{bundle.question_id}.svg")

    return QuestionReport(
        question_id=bundle.question_id,
        title=canon.title if canon else bundle.question_id,
        status=decision.status,
        status_reason=decision.reason,
        influenced_by=decision.influenced_by,
        audit_sources=list(audit_sources),
        canonical_record=canon,
        parameter_sets=parameter_sets,
        verbal_notes=notes,
        conflict=has_conflict,
        conflict_detail=conflict_detail,
        pending_items=decision.pending_items,
        chart_path=chart_path,
    )


# --------------------------------------------------------------------------- #
# 批量编排
# --------------------------------------------------------------------------- #
def interpret_batch(batch_dir: str, charts_dir: str) -> BatchReport:
    records, notes, manifest = sources.load_batch(batch_dir)
    bundles = sources.group_by_question(records, notes)
    os.makedirs(charts_dir, exist_ok=True)

    questions = [interpret_question(b, charts_dir) for b in bundles]
    summary: Dict[str, int] = {}
    for q in questions:
        summary[q.status.value] = summary.get(q.status.value, 0) + 1

    return BatchReport(
        batch_id=sources.batch_id_from(manifest, batch_dir),
        received=sources.received_from(manifest),
        questions=questions,
        summary=summary,
    )


# --------------------------------------------------------------------------- #
# SVG 图表
# --------------------------------------------------------------------------- #
def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _display_coeffs(pset: ParameterSet) -> Tuple[Dict[str, float], str, str]:
    """返回 (用于绘图的系数, 绘图y单位, 说明)。冲突草稿优先用换算后系数对齐基准。"""
    if pset.unit_conversion:
        return pset.unit_conversion["converted_coefficients"], pset.unit_conversion["to_unit"], "（已换算为基准单位对齐）"
    return pset.fit.coefficients, pset.unit_y or "", ""


def render_svg(qr: QuestionReport) -> str:
    points = qr.canonical_record.points if qr.canonical_record else []
    # 收集所有要绘制的曲线（基准 + 冲突草稿换算后）
    curves: List[Tuple[str, str, Dict[str, float], str]] = []  # (label, color, coeffs, model)
    colors = ["#1f77b4", "#d62728", "#2ca02c"]
    for i, ps in enumerate(qr.parameter_sets):
        if not ps.fit.success:
            continue
        coeffs, _, _ = _display_coeffs(ps)
        label = ps.label
        curves.append((label, colors[i % len(colors)], coeffs, ps.fit.model))

    if not points and not curves:
        return _empty_svg(qr)

    xs = [p[0] for p in points]
    curve_ys: List[float] = []
    if curves and xs:
        x0, x1 = min(xs), max(xs)
        for _, _, coeffs, model in curves:
            for k in range(61):
                x = x0 + (x1 - x0) * k / 60
                y = _predict(model, coeffs, x)
                if y is not None:
                    curve_ys.append(y)
    ys = [p[1] for p in points] + curve_ys
    if not ys:
        ys = [0.0]

    xmin = min(xs) if xs else 0.0
    xmax = max(xs) if xs else 1.0
    ymin = min(ys)
    ymax = max(ys)
    if xmax == xmin:
        xmax = xmin + 1.0
    if ymax == ymin:
        ymax = ymin + 1.0
    pad = (ymax - ymin) * 0.1
    ymin -= pad
    ymax += pad

    def sx(x: float) -> float:
        return PAD_L + (x - xmin) / (xmax - xmin) * (CHART_W - PAD_L - PAD_R)

    def sy(y: float) -> float:
        return CHART_H - PAD_B - (y - ymin) / (ymax - ymin) * (CHART_H - PAD_T - PAD_B)

    parts: List[str] = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{CHART_W}" height="{CHART_H}" '
                 f'viewBox="0 0 {CHART_W} {CHART_H}" font-family="sans-serif">')
    parts.append(f'<rect width="{CHART_W}" height="{CHART_H}" fill="#ffffff"/>')
    parts.append(f'<text x="{PAD_L}" y="24" font-size="16" font-weight="bold">'
                 f'{_esc(qr.question_id)} {_esc(qr.title)}</text>')
    parts.append(f'<text x="{CHART_W - PAD_R}" y="24" font-size="12" text-anchor="end" '
                 f'fill="#555">{_esc(qr.status.value)} · {_esc(STATUS_LABEL[qr.status])}</text>')

    # 网格 + 刻度
    for i in range(5):
        gy = PAD_T + (CHART_H - PAD_T - PAD_B) * i / 4
        val = ymax - (ymax - ymin) * i / 4
        parts.append(f'<line x1="{PAD_L}" y1="{gy:.1f}" x2="{CHART_W - PAD_R}" y2="{gy:.1f}" '
                     f'stroke="#eee" stroke-width="1"/>')
        parts.append(f'<text x="{PAD_L - 6}" y="{gy + 3:.1f}" font-size="10" text-anchor="end" '
                     f'fill="#888">{val:.3g}</text>')
    for i in range(5):
        gx = PAD_L + (CHART_W - PAD_L - PAD_R) * i / 4
        val = xmin + (xmax - xmin) * i / 4
        parts.append(f'<text x="{gx:.1f}" y="{CHART_H - PAD_B + 16}" font-size="10" text-anchor="middle" '
                     f'fill="#888">{val:.3g}</text>')

    x_unit = qr.canonical_record.x_unit if qr.canonical_record else ""
    y_unit = qr.canonical_record.y_unit if qr.canonical_record else ""
    parts.append(f'<line x1="{PAD_L}" y1="{CHART_H - PAD_B}" x2="{CHART_W - PAD_R}" '
                 f'y2="{CHART_H - PAD_B}" stroke="#333" stroke-width="1.5"/>')
    parts.append(f'<line x1="{PAD_L}" y1="{PAD_T}" x2="{PAD_L}" y2="{CHART_H - PAD_B}" '
                 f'stroke="#333" stroke-width="1.5"/>')
    parts.append(f'<text x="{CHART_W // 2}" y="{CHART_H - 12}" font-size="12" text-anchor="middle">'
                 f'x {_esc(x_unit or "(缺失)")}</text>')
    parts.append(f'<text x="16" y="{CHART_H // 2}" font-size="12" text-anchor="middle" '
                 f'transform="rotate(-90 16 {CHART_H // 2})">y {_esc(y_unit or "(缺失)")}</text>')

    # 拟合曲线
    if curves and xs:
        x0, x1 = min(xs), max(xs)
        for label, color, coeffs, model in curves:
            pts = []
            for k in range(121):
                x = x0 + (x1 - x0) * k / 120
                y = _predict(model, coeffs, x)
                if y is None or y < ymin - (ymax - ymin) or y > ymax + (ymax - ymin):
                    continue
                pts.append(f"{sx(x):.1f},{sy(y):.1f}")
            dash = "" if "正式记录" in label or "基准" in label else ' stroke-dasharray="6 4"'
            parts.append(f'<polyline fill="none" stroke="{color}" stroke-width="2"{dash} '
                         f'points="{" ".join(pts)}"/>')

    # 数据点
    for x, y in points:
        parts.append(f'<circle cx="{sx(x):.1f}" cy="{sy(y):.1f}" r="4" fill="#222" stroke="#fff" '
                     f'stroke-width="1"/>')

    # 图例
    ly = PAD_T + 8
    for label, color, _, _ in curves:
        parts.append(f'<rect x="{PAD_L + 8}" y="{ly}" width="12" height="4" fill="{color}"/>')
        parts.append(f'<text x="{PAD_L + 26}" y="{ly + 5}" font-size="11" fill="#333">{_esc(label)}</text>')
        ly += 16

    if qr.conflict:
        parts.append(f'<text x="{PAD_L + 8}" y="{ly + 12}" font-size="11" fill="#d62728">'
                     f'⚠ 存在版本冲突：草稿曲线已换算为基准单位「{y_unit or "?"}」对齐，仅备查</text>')

    if qr.status in (Status.PENDING_PM, Status.STUCK_FORMULA, Status.STUCK_UNIT, Status.STUCK_THRESHOLD):
        parts.append(f'<text x="{CHART_W - PAD_R}" y="{CHART_H - 12}" font-size="11" text-anchor="end" '
                     f'fill="#b00">结论状态：{_esc(STATUS_LABEL[qr.status])}（非稳定结论）</text>')

    parts.append("</svg>")
    return "\n".join(parts)


def _empty_svg(qr: QuestionReport) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{CHART_W}" height="{CHART_H}" '
            f'viewBox="0 0 {CHART_W} {CHART_H}" font-family="sans-serif">'
            f'<rect width="{CHART_W}" height="{CHART_H}" fill="#fff"/>'
            f'<text x="{CHART_W // 2}" y="{CHART_H // 2}" text-anchor="middle" fill="#888">'
            f'{_esc(qr.question_id)} 无可绘制数据（{_esc(STATUS_LABEL[qr.status])}）</text></svg>')


# --------------------------------------------------------------------------- #
# 序列化
# --------------------------------------------------------------------------- #
def _fit_to_dict(fit: FitResult) -> dict:
    return {
        "model": fit.model,
        "success": fit.success,
        "coefficients": fit.coefficients,
        "coefficient_order": fit.coefficient_order,
        "formula": _model_text(fit.model, fit.coefficients) if fit.success else "",
        "r_squared": fit.r_squared,
        "ss_res": fit.ss_res,
        "ss_tot": fit.ss_tot,
        "error": fit.error,
    }


def _param_set_to_dict(ps: ParameterSet) -> dict:
    return {
        "label": ps.label,
        "source": ps.source.value,
        "source_meta": ps.source_meta,
        "unit_x": ps.unit_x,
        "unit_y": ps.unit_y,
        "fit": _fit_to_dict(ps.fit),
        "unit_conversion": ps.unit_conversion,
        "intermediate_calculations": ps.intermediate_calculations,
    }


def _question_to_dict(qr: QuestionReport) -> dict:
    canon = qr.canonical_record
    return {
        "question_id": qr.question_id,
        "title": qr.title,
        "status": qr.status.value,
        "status_label": STATUS_LABEL[qr.status],
        "status_reason": qr.status_reason,
        "influenced_by": qr.influenced_by,
        "audit_sources": qr.audit_sources,
        "conflict": qr.conflict,
        "conflict_detail": qr.conflict_detail,
        "pending_items": qr.pending_items,
        "chart_path": qr.chart_path,
        "canonical": {
            "model": canon.model if canon else "",
            "x_unit": canon.x_unit if canon else "",
            "y_unit": canon.y_unit if canon else "",
            "points": canon.points if canon else [],
            "threshold": canon.threshold if canon else {},
            "source": canon.source.value if canon else "",
        },
        "verbal_notes": [{"note": n.note, "source_meta": n.source_meta} for n in qr.verbal_notes],
        "parameter_sets": [_param_set_to_dict(ps) for ps in qr.parameter_sets],
    }


def batch_to_dict(br: BatchReport) -> dict:
    return {
        "batch_id": br.batch_id,
        "received": br.received,
        "summary": br.summary,
        "questions": [_question_to_dict(q) for q in br.questions],
    }


def to_json(br: BatchReport) -> str:
    return json.dumps(batch_to_dict(br), ensure_ascii=False, indent=2)


def to_text(br: BatchReport) -> str:
    lines: List[str] = []
    lines.append(f"曲线拟合图表解释 · 批次报告")
    lines.append(f"批次：{br.batch_id}    收样日期：{br.received or '(未注明)'}")
    lines.append(f"题目数：{len(br.questions)}")
    lines.append("状态汇总：" + "，".join(f"{k}={v}" for k, v in sorted(br.summary.items())) or "（无）")
    lines.append("=" * 78)

    for q in br.questions:
        lines.append("")
        lines.append(f"【{q.question_id}】{q.title}")
        lines.append(f"  状态：{q.status.value}（{STATUS_LABEL[q.status]}）")
        lines.append(f"  原因：{q.status_reason}")
        lines.append(f"  谁影响了结论：{', '.join(q.influenced_by) or '(无)'}")
        lines.append(f"  全部来源（备查）：{', '.join(q.audit_sources) or '(无)'}")
        if q.conflict:
            lines.append(f"  ⚠ 版本冲突：")
            for cl in q.conflict_detail.splitlines():
                lines.append(f"    {cl}")
        for ps in q.parameter_sets:
            lines.append(f"  --- {ps.label} ---")
            if ps.fit.success:
                lines.append(f"    公式：{_model_text(ps.fit.model, ps.fit.coefficients)}")
                lines.append(f"    系数：{ps.fit.coefficients}")
                r2 = ps.fit.r_squared
                lines.append(f"    R² = {r2:.6g}（SS_res={ps.fit.ss_res:.4g}, SS_tot={ps.fit.ss_tot:.4g}）"
                             if r2 is not None else "    R² = N/A")
            else:
                lines.append(f"    拟合未成功：{ps.fit.error}")
            lines.append(f"    单位：x「{ps.unit_x or '(缺失)'}」 y「{ps.unit_y or '(缺失)'}」")
            if ps.unit_conversion:
                lines.append(f"    单位换算：{ps.unit_conversion['formula']}")
        if q.verbal_notes:
            lines.append(f"  口头备注（仅说明，不单独确认单位/参数）：")
            for n in q.verbal_notes:
                lines.append(f"    - {n.note}  {json.dumps(n.source_meta, ensure_ascii=False)}")
        if q.pending_items:
            lines.append(f"  待办（{q.status.value}）：")
            for p in q.pending_items:
                lines.append(f"    ▸ {p}")
        lines.append(f"  拟合图：{q.chart_path}")

    lines.append("")
    lines.append("=" * 78)
    lines.append("说明：influenced_by 列出真正决定结论的来源；仅在 audit_sources 出现但不在 influenced_by 的来源，"
                 "属备查/被覆盖，未改变结论。")
    lines.append("单位缺失的题目为 PENDING_PM，已挂起，项目经理书面确认单位后重跑即可转 OK。")
    return "\n".join(lines)


def write_outputs(br: BatchReport, output_dir: str) -> Tuple[str, str]:
    reports_dir = os.path.join(output_dir, "reports")
    charts_dir = os.path.join(output_dir, "charts")
    os.makedirs(reports_dir, exist_ok=True)
    os.makedirs(charts_dir, exist_ok=True)

    txt_path = os.path.join(reports_dir, f"{br.batch_id}_report.txt")
    json_path = os.path.join(reports_dir, f"{br.batch_id}_report.json")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(to_text(br))
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(to_json(br))

    for q in br.questions:
        with open(q.chart_path, "w", encoding="utf-8") as f:
            f.write(render_svg(q))

    return txt_path, json_path
