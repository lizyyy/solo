from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass
import math

from ..models import (
    PondConfig,
    PondState,
    WaterQualityParams,
    ThresholdParams,
    SimulationParams,
    SimulationResult,
    Scenario,
    WaterChangePlan,
    AerationPlan,
    ProbioticsPlan,
    RiskAssessment,
    RiskLevel,
)


@dataclass
class WaterChangeRecommendation:
    recommended: bool
    exchange_ratio: float
    urgency: str
    duration_hours: float
    exchange_rate: float
    reason: str
    precautions: List[str]


@dataclass
class AerationRecommendation:
    recommended: bool
    intensity: str
    duration_hours: float
    aeration_rate: float
    reason: str
    use_oxygenator: bool


@dataclass
class ProbioticsRecommendation:
    recommended: bool
    probiotics_type: str
    dosage: float
    reason: str
    timing_hint: str


class RecommendationEngine:
    PROBIOTICS_TYPES = {
        "nitrifying": {
            "name": "硝化细菌",
            "target": ["ammonia_nitrogen", "nitrite"],
            "dosage_range": (5, 20),
        },
        "bacillus": {
            "name": "芽孢杆菌",
            "target": ["ammonia_nitrogen", "organic_matter"],
            "dosage_range": (10, 30),
        },
        "em": {
            "name": "EM菌",
            "target": ["ammonia_nitrogen", "nitrite", "ph"],
            "dosage_range": (5, 15),
        },
        "photosynthetic": {
            "name": "光合细菌",
            "target": ["ammonia_nitrogen", "hydrogen_sulfide"],
            "dosage_range": (10, 25),
        },
    }

    def __init__(self, thresholds: Optional[ThresholdParams] = None):
        self.thresholds = thresholds or ThresholdParams()

    def calculate_water_change(
        self,
        current_state: PondState,
        source_water_params: Dict[str, float],
        pond_config: PondConfig,
        risks: List[RiskAssessment],
    ) -> WaterChangeRecommendation:
        ammonia_ratio = current_state.ammonia_nitrogen / max(
            self.thresholds.ammonia_nitrogen_warning, 0.001
        )
        nitrite_ratio = current_state.nitrite / max(
            self.thresholds.nitrite_warning, 0.001
        )

        critical_risks = [r for r in risks if r.risk_level == RiskLevel.CRITICAL]
        danger_risks = [r for r in risks if r.risk_level == RiskLevel.DANGER]
        warning_risks = [r for r in risks if r.risk_level == RiskLevel.WARNING]

        base_ratio = 0.0
        urgency = "normal"
        reason_parts = []
        precautions = []

        if critical_risks:
            urgency = "emergency"
            base_ratio = min(0.5, max(0.3, base_ratio + 0.3))
            reason_parts.append("存在临界风险")
            precautions.append("紧急换水时注意温度和盐度梯度")
            precautions.append("分批次进行，避免一次性换水量过大")
        elif danger_risks:
            urgency = "high"
            base_ratio = min(0.4, max(0.2, base_ratio + 0.2))
            reason_parts.append("存在危险级风险")
        elif warning_risks:
            urgency = "medium"
            base_ratio = min(0.25, max(0.1, base_ratio + 0.1))
            reason_parts.append("存在警告级风险")

        if ammonia_ratio > 2:
            base_ratio = max(base_ratio, 0.3)
            reason_parts.append(f"氨氮超标{ammonia_ratio:.1f}倍")
        elif ammonia_ratio > 1:
            base_ratio = max(base_ratio, 0.15)
            reason_parts.append(f"氨氮偏高{ammonia_ratio:.1f}倍")

        if nitrite_ratio > 2:
            base_ratio = max(base_ratio, 0.35)
            reason_parts.append(f"亚硝酸盐超标{nitrite_ratio:.1f}倍")
        elif nitrite_ratio > 1:
            base_ratio = max(base_ratio, 0.15)
            reason_parts.append(f"亚硝酸盐偏高{nitrite_ratio:.1f}倍")

        salinity_diff = abs(current_state.salinity - source_water_params.get("salinity", 0))
        if salinity_diff > self.thresholds.salinity_gradient:
            precautions.append(f"水源与池塘盐度差{salinity_diff:.1f}‰，需逐步调整")
            base_ratio = min(base_ratio, 0.2)

        ph_diff = abs(current_state.ph - source_water_params.get("ph", 7.5))
        if ph_diff > 0.5:
            precautions.append(f"水源与池塘pH差{ph_diff:.2f}，需注意缓冲")
            base_ratio = min(base_ratio, 0.25)

        recommended = base_ratio > 0.01

        if recommended:
            duration_hours = max(2, base_ratio * 8)
            exchange_rate = base_ratio / duration_hours
        else:
            duration_hours = 0
            exchange_rate = 0

        reason = "水质良好，无需换水"
        if reason_parts:
            reason = "需要换水：" + "、".join(reason_parts)

        return WaterChangeRecommendation(
            recommended=recommended,
            exchange_ratio=round(base_ratio, 3),
            urgency=urgency,
            duration_hours=round(duration_hours, 1),
            exchange_rate=round(exchange_rate, 4),
            reason=reason,
            precautions=precautions,
        )

    def calculate_aeration(
        self,
        current_state: PondState,
        risks: List[RiskAssessment],
        pond_config: PondConfig,
    ) -> AerationRecommendation:
        do_ratio = current_state.dissolved_oxygen / max(self.thresholds.do_min, 0.001)

        critical_do_risks = [
            r for r in risks
            if r.risk_level == RiskLevel.CRITICAL and "dissolved" in r.description.lower()
        ]
        warning_do_risks = [
            r for r in risks
            if r.risk_level == RiskLevel.WARNING and "溶解氧" in r.description
        ]

        recommended = False
        intensity = "low"
        duration_hours = 0
        aeration_rate = 0.0
        reason = "溶解氧充足"
        use_oxygenator = False

        if critical_do_risks:
            recommended = True
            intensity = "high"
            duration_hours = 24
            aeration_rate = 0.5
            use_oxygenator = True
            reason = "溶解氧严重不足，需要持续高强度曝气"
        elif warning_do_risks:
            recommended = True
            intensity = "normal"
            duration_hours = 12
            aeration_rate = 0.3
            reason = "溶解氧偏低，需要增加曝气"
        elif do_ratio < 1.5:
            recommended = True
            intensity = "low"
            duration_hours = 8
            aeration_rate = 0.15
            reason = "溶解氧储备不足，建议预防性曝气"

        has_ammonia_risk = any(
            r for r in risks
            if "ammonia" in r.risk_type.value or r.risk_level in [RiskLevel.CRITICAL, RiskLevel.DANGER]
        )
        if has_ammonia_risk and not recommended:
            recommended = True
            intensity = "normal"
            duration_hours = 8
            aeration_rate = 0.2
            reason = "存在氨氮/亚硝酸盐风险，曝气有助于硝化作用"

        return AerationRecommendation(
            recommended=recommended,
            intensity=intensity,
            duration_hours=duration_hours,
            aeration_rate=round(aeration_rate, 3),
            reason=reason,
            use_oxygenator=use_oxygenator,
        )

    def calculate_probiotics(
        self,
        current_state: PondState,
        risks: List[RiskAssessment],
        last_application_time: Optional[datetime] = None,
    ) -> ProbioticsRecommendation:
        ammonia_ratio = current_state.ammonia_nitrogen / max(
            self.thresholds.ammonia_nitrogen_warning, 0.001
        )
        nitrite_ratio = current_state.nitrite / max(
            self.thresholds.nitrite_warning, 0.001
        )

        if last_application_time:
            hours_since_last = (datetime.now() - last_application_time).total_seconds() / 3600
            if hours_since_last < 24:
                return ProbioticsRecommendation(
                    recommended=False,
                    probiotics_type="",
                    dosage=0,
                    reason=f"距上次施用仅{hours_since_last:.1f}小时，建议间隔24小时以上",
                    timing_hint="",
                )

        recommended = False
        probiotics_type = ""
        dosage = 0
        reason = "水质稳定，暂不需要投菌"
        timing_hint = "建议晴天上午施用"

        high_risks = [
            r for r in risks
            if r.risk_level in [RiskLevel.CRITICAL, RiskLevel.DANGER, RiskLevel.WARNING]
        ]

        if ammonia_ratio > 1.5 or nitrite_ratio > 1.5:
            recommended = True
            if ammonia_ratio > nitrite_ratio:
                probiotics_type = "nitrifying"
                reason = "氨氮偏高，建议投加硝化细菌"
            else:
                probiotics_type = "photosynthetic"
                reason = "亚硝酸盐偏高，建议投加光合细菌"

            base_dosage = 10
            if ammonia_ratio > 3 or nitrite_ratio > 3:
                dosage = 20
            elif ammonia_ratio > 2 or nitrite_ratio > 2:
                dosage = 15
            else:
                dosage = 10

        elif high_risks:
            recommended = True
            probiotics_type = "em"
            reason = "存在水质风险，建议投加EM菌改善水质"
            dosage = 10

        elif ammonia_ratio > 0.8 or nitrite_ratio > 0.8:
            recommended = True
            probiotics_type = "bacillus"
            reason = "预防性维护，建议投加芽孢杆菌"
            dosage = 8
            timing_hint = "可在投喂后2小时施用"

        probiotics_info = self.PROBIOTICS_TYPES.get(probiotics_type, {})
        if probiotics_info and "dosage_range" in probiotics_info:
            min_dosage, max_dosage = probiotics_info["dosage_range"]
            dosage = max(min_dosage, min(max_dosage, dosage))

        return ProbioticsRecommendation(
            recommended=recommended,
            probiotics_type=probiotics_type,
            dosage=round(dosage, 1),
            reason=reason,
            timing_hint=timing_hint,
        )

    def generate_scenario(
        self,
        pond_config: PondConfig,
        current_state: PondState,
        source_water_params: Dict[str, float],
        risks: List[RiskAssessment],
        scenario_id: str,
        scenario_name: str,
        last_probiotics_time: Optional[datetime] = None,
    ) -> Tuple[Scenario, Dict[str, Any]]:
        wc_rec = self.calculate_water_change(
            current_state, source_water_params, pond_config, risks
        )
        aer_rec = self.calculate_aeration(current_state, risks, pond_config)
        prob_rec = self.calculate_probiotics(
            current_state, risks, last_probiotics_time
        )

        scenario = Scenario(
            scenario_id=scenario_id,
            scenario_name=scenario_name,
            pond_id=pond_config.pond_id,
            description=f"基于{datetime.now().strftime('%Y-%m-%d %H:%M')}水质分析的推荐方案",
        )

        recommendations: Dict[str, Any] = {
            "water_change": wc_rec.__dict__.copy(),
            "aeration": aer_rec.__dict__.copy(),
            "probiotics": prob_rec.__dict__.copy(),
        }

        start_time = datetime.now()

        if wc_rec.recommended:
            wc_plan = WaterChangePlan(
                plan_id=f"wc_{scenario_id}",
                start_time=start_time,
                duration_hours=wc_rec.duration_hours,
                exchange_rate=wc_rec.exchange_rate,
                total_exchange_ratio=wc_rec.exchange_ratio,
                source_water_ph=source_water_params.get("ph", 7.5),
                source_water_salinity=source_water_params.get("salinity", 0),
                source_water_ammonia=source_water_params.get("ammonia_nitrogen", 0),
                source_water_nitrite=source_water_params.get("nitrite", 0),
                is_urgent=wc_rec.urgency == "emergency",
                notes=wc_rec.reason,
            )
            scenario.add_water_change_plan(wc_plan)

        if aer_rec.recommended:
            aer_plan = AerationPlan(
                plan_id=f"aer_{scenario_id}",
                start_time=start_time,
                duration_hours=aer_rec.duration_hours,
                aeration_rate=aer_rec.aeration_rate,
                aeration_intensity=aer_rec.intensity,
                use_oxygenator=aer_rec.use_oxygenator,
                notes=aer_rec.reason,
            )
            scenario.add_aeration_plan(aer_plan)

        if prob_rec.recommended:
            prob_plan = ProbioticsPlan(
                plan_id=f"prob_{scenario_id}",
                application_time=start_time + timedelta(hours=2),
                probiotics_type=prob_rec.probiotics_type,
                dosage=prob_rec.dosage,
                expected_efficiency=0.3,
                last_application_time=last_probiotics_time,
                minimum_interval_hours=24.0,
                notes=f"{prob_rec.reason}。{prob_rec.timing_hint}",
            )
            scenario.add_probiotics_plan(prob_plan)

        return scenario, recommendations

    def generate_comparison_scenarios(
        self,
        pond_config: PondConfig,
        current_state: PondState,
        source_water_params: Dict[str, float],
        risks: List[RiskAssessment],
        last_probiotics_time: Optional[datetime] = None,
    ) -> Dict[str, Tuple[Scenario, Dict[str, Any]]]:
        results: Dict[str, Tuple[Scenario, Dict[str, Any]]] = {}

        conservative_scenario, conservative_recs = self.generate_scenario(
            pond_config=pond_config,
            current_state=current_state,
            source_water_params=source_water_params,
            risks=risks,
            scenario_id="conservative",
            scenario_name="保守方案",
            last_probiotics_time=last_probiotics_time,
        )
        results["conservative"] = (conservative_scenario, conservative_recs)

        aggressive_state = current_state.model_copy()
        aggressive_source = source_water_params.copy()

        aggressive_source["salinity"] = current_state.salinity
        aggressive_source["ph"] = current_state.ph

        aggressive_scenario, aggressive_recs = self.generate_scenario(
            pond_config=pond_config,
            current_state=aggressive_state,
            source_water_params=aggressive_source,
            risks=risks,
            scenario_id="aggressive",
            scenario_name="积极方案",
            last_probiotics_time=last_probiotics_time,
        )

        if aggressive_recs["water_change"]["recommended"]:
            aggressive_recs["water_change"]["exchange_ratio"] = min(
                0.5,
                aggressive_recs["water_change"]["exchange_ratio"] * 1.5
            )

        results["aggressive"] = (aggressive_scenario, aggressive_recs)

        return results
