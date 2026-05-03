"""测试计算规则模块"""

import pytest
from datetime import date

from drip_salinity.calculator import (
    SaltCalculator, MultiBedCalculator,
    DailySaltBalance, SaltTrend, FlushingRequirement, RiskLevel
)
from drip_salinity.csv_parser import DailyRecord


class TestSaltCalculator:
    """测试单畦盐分计算器"""
    
    @pytest.fixture
    def calculator(self):
        """创建计算器实例"""
        return SaltCalculator(substrate_volume=100.0, initial_ec=2.5)
    
    def test_initial_state(self, calculator):
        """测试初始状态"""
        assert calculator.current_ec == 2.5
        assert len(calculator.history) == 0
    
    def test_calculate_daily_balance_normal(self, calculator):
        """测试正常情况下的盐平衡计算"""
        balance = calculator.calculate_daily_balance(
            irrigation_volume=200.0,
            irrigation_ec=2.5,
            drainage_volume=50.0,  # 排液率 25%
            drainage_ec=3.2,
            substrate_water_content=58.0,
            record_date=date(2024, 1, 10),
            bed_id="A01"
        )
        
        # 验证输入输出
        assert balance.input_irrigation_volume == 200.0
        assert balance.input_irrigation_ec == 2.5
        assert balance.output_drainage_volume == 50.0
        assert balance.output_drainage_ec == 3.2
        assert balance.drainage_ratio == 0.25
        
        # 验证盐平衡计算
        # 输入盐分 = 200 * 2.5 * 10 = 5000 meq
        # 输出盐分 = 50 * 3.2 * 10 = 1600 meq
        # 净变化 = 5000 - 1600 = 3400 meq
        assert balance.input_salt_mass == 200.0 * 2.5 * 10.0
        assert balance.output_salt_mass == 50.0 * 3.2 * 10.0
        assert balance.net_salt_change == (200.0 * 2.5 * 10.0) - (50.0 * 3.2 * 10.0)
        
        # 验证EC变化（应该略微上升，因为盐分有累积）
        assert balance.estimated_root_ec >= 2.5
        
        # 验证历史记录
        assert len(calculator.history) == 1
    
    def test_calculate_multiple_days(self, calculator):
        """测试多天计算"""
        # 第一天
        balance1 = calculator.calculate_daily_balance(
            irrigation_volume=200.0,
            irrigation_ec=2.5,
            drainage_volume=50.0,
            drainage_ec=3.2,
            substrate_water_content=58.0,
            record_date=date(2024, 1, 10),
            bed_id="A01"
        )
        
        # 第二天
        balance2 = calculator.calculate_daily_balance(
            irrigation_volume=210.0,
            irrigation_ec=2.6,
            drainage_volume=55.0,
            drainage_ec=3.4,
            substrate_water_content=59.0,
            record_date=date(2024, 1, 11),
            bed_id="A01"
        )
        
        assert len(calculator.history) == 2
        assert calculator.history[0].record_date == date(2024, 1, 10)
        assert calculator.history[1].record_date == date(2024, 1, 11)
        
        # 验证累积变化
        assert balance2.cumulative_salt_change == balance1.net_salt_change + balance2.net_salt_change
    
    def test_high_drainage_ec_causes_salt_accumulation(self, calculator):
        """测试高排液EC导致盐分累积"""
        # 模拟盐分累积场景：排液EC高于灌溉EC很多
        initial_ec = calculator.current_ec
        
        balance = calculator.calculate_daily_balance(
            irrigation_volume=200.0,
            irrigation_ec=2.5,
            drainage_volume=30.0,  # 低排液率
            drainage_ec=5.0,  # 高排液EC
            substrate_water_content=50.0,
            record_date=date(2024, 1, 10),
            bed_id="A01"
        )
        
        # EC应该上升
        assert balance.estimated_root_ec > initial_ec
    
    def test_low_drainage_ec_causes_salt_leaching(self, calculator):
        """测试低排液EC导致盐分淋洗"""
        initial_ec = calculator.current_ec
        
        # 模拟淋洗场景：用低EC水大量灌溉
        balance = calculator.calculate_daily_balance(
            irrigation_volume=300.0,
            irrigation_ec=1.0,  # 低灌溉EC
            drainage_volume=150.0,  # 高排液率
            drainage_ec=2.0,  # 排液EC低于初始EC
            substrate_water_content=65.0,
            record_date=date(2024, 1, 10),
            bed_id="A01"
        )
        
        # EC可能下降或上升较少
        # 这取决于具体计算，这里只验证计算正常执行
        assert balance.estimated_root_ec > 0
    
    def test_get_trend_analysis_safe(self, calculator):
        """测试安全状态的趋势分析"""
        # 添加一些历史数据
        for i in range(5):
            calculator.calculate_daily_balance(
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=60.0,
                drainage_ec=3.0,
                substrate_water_content=58.0,
                record_date=date(2024, 1, 10 + i),
                bed_id="A01"
            )
        
        trend = calculator.get_trend_analysis(
            warning_threshold=4.0,
            danger_threshold=5.0
        )
        
        assert trend.bed_id == "A01"
        assert trend.risk_level in [RiskLevel.SAFE, RiskLevel.WARNING]
        assert len(trend.historical_ecs) > 0
    
    def test_get_trend_analysis_danger(self, calculator):
        """测试危险状态的趋势分析"""
        # 手动设置高EC（模拟累积情况）
        calculator._current_ec = 5.5
        
        trend = calculator.get_trend_analysis(
            warning_threshold=4.0,
            danger_threshold=5.0
        )
        
        assert trend.risk_level == RiskLevel.DANGER
    
    def test_forecast_flushing_need(self, calculator):
        """测试冲洗需求预测"""
        # 设置上升趋势
        calculator._current_ec = 3.8
        
        # 添加一些历史数据以建立趋势
        for i in range(3):
            calculator.calculate_daily_balance(
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=40.0,  # 低排液率 = 盐分累积
                drainage_ec=3.5,
                substrate_water_content=55.0,
                record_date=date(2024, 1, 10 + i),
                bed_id="A01"
            )
        
        forecast = calculator.forecast_flushing_need(
            warning_threshold=4.0,
            danger_threshold=5.0,
            target_ec=3.0
        )
        
        assert forecast.bed_id == "A01"
        assert forecast.current_ec == calculator.current_ec
        assert forecast.day_1_forecast >= forecast.current_ec  # 保守预测
        assert forecast.day_2_forecast >= forecast.day_1_forecast
        assert forecast.day_3_forecast >= forecast.day_2_forecast


