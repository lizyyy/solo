"""误差传播计算核心引擎"""

import sympy as sp
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
import re

from .types import (
    Measurement, Formula, PropagationResult, PropagationStep,
    Issue, IssueType, Severity, ExperimentGroup
)
from .config import DEFAULT_BOUNDARY_CHECKS


class PropagationEngine:
    """误差传播引擎"""

    def __init__(self):
        self.issues: List[Issue] = []
        self.steps: List[PropagationStep] = []

    def propagate(
        self,
        formula: Formula,
        measurements: Dict[str, Measurement],
        target_unit: Optional[str] = None,
        assume_independent: bool = True
    ) -> PropagationResult:
        """
        执行误差传播计算

        参数:
            formula: 计算公式
            measurements: 测量值字典
            target_unit: 目标单位（可选）
            assume_independent: 是否假设变量独立（默认True）

        返回:
            PropagationResult: 计算结果
        """
        self.issues = []
        self.steps = []

        step_num = 1

        local_dict = {name: sp.Symbol(name) for name in measurements.keys()}
        local_dict.update({
            'pi': sp.pi,
            'π': sp.pi,
            'e': sp.E,
            'sin': sp.sin,
            'cos': sp.cos,
            'tan': sp.tan,
            'log': sp.log,
            'ln': sp.ln,
            'sqrt': sp.sqrt,
            'exp': sp.exp,
        })

        expr = sp.sympify(formula.expression, locals=local_dict)
        target_var = sp.Symbol(formula.target_variable)
        vars_in_expr = list(expr.free_symbols)
        var_names = [str(v) for v in vars_in_expr]

        missing_vars = [v for v in var_names if v not in measurements]
        if missing_vars:
            for v in missing_vars:
                self.issues.append(Issue(
                    issue_type=IssueType.INVALID_FORMULA,
                    severity=Severity.ERROR,
                    message=f"公式中变量 '{v}' 在测量数据中不存在",
                    details={'formula': formula.expression, 'missing': v}
                ))

        available_vars = [v for v in var_names if v in measurements]

        if missing_vars:
            result = PropagationResult(
                target_name=formula.target_variable,
                target_value=float('nan'),
                target_uncertainty=float('nan'),
                target_unit=target_unit or '',
                relative_uncertainty=float('nan'),
                steps=self.steps,
                combined_formula_latex=sp.latex(expr),
                uncertainty_contributions={},
                dominant_source='',
                boundary_checks=[],
                interpretation='无法计算：缺少必要变量'
            )
            return result

        if not available_vars:
            raise ValueError(f"公式中没有可用的变量: {formula.expression}")

        step1 = self._create_step(
            step_num,
            "定义计算公式和变量",
            f"{formula.target_variable} = {sp.latex(expr)}",
            f"{formula.target_variable} = {str(expr)}",
            var_names,
            {},
            {},
            {}
        )
        step1.notes.append(f"公式: {formula.description or '未提供描述'}")
        self.steps.append(step1)
        step_num += 1

        values = {str(v): measurements[str(v)].value for v in vars_in_expr if str(v) in measurements}
        uncertainties = {str(v): measurements[str(v)].uncertainty for v in vars_in_expr if str(v) in measurements}

        try:
            target_value = float(expr.subs(values).evalf())
        except Exception as e:
            raise ValueError(f"无法计算公式值: {str(e)}. 缺失变量: {missing_vars}")

        step2 = self._create_step(
            step_num,
            "计算目标量的最佳估计值",
            f"{formula.target_variable} = {sp.latex(expr)} = {target_value:.6g}",
            f"{formula.target_variable} = {str(expr)} = {target_value:.6g}",
            available_vars,
            {},
            {f"{v}": measurements[v].value for v in available_vars},
            {}
        )
        self.steps.append(step2)
        step_num += 1

        partial_derivatives = {}
        partial_latex = {}
        partial_text = {}

        for v in vars_in_expr:
            v_str = str(v)
            if v_str in measurements:
                pd = sp.diff(expr, v)
                partial_derivatives[v_str] = pd
                partial_latex[v_str] = f"\\frac{{\\partial {formula.target_variable}}}{{\\partial {v_str}}} = {sp.latex(pd)}"
                partial_text[v_str] = f"d({formula.target_variable})/d({v_str}) = {str(pd)}"

        step3 = self._create_step(
            step_num,
            "计算各变量的偏导数",
            "\\\\".join(partial_latex.values()),
            "; ".join(partial_text.values()),
            available_vars,
            {k: sp.latex(v) for k, v in partial_derivatives.items()},
            {},
            {}
        )
        step3.notes.append("偏导数描述了目标量对每个输入量变化的敏感程度")
        self.steps.append(step3)
        step_num += 1

        pd_values = {}
        for v_str, pd_expr in partial_derivatives.items():
            pd_val = float(pd_expr.subs(values).evalf())
            pd_values[v_str] = pd_val

        step4 = self._create_step(
            step_num,
            "代入测量值计算偏导数数值",
            "\\\\".join([f"\\frac{{\\partial {formula.target_variable}}}{{\\partial {v}}} = {val:.6g}" for v, val in pd_values.items()]),
            "; ".join([f"∂({formula.target_variable})/∂({v}) = {val:.6g}" for v, val in pd_values.items()]),
            available_vars,
            {},
            pd_values,
            {}
        )
        self.steps.append(step4)
        step_num += 1

        contributions = {}
        for v_str in available_vars:
            contrib = abs(pd_values[v_str] * uncertainties[v_str])
            contributions[v_str] = contrib

        step5 = self._create_step(
            step_num,
            "计算各变量的不确定度贡献",
            "\\\\".join([f"|\\frac{{\\partial {formula.target_variable}}}{{\\partial {v}}}| \\cdot u({v}) = {contrib:.6g}" for v, contrib in contributions.items()]),
            "; ".join([f"|∂({formula.target_variable})/∂({v})| × u({v}) = {contrib:.6g}" for v, contrib in contributions.items()]),
            available_vars,
            {},
            {},
            contributions
        )
        step5.notes.append("每个变量的不确定度贡献 = |偏导数| × 该变量的不确定度")
        self.steps.append(step5)
        step_num += 1

        if assume_independent:
            target_uncertainty = float(np.sqrt(sum(c ** 2 for c in contributions.values())))
            comb_formula = "u(" + formula.target_variable + ") = \\sqrt{" + " + ".join([
                f"\\left(\\frac{{\\partial {formula.target_variable}}}{{\\partial {v}}}\\right)^2 u({v})^2"
                for v in available_vars
            ]) + "}"
            comb_text = f"u({formula.target_variable}) = sqrt(" + " + ".join([
                f"(∂{formula.target_variable}/∂{v})² × u({v})²"
                for v in available_vars
            ]) + ")"
        else:
            target_uncertainty = sum(contributions.values())
            comb_formula = "u(" + formula.target_variable + ") = " + " + ".join([
                f"|\\frac{{\\partial {formula.target_variable}}}{{\\partial {v}}}| u({v})"
                for v in available_vars
            ])
            comb_text = f"u({formula.target_variable}) = " + " + ".join([
                f"|∂{formula.target_variable}/∂{v}| × u({v})"
                for v in available_vars
            ])

        step6 = self._create_step(
            step_num,
            "合成标准不确定度",
            comb_formula + f" = {target_uncertainty:.6g}",
            comb_text + f" = {target_uncertainty:.6g}",
            available_vars,
            {},
            {'target_uncertainty': target_uncertainty},
            contributions
        )
        if assume_independent:
            step6.notes.append("假设各变量独立不相关，使用方和根法合成")
            if not assume_independent:
                step6.notes.append("未假设独立，使用绝对值求和法（保守估计）")
        self.steps.append(step6)
        step_num += 1

        relative_unc = target_uncertainty / abs(target_value) if abs(target_value) > 1e-12 else float('inf')

        dominant_source = max(contributions, key=contributions.get) if contributions else "unknown"
        dominant_contrib = contributions.get(dominant_source, 0)
        dominant_percent = (dominant_contrib ** 2 / (target_uncertainty ** 2) * 100) if target_uncertainty > 0 else 0

        boundary_checks = self._check_boundaries(
            target_value, target_uncertainty, formula.target_variable
        )

        interpretation = self._generate_interpretation(
            target_value, target_uncertainty, relative_unc,
            dominant_source, dominant_percent, target_unit
        )

        result = PropagationResult(
            target_name=formula.target_variable,
            target_value=target_value,
            target_uncertainty=target_uncertainty,
            target_unit=target_unit or self._derive_unit(measurements, available_vars, target_unit),
            relative_uncertainty=relative_unc,
            steps=self.steps.copy(),
            combined_formula_latex=comb_formula,
            uncertainty_contributions=contributions,
            dominant_source=dominant_source,
            boundary_checks=boundary_checks,
            interpretation=interpretation
        )

        return result

    def _create_step(
        self,
        step_num: int,
        description: str,
        formula_latex: str,
        formula_text: str,
        variables: List[str],
        partial_derivatives: Dict[str, str],
        intermediate_values: Dict[str, float],
        uncertainty_contribution: Dict[str, float],
        notes: Optional[List[str]] = None
    ) -> PropagationStep:
        """创建传播步骤"""
        return PropagationStep(
            step_number=step_num,
            description=description,
            formula_latex=formula_latex,
            formula_text=formula_text,
            variables=variables,
            partial_derivatives=partial_derivatives,
            intermediate_values=intermediate_values,
            uncertainty_contribution=uncertainty_contribution,
            notes=notes or []
        )

    def _check_boundaries(
        self,
        value: float,
        uncertainty: float,
        name: str
    ) -> List[str]:
        """检查边界条件"""
        checks = []

        if DEFAULT_BOUNDARY_CHECKS.get('positive', True):
            if value < 0 and value - 3 * uncertainty < 0:
                if abs(value) < 3 * uncertainty:
                    checks.append(f"⚠️ {name} = {value:.3g} ± {uncertainty:.3g}，在3σ范围内包含0")
                else:
                    checks.append(f"❌ {name} = {value:.3g} 为负值，可能不符合物理意义")

        if DEFAULT_BOUNDARY_CHECKS.get('non_negative', True):
            if value < -3 * uncertainty:
                checks.append(f"❌ {name} = {value:.3g} 显著为负（< -3σ），需检查公式或数据")

        if DEFAULT_BOUNDARY_CHECKS.get('physical_reasonable', True):
            if abs(value) > 1e10 or abs(value) < 1e-10:
                if value != 0:
                    checks.append(f"ℹ️ {name} = {value:.3g} 量级异常，请确认是否符合预期")

        if not checks:
            checks.append("✅ 边界检查通过")

        return checks

    def _generate_interpretation(
        self,
        value: float,
        uncertainty: float,
        relative_unc: float,
        dominant_source: str,
        dominant_percent: float,
        unit: Optional[str]
    ) -> str:
        """生成结果解释"""
        interpretation_parts = []

        unit_str = f" {unit}" if unit else ""
        interpretation_parts.append(f"测量结果为: {value:.4g} ± {uncertainty:.4g}{unit_str}")

        if relative_unc < 0.001:
            quality = "极高"
        elif relative_unc < 0.01:
            quality = "很高"
        elif relative_unc < 0.05:
            quality = "较好"
        elif relative_unc < 0.1:
            quality = "一般"
        elif relative_unc < 0.2:
            quality = "较差"
        else:
            quality = "很差"

        interpretation_parts.append(f"相对不确定度为 {relative_unc*100:.2f}%，测量精度{quality}")

        interpretation_parts.append(
            f"不确定度的主要来源是 '{dominant_source}'，"
            f"贡献了总不确定度的 {dominant_percent:.1f}%"
        )

        if relative_unc > 0.1:
            interpretation_parts.append(
                f"建议: 优先改进 '{dominant_source}' 的测量精度，"
                f"这将最有效地降低最终结果的不确定度"
            )

        interpretation_parts.append(f"结果可表示为: {value:.4g}({int(round(uncertainty * 10**max(0, -int(np.floor(np.log10(uncertainty)))))):.0f}){unit_str}")

        return "\n".join(interpretation_parts)

    def _derive_unit(
        self,
        measurements: Dict[str, Measurement],
        variables: List[str],
        target_unit: Optional[str]
    ) -> str:
        """推导结果单位"""
        if target_unit:
            return target_unit

        units = [measurements[v].unit for v in variables if v in measurements]
        if units and all(u == units[0] for u in units):
            return units[0]

        return "derived"

    def process_group(
        self,
        group: ExperimentGroup,
        assume_independent: bool = True
    ) -> ExperimentGroup:
        """处理整个实验组"""
        for formula in group.formulas:
            try:
                result = self.propagate(
                    formula,
                    group.measurements,
                    assume_independent=assume_independent
                )
                group.results[formula.target_variable] = result
                group.issues.extend(self.issues)
            except Exception as e:
                group.issues.append(Issue(
                    issue_type=IssueType.INVALID_FORMULA,
                    severity=Severity.ERROR,
                    message=f"计算 '{formula.target_variable}' 时出错: {str(e)}",
                    details={'formula': formula.expression}
                ))

        return group
