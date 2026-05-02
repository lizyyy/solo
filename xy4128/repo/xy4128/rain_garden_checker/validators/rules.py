from typing import List, Optional, Dict, Any
from datetime import datetime

from rain_garden_checker.models.data_models import (
    ValidationWarning,
    WarningLevel,
    WarningType,
    CheckReport,
    SimulationResult,
    PondGeometry,
    CatchmentArea,
    SoilInfiltrationTest,
    RainfallSeries,
    SimulationConfig,
    UnitConversion,
    LengthUnit,
    TimeUnit,
    AreaUnit,
)


class RuleValidator:
    def __init__(self):
        self.warnings: List[ValidationWarning] = []

    def _add_warning(
        self,
        level: WarningLevel,
        warning_type: WarningType,
        message: str,
        field: Optional[str] = None,
        value: Optional[Any] = None,
        suggestion: Optional[str] = None,
    ):
        self.warnings.append(
            ValidationWarning(
                level=level,
                warning_type=warning_type,
                message=message,
                field=field,
                value=value,
                suggestion=suggestion,
            )
        )

    def check_capacity_insufficient(
        self, result: SimulationResult, pond: PondGeometry
    ) -> bool:
        if result.has_overflow and result.total_overflow_volume > 0:
            overflow_pct = (
                result.total_overflow_volume / result.total_runoff_volume * 100
                if result.total_runoff_volume > 0 else 0
            )

            level = WarningLevel.CRITICAL if overflow_pct > 10 else WarningLevel.WARNING

            self._add_warning(
                level=level,
                warning_type=WarningType.CAPACITY_INSUFFICIENT,
                message=f"池体容量不足，发生溢流。溢流量: {result.total_overflow_volume:.2f} m³ "
                        f"({overflow_pct:.1f}% of 总径流)",
                field="storage_volume",
                value=pond.storage_volume,
                suggestion=f"建议增大池体容量或提高入渗能力。当前容量: {pond.storage_volume:.2f} m³, "
                          f"峰值蓄水量: {result.peak_storage:.2f} m³",
            )
            return True
        return False

    def check_drain_timeout(
        self, result: SimulationResult, config: SimulationConfig
    ) -> bool:
        max_hours = config.max_drain_hours if config.max_drain_hours > 0 else 72.0

        if result.drain_time_hours > max_hours:
            level = (
                WarningLevel.CRITICAL
                if result.drain_time_hours > max_hours * 1.5
                else WarningLevel.WARNING
            )

            self._add_warning(
                level=level,
                warning_type=WarningType.DRAIN_TIMEOUT,
                message=f"排空时间 {result.drain_time_hours:.1f} 小时 超过限值 {max_hours} 小时",
                field="drain_time",
                value=result.drain_time_hours,
                suggestion="建议增大排水层厚度、提高土壤导水率或设置穿孔管排水系统",
            )
            return True

        if result.drain_time_hours > 0:
            self._add_warning(
                level=WarningLevel.INFO,
                warning_type=WarningType.DRAIN_TIMEOUT,
                message=f"预计排空时间: {result.drain_time_hours:.1f} 小时 (限值: {max_hours} 小时)",
                field="drain_time",
                value=result.drain_time_hours,
            )
        return False

    def check_soil_params_unreliable(
        self, soil: SoilInfiltrationTest
    ) -> bool:
        issues_found = False

        Ks = soil.saturated_hydraulic_conductivity
        soil_type_lower = soil.soil_type.lower().replace(" ", "_")

        soil_type_ranges = {
            "sand": (10, 1000),
            "loamy_sand": (5, 50),
            "sandy_loam": (1, 30),
            "loam": (0.5, 10),
            "silt_loam": (0.1, 5),
            "sandy_clay_loam": (0.1, 3),
            "clay_loam": (0.1, 2),
            "silty_clay_loam": (0.05, 1),
            "sandy_clay": (0.01, 0.5),
            "silty_clay": (0.01, 0.3),
            "clay": (0.001, 0.1),
        }

        if soil_type_lower in soil_type_ranges:
            min_ks, max_ks = soil_type_ranges[soil_type_lower]
            if Ks < min_ks * 0.5 or Ks > max_ks * 2:
                self._add_warning(
                    level=WarningLevel.WARNING,
                    warning_type=WarningType.SOIL_PARAMS_UNRELIABLE,
                    message=f"土壤 {soil.soil_type} 的导水率 {Ks} mm/h "
                            f"与典型范围 [{min_ks}, {max_ks}] 差异较大",
                    field="saturated_hydraulic_conductivity",
                    value=Ks,
                    suggestion="建议进行现场双环入渗试验或室内渗透试验核实",
                )
                issues_found = True

        if soil.initial_moisture >= soil.saturated_moisture:
            self._add_warning(
                level=WarningLevel.CRITICAL,
                warning_type=WarningType.SOIL_PARAMS_UNRELIABLE,
                message=f"初始含水量 {soil.initial_moisture} >= 饱和含水量 {soil.saturated_moisture}",
                field="initial_moisture",
                value=soil.initial_moisture,
                suggestion="初始含水量必须小于饱和含水量",
            )
            issues_found = True

        if soil.saturated_moisture < 0.2 or soil.saturated_moisture > 0.6:
            self._add_warning(
                level=WarningLevel.WARNING,
                warning_type=WarningType.SOIL_PARAMS_UNRELIABLE,
                message=f"饱和含水量 {soil.saturated_moisture} 超出典型范围 (0.2-0.6)",
                field="saturated_moisture",
                value=soil.saturated_moisture,
                suggestion="请核实土壤孔隙度数据",
            )
            issues_found = True

        return issues_found

    def check_runoff_coefficient_conflict(
        self, catchments: List[CatchmentArea]
    ) -> bool:
        issues_found = False

        for c in catchments:
            if c.impervious_ratio is not None:
                impervious = c.impervious_ratio
                runoff = c.runoff_coefficient

                expected_min = impervious * 0.6
                expected_max = impervious * 0.95 + (1 - impervious) * 0.3

                if runoff < expected_min or runoff > expected_max:
                    self._add_warning(
                        level=WarningLevel.WARNING,
                        warning_type=WarningType.RUNOFF_COEFFICIENT_CONFLICT,
                        message=f"汇水区 '{c.name}': 径流系数 {runoff} "
                                f"与不透水率 {impervious} 不一致",
                        field="runoff_coefficient",
                        value=runoff,
                        suggestion=f"根据不透水率，预期范围约 [{expected_min:.2f}, {expected_max:.2f}]",
                    )
                    issues_found = True

            if c.runoff_coefficient <= 0 or c.runoff_coefficient > 1:
                self._add_warning(
                    level=WarningLevel.CRITICAL,
                    warning_type=WarningType.RUNOFF_COEFFICIENT_CONFLICT,
                    message=f"汇水区 '{c.name}': 径流系数 {c.runoff_coefficient} 超出有效范围 (0, 1]",
                    field="runoff_coefficient",
                    value=c.runoff_coefficient,
                    suggestion="径流系数必须在 0 到 1 之间",
                )
                issues_found = True

        return issues_found

    def check_return_period_consistency(
        self, rainfall_series: List[RainfallSeries], required_return_period: Optional[float] = None
    ) -> bool:
        issues_found = False

        if not rainfall_series:
            return False

        periods = [rf.return_period for rf in rainfall_series]

        if required_return_period is not None:
            for rf in rainfall_series:
                if abs(rf.return_period - required_return_period) > 0.1:
                    self._add_warning(
                        level=WarningLevel.WARNING,
                        warning_type=WarningType.UNIT_MISMATCH,
                        message=f"降雨 '{rf.name}' 的重现期 {rf.return_period} 年 "
                                f"与要求的 {required_return_period} 年不一致",
                        field="return_period",
                        value=rf.return_period,
                        suggestion="请确认设计暴雨重现期是否正确",
                    )
                    issues_found = True

        if len(periods) > 1:
            unique_periods = sorted(list(set(periods)))
            if len(unique_periods) > 1:
                self._add_warning(
                    level=WarningLevel.INFO,
                    warning_type=WarningType.UNIT_MISMATCH,
                    message=f"检测到多个重现期: {unique_periods} 年",
                    field="return_period",
                    value=unique_periods,
                    suggestion="使用 compare 命令对比不同重现期的结果",
                )

        return issues_found

    def check_overflow_risk_from_results(
        self, results: List[SimulationResult]
    ) -> Dict[int, bool]:
        risk_map = {}
        for i, result in enumerate(results):
            if result.has_overflow:
                self._add_warning(
                    level=WarningLevel.CRITICAL,
                    warning_type=WarningType.OVERFLOW_RISK,
                    message=f"降雨 '{result.rainfall_name}' ({result.return_period}年一遇) "
                            f"发生溢流 {result.total_overflow_volume:.2f} m³",
                    field="overflow",
                    value=result.total_overflow_volume,
                    suggestion="增大池体容量、提高入渗率或增加预处理设施",
                )
                risk_map[i] = True
            else:
                risk_map[i] = False

        return risk_map

    def validate_all(
        self,
        results: List[SimulationResult],
        pond: Optional[PondGeometry] = None,
        soil: Optional[SoilInfiltrationTest] = None,
        catchments: Optional[List[CatchmentArea]] = None,
        rainfall_series: Optional[List[RainfallSeries]] = None,
        config: Optional[SimulationConfig] = None,
    ) -> CheckReport:
        self.warnings.clear()
        active_config = config or SimulationConfig()

        if soil:
            self.check_soil_params_unreliable(soil)

        if catchments:
            self.check_runoff_coefficient_conflict(catchments)

        if rainfall_series:
            self.check_return_period_consistency(rainfall_series)

        for result in results:
            if pond:
                self.check_capacity_insufficient(result, pond)
            self.check_drain_timeout(result, active_config)

        if results:
            self.check_overflow_risk_from_results(results)

        has_critical = any(w.level == WarningLevel.CRITICAL for w in self.warnings)
        has_warnings = any(w.level in (WarningLevel.WARNING, WarningLevel.CRITICAL) for w in self.warnings)

        report = CheckReport(
            project_id="validation_report",
            warnings=self.warnings.copy(),
            has_critical=has_critical,
            has_warnings=has_warnings,
        )

        return report

    def get_summary(self) -> Dict[str, Any]:
        counts = {
            "critical": sum(1 for w in self.warnings if w.level == WarningLevel.CRITICAL),
            "warning": sum(1 for w in self.warnings if w.level == WarningLevel.WARNING),
            "info": sum(1 for w in self.warnings if w.level == WarningLevel.INFO),
        }

        type_counts = {}
        for w in self.warnings:
            wt = w.warning_type.value
            if wt not in type_counts:
                type_counts[wt] = 0
            type_counts[wt] += 1

        return {
            "total_warnings": len(self.warnings),
            "by_level": counts,
            "by_type": type_counts,
            "has_critical": counts["critical"] > 0,
            "passes": counts["critical"] == 0,
        }
