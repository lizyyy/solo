"""分析模块测试"""

import pytest
import math
from datetime import datetime

from rov_tension_checker.analysis.catenary import CatenaryCalculator
from rov_tension_checker.analysis.tension import TensionCalculator
from rov_tension_checker.analysis.bending import BendingRadiusCalculator
from rov_tension_checker.analysis.risk_engine import (
    RiskEngine,
    RiskSeverity,
    RiskType,
)
from rov_tension_checker.config.models import (
    CableSpec,
    ROVSpec,
    RiskThresholds,
)


class TestCatenaryCalculator:
    @pytest.fixture
    def calculator(self):
        return CatenaryCalculator(cable_weight_in_water=8.5)
    
    def test_estimate_horizontal_offset(self, calculator):
        depth = 100.0
        cable_length = 150.0
        
        offset = calculator.estimate_horizontal_offset(cable_length, depth)
        assert offset > 0
        assert offset < cable_length
    
    def test_calculate_from_length_vertical(self, calculator):
        depth = 100.0
        cable_length = 100.0
        offset = 0.0
        
        result = calculator.calculate_from_length(cable_length, depth, offset)
        
        assert result.vertical_depth == depth
        assert result.horizontal_offset == offset
        assert result.top_angle == pytest.approx(90.0, abs=1e-3)
        assert result.bottom_angle == pytest.approx(90.0, abs=1e-3)
    
    def test_calculate_from_length_insufficient(self, calculator):
        depth = 100.0
        cable_length = 50.0
        offset = 100.0
        
        result = calculator.calculate_from_length(cable_length, depth, offset)
        
        assert result.top_tension == float('inf')


class TestTensionCalculator:
    @pytest.fixture
    def cable_spec(self):
        return CableSpec(
            name="Test Cable",
            diameter=0.019,
            weight_in_air=15.7,
            weight_in_water=8.5,
            max_allowable_tension=45000,
            min_bending_radius=0.285,
            safety_factor=1.5
        )
    
    @pytest.fixture
    def rov_spec(self):
        return ROVSpec(
            name="Test ROV",
            weight_in_air=45000,
            weight_in_water=-2000,
            maximum_thrust_horizontal=12000,
            maximum_thrust_vertical=8000
        )
    
    @pytest.fixture
    def calculator(self, cable_spec, rov_spec):
        return TensionCalculator(cable_spec, rov_spec)
    
    def test_calculate_tension_basic(self, calculator, cable_spec):
        cable_length = 150.0
        depth = 100.0
        offset = 50.0
        
        result = calculator.calculate(
            cable_length=cable_length,
            rov_depth=depth,
            horizontal_offset=offset
        )
        
        assert result.top_tension > 0
        assert result.bottom_tension > 0
        assert result.top_tension >= result.bottom_tension
    
    def test_calculate_tension_ratio(self, calculator, cable_spec):
        cable_length = 150.0
        depth = 100.0
        offset = 50.0
        
        result = calculator.calculate(
            cable_length=cable_length,
            rov_depth=depth,
            horizontal_offset=offset
        )
        
        working_limit = cable_spec.working_tension_limit
        expected_ratio = result.top_tension / working_limit
        
        assert result.tension_ratio == pytest.approx(expected_ratio, rel=1e-3)
        assert result.safety_margin == pytest.approx(1.0 - expected_ratio, rel=1e-3)
    
    def test_calculate_with_current(self, calculator):
        cable_length = 150.0
        depth = 100.0
        offset = 50.0
        current_speed = 1.0
        
        result_with_current = calculator.calculate(
            cable_length=cable_length,
            rov_depth=depth,
            horizontal_offset=offset,
            current_speed=current_speed
        )
        
        result_without_current = calculator.calculate(
            cable_length=cable_length,
            rov_depth=depth,
            horizontal_offset=offset,
            current_speed=0.0
        )
        
        assert result_with_current.top_tension >= result_without_current.top_tension
    
    def test_calculate_with_thrust(self, calculator):
        cable_length = 150.0
        depth = 100.0
        offset = 50.0
        
        result_with_thrust = calculator.calculate(
            cable_length=cable_length,
            rov_depth=depth,
            horizontal_offset=offset,
            rov_thrust_forward=5000
        )
        
        result_without_thrust = calculator.calculate(
            cable_length=cable_length,
            rov_depth=depth,
            horizontal_offset=offset,
            rov_thrust_forward=0
        )
        
        assert result_with_thrust.bottom_tension != result_without_thrust.bottom_tension


