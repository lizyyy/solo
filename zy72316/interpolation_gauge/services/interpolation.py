from interpolation_gauge.models.schemas import BoundaryJudgment


FLOAT_EPSILON = 1e-9


def judge_boundary(value: float, threshold: float) -> BoundaryJudgment:
    """
    边界值判定规则（代码级文档，同步写于 README）：

    1. value < threshold  → BELOW_THRESHOLD   （正常，低于阈值）
    2. value > threshold  → ABOVE_THRESHOLD   （正常，高于阈值）
    3. |value - threshold| ≤ FLOAT_EPSILON → EQUAL_THRESHOLD（边界值等于阈值）
       - **关键规则**：等于阈值时不得自动归为 ABOVE 或 BELOW，
         必须标记为 EQUAL_THRESHOLD 并留待任课老师复核。
    """
    diff = value - threshold
    if abs(diff) <= FLOAT_EPSILON:
        return BoundaryJudgment.EQUAL_THRESHOLD
    elif diff < 0:
        return BoundaryJudgment.BELOW_THRESHOLD
    else:
        return BoundaryJudgment.ABOVE_THRESHOLD


def linear_interpolate(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    if abs(x1 - x0) < FLOAT_EPSILON:
        return y0
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def piecewise_linear_interpolate(value: float, breakpoints: list) -> float:
    """
    分段线性插值。
    breakpoints: [(x0, y0), (x1, y1), ...] 按 x 升序排列。
    """
    if not breakpoints:
        return 0.0
    if len(breakpoints) == 1:
        return breakpoints[0][1]
    if value <= breakpoints[0][0]:
        return breakpoints[0][1]
    if value >= breakpoints[-1][0]:
        return breakpoints[-1][1]
    for i in range(len(breakpoints) - 1):
        x0, y0 = breakpoints[i]
        x1, y1 = breakpoints[i + 1]
        if x0 <= value <= x1:
            return linear_interpolate(value, x0, x1, y0, y1)
    return breakpoints[-1][1]
