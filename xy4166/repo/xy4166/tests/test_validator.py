import pytest

from deco_reviewer.validator import DiveValidator
from deco_reviewer.buhlmann import BuhlmannModel
from deco_reviewer.models import (
    DiveLog,
    DiveProfilePoint,
    GasMix,
    GasType,
    SafetyStop,
    ViolationType,
)


class TestDiveValidator:
    """测试潜水规则校验器"""

    @pytest.fixture
    def validator(self):
        """创建校验器实例"""
        return DiveValidator()

    @pytest.fixture
    def safe_dive_log(self):
        """创建一个安全的潜水日志"""
        return DiveLog(
            dive_id="SAFE_001",
            diver_name="安全潜水员",
            dive_date=None,
            profile=[
                DiveProfilePoint(time=0, depth=0.0),
                DiveProfilePoint(time=2, depth=10.0),
                DiveProfilePoint(time=3, depth=15.0),
                DiveProfilePoint(time=4, depth=18.0),
                DiveProfilePoint(time=20, depth=18.0),
                DiveProfilePoint(time=21, depth=15.0),
                DiveProfilePoint(time=22, depth=12.0),
                DiveProfilePoint(time=23, depth=9.0),
                DiveProfilePoint(time=24, depth=5.0),
                DiveProfilePoint(time=27, depth=5.0),
                DiveProfilePoint(time=28, depth=0.0),
            ],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
            safety_stops=[
                SafetyStop(depth=5.0, duration=3),
            ],
        )

    @pytest.fixture
    def fast_ascent_dive_log(self):
        """创建上升过快的潜水日志"""
        return DiveLog(
            dive_id="FAST_001",
            diver_name="快速上升",
            dive_date=None,
            profile=[
                DiveProfilePoint(time=0, depth=0.0),
                DiveProfilePoint(time=5, depth=20.0),
                DiveProfilePoint(time=25, depth=20.0),
                DiveProfilePoint(time=26, depth=10.0),
                DiveProfilePoint(time=27, depth=0.0),
            ],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
            safety_stops=[],
        )

    @pytest.fixture
    def no_safety_stop_dive_log(self):
        """创建无安全停留的潜水日志"""
        return DiveLog(
            dive_id="NO_STOP_001",
            diver_name="无停留",
            dive_date=None,
            profile=[
                DiveProfilePoint(time=0, depth=0.0),
                DiveProfilePoint(time=3, depth=20.0),
                DiveProfilePoint(time=20, depth=20.0),
                DiveProfilePoint(time=23, depth=10.0),
                DiveProfilePoint(time=25, depth=0.0),
            ],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
            safety_stops=[],
        )

    @pytest.fixture
    def short_interval_dive_log(self):
        """创建短水面间隔的潜水日志"""
        return DiveLog(
            dive_id="SHORT_001",
            diver_name="短间隔",
            dive_date=None,
            profile=[
                DiveProfilePoint(time=0, depth=0.0),
                DiveProfilePoint(time=2, depth=15.0),
                DiveProfilePoint(time=20, depth=15.0),
                DiveProfilePoint(time=22, depth=10.0),
                DiveProfilePoint(time=24, depth=5.0),
                DiveProfilePoint(time=27, depth=5.0),
                DiveProfilePoint(time=28, depth=0.0),
            ],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
            safety_stops=[SafetyStop(depth=5.0, duration=3)],
            surface_interval_minutes=30,
        )

    def test_check_ascent_rate_normal(self, validator, safe_dive_log):
        """测试正常上升速率"""
        model = BuhlmannModel()
        calc_result = model.calculate(safe_dive_log)
        
        violations = validator.validate(safe_dive_log, calc_result)
        
        ascent_violations = [v for v in violations if v.violation_type == ViolationType.ASCENT_RATE_TOO_FAST]
        assert len(ascent_violations) == 0

    def test_check_ascent_rate_too_fast(self, validator, fast_ascent_dive_log):
        """测试上升过快"""
        model = BuhlmannModel()
        calc_result = model.calculate(fast_ascent_dive_log)
        
        violations = validator.validate(fast_ascent_dive_log, calc_result)
        
        ascent_violations = [v for v in violations if v.violation_type == ViolationType.ASCENT_RATE_TOO_FAST]
        assert len(ascent_violations) > 0
        
        for v in ascent_violations:
            assert v.severity in ["warning", "critical"]

    def test_check_safety_stop_missing(self, validator, no_safety_stop_dive_log):
        """测试缺失安全停留"""
        model = BuhlmannModel()
        calc_result = model.calculate(no_safety_stop_dive_log)
        
        violations = validator.validate(no_safety_stop_dive_log, calc_result)
        
        stop_violations = [v for v in violations if v.violation_type == ViolationType.SAFETY_STOP_MISSED]
        assert len(stop_violations) > 0

    def test_check_safety_stop_present(self, validator, safe_dive_log):
        """测试安全停留存在"""
        model = BuhlmannModel()
        calc_result = model.calculate(safe_dive_log)
        
        violations = validator.validate(safe_dive_log, calc_result)
        
        stop_violations = [v for v in violations if v.violation_type == ViolationType.SAFETY_STOP_MISSED]
        shallow_stop_violations = [v for v in stop_violations if "5" in v.message]
        assert len(shallow_stop_violations) == 0

    def test_check_repeat_dive_interval(self, validator, short_interval_dive_log):
        """测试重复潜水间隔"""
        model = BuhlmannModel()
        calc_result = model.calculate(short_interval_dive_log)
        
        violations = validator.validate(short_interval_dive_log, calc_result)
        
        interval_violations = [v for v in violations if v.violation_type == ViolationType.REPEAT_DIVE_INTERVAL_TOO_SHORT]
        assert len(interval_violations) > 0
        assert interval_violations[0].severity == "warning"

    def test_check_repeat_dive_no_interval(self, validator, safe_dive_log):
        """测试无水面间隔信息"""
        safe_dive_log.surface_interval_minutes = None
        
        model = BuhlmannModel()
        calc_result = model.calculate(safe_dive_log)
        
        violations = validator.validate(safe_dive_log, calc_result)
        
        interval_violations = [v for v in violations if v.violation_type == ViolationType.REPEAT_DIVE_INTERVAL_TOO_SHORT]
        assert len(interval_violations) == 0

    def test_calculate_bottom_time(self, validator, safe_dive_log):
        """测试底部时间计算"""
        bottom_time = validator._calculate_bottom_time(safe_dive_log.profile)
        
        assert bottom_time > 0

    def test_get_max_depth(self, validator, safe_dive_log):
        """测试最大深度获取"""
        max_depth = validator._get_max_depth(safe_dive_log.profile)
        
        assert max_depth == 18.0

    def test_get_required_safety_stops(self, validator):
        """测试获取所需安全停留"""
        shallow_stops = validator._get_required_safety_stops(10.0)
        assert len(shallow_stops) == 1
        assert shallow_stops[0]["depth"] == 5.0
        
        deep_stops = validator._get_required_safety_stops(25.0)
        assert len(deep_stops) >= 2

    def test_empty_profile_validation(self, validator):
        """测试空剖面验证"""
        empty_log = DiveLog(
            dive_id="EMPTY",
            diver_name="测试",
            dive_date=None,
            profile=[],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
        )
        
        model = BuhlmannModel()
        calc_result = model.calculate(empty_log)
        
        violations = validator.validate(empty_log, calc_result)
        
        assert len(violations) == 0

    def test_oxygen_toxicity_warning(self, validator):
        """测试氧中毒警告"""
        from deco_reviewer.models import CalculationResult, TissueCompartment
        
        comps = [TissueCompartment(
            compartment_id=1, n2_half_time=5.0, n2_a=1.0, n2_b=1.0,
            current_p_n2=0.79, current_p_he=0.0
        )]
        
        warning_result = CalculationResult(
            tissue_compartments=comps,
            current_ndl=10,
            max_ndl=20,
            cns_percentage=85.0,
            otu_value=260.0,
            leading_compartment=1,
            m_value_ratio=0.5,
        )
        
        dummy_log = DiveLog(
            dive_id="O2_TEST",
            diver_name="测试",
            dive_date=None,
            profile=[DiveProfilePoint(time=0, depth=0.0)],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
        )
        
        violations = validator.validate(dummy_log, warning_result)
        
        cns_violations = [v for v in violations if v.violation_type == ViolationType.CNS_EXCEEDED]
        otu_violations = [v for v in violations if v.violation_type == ViolationType.OTU_EXCEEDED]
        
        assert len(cns_violations) > 0
        assert len(otu_violations) > 0
        assert cns_violations[0].severity == "warning"
        assert otu_violations[0].severity == "warning"

    def test_oxygen_toxicity_critical(self, validator):
        """测试氧中毒临界"""
        from deco_reviewer.models import CalculationResult, TissueCompartment
        
        comps = [TissueCompartment(
            compartment_id=1, n2_half_time=5.0, n2_a=1.0, n2_b=1.0,
            current_p_n2=0.79, current_p_he=0.0
        )]
        
        critical_result = CalculationResult(
            tissue_compartments=comps,
            current_ndl=10,
            max_ndl=20,
            cns_percentage=105.0,
            otu_value=310.0,
            leading_compartment=1,
            m_value_ratio=0.5,
        )
        
        dummy_log = DiveLog(
            dive_id="O2_CRITICAL",
            diver_name="测试",
            dive_date=None,
            profile=[DiveProfilePoint(time=0, depth=0.0)],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
        )
        
        violations = validator.validate(dummy_log, critical_result)
        
        cns_violations = [v for v in violations if v.violation_type == ViolationType.CNS_EXCEEDED]
        otu_violations = [v for v in violations if v.violation_type == ViolationType.OTU_EXCEEDED]
        
        assert len(cns_violations) > 0
        assert len(otu_violations) > 0
        assert cns_violations[0].severity == "critical"
        assert otu_violations[0].severity == "critical"
