"""公式注册表 - 含旧名别名映射和计算逻辑"""

import math
from dataclasses import dataclass
from typing import Dict, List, Callable

from .models import Variable, CalculationResult


@dataclass
class FormulaDef:
    """公式定义"""
    name: str
    expression: str
    description: str
    required_vars: List[str]
    calc_value: Callable[[Dict[str, float]], float]
    calc_derivatives: Callable[[Dict[str, float]], Dict[str, float]]
    derive_unit: Callable[[Dict[str, Variable]], str]


def _area_value(v):
    return v["a"] * v["b"]

def _area_deriv(v):
    return {"a": v["b"], "b": v["a"]}

def _area_unit(vars_map):
    return f"{vars_map['a'].unit}·{vars_map['b'].unit}"


def _cylinder_value(v):
    return math.pi * v["r"] ** 2 * v["h"]

def _cylinder_deriv(v):
    return {"r": 2 * math.pi * v["r"] * v["h"], "h": math.pi * v["r"] ** 2}

def _cylinder_unit(vars_map):
    return f"{vars_map['r'].unit}³"


def _density_value(v):
    return v["m"] / v["V"]

def _density_deriv(v):
    return {"m": 1 / v["V"], "V": -v["m"] / v["V"] ** 2}

def _density_unit(vars_map):
    return f"{vars_map['m'].unit}/{vars_map['V'].unit}"


def _period_value(v):
    return 2 * math.pi * math.sqrt(v["L"] / v["g"])

def _period_deriv(v):
    ratio = v["L"] / v["g"]
    factor = 2 * math.pi * 0.5 * ratio ** (-0.5)
    return {"L": factor * (1 / v["g"]), "g": factor * (-v["L"] / v["g"] ** 2)}

def _period_unit(vars_map):
    return "s"


def _motion_value(v):
    return v["v0"] * v["t"] + 0.5 * v["a"] * v["t"] ** 2

def _motion_deriv(v):
    return {"v0": v["t"], "a": 0.5 * v["t"] ** 2, "t": v["v0"] + v["a"] * v["t"]}

def _motion_unit(vars_map):
    return "m"


FORMULAS: Dict[str, FormulaDef] = {
    "矩形面积": FormulaDef(
        name="矩形面积",
        expression="S = a × b",
        description="计算矩形面积，a为长，b为宽",
        required_vars=["a", "b"],
        calc_value=_area_value,
        calc_derivatives=_area_deriv,
        derive_unit=_area_unit,
    ),
    "圆柱体体积": FormulaDef(
        name="圆柱体体积",
        expression="V = π × r² × h",
        description="计算圆柱体体积，r为底面半径，h为高",
        required_vars=["r", "h"],
        calc_value=_cylinder_value,
        calc_derivatives=_cylinder_deriv,
        derive_unit=_cylinder_unit,
    ),
    "密度计算": FormulaDef(
        name="密度计算",
        expression="ρ = m / V",
        description="计算物质密度，m为质量，V为体积",
        required_vars=["m", "V"],
        calc_value=_density_value,
        calc_derivatives=_density_deriv,
        derive_unit=_density_unit,
    ),
    "单摆周期": FormulaDef(
        name="单摆周期",
        expression="T = 2π × √(L / g)",
        description="计算单摆周期，L为摆长，g为重力加速度",
        required_vars=["L", "g"],
        calc_value=_period_value,
        calc_derivatives=_period_deriv,
        derive_unit=_period_unit,
    ),
    "匀加速位移": FormulaDef(
        name="匀加速位移",
        expression="s = v₀ × t + 0.5 × a × t²",
        description="计算匀加速直线运动位移，v₀为初速度，a为加速度，t为时间",
        required_vars=["v0", "a", "t"],
        calc_value=_motion_value,
        calc_derivatives=_motion_deriv,
        derive_unit=_motion_unit,
    ),
}

FORMULA_ALIASES: Dict[str, str] = {
    "面积计算": "矩形面积",
    "体积计算": "圆柱体体积",
    "密度": "密度计算",
    "周期计算": "单摆周期",
    "位移计算": "匀加速位移",
}

BOUNDARY_RELATIVE_UNCERTAINTY_THRESHOLD = 0.5


def resolve_formula_name(name: str):
    """解析公式名称，返回 (是否已知, 解析后的名称, 是否使用了旧名)

    Returns:
        (found: bool, resolved_name: str or None, is_alias: bool)
    """
    if name in FORMULAS:
        return True, name, False
    if name in FORMULA_ALIASES:
        return True, FORMULA_ALIASES[name], True
    return False, None, False


def get_formula(name: str) -> FormulaDef:
    resolved = FORMULA_ALIASES.get(name, name)
    return FORMULAS.get(resolved)


def list_formulas() -> List[str]:
    return list(FORMULAS.keys())


def list_aliases() -> Dict[str, str]:
    return dict(FORMULA_ALIASES)