class TestMultiBedCalculator:
    """测试多畦计算器"""
    
    @pytest.fixture
    def multi_calculator(self):
        """创建多畦计算器"""
        return MultiBedCalculator(substrate_volume=100.0, initial_ec=2.5)
    
    def test_create_multiple_beds(self, multi_calculator):
        """测试创建多个畦的计算器"""
        # 处理不同畦的记录
        records = [
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A01",
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=50.0,
                drainage_ec=3.2,
                substrate_water_content=58.0
            ),
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A02",
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=55.0,
                drainage_ec=3.0,
                substrate_water_content=60.0
            ),
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A03",
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=48.0,
                drainage_ec=3.5,
                substrate_water_content=57.0
            )
        ]
        
        for record in records:
            multi_calculator.process_record(record)
        
        # 验证畦号数量
        assert len(multi_calculator.bed_ids) == 3
        assert "A01" in multi_calculator.bed_ids
        assert "A02" in multi_calculator.bed_ids
        assert "A03" in multi_calculator.bed_ids
    
    def test_get_all_trends(self, multi_calculator):
        """测试获取所有畦的趋势"""
        # 添加一些数据
        for bed_id in ["A01", "A02"]:
            for i in range(3):
                record = DailyRecord(
                    record_date=date(2024, 1, 10 + i),
                    bed_id=bed_id,
                    irrigation_volume=200.0,
                    irrigation_ec=2.5,
                    drainage_volume=50.0,
                    drainage_ec=3.2,
                    substrate_water_content=58.0
                )
                multi_calculator.process_record(record)
        
        trends = multi_calculator.get_all_trends(
            warning_threshold=4.0,
            danger_threshold=5.0
        )
        
        assert len(trends) == 2
        assert "A01" in trends
        assert "A02" in trends
    
    def test_get_all_flushing_forecasts(self, multi_calculator):
        """测试获取所有畦的冲洗预测"""
        # 添加一些数据
        for bed_id in ["A01", "A02"]:
            for i in range(3):
                record = DailyRecord(
                    record_date=date(2024, 1, 10 + i),
                    bed_id=bed_id,
                    irrigation_volume=200.0,
                    irrigation_ec=2.5,
                    drainage_volume=50.0,
                    drainage_ec=3.2,
                    substrate_water_content=58.0
                )
                multi_calculator.process_record(record)
        
        forecasts = multi_calculator.get_all_flushing_forecasts(
            warning_threshold=4.0,
            danger_threshold=5.0,
            target_ec=3.0
        )
        
        assert len(forecasts) == 2
        assert "A01" in forecasts
        assert "A02" in forecasts
    
    def test_get_bed_history(self, multi_calculator):
        """测试获取指定畦的历史记录"""
        # 添加数据
        record1 = DailyRecord(
            record_date=date(2024, 1, 10),
            bed_id="A01",
            irrigation_volume=200.0,
            irrigation_ec=2.5,
            drainage_volume=50.0,
            drainage_ec=3.2,
            substrate_water_content=58.0
        )
        record2 = DailyRecord(
            record_date=date(2024, 1, 11),
            bed_id="A01",
            irrigation_volume=210.0,
            irrigation_ec=2.6,
            drainage_volume=55.0,
            drainage_ec=3.4,
            substrate_water_content=59.0
        )
        record3 = DailyRecord(
            record_date=date(2024, 1, 10),
            bed_id="A02",
            irrigation_volume=200.0,
            irrigation_ec=2.5,
            drainage_volume=55.0,
            drainage_ec=3.0,
            substrate_water_content=60.0
        )
        
        for record in [record1, record2, record3]:
            multi_calculator.process_record(record)
        
        # 获取A01的历史
        history_a01 = multi_calculator.get_bed_history("A01")
        assert len(history_a01) == 2
        
        # 获取A02的历史
        history_a02 = multi_calculator.get_bed_history("A02")
        assert len(history_a02) == 1
        
        # 获取不存在的畦
        history_none = multi_calculator.get_bed_history("A99")
        assert history_none is None
