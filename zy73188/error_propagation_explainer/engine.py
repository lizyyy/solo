"""误差传播计算引擎"""

import math
from typing import List, Tuple

from .models import (
    CaseRecord,
    CaseStatus,
    CalculationResult,
    Variable,
    AnomalyRecord,
    AnomalyType,
    SeverityLevel,
)
from .formulas import get_formula, BOUNDARY_RELATIVE_UNCERTAINTY_THRESHOLD


class PropagationEngine:
    """误差传播计算引擎"""

    def process_cases(
        self,
        cases: List[CaseRecord],
        anomalies: List[AnomalyRecord],
    ) -> Tuple[List[CaseRecord], List[AnomalyRecord]]:
        """处理所有题目

        Returns:
            (处理后的cases, 新增的anomalies)
        """
        for case in cases:
            if case.status == CaseStatus.MERGED:
                continue
            if case.status == CaseStatus.SUSPENDED:
                continue
            if case.status == CaseStatus.FAILED:
                continue

            self._detect_boundary(case, anomalies)

            try:
                self._calculate(case)
            except Exception as e:
                case.status = CaseStatus.FAILED
                case.error_message = f"计算失败: {e}"
                anomalies.append(AnomalyRecord(
                    anomaly_type=AnomalyType.CALCULATION_ERROR,
                    severity=SeverityLevel.ERROR,
                    message=f"题目 {case.case_id} 计算失败: {e}",
                    case_id=case.case_id,
                    file_name=case.file_name,
                    resolution_hint="请检查输入数据是否合理",
                ))

        return cases, anomalies

    def _detect_boundary(self, case: CaseRecord, anomalies: List[AnomalyRecord]):
        """检测边界样本"""
        for var in case.variables:
            if var.relative_uncertainty > BOUNDARY_RELATIVE_UNCERTAINTY_THRESHOLD:
                var.is_boundary = True
                case.is_boundary = True
                anomalies.append(AnomalyRecord(
                    anomaly_type=AnomalyType.BOUNDARY_SAMPLE,
                    severity=SeverityLevel.WARNING,
                    message=(
                        f"题目 {case.case_id} 的变量 {var.name}({var.symbol}) "
                        f"相对不确定度 {var.relative_uncertainty * 100:.1f}% 超过阈值 "
                        f"{BOUNDARY_RELATIVE_UNCERTAINTY_THRESHOLD * 100:.0f}%"
                    ),
                    case_id=case.case_id,
                    file_name=case.file_name,
                    details={
                        "variable": var.symbol,
                        "value": var.value,
                        "uncertainty": var.uncertainty,
                        "relative_uncertainty_pct": round(var.relative_uncertainty * 100, 2),
                        "threshold_pct": BOUNDARY_RELATIVE_UNCERTAINTY_THRESHOLD * 100,
                    },
                    resolution_hint="建议重新测量或核查该样本的测量方法和仪器精度",
                ))

    def _calculate(self, case: CaseRecord):
        """执行误差传播计算"""
        formula = get_formula(case.formula_name)
        if formula is None:
            case.status = CaseStatus.FAILED
            case.error_message = f"未知公式: {case.formula_name}"
            return

        var_map = {v.symbol: v for v in case.variables}
        values = {s: var_map[s].value for s in formula.required_vars if s in var_map}
        uncertainties = {s: var_map[s].uncertainty for s in formula.required_vars if s in var_map}

        trace = []
        trace.append(f"=== 题目 {case.case_id}: {case.title} ===")
        trace.append(f"公式: {formula.expression}")
        trace.append(f"说明: {formula.description}")
        trace.append("")
        trace.append("输入数据:")

        for symbol in formula.required_vars:
            v = var_map[symbol]
            ev_tag = ""
            if v.evidence_status.value == "pending":
                ev_tag = " [证据待确认]"
            elif v.evidence_status.value == "missing":
                ev_tag = " [证据缺失!]"
            boundary_tag = " [边界样本!]" if v.is_boundary else ""
            trace.append(
                f"  {v.name} ({symbol}) = {v.value} ± {v.uncertainty} {v.unit}"
                f"{ev_tag}{boundary_tag}"
            )
            if v.evidence_source:
                trace.append(f"    来源: {v.evidence_source}")

        trace.append("")
        trace.append("--- 计算最佳估计值 ---")
        result_value = formula.calc_value(values)
        trace.append(f"  代入公式: {formula.expression}")

        partial_derivatives = formula.calc_derivatives(values)
        for var, pd in partial_derivatives.items():
            trace.append(f"  ∂f/∂{var} = {pd:.6f}")

        trace.append("")
        trace.append("--- 计算合成不确定度 ---")
        trace.append("  方差合成: u_c² = Σ(∂f/∂x_i)² × u²(x_i)")

        total_variance = 0.0
        contributions = {}
        terms = {}

        for var, pd in partial_derivatives.items():
            u = uncertainties.get(var, 0.0)
            term = (pd * u) ** 2
            terms[var] = term
            total_variance += term
            trace.append(f"  {var}: ({pd:.6f})² × ({u})² = {term:.8f}")

        result_uncertainty = math.sqrt(total_variance)
        trace.append(f"  u_c = √{total_variance:.8f} = {result_uncertainty:.6f}")

        trace.append("")
        trace.append("--- 不确定度贡献分析 ---")
        for var, term in terms.items():
            if total_variance > 0:
                pct = term / total_variance * 100
            else:
                pct = 0.0
            contributions[var] = pct
            trace.append(f"  {var}: {pct:.2f}%")

        result_unit = formula.derive_unit(var_map)

        if abs(result_value) < 1e-12:
            rel_unc_pct = float('inf') if result_uncertainty > 0 else 0.0
        else:
            rel_unc_pct = abs(result_uncertainty / result_value) * 100

        dominant = max(contributions.items(), key=lambda x: x[1])[0] if contributions else None

        trace.append("")
        trace.append("=== 最终结果 ===")
        trace.append(f"  结果 = {result_value:.6f} ± {result_uncertainty:.6f} {result_unit}")
        trace.append(f"  相对不确定度 = {rel_unc_pct:.2f}%")
        if dominant:
            trace.append(f"  主要不确定度来源: {dominant} ({contributions[dominant]:.1f}%)")

        result = CalculationResult(
            result_value=result_value,
            result_uncertainty=result_uncertainty,
            result_unit=result_unit,
            relative_uncertainty_pct=rel_unc_pct,
            partial_derivatives=partial_derivatives,
            uncertainty_contributions=contributions,
            dominant_contribution=dominant,
            calc_trace=trace,
        )

        case.result = result
        case.status = CaseStatus.SUCCESS
