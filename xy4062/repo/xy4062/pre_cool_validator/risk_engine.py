"""风险引擎

检测预冷装车过程中的各类风险：
- 预冷不足：货品未在发车前降到目标温度
- 制冷量不够：制冷能力不足以应对热负荷
- 开门过久：开门时长超过安全阈值
- 目标温度冲突：不同批次目标温度差异过大
- 批次超时：批次未在截止时间前完成预冷
"""

from typing import List, Dict, Optional
from pathlib import Path

from pre_cool_validator.models import (
    RiskType,
    RiskSeverity,
    RiskAssessment,
    RiskReport,
    SimulationResult,
    BatchSimulationResult,
    LoadingPlan,
    VehicleConfig,
    ProductParams,
)


class BaseRule:
    """风险规则基类"""

    rule_name: str = ""
    risk_type: RiskType

    def evaluate(
        self,
        simulation: SimulationResult,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> Optional[RiskAssessment]:
        """评估规则，返回风险评估结果或None"""
        raise NotImplementedError


class PrecoolInsufficientRule(BaseRule):
    """预冷不足规则

    检测货品在总预冷时间结束时是否仍未降到目标温度。
    """

    rule_name = "预冷不足检测"
    risk_type = RiskType.PRECOOL_INSUFFICIENT

    def evaluate(
        self,
        simulation: SimulationResult,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> Optional[RiskAssessment]:
        failed_batches: List[str] = []
        details: Dict[str, Dict] = {}

        for result in simulation.batch_results:
            if not result.reached_target:
                failed_batches.append(result.batch_id)

                temp_diff = result.final_temp - result.target_temp
                estimated_additional_time = self._estimate_additional_time(
                    result, plan.total_precool_time
                )

                details[result.batch_id] = {
                    "product_name": result.product_name,
                    "initial_temp": result.initial_temp,
                    "final_temp": result.final_temp,
                    "target_temp": result.target_temp,
                    "temp_diff": round(temp_diff, 2),
                    "estimated_additional_time_min": round(estimated_additional_time, 1) if estimated_additional_time else None,
                }

        if not failed_batches:
            return None

        severity = self._determine_severity(details)

        message = f"发现 {len(failed_batches)} 个批次预冷不足，无法在 {plan.total_precool_time} 分钟内降到目标温度"

        suggestion = self._generate_suggestion(details, plan.total_precool_time)

        return RiskAssessment(
            risk_type=self.risk_type,
            severity=severity,
            message=message,
            affected_batches=failed_batches,
            details=details,
            suggestion=suggestion,
        )

    def _estimate_additional_time(
        self, result: BatchSimulationResult, total_time: int
    ) -> Optional[float]:
        """估算额外需要的预冷时间"""
        if not result.time_steps:
            return None

        if len(result.time_steps) < 2:
            return None

        recent_cooling_rate = self._calculate_recent_cooling_rate(result)

        if recent_cooling_rate >= 0:
            return None

        temp_remaining = result.final_temp - result.target_temp
        if temp_remaining <= 0:
            return 0.0

        return temp_remaining / abs(recent_cooling_rate)

    def _calculate_recent_cooling_rate(self, result: BatchSimulationResult) -> float:
        """计算最近的降温速率（°C/分钟）"""
        if len(result.time_steps) < 10:
            if len(result.time_steps) < 2:
                return 0.0
            steps = result.time_steps
        else:
            steps = result.time_steps[-10:]

        first = steps[0]
        last = steps[-1]

        time_diff = last.time_minute - first.time_minute
        if time_diff <= 0:
            return 0.0

        return (last.batch_temp - first.batch_temp) / time_diff

    def _determine_severity(self, details: Dict[str, Dict]) -> RiskSeverity:
        """确定风险严重程度"""
        max_diff = max(d.get("temp_diff", 0) for d in details.values())

        if max_diff >= 5.0:
            return RiskSeverity.HIGH
        elif max_diff >= 2.0:
            return RiskSeverity.MEDIUM
        else:
            return RiskSeverity.LOW

    def _generate_suggestion(self, details: Dict[str, Dict], total_time: int) -> str:
        """生成改进建议"""
        suggestions = []

        for batch_id, info in details.items():
            add_time = info.get("estimated_additional_time_min")
            if add_time:
                suggestions.append(
                    f"- {info['product_name']}({batch_id}): 预估需要额外 {add_time} 分钟预冷"
                )
            else:
                suggestions.append(
                    f"- {info['product_name']}({batch_id}): 当前降温速率不足，建议检查制冷系统"
                )

        suggestions.append("\n通用建议：")
        suggestions.append("1. 延长预冷时间或提前开始预冷")
        suggestions.append("2. 检查车辆制冷系统是否正常工作")
        suggestions.append("3. 减少开门次数和开门时长")
        suggestions.append("4. 考虑分批预冷或使用预冷站预冷")

        return "\n".join(suggestions)


class CoolingCapacityInsufficientRule(BaseRule):
    """制冷量不够规则

    检测车辆制冷能力是否不足以应对总热负荷。
    """

    rule_name = "制冷量不足检测"
    risk_type = RiskType.COOLING_CAPACITY_INSUFFICIENT

    def evaluate(
        self,
        simulation: SimulationResult,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> Optional[RiskAssessment]:
        if simulation.cooling_surplus >= 0:
            return None

        deficit = abs(simulation.cooling_surplus)

        details = {
            "total_cooling_required_kj": round(simulation.total_cooling_required, 2),
            "total_cooling_provided_kj": round(simulation.total_cooling_provided, 2),
            "cooling_deficit_kj": round(deficit, 2),
            "vehicle_cooling_capacity_kw": simulation.vehicle_cooling_capacity,
            "door_heat_infiltration_kj": round(simulation.door_heat_infiltration, 2),
            "ambient_heat_infiltration_kj": round(simulation.ambient_heat_infiltration, 2),
            "respiration_heat_kj": round(simulation.respiration_heat_total, 2),
        }

        peak_load = max((br.peak_heat_load for br in simulation.batch_results), default=0)
        capacity_ratio = peak_load / vehicle.cooling_capacity if vehicle.cooling_capacity > 0 else 0

        if capacity_ratio > 1.2 or deficit > 5000:
            severity = RiskSeverity.HIGH
        elif capacity_ratio > 1.0 or deficit > 2000:
            severity = RiskSeverity.MEDIUM
        else:
            severity = RiskSeverity.LOW

        message = (
            f"制冷量不足！总需求 {round(simulation.total_cooling_required + simulation.door_heat_infiltration + simulation.ambient_heat_infiltration + simulation.respiration_heat_total, 2)} kJ，"
            f"总供应 {round(simulation.total_cooling_provided, 2)} kJ，"
            f"缺口 {round(deficit, 2)} kJ"
        )

        suggestion = self._generate_suggestion(details, vehicle, plan)

        return RiskAssessment(
            risk_type=self.risk_type,
            severity=severity,
            message=message,
            affected_batches=[br.batch_id for br in simulation.batch_results],
            details=details,
            suggestion=suggestion,
        )

    def _generate_suggestion(
        self,
        details: Dict,
        vehicle: VehicleConfig,
        plan: LoadingPlan,
    ) -> str:
        suggestions = ["制冷量不足改进建议："]

        door_kj = details.get("door_heat_infiltration_kj", 0)
        if door_kj > 1000:
            suggestions.append(f"1. 开门热侵入较大({door_kj} kJ)，建议减少开门时长")
            suggestions.append(f"   当前开门时长: {plan.door_open_duration} 分钟")

        ambient_kj = details.get("ambient_heat_infiltration_kj", 0)
        if ambient_kj > 2000:
            suggestions.append(f"2. 环境热侵入较大({ambient_kj} kJ)，建议：")
            suggestions.append("   - 避开高温时段作业")
            suggestions.append("   - 检查车辆保温层状况")

        suggestions.append(f"3. 当前车辆制冷量: {vehicle.cooling_capacity} kW")
        suggestions.append("4. 考虑使用制冷能力更强的车辆")
        suggestions.append("5. 或减少单次运输货量，分批运输")

        return "\n".join(suggestions)


class DoorOpenTooLongRule(BaseRule):
    """开门过久规则

    检测开门时长是否超过安全阈值。
    """

    rule_name = "开门过久检测"
    risk_type = RiskType.DOOR_OPEN_TOO_LONG

    def evaluate(
        self,
        simulation: SimulationResult,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> Optional[RiskAssessment]:
        actual_duration = plan.door_open_duration
        max_allowed = vehicle.max_door_open_duration

        if actual_duration <= max_allowed:
            return None

        excess = actual_duration - max_allowed
        excess_pct = (excess / max_allowed) * 100 if max_allowed > 0 else 0

        door_kj = simulation.door_heat_infiltration

        details = {
            "actual_duration_min": actual_duration,
            "max_allowed_min": max_allowed,
            "excess_min": excess,
            "excess_percent": round(excess_pct, 1),
            "door_heat_infiltration_kj": round(door_kj, 2),
            "door_area_m2": vehicle.door_area,
            "ambient_temp": plan.ambient_temp,
        }

        if excess >= 15 or excess_pct >= 100:
            severity = RiskSeverity.HIGH
        elif excess >= 5 or excess_pct >= 30:
            severity = RiskSeverity.MEDIUM
        else:
            severity = RiskSeverity.LOW

        message = (
            f"开门时间过长！实际 {actual_duration} 分钟，"
            f"允许 {max_allowed} 分钟，"
            f"超出 {excess} 分钟({excess_pct:.1f}%)，"
            f"开门热侵入 {door_kj:.2f} kJ"
        )

        suggestion = self._generate_suggestion(details)

        return RiskAssessment(
            risk_type=self.risk_type,
            severity=severity,
            message=message,
            affected_batches=[br.batch_id for br in simulation.batch_results],
            details=details,
            suggestion=suggestion,
        )

    def _generate_suggestion(self, details: Dict) -> str:
        suggestions = ["开门过久改进建议："]
        suggestions.append("1. 优化装车流程，提前准备好货品")
        suggestions.append("2. 安排专人负责快速装车")
        suggestions.append("3. 考虑使用站台登车桥减少装车时间")
        suggestions.append("4. 高温时段可考虑使用风幕减少热侵入")
        suggestions.append("5. 分批开门装车，避免长时间大开门")

        return "\n".join(suggestions)


class TargetTempConflictRule(BaseRule):
    """目标温度冲突规则

    检测不同批次的目标温度是否差异过大。
    """

    rule_name = "目标温度冲突检测"
    risk_type = RiskType.TARGET_TEMP_CONFLICT
    CONFLICT_THRESHOLD = 5.0

    def evaluate(
        self,
        simulation: SimulationResult,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> Optional[RiskAssessment]:
        target_temps: Dict[float, List[str]] = {}

        for batch in plan.batches:
            temp = batch.target_temp
            if temp not in target_temps:
                target_temps[temp] = []
            target_temps[temp].append(batch.batch_id)

        if len(target_temps) <= 1:
            return None

        temps = sorted(target_temps.keys())
        max_diff = temps[-1] - temps[0]

        if max_diff < self.CONFLICT_THRESHOLD:
            return None

        details = {
            "target_temperatures": [
                {"temp": t, "batches": batches}
                for t, batches in target_temps.items()
            ],
            "max_temp_diff": round(max_diff, 2),
            "threshold": self.CONFLICT_THRESHOLD,
        }

        if max_diff >= 10.0:
            severity = RiskSeverity.HIGH
        elif max_diff >= 7.0:
            severity = RiskSeverity.MEDIUM
        else:
            severity = RiskSeverity.LOW

        message = (
            f"目标温度冲突！存在 {len(target_temps)} 种不同目标温度，"
            f"最大温差 {max_diff:.1f}°C，"
            f"超过阈值 {self.CONFLICT_THRESHOLD}°C"
        )

        suggestion = self._generate_suggestion(details)

        return RiskAssessment(
            risk_type=self.risk_type,
            severity=severity,
            message=message,
            affected_batches=[br.batch_id for br in simulation.batch_results],
            details=details,
            suggestion=suggestion,
        )

    def _generate_suggestion(self, details: Dict) -> str:
        suggestions = ["目标温度冲突处理建议："]

        temps_info = details.get("target_temperatures", [])
        for info in temps_info:
            temp = info.get("temp")
            batches = info.get("batches", [])
            suggestions.append(f"- 目标温度 {temp}°C: {len(batches)} 个批次")

        suggestions.append("\n解决方案：")
        suggestions.append("1. 考虑分车运输，按目标温度分组")
        suggestions.append("2. 如必须混装，设置折中的车厢温度")
        suggestions.append("3. 对温度敏感货品使用独立保温箱")
        suggestions.append("4. 确认是否有货品目标温度设置错误")

        return "\n".join(suggestions)


class BatchTimeoutRule(BaseRule):
    """批次超时规则

    检测批次是否在指定的截止时间前未完成预冷。
    """

    rule_name = "批次超时检测"
    risk_type = RiskType.BATCH_TIMEOUT

    def evaluate(
        self,
        simulation: SimulationResult,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> Optional[RiskAssessment]:
        timeout_batches: List[str] = []
        details: Dict[str, Dict] = {}

        batch_deadlines: Dict[str, int] = {}
        for batch in plan.batches:
            if batch.deadline_time is not None:
                batch_deadlines[batch.batch_id] = batch.deadline_time

        if not batch_deadlines:
            return None

        for result in simulation.batch_results:
            batch_id = result.batch_id
            deadline = batch_deadlines.get(batch_id)

            if deadline is None:
                continue

            if result.reached_target and result.time_to_target is not None:
                if result.time_to_target <= deadline:
                    continue

                excess = result.time_to_target - deadline
                timeout_batches.append(batch_id)
                details[batch_id] = {
                    "product_name": result.product_name,
                    "deadline_min": deadline,
                    "actual_time_min": round(result.time_to_target, 1),
                    "excess_min": round(excess, 1),
                    "target_temp": result.target_temp,
                    "final_temp": result.final_temp,
                }
            else:
                timeout_batches.append(batch_id)
                details[batch_id] = {
                    "product_name": result.product_name,
                    "deadline_min": deadline,
                    "actual_time_min": None,
                    "excess_min": None,
                    "target_temp": result.target_temp,
                    "final_temp": result.final_temp,
                    "status": "未达到目标温度",
                }

        if not timeout_batches:
            return None

        max_excess = max(
            (d.get("excess_min", 0) or 0 for d in details.values()),
            default=0
        )

        if max_excess >= 30:
            severity = RiskSeverity.HIGH
        elif max_excess >= 10:
            severity = RiskSeverity.MEDIUM
        else:
            severity = RiskSeverity.LOW

        message = f"发现 {len(timeout_batches)} 个批次超时，无法在截止时间前完成预冷"

        suggestion = self._generate_suggestion(details)

        return RiskAssessment(
            risk_type=self.risk_type,
            severity=severity,
            message=message,
            affected_batches=timeout_batches,
            details=details,
            suggestion=suggestion,
        )

    def _generate_suggestion(self, details: Dict) -> str:
        suggestions = ["批次超时改进建议："]

        for batch_id, info in details.items():
            if info.get("status") == "未达到目标温度":
                suggestions.append(
                    f"- {info['product_name']}({batch_id}): 截止时间{info['deadline_min']}分钟时仍未达到目标温度{info['target_temp']}°C"
                )
            else:
                suggestions.append(
                    f"- {info['product_name']}({batch_id}): 截止时间{info['deadline_min']}分钟，实际用时{info['actual_time_min']}分钟，超出{info['excess_min']}分钟"
                )

        suggestions.append("\n解决方案：")
        suggestions.append("1. 优先预冷有截止时间要求的批次")
        suggestions.append("2. 提前开始预冷，确保有足够时间")
        suggestions.append("3. 确认截止时间设置是否合理")

        return "\n".join(suggestions)


class RiskEngine:
    """风险引擎

    整合所有风险规则，执行完整的风险评估。
    """

    def __init__(self):
        self.rules: List[BaseRule] = [
            PrecoolInsufficientRule(),
            CoolingCapacityInsufficientRule(),
            DoorOpenTooLongRule(),
            TargetTempConflictRule(),
            BatchTimeoutRule(),
        ]

    def evaluate(
        self,
        simulation: SimulationResult,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> RiskReport:
        """
        执行完整的风险评估

        Args:
            simulation: 仿真结果
            plan: 装车计划
            vehicle: 车辆配置
            products: 货品参数字典

        Returns:
            RiskReport: 风险报告
        """
        risks: List[RiskAssessment] = []

        for rule in self.rules:
            try:
                risk = rule.evaluate(simulation, plan, vehicle, products)
                if risk:
                    risks.append(risk)
            except Exception as e:
                pass

        high_count = sum(1 for r in risks if r.severity == RiskSeverity.HIGH)
        medium_count = sum(1 for r in risks if r.severity == RiskSeverity.MEDIUM)
        low_count = sum(1 for r in risks if r.severity == RiskSeverity.LOW)

        overall_pass = high_count == 0

        return RiskReport(
            plan_id=plan.plan_id,
            total_risks=len(risks),
            high_severity=high_count,
            medium_severity=medium_count,
            low_severity=low_count,
            risks=risks,
            overall_pass=overall_pass,
        )
