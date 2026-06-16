import math
from typing import Dict, List, Tuple, Optional

from .models import ParameterEntry, FittingResult, HistoricalRecord, ManualNote
from .weights import WeightManager
from .boundaries import BoundaryChecker
from .units import UnitConverter
from .traceability import TraceLog


class HarmonicFitter:
    """
    弦乐泛音频率拟合引擎

    物理模型: f_n = n * f_1 * sqrt(1 + B * n²)
    - f_1: 基频
    - B: 非谐性系数 (inharmonicity coefficient)
    - n: 泛音序号

    线性化方法:
      令 y_n = f_n / n, 则 y_n² = f_1² + f_1² * B * n²
      对 y_n² 关于 n² 做加权最小二乘线性回归:
        y_n² = a + b * n²
      得到 f_1 = sqrt(a), B = b / a

    每条拟合结果都附带 reasoning 列表，说明为什么给出这个判断。
    """

    def __init__(
        self,
        weight_manager: Optional[WeightManager] = None,
        boundary_checker: Optional[BoundaryChecker] = None,
        unit_converter: Optional[UnitConverter] = None,
        trace_log: Optional[TraceLog] = None,
    ):
        self.weight_manager = weight_manager or WeightManager()
        self.boundary_checker = boundary_checker or BoundaryChecker()
        self.unit_converter = unit_converter or UnitConverter()
        self.trace_log = trace_log or TraceLog()

    def fit(
        self,
        entries: List[ParameterEntry],
        instrument: str,
        string_index: int,
        historical: Optional[List[HistoricalRecord]] = None,
        notes: Optional[List[ManualNote]] = None,
    ) -> FittingResult:
        relevant = [
            e
            for e in entries
            if e.instrument == instrument and e.string_index == string_index
        ]
        if not relevant:
            raise ValueError(
                f"没有找到 instrument={instrument}, string_index={string_index} 的参数条目"
            )

        reasoning: List[str] = []
        boundary_alerts: List[str] = []
        unit_conversion_notes: List[str] = []
        original_sources: List[str] = []
        note_refs: List[str] = []

        harmonics = {}
        for e in relevant:
            freq_hz = self.unit_converter.to_hz(e.observed_freq, e.unit)
            if e.unit != "Hz":
                unit_conversion_notes.append(
                    f"泛音n={e.harmonic_number}: {e.observed_freq} {e.unit} -> {freq_hz:.4f} Hz "
                    f"(换算系数={self.unit_converter.factor(e.unit)})"
                )
            harmonics[e.harmonic_number] = freq_hz
            src = f"{e.source}@{e.timestamp}"
            original_sources.append(src)

        if unit_conversion_notes:
            reasoning.append(
                f"单位换算: 共 {len(unit_conversion_notes)} 条频率从非Hz单位换算而来，详情见 unit_conversion_notes"
            )

        weights = self.weight_manager.get_weights(instrument, string_index, harmonics.keys())

        for note in (notes or []):
            if note.instrument == instrument and note.string_index == string_index:
                note_refs.append(note.note_id)
                reasoning.append(
                    f"人工备注[{note.note_id}]: {note.note_text} (作者={note.author}, 时间={note.timestamp})"
                )
                if note.weight_action and note.harmonic_number in weights:
                    old_w = weights[note.harmonic_number]
                    action_label = note.weight_action
                    if action_label == "reduce":
                        weights[note.harmonic_number] = old_w * 0.5
                    elif action_label == "increase":
                        weights[note.harmonic_number] = old_w * 1.5
                    elif action_label == "exclude":
                        weights[note.harmonic_number] = 0.0
                    new_w = weights[note.harmonic_number]
                    reasoning.append(
                        f"备注权重调整[{note.note_id}]: 泛音 n={note.harmonic_number} "
                        f"权重 {old_w:.4f} -> {new_w:.4f} (动作={action_label}, "
                        f"原因={note.note_text})"
                    )

        total_w = sum(weights.values())
        if total_w > 0 and abs(total_w - 1.0) > 1e-10:
            weights = {n: w / total_w for n, w in weights.items()}
            reasoning.append(
                f"权重归一化: 备注调整后权重之和={total_w:.4f}, 归一化到1.0"
            )

        weight_warnings = self.weight_manager.check_closure(weights)
        if weight_warnings:
            reasoning.append(f"权重闭合检查: {'; '.join(weight_warnings)}")
        weight_change_log = self.weight_manager.get_change_log(instrument, string_index)
        if weight_change_log:
            reasoning.append(
                f"权重变更历史: 共 {len(weight_change_log)} 次变更，最近一次: {weight_change_log[-1]}"
            )

        n_list = sorted(harmonics.keys())
        y2_list = []
        n2_list = []
        w_list = []
        for n in n_list:
            fn = harmonics[n]
            y_n = fn / n
            y2 = y_n ** 2
            n2 = n ** 2
            y2_list.append(y2)
            n2_list.append(n2)
            w = weights.get(n, 1.0)
            w_list.append(w)

        sum_w = sum(w_list)
        sum_wn2 = sum(w * n2 for w, n2 in zip(w_list, n2_list))
        sum_wy2 = sum(w * y2 for w, y2 in zip(w_list, y2_list))
        sum_wn2n2 = sum(w * n2 * n2 for w, n2 in zip(w_list, n2_list))
        sum_wn2y2 = sum(w * n2 * y2 for w, n2, y2 in zip(w_list, n2_list, y2_list))

        denom = sum_w * sum_wn2n2 - sum_wn2 ** 2
        if abs(denom) < 1e-15:
            raise ValueError("加权最小二乘矩阵奇异，无法拟合（可能泛音数据点过少或权重退化）")

        a = (sum_wn2n2 * sum_wy2 - sum_wn2 * sum_wn2y2) / denom
        b = (sum_w * sum_wn2y2 - sum_wn2 * sum_wy2) / denom

        if a <= 0:
            reasoning.append(
                f"拟合异常: 截距 a={a:.6f} ≤ 0，基频 f1=sqrt(a) 无实数解，"
                f"可能数据存在系统性偏差或权重设置不当"
            )
            fitted_f1 = 0.0
            fitted_B = 0.0
        else:
            fitted_f1 = math.sqrt(a)
            fitted_B = b / a

        reasoning.append(
            f"加权最小二乘回归: y² = a + b·n², a={a:.6f}, b={b:.8f} → "
            f"f1={fitted_f1:.4f} Hz, B={fitted_B:.8f}"
        )
        reasoning.append(
            f"拟合模型: f_n = n × {fitted_f1:.4f} × sqrt(1 + {fitted_B:.8f} × n²)"
        )

        residuals: Dict[int, float] = {}
        for n in n_list:
            fn_obs = harmonics[n]
            fn_fit = n * fitted_f1 * math.sqrt(1 + fitted_B * n ** 2) if fitted_f1 > 0 else 0.0
            res = fn_obs - fn_fit
            residuals[n] = round(res, 6)

        large_residuals = {n: r for n, r in residuals.items() if abs(r) > 2.0}
        if large_residuals:
            reasoning.append(
                f"残差预警: 泛音 {list(large_residuals.keys())} 的残差绝对值 > 2 Hz, "
                f"详情: {large_residuals}"
            )

        boundary_alerts = self.boundary_checker.check_fitted_params(
            instrument, string_index, fitted_f1, fitted_B
        )
        boundary_alerts += self.boundary_checker.check_observed_freqs(
            instrument, string_index, harmonics
        )
        if boundary_alerts:
            reasoning.append(f"边界阈值告警: {'; '.join(boundary_alerts)}")

        if historical:
            matching = [
                h
                for h in historical
                if h.instrument == instrument and h.string_index == string_index
            ]
            if matching:
                latest = matching[-1]
                f1_diff = fitted_f1 - latest.fitted_f1
                B_diff = fitted_B - latest.fitted_B
                reasoning.append(
                    f"与历史记录[{latest.record_id}]对比: "
                    f"f1 差值={f1_diff:+.4f} Hz, B 差值={B_diff:+.8f} "
                    f"(历史 f1={latest.fitted_f1:.4f}, B={latest.fitted_B:.8f}, 来源={latest.source})"
                )

        result = FittingResult(
            result_id=f"fit_{instrument}_s{string_index}_{len(n_list)}h",
            instrument=instrument,
            string_index=string_index,
            fitted_f1=round(fitted_f1, 4),
            fitted_B=round(fitted_B, 8),
            residuals=residuals,
            weights_used=weights,
            reasoning=reasoning,
            boundary_alerts=boundary_alerts,
            unit_conversion_notes=unit_conversion_notes,
            original_sources=original_sources,
            note_refs=note_refs,
        )

        self.trace_log.add(
            action="fit",
            source=",".join(original_sources[:3]),
            detail=f"拟合完成: f1={fitted_f1:.4f}Hz, B={fitted_B:.8f}, "
                   f"泛音数={len(n_list)}, 告警={len(boundary_alerts)}",
            extra={"result_id": result.result_id},
        )

        return result

    def predict(
        self,
        fitted_f1: float,
        fitted_B: float,
        max_harmonic: int = 10,
    ) -> Dict[int, float]:
        predictions = {}
        for n in range(1, max_harmonic + 1):
            fn = n * fitted_f1 * math.sqrt(1 + fitted_B * n ** 2)
            predictions[n] = round(fn, 4)
        return predictions
