import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from yaw_checker.calculator import (
    calculate_angular_difference,
    calculate_yaw_error,
    estimate_power_loss,
    rebuild_timeline_for_turbine,
    calculate_turbine_statistics
)


class TestCalculateAngularDifference:
    """测试角度差计算"""

    def test_normal_difference(self):
        """测试正常角度差"""
        assert calculate_angular_difference(0, 90) == 90.0
        assert calculate_angular_difference(90, 0) == -90.0
        assert calculate_angular_difference(180, 270) == 90.0
        assert calculate_angular_difference(270, 180) == -90.0

    def test_wrap_around_359_0(self):
        """测试 359/0 度环绕"""
        assert calculate_angular_difference(359, 1) == 2.0
        assert calculate_angular_difference(1, 359) == -2.0
        assert calculate_angular_difference(355, 5) == 10.0
        assert calculate_angular_difference(5, 355) == -10.0

    def test_180_degree_case(self):
        """测试 180 度特殊情况"""
        assert calculate_angular_difference(0, 180) == 180.0
        assert calculate_angular_difference(180, 0) == 180.0

    def test_large_differences(self):
        """测试大于 180 度的差异"""
        assert calculate_angular_difference(0, 270) == -90.0
        assert calculate_angular_difference(270, 0) == 90.0
        assert calculate_angular_difference(45, 315) == -90.0
        assert calculate_angular_difference(315, 45) == 90.0

    def test_nan_handling(self):
        """测试 NaN 处理"""
        assert np.isnan(calculate_angular_difference(np.nan, 90))
        assert np.isnan(calculate_angular_difference(90, np.nan))
        assert np.isnan(calculate_angular_difference(np.nan, np.nan))

    def test_negative_angles(self):
        """测试负角度"""
        assert calculate_angular_difference(-45, 45) == 90.0
        assert calculate_angular_difference(45, -45) == -90.0


class TestCalculateYawError:
    """测试偏航误差计算"""

    def test_basic_calculation(self):
        """测试基本计算"""
        assert calculate_yaw_error(270, 270) == 0.0
        assert calculate_yaw_error(280, 270) == 10.0
        assert calculate_yaw_error(270, 280) == -10.0

    def test_with_nacelle_offset(self):
        """测试有机舱偏移"""
        assert calculate_yaw_error(270, 268, 2) == 0.0
        assert calculate_yaw_error(280, 268, 2) == 10.0

    def test_wrap_around_case(self):
        """测试环绕情况"""
        assert calculate_yaw_error(358, 355) == 3.0
        assert calculate_yaw_error(2, 358) == 4.0
        assert calculate_yaw_error(358, 2) == -4.0


class TestEstimatePowerLoss:
    """测试功率损失估算"""

    def test_zero_error(self):
        """零误差时损失为零"""
        loss = estimate_power_loss(0.0, 1000.0, 2000.0, 8.0)
        assert loss == 0.0

    def test_valid_wind_speed(self):
        """有效风速范围内"""
        loss = estimate_power_loss(15.0, 1000.0, 2000.0, 8.0)
        assert loss > 0.0

    def test_invalid_wind_speed_low(self):
        """风速过低"""
        loss = estimate_power_loss(15.0, 1000.0, 2000.0, 2.0)
        assert loss == 0.0

    def test_invalid_wind_speed_high(self):
        """风速过高"""
        loss = estimate_power_loss(15.0, 1000.0, 2000.0, 30.0)
        assert loss == 0.0

    def test_nan_handling(self):
        """NaN 处理"""
        assert estimate_power_loss(np.nan, 1000.0, 2000.0, 8.0) == 0.0
        assert estimate_power_loss(15.0, np.nan, 2000.0, 8.0) == 0.0
        assert estimate_power_loss(15.0, 1000.0, 2000.0, np.nan) == 0.0

    def test_loss_increases_with_error(self):
        """损失随误差增大而增加"""
        loss_small = estimate_power_loss(5.0, 1000.0, 2000.0, 8.0)
        loss_large = estimate_power_loss(30.0, 1000.0, 2000.0, 8.0)
        assert loss_large > loss_small


