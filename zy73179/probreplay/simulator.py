from __future__ import annotations

from typing import List, Tuple, Optional

import numpy as np

from .models import (
    SimParams,
    Record,
    RecordResult,
    RunResult,
    DeltaAttribution,
)

FORMULA_STR = "final = effective_score + N(0, sigma); pass = final >= pass_threshold"


def _scale_factor(params: SimParams, max_score: float) -> float:
    if params.unit == "percent":
        return 1.0 / max_score
    return 1.0


def simulate(records: List[Record], params: SimParams, max_score: float = 100.0) -> RunResult:
    f = _scale_factor(params, max_score)
    eff = np.array([r.effective_score * f for r in records], dtype=float)
    thr = params.pass_threshold * f
    sig = max(params.sigma * f, 1e-12)
    rng = np.random.default_rng(params.seed)
    noise = rng.normal(0.0, sig, size=(len(records), params.n_trials))
    finals = eff[:, None] + noise
    pass_mask = finals >= thr
    pass_prob = pass_mask.mean(axis=1)
    per_trial = pass_mask.mean(axis=0)

    band = 2.0 * params.sigma
    rec_results: List[RecordResult] = []
    for rec, p in zip(records, pass_prob):
        is_boundary = abs(rec.effective_score - params.pass_threshold) <= band
        rec_results.append(
            RecordResult(
                record_id=rec.id,
                name=rec.name,
                base_score=rec.base_score,
                effective_score=rec.effective_score,
                pass_prob=float(p),
                is_boundary=bool(is_boundary),
                passed=bool(p >= 0.5),
            )
        )
    aggregate = float(pass_prob.mean()) if len(pass_prob) else 0.0
    return RunResult(
        params=params,
        aggregate_pass_rate=aggregate,
        records=rec_results,
        distribution=[float(x) for x in per_trial.tolist()],
        formula=FORMULA_STR,
        unit=params.unit,
    )


def parse_adjust(spec: str, params: SimParams) -> Tuple[str, object, object]:
    if "=" in spec:
        name, val = spec.split("=", 1)
        name = name.strip()
        val = val.strip()
    else:
        name = spec.strip()
        val = None
    if name not in params.PARAM_NOTCHES:
        raise ValueError(
            f"未知可调参数: {name}（可选: {', '.join(params.PARAM_NOTCHES.keys())}）"
        )
    notches = params.notches(name)
    current = getattr(params, name)
    if val is None:
        try:
            idx = notches.index(current)
        except ValueError:
            idx = -1
        if idx < 0 or idx >= len(notches) - 1:
            new_val = notches[0]
        else:
            new_val = notches[idx + 1]
    else:
        new_val = val if name == "unit" else float(val)
    return name, current, new_val


def apply_adjustment(params: SimParams, name: str, new_val: object) -> SimParams:
    data = params.to_dict()
    data[name] = new_val
    return SimParams(**data)


