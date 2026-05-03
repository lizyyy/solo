from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from .config import ProjectConfig, CircuitConfig
from .models import (
    LogRecord,
    PlanRecord,
    AnalysisResult,
    Risk,
    RiskType,
    RiskSeverity,
    PowerUnit,
)


class PowerAnalyzer:
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.circuit_configs: Dict[str, CircuitConfig] = {
            c.id: c for c in config.circuits
        }
        self.phase_circuits: Dict[str, List[str]] = defaultdict(list)
        for c in config.circuits:
            self.phase_circuits[c.phase].append(c.id)

    def analyze(
        self,
        log_records: List[LogRecord],
        plan_records: List[PlanRecord],
        time_window_minutes: int = None,
    ) -> AnalysisResult:
        if time_window_minutes is None:
            time_window_minutes = self.config.time_window_minutes

        peak_loads = self._calculate_peak_loads(log_records, time_window_minutes)
        
        sustained_overloads = self._check_sustained_overloads(
            log_records, time_window_minutes
        )
        
        phase_imbalances = self._check_phase_imbalances(
            log_records, time_window_minutes
        )
        
        unplanned_powers = self._check_unplanned_power(
            log_records, plan_records
        )
        
        time_deviations = self._check_time_deviations(
            log_records, plan_records
        )

        result = AnalysisResult(
            id="",
            generated_at=datetime.now(),
            time_window_minutes=time_window_minutes,
            peak_loads=peak_loads,
            sustained_overloads=sustained_overloads,
            phase_imbalances=phase_imbalances,
            unplanned_powers=unplanned_powers,
            time_deviations=time_deviations,
        )

        return result

    def _calculate_peak_loads(
        self, records: List[LogRecord], time_window_minutes: int
    ) -> Dict[str, float]:
        peak_loads: Dict[str, float] = {}
        
        if not records:
            return peak_loads

        sorted_records = sorted(records, key=lambda r: r.timestamp)
        circuit_records: Dict[str, List[LogRecord]] = defaultdict(list)
        
        for r in sorted_records:
            circuit_records[r.circuit_id].append(r)

        for circuit_id, circuit_logs in circuit_records.items():
            if not circuit_logs:
                continue
                
            circuit_config = self.circuit_configs.get(circuit_id)
            if not circuit_config:
                continue

            window_start = circuit_logs[0].timestamp
            window_end = window_start + timedelta(minutes=time_window_minutes)
            current_window_currents: List[float] = []
            max_peak = 0.0

            for record in circuit_logs:
                current_amps = self._to_amperes(record.current, record.unit)
                
                while record.timestamp >= window_end and current_window_currents:
                    window_avg = sum(current_window_currents) / len(current_window_currents)
                    if window_avg > max_peak:
                        max_peak = window_avg
                    
                    window_start = window_end
                    window_end = window_start + timedelta(minutes=time_window_minutes)
                    current_window_currents = [
                        c for c, r in zip(current_window_currents, circuit_logs)
                        if r.timestamp >= window_start
                    ]

                current_window_currents.append(current_amps)

            if current_window_currents:
                window_avg = sum(current_window_currents) / len(current_window_currents)
                if window_avg > max_peak:
                    max_peak = window_avg

            peak_loads[circuit_id] = max_peak

        return peak_loads

    def _check_sustained_overloads(
        self, records: List[LogRecord], time_window_minutes: int
    ) -> List[Risk]:
        risks: List[Risk] = []
        
        if not records:
            return risks

        sorted_records = sorted(records, key=lambda r: r.timestamp)
        circuit_records: Dict[str, List[LogRecord]] = defaultdict(list)
        
        for r in sorted_records:
            circuit_records[r.circuit_id].append(r)

        threshold_pct = self.config.overload_threshold_pct

        for circuit_id, circuit_logs in circuit_records.items():
            if not circuit_logs:
                continue
                
            circuit_config = self.circuit_configs.get(circuit_id)
            if not circuit_config:
                continue

            rated_current = circuit_config.rated_current
            max_current = circuit_config.max_current
            overload_threshold = rated_current * (threshold_pct / 100.0)

            window_start = circuit_logs[0].timestamp
            window_end = window_start + timedelta(minutes=time_window_minutes)
            current_window: List[Tuple[datetime, float]] = []

            for record in circuit_logs:
                current_amps = self._to_amperes(record.current, record.unit)
                record_time = record.timestamp

                while current_window and current_window[0][0] < window_start:
                    current_window.pop(0)

                while record_time >= window_end:
                    if current_window:
                        avg_current = sum(c for _, c in current_window) / len(current_window)
                        if avg_current >= overload_threshold:
                            excess_pct = (avg_current - rated_current) / rated_current * 100
                            
                            if avg_current >= max_current:
                                severity = RiskSeverity.CRITICAL
                                message = (
                                    f"回路 {circuit_id} ({circuit_config.name}) 持续超载: "
                                    f"平均电流 {avg_current:.2f}A, 超过额定 {excess_pct:.1f}%, "
                                    f"已达到最大电流 {max_current}A"
                                )
                            else:
                                severity = RiskSeverity.HIGH
                                message = (
                                    f"回路 {circuit_id} ({circuit_config.name}) 持续超载: "
                                    f"平均电流 {avg_current:.2f}A, 超过额定 {excess_pct:.1f}%"
                                )

                            risk = Risk(
                                id="",
                                risk_type=RiskType.SUSTAINED_OVERLOAD,
                                severity=severity,
                                message=message,
                                timestamp=window_start,
                                circuit_id=circuit_id,
                                details={
                                    "window_start": window_start.isoformat(),
                                    "window_end": window_end.isoformat(),
                                    "average_current": avg_current,
                                    "rated_current": rated_current,
                                    "max_current": max_current,
                                    "threshold_pct": threshold_pct,
                                    "excess_pct": excess_pct,
                                },
                            )
                            risks.append(risk)

                    window_start = window_end
                    window_end = window_start + timedelta(minutes=time_window_minutes)
                    current_window = [
                        (t, c) for t, c in current_window
                        if t >= window_start
                    ]

                current_window.append((record_time, current_amps))

            if current_window:
                avg_current = sum(c for _, c in current_window) / len(current_window)
                if avg_current >= overload_threshold:
                    excess_pct = (avg_current - rated_current) / rated_current * 100
                    
                    if avg_current >= max_current:
                        severity = RiskSeverity.CRITICAL
                        message = (
                            f"回路 {circuit_id} ({circuit_config.name}) 持续超载: "
                            f"平均电流 {avg_current:.2f}A, 超过额定 {excess_pct:.1f}%, "
                            f"已达到最大电流 {max_current}A"
                        )
                    else:
                        severity = RiskSeverity.HIGH
                        message = (
                            f"回路 {circuit_id} ({circuit_config.name}) 持续超载: "
                            f"平均电流 {avg_current:.2f}A, 超过额定 {excess_pct:.1f}%"
                        )

                    risk = Risk(
                        id="",
                        risk_type=RiskType.SUSTAINED_OVERLOAD,
                        severity=severity,
                        message=message,
                        timestamp=window_start,
                        circuit_id=circuit_id,
                        details={
                            "window_start": window_start.isoformat(),
                            "window_end": window_end.isoformat(),
                            "average_current": avg_current,
                            "rated_current": rated_current,
                            "max_current": max_current,
                            "threshold_pct": threshold_pct,
                            "excess_pct": excess_pct,
                        },
                    )
                    risks.append(risk)

        return risks

    def _check_phase_imbalances(
        self, records: List[LogRecord], time_window_minutes: int
    ) -> List[Risk]:
        risks: List[Risk] = []
        
        if not records:
            return risks

        phases = ["A", "B", "C"]
        if not all(p in self.phase_circuits for p in phases):
            return risks

        sorted_records = sorted(records, key=lambda r: r.timestamp)
        threshold_pct = self.config.phase_imbalance_threshold_pct

        if not sorted_records:
            return risks

        window_start = sorted_records[0].timestamp
        window_end = window_start + timedelta(minutes=time_window_minutes)
        
        phase_currents: Dict[str, List[float]] = {
            "A": [], "B": [], "C": []
        }

        for record in sorted_records:
            circuit_config = self.circuit_configs.get(record.circuit_id)
            if not circuit_config:
                continue

            phase = circuit_config.phase
            if phase not in phase_currents:
                continue

            current_amps = self._to_amperes(record.current, record.unit)
            record_time = record.timestamp

            while record_time >= window_end:
                if all(len(phase_currents[p]) > 0 for p in phases):
                    phase_avgs = {
                        p: sum(phase_currents[p]) / len(phase_currents[p])
                        for p in phases
                    }
                    
                    avg_total = sum(phase_avgs.values()) / 3
                    
                    if avg_total > 0:
                        max_deviation_pct = max(
                            abs(phase_avgs[p] - avg_total) / avg_total * 100
                            for p in phases
                        )

                        if max_deviation_pct >= threshold_pct:
                            severity = RiskSeverity.MEDIUM if max_deviation_pct < 25 else RiskSeverity.HIGH
                            message = (
                                f"三相不平衡: {max_deviation_pct:.1f}% "
                                f"(A={phase_avgs['A']:.1f}A, B={phase_avgs['B']:.1f}A, C={phase_avgs['C']:.1f}A)"
                            )

                            risk = Risk(
                                id="",
                                risk_type=RiskType.PHASE_IMBALANCE,
                                severity=severity,
                                message=message,
                                timestamp=window_start,
                                details={
                                    "window_start": window_start.isoformat(),
                                    "window_end": window_end.isoformat(),
                                    "phase_currents": phase_avgs,
                                    "average_current": avg_total,
                                    "max_deviation_pct": max_deviation_pct,
                                    "threshold_pct": threshold_pct,
                                },
                            )
                            risks.append(risk)

                window_start = window_end
                window_end = window_start + timedelta(minutes=time_window_minutes)
                phase_currents = {"A": [], "B": [], "C": []}

            phase_currents[phase].append(current_amps)

        return risks

    def _check_unplanned_power(
        self, log_records: List[LogRecord], plan_records: List[PlanRecord]
    ) -> List[Risk]:
        risks: List[Risk] = []
        
        if not log_records:
            return risks

        plan_by_circuit: Dict[str, List[PlanRecord]] = defaultdict(list)
        for plan in plan_records:
            plan_by_circuit[plan.circuit_id].append(plan)

        circuit_active_plans: Dict[str, List[PlanRecord]] = defaultdict(list)
        
        for circuit_id, circuit_plans in plan_by_circuit.items():
            sorted_plans = sorted(circuit_plans, key=lambda p: p.power_on_time or datetime.min)
            circuit_active_plans[circuit_id] = sorted_plans

        sorted_logs = sorted(log_records, key=lambda r: r.timestamp)

        for record in sorted_logs:
            current_amps = self._to_amperes(record.current, record.unit)
            
            if current_amps < 1.0:
                continue

            circuit_plans = circuit_active_plans.get(record.circuit_id, [])
            in_plan = False

            for plan in circuit_plans:
                if plan.power_on_time is None:
                    continue

                if plan.power_off_time is None:
                    if record.timestamp >= plan.power_on_time:
                        in_plan = True
                        break
                else:
                    if plan.power_on_time <= record.timestamp <= plan.power_off_time:
                        in_plan = True
                        break

            if not in_plan:
                circuit_config = self.circuit_configs.get(record.circuit_id)
                circuit_name = circuit_config.name if circuit_config else ""
                
                risk = Risk(
                    id="",
                    risk_type=RiskType.UNPLANNED_POWER,
                    severity=RiskSeverity.HIGH if current_amps > 5.0 else RiskSeverity.MEDIUM,
                    message=(
                        f"回路 {record.circuit_id} ({circuit_name}) 计划外上电: "
                        f"电流 {current_amps:.2f}A, 时间 {record.timestamp}"
                    ),
                    timestamp=record.timestamp,
                    circuit_id=record.circuit_id,
                    details={
                        "timestamp": record.timestamp.isoformat(),
                        "current": current_amps,
                        "has_plans": len(circuit_plans) > 0,
                    },
                )
                risks.append(risk)

        return risks

    def _check_time_deviations(
        self, log_records: List[LogRecord], plan_records: List[PlanRecord]
    ) -> List[Risk]:
        risks: List[Risk] = []
        
        if not log_records or not plan_records:
            return risks

        max_deviation = timedelta(seconds=self.config.time_deviation_seconds)

        plan_by_circuit: Dict[str, List[PlanRecord]] = defaultdict(list)
        for plan in plan_records:
            if plan.power_on_time:
                plan_by_circuit[plan.circuit_id].append(plan)

        sorted_logs = sorted(log_records, key=lambda r: r.timestamp)

        for circuit_id, circuit_plans in plan_by_circuit.items():
            circuit_logs = [r for r in sorted_logs if r.circuit_id == circuit_id]
            
            if not circuit_logs:
                continue

            circuit_config = self.circuit_configs.get(circuit_id)
            circuit_name = circuit_config.name if circuit_config else ""

            for plan in sorted(circuit_plans, key=lambda p: p.power_on_time):
                if plan.power_on_time is None:
                    continue

                expected_on = plan.power_on_time
                expected_off = plan.power_off_time

                logs_with_power = [
                    r for r in circuit_logs
                    if self._to_amperes(r.current, r.unit) >= 1.0
                ]

                if not logs_with_power:
                    continue

                actual_on = min(r.timestamp for r in logs_with_power)
                actual_off = max(r.timestamp for r in logs_with_power)

                on_deviation = actual_on - expected_on
                if abs(on_deviation) > max_deviation:
                    deviation_sec = abs(on_deviation.total_seconds())
                    early_late = "提前" if on_deviation < timedelta(0) else "延迟"
                    
                    risk = Risk(
                        id="",
                        risk_type=RiskType.TIME_DEVIATION,
                        severity=RiskSeverity.MEDIUM,
                        message=(
                            f"设备 {plan.device_name} ({plan.device_id}) {early_late}上电: "
                            f"预期 {expected_on}, 实际 {actual_on}, 偏差 {deviation_sec:.0f}秒"
                        ),
                        timestamp=actual_on,
                        circuit_id=circuit_id,
                        device_id=plan.device_id,
                        device_name=plan.device_name,
                        details={
                            "expected_time": expected_on.isoformat(),
                            "actual_time": actual_on.isoformat(),
                            "deviation_seconds": deviation_sec,
                            "event_type": "power_on",
                            "early_late": early_late,
                        },
                    )
                    risks.append(risk)

                if expected_off:
                    off_deviation = actual_off - expected_off
                    if abs(off_deviation) > max_deviation:
                        deviation_sec = abs(off_deviation.total_seconds())
                        early_late = "提前" if off_deviation < timedelta(0) else "延迟"
                        
                        risk = Risk(
                            id="",
                            risk_type=RiskType.TIME_DEVIATION,
                            severity=RiskSeverity.MEDIUM,
                            message=(
                                f"设备 {plan.device_name} ({plan.device_id}) {early_late}下电: "
                                f"预期 {expected_off}, 实际 {actual_off}, 偏差 {deviation_sec:.0f}秒"
                            ),
                            timestamp=actual_off,
                            circuit_id=circuit_id,
                            device_id=plan.device_id,
                            device_name=plan.device_name,
                            details={
                                "expected_time": expected_off.isoformat(),
                                "actual_time": actual_off.isoformat(),
                                "deviation_seconds": deviation_sec,
                                "event_type": "power_off",
                                "early_late": early_late,
                            },
                        )
                        risks.append(risk)

        return risks

    def _to_amperes(self, value: float, unit: PowerUnit) -> float:
        if unit == PowerUnit.KILOWATT:
            return value * 1000.0 / 220.0 if value > 0 else 0.0
        elif unit == PowerUnit.WATT:
            return value / 220.0 if value > 0 else 0.0
        return value
