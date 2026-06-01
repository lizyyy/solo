from ..models.bond import CalculationResult, ProcessStatus
from ..models.params import CalculationParams


class BoundaryJudge:
    def __init__(self, params: CalculationParams):
        self.params = params
        self.low = params.boundary_premium_rate_low
        self.high = params.boundary_premium_rate_high

    def judge(self, result: CalculationResult) -> CalculationResult:
        if result.status != ProcessStatus.SUCCESS:
            result.boundary_decision = "无法判断"
            result.boundary_explanation = f"因计算失败({result.error_reason})，无法进行边界判断"
            return result

        premium_rate = result.conversion_premium_rate

        if premium_rate < self.low - 0.0001:
            result.boundary_decision = "边界内 - 建议转股"
            result.boundary_explanation = (
                f"转股溢价率({premium_rate:.4f}%) < 下边界({self.low}%)，"
                f"{self.params.premium_rate_interpretation['negative']}"
            )
        elif abs(premium_rate - self.low) <= 0.0001:
            result.boundary_decision = "临界点 - 正好触达下边界"
            result.boundary_explanation = (
                f"转股溢价率({premium_rate:.4f}%) = 下边界({self.low}%)，"
                f"处于转股与否的临界点，{self.params.premium_rate_interpretation['near_boundary']}"
            )
        elif premium_rate < self.high - 0.0001:
            result.boundary_decision = "边界内 - 关注转股机会"
            result.boundary_explanation = (
                f"下边界({self.low}%) ≤ 转股溢价率({premium_rate:.4f}%) < 上边界({self.high}%)，"
                f"{self.params.premium_rate_interpretation['within_boundary']}"
            )
        elif abs(premium_rate - self.high) <= 0.0001:
            result.boundary_decision = "临界点 - 正好触达上边界"
            result.boundary_explanation = (
                f"转股溢价率({premium_rate:.4f}%) = 上边界({self.high}%)，"
                f"{self.params.premium_rate_interpretation['near_boundary']}"
            )
        else:
            result.boundary_decision = "边界外 - 不建议转股"
            result.boundary_explanation = (
                f"转股溢价率({premium_rate:.4f}%) > 上边界({self.high}%)，"
                f"{self.params.premium_rate_interpretation['above_boundary']}"
            )

        result.formulas["boundary_judge"] = (
            f"边界判断规则: 溢价率<{self.low}%→转股划算; "
            f"{self.low}%≤溢价率<{self.high}%→关注; "
            f"溢价率≥{self.high}%→不划算"
        )

        return result
