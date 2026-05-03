from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4
import math

from ..models import (
    PondConfig,
    PondState,
    WaterQualityParams,
    ThresholdParams,
    SimulationResult,
    SensorData,
    Scenario,
    ProbioticsPlan,
    RiskAssessment,
    RiskType,
    RiskLevel,
)


class RiskEngine:
    def __init__(self, thresholds: Optional[ThresholdParams] = None):
        self.thresholds = thresholds or ThresholdParams()

    def _create_risk(
        self,
        risk_type: RiskType,
        risk_level: RiskLevel,
        description: str,
        current_value: Optional[float] = None,
        threshold_value: Optional[float] = None,
        location: Optional[str] = None,
        suggested_action: Optional[str] = None,
        confidence: float = 1.0,
    ) -> RiskAssessment:
        return RiskAssessment(
            risk_id=f"risk_{uuid4().hex[:8]}",
            risk_type=risk_type,
            risk_level=risk_level,
            description=description,
            current_value=current_value,
            threshold_value=threshold_value,
            location=location,
            suggested_action=suggested_action,
            confidence=confidence,
        )

    def check_ammonia_risk(self, ammonia: float) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if ammonia > self.thresholds.ammonia_nitrogen_danger:
            risks.append(self._create_risk(
                risk_type=RiskType.AMMONIA_HIGH,
                risk_level=RiskLevel.CRITICAL,
                description=f"氨氮浓度严重超标，达到危险水平",
                current_value=ammonia,
                threshold_value=self.thresholds.ammonia_nitrogen_danger,
                suggested_action="立即换水30-50%，同时开启增氧，考虑紧急投菌",
            ))
        elif ammonia > self.thresholds.ammonia_nitrogen_warning:
            risks.append(self._create_risk(
                risk_type=RiskType.AMMONIA_HIGH,
                risk_level=RiskLevel.WARNING,
                description=f"氨氮浓度偏高，达到警告水平",
                current_value=ammonia,
                threshold_value=self.thresholds.ammonia_nitrogen_warning,
                suggested_action="考虑换水10-20%，增加曝气，可投加益生菌",
            ))

        return risks

    def check_nitrite_risk(self, nitrite: float) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if nitrite > self.thresholds.nitrite_danger:
            risks.append(self._create_risk(
                risk_type=RiskType.NITRITE_HIGH,
                risk_level=RiskLevel.CRITICAL,
                description=f"亚硝酸盐浓度严重超标，达到危险水平",
                current_value=nitrite,
                threshold_value=self.thresholds.nitrite_danger,
                suggested_action="立即换水30-40%，开启增氧，使用盐度缓解或化学解毒",
            ))
        elif nitrite > self.thresholds.nitrite_warning:
            risks.append(self._create_risk(
                risk_type=RiskType.NITRITE_HIGH,
                risk_level=RiskLevel.WARNING,
                description=f"亚硝酸盐浓度偏高，达到警告水平",
                current_value=nitrite,
                threshold_value=self.thresholds.nitrite_warning,
                suggested_action="换水15-25%，增加曝气，投加硝化细菌",
            ))

        return risks

    def check_ph_range(self, ph: float) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if ph < self.thresholds.ph_min or ph > self.thresholds.ph_max:
            direction = "偏低" if ph < self.thresholds.ph_min else "偏高"
            risk_level = RiskLevel.DANGER if abs(ph - (self.thresholds.ph_min + self.thresholds.ph_max) / 2) > 1.5 else RiskLevel.WARNING

            risks.append(self._create_risk(
                risk_type=RiskType.PH_OUT_OF_RANGE,
                risk_level=risk_level,
                description=f"pH值{direction}，超出正常范围",
                current_value=ph,
                threshold_value=None,
                suggested_action="检查水源和底质，逐步调整pH值，避免骤变",
            ))

        return risks

    def check_ph_mutation(
        self,
        current_ph: float,
        previous_ph: float,
        time_hours: float = 1.0,
    ) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if time_hours <= 0:
            return risks

        change_rate = abs(current_ph - previous_ph) / time_hours

        if change_rate > self.thresholds.ph_change_rate:
            direction = "上升" if current_ph > previous_ph else "下降"
            risks.append(self._create_risk(
                risk_type=RiskType.PH_MUTATION,
                risk_level=RiskLevel.DANGER,
                description=f"pH值{direction}过快，可能刺激幼苗",
                current_value=change_rate,
                threshold_value=self.thresholds.ph_change_rate,
                suggested_action="立即停止任何可能改变pH的操作，检查是否有药物或水质突变",
            ))

        return risks

    def check_salinity_range(self, salinity: float) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if salinity < self.thresholds.salinity_min or salinity > self.thresholds.salinity_max:
            direction = "偏低" if salinity < self.thresholds.salinity_min else "偏高"
            risks.append(self._create_risk(
                risk_type=RiskType.SALINITY_OUT_OF_RANGE,
                risk_level=RiskLevel.WARNING,
                description=f"盐度{direction}，超出养殖品种适宜范围",
                current_value=salinity,
                suggested_action="逐步调整盐度，每日变化不超过2‰",
            ))

        return risks

    def check_salinity_gradient(
        self,
        current_salinity: float,
        source_salinity: float,
    ) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        gradient = abs(current_salinity - source_salinity)

        if gradient > self.thresholds.salinity_gradient:
            risks.append(self._create_risk(
                risk_type=RiskType.SALINITY_GRADIENT,
                risk_level=RiskLevel.WARNING,
                description=f"水源与池塘盐度差过大，直接换水可能刺激幼苗",
                current_value=gradient,
                threshold_value=self.thresholds.salinity_gradient,
                suggested_action="逐步换水，或先调节水源盐度后再换",
            ))

        return risks

    def check_do_risk(self, do: float) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if do < self.thresholds.do_critical:
            risks.append(self._create_risk(
                risk_type=RiskType.DO_CRITICAL,
                risk_level=RiskLevel.CRITICAL,
                description=f"溶解氧严重不足，达到临界值",
                current_value=do,
                threshold_value=self.thresholds.do_critical,
                suggested_action="立即开启所有增氧设备，可使用化学增氧剂急救",
            ))
        elif do < self.thresholds.do_min:
            risks.append(self._create_risk(
                risk_type=RiskType.DO_LOW,
                risk_level=RiskLevel.WARNING,
                description=f"溶解氧偏低",
                current_value=do,
                threshold_value=self.thresholds.do_min,
                suggested_action="增加曝气时间，检查是否有水质恶化迹象",
            ))

        return risks

    def check_temperature_risk(self, temp: float) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if temp < self.thresholds.temp_min or temp > self.thresholds.temp_max:
            direction = "过低" if temp < self.thresholds.temp_min else "过高"
            risks.append(self._create_risk(
                risk_type=RiskType.TEMP_OUT_OF_RANGE,
                risk_level=RiskLevel.WARNING,
                description=f"水温{direction}，超出适宜范围",
                current_value=temp,
                suggested_action="采取控温措施，如遮阳、加热等",
            ))

        return risks

    def check_probiotics_interval(
        self,
        current_plan: ProbioticsPlan,
        last_application_time: Optional[datetime],
    ) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        if last_application_time is None:
            return risks

        hours_since_last = (current_plan.application_time - last_application_time).total_seconds() / 3600

        if hours_since_last < current_plan.minimum_interval_hours:
            risks.append(self._create_risk(
                risk_type=RiskType.PROBIOTICS_INTERVAL,
                risk_level=RiskLevel.WARNING,
                description=f"益生菌施用间隔不足，可能影响效果或造成浪费",
                current_value=hours_since_last,
                threshold_value=current_plan.minimum_interval_hours,
                location=f"计划施用时间: {current_plan.application_time}",
                suggested_action="建议延后施用，或减少剂量",
            ))

        return risks

    def check_simulation_risks(
        self,
        simulation_result: SimulationResult,
    ) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        for i, (ts, ammonia, nitrite, ph, salinity, do, temp) in enumerate(zip(
            simulation_result.timestamps,
            simulation_result.ammonia_nitrogens,
            simulation_result.nitrites,
            simulation_result.ph_values,
            simulation_result.salinities,
            simulation_result.dissolved_oxygens,
            simulation_result.temperatures,
        )):
            time_label = f"模拟时间点 {i}: {ts.strftime('%Y-%m-%d %H:%M')}"

            ammonia_risks = self.check_ammonia_risk(ammonia)
            for risk in ammonia_risks:
                risk.location = time_label
                risks.append(risk)

            nitrite_risks = self.check_nitrite_risk(nitrite)
            for risk in nitrite_risks:
                risk.location = time_label
                risks.append(risk)

            ph_risks = self.check_ph_range(ph)
            for risk in ph_risks:
                risk.location = time_label
                risks.append(risk)

            do_risks = self.check_do_risk(do)
            for risk in do_risks:
                risk.location = time_label
                risks.append(risk)

            temp_risks = self.check_temperature_risk(temp)
            for risk in temp_risks:
                risk.location = time_label
                risks.append(risk)

            if i > 0:
                prev_ph = simulation_result.ph_values[i - 1]
                time_diff = (ts - simulation_result.timestamps[i - 1]).total_seconds() / 3600
                ph_mutation_risks = self.check_ph_mutation(ph, prev_ph, time_diff)
                for risk in ph_mutation_risks:
                    risk.location = time_label
                    risks.append(risk)

        seen = set()
        unique_risks: List[RiskAssessment] = []
        for risk in risks:
            key = (risk.risk_type.value, risk.location, risk.current_value)
            if key not in seen:
                seen.add(key)
                unique_risks.append(risk)

        return unique_risks

    def check_initial_state_risks(
        self,
        state: PondState,
    ) -> List[RiskAssessment]:
        risks: List[RiskAssessment] = []

        risks.extend(self.check_ammonia_risk(state.ammonia_nitrogen))
        risks.extend(self.check_nitrite_risk(state.nitrite))
        risks.extend(self.check_ph_range(state.ph))
        risks.extend(self.check_salinity_range(state.salinity))
        risks.extend(self.check_do_risk(state.dissolved_oxygen))
        risks.extend(self.check_temperature_risk(state.temperature))

        return risks

    def check_complete_risks(
        self,
        initial_state: PondState,
        simulation_result: Optional[SimulationResult] = None,
        sensor_data: Optional[SensorData] = None,
        scenario: Optional[Scenario] = None,
    ) -> List[RiskAssessment]:
        all_risks: List[RiskAssessment] = []

        all_risks.extend(self.check_initial_state_risks(initial_state))

        if simulation_result:
            all_risks.extend(self.check_simulation_risks(simulation_result))

        if scenario:
            for prob_plan in scenario.probiotics_plans:
                last_time = prob_plan.last_application_time
                interval_risks = self.check_probiotics_interval(prob_plan, last_time)
                all_risks.extend(interval_risks)

        return all_risks