class TestBendingRadiusCalculator:
    @pytest.fixture
    def cable_spec(self):
        return CableSpec(
            name="Test Cable",
            diameter=0.019,
            weight_in_air=15.7,
            weight_in_water=8.5,
            max_allowable_tension=45000,
            min_bending_radius=0.285,
            safety_factor=1.5
        )
    
    @pytest.fixture
    def calculator(self, cable_spec):
        return BendingRadiusCalculator(cable_spec)
    
    def test_calculate_radius_basic(self, calculator, cable_spec):
        tension = 10000.0
        radius = calculator.calculate_radius(tension)
        
        assert radius == tension / cable_spec.weight_in_water
    
    def test_calculate_radius_high_tension(self, calculator, cable_spec):
        high_tension = 100000.0
        low_tension = 10000.0
        
        high_radius = calculator.calculate_radius(high_tension)
        low_radius = calculator.calculate_radius(low_tension)
        
        assert high_radius > low_radius
    
    def test_check_criticality(self, calculator, cable_spec):
        from rov_tension_checker.analysis.bending import BendingCalculationResult
        
        result = BendingCalculationResult(
            minimum_radius=cable_spec.min_bending_radius * 1.03,
            minimum_radius_location="测试位置",
            radius_at_top=100.0,
            radius_at_bottom=50.0,
            radius_safety_margin=0.03
        )
        
        checked = calculator.check_criticality(
            result,
            warning_ratio=1.2,
            critical_ratio=1.05
        )
        
        assert checked.is_critical == True
        assert checked.is_warning == True
    
    def test_check_criticality_safe(self, calculator, cable_spec):
        from rov_tension_checker.analysis.bending import BendingCalculationResult
        
        result = BendingCalculationResult(
            minimum_radius=cable_spec.min_bending_radius * 2.0,
            minimum_radius_location="测试位置",
            radius_at_top=100.0,
            radius_at_bottom=50.0,
            radius_safety_margin=1.0
        )
        
        checked = calculator.check_criticality(
            result,
            warning_ratio=1.5,
            critical_ratio=1.1
        )
        
        assert checked.is_critical == False
        assert checked.is_warning == False


class TestRiskEngine:
    @pytest.fixture
    def thresholds(self):
        return RiskThresholds(
            tension_warning_ratio=0.8,
            tension_critical_ratio=0.95,
            bending_radius_warning_ratio=1.2,
            bending_radius_critical_ratio=1.05,
            angle_change_warning=15.0,
            angle_change_critical=30.0,
            current_change_warning=0.3,
            current_change_critical=0.6,
            slack_cable_tension=50.0
        )
    
    @pytest.fixture
    def risk_engine(self, thresholds):
        return RiskEngine(thresholds=thresholds)
    
    @pytest.fixture
    def sample(self):
        from rov_tension_checker.analysis.alignment import AlignedSample
        return AlignedSample(timestamp=datetime.now())
    
    def test_check_tension_critical(self, risk_engine, sample, thresholds):
        from rov_tension_checker.analysis.tension import TensionCalculationResult
        
        tension_result = TensionCalculationResult(
            top_tension=10000.0,
            bottom_tension=5000.0,
            horizontal_force=0,
            vertical_force_rov=0,
            effective_weight_rov=0,
            current_drag_force=0,
            thrust_contribution=0,
            safety_margin=0.0,
            tension_ratio=thresholds.tension_critical_ratio + 0.1
        )
        
        risks = risk_engine.check_tension(tension_result, sample, 0)
        
        assert len(risks) >= 1
        critical_risks = [r for r in risks if r.severity == RiskSeverity.CRITICAL]
        assert len(critical_risks) >= 1
    
    def test_check_tension_warning(self, risk_engine, sample, thresholds):
        from rov_tension_checker.analysis.tension import TensionCalculationResult
        
        tension_result = TensionCalculationResult(
            top_tension=10000.0,
            bottom_tension=5000.0,
            horizontal_force=0,
            vertical_force_rov=0,
            effective_weight_rov=0,
            current_drag_force=0,
            thrust_contribution=0,
            safety_margin=0.15,
            tension_ratio=thresholds.tension_warning_ratio + 0.05
        )
        
        risks = risk_engine.check_tension(tension_result, sample, 0)
        
        warning_risks = [r for r in risks if r.severity == RiskSeverity.WARNING]
        critical_risks = [r for r in risks if r.severity == RiskSeverity.CRITICAL]
        assert len(warning_risks) >= 1
        assert len(critical_risks) == 0
    
    def test_check_slack_cable(self, risk_engine, sample, thresholds):
        from rov_tension_checker.analysis.tension import TensionCalculationResult
        
        tension_result = TensionCalculationResult(
            top_tension=thresholds.slack_cable_tension - 10.0,
            bottom_tension=10.0,
            horizontal_force=0,
            vertical_force_rov=0,
            effective_weight_rov=0,
            current_drag_force=0,
            thrust_contribution=0,
            safety_margin=1.0,
            tension_ratio=0.001
        )
        
        risks = risk_engine.check_tension(tension_result, sample, 0)
        
        slack_risks = [r for r in risks if r.risk_type == RiskType.SLACK_CABLE]
        assert len(slack_risks) >= 1
