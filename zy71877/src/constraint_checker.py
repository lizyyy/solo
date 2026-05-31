from typing import List
from .models import FittingResult, ConstraintViolation


class ConstraintChecker:
    def __init__(self, energy_constraints: dict, time_constraints: dict):
        self.energy_constraints = energy_constraints
        self.time_constraints = time_constraints

    def check_all(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        violations.extend(self._check_peak_power(result))
        violations.extend(self._check_valley_power(result))
        violations.extend(self._check_peak_valley_ratio(result))
        violations.extend(self._check_fitting_error(result))
        violations.extend(self._check_peak_interval(result))
        violations.extend(self._check_valley_interval(result))
        violations.extend(self._check_peak_valley_distance(result))
        return violations

    def _check_peak_power(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        max_peak = self.energy_constraints.get("max_peak_power", 1000.0)
        
        for peak in result.peaks:
            if peak.power > max_peak:
                violations.append(ConstraintViolation(
                    constraint_name="峰值功率上限",
                    constraint_value=max_peak,
                    actual_value=peak.power,
                    severity="high",
                    explanation=f"在时间点 {peak.timestamp:.2f} 处的峰值功率 {peak.power:.2f} "
                              f"超过上限 {max_peak:.2f}，超出幅度 {(peak.power - max_peak)/max_peak*100:.1f}%"
                ))
        return violations

    def _check_valley_power(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        min_valley = self.energy_constraints.get("min_valley_power", 50.0)
        
        for valley in result.valleys:
            if valley.power < min_valley:
                violations.append(ConstraintViolation(
                    constraint_name="谷值功率下限",
                    constraint_value=min_valley,
                    actual_value=valley.power,
                    severity="medium",
                    explanation=f"在时间点 {valley.timestamp:.2f} 处的谷值功率 {valley.power:.2f} "
                              f"低于下限 {min_valley:.2f}，低于幅度 {(min_valley - valley.power)/min_valley*100:.1f}%"
                ))
        return violations

    def _check_peak_valley_ratio(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        if not result.peaks or not result.valleys:
            return violations

        max_ratio = self.energy_constraints.get("max_peak_valley_ratio", 8.0)
        min_ratio = self.energy_constraints.get("min_peak_valley_ratio", 1.5)

        avg_peak = sum(p.power for p in result.peaks) / len(result.peaks)
        avg_valley = sum(v.power for v in result.valleys) / len(result.valleys)
        
        if avg_valley > 0:
            ratio = avg_peak / avg_valley
            if ratio > max_ratio:
                violations.append(ConstraintViolation(
                    constraint_name="峰谷比上限",
                    constraint_value=max_ratio,
                    actual_value=ratio,
                    severity="high",
                    explanation=f"平均峰谷比 {ratio:.2f} 超过上限 {max_ratio:.2f}。"
                              f"平均峰值 {avg_peak:.2f}，平均谷值 {avg_valley:.2f}"
                ))
            elif ratio < min_ratio:
                violations.append(ConstraintViolation(
                    constraint_name="峰谷比下限",
                    constraint_value=min_ratio,
                    actual_value=ratio,
                    severity="medium",
                    explanation=f"平均峰谷比 {ratio:.2f} 低于下限 {min_ratio:.2f}。"
                              f"平均峰值 {avg_peak:.2f}，平均谷值 {avg_valley:.2f}"
                ))
        return violations

    def _check_fitting_error(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        max_error = self.energy_constraints.get("max_fitting_error", 5.0)
        
        if result.fitting_error > max_error:
            violations.append(ConstraintViolation(
                constraint_name="拟合误差上限",
                constraint_value=max_error,
                actual_value=result.fitting_error,
                severity="high",
                explanation=f"拟合误差 {result.fitting_error:.2f} 超过允许上限 {max_error:.2f}。"
                          f"建议检查原始数据质量或调整平滑参数"
            ))
        return violations

    def _check_peak_interval(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        min_interval = self.time_constraints.get("min_peak_interval", 2)
        
        for i in range(1, len(result.peaks)):
            interval = result.peaks[i].timestamp - result.peaks[i-1].timestamp
            if interval < min_interval:
                violations.append(ConstraintViolation(
                    constraint_name="峰值最小时间间隔",
                    constraint_value=min_interval,
                    actual_value=interval,
                    severity="low",
                    explanation=f"第 {i} 和 {i+1} 个峰值之间的时间间隔 {interval:.2f} "
                              f"小于最小间隔要求 {min_interval}。峰值位置可能过于密集"
                ))
        return violations

    def _check_valley_interval(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        min_interval = self.time_constraints.get("min_valley_interval", 2)
        
        for i in range(1, len(result.valleys)):
            interval = result.valleys[i].timestamp - result.valleys[i-1].timestamp
            if interval < min_interval:
                violations.append(ConstraintViolation(
                    constraint_name="谷值最小时间间隔",
                    constraint_value=min_interval,
                    actual_value=interval,
                    severity="low",
                    explanation=f"第 {i} 和 {i+1} 个谷值之间的时间间隔 {interval:.2f} "
                              f"小于最小间隔要求 {min_interval}。谷值位置可能过于密集"
                ))
        return violations

    def _check_peak_valley_distance(self, result: FittingResult) -> List[ConstraintViolation]:
        violations = []
        min_distance = self.time_constraints.get("peak_valley_min_distance", 1)
        
        all_points = sorted(
            result.peaks + result.valleys,
            key=lambda p: p.timestamp
        )
        
        for i in range(1, len(all_points)):
            distance = all_points[i].timestamp - all_points[i-1].timestamp
            if distance < min_distance:
                prev_type = "峰" if all_points[i-1].point_type == "peak" else "谷"
                curr_type = "峰" if all_points[i].point_type == "peak" else "谷"
                violations.append(ConstraintViolation(
                    constraint_name="峰谷最小距离",
                    constraint_value=min_distance,
                    actual_value=distance,
                    severity="low",
                    explanation=f"{prev_type}值点 ({all_points[i-1].timestamp:.2f}) 与 "
                              f"{curr_type}值点 ({all_points[i].timestamp:.2f}) 之间的距离 "
                              f"{distance:.2f} 小于最小要求 {min_distance}"
                ))
        return violations