def attribute_delta(
    baseline: RunResult,
    adjusted: RunResult,
    param_name: str,
    old_val: object,
    new_val: object,
    max_score: float,
) -> DeltaAttribution:
    delta = adjusted.aggregate_pass_rate - baseline.aggregate_pass_rate
    band = 2.0 * baseline.params.sigma
    base_by_id = {r.record_id: r for r in baseline.records}
    adj_by_id = {r.record_id: r for r in adjusted.records}
    n_total = max(len(baseline.records), 1)

    boundary_sum = 0.0
    non_boundary_sum = 0.0
    flips: List[str] = []
    boundary_lines: List[str] = []
    for rid, br in base_by_id.items():
        ar = adj_by_id.get(rid)
        if ar is None:
            continue
        d = ar.pass_prob - br.pass_prob
        if br.is_boundary:
            boundary_sum += d
            boundary_lines.append(
                f"  • {br.name}({rid}): eff={br.effective_score:g}, "
                f"P(通过) {br.pass_prob:.3f}→{ar.pass_prob:.3f} (Δ={d:+.3f})"
            )
            if (br.pass_prob < 0.5 <= ar.pass_prob) or (br.pass_prob >= 0.5 > ar.pass_prob):
                flips.append(rid)
        else:
            non_boundary_sum += d

    boundary_effect = boundary_sum / n_total
    non_boundary_effect = non_boundary_sum / n_total
    frac = (boundary_effect / delta) if abs(delta) > 1e-12 else 0.0

    if param_name == "sigma":
        formula_exp = (
            f"公式为阶跃判定 final=base+N(0,sigma)≥threshold。sigma 由 {old_val} 调至 {new_val}："
            f"公式对 sigma 的敏感度集中在阈值邻域（|effective−threshold|≲2σ），"
            f"远离阈值的样本通过概率几乎不变，故整体变化主要由边界样本贡献。"
        )
    elif param_name == "pass_threshold":
        formula_exp = (
            f"公式为阶跃判定 final≥threshold。阈值由 {old_val} 调至 {new_val}："
            f"阈值平移使原处于新旧阈值之间的边界样本发生判定翻转。"
        )
    elif param_name == "unit":
        formula_exp = (
            f"公式为阶跃判定。单位由 {old_val} 切至 {new_val}：分数、阈值、sigma 同比例缩放，"
            f"不等式方向不变，故二值判定结果应完全一致（delta≈0）。"
        )
    else:
        formula_exp = f"参数 {param_name} 由 {old_val} 调至 {new_val}，依据公式 {baseline.formula} 复算。"

    if param_name == "unit":
        unit_exp = (
            f"当前单位 {baseline.unit}（满分 {max_score}）。单位切换为同比例缩放："
            f"阈值带 ±{2*baseline.params.sigma:g} 分 等价于 "
            f"±{round(2*baseline.params.sigma/max_score*100, 3)}%；"
            f"同一 sigma 在百分比口径下数值放大 {max_score:g} 倍。"
            f"结论：单位不改变二值判定，仅改变波动大小的数值口径与可读性。"
        )
    else:
        unit_exp = (
            f"结果以 {baseline.unit} 为单位（满分 {max_score}）。"
            f"若改以百分比为单位，阈值带 ±{2*baseline.params.sigma:g} 分 = "
            f"±{round(2*baseline.params.sigma/max_score*100, 3)}%；"
            f"sigma={baseline.params.sigma:g} 分 相当于 {round(baseline.params.sigma/max_score*100, 3)}%。"
            f"单位口径不改变本次二值判定，但影响对波动量级的解读。"
        )

    if boundary_lines:
        boundary_exp = (
            f"边界样本（|effective−threshold|≤2σ={band:g}）共 {len(boundary_lines)} 条：\n"
            + "\n".join(boundary_lines)
            + f"\n折算到整体通过率 delta：边界贡献 {boundary_effect:+.4f}，"
            f"非边界贡献 {non_boundary_effect:+.4f}，合计 {boundary_effect+non_boundary_effect:+.4f}"
            f"（与 delta {delta:+.4f} 一致）。边界贡献占比约 {frac*100:.1f}%。"
        )
    else:
        boundary_exp = (
            "本次无样本落入边界带（|effective−threshold|≤2σ），故边界贡献为 0；"
            "delta 完全来自非边界样本。"
        )

    return DeltaAttribution(
        param_name=param_name,
        baseline_value=float(old_val) if not isinstance(old_val, str) else old_val,
        adjusted_value=float(new_val) if not isinstance(new_val, str) else new_val,
        baseline_rate=baseline.aggregate_pass_rate,
        adjusted_rate=adjusted.aggregate_pass_rate,
        delta=delta,
        formula_explanation=formula_exp,
        unit_explanation=unit_exp,
        boundary_explanation=boundary_exp,
        boundary_effect=boundary_effect,
        non_boundary_effect=non_boundary_effect,
        boundary_flips=flips,
    )
