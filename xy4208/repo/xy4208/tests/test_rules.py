import pytest
from datetime import datetime
from water_quality_simulator.models import (
    PondConfig,
    PondState,
    ThresholdParams,
    Scenario,
    WaterChangePlan,
    AerationPlan,
    ProbioticsPlan,
    RiskType,
    RiskLevel,
)
from water_quality_simulator.rules import RiskEngine, RecommendationEngine
from water_quality_simulator.models.report import RiskAssessment


class TestRiskEngine:
    def test_create_risk_engine(self):
        thresholds = ThresholdParams()
        engine = RiskEngine(thresholds)
        assert engine is not None

    def test_check_ammonia_risk_warning(self):
        thresholds = ThresholdParams(
            ammonia_nitrogen_warning=0.5,
            ammonia_nitrogen_danger=1.0,
        )
        engine = RiskEngine(thresholds)
        
        risks = engine.check_ammonia_risk(0.6)
        
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.AMMONIA_HIGH
        assert risks[0].risk_level == RiskLevel.WARNING

    def test_check_ammonia_risk_critical(self):
        thresholds = ThresholdParams(
            ammonia_nitrogen_warning=0.5,
            ammonia_nitrogen_danger=1.0,
        )
        engine = RiskEngine(thresholds)
        
        risks = engine.check_ammonia_risk(1.2)
        
        assert len(risks) == 1
        assert risks[0].risk_level == RiskLevel.CRITICAL

    def test_check_ammonia_risk_safe(self):
        thresholds = ThresholdParams()
        engine = RiskEngine(thresholds)
        
        risks = engine.check_ammonia_risk(0.3)
        
        assert len(risks) == 0

    def test_check_nitrite_risk(self):
        thresholds = ThresholdParams(
            nitrite_warning=0.15,
            nitrite_danger=0.3,
        )
        engine = RiskEngine(thresholds)
        
        risks = engine.check_nitrite_risk(0.2)
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.NITRITE_HIGH
        
        risks = engine.check_nitrite_risk(0.4)
        assert len(risks) == 1
        assert risks[0].risk_level == RiskLevel.CRITICAL

    def test_check_ph_range(self):
        thresholds = ThresholdParams(ph_min=7.0, ph_max=8.5)
        engine = RiskEngine(thresholds)
        
        risks_low = engine.check_ph_range(6.5)
        assert len(risks_low) == 1
        assert risks_low[0].risk_type == RiskType.PH_OUT_OF_RANGE
        
        risks_high = engine.check_ph_range(9.0)
        assert len(risks_high) == 1
        
        risks_ok = engine.check_ph_range(8.0)
        assert len(risks_ok) == 0

    def test_check_do_risk(self):
        thresholds = ThresholdParams(
            do_min=4.0,
            do_critical=2.0,
        )
        engine = RiskEngine(thresholds)
        
        risks_warning = engine.check_do_risk(3.5)
        assert len(risks_warning) == 1
        assert risks_warning[0].risk_level == RiskLevel.WARNING
        
        risks_critical = engine.check_do_risk(1.5)
        assert len(risks_critical) == 1
        assert risks_critical[0].risk_level == RiskLevel.CRITICAL

    def test_check_temperature_risk(self):
        thresholds = ThresholdParams()
        engine = RiskEngine(thresholds)
        
        risks_low = engine.check_temperature_risk(15.0)
        assert len(risks_low) == 1
        
        risks_high = engine.check_temperature_risk(35.0)
        assert len(risks_high) == 1
        
        risks_ok = engine.check_temperature_risk(28.0)
        assert len(risks_ok) == 0

    def test_check_salinity_gradient(self):
        thresholds = ThresholdParams(salinity_gradient=2.0)
        engine = RiskEngine(thresholds)
        
        risks = engine.check_salinity_gradient(25.0, 28.0)
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.SALINITY_GRADIENT
        
        risks_ok = engine.check_salinity_gradient(25.0, 26.0)
        assert len(risks_ok) == 0

    def test_check_initial_state_risks(self):
        thresholds = ThresholdParams()
        engine = RiskEngine(thresholds)
        
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        
        risks = engine.check_initial_state_risks(state)
        
        assert len(risks) >= 2


class TestRecommendationEngine:
    def test_create_recommendation_engine(self):
        thresholds = ThresholdParams()
        engine = RecommendationEngine(thresholds)
        assert engine is not None

    def test_generate_scenario(self):
        thresholds = ThresholdParams()
        engine = RecommendationEngine(thresholds)
        
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        
        source_water = {
            "ph": 8.0,
            "salinity": 25.0,
            "ammonia_nitrogen": 0.02,
            "nitrite": 0.01,
        }
        
        risks = [
            RiskAssessment(
                risk_id="r1",
                risk_type=RiskType.AMMONIA_HIGH,
                risk_level=RiskLevel.WARNING,
                description="氨氮超标",
                current_value=0.65,
                threshold_value=0.5,
            ),
            RiskAssessment(
                risk_id="r2",
                risk_type=RiskType.NITRITE_HIGH,
                risk_level=RiskLevel.DANGER,
                description="亚硝酸盐超标",
                current_value=0.22,
                threshold_value=0.15,
            ),
        ]
        
        scenario, recommendations = engine.generate_scenario(
            pond_config=config,
            current_state=state,
            source_water_params=source_water,
            risks=risks,
            scenario_id="test_001",
            scenario_name="测试方案",
        )
        
        assert scenario is not None
        assert scenario.scenario_id == "test_001"
        assert "water_change" in recommendations
        assert "aeration" in recommendations
        assert "probiotics" in recommendations

    def test_generate_scenario_no_risks(self):
        thresholds = ThresholdParams()
        engine = RecommendationEngine(thresholds)
        
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.0,
            ph=8.0,
            ammonia_nitrogen=0.3,
            nitrite=0.1,
            salinity=25.0,
            dissolved_oxygen=6.0,
        )
        
        source_water = {
            "ph": 8.0,
            "salinity": 25.0,
            "ammonia_nitrogen": 0.02,
            "nitrite": 0.01,
        }
        
        scenario, recommendations = engine.generate_scenario(
            pond_config=config,
            current_state=state,
            source_water_params=source_water,
            risks=[],
            scenario_id="test_001",
            scenario_name="测试方案",
        )
        
        assert scenario is not None
        assert recommendations.get("water_change", {}).get("recommended") is False
        assert recommendations.get("probiotics", {}).get("recommended") is False
