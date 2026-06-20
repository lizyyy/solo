"""units.py — 单位换算与量纲代数。

核心思想：把"值"与"不确定度"作为一对一起换算到 SI 基本单位，
从而避免"公式写对了，但单位一换结果就偏"的问题。
同时用量纲代数校验公式结果量纲与 result_unit 是否一致，
不一致时由调用方记录为可追溯异常。
"""

import sympy as sp

BASE_DIMS = ["kg", "m", "s", "A", "K"]


class UnitError(Exception):
    pass


# 每个单位 -> {factor: 换算到 SI 的倍数, dim: 量纲字典}
# 量纲用 SI 基本量纲表示: kg, m, s, A, K
UNIT_DEFS = {
    # 电压
    "V": {"factor": 1.0, "dim": {"kg": 1, "m": 2, "s": -3, "A": -1}},
    "mV": {"factor": 1e-3, "dim": {"kg": 1, "m": 2, "s": -3, "A": -1}},
    "kV": {"factor": 1e3, "dim": {"kg": 1, "m": 2, "s": -3, "A": -1}},
    "uV": {"factor": 1e-6, "dim": {"kg": 1, "m": 2, "s": -3, "A": -1}},
    # 电流
    "A": {"factor": 1.0, "dim": {"A": 1}},
    "mA": {"factor": 1e-3, "dim": {"A": 1}},
    "uA": {"factor": 1e-6, "dim": {"A": 1}},
    # 电阻
    "Ω": {"factor": 1.0, "dim": {"kg": 1, "m": 2, "s": -3, "A": -2}},
    "ohm": {"factor": 1.0, "dim": {"kg": 1, "m": 2, "s": -3, "A": -2}},
    "kΩ": {"factor": 1e3, "dim": {"kg": 1, "m": 2, "s": -3, "A": -2}},
    "MΩ": {"factor": 1e6, "dim": {"kg": 1, "m": 2, "s": -3, "A": -2}},
    # 长度
    "m": {"factor": 1.0, "dim": {"m": 1}},
    "cm": {"factor": 1e-2, "dim": {"m": 1}},
    "mm": {"factor": 1e-3, "dim": {"m": 1}},
    "um": {"factor": 1e-6, "dim": {"m": 1}},
    "km": {"factor": 1e3, "dim": {"m": 1}},
    # 时间
    "s": {"factor": 1.0, "dim": {"s": 1}},
    "ms": {"factor": 1e-3, "dim": {"s": 1}},
    "us": {"factor": 1e-6, "dim": {"s": 1}},
    "min": {"factor": 60.0, "dim": {"s": 1}},
    "h": {"factor": 3600.0, "dim": {"s": 1}},
    # 质量
    "kg": {"factor": 1.0, "dim": {"kg": 1}},
    "g": {"factor": 1e-3, "dim": {"kg": 1}},
    "mg": {"factor": 1e-6, "dim": {"kg": 1}},
    # 频率
    "Hz": {"factor": 1.0, "dim": {"s": -1}},
    "kHz": {"factor": 1e3, "dim": {"s": -1}},
    "MHz": {"factor": 1e6, "dim": {"s": -1}},
    # 力
    "N": {"factor": 1.0, "dim": {"kg": 1, "m": 1, "s": -2}},
    "kN": {"factor": 1e3, "dim": {"kg": 1, "m": 1, "s": -2}},
    # 能量
    "J": {"factor": 1.0, "dim": {"kg": 1, "m": 2, "s": -2}},
    "kJ": {"factor": 1e3, "dim": {"kg": 1, "m": 2, "s": -2}},
    # 功率
    "W": {"factor": 1.0, "dim": {"kg": 1, "m": 2, "s": -3}},
    "mW": {"factor": 1e-3, "dim": {"kg": 1, "m": 2, "s": -3}},
    "kW": {"factor": 1e3, "dim": {"kg": 1, "m": 2, "s": -3}},
    # 压强
    "Pa": {"factor": 1.0, "dim": {"kg": 1, "m": -1, "s": -2}},
    "kPa": {"factor": 1e3, "dim": {"kg": 1, "m": -1, "s": -2}},
    "MPa": {"factor": 1e6, "dim": {"kg": 1, "m": -1, "s": -2}},
    # 温度（仅绝对温标，避免偏移换算）
    "K": {"factor": 1.0, "dim": {"K": 1}},
    # 无量纲
    "": {"factor": 1.0, "dim": {}},
    "1": {"factor": 1.0, "dim": {}},
    "%": {"factor": 1e-2, "dim": {}},
}

