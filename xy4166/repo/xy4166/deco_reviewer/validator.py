from typing import List, Dict
from datetime import datetime

from .models import (
    DiveLog,
    DiveProfilePoint,
    SafetyStop,
    Violation,
    ViolationType,
    CalculationResult,
)
from .buhlmann import BuhlmannModel


class DiveValidator:
    """潜水规则校验器"""

    MAX_ASCENT_RATE_M_PER_MIN = 9.0
    SAFETY_STOP_MIN_DEPTH = 9.0
    SAFETY_STOP_RECOMMENDED_DURATION = 3
    MIN_REPEAT_DIVE_INTERVAL_MINUTES = 60
    CNS_WARNING_THRESHOLD = 80.0
    CNS_CRITICAL_THRESHOLD = 100.0
    OTU_WARNING_THRESHOLD = 250.0
    OTU_CRITICAL_THRESHOLD = 300.0

    def __init__(self):
        self.violations: List[Violation] = []

    def validate(
        self,
        dive_log: DiveLog,
        calculation_result: CalculationResult,
    ) -> List[Violation]:
        """执行完整的潜水规则校验"""
        self.violations = []

        self._check_ascent_rate(dive_log.profile)
        self._check_ndl_exceeded(dive_log, calculation_result)
        self._check_safety_stops(dive_log)
        self._check_repeat_dive_interval(dive_log)
        self._check_oxygen_toxicity(calculation_result)
        self._check_decompression_needed(calculation_result)

        return self.violations

    def _check_ascent_rate(self, profile: List[DiveProfilePoint]):
        """检查上升速率"""
        for i in range(len(profile) - 1):
            start = profile[i]
            end = profile[i + 1]

            depth_change = start.depth - end.depth
            time_change = end.time - start.time

            if time_change <= 0:
                continue

            if depth_change > 0:
                ascent_rate = depth_change / time_change

                if ascent_rate > self.MAX_ASCENT_RATE_M_PER_MIN:
                    self.violations.append(Violation(
                        violation_type=ViolationType.ASCENT_RATE_TOO_FAST,
                        severity="critical" if ascent_rate > self.MAX_ASCENT_RATE_M_PER_MIN * 1.5 else "warning",
                        message=f"上升速率过快: {ascent_rate:.1f} m/min (限制: {self.MAX_ASCENT_RATE_M_PER_MIN} m/min)",
                        details={
                            "start_time": start.time,
                            "end_time": end.time,
                            "start_depth": start.depth,
                            "end_depth": end.depth,
                            "ascent_rate": ascent_rate,
                            "max_allowed": self.MAX_ASCENT_RATE_M_PER_MIN,
                        },
                        time_point=start.time,
                    ))

    def _check_ndl_exceeded(
        self,
        dive_log: DiveLog,
        calculation_result: CalculationResult,
    ):
        """检查是否超过无减压极限"""
        if calculation_result.max_ndl == 0:
            return

        total_bottom_time = self._calculate_bottom_time(dive_log.profile)
        max_depth = self._get_max_depth(dive_log.profile)

        if max_depth >= self.SAFETY_STOP_MIN_DEPTH and total_bottom_time > calculation_result.max_ndl:
            self.violations.append(Violation(
                violation_type=ViolationType.NDL_EXCEEDED,
                severity="critical",
                message=f"超过无减压极限: 底部时间 {total_bottom_time} 分钟 > NDL {calculation_result.max_ndl} 分钟",
                details={
                    "total_bottom_time": total_bottom_time,
                    "ndl_at_max_depth": calculation_result.max_ndl,
                    "max_depth": max_depth,
                },
                time_point=calculation_result.max_ndl if calculation_result.max_ndl > 0 else None,
            ))

    def _check_safety_stops(self, dive_log: DiveLog):
        """检查安全停留"""
        max_depth = self._get_max_depth(dive_log.profile)

        if max_depth < self.SAFETY_STOP_MIN_DEPTH:
            return

        required_stops = self._get_required_safety_stops(max_depth)

        for required_stop in required_stops:
            found = False
            for recorded_stop in dive_log.safety_stops:
                if abs(recorded_stop.depth - required_stop["depth"]) <= 1.0:
                    found = True
                    if recorded_stop.duration < required_stop["min_duration"]:
                        self.violations.append(Violation(
                            violation_type=ViolationType.SAFETY_STOP_MISSED,
                            severity="warning",
                            message=f"安全停留时间不足: {required_stop['depth']}米停留 {recorded_stop.duration} 分钟 (需要至少 {required_stop['min_duration']} 分钟)",
                            details={
                                "stop_depth": required_stop["depth"],
                                "actual_duration": recorded_stop.duration,
                                "required_duration": required_stop["min_duration"],
                            },
                            time_point=None,
                        ))
                    break

            if not found:
                self.violations.append(Violation(
                    violation_type=ViolationType.SAFETY_STOP_MISSED,
                    severity="critical" if max_depth >= 20 else "warning",
                    message=f"缺少安全停留: 需要在 {required_stop['depth']} 米停留至少 {required_stop['min_duration']} 分钟",
                    details={
                        "stop_depth": required_stop["depth"],
                        "required_duration": required_stop["min_duration"],
                        "max_depth": max_depth,
                    },
                    time_point=None,
                ))

    def _check_repeat_dive_interval(self, dive_log: DiveLog):
        """检查重复潜水间隔"""
        if dive_log.surface_interval_minutes is None:
            return

        if dive_log.surface_interval_minutes < self.MIN_REPEAT_DIVE_INTERVAL_MINUTES:
            self.violations.append(Violation(
                violation_type=ViolationType.REPEAT_DIVE_INTERVAL_TOO_SHORT,
                severity="warning",
                message=f"重复潜水间隔过短: {dive_log.surface_interval_minutes} 分钟 (建议至少 {self.MIN_REPEAT_DIVE_INTERVAL_MINUTES} 分钟)",
                details={
                    "actual_interval": dive_log.surface_interval_minutes,
                    "recommended_interval": self.MIN_REPEAT_DIVE_INTERVAL_MINUTES,
                },
                time_point=None,
            ))

    def _check_oxygen_toxicity(self, calculation_result: CalculationResult):
        """检查氧中毒风险"""
        if calculation_result.cns_percentage >= self.CNS_CRITICAL_THRESHOLD:
            self.violations.append(Violation(
                violation_type=ViolationType.CNS_EXCEEDED,
                severity="critical",
                message=f"CNS氧中毒风险过高: {calculation_result.cns_percentage:.1f}% (限制: {self.CNS_CRITICAL_THRESHOLD}%)",
                details={
                    "cns_percentage": calculation_result.cns_percentage,
                    "critical_threshold": self.CNS_CRITICAL_THRESHOLD,
                    "warning_threshold": self.CNS_WARNING_THRESHOLD,
                },
                time_point=None,
            ))
        elif calculation_result.cns_percentage >= self.CNS_WARNING_THRESHOLD:
            self.violations.append(Violation(
                violation_type=ViolationType.CNS_EXCEEDED,
                severity="warning",
                message=f"CNS氧中毒风险警告: {calculation_result.cns_percentage:.1f}% (警告阈值: {self.CNS_WARNING_THRESHOLD}%)",
                details={
                    "cns_percentage": calculation_result.cns_percentage,
                    "warning_threshold": self.CNS_WARNING_THRESHOLD,
                },
                time_point=None,
            ))

        if calculation_result.otu_value >= self.OTU_CRITICAL_THRESHOLD:
            self.violations.append(Violation(
                violation_type=ViolationType.OTU_EXCEEDED,
                severity="critical",
                message=f"OTU氧毒性过高: {calculation_result.otu_value:.1f} (限制: {self.OTU_CRITICAL_THRESHOLD})",
                details={
                    "otu_value": calculation_result.otu_value,
                    "critical_threshold": self.OTU_CRITICAL_THRESHOLD,
                    "warning_threshold": self.OTU_WARNING_THRESHOLD,
                },
                time_point=None,
            ))
        elif calculation_result.otu_value >= self.OTU_WARNING_THRESHOLD:
            self.violations.append(Violation(
                violation_type=ViolationType.OTU_EXCEEDED,
                severity="warning",
                message=f"OTU氧毒性警告: {calculation_result.otu_value:.1f} (警告阈值: {self.OTU_WARNING_THRESHOLD})",
                details={
                    "otu_value": calculation_result.otu_value,
                    "warning_threshold": self.OTU_WARNING_THRESHOLD,
                },
                time_point=None,
            ))

    def _check_decompression_needed(self, calculation_result: CalculationResult):
        """检查是否需要减压（基于M值比值）"""
        if calculation_result.m_value_ratio >= 1.0:
            self.violations.append(Violation(
                violation_type=ViolationType.NDL_EXCEEDED,
                severity="critical",
                message=f"需要减压停留: 领先隔室(# {calculation_result.leading_compartment}) M值比值 {calculation_result.m_value_ratio:.2f} >= 1.0",
                details={
                    "leading_compartment": calculation_result.leading_compartment,
                    "m_value_ratio": calculation_result.m_value_ratio,
                },
                time_point=None,
            ))

    def _calculate_bottom_time(self, profile: List[DiveProfilePoint]) -> int:
        """计算底部时间"""
        if not profile:
            return 0

        max_depth = max(p.depth for p in profile)
        bottom_threshold = max_depth * 0.8

        bottom_start = None
        bottom_end = None

        for point in profile:
            if point.depth >= bottom_threshold:
                if bottom_start is None:
                    bottom_start = point.time
                bottom_end = point.time

        if bottom_start is not None and bottom_end is not None:
            return bottom_end - bottom_start

        return profile[-1].time - profile[0].time if len(profile) > 1 else 0

    def _get_max_depth(self, profile: List[DiveProfilePoint]) -> float:
        """获取最大深度"""
        if not profile:
            return 0.0
        return max(p.depth for p in profile)

    def _get_required_safety_stops(self, max_depth: float) -> List[Dict]:
        """获取所需的安全停留"""
        stops = []

        if max_depth >= self.SAFETY_STOP_MIN_DEPTH:
            stops.append({
                "depth": 5.0,
                "min_duration": 3,
            })

        if max_depth >= 20:
            stops.append({
                "depth": 3.0,
                "min_duration": 1,
            })

        return stops
