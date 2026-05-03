import pytest
from datetime import datetime
from water_quality_simulator.models import (
    PondConfig,
    PondState,
    WaterQualityParams,
    ThresholdParams,
    SimulationParams,
    Scenario,
    WaterChangePlan,
    AerationPlan,
    ProbioticsPlan,
    RiskAssessment,
    AnalysisReport,
    ComparisonReport,
)


class TestPondConfig:
    def test_create_valid_pond_config(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="南美白对虾育苗池",
            volume=100.0,
            area=50.0,
            depth=2.0,
            species="南美白对虾",
            stage="仔虾期(P1-P5)",
            stocking_density=5000,
        )
        assert config.pond_id == "pond_001"
        assert config.volume == 100.0
        assert config.area == 50.0
        assert config.depth == 2.0

    def test_pond_config_default_values(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=50.0,
            area=25.0,
        )
        assert config.stocking_density == 1000
        assert config.notes == ""

    def test_pond_config_to_dict(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
            species="南美白对虾",
            stage="仔虾期",
            stocking_density=5000,
        )
        d = config.to_dict()
        assert d["pond_id"] == "pond_001"
        assert d["volume"] == 100.0
        assert d["species"] == "南美白对虾"


class TestPondState:
    def test_create_valid_pond_state(self):
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime(2026, 5, 3, 8, 0, 0),
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        assert state.pond_id == "pond_001"
        assert state.temperature == 28.5
        assert state.ph == 8.2
        assert state.ammonia_nitrogen == 0.65

    def test_pond_state_optional_fields(self):
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.0,
            ph=8.0,
            ammonia_nitrogen=0.5,
            nitrite=0.15,
            salinity=25.0,
            dissolved_oxygen=5.0,
        )
        assert state.turbidity is None
        assert state.alkalinity is None
        assert state.hardness is None

    def test_pond_state_to_dict(self):
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime(2026, 5, 3, 8, 0, 0),
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
            turbidity=35,
            alkalinity=120,
            hardness=350,
        )
        d = state.to_dict()
        assert d["pond_id"] == "pond_001"
        assert d["temperature"] == 28.5
        assert d["turbidity"] == 35
        assert "timestamp" in d


