import pytest
import math

from deco_reviewer.buhlmann import BuhlmannModel
from deco_reviewer.models import (
    DiveLog,
    DiveProfilePoint,
    GasMix,
    GasType,
)


class TestBuhlmannModel:
    """测试Bühlmann减压模型"""

    @pytest.fixture
    def model(self):
        """创建默认配置的模型实例"""
        return BuhlmannModel(gradient_factor_low=0.30, gradient_factor_high=0.85)

    @pytest.fixture
    def simple_dive_log(self):
        """创建一个简单的潜水日志"""
        return DiveLog(
            dive_id="TEST_001",
            diver_name="测试潜水员",
            dive_date=None,
            profile=[
                DiveProfilePoint(time=0, depth=0.0),
                DiveProfilePoint(time=2, depth=20.0),
                DiveProfilePoint(time=12, depth=20.0),
                DiveProfilePoint(time=14, depth=10.0),
                DiveProfilePoint(time=15, depth=5.0),
                DiveProfilePoint(time=18, depth=5.0),
                DiveProfilePoint(time=19, depth=0.0),
            ],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0, he_percent=0.0),
        )

    def test_initial_compartments(self, model):
        """测试组织隔室初始化"""
        assert len(model.compartments) == 16
        
        first_comp = model.compartments[0]
        assert first_comp.compartment_id == 1
        assert first_comp.n2_half_time == 5.0
        assert first_comp.current_p_n2 == 0.79
        assert first_comp.current_p_he == 0.0
        
        last_comp = model.compartments[-1]
        assert last_comp.compartment_id == 16
        assert last_comp.n2_half_time == 635.0

    def test_depth_to_bar_conversion(self, model):
        """测试深度到压力的转换"""
        assert model._depth_to_bar(0.0) == 1.0
        assert model._depth_to_bar(10.0) == 2.0
        assert model._depth_to_bar(20.0) == 3.0
        assert model._depth_to_bar(30.0) == 4.0

    def test_surface_interval_application(self, model):
        """测试水面间隔组织脱饱和"""
        for comp in model.compartments:
            comp.current_p_n2 = 2.0
        
        model.apply_surface_interval(60)
        
        for comp in model.compartments:
            assert comp.current_p_n2 < 2.0
            assert comp.current_p_n2 >= 0.79

    def test_oxygen_toxicity_calculation(self, model):
        """测试氧中毒计算"""
        air_gas = GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0)
        
        cns_1, otu_1 = model._calculate_oxygen_toxicity(
            avg_depth=0.0,
            gas_mix=air_gas,
            duration_minutes=60,
        )
        assert cns_1 == 0.0
        assert otu_1 == 0.0
        
        nitrox_gas = GasMix(gas_type=GasType.NITROX, o2_percent=32.0, n2_percent=68.0)
        
        cns_2, otu_2 = model._calculate_oxygen_toxicity(
            avg_depth=30.0,
            gas_mix=nitrox_gas,
            duration_minutes=30,
        )
        assert cns_2 > 0
        assert otu_2 > 0

    def test_calculate_simple_dive(self, model, simple_dive_log):
        """测试计算简单潜水"""
        result = model.calculate(simple_dive_log)
        
        assert len(result.tissue_compartments) == 16
        assert result.leading_compartment >= 1
        assert result.leading_compartment <= 16
        assert result.m_value_ratio >= 0
        
        for comp in result.tissue_compartments:
            assert comp.current_p_n2 >= 0.79

    def test_ndl_calculation(self, model, simple_dive_log):
        """测试NDL计算"""
        result = model.calculate(simple_dive_log)
        
        assert result.current_ndl is not None
        assert result.max_ndl >= 0

    def test_gradient_factor_calculation(self, model):
        """测试梯度因子计算"""
        surface_p = 1.0
        deep_p = 5.0
        
        gf_surface = model._get_gradient_factor(surface_p)
        gf_deep = model._get_gradient_factor(deep_p)
        
        assert gf_surface == 0.85
        assert gf_deep == 0.30
        
        mid_p = 3.0
        gf_mid = model._get_gradient_factor(mid_p)
        assert gf_mid > 0.30
        assert gf_mid < 0.85

    def test_schreiner_equation(self, model):
        """测试Schreiner方程"""
        initial_p = 0.79
        p_i = 0.79 * 3.0
        rate = 0.0
        k = math.log(2) / 5.0
        time = 10.0
        
        result = model._schreiner_equation(
            p_tissue=initial_p,
            p_i=p_i,
            rate=rate,
            k=k,
            time=time,
        )
        
        expected_half_times = time / 5.0
        expected = p_i + (initial_p - p_i) * (0.5 ** expected_half_times)
        
        assert abs(result - expected) < 0.001

    def test_empty_profile(self, model):
        """测试空剖面"""
        empty_log = DiveLog(
            dive_id="EMPTY",
            diver_name="测试",
            dive_date=None,
            profile=[],
            gas_mix=GasMix(gas_type=GasType.AIR, o2_percent=21.0, n2_percent=79.0),
        )
        
        result = model.calculate(empty_log)
        
        assert result.current_ndl == 0
        assert result.max_ndl == 0
        assert result.cns_percentage == 0.0
        assert result.otu_value == 0.0

    def test_leading_compartment_identification(self, model, simple_dive_log):
        """测试领先隔室识别"""
        result = model.calculate(simple_dive_log)
        
        assert result.leading_compartment >= 1
        assert result.leading_compartment <= 16
        
        leading_comp = result.tissue_compartments[result.leading_compartment - 1]
        total_p_leading = leading_comp.current_p_n2 + leading_comp.current_p_he
        
        surface_p = 1.0
        m_value_leading = model._calculate_m_value(leading_comp, surface_p, use_gf=True)
        ratio_leading = total_p_leading / m_value_leading if m_value_leading > 0 else 0
        
        for comp in result.tissue_compartments:
            total_p = comp.current_p_n2 + comp.current_p_he
            m_value = model._calculate_m_value(comp, surface_p, use_gf=True)
            ratio = total_p / m_value if m_value > 0 else 0
            assert ratio <= ratio_leading + 0.001
