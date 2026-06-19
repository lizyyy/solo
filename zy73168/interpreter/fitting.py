"""纯 Python 最小二乘曲线拟合（标准库，零依赖）。

支持模型：linear / quadratic / exponential。
关键：把“中间计算过程”留痕——法方程矩阵、常数向量、高斯消元步骤、SS_res/SS_tot 全部记进
FitResult，满足“中间计算过程和单位换算别藏起来”。

数学说明：
- 多项式 y = c0 + c1*x + c2*x^2 + ... 用正规方程 (X^T X) c = X^T y 求解，X^T X 即下方 normal_matrix。
- 指数 y = a*exp(b*x) 先取 z=ln(y) 线性化得 z = A + b*x（A=ln a），再 a=exp(A)。
- R² 统一在原 y 量纲上算：R² = 1 - SS_res/SS_tot，SS_tot 以实际 y 均值为基准。
"""

import math
from typing import List, Tuple

from .models import FitResult

LINEAR = "linear"
QUADRATIC = "quadratic"
EXPONENTIAL = "exponential"
SUPPORTED = {LINEAR, QUADRATIC, EXPONENTIAL}


def _solve_linear_system(matrix: List[List[float]], vector: List[float]) -> Tuple[List[float], List[str]]:
    """高斯消元 + 部分主元选取，返回 (解, 步骤说明)。"""
    n = len(matrix)
    aug = [list(matrix[i]) + [vector[i]] for i in range(n)]
    steps: List[str] = []
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < 1e-12:
            raise ValueError("法方程矩阵奇异（列近似为 0），无法唯一求解")
        if pivot != col:
            aug[col], aug[pivot] = aug[pivot], aug[col]
            steps.append(f"  · 选主元：第 {col + 1} 列，交换第 {col + 1} 行 ↔ 第 {pivot + 1} 行")
        for r in range(col + 1, n):
            factor = aug[r][col] / aug[col][col]
            if factor == 0:
                continue
            for c in range(col, n + 1):
                aug[r][c] -= factor * aug[col][c]
            steps.append(f"  · 消元：第 {r + 1} 行 -= {factor:.6g} × 第 {col + 1} 行")
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        s = aug[i][n]
        for j in range(i + 1, n):
            s -= aug[i][j] * x[j]
        x[i] = s / aug[i][i]
        steps.append(f"  · 回代：c{i} = {x[i]:.6g}")
    return x, steps


def _r_squared(actual: List[float], predicted: List[float]) -> Tuple[float, float, float]:
    n = len(actual)
    mean_y = sum(actual) / n if n else 0.0
    ss_tot = sum((y - mean_y) ** 2 for y in actual)
    ss_res = sum((a - p) ** 2 for a, p in zip(actual, predicted))
    if ss_tot == 0:
        return 0.0, ss_res, ss_tot
    return 1.0 - ss_res / ss_tot, ss_res, ss_tot


def _fit_polynomial(points: List[List[float]], degree: int) -> Tuple[List[float], List[List[float]], List[float], List[str], str]:
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    n = len(xs)
    if n < degree + 1:
        raise ValueError(f"{degree} 次多项式至少需要 {degree + 1} 个点，实际 {n} 个")
    m = degree + 1
    power = [0.0] * (2 * degree + 1)
    for k in range(2 * degree + 1):
        power[k] = sum(x ** k for x in xs)
    matrix = [[power[i + j] for j in range(m)] for i in range(m)]
    vec = [sum((x ** i) * y for x, y in zip(xs, ys)) for i in range(m)]
    coeffs, steps = _solve_linear_system(matrix, vec)
    formula = " + ".join(f"c{i}·x^{i}" for i in range(m)).replace("x^0", "").replace("·x^1", "·x")
    return coeffs, matrix, vec, steps, formula