class TestWaterQualityParams:
    def test_create_water_quality_params(self):
        params = WaterQualityParams(
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        assert params.temperature == 28.5
        assert params.ph == 8.2
        assert params.ammonia_nitrogen == 0.65

    def test_water_quality_params_to_dict(self):
        params = WaterQualityParams(
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        d = params.to_dict()
        assert d["temperature"] == 28.5
        assert d["ph"] == 8.2


class TestThresholdParams:
    def test_default_thresholds(self):
        thresholds = ThresholdParams()
        assert thresholds.ammonia_nitrogen_warning == 0.5
        assert thresholds.ammonia_nitrogen_danger == 1.0
        assert thresholds.nitrite_warning == 0.15
        assert thresholds.nitrite_danger == 0.3
        assert thresholds.ph_min == 7.0
        assert thresholds.ph_max == 8.5
        assert thresholds.salinity_diff_warning == 2.0

    def test_custom_thresholds(self):
        thresholds = ThresholdParams(
            ammonia_nitrogen_warning=0.3,
            ammonia_nitrogen_danger=0.8,
            ph_min=6.5,
            ph_max=9.0,
        )
        assert thresholds.ammonia_nitrogen_warning == 0.3
        assert thresholds.ammonia_nitrogen_danger == 0.8
        assert thresholds.ph_min == 6.5
        assert thresholds.ph_max == 9.0


class TestSimulationParams:
    def test_default_simulation_params(self):
        params = SimulationParams()
        assert params.simulation_hours == 24
        assert params.time_step == 1.0
        assert params.feed_rate == 0.5
        assert params.feed_protein_content == 40.0

    def test_custom_simulation_params(self):
        params = SimulationParams(
            simulation_hours=48,
            time_step=0.5,
            feed_rate=1.0,
            aeration_rate=0.5,
            water_exchange_rate=0.2,
        )
        assert params.simulation_hours == 48
        assert params.time_step == 0.5
        assert params.feed_rate == 1.0
        assert params.aeration_rate == 0.5
        assert params.water_exchange_rate == 0.2


class TestScenario:
    def test_create_scenario_with_all_plans(self):
        water_change = WaterChangePlan(
            exchange_ratio=0.3,
            source_water_ph=8.0,
            source_water_salinity=25.0,
            timing="立即",
        )
        aeration = AerationPlan(
            intensity="中等",
            duration_hours=12,
            start_hour=0,
        )
        probiotics = ProbioticsPlan(
            probiotics_type="硝化细菌",
            dosage=10.0,
            application_hour=0,
        )
        scenario = Scenario(
            scenario_id="scenario_001",
            scenario_name="测试方案",
            water_change_plan=water_change,
            aeration_plan=aeration,
            probiotics_plan=probiotics,
        )
        assert scenario.scenario_id == "scenario_001"
        assert scenario.scenario_name == "测试方案"
        assert scenario.water_change_plan.exchange_ratio == 0.3
        assert scenario.aeration_plan.intensity == "中等"
        assert scenario.probiotics_plan.probiotics_type == "硝化细菌"

    def test_scenario_to_dict(self):
        scenario = Scenario(
            scenario_id="scenario_001",
            scenario_name="测试方案",
        )
        d = scenario.to_dict()
        assert d["scenario_id"] == "scenario_001"
        assert d["scenario_name"] == "测试方案"
        assert d["water_change_plan"] is None


class TestRiskAssessment:
    def test_create_risk_assessment(self):
        from water_quality_simulator.models.report import RiskType, RiskLevel
        
        risk = RiskAssessment(
            risk_id="risk_001",
            risk_type=RiskType.AMMONIA_EXCEEDANCE,
            risk_level=RiskLevel.WARNING,
            description="氨氮超过警告阈值",
            current_value=0.6,
            threshold_value=0.5,
            affected_parameter="ammonia_nitrogen",
        )
        assert risk.risk_id == "risk_001"
        assert risk.risk_type == RiskType.AMMONIA_EXCEEDANCE
        assert risk.risk_level == RiskLevel.WARNING
        assert risk.current_value == 0.6

    def test_risk_level_ordering(self):
        from water_quality_simulator.models.report import RiskLevel
        
        assert RiskLevel.SAFE < RiskLevel.WARNING
        assert RiskLevel.WARNING < RiskLevel.DANGER
        assert RiskLevel.DANGER < RiskLevel.CRITICAL


class TestAnalysisReport:
    def test_create_analysis_report(self):
        from water_quality_simulator.models.report import RiskType, RiskLevel
        
        state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.0,
            ph=8.0,
            ammonia_nitrogen=0.5,
            nitrite=0.15,
            salinity=25.0,
            dissolved_oxygen=5.0,
        )
        
        risk = RiskAssessment(
            risk_id="risk_001",
            risk_type=RiskType.AMMONIA_EXCEEDANCE,
            risk_level=RiskLevel.WARNING,
            description="氨氮超过警告阈值",
            current_value=0.6,
            threshold_value=0.5,
            affected_parameter="ammonia_nitrogen",
        )
        
        report = AnalysisReport(
            report_id="report_001",
            pond_id="pond_001",
            scenario_id="scenario_001",
            initial_state=state.to_dict(),
            risks=[risk],
            recommendations={},
            summary="测试报告",
        )
        
        assert report.report_id == "report_001"
        assert report.pond_id == "pond_001"
        assert report.get_highest_risk_level() == RiskLevel.WARNING

    def test_analysis_report_no_risks(self):
        from water_quality_simulator.models.report import RiskLevel
        
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
        
        report = AnalysisReport(
            report_id="report_001",
            pond_id="pond_001",
            scenario_id="scenario_001",
            initial_state=state.to_dict(),
            risks=[],
            recommendations={},
            summary="测试报告",
        )
        
        assert report.get_highest_risk_level() == RiskLevel.SAFE


class TestComparisonReport:
    def test_create_comparison_report(self):
        from water_quality_simulator.models.report import RiskLevel
        
        report = ComparisonReport(
            comparison_id="comp_001",
            baseline_scenario_name="方案A",
            comparison_scenario_name="方案B",
            metrics={
                "baseline": {"ammonia_nitrogen_final": 0.8},
                "comparison": {"ammonia_nitrogen_final": 0.4},
            },
            key_differences=["方案B氨氮降低更明显"],
            recommendation="推荐方案B",
            recommendation_confidence=0.85,
        )
        
        assert report.comparison_id == "comp_001"
        assert report.baseline_scenario_name == "方案A"
        assert report.comparison_scenario_name == "方案B"
        assert report.recommendation == "推荐方案B"
