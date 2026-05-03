from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
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
    AnalysisReport,
    ComparisonReport,
    RiskLevel,
    RiskAssessment,
)
from ..simulation import WaterQualitySimulator
from ..rules import RiskEngine


@dataclass
class ScenarioMetrics:
    final_ammonia: float
    final_nitrite: float
    final_ph: float
    final_do: float
    final_salinity: float
    max_ammonia: float
    max_nitrite: float
    min_do: float
    ph_volatility: float
    ammonia_improvement: float
    nitrite_improvement: float
    risk_count: int
    critical_risk_count: int
    danger_risk_count: int
    water_exchange_ratio: float
    probiotics_dosage: float
    aeration_hours: float


class ScenarioComparison:
    def __init__(
        self,
        pond_config: PondConfig,
        thresholds: Optional[ThresholdParams] = None,
    ):
        self.pond_config = pond_config
        self.thresholds = thresholds or ThresholdParams()
        self.risk_engine = RiskEngine(self.thresholds)

    def calculate_metrics(
        self,
        initial_state: PondState,
        simulation_result: SimulationResult,
        scenario: Optional[Scenario] = None,
        risks: Optional[List[RiskAssessment]] = None,
    ) -> ScenarioMetrics:
        final_state = simulation_result.get_final_state()

        initial_ammonia = initial_state.ammonia_nitrogen
        initial_nitrite = initial_state.nitrite

        final_ammonia = final_state.get("ammonia_nitrogen", 0)
        final_nitrite = final_state.get("nitrite", 0)

        ammonia_improvement = (
            (initial_ammonia - final_ammonia) / initial_ammonia * 100
            if initial_ammonia > 0 else 0
        )
        nitrite_improvement = (
            (initial_nitrite - final_nitrite) / initial_nitrite * 100
            if initial_nitrite > 0 else 0
        )

        max_ammonia = max(simulation_result.ammonia_nitrogens)
        max_nitrite = max(simulation_result.nitrites)
        min_do = min(simulation_result.dissolved_oxygens)

        ph_values = simulation_result.ph_values
        ph_mean = sum(ph_values) / len(ph_values)
        ph_variance = sum((x - ph_mean) ** 2 for x in ph_values) / len(ph_values)
        ph_volatility = math.sqrt(ph_variance)

        risk_count = len(risks) if risks else 0
        critical_risk_count = (
            sum(1 for r in risks if r.risk_level == RiskLevel.CRITICAL)
            if risks else 0
        )
        danger_risk_count = (
            sum(1 for r in risks if r.risk_level == RiskLevel.DANGER)
            if risks else 0
        )

        water_exchange_ratio = scenario.get_total_water_exchange() if scenario else 0
        probiotics_dosage = sum(p.dosage for p in scenario.probiotics_plans) if scenario else 0
        aeration_hours = sum(p.duration_hours for p in scenario.aeration_plans) if scenario else 0

        return ScenarioMetrics(
            final_ammonia=final_ammonia,
            final_nitrite=final_nitrite,
            final_ph=final_state.get("ph", 0),
            final_do=final_state.get("dissolved_oxygen", 0),
            final_salinity=final_state.get("salinity", 0),
            max_ammonia=max_ammonia,
            max_nitrite=max_nitrite,
            min_do=min_do,
            ph_volatility=ph_volatility,
            ammonia_improvement=ammonia_improvement,
            nitrite_improvement=nitrite_improvement,
            risk_count=risk_count,
            critical_risk_count=critical_risk_count,
            danger_risk_count=danger_risk_count,
            water_exchange_ratio=water_exchange_ratio,
            probiotics_dosage=probiotics_dosage,
            aeration_hours=aeration_hours,
        )

    def compare_metrics(
        self,
        baseline_metrics: ScenarioMetrics,
        comparison_metrics: ScenarioMetrics,
    ) -> List[Dict[str, Any]]:
        differences: List[Dict[str, Any]] = []

        ammonia_diff = comparison_metrics.final_ammonia - baseline_metrics.final_ammonia
        if abs(ammonia_diff) > 0.01:
            direction = "更低" if ammonia_diff < 0 else "更高"
            differences.append({
                "metric": "final_ammonia",
                "name": "最终氨氮",
                "baseline_value": round(baseline_metrics.final_ammonia, 4),
                "comparison_value": round(comparison_metrics.final_ammonia, 4),
                "difference": round(ammonia_diff, 4),
                "percentage": round(ammonia_diff / baseline_metrics.final_ammonia * 100, 1)
                if baseline_metrics.final_ammonia > 0 else 0,
                "direction": direction,
                "impact": "positive" if ammonia_diff < 0 else "negative",
            })

        nitrite_diff = comparison_metrics.final_nitrite - baseline_metrics.final_nitrite
        if abs(nitrite_diff) > 0.001:
            direction = "更低" if nitrite_diff < 0 else "更高"
            differences.append({
                "metric": "final_nitrite",
                "name": "最终亚硝酸盐",
                "baseline_value": round(baseline_metrics.final_nitrite, 4),
                "comparison_value": round(comparison_metrics.final_nitrite, 4),
                "difference": round(nitrite_diff, 4),
                "percentage": round(nitrite_diff / baseline_metrics.final_nitrite * 100, 1)
                if baseline_metrics.final_nitrite > 0 else 0,
                "direction": direction,
                "impact": "positive" if nitrite_diff < 0 else "negative",
            })

        do_diff = comparison_metrics.min_do - baseline_metrics.min_do
        if abs(do_diff) > 0.1:
            direction = "更高" if do_diff > 0 else "更低"
            differences.append({
                "metric": "min_do",
                "name": "最低溶解氧",
                "baseline_value": round(baseline_metrics.min_do, 2),
                "comparison_value": round(comparison_metrics.min_do, 2),
                "difference": round(do_diff, 2),
                "percentage": round(do_diff / baseline_metrics.min_do * 100, 1)
                if baseline_metrics.min_do > 0 else 0,
                "direction": direction,
                "impact": "positive" if do_diff > 0 else "negative",
            })

        ph_volatility_diff = comparison_metrics.ph_volatility - baseline_metrics.ph_volatility
        if abs(ph_volatility_diff) > 0.02:
            direction = "更稳定" if ph_volatility_diff < 0 else "更波动"
            differences.append({
                "metric": "ph_volatility",
                "name": "pH波动",
                "baseline_value": round(baseline_metrics.ph_volatility, 3),
                "comparison_value": round(comparison_metrics.ph_volatility, 3),
                "difference": round(ph_volatility_diff, 3),
                "percentage": round(ph_volatility_diff / baseline_metrics.ph_volatility * 100, 1)
                if baseline_metrics.ph_volatility > 0 else 0,
                "direction": direction,
                "impact": "positive" if ph_volatility_diff < 0 else "negative",
            })

        risk_diff = comparison_metrics.risk_count - baseline_metrics.risk_count
        if risk_diff != 0:
            direction = "减少" if risk_diff < 0 else "增加"
            differences.append({
                "metric": "risk_count",
                "name": "风险数量",
                "baseline_value": baseline_metrics.risk_count,
                "comparison_value": comparison_metrics.risk_count,
                "difference": risk_diff,
                "percentage": round(risk_diff / baseline_metrics.risk_count * 100, 1)
                if baseline_metrics.risk_count > 0 else 0,
                "direction": direction,
                "impact": "positive" if risk_diff < 0 else "negative",
            })

        critical_risk_diff = comparison_metrics.critical_risk_count - baseline_metrics.critical_risk_count
        if critical_risk_diff != 0:
            direction = "减少" if critical_risk_diff < 0 else "增加"
            differences.append({
                "metric": "critical_risk_count",
                "name": "临界风险数量",
                "baseline_value": baseline_metrics.critical_risk_count,
                "comparison_value": comparison_metrics.critical_risk_count,
                "difference": critical_risk_diff,
                "percentage": round(critical_risk_diff / baseline_metrics.critical_risk_count * 100, 1)
                if baseline_metrics.critical_risk_count > 0 else 0,
                "direction": direction,
                "impact": "positive" if critical_risk_diff < 0 else "negative",
            })

        water_exchange_diff = comparison_metrics.water_exchange_ratio - baseline_metrics.water_exchange_ratio
        if abs(water_exchange_diff) > 0.001:
            direction = "更多" if water_exchange_diff > 0 else "更少"
            differences.append({
                "metric": "water_exchange_ratio",
                "name": "换水比例",
                "baseline_value": round(baseline_metrics.water_exchange_ratio * 100, 1),
                "comparison_value": round(comparison_metrics.water_exchange_ratio * 100, 1),
                "difference": round(water_exchange_diff * 100, 1),
                "percentage": round(water_exchange_diff / baseline_metrics.water_exchange_ratio * 100, 1)
                if baseline_metrics.water_exchange_ratio > 0 else 0,
                "direction": direction,
                "unit": "%",
                "impact": "neutral",
            })

        return differences

    def calculate_score(
        self,
        metrics: ScenarioMetrics,
        weights: Optional[Dict[str, float]] = None,
    ) -> float:
        default_weights = {
            "final_ammonia": 0.25,
            "final_nitrite": 0.25,
            "min_do": 0.15,
            "ph_volatility": 0.1,
            "critical_risk_count": 0.15,
            "danger_risk_count": 0.1,
        }
        weights = weights or default_weights

        score = 0.0

        ammonia_score = max(0, 100 - metrics.final_ammonia * 100)
        score += ammonia_score * weights.get("final_ammonia", 0.25)

        nitrite_score = max(0, 100 - metrics.final_nitrite * 200)
        score += nitrite_score * weights.get("final_nitrite", 0.25)

        do_score = min(100, metrics.min_do * 10)
        score += do_score * weights.get("min_do", 0.15)

        ph_stability_score = max(0, 100 - metrics.ph_volatility * 100)
        score += ph_stability_score * weights.get("ph_volatility", 0.1)

        critical_risk_penalty = metrics.critical_risk_count * 30
        danger_risk_penalty = metrics.danger_risk_count * 15
        risk_score = max(0, 100 - critical_risk_penalty - danger_risk_penalty)
        score += risk_score * (weights.get("critical_risk_count", 0.15) + weights.get("danger_risk_count", 0.1))

        return round(score, 2)

    def compare_scenarios(
        self,
        initial_state: PondState,
        simulation_params: SimulationParams,
        baseline_scenario: Optional[Scenario],
        comparison_scenario: Scenario,
        baseline_report: Optional[AnalysisReport] = None,
        comparison_report: Optional[AnalysisReport] = None,
    ) -> ComparisonReport:
        simulator = WaterQualitySimulator(self.pond_config)

        if baseline_report is None and baseline_scenario is None:
            baseline_result = simulator.simulate_baseline(
                WaterQualityParams(
                    temperature=initial_state.temperature,
                    ph=initial_state.ph,
                    ammonia_nitrogen=initial_state.ammonia_nitrogen,
                    nitrite=initial_state.nitrite,
                    salinity=initial_state.salinity,
                    dissolved_oxygen=initial_state.dissolved_oxygen,
                ),
                simulation_params,
                initial_state.timestamp,
            )
            baseline_risks = self.risk_engine.check_complete_risks(
                initial_state, baseline_result
            )
        elif baseline_report:
            baseline_result = baseline_report.simulation_result
            baseline_risks = baseline_report.risks
        else:
            baseline_result = simulator.simulate_with_scenario(
                WaterQualityParams(
                    temperature=initial_state.temperature,
                    ph=initial_state.ph,
                    ammonia_nitrogen=initial_state.ammonia_nitrogen,
                    nitrite=initial_state.nitrite,
                    salinity=initial_state.salinity,
                    dissolved_oxygen=initial_state.dissolved_oxygen,
                ),
                simulation_params,
                baseline_scenario,
                initial_state.timestamp,
            )
            baseline_risks = self.risk_engine.check_complete_risks(
                initial_state, baseline_result, scenario=baseline_scenario
            )

        if comparison_report is None:
            comparison_result = simulator.simulate_with_scenario(
                WaterQualityParams(
                    temperature=initial_state.temperature,
                    ph=initial_state.ph,
                    ammonia_nitrogen=initial_state.ammonia_nitrogen,
                    nitrite=initial_state.nitrite,
                    salinity=initial_state.salinity,
                    dissolved_oxygen=initial_state.dissolved_oxygen,
                ),
                simulation_params,
                comparison_scenario,
                initial_state.timestamp,
            )
            comparison_risks = self.risk_engine.check_complete_risks(
                initial_state, comparison_result, scenario=comparison_scenario
            )
        else:
            comparison_result = comparison_report.simulation_result
            comparison_risks = comparison_report.risks

        baseline_metrics = self.calculate_metrics(
            initial_state, baseline_result, baseline_scenario, baseline_risks
        )
        comparison_metrics = self.calculate_metrics(
            initial_state, comparison_result, comparison_scenario, comparison_risks
        )

        key_differences = self.compare_metrics(baseline_metrics, comparison_metrics)

        baseline_score = self.calculate_score(baseline_metrics)
        comparison_score = self.calculate_score(comparison_metrics)

        baseline_summary = {
            "scenario_id": baseline_scenario.scenario_id if baseline_scenario else "baseline",
            "scenario_name": baseline_scenario.scenario_name if baseline_scenario else "基线方案(无干预)",
            "final_ammonia": round(baseline_metrics.final_ammonia, 4),
            "final_nitrite": round(baseline_metrics.final_nitrite, 4),
            "min_do": round(baseline_metrics.min_do, 2),
            "risk_count": baseline_metrics.risk_count,
            "critical_risk_count": baseline_metrics.critical_risk_count,
            "water_exchange_ratio": round(baseline_metrics.water_exchange_ratio * 100, 1),
            "score": baseline_score,
        }

        comparison_summary = {
            "scenario_id": comparison_scenario.scenario_id,
            "scenario_name": comparison_scenario.scenario_name,
            "final_ammonia": round(comparison_metrics.final_ammonia, 4),
            "final_nitrite": round(comparison_metrics.final_nitrite, 4),
            "min_do": round(comparison_metrics.min_do, 2),
            "risk_count": comparison_metrics.risk_count,
            "critical_risk_count": comparison_metrics.critical_risk_count,
            "water_exchange_ratio": round(comparison_metrics.water_exchange_ratio * 100, 1),
            "score": comparison_score,
        }

        if comparison_score > baseline_score + 5:
            recommendation = f"推荐选择【{comparison_scenario.scenario_name}】，综合评分更高({comparison_score}分 vs {baseline_score}分)，水质改善效果更显著。"
            preferred_scenario = comparison_scenario.scenario_id
        elif comparison_score < baseline_score - 5:
            recommendation = f"推荐选择【{baseline_summary['scenario_name']}】，综合评分更高({baseline_score}分 vs {comparison_score}分)。"
            preferred_scenario = baseline_summary["scenario_id"]
        else:
            positive_diffs = [d for d in key_differences if d.get("impact") == "positive"]
            if len(positive_diffs) >= 2:
                recommendation = f"两个方案评分相近({baseline_score}分 vs {comparison_score}分)，但【{comparison_scenario.scenario_name}】在关键指标上有更多改善，建议选择该方案。"
                preferred_scenario = comparison_scenario.scenario_id
            else:
                recommendation = f"两个方案评分相近({baseline_score}分 vs {comparison_score}分)，建议根据实际操作便利性选择。"
                preferred_scenario = None

        return ComparisonReport(
            comparison_id=f"comp_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            baseline_report_id=baseline_report.report_id if baseline_report else "baseline",
            comparison_report_id=comparison_report.report_id if comparison_report else comparison_scenario.scenario_id,
            baseline_summary=baseline_summary,
            comparison_summary=comparison_summary,
            key_differences=key_differences,
            recommendation=recommendation,
            preferred_scenario=preferred_scenario,
        )

    def generate_comparison_summary(
        self,
        comparison_report: ComparisonReport,
    ) -> Dict[str, Any]:
        return {
            "comparison_id": comparison_report.comparison_id,
            "generated_at": comparison_report.generated_at.isoformat(),
            "recommendation": comparison_report.recommendation,
            "preferred_scenario": comparison_report.preferred_scenario,
            "baseline": comparison_report.baseline_summary,
            "comparison": comparison_report.comparison_summary,
            "key_differences": comparison_report.key_differences,
        }
