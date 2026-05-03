from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from kiln_analyzer.models import (
    BatchRiskAssessment,
    DefectRecord,
    HeatIntegral,
    KilnLoad,
    LayerRisk,
    PhaseDeviation,
    PhaseType,
    RiskLevel,
)


@dataclass
class CriticalThreshold:
    name: str
    category: str
    warning_level: float
    critical_level: float
    phase_type: Optional[PhaseType] = None


@dataclass
class LayerRiskRule:
    name: str
    description: str
    risk_level: RiskLevel
    weight: float
    evaluation_func: Callable[[Dict[str, Any]], bool]

    def evaluate(self, context: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        try:
            result = self.evaluation_func(context)
            if result:
                return True, self.description
            return False, None
        except Exception:
            return False, None


DEFAULT_THRESHOLDS = [
    CriticalThreshold(
        name="heating_rate_overshoot",
        category="rate",
        warning_level=1.5,
        critical_level=2.5,
        phase_type=PhaseType.HEATING,
    ),
    CriticalThreshold(
        name="heating_rate_undershoot",
        category="rate",
        warning_level=-1.0,
        critical_level=-2.0,
        phase_type=PhaseType.HEATING,
    ),
    CriticalThreshold(
        name="cooling_rate_too_fast",
        category="rate",
        warning_level=-2.0,
        critical_level=-3.5,
        phase_type=PhaseType.COOLING,
    ),
    CriticalThreshold(
        name="temperature_deviation",
        category="temp",
        warning_level=10.0,
        critical_level=20.0,
    ),
    CriticalThreshold(
        name="hold_time_shortfall",
        category="holding",
        warning_level=300.0,
        critical_level=600.0,
    ),
    CriticalThreshold(
        name="heat_integral_low",
        category="heat",
        warning_level=-10.0,
        critical_level=-20.0,
    ),
]


class RiskAssessmentEngine:
    def __init__(
        self,
        thresholds: Optional[List[CriticalThreshold]] = None,
        custom_rules: Optional[List[LayerRiskRule]] = None,
    ):
        self.thresholds = thresholds or DEFAULT_THRESHOLDS
        self.custom_rules = custom_rules or []
        self._init_default_rules()

    def _init_default_rules(self) -> None:
        self.default_rules: List[LayerRiskRule] = [
            LayerRiskRule(
                name="high_temp_deviation",
                description="温度偏差超过警戒线",
                risk_level=RiskLevel.MEDIUM,
                weight=1.0,
                evaluation_func=lambda ctx: abs(ctx.get("avg_deviation", 0.0)) > 10.0,
            ),
            LayerRiskRule(
                name="critical_temp_deviation",
                description="温度偏差超过临界线",
                risk_level=RiskLevel.HIGH,
                weight=2.0,
                evaluation_func=lambda ctx: abs(ctx.get("avg_deviation", 0.0)) > 20.0,
            ),
            LayerRiskRule(
                name="heating_overshoot",
                description="升温速率过快",
                risk_level=RiskLevel.HIGH,
                weight=1.5,
                evaluation_func=lambda ctx: ctx.get("rate_deviation", 0.0) > 1.5
                and ctx.get("phase_type") == PhaseType.HEATING,
            ),
            LayerRiskRule(
                name="heating_undershoot",
                description="升温速率过慢",
                risk_level=RiskLevel.MEDIUM,
                weight=1.0,
                evaluation_func=lambda ctx: ctx.get("rate_deviation", 0.0) < -1.0
                and ctx.get("phase_type") == PhaseType.HEATING,
            ),
            LayerRiskRule(
                name="cooling_too_fast",
                description="冷却速率过快，可能导致釉裂",
                risk_level=RiskLevel.CRITICAL,
                weight=2.5,
                evaluation_func=lambda ctx: abs(ctx.get("rate_deviation", 0.0)) > 2.0
                and ctx.get("phase_type") == PhaseType.COOLING,
            ),
            LayerRiskRule(
                name="holding_insufficient",
                description="保温时间不足，釉面可能未充分熔融",
                risk_level=RiskLevel.HIGH,
                weight=1.5,
                evaluation_func=lambda ctx: ctx.get("hold_deviation", 0.0) > 300.0,
            ),
            LayerRiskRule(
                name="heat_integral_low",
                description="热量积分偏低，可能欠烧",
                risk_level=RiskLevel.MEDIUM,
                weight=1.0,
                evaluation_func=lambda ctx: (ctx.get("heat_deviation_percent") or 0.0) < -10.0,
            ),
            LayerRiskRule(
                name="heat_integral_high",
                description="热量积分偏高，可能过烧",
                risk_level=RiskLevel.MEDIUM,
                weight=1.0,
                evaluation_func=lambda ctx: (ctx.get("heat_deviation_percent") or 0.0) > 15.0,
            ),
            LayerRiskRule(
                name="layer_thermal_lag",
                description="该层存在明显热滞后",
                risk_level=RiskLevel.MEDIUM,
                weight=1.0,
                evaluation_func=lambda ctx: (
                    ctx.get("layer_offset_from_avg", 0.0) < -10.0
                    or ctx.get("layer_offset_from_avg", 0.0) > 10.0
                ),
            ),
            LayerRiskRule(
                name="defect_correlation",
                description="该层存在瑕疵记录",
                risk_level=RiskLevel.HIGH,
                weight=2.0,
                evaluation_func=lambda ctx: ctx.get("has_defects", False),
            ),
        ]

    def assess_batch(
        self,
        deviations: List[PhaseDeviation],
        integrals: List[HeatIntegral],
        kiln_load: Optional[KilnLoad] = None,
        defects: Optional[List[DefectRecord]] = None,
    ) -> BatchRiskAssessment:
        layer_risks: Dict[str, LayerRisk] = {}
        all_critical_factors: List[str] = []
        all_suggestions: List[str] = []

        all_layers = self._collect_all_layers(deviations, integrals)

        for layer_name in all_layers:
            risk = self._assess_single_layer(
                layer_name, deviations, integrals, kiln_load, defects
            )
            layer_risks[layer_name] = risk

            for factor in risk.risk_factors:
                if factor not in all_critical_factors:
                    all_critical_factors.append(factor)

            if risk.suggestion and risk.suggestion not in all_suggestions:
                all_suggestions.append(risk.suggestion)

        overall_risk, overall_score = self._calculate_overall_risk(layer_risks)

        if overall_score > 50:
            all_suggestions.insert(0, "建议重新检查烧成曲线参数并调整")
        elif overall_score > 30:
            all_suggestions.insert(0, "建议在下次烧成中密切关注关键参数")

        return BatchRiskAssessment(
            overall_risk=overall_risk,
            overall_score=overall_score,
            layer_risks=layer_risks,
            critical_factors=all_critical_factors,
            suggestions=all_suggestions,
        )

    def _collect_all_layers(
        self,
        deviations: List[PhaseDeviation],
        integrals: List[HeatIntegral],
    ) -> List[str]:
        layers: set = set()

        for dev in deviations:
            for layer_name in dev.avg_temp_deviation.keys():
                layers.add(layer_name)

        for integral in integrals:
            for layer_name in integral.heat_by_layer.keys():
                layers.add(layer_name)

        return sorted(layers)

    def _assess_single_layer(
        self,
        layer_name: str,
        deviations: List[PhaseDeviation],
        integrals: List[HeatIntegral],
        kiln_load: Optional[KilnLoad],
        defects: Optional[List[DefectRecord]],
    ) -> LayerRisk:
        risk_score = 0.0
        risk_factors: List[str] = []
        suggestions: List[str] = []

        all_rules = self.default_rules + self.custom_rules

        avg_deviation = self._get_layer_avg_deviation(layer_name, deviations)
        max_deviation = self._get_layer_max_deviation(layer_name, deviations)

        for phase_dev in deviations:
            layer_rate_deviation = (phase_dev.rate_deviation or {}).get(
                layer_name, 0.0
            )
            layer_avg_dev = phase_dev.avg_temp_deviation.get(layer_name, 0.0)

            context = {
                "layer_name": layer_name,
                "phase_type": phase_dev.phase_type,
                "phase_name": phase_dev.phase_name,
                "avg_deviation": layer_avg_dev,
                "rate_deviation": layer_rate_deviation,
                "hold_deviation": phase_dev.hold_deviation_seconds or 0.0,
                "overall_avg_deviation": avg_deviation,
                "max_deviation": max_deviation,
            }

            for integral in integrals:
                if integral.phase_name == phase_dev.phase_name:
                    context["heat_deviation_percent"] = integral.deviation_percent
                    break

            layer_offset = self._calculate_layer_offset(layer_name, phase_dev)
            context["layer_offset_from_avg"] = layer_offset

            layer_defects = []
            if defects:
                layer_defects = [d for d in defects if d.layer_name == layer_name]
                context["has_defects"] = len(layer_defects) > 0
                context["defect_count"] = len(layer_defects)

            for rule in all_rules:
                triggered, description = rule.evaluate(context)
                if triggered and description and description not in risk_factors:
                    risk_factors.append(description)
                    risk_score += rule.weight * self._risk_level_to_score(
                        rule.risk_level
                    )

        if max_deviation > 10.0:
            suggestions.append(f"调整{layer_name}层热电偶位置或检查加热元件")
        if max_deviation > 20.0:
            suggestions.insert(0, f"紧急：{layer_name}层温度偏差过大，需检修窑炉")

        return LayerRisk(
            layer_name=layer_name,
            risk_level=self._score_to_risk_level(risk_score),
            risk_score=risk_score,
            risk_factors=risk_factors,
            suggestion="; ".join(suggestions) if suggestions else None,
        )

    def _get_layer_avg_deviation(
        self, layer_name: str, deviations: List[PhaseDeviation]
    ) -> float:
        total = 0.0
        count = 0
        for dev in deviations:
            if layer_name in dev.avg_temp_deviation:
                total += abs(dev.avg_temp_deviation[layer_name])
                count += 1
        return total / count if count > 0 else 0.0

    def _get_layer_max_deviation(
        self, layer_name: str, deviations: List[PhaseDeviation]
    ) -> float:
        max_dev = 0.0
        for dev in deviations:
            if layer_name in dev.max_temp_deviation:
                max_dev = max(max_dev, dev.max_temp_deviation[layer_name])
        return max_dev

    def _calculate_layer_offset(
        self, layer_name: str, phase_dev: PhaseDeviation
    ) -> float:
        if not phase_dev.avg_temp_deviation:
            return 0.0

        all_devs = list(phase_dev.avg_temp_deviation.values())
        if not all_devs:
            return 0.0

        avg_dev = sum(all_devs) / len(all_devs)
        layer_dev = phase_dev.avg_temp_deviation.get(layer_name, avg_dev)

        return layer_dev - avg_dev

    def _risk_level_to_score(self, level: RiskLevel) -> float:
        mapping = {
            RiskLevel.LOW: 1.0,
            RiskLevel.MEDIUM: 3.0,
            RiskLevel.HIGH: 7.0,
            RiskLevel.CRITICAL: 10.0,
        }
        return mapping.get(level, 1.0)

    def _score_to_risk_level(self, score: float) -> RiskLevel:
        if score >= 20.0:
            return RiskLevel.CRITICAL
        elif score >= 10.0:
            return RiskLevel.HIGH
        elif score >= 5.0:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _calculate_overall_risk(
        self, layer_risks: Dict[str, LayerRisk]
    ) -> Tuple[RiskLevel, float]:
        if not layer_risks:
            return RiskLevel.LOW, 0.0

        total_score = sum(risk.risk_score for risk in layer_risks.values())
        avg_score = total_score / len(layer_risks)

        max_risk = RiskLevel.LOW
        for risk in layer_risks.values():
            if self._risk_level_to_score(risk.risk_level) > self._risk_level_to_score(
                max_risk
            ):
                max_risk = risk.risk_level

        if max_risk == RiskLevel.CRITICAL:
            overall = RiskLevel.CRITICAL
        elif max_risk == RiskLevel.HIGH and avg_score > 7.0:
            overall = RiskLevel.HIGH
        elif max_risk in [RiskLevel.HIGH, RiskLevel.MEDIUM]:
            overall = RiskLevel.MEDIUM
        else:
            overall = RiskLevel.LOW

        return overall, avg_score

    @staticmethod
    def format_risk_level(level: RiskLevel) -> str:
        format_map = {
            RiskLevel.LOW: "🟢 低风险",
            RiskLevel.MEDIUM: "🟡 中风险",
            RiskLevel.HIGH: "🟠 高风险",
            RiskLevel.CRITICAL: "🔴 极高风险",
        }
        return format_map.get(level, f"{level}")