class TestRebuildTimeline:
    """测试时间线重建"""

    def create_test_scada_data(self, turbine_id="WTG01", n_points=20):
        """创建测试 SCADA 数据"""
        base_time = datetime(2026, 5, 1, 0, 0, 0)
        data = []
        
        for i in range(n_points):
            timestamp = base_time + timedelta(minutes=10 * i)
            wind_direction = 270 + i * 1.5
            nacelle_angle = 268 + i * 1.5
            wind_speed = 8.0 + i * 0.1
            active_power = 1200 + i * 20
            
            data.append({
                "turbine_id": turbine_id,
                "timestamp": timestamp,
                "wind_direction": wind_direction % 360,
                "nacelle_angle": nacelle_angle % 360,
                "wind_speed": wind_speed,
                "active_power": active_power
            })
        
        return pd.DataFrame(data)

    def test_basic_rebuild(self):
        """基本时间线重建"""
        df = self.create_test_scada_data()
        timeline = rebuild_timeline_for_turbine(df, "WTG01", 0.0)
        
        assert len(timeline) == 20
        assert "yaw_error_deg" in timeline.columns
        assert "absolute_yaw_error_deg" in timeline.columns
        assert "estimated_power_loss_kw" in timeline.columns
        assert "is_valid_for_analysis" in timeline.columns

    def test_missing_sample_detection(self):
        """缺采样检测"""
        df = self.create_test_scada_data()
        
        df.loc[5, "timestamp"] = df.loc[5, "timestamp"] + timedelta(hours=1)
        
        timeline = rebuild_timeline_for_turbine(df, "WTG01", 0.0)
        
        assert timeline["is_missing_sample"].iloc[5] == True

    def test_invalid_turbine_id(self):
        """无效机组 ID"""
        df = self.create_test_scada_data()
        timeline = rebuild_timeline_for_turbine(df, "INVALID", 0.0)
        
        assert timeline.empty

    def test_wrap_around_in_data(self):
        """测试数据中的角度环绕"""
        df = self.create_test_scada_data()
        
        df.loc[10, "wind_direction"] = 358.0
        df.loc[11, "wind_direction"] = 2.0
        df.loc[10, "nacelle_angle"] = 355.0
        df.loc[11, "nacelle_angle"] = 359.0
        
        timeline = rebuild_timeline_for_turbine(df, "WTG01", 0.0)
        
        assert timeline["yaw_error_deg"].iloc[10] == pytest.approx(3.0)
        assert timeline["yaw_error_deg"].iloc[11] == pytest.approx(3.0)


class TestCalculateStatistics:
    """测试统计计算"""

    def test_empty_dataframe(self):
        """空 DataFrame"""
        result = calculate_turbine_statistics(pd.DataFrame())
        assert result == {}

    def test_no_valid_data(self):
        """无有效数据"""
        data = {
            "is_valid_for_analysis": [False, False],
            "timestamp": [datetime(2026, 5, 1, 0, 0), datetime(2026, 5, 1, 0, 10)],
            "is_missing_sample": [False, False]
        }
        df = pd.DataFrame(data)
        result = calculate_turbine_statistics(df)
        
        assert result["total_samples"] == 2
        assert result["valid_samples"] == 0
        assert result["has_data"] == False

    def test_valid_statistics(self):
        """有效数据统计"""
        base_time = datetime(2026, 5, 1, 0, 0, 0)
        data = []
        
        for i in range(10):
            data.append({
                "is_valid_for_analysis": True,
                "timestamp": base_time + timedelta(minutes=10 * i),
                "is_missing_sample": False,
                "yaw_error_deg": 2.0 + i * 0.5,
                "absolute_yaw_error_deg": abs(2.0 + i * 0.5),
                "estimated_power_loss_kw": 0.1 + i * 0.05
            })
        
        df = pd.DataFrame(data)
        result = calculate_turbine_statistics(df)
        
        assert result["total_samples"] == 10
        assert result["valid_samples"] == 10
        assert result["has_data"] == True
        assert result["mean_yaw_error_deg"] == pytest.approx(4.25)
        assert result["coverage_hours"] == pytest.approx(1.5)
