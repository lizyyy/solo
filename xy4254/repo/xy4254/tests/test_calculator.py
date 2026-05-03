"""
测试科学计算模块
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from calibrator.calculator import DLICalculator, EvapotranspirationCalculator, MoistureAnalyzer


class TestDLICalculator:
    """测试DLI计算器"""
    
    def setup_method(self):
        self.calculator = DLICalculator()
    
    def test_lux_to_ppfd_conversion(self):
        """测试lux到PPFD的转换"""
        lux = 50000
        ppfd = self.calculator.lux_to_ppfd(lux)
        
        expected = 50000 * 0.0185
        assert ppfd == pytest.approx(expected, 0.01)
    
    def test_calculate_from_interval(self):
        """测试从时间区间计算DLI"""
        light_intensity = 200.0
        start_time = datetime(2026, 5, 1, 8, 0, 0)
        end_time = datetime(2026, 5, 1, 12, 0, 0)
        
        dli = self.calculator.calculate_from_interval(light_intensity, start_time, end_time)
        
        hours = 4
        seconds = hours * 3600
        expected = 200.0 * seconds * 1e-6
        
        assert dli == pytest.approx(expected, 0.0001)
    
    def test_estimate_supplemental_light_needed(self):
        """测试估算需要的补光量"""
        current_dli = 10.0
        target_dli = 15.0
        
        result = self.calculator.estimate_supplemental_light_needed(
            current_dli, target_dli
        )
        
        assert result['need_supplement'] == True
        assert result['deficit'] == pytest.approx(5.0, 0.1)
        assert result['required_ppfd'] > 0
    
    def test_estimate_supplemental_light_not_needed(self):
        """测试光照充足时不需要补光"""
        current_dli = 20.0
        target_dli = 15.0
        
        result = self.calculator.estimate_supplemental_light_needed(
            current_dli, target_dli
        )
        
        assert result['need_supplement'] == False
        assert result['deficit'] == 0
    
    def test_get_dli_status_critical(self):
        """测试严重不足的DLI状态"""
        dli = 5.0
        min_threshold = 8.0
        
        result = self.calculator.get_dli_status(dli, min_threshold)
        
        assert result['status'] == '严重不足'
        assert result['level'] == 'critical'
        assert result['score'] == 1
    
    def test_get_dli_status_optimal(self):
        """测试适宜的DLI状态"""
        dli = 20.0
        
        result = self.calculator.get_dli_status(dli)
        
        assert result['status'] == '适宜'
        assert result['level'] == 'normal'
        assert result['score'] == 5
    
    def test_calculate_weekly_stats(self):
        """测试周统计计算"""
        daily_dli = {
            '2026-05-01': 12.0,
            '2026-05-02': 15.0,
            '2026-05-03': 18.0
        }
        
        stats = self.calculator.calculate_weekly_stats(daily_dli)
        
        assert stats['weekly_total'] == pytest.approx(45.0, 0.01)
        assert stats['weekly_avg'] == pytest.approx(15.0, 0.01)
        assert stats['weekly_min'] == pytest.approx(12.0, 0.01)
        assert stats['weekly_max'] == pytest.approx(18.0, 0.01)
    
    def test_calculate_daily_dli(self):
        """测试计算每日DLI"""
        timestamps = pd.Series([
            datetime(2026, 5, 1, 8, 0, 0),
            datetime(2026, 5, 1, 9, 0, 0),
            datetime(2026, 5, 1, 10, 0, 0),
            datetime(2026, 5, 1, 11, 0, 0),
            datetime(2026, 5, 1, 12, 0, 0),
        ])
        
        light_intensities = pd.Series([200.0, 300.0, 400.0, 350.0, 250.0])
        
        daily_dli = self.calculator.calculate_daily_dli(light_intensities, timestamps)
        
        assert len(daily_dli) == 1
        assert '2026-05-01' in daily_dli
        assert daily_dli['2026-05-01'] > 0


class TestEvapotranspirationCalculator:
    """测试蒸散量计算器"""
    
    def setup_method(self):
        self.calculator = EvapotranspirationCalculator()
    
    def test_calculate_et0_basic(self):
        """测试计算参考蒸散量"""
        temperature = 25.0
        relative_humidity = 60.0
        wind_speed = 3.0
        solar_radiation = 15.0
        
        et0 = self.calculator.calculate_et0(
            temperature, relative_humidity, wind_speed, solar_radiation
        )
        
        assert et0 > 0
    
    def test_calculate_actual_evapotranspiration(self):
        """测试计算实际蒸散量"""
        et0 = 5.0
        kc = 0.8
        
        eta = self.calculator.calculate_actual_evapotranspiration(et0, kc)
        
        expected = 5.0 * 0.8
        assert eta == pytest.approx(expected, 0.01)
    
    def test_calculate_actual_evapotranspiration_with_stress(self):
        """测试有水分胁迫时的实际蒸散量"""
        et0 = 5.0
        kc = 0.8
        stress_factor = 0.5
        
        eta = self.calculator.calculate_actual_evapotranspiration(et0, kc, stress_factor)
        
        expected = 5.0 * 0.8 * 0.5
        assert eta == pytest.approx(expected, 0.01)
    
    def test_get_crop_coefficient(self):
        """测试获取作物系数"""
        kc_germination = self.calculator.get_crop_coefficient('催芽期')
        kc_seedling = self.calculator.get_crop_coefficient('幼苗期')
        kc_growing = self.calculator.get_crop_coefficient('成苗期')
        kc_hardening = self.calculator.get_crop_coefficient('炼苗期')
        
        assert kc_germination == 0.5
        assert kc_seedling == 0.7
        assert kc_growing == 1.0
        assert kc_hardening == 0.6
    
    def test_get_crop_coefficient_english(self):
        """测试英文生长阶段"""
        kc = self.calculator.get_crop_coefficient('seedling')
        assert kc == 0.7
    
    def test_calculate_water_deficit(self):
        """测试计算水分亏缺"""
        current_moisture = 40.0
        field_capacity = 70.0
        wilting_point = 20.0
        et0 = 5.0
        
        result = self.calculator.calculate_water_deficit(
            current_moisture, field_capacity, wilting_point, et0
        )
        
        assert result['current_moisture'] == 40.0
        assert result['field_capacity'] == 70.0
        assert result['wilting_point'] == 20.0
        assert result['depletion_percent'] > 0
        assert result['irrigation_needed_mm'] > 0
    
    def test_estimate_tray_water_loss(self):
        """测试估算苗盘水分损失"""
        et0 = 5.0
        tray_area = 0.3
        crop_coverage = 0.8
        kc = 0.8
        
        water_loss = self.calculator.estimate_tray_water_loss(
            et0, tray_area, crop_coverage, kc
        )
        
        assert water_loss > 0


class TestMoistureAnalyzer:
    """测试水分分析器"""
    
    def setup_method(self):
        self.analyzer = MoistureAnalyzer()
    
    def test_analyze_moisture_timeseries_basic(self):
        """测试分析水分时间序列"""
        timestamps = pd.Series([
            datetime(2026, 5, 1, 8, 0, 0),
            datetime(2026, 5, 1, 12, 0, 0),
            datetime(2026, 5, 1, 16, 0, 0),
            datetime(2026, 5, 1, 20, 0, 0),
        ])
        
        moisture = pd.Series([65.0, 62.0, 58.0, 55.0])
        
        result = self.analyzer.analyze_moisture_timeseries(moisture, timestamps)
        
        assert 'basic_stats' in result
        assert 'trend' in result
        assert 'risk' in result
        assert 'daily_stats' in result
    
    def test_analyze_moisture_timeseries_stats(self):
        """测试水分时间序列的统计信息"""
        timestamps = pd.Series([
            datetime(2026, 5, 1, 8, 0, 0),
            datetime(2026, 5, 1, 12, 0, 0),
            datetime(2026, 5, 1, 16, 0, 0),
        ])
        
        moisture = pd.Series([60.0, 65.0, 70.0])
        
        result = self.analyzer.analyze_moisture_timeseries(moisture, timestamps)
        
        stats = result['basic_stats']
        assert stats['mean'] == pytest.approx(65.0, 0.01)
        assert stats['min'] == pytest.approx(60.0, 0.01)
        assert stats['max'] == pytest.approx(70.0, 0.01)
    
    def test_estimate_next_irrigation_time(self):
        """测试估算下次灌溉时间"""
        current_moisture = 50.0
        depletion_rate = 1.0
        field_capacity = 70.0
        wilting_point = 20.0
        
        result = self.analyzer.estimate_next_irrigation_time(
            current_moisture, depletion_rate, field_capacity, wilting_point
        )
        
        target_threshold = wilting_point + 10.0
        moisture_to_deplete = current_moisture - target_threshold
        expected_hours = moisture_to_deplete / depletion_rate
        
        assert result['hours_until_irrigation'] == pytest.approx(expected_hours, 0.1)
    
    def test_estimate_next_irrigation_urgent(self):
        """测试紧急灌溉情况"""
        current_moisture = 25.0
        depletion_rate = 1.0
        field_capacity = 70.0
        wilting_point = 20.0
        
        result = self.analyzer.estimate_next_irrigation_time(
            current_moisture, depletion_rate, field_capacity, wilting_point
        )
        
        assert result['need_irrigation_now'] == True
        assert result['current_status'] == '需要立即灌溉'
    
    def test_get_moisture_substrate_info(self):
        """测试获取基质水分特性"""
        general = self.analyzer.get_moisture_substrate_info('通用育苗基质')
        plug = self.analyzer.get_moisture_substrate_info('穴盘专用基质')
        succulent = self.analyzer.get_moisture_substrate_info('多肉专用基质')
        vegetable = self.analyzer.get_moisture_substrate_info('蔬菜育苗基质')
        
        assert general['field_capacity'] == 70
        assert plug['field_capacity'] == 65
        assert succulent['field_capacity'] == 45
        assert vegetable['field_capacity'] == 75
    
    def test_get_moisture_substrate_info_default(self):
        """测试获取未知基质类型时返回默认值"""
        unknown = self.analyzer.get_moisture_substrate_info('未知基质')
        general = self.analyzer.get_moisture_substrate_info('通用育苗基质')
        
        assert unknown == general
    
    def test_detect_irrigation_events(self):
        """测试检测灌溉事件"""
        timestamps = pd.Series([
            datetime(2026, 5, 1, 8, 0, 0),
            datetime(2026, 5, 1, 12, 0, 0),
            datetime(2026, 5, 1, 12, 30, 0),
            datetime(2026, 5, 1, 16, 0, 0),
        ])
        
        moisture = pd.Series([60.0, 55.0, 70.0, 65.0])
        
        df = pd.DataFrame({
            'timestamp': pd.to_datetime(timestamps),
            'moisture': moisture
        })
        
        events = self.analyzer._detect_irrigation_events(df, threshold_increase=5.0)
        
        assert len(events) == 1
        assert events[0]['increase_amount'] == pytest.approx(15.0, 0.01)
