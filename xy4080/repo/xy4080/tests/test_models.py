"""数据模型测试"""

import pytest
from pathlib import Path
import tempfile
import json

from kiln_validator.models import (
    KilnConfig,
    FiringPlan,
    FiringSegment,
    SegmentType,
    Workpiece,
    WorkpieceList,
    GlazeInfo,
    ThermoStep,
    ThermoSimulationResult,
    ValidationIssue,
    ValidationResult,
    IssueSeverity,
    IssueCategory,
)


class TestKilnConfig:
    """窑炉配置测试"""

    def test_default_config(self):
        config = KilnConfig.create_default()
        assert config.max_ramp_rate_c_per_hour > 0
        assert config.glaze_temperature_tolerance > 0

    def test_config_save_load(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test_config.json"
            config = KilnConfig(max_ramp_rate_c_per_hour=100.0, glaze_temperature_tolerance=20.0)
            config.to_file(path)
            
            loaded = KilnConfig.from_file(path)
            assert loaded.max_ramp_rate_c_per_hour == 100.0
            assert loaded.glaze_temperature_tolerance == 20.0


class TestFiringPlan:
    """烧成计划测试"""

    def test_segment_ramp_rate(self):
        segment = FiringSegment(
            segment_type=SegmentType.RAMP_UP,
            name="测试升温",
            start_temperature_c=25.0,
            end_temperature_c=325.0,
            duration_minutes=120,
        )
        assert segment.ramp_rate_c_per_hour == 150.0

    def test_soak_segment_no_rate(self):
        segment = FiringSegment(
            segment_type=SegmentType.SOAK,
            name="测试保温",
            start_temperature_c=1200.0,
            end_temperature_c=1200.0,
            duration_minutes=30,
        )
        assert segment.ramp_rate_c_per_hour is None

    def test_plan_duration_and_peak(self):
        plan = FiringPlan(
            name="测试计划",
            firing_type="釉烧",
            segments=[
                FiringSegment(
                    segment_type=SegmentType.RAMP_UP,
                    name="升温1",
                    start_temperature_c=25,
                    end_temperature_c=500,
                    duration_minutes=60,
                ),
                FiringSegment(
                    segment_type=SegmentType.SOAK,
                    name="保温",
                    start_temperature_c=1200,
                    end_temperature_c=1200,
                    duration_minutes=30,
                ),
                FiringSegment(
                    segment_type=SegmentType.RAMP_DOWN,
                    name="降温",
                    start_temperature_c=1200,
                    end_temperature_c=900,
                    duration_minutes=30,
                ),
            ],
        )
        assert plan.total_duration_minutes == 120
        assert plan.peak_temperature_c == 1200.0


class TestWorkpieceAndGlaze:
    """作品和釉料测试"""

    def test_glaze_compatibility(self):
        glaze = GlazeInfo(
            name="测试釉",
            maturing_temp_min_c=1200.0,
            maturing_temp_max_c=1260.0,
        )
        
        assert glaze.is_compatible_with_peak(1230.0)
        assert glaze.is_compatible_with_peak(1180.0, tolerance_c=30.0)
        assert not glaze.is_compatible_with_peak(1100.0)
        assert not glaze.is_compatible_with_peak(1300.0)

    def test_workpiece_list_thickness_stats(self):
        workpieces = WorkpieceList(
            workpieces=[
                Workpiece(id="P1", thickness_cm=0.5),
                Workpiece(id="P2", thickness_cm=1.5),
                Workpiece(id="P3", thickness_cm=3.0),
            ]
        )
        assert workpieces.max_thickness_cm == 3.0
        assert workpieces.min_thickness_cm == 0.5
        assert workpieces.count == 3


class TestValidation:
    """校验结果测试"""

    def test_validation_issue_severity(self):
        critical = ValidationIssue(
            category=IssueCategory.RAMP_RATE,
            severity=IssueSeverity.CRITICAL,
            message="测试严重问题",
        )
        warning = ValidationIssue(
            category=IssueCategory.SOAK_TIME,
            severity=IssueSeverity.WARNING,
            message="测试警告",
        )
        
        assert critical.is_critical
        assert not critical.is_warning
        assert warning.is_warning
        assert not warning.is_critical

    def test_validation_result_stats(self):
        result = ValidationResult(
            plan_name="测试计划",
            workpiece_count=5,
        )
        result.add_issue(
            category=IssueCategory.RAMP_RATE,
            severity=IssueSeverity.CRITICAL,
            message="严重问题1",
        )
        result.add_issue(
            category=IssueCategory.THICKNESS_CONFLICT,
            severity=IssueSeverity.CRITICAL,
            message="严重问题2",
        )
        result.add_issue(
            category=IssueCategory.SOAK_TIME,
            severity=IssueSeverity.WARNING,
            message="警告",
        )
        result.add_issue(
            category=IssueCategory.COOLING_RATE,
            severity=IssueSeverity.INFO,
            message="信息",
        )
        
        assert result.total_issues == 4
        assert result.critical_count == 2
        assert result.warning_count == 1
        assert result.info_count == 1
        assert result.has_critical
        assert result.has_warnings


class TestThermoModels:
    """热模型测试"""

    def test_thermo_step_delta(self):
        step = ThermoStep(
            step_index=0,
            time_minutes=0,
            oven_temperature_c=100.0,
            surface_temperature_c=80.0,
            core_temperature_c=50.0,
            delta_surface_core_c=30.0,
            delta_oven_surface_c=20.0,
        )
        assert step.max_internal_delta_c == 30.0

    def test_simulation_result_max_delta(self):
        steps = [
            ThermoStep(
                step_index=0,
                time_minutes=0,
                oven_temperature_c=25,
                surface_temperature_c=25,
                core_temperature_c=25,
                delta_surface_core_c=0,
                delta_oven_surface_c=0,
            ),
            ThermoStep(
                step_index=1,
                time_minutes=60,
                oven_temperature_c=500,
                surface_temperature_c=450,
                core_temperature_c=390,
                delta_surface_core_c=60,
                delta_oven_surface_c=50,
            ),
            ThermoStep(
                step_index=2,
                time_minutes=120,
                oven_temperature_c=800,
                surface_temperature_c=700,
                core_temperature_c=600,
                delta_surface_core_c=100,
                delta_oven_surface_c=100,
            ),
        ]
        
        result = ThermoSimulationResult(
            workpiece_thickness_cm=3.0,
            time_step_minutes=1,
            steps=steps,
        )
        
        assert result.max_internal_delta_c == 100.0
        assert result.total_steps == 3
        assert result.peak_oven_temperature_c == 800.0
