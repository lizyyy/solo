import pytest
import tempfile
import json
from pathlib import Path
from datetime import datetime
from water_quality_simulator.models import (
    PondConfig,
    PondState,
    WaterQualityParams,
    SimulationParams,
    ThresholdParams,
    Scenario,
    WaterChangePlan,
    AerationPlan,
    AnalysisReport,
    ComparisonReport,
)
from water_quality_simulator.comparison import ScenarioComparison
from water_quality_simulator.exporter import MarkdownExporter, CSVExporter, JSONExporter


class TestScenarioComparison:
    def test_create_comparison(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        thresholds = ThresholdParams()
        
        comparator = ScenarioComparison(config, thresholds)
        assert comparator is not None

    def test_calculate_scenario_metrics(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        thresholds = ThresholdParams()
        comparator = ScenarioComparison(config, thresholds)
        
        time_series = [
            {"hour": 0, "ammonia_nitrogen": 0.6, "nitrite": 0.2},
            {"hour": 12, "ammonia_nitrogen": 0.5, "nitrite": 0.18},
            {"hour": 24, "ammonia_nitrogen": 0.4, "nitrite": 0.15},
        ]
        
        from water_quality_simulator.simulation.simulator import SimulationResult
        
        class MockResult:
            def __init__(self):
                self.time_series = time_series
            
            def get_final_state(self):
                return self.time_series[-1]
            
            def get_statistics(self):
                return {
                    "ammonia_nitrogen": {"min": 0.4, "max": 0.6, "mean": 0.5, "final": 0.4, "change": -0.2},
                    "nitrite": {"min": 0.15, "max": 0.2, "mean": 0.177, "final": 0.15, "change": -0.05},
                    "dissolved_oxygen": {"min": 5.0, "max": 5.0, "mean": 5.0, "final": 5.0, "change": 0},
                }
        
        mock_result = MockResult()
        
        metrics = comparator._calculate_scenario_metrics(mock_result)
        
        assert "ammonia_nitrogen_final" in metrics
        assert "nitrite_final" in metrics
        assert "ammonia_nitrogen_change" in metrics
        assert "nitrite_change" in metrics

    def test_compare_scenarios(self):
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        thresholds = ThresholdParams()
        comparator = ScenarioComparison(config, thresholds)
        
        initial_state = PondState(
            pond_id="pond_001",
            timestamp=datetime.now(),
            temperature=28.5,
            ph=8.2,
            ammonia_nitrogen=0.65,
            nitrite=0.22,
            salinity=25.0,
            dissolved_oxygen=5.2,
        )
        
        sim_params = SimulationParams(
            simulation_hours=24,
            time_step=1.0,
            feed_rate=0.5,
        )
        
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
        
        scenario = Scenario(
            scenario_id="scenario_001",
            scenario_name="测试方案",
            water_change_plan=water_change,
            aeration_plan=aeration,
        )
        
        report = comparator.compare_scenarios(
            initial_state=initial_state,
            simulation_params=sim_params,
            baseline_scenario=None,
            comparison_scenario=scenario,
        )
        
        assert report is not None
        assert report.comparison_id is not None
        assert "baseline" in report.metrics
        assert "comparison" in report.metrics
        assert len(report.key_differences) > 0


class TestMarkdownExporter:
    def test_create_exporter(self):
        exporter = MarkdownExporter()
        assert exporter is not None

    def test_export_analysis_report(self):
        exporter = MarkdownExporter()
        
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
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
        
        scenario = Scenario(
            scenario_id="scenario_001",
            scenario_name="测试方案",
        )
        
        class MockSimulationResult:
            def __init__(self):
                self.time_series = []
            
            def get_statistics(self):
                return {
                    "ammonia_nitrogen": {"final": 0.4, "change": -0.25},
                    "nitrite": {"final": 0.15, "change": -0.07},
                    "ph": {"final": 8.1, "change": -0.1},
                    "dissolved_oxygen": {"final": 5.5, "change": 0.3},
                }
        
        report = AnalysisReport(
            report_id="report_001",
            pond_id="pond_001",
            scenario_id="scenario_001",
            initial_state=state.to_dict(),
            simulation_result=MockSimulationResult(),
            risks=[],
            recommendations={
                "water_change": {"recommended": True, "exchange_ratio": 0.3, "reason": "氨氮超标"},
                "aeration": {"recommended": True, "intensity": "中等", "duration_hours": 12},
                "probiotics": {"recommended": True, "probiotics_type": "硝化细菌", "dosage": 10.0},
            },
            summary="测试报告",
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            temp_path = f.name
        
        try:
            result = exporter.export_analysis_report(
                temp_path, report, config, state, scenario
            )
            
            assert result is True
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            assert "测试池" in content
            assert "氨氮" in content
            assert "换水建议" in content
            assert "曝气建议" in content
            assert "补菌建议" in content
        finally:
            Path(temp_path).unlink()

    def test_export_comparison_report(self):
        exporter = MarkdownExporter()
        
        comparison_report = ComparisonReport(
            comparison_id="comp_001",
            baseline_scenario_name="方案A",
            comparison_scenario_name="方案B",
            metrics={
                "baseline": {"ammonia_nitrogen_final": 0.8, "nitrite_final": 0.3},
                "comparison": {"ammonia_nitrogen_final": 0.4, "nitrite_final": 0.15},
            },
            key_differences=["方案B氨氮降低更明显", "方案B亚硝酸盐更低"],
            recommendation="推荐方案B",
            recommendation_confidence=0.85,
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            temp_path = f.name
        
        try:
            result = exporter.export_comparison_report(temp_path, comparison_report)
            
            assert result is True
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            assert "方案A" in content
            assert "方案B" in content
            assert "推荐方案B" in content
        finally:
            Path(temp_path).unlink()


class TestCSVExporter:
    def test_create_exporter(self):
        exporter = CSVExporter()
        assert exporter is not None

    def test_export_simulation_curve(self):
        exporter = CSVExporter()
        
        class MockSimulationResult:
            def __init__(self):
                self.time_series = [
                    {
                        "hour": 0,
                        "timestamp": datetime(2026, 5, 3, 8, 0, 0),
                        "temperature": 28.5,
                        "ph": 8.2,
                        "ammonia_nitrogen": 0.65,
                        "nitrite": 0.22,
                        "salinity": 25.0,
                        "dissolved_oxygen": 5.2,
                    },
                    {
                        "hour": 12,
                        "timestamp": datetime(2026, 5, 3, 20, 0, 0),
                        "temperature": 28.0,
                        "ph": 8.1,
                        "ammonia_nitrogen": 0.55,
                        "nitrite": 0.20,
                        "salinity": 25.0,
                        "dissolved_oxygen": 5.0,
                    },
                    {
                        "hour": 24,
                        "timestamp": datetime(2026, 5, 4, 8, 0, 0),
                        "temperature": 27.5,
                        "ph": 8.0,
                        "ammonia_nitrogen": 0.45,
                        "nitrite": 0.18,
                        "salinity": 25.0,
                        "dissolved_oxygen": 5.5,
                    },
                ]
        
        mock_result = MockSimulationResult()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            temp_path = f.name
        
        try:
            result = exporter.export_simulation_curve(temp_path, mock_result, "测试方案")
            
            assert result is True
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            assert len(lines) > 1
            assert "hour" in lines[0]
            assert "ammonia_nitrogen" in lines[0]
            assert "nitrite" in lines[0]
        finally:
            Path(temp_path).unlink()


class TestJSONExporter:
    def test_create_exporter(self):
        exporter = JSONExporter()
        assert exporter is not None

    def test_export_audit_package(self):
        exporter = JSONExporter()
        
        config = PondConfig(
            pond_id="pond_001",
            pond_name="测试池",
            volume=100.0,
            area=50.0,
            depth=2.0,
        )
        
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
        
        scenario = Scenario(
            scenario_id="scenario_001",
            scenario_name="测试方案",
        )
        
        class MockSimulationResult:
            def __init__(self):
                self.time_series = []
            
            def get_statistics(self):
                return {
                    "ammonia_nitrogen": {"final": 0.4},
                    "nitrite": {"final": 0.15},
                }
        
        report = AnalysisReport(
            report_id="report_001",
            pond_id="pond_001",
            scenario_id="scenario_001",
            initial_state=state.to_dict(),
            simulation_result=MockSimulationResult(),
            risks=[],
            recommendations={},
            summary="测试报告",
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        try:
            result = exporter.export_audit_package(
                temp_path, report, config, state, scenario
            )
            
            assert result is True
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert "audit_id" in data
            assert "report" in data
            assert "pond_config" in data
            assert "initial_state" in data
            assert "scenario" in data
            assert data["report"]["report_id"] == "report_001"
        finally:
            Path(temp_path).unlink()
