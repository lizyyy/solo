"""误差传播计算核心引擎"""

import math
from typing import List, Dict, Tuple, Optional, Callable
from dataclasses import dataclass

from .models import (
    MeasurementVariable,
    PropagationFormula,
    PropagationResult,
    AnalysisSummary,
    ReviewerReport,
    EvidenceStatus,
)
from .exceptions import (
    AnomalyQueue,
    AnomalyRecord,
    AnomalyType,
    SeverityLevel,
    EmptyInputError,
)


class ErrorPropagationEngine:
    """误差传播计算引擎"""
    
    def __init__(self):
        self._formulas: Dict[str, PropagationFormula] = {}
        self._register_builtin_formulas()
    
    def _register_builtin_formulas(self) -> None:
        """注册内置的传播公式"""
        builtins = [
            PropagationFormula(
                name="矩形面积",
                expression="S = a * b",
                description="计算矩形面积，a为长，b为宽",
                variables=["a", "b"],
            ),
            PropagationFormula(
                name="圆柱体体积",
                expression="V = π * r² * h",
                description="计算圆柱体体积，r为底面半径，h为高",
                variables=["r", "h"],
            ),
            PropagationFormula(
                name="匀加速位移",
                expression="s = v₀ * t + 0.5 * a * t²",
                description="计算匀加速直线运动位移，v₀为初速度，a为加速度，t为时间",
                variables=["v0", "a", "t"],
            ),
            PropagationFormula(
                name="密度计算",
                expression="ρ = m / V",
                description="计算物质密度，m为质量，V为体积",
                variables=["m", "V"],
            ),
            PropagationFormula(
                name="电阻串联",
                expression="R_total = R₁ + R₂",
                description="计算串联电阻总阻值",
                variables=["R1", "R2"],
            ),
            PropagationFormula(
                name="单摆周期",
                expression="T = 2π * √(L / g)",
                description="计算单摆周期，L为摆长，g为重力加速度",
                variables=["L", "g"],
            ),
        ]
        for formula in builtins:
            self._formulas[formula.name] = formula
    
    def get_available_formulas(self) -> List[str]:
        """获取所有可用公式名称"""
        return list(self._formulas.keys())
    
    def get_formula(self, name: str) -> Optional[PropagationFormula]:
        """根据名称获取公式"""
        return self._formulas.get(name)
    
    def add_formula(self, formula: PropagationFormula) -> None:
        """添加自定义公式"""
        self._formulas[formula.name] = formula
    
    def detect_duplicates(
        self,
        variables: List[MeasurementVariable],
        tolerance: float = 1e-6,
    ) -> List[Tuple[MeasurementVariable, MeasurementVariable]]:
        """检测重复样本
        
        Args:
            variables: 测量变量列表
            tolerance: 数值相等容差
            
        Returns:
            重复样本对列表 (original, duplicate)
        """
        duplicates = []
        seen = {}
        
        for var in variables:
            key = (var.name, var.symbol, round(var.value, 10), round(var.uncertainty, 10), var.unit)
            if key in seen:
                duplicates.append((seen[key], var))
            else:
                seen[key] = var
        
        return duplicates
    
    def detect_boundary_samples(
        self,
        variables: List[MeasurementVariable],
        relative_threshold: float = 0.5,
    ) -> List[MeasurementVariable]:
        """检测边界样本（相对不确定度过大的样本）
        
        Args:
            variables: 测量变量列表
            relative_threshold: 相对不确定度阈值
            
        Returns:
            边界样本列表
        """
        boundary_samples = []
        for var in variables:
            if var.variable_type.value == "constant":
                continue
            if var.relative_uncertainty > relative_threshold:
                boundary_samples.append(var)
        return boundary_samples
    
    def calculate(
        self,
        formula_name: str,
        variables: List[MeasurementVariable],
        anomaly_queue: Optional[AnomalyQueue] = None,
        allow_duplicates: bool = False,
        auto_suspend_duplicates: bool = True,
    ) -> PropagationResult:
        """执行误差传播计算
        
        Args:
            formula_name: 公式名称
            variables: 测量变量列表
            anomaly_queue: 异常队列（用于收集异常）
            allow_duplicates: 是否允许重复样本参与计算
            auto_suspend_duplicates: 是否自动挂起重复样本
            
        Returns:
            传播计算结果
        """
        if anomaly_queue is None:
            anomaly_queue = AnomalyQueue()
        
        formula = self.get_formula(formula_name)
        if formula is None:
            raise ValueError(f"未知公式: {formula_name}")
        
        if not variables:
            record = AnomalyRecord(
                anomaly_type=AnomalyType.EMPTY_INPUT,
                severity=SeverityLevel.CRITICAL,
                message="输入变量列表为空，无法进行计算",
                resolution_hint="请检查输入数据源，确保至少包含一个有效测量变量",
            )
            anomaly_queue.add(record)
            raise EmptyInputError("输入变量列表为空", record)
        
        var_map = {v.symbol: v for v in variables}
        
        for required_var in formula.variables:
            if required_var not in var_map:
                record = AnomalyRecord(
                    anomaly_type=AnomalyType.INVALID_DATA,
                    severity=SeverityLevel.ERROR,
                    message=f"公式 {formula_name} 需要变量 {required_var}，但未提供",
                    details={"required": formula.variables, "provided": list(var_map.keys())},
                    resolution_hint="请检查变量符号是否与公式要求一致",
                )
                anomaly_queue.add(record)
        
        duplicates = self.detect_duplicates(variables)
        for original, duplicate in duplicates:
            duplicate.is_duplicate = True
            duplicate.duplicate_of = original.sample_id
            
            impact = self._assess_duplicate_impact(original, duplicate, formula_name)
            hint = self._get_duplicate_hint(impact, allow_duplicates)
            
            record = AnomalyRecord(
                anomaly_type=AnomalyType.DUPLICATE_SAMPLE,
                severity=SeverityLevel.WARNING,
                message=f"检测到重复样本: {duplicate.name} ({duplicate.sample_id}) 与 {original.name} ({original.sample_id}) 重复",
                sample_id=duplicate.sample_id,
                details={
                    "original_id": original.sample_id,
                    "duplicate_id": duplicate.sample_id,
                    "impact_assessment": impact,
                    "allow_duplicates": allow_duplicates,
                    "auto_suspend": auto_suspend_duplicates,
                },
                resolution_hint=hint,
            )
            anomaly_queue.add(record)
        
        boundary_samples = self.detect_boundary_samples(variables)
        for sample in boundary_samples:
            sample.is_boundary = True
            record = AnomalyRecord(
                anomaly_type=AnomalyType.BOUNDARY_SAMPLE,
                severity=SeverityLevel.WARNING,
                message=f"边界样本: {sample.name} 的相对不确定度 ({sample.relative_uncertainty:.4f}) 超过阈值",
                sample_id=sample.sample_id,
                details={
                    "relative_uncertainty": sample.relative_uncertainty,
                    "threshold": 0.5,
                    "value": sample.value,
                    "uncertainty": sample.uncertainty,
                },
                resolution_hint="建议重新测量或核查该样本的测量方法和仪器精度",
            )
            anomaly_queue.add(record)
        
        calc_trace = []
        suspended = False
        suspension_reason = None
        
        if auto_suspend_duplicates and duplicates and not allow_duplicates:
            suspended = True
            suspension_reason = "检测到重复样本，已自动挂起。如需放行请设置 --allow-duplicates"
            calc_trace.append("计算已挂起：存在重复样本")
        
        if not suspended:
            result = self._execute_calculation(formula, variables, calc_trace)
        else:
            result = self._execute_calculation(formula, variables, calc_trace, skip_uncertainty=True)
        
        result.suspended = suspended
        result.suspension_reason = suspension_reason
        
        return result
    
    def _assess_duplicate_impact(
        self,
        original: MeasurementVariable,
        duplicate: MeasurementVariable,
        formula_name: str,
    ) -> str:
        """评估重复样本对结果的影响"""
        if original.evidence_status != duplicate.evidence_status:
            return "high: 证据状态不一致，可能影响结果可信度"
        if abs(original.value - duplicate.value) > 1e-10:
            return "medium: 数值存在微小差异，可能是录入错误"
        return "low: 完全重复，不影响计算结果但会增加样本数量"
    
    def _get_duplicate_hint(self, impact: str, allow_duplicates: bool) -> str:
        """获取重复样本处理建议"""
        if allow_duplicates:
            return "当前已设置允许重复样本，将正常参与计算。建议核查是否为误录入。"
        if "high" in impact:
            return "影响较大，建议先挂起，核实数据来源后决定是否放行。"
        if "medium" in impact:
            return "影响中等，可选择挂起等待核实，或确认后放行。"
        return "影响较小，确认非误录入后可放行。"
    
    def _execute_calculation(
        self,
        formula: PropagationFormula,
        variables: List[MeasurementVariable],
        calc_trace: List[str],
        skip_uncertainty: bool = False,
    ) -> PropagationResult:
        """执行具体的误差传播计算"""
        var_map = {v.symbol: v for v in variables}
        
        calc_trace.append(f"=== {formula.name} 误差传播计算 ===")
        calc_trace.append(f"公式: {formula.expression}")
        
        values = {}
        uncertainties = {}
        for symbol in formula.variables:
            if symbol in var_map:
                v = var_map[symbol]
                values[symbol] = v.value
                uncertainties[symbol] = v.uncertainty
                calc_trace.append(
                    f"  {v.name} ({symbol}) = {v.value} ± {v.uncertainty} {v.unit} "
                    f"(来源: {v.evidence_source or '未指定'})"
                )
        
        result_value, partial_derivatives = self._calculate_value(
            formula.name, values, calc_trace
        )
        
        result_uncertainty = 0.0
        uncertainty_contributions = {}
        
        if not skip_uncertainty:
            result_uncertainty, uncertainty_contributions = self._calculate_uncertainty(
                partial_derivatives, uncertainties, calc_trace
            )
        else:
            calc_trace.append("  [已挂起] 跳过不确定度计算")
        
        result_unit = self._derive_unit(formula.name, variables)
        
        calc_trace.append(f"→ 最终结果: {result_value} ± {result_uncertainty} {result_unit}")
        calc_trace.append(f"  相对不确定度: {result_uncertainty / abs(result_value) * 100:.2f}%")
        
        if uncertainty_contributions:
            dominant = max(uncertainty_contributions.items(), key=lambda x: x[1])
            calc_trace.append(f"  主要不确定度来源: {dominant[0]} (贡献: {dominant[1]:.2f}%)")
        
        return PropagationResult(
            formula=formula,
            variables=variables,
            result_value=result_value,
            result_uncertainty=result_uncertainty,
            result_unit=result_unit,
            partial_derivatives=partial_derivatives,
            uncertainty_contributions=uncertainty_contributions,
            calculation_trace=calc_trace,
        )
    
    def _calculate_value(
        self,
        formula_name: str,
        values: Dict[str, float],
        calc_trace: List[str],
    ) -> Tuple[float, Dict[str, float]]:
        """计算最佳估计值和偏导数"""
        calc_trace.append("--- 计算最佳估计值 ---")
        
        if formula_name == "矩形面积":
            a, b = values["a"], values["b"]
            result = a * b
            calc_trace.append(f"  S = a × b = {a} × {b} = {result}")
            return result, {"a": b, "b": a}
        
        elif formula_name == "圆柱体体积":
            r, h = values["r"], values["h"]
            result = math.pi * r ** 2 * h
            calc_trace.append(f"  V = π × r² × h = π × {r}² × {h} = {result}")
            return result, {"r": 2 * math.pi * r * h, "h": math.pi * r ** 2}
        
        elif formula_name == "匀加速位移":
            v0, a, t = values["v0"], values["a"], values["t"]
            result = v0 * t + 0.5 * a * t ** 2
            calc_trace.append(f"  s = v₀×t + 0.5×a×t² = {v0}×{t} + 0.5×{a}×{t}² = {result}")
            return result, {"v0": t, "a": 0.5 * t ** 2, "t": v0 + a * t}
        
        elif formula_name == "密度计算":
            m, V = values["m"], values["V"]
            result = m / V
            calc_trace.append(f"  ρ = m / V = {m} / {V} = {result}")
            return result, {"m": 1 / V, "V": -m / V ** 2}
        
        elif formula_name == "电阻串联":
            R1, R2 = values["R1"], values["R2"]
            result = R1 + R2
            calc_trace.append(f"  R_total = R₁ + R₂ = {R1} + {R2} = {result}")
            return result, {"R1": 1.0, "R2": 1.0}
        
        elif formula_name == "单摆周期":
            L, g = values["L"], values["g"]
            result = 2 * math.pi * math.sqrt(L / g)
            calc_trace.append(f"  T = 2π × √(L/g) = 2π × √({L}/{g}) = {result}")
            dL = 2 * math.pi * 0.5 * (L / g) ** (-0.5) * (1 / g)
            dg = 2 * math.pi * 0.5 * (L / g) ** (-0.5) * (-L / g ** 2)
            return result, {"L": dL, "g": dg}
        
        else:
            raise ValueError(f"未实现的公式: {formula_name}")
    
    def _calculate_uncertainty(
        self,
        partial_derivatives: Dict[str, float],
        uncertainties: Dict[str, float],
        calc_trace: List[str],
    ) -> Tuple[float, Dict[str, float]]:
        """计算合成不确定度"""
        calc_trace.append("--- 计算合成不确定度 ---")
        
        total_variance = 0.0
        contributions = {}
        total_sq = 0.0
        
        calc_trace.append("  方差合成公式: u_c² = Σ(∂f/∂x_i)² × u²(x_i)")
        
        for var, pd in partial_derivatives.items():
            u = uncertainties.get(var, 0.0)
            term = (pd * u) ** 2
            total_variance += term
            total_sq += term
            calc_trace.append(f"    ({var}): ({pd:.4f})² × ({u})² = {term:.6f}")
        
        result_uncertainty = math.sqrt(total_variance)
        calc_trace.append(f"  u_c = √{total_variance:.6f} = {result_uncertainty:.6f}")
        
        calc_trace.append("--- 不确定度贡献分析 ---")
        for var, pd in partial_derivatives.items():
            u = uncertainties.get(var, 0.0)
            term = (pd * u) ** 2
            if total_sq > 0:
                pct = term / total_sq * 100
            else:
                pct = 0.0
            contributions[var] = pct
            calc_trace.append(f"    {var}: {pct:.2f}%")
        
        return result_uncertainty, contributions
    
    def _derive_unit(self, formula_name: str, variables: List[MeasurementVariable]) -> str:
        """推导结果单位"""
        var_map = {v.symbol: v for v in variables}
        
        if formula_name == "矩形面积":
            return f"{var_map['a'].unit}·{var_map['b'].unit}"
        elif formula_name == "圆柱体体积":
            return f"{var_map['r'].unit}³"
        elif formula_name == "匀加速位移":
            return var_map["v0"].unit.replace("/", "·")  # 简化处理
        elif formula_name == "密度计算":
            return f"{var_map['m'].unit}/{var_map['V'].unit}"
        elif formula_name == "电阻串联":
            return var_map["R1"].unit
        elif formula_name == "单摆周期":
            return "s"
        
        return "未知"
    
    def generate_summary(
        self,
        variables: List[MeasurementVariable],
        results: List[PropagationResult],
        anomaly_queue: AnomalyQueue,
    ) -> AnalysisSummary:
        """生成分析摘要（终端显示用）"""
        total = len(variables)
        boundary = sum(1 for v in variables if v.is_boundary)
        duplicate = sum(1 for v in variables if v.is_duplicate)
        suspended = sum(1 for r in results if r.suspended)
        valid = total - suspended
        
        key_findings = []
        if results:
            for result in results:
                if not result.suspended:
                    ru = result.relative_uncertainty * 100
                    dc = result.dominant_contribution
                    key_findings.append(
                        f"{result.formula.name}: 结果 = {result.result_value:.4f} ± {result.result_uncertainty:.4f} {result.result_unit}, "
                        f"相对不确定度 {ru:.2f}%, 主要来源: {dc}"
                    )
                else:
                    key_findings.append(
                        f"{result.formula.name}: [已挂起] {result.suspension_reason}"
                    )
        
        if boundary > 0:
            key_findings.append(f"⚠️ 检测到 {boundary} 个边界样本，相对不确定度过高")
        
        if duplicate > 0:
            key_findings.append(f"⚠️ 检测到 {duplicate} 个重复样本")
        
        return AnalysisSummary(
            total_samples=total,
            valid_samples=valid,
            boundary_samples=boundary,
            duplicate_samples=duplicate,
            suspended_samples=suspended,
            formulas_analyzed=[r.formula.name for r in results],
            key_findings=key_findings,
        )
    
    def generate_reviewer_report(
        self,
        variables: List[MeasurementVariable],
        results: List[PropagationResult],
    ) -> ReviewerReport:
        """生成复核人报告"""
        confirmed = []
        pending = []
        missing = []
        
        for var in variables:
            item = {
                "sample_id": var.sample_id,
                "name": var.name,
                "symbol": var.symbol,
                "value": var.value,
                "uncertainty": var.uncertainty,
                "unit": var.unit,
                "evidence_source": var.evidence_source,
                "evidence_notes": var.evidence_notes,
                "is_boundary": var.is_boundary,
                "is_duplicate": var.is_duplicate,
            }
            
            if var.evidence_status == EvidenceStatus.CONFIRMED:
                confirmed.append(item)
            elif var.evidence_status == EvidenceStatus.PENDING:
                pending.append(item)
            else:
                missing.append(item)
        
        recommendations = []
        
        if missing:
            recommendations.append(
                f"有 {len(missing)} 个样本缺少证据，需尽快补充测量记录或校准证书"
            )
        if pending:
            recommendations.append(
                f"有 {len(pending)} 个样本证据待确认，请相关责任人核实"
            )
        if any(v.is_boundary for v in variables):
            recommendations.append(
                "部分样本相对不确定度过高，建议重新测量或核查测量方法"
            )
        if any(v.is_duplicate for v in variables):
            recommendations.append(
                "存在重复样本，请确认是否为误录入，避免影响样本统计"
            )
        
        if not recommendations:
            recommendations.append("所有证据完整，状态良好，可正常使用")
        
        return ReviewerReport(
            confirmed_evidence=confirmed,
            pending_evidence=pending,
            missing_evidence=missing,
            recommendations=recommendations,
        )