def fit_linear(points: List[List[float]]) -> FitResult:
    coeffs, matrix, vec, steps, _ = _fit_polynomial(points, 1)
    intercept, slope = coeffs[0], coeffs[1]
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    predicted = [intercept + slope * x for x in xs]
    r2, ss_res, ss_tot = _r_squared(ys, predicted)
    steps = [f"模型：y = intercept + slope·x"] + steps + [
        f"  · 解得 intercept(截距) = {intercept:.6g}",
        f"  · 解得 slope(斜率) = {slope:.6g}",
        f"  · SS_res = {ss_res:.6g}，SS_tot = {ss_tot:.6g}，R² = {r2:.6g}",
    ]
    return FitResult(
        model=LINEAR,
        success=True,
        coefficients={"intercept": intercept, "slope": slope},
        coefficient_order=["intercept", "slope"],
        r_squared=r2,
        ss_res=ss_res,
        ss_tot=ss_tot,
        normal_matrix=matrix,
        normal_vector=vec,
        solve_steps=steps,
        predictions=predicted,
    )


def fit_quadratic(points: List[List[float]]) -> FitResult:
    coeffs, matrix, vec, steps, _ = _fit_polynomial(points, 2)
    c0, c1, c2 = coeffs
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    predicted = [c0 + c1 * x + c2 * x * x for x in xs]
    r2, ss_res, ss_tot = _r_squared(ys, predicted)
    steps = ["模型：y = c0 + c1·x + c2·x²"] + steps + [
        f"  · 解得 c0 = {c0:.6g}",
        f"  · 解得 c1 = {c1:.6g}",
        f"  · 解得 c2 = {c2:.6g}",
        f"  · SS_res = {ss_res:.6g}，SS_tot = {ss_tot:.6g}，R² = {r2:.6g}",
    ]
    return FitResult(
        model=QUADRATIC,
        success=True,
        coefficients={"c0": c0, "c1": c1, "c2": c2},
        coefficient_order=["c0", "c1", "c2"],
        r_squared=r2,
        ss_res=ss_res,
        ss_tot=ss_tot,
        normal_matrix=matrix,
        normal_vector=vec,
        solve_steps=steps,
        predictions=predicted,
    )


def fit_exponential(points: List[List[float]]) -> FitResult:
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    if any(y <= 0 for y in ys):
        return FitResult(
            model=EXPONENTIAL,
            success=False,
            error="指数拟合要求所有 y > 0（需取对数线性化），当前数据含非正值",
        )
    if len(xs) < 2:
        return FitResult(model=EXPONENTIAL, success=False, error="指数拟合至少需要 2 个点")
    z = [math.log(y) for y in ys]
    zpts = [[x, zi] for x, zi in zip(xs, z)]
    coeffs, matrix, vec, steps, _ = _fit_polynomial(zpts, 1)
    A, b = coeffs[0], coeffs[1]
    a = math.exp(A)
    predicted = [a * math.exp(b * x) for x in xs]
    r2, ss_res, ss_tot = _r_squared(ys, predicted)
    steps = [
        "模型：y = a·exp(b·x)",
        "线性化：z = ln(y) = ln(a) + b·x，对 (x, ln y) 做线性最小二乘",
    ] + steps + [
        f"  · ln(a) = A = {A:.6g}，故 a = exp(A) = {a:.6g}",
        f"  · b = {b:.6g}",
        f"  · SS_res = {ss_res:.6g}（原 y 量纲），SS_tot = {ss_tot:.6g}，R² = {r2:.6g}",
    ]
    return FitResult(
        model=EXPONENTIAL,
        success=True,
        coefficients={"a": a, "b": b},
        coefficient_order=["a", "b"],
        r_squared=r2,
        ss_res=ss_res,
        ss_tot=ss_tot,
        normal_matrix=matrix,
        normal_vector=vec,
        solve_steps=steps,
        predictions=predicted,
    )


def fit_record(model: str, points: List[List[float]]) -> FitResult:
    """按 model 字段派发拟合；未知/空模型返回失败结果，供状态裁定判定为 STUCK_FORMULA。"""
    model = (model or "").strip().lower()
    if model == LINEAR:
        return fit_linear(points)
    if model == QUADRATIC:
        return fit_quadratic(points)
    if model == EXPONENTIAL:
        return fit_exponential(points)
    return FitResult(model=model, success=False, error=f"未知或缺失模型「{model or '(空)'}」，无法确定拟合公式")