# 量纲签名 -> 友好名称，用于报告展示
# 注意：键须与 dim_key() 的排序（按字母序 A<K<kg<m<s）一致
DIM_NAMES = {
    "": "无量纲",
    "m1": "长度 (m)",
    "m2": "面积 (m^2)",
    "m3": "体积 (m^3)",
    "s1": "时间 (s)",
    "kg1": "质量 (kg)",
    "A1": "电流 (A)",
    "K1": "温度 (K)",
    "s-1": "频率 (Hz)",
    "m1,s-1": "速度 (m/s)",
    "m1,s-2": "加速度 (m/s^2)",
    "kg1,m1,s-2": "力 (N)",
    "kg1,m2,s-2": "能量 (J)",
    "kg1,m2,s-3": "功率 (W)",
    "A-1,kg1,m2,s-3": "电压 (V)",
    "A-2,kg1,m2,s-3": "电阻 (Ω)",
    "kg1,m-1,s-2": "压强 (Pa)",
}


def _split_exp(token):
    if "^" in token:
        base, exp = token.split("^", 1)
        try:
            exp = float(exp.strip())
        except ValueError:
            raise UnitError("无法解析指数: %s" % token)
        return base.strip(), exp
    return token.strip(), 1.0


def parse_unit(unit_str):
    """解析（可复合的）单位串，返回 (换算到 SI 的倍数, 量纲字典)。

    支持形如 "m/s", "m/s^2", "m^3", "kg*m/s^2", "mV" 的写法。
    """
    unit_str = (unit_str or "").strip()
    if unit_str in ("", "1", "-"):
        return 1.0, {}
    factor = 1.0
    dim = {}
    segments = unit_str.split("/")
    for idx, seg in enumerate(segments):
        seg = seg.strip()
        if seg == "":
            continue
        sign = 1 if idx == 0 else -1
        for token in seg.split("*"):
            token = token.strip()
            if token == "":
                continue
            base, exp = _split_exp(token)
            if base not in UNIT_DEFS:
                raise UnitError("未知单位: %s（在 %s 中）" % (base, unit_str))
            f = UNIT_DEFS[base]["factor"]
            d = UNIT_DEFS[base]["dim"]
            factor *= f ** exp
            for k, v in d.items():
                dim[k] = dim.get(k, 0.0) + sign * v * exp
    dim = {k: v for k, v in dim.items() if abs(v) > 1e-12}
    return factor, dim


def to_si(value, uncertainty, unit_str):
    """把 (值, 不确定度) 一起换算到 SI 基本单位，返回 (值_si, 不确定度_si)。"""
    factor, _ = parse_unit(unit_str)
    return value * factor, uncertainty * factor


def from_si(value_si, uncertainty_si, unit_str):
    """把 SI 基本单位的 (值, 不确定度) 换算回指定单位。"""
    factor, _ = parse_unit(unit_str)
    return value_si / factor, uncertainty_si / factor


def dim_key(dim):
    """把量纲字典规范成可比较/可查找的字符串键。"""
    items = sorted((k, v) for k, v in dim.items() if abs(v) > 1e-12)
    return ",".join("%s%s" % (k, _fmt_exp(v)) for k, v in items)


def _fmt_exp(v):
    if float(v).is_integer():
        return str(int(v))
    return ("%g" % v)


def dim_name(dim):
    """量纲字典 -> 友好名称；未登记时返回 SI 组合形式。"""
    key = dim_key(dim)
    if key in DIM_NAMES:
        return DIM_NAMES[key]
    if key == "":
        return "无量纲"
    return "量纲[%s]" % key


def dim_equal(d1, d2):
    return dim_key(d1) == dim_key(d2)


def expr_dimension(expr, var_dims):
    """沿 sympy 表达式树计算结果量纲。

    var_dims: {变量名(str): 量纲字典}
    返回量纲字典，或 None（无法确定，如非常数指数）。
    """
    expr = sp.sympify(expr)
    # 常数：无量纲
    if expr.is_Number or expr in (sp.pi, sp.E):
        return {}
    if expr.is_Symbol:
        return dict(var_dims.get(str(expr), {}))
    if expr.is_Pow:
        base_dim = expr_dimension(expr.base, var_dims)
        if base_dim is None:
            return None
        e = expr.exp
        if e.is_Number:
            return {k: v * float(e) for k, v in base_dim.items()}
        return None
    if expr.is_Mul:
        result = {}
        for arg in expr.args:
            d = expr_dimension(arg, var_dims)
            if d is None:
                return None
            for k, v in d.items():
                result[k] = result.get(k, 0.0) + v
        return {k: v for k, v in result.items() if abs(v) > 1e-12}
    if expr.is_Add:
        dims = [expr_dimension(a, var_dims) for a in expr.args]
        if any(d is None for d in dims):
            return None
        return dims[0]
    if expr.func is sp.sqrt:
        d = expr_dimension(expr.args[0], var_dims)
        if d is None:
            return None
        return {k: v / 2.0 for k, v in d.items()}
    # 其它函数（sin/cos/exp/log 等）默认结果无量纲
    return {}
