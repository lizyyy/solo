from datetime import datetime
from typing import Dict, List
from unittest.mock import patch

import pytest

from kiln_analyzer.models import (
    DefectRecord,
    HeatIntegral,
    KilnLoad,
    KilnLayer,
    LayerRisk,
    PhaseDeviation,
    PhaseType,
    RiskLevel,
    ThermocoupleData,
)
from kiln_analyzer.rules.risk_engine import (
    CriticalThreshold,
    LayerRiskRule,
    RiskAssessmentEngine,
)


class TestLayerRiskRule:
    def test_evaluate_positive(self):
        rule = LayerRiskRule(
            name="test_rule",
            description="测试规则触发",
            risk_level=RiskLevel.MEDIUM,
            weight=1.0,
            evaluation_func=lambda ctx: ctx.get("value", 0) > 10,
        )

        triggered, description = rule.evaluate({"value": 15})
        assert triggered is True
        assert description == "测试规则触发"

    def test_evaluate_negative(self):
        rule = LayerRiskRule(
            name="test_rule",
            description="测试规则触发",
            risk_level=RiskLevel.MEDIUM,
            weight=1.0,
            evaluation_func=lambda ctx: ctx.get("value", 0) > 10,
        )

        triggered, description = rule.evaluate({"value": 5})
        assert triggered is False
        assert description is None

    def test_evaluate_exception(self):
        rule = LayerRiskRule(
            name="test_rule",
            description="测试规则",
            risk_level=RiskLevel.MEDIUM,
            weight=1.0,
            evaluation_func=lambda ctx: ctx["missing_key"] > 10,
        )

        triggered, description = rule.evaluate({})
        assert triggered is False


class TestRiskAssessmentEngine:
    def setup_method(self):
        self.engine = RiskAssessmentEngine()

    def _create_sample_deviations(self) -> List[PhaseDeviation]:
        return [
            PhaseDeviation(
                phase_name="升温阶段",
                phase_type=PhaseType.HEATING,
                target_temp_profile=[25, 100, 200],
                actual_temp_profile={
                    "top": [30, 110, 215],
                    "middle": [25, 100, 200],
                    "bottom": [20, 90, 185],
                },
                avg_temp_deviation={"top": 10.0, "middle": 0.0, "bottom": -10.0},
                max_temp_deviation={"top": 15.0, "middle": 0.0, "bottom": 15.0},
                rate_deviation={"top": 0.5, "middle": 0.0, "bottom": -0.5},
            ),
            PhaseDeviation(
                phase_name="冷却阶段",
                phase_type=PhaseType.COOLING,
                target_temp_profile=[1240, 1000, 850],
                actual_temp_profile={
                    "top": [1240, 980, 820],
                    "middle": [1240, 1000, 850],
                    "bottom": [1240, 1020, 880],
                },
                avg_temp_deviation={"top": -15.0, "middle": 0.0, "bottom": 15.0},
                max_temp_deviation={"top": 30.0, "middle": 0.0, "bottom": 30.0},
                rate_deviation={"top": -3.0, "middle": 0.0, "bottom": 2.0},
            ),
        ]

    def _create_sample_integrals(self) -> List[HeatIntegral]:
        return [
            HeatIntegral(
                phase_name="升温阶段",
                total_heat=500000.0,
                heat_by_layer={"top": 520000.0, "middle": 500000.0, "bottom": 480000.0},
                reference_heat=500000.0,
                deviation_percent=0.0,
            )
        ]

    def _create_sample_defects(self) -> List[DefectRecord]:
        return [
            DefectRecord(
                batch_id="TEST_001",
                piece_id="P001",
                layer_name="top",
                defect_type="釉裂",
                severity="轻微",
            )
        ]

    def test_assess_batch_basic(self):
        deviations = self._create_sample_deviations()
        integrals = self._create_sample_integrals()

        assessment = self.engine.assess_batch(deviations, integrals)

        assert assessment.overall_risk in [
            RiskLevel.LOW,
            RiskLevel.MEDIUM,
            RiskLevel.HIGH,
            RiskLevel.CRITICAL,
        ]
        assert len(assessment.layer_risks) > 0
        assert "top" in assessment.layer_risks
        assert "middle" in assessment.layer_risks
        assert "bottom" in assessment.layer_risks

    def test_assess_batch_with_defects(self):
        deviations = self._create_sample_deviations()
        integrals = self._create_sample_integrals()
        defects = self._create_sample_defects()

        assessment = self.engine.assess_batch(deviations, integrals, defects=defects)

        assert "top" in assessment.layer_risks
        top_risk = assessment.layer_risks["top"]
        assert "该层存在瑕疵记录" in top_risk.risk_factors

    def test_collect_all_layers(self):
        deviations = self._create_sample_deviations()
        integrals = self._create_sample_integrals()

        layers = self.engine._collect_all_layers(deviations, integrals)

        assert "top" in layers
        assert "middle" in layers
        assert "bottom" in layers

    def test_risk_level_to_score(self):
        assert self.engine._risk_level_to_score(RiskLevel.LOW) == 1.0
        assert self.engine._risk_level_to_score(RiskLevel.MEDIUM) == 3.0
        assert self.engine._risk_level_to_score(RiskLevel.HIGH) == 7.0
        assert self.engine._risk_level_to_score(RiskLevel.CRITICAL) == 10.0

    def test_score_to_risk_level(self):
        assert self.engine._score_to_risk_level(0.0) == RiskLevel.LOW
        assert self.engine._score_to_risk_level(5.0) == RiskLevel.MEDIUM
        assert self.engine._score_to_risk_level(10.0) == RiskLevel.HIGH
        assert self.engine._score_to_risk_level(20.0) == RiskLevel.CRITICAL

    def test_format_risk_level(self):
        formatted = RiskAssessmentEngine.format_risk_level(RiskLevel.HIGH)
        assert "高风险" in formatted
        assert "🟠" in formatted

    def test_custom_rules(self):
        custom_rule = LayerRiskRule(
            name="custom_rule",
            description="自定义测试规则",
            risk_level=RiskLevel.CRITICAL,
            weight=5.0,
            evaluation_func=lambda ctx: True,
        )

        engine_with_custom = RiskAssessmentEngine(custom_rules=[custom_rule])
        deviations = self._create_sample_deviations()
        integrals = self._create_sample_integrals()

        assessment = engine_with_custom.assess_batch(deviations, integrals)

        assert assessment.overall_score > 0

    def test_get_layer_avg_deviation(self):
        deviations = self._create_sample_deviations()

        avg_deviation = self.engine._get_layer_avg_deviation("top", deviations)

        assert avg_deviation > 0

    def test_get_layer_max_deviation(self):
        deviations = self._create_sample_deviations()

        max_deviation = self.engine._get_layer_max_deviation("top", deviations)

        assert max_deviation == 30.0

    def test_calculate_layer_offset(self):
        deviations = self._create_sample_deviations()

        offset = self.engine._calculate_layer_offset("top", deviations[0])

        assert offset > 0
