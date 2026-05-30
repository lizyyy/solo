"""单位校验和有效数字检查模块"""

import pint
import numpy as np
from typing import List, Dict, Optional, Tuple, Any
import re

from .types import Issue, IssueType, Severity, Measurement, PropagationResult
from .config import COMMON_UNITS, DEFAULT_SIG_FIGS, UNCERTAINTY_SIG_FIGS


class UnitValidator:
    """单位校验器"""

    def __init__(self):
        self.ureg = pint.UnitRegistry()
        self.issues: List[Issue] = []

    def validate_measurement(self, measurement: Measurement, row_idx: Optional[int] = None) -> Optional[Issue]:
        """验证单个测量值的单位"""
        issue = None

        if not measurement.unit:
            issue = Issue(
                issue_type=IssueType.INVALID_UNIT,
                severity=Severity.WARNING,
                message=f"测量值 '{measurement.name}' 缺少单位",
                row_index=row_idx,
                column_name='unit'
            )
            return issue

        try:
            unit = self.ureg.parse_expression(measurement.unit)
            if unit.dimensionless:
                issue = Issue(
                    issue_type=IssueType.INVALID_UNIT,
                    severity=Severity.INFO,
                    message=f"测量值 '{measurement.name}' 的单位为无量纲",
                    row_index=row_idx,
                    column_name='unit'
                )
        except pint.errors.UndefinedUnitError:
            issue = Issue(
                issue_type=IssueType.INVALID_UNIT,
                severity=Severity.ERROR,
                message=f"测量值 '{measurement.name}' 的单位 '{measurement.unit}' 无法识别",
                row_index=row_idx,
                column_name='unit',
                details={'suggestions': self._suggest_units(measurement.unit)}
            )
        except Exception as e:
            issue = Issue(
                issue_type=IssueType.INVALID_UNIT,
                severity=Severity.ERROR,
                message=f"解析单位 '{measurement.unit}' 时出错: {str(e)}",
                row_index=row_idx,
                column_name='unit'
            )

        sig_issue = self._check_significant_figures(measurement, row_idx)
        if sig_issue:
            self.issues.append(sig_issue)

        return issue

    def validate_formula_units(
        self,
        formula: str,
        measurements: Dict[str, Measurement],
        target_unit: Optional[str] = None
    ) -> List[Issue]:
        """验证公式的量纲一致性"""
        issues: List[Issue] = []

        try:
            import sympy as sp

            local_dict = {name: sp.Symbol(name) for name in measurements.keys()}
            local_dict.update({
                'pi': sp.pi, 'π': sp.pi, 'e': sp.E,
                'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan,
                'log': sp.log, 'ln': sp.ln, 'sqrt': sp.sqrt, 'exp': sp.exp,
            })
            expr = sp.sympify(formula, locals=local_dict)
            vars_in_expr = [str(v) for v in expr.free_symbols]

            unit_map = {}
            for name in vars_in_expr:
                if name in measurements:
                    try:
                        unit_map[name] = self.ureg.parse_expression(measurements[name].unit)
                    except Exception:
                        pass

            if unit_map:
                def eval_dimensionality(expr):
                    if expr.is_Number:
                        return {}
                    if isinstance(expr, sp.Symbol):
                        name = str(expr)
                        if name in unit_map:
                            return dict(unit_map[name].dimensionality)
                        return {}
                    if expr.func == sp.Pow:
                        base_dim = eval_dimensionality(expr.args[0])
                        exp = float(expr.args[1]) if expr.args[1].is_Number else float(expr.args[1].evalf())
                        result = {}
                        for k, v in base_dim.items():
                            result[k] = v * exp
                        return result
                    if expr.func == sp.Mul:
                        result = {}
                        for arg in expr.args:
                            arg_dim = eval_dimensionality(arg)
                            for k, v in arg_dim.items():
                                result[k] = result.get(k, 0) + v
                        return result
                    if expr.func == sp.Add:
                        dims = [eval_dimensionality(arg) for arg in expr.args]
                        dim_strs = [str(d) for d in dims]
                        if len(set(dim_strs)) > 1:
                            issues.append(Issue(
                                issue_type=IssueType.UNIT_MISMATCH,
                                severity=Severity.ERROR,
                                message=f"加法项量纲不一致: {dims}",
                                details={'formula': formula}
                            ))
                        return dims[0]
                    if expr.func in (sp.sin, sp.cos, sp.tan, sp.log, sp.ln, sp.exp, sp.sqrt):
                        arg_dim = eval_dimensionality(expr.args[0])
                        if arg_dim and arg_dim != {}:
                            issues.append(Issue(
                                issue_type=IssueType.UNIT_MISMATCH,
                                severity=Severity.ERROR,
                                message=f"{expr.func} 的参数必须是无量纲的，实际量纲为 {arg_dim}",
                                details={'formula': formula}
                            ))
                        return {}
                    return {}

                result_dim = eval_dimensionality(expr)

                if target_unit:
                    try:
                        target = self.ureg.parse_expression(target_unit)
                        target_dim = dict(target.dimensionality)
                        result_dim_normalized = {k: round(v, 10) for k, v in result_dim.items()}
                        target_dim_normalized = {k: round(v, 10) for k, v in target_dim.items()}
                        if result_dim_normalized != target_dim_normalized:
                            issues.append(Issue(
                                issue_type=IssueType.UNIT_MISMATCH,
                                severity=Severity.ERROR,
                                message=f"公式量纲不匹配: 计算结果量纲为 {result_dim}, 目标量纲为 {target_dim}",
                                details={
                                    'formula': formula,
                                    'result_dimension': str(result_dim),
                                    'target_dimension': str(target_dim),
                                    'target_unit': target_unit
                                }
                            ))
                    except Exception:
                        pass

        except Exception as e:
            issues.append(Issue(
                issue_type=IssueType.INVALID_FORMULA,
                severity=Severity.ERROR,
                message=f"公式量纲分析失败: {str(e)}",
                details={'formula': formula}
            ))

        return issues

    def _suggest_units(self, unit_str: str) -> List[str]:
        """建议可能的正确单位"""
        suggestions = []
        unit_str_lower = unit_str.lower()

        for category, units in COMMON_UNITS.items():
            for unit in units:
                if unit_str_lower in unit.lower() or unit.lower() in unit_str_lower:
                    suggestions.append(f"{unit} ({category})")
                if len(unit_str) > 2 and len(unit) > 2:
                    from difflib import SequenceMatcher
                    ratio = SequenceMatcher(None, unit_str_lower, unit.lower()).ratio()
                    if ratio > 0.7:
                        suggestions.append(f"{unit} ({category})")

        return list(dict.fromkeys(suggestions))[:5]

    def _check_significant_figures(self, measurement: Measurement, row_idx: Optional[int] = None) -> Optional[Issue]:
        """检查有效数字"""
        if measurement.significant_figures is None:
            return None

        if measurement.significant_figures < 1:
            return Issue(
                issue_type=IssueType.SIGNIFICANT_FIGURES,
                severity=Severity.WARNING,
                message=f"测量值 '{measurement.name}' 的有效数字位数异常",
                row_index=row_idx,
                column_name='value',
                details={'sig_figs': measurement.significant_figures}
            )

        unc_sig_figs = self._count_significant_figures(measurement.uncertainty)
        if unc_sig_figs > UNCERTAINTY_SIG_FIGS and measurement.uncertainty > 0:
            return Issue(
                issue_type=IssueType.SIGNIFICANT_FIGURES,
                severity=Severity.INFO,
                message=f"测量值 '{measurement.name}' 的不确定度有效数字过多（建议保留{UNCERTAINTY_SIG_FIGS}位）",
                row_index=row_idx,
                column_name='uncertainty',
                details={
                    'current': unc_sig_figs,
                    'suggested': UNCERTAINTY_SIG_FIGS
                }
            )

        return None

    def _count_significant_figures(self, value: float) -> int:
        """计算有效数字位数"""
        if value == 0:
            return 1
        abs_val = abs(value)
        if abs_val >= 1e-15 and abs_val < 1e15:
            s = f"{abs_val:.15f}".rstrip('0')
            if '.' in s:
                mantissa = s.replace('.', '').lstrip('0')
                return len(mantissa) if mantissa else 1
            else:
                mantissa = s.rstrip('0')
                return len(mantissa) if mantissa else 1
        else:
            s = f"{abs_val:.15e}"
            mantissa = s.split('e')[0].replace('.', '').lstrip('0')
            return len(mantissa) if mantissa else 1

    def _count_decimal_places(self, value: float) -> int:
        """计算小数点后的位数"""
        if value == 0:
            return 0
        s = f"{abs(value):.15f}".rstrip('0')
        if '.' in s:
            return len(s.split('.')[1])
        return 0

    def check_correlation(
        self,
        measurements: Dict[str, Measurement],
        correlation_threshold: float = 0.7
    ) -> List[Issue]:
        """检查变量间的相关性"""
        issues: List[Issue] = []
        names = list(measurements.keys())

        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                name1, name2 = names[i], names[j]
                m1, m2 = measurements[name1], measurements[name2]

                if m1.unit == m2.unit and abs(m1.value - m2.value) < 1e-10:
                    issues.append(Issue(
                        issue_type=IssueType.CORRELATED_VARIABLES,
                        severity=Severity.WARNING,
                        message=f"变量 '{name1}' 和 '{name2}' 值完全相同，可能是相关变量或重复测量",
                        details={
                            'variables': [name1, name2],
                            'value': m1.value,
                            'unit': m1.unit
                        }
                    ))

                if self._are_names_related(name1, name2):
                    issues.append(Issue(
                        issue_type=IssueType.CORRELATED_VARIABLES,
                        severity=Severity.INFO,
                        message=f"变量 '{name1}' 和 '{name2}' 名称相似，可能存在相关性",
                        details={
                            'variables': [name1, name2],
                            'suggestion': '请确认是否需要考虑协方差项'
                        }
                    ))

        return issues

    def _are_names_related(self, name1: str, name2: str) -> bool:
        """检查两个变量名是否相关"""
        n1, n2 = name1.lower(), name2.lower()

        common_prefixes = ['δ', 'delta', 'd_', 'u_', 'σ', 'Δ', 'Delta']
        for prefix in common_prefixes:
            prefix_lower = prefix.lower()
            if n1.startswith(prefix_lower) and n2 == n1[len(prefix_lower):]:
                return True
            if n2.startswith(prefix_lower) and n1 == n2[len(prefix_lower):]:
                return True

        if name1.startswith('Δ') and name2 == name1[1:]:
            return True
        if name2.startswith('Δ') and name1 == name2[1:]:
            return True

        from difflib import SequenceMatcher
        return SequenceMatcher(None, n1, n2).ratio() > 0.8

    def round_result(self, result: PropagationResult) -> PropagationResult:
        """根据有效数字规则舍入结果"""
        uncertainty = result.target_uncertainty
        value = result.target_value

        if uncertainty > 0:
            unc_order = int(np.floor(np.log10(abs(uncertainty))))
            unc_rounded = round(uncertainty, -unc_order)
            val_rounded = round(value, -unc_order)

            result.target_uncertainty = unc_rounded
            result.target_value = val_rounded

        return result

    def format_result(self, result: PropagationResult) -> str:
        """格式化结果输出"""
        val = result.target_value
        unc = result.target_uncertainty
        unit = result.target_unit

        if unc > 0:
            unc_order = int(np.floor(np.log10(abs(unc))))
            decimal_places = max(0, -unc_order)
            return f"{val:.{decimal_places}f} ± {unc:.{decimal_places}f} {unit}"
        else:
            return f"{val} ± {unc} {unit}"
