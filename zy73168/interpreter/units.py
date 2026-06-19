"""单位处理：缺失检测、歧义检测、换算与换算过程留痕。

需求对应：
- “单位缺失时宁可挂起让项目经理确认” —— 这里只判定缺失/歧义，是否挂起由 status 决定。
- “单位换算别藏起来” —— apply_y_conversion 返回换算因子、公式与换算后系数，全部写进中间计算。
"""

from typing import Any, Dict, List, Optional, Tuple

from .models import FitResult

# 同量纲分组：值为“1 个该单位 = 多少基准单位”，用基准单位桥接换算。
_GROUPS: List[Dict[str, float]] = [
    {"mm": 0.001, "cm": 0.01, "m": 1.0, "km": 1000.0},
    {"Ω": 1.0, "kΩ": 1000.0, "MΩ": 1_000_000.0},
    {"ms": 0.001, "s": 1.0, "min": 60.0, "h": 3600.0},
]

def is_missing(unit: Optional[str]) -> bool:
    return not unit or not str(unit).strip() or str(unit).strip() in {"(缺失)", "缺失", "null", "None"}


def is_ambiguous(unit: Optional[str]) -> bool:
    """判定单位是否有歧义。

    规则：
    - 含“或 / ，”等分隔且两侧为【同量纲】单位 → 歧义（如 cm/mm，不知取哪个）。
    - 含“/”但两侧不同量纲 → 合法复合单位（如 mol/L、m/s），不算歧义。
    """
    if is_missing(unit):
        return False
    u = str(unit).strip()
    if "或" in u:
        return True
    if "，" in u or "," in u:
        return True
    if "/" in u:
        left, _, right = u.partition("/")
        gl = _find_group(left.strip())
        gr = _find_group(right.strip())
        if gl is not None and gr is not None and gl is gr:
            return True
    return False


def _find_group(unit: str) -> Optional[Dict[str, float]]:
    for g in _GROUPS:
        if unit in g:
            return g
    return None


def conversion_factor(from_unit: str, to_unit: str) -> Optional[Tuple[float, str]]:
    """返回 (因子, 说明)。因子满足 value_in_to = 因子 × value_in_from。不可换算返回 None。"""
    if is_missing(from_unit) or is_missing(to_unit):
        return None
    f, t = from_unit.strip(), to_unit.strip()
    if f == t:
        return 1.0, "单位相同，无需换算"
    gf = _find_group(f)
    gt = _find_group(t)
    if gf is None or gt is None or gf is not gt:
        return None
    factor = gf[f] / gt[t]
    return factor, f"1 {f} = {factor:g} {t}，故 y({t}) = {factor:g} × y({f})"


def apply_y_conversion(fit: FitResult, from_unit: str, to_unit: str) -> Optional[Dict[str, Any]]:
    """把一条拟合结果的 y 轴系数从 from_unit 换算到 to_unit，留痕中间过程。"""
    conv = conversion_factor(from_unit, to_unit)
    if conv is None:
        return None
    factor, formula = conv
    steps: List[str] = [f"换算目标：y 由「{from_unit}」→「{to_unit}」", f"  · {formula}"]
    converted: Dict[str, float] = {}
    for name in fit.coefficient_order:
        val = fit.coefficients[name]
        if fit.model == "exponential" and name == "b":
            converted[name] = val
            steps.append(f"  · {name}：指数项系数不受 y 量纲影响，保持 {val:.6g}")
        else:
            new_val = val * factor
            converted[name] = new_val
            steps.append(f"  · {name}：{val:.6g} × {factor:g} = {new_val:.6g}")
    r2 = fit.r_squared if fit.r_squared is not None else 0.0
    return {
        "from_unit": from_unit,
        "to_unit": to_unit,
        "factor": factor,
        "formula": formula,
        "converted_coefficients": converted,
        "r_squared": r2,
        "steps": steps,
    }


def verbal_unit_hints(notes: List[Any]) -> List[str]:
    """从口头备注里抽取疑似单位提示（仅供 PM 参考，不作为确认）。"""
    hints: List[str] = []
    for n in notes:
        text = getattr(n, "note", "") or ""
        for g in _GROUPS:
            for u in g:
                if u in text:
                    hints.append(f"{getattr(n,'source_meta',{}).get('received','')} 口头提及「{u}」：{text}")
                    break
    return hints
