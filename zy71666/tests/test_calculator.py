"""核心计算器测试用例。"""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta

import pytz

from tide_berth_window.calculator import SafetyCalculator, SafetyThreshold
from tide_berth_window.models import (
    Berth,
    DataVersion,
    Ship,
    TideCurve,
    TideReading,
    WindForecast,
    WindReading,
)


class TestSafetyCalculator(unittest.TestCase):
    """安全计算器测试。"""

    def setUp(self) -> None:
        """设置测试数据。"""
        self.tz = pytz.timezone("Asia/Shanghai")
        self.version = DataVersion(
            version_id="test_v1",
            source_file="test.csv",
            imported_at=datetime.now(pytz.UTC),
            data_type="test",
        )

        self.calculator = SafetyCalculator()

        # 创建测试潮位曲线
        self.tide_curve = TideCurve()
        base_time = self.tz.localize(datetime(2025, 6, 1, 0, 0))
        for i in range(24):
            # 模拟潮汐：0点0.5m，6点2.2m（高潮），12点0.5m，18点2.2m
            hour = i
            if hour <= 6:
                level = 0.5 + (1.7 * hour / 6)
            elif hour <= 12:
                level = 2.2 - (1.7 * (hour - 6) / 6)
            elif hour <= 18:
                level = 0.5 + (1.7 * (hour - 12) / 6)
            else:
                level = 2.2 - (1.7 * (hour - 18) / 6)

            self.tide_curve.add_reading(TideReading(
                version=self.version,
                time=base_time + timedelta(hours=i),
                tide_level=round(level, 2),
                uncertainty=0.05,
            ))

        # 创建测试风速预报
        self.wind_forecast = WindForecast()
        for i in range(0, 24, 3):
            # 模拟风速：白天较高，晚上较低
            hour = i
            if 9 <= hour <= 18:
                speed = 10.0 + (hour - 12) * 0.5
            else:
                speed = 5.0

            self.wind_forecast.add_reading(WindReading(
                version=self.version,
                time=base_time + timedelta(hours=i),
                speed=speed,
                gust=speed * 1.3,
                uncertainty=1.0,
            ))

        # 创建测试船舶
        self.ship = Ship(
            version=self.version,
            imo="9876543",
            name="测试船",
            draft=11.5,
            length=290,
            beam=32,
            maneuverability=3,
        )

        # 创建测试泊位
        self.berth = Berth(
            version=self.version,
            berth_id="B01",
            name="1号泊位",
            design_depth=12.0,
            max_length=300,
            max_beam=40,
            wind_limit=15.0,
            under_keel_margin=0.5,
            approach_channel_depth=11.5,
        )

    def test_tide_interpolation(self) -> None:
        """测试潮位插值功能。"""
        test_time = self.tz.localize(datetime(2025, 6, 1, 3, 0))
        level, uncertainty = self.tide_curve.get_tide_at(test_time)
        self.assertAlmostEqual(level, 1.35, delta=0.1)
        self.assertGreater(uncertainty, 0)

    def test_draft_check_pass(self) -> None:
        """测试吃水校验通过场景。"""
        # 高潮时，潮位2.2m，可用水深=12+2.2-0.05=14.15m
        # 要求水深=11.5+0.5=12.0m，应该通过
        high_tide_time = self.tz.localize(datetime(2025, 6, 1, 6, 0))
        result = self.calculator.check_point(
            high_tide_time, self.ship, self.berth, self.tide_curve, self.wind_forecast
        )
        self.assertTrue(result.draft_check)
        self.assertGreater(result.depth_margin, 0)

    def test_draft_check_fail(self) -> None:
        """测试吃水校验不通过场景。"""
        # 低潮时，潮位0.5m，可用水深=12+0.5-0.05=12.45m
        # 要求水深=11.5+0.5=12.0m，接近临界但应该通过（需要调整参数使它不通过）
        # 改用吃水更大的船舶
        deep_draft_ship = Ship(
            version=self.version,
            imo="9876544",
            name="深吃水船",
            draft=14.0,  # 吃水14m
            length=290,
            beam=32,
            maneuverability=3,
        )
        high_tide_time = self.tz.localize(datetime(2025, 6, 1, 6, 0))
        result = self.calculator.check_point(
            high_tide_time, deep_draft_ship, self.berth, self.tide_curve, self.wind_forecast
        )
        self.assertFalse(result.draft_check)
        self.assertLess(result.depth_margin, 0)

    def test_wind_check_pass(self) -> None:
        """测试风速校验通过场景。"""
        # 凌晨风速低
        low_wind_time = self.tz.localize(datetime(2025, 6, 1, 3, 0))
        result = self.calculator.check_point(
            low_wind_time, self.ship, self.berth, self.tide_curve, self.wind_forecast
        )
        self.assertTrue(result.wind_check)

    def test_wind_check_fail(self) -> None:
        """测试风速校验不通过场景。"""
        # 使用低风速限制的泊位
        low_wind_limit_berth = Berth(
            version=self.version,
            berth_id="B02",
            name="低风速泊位",
            design_depth=12.0,
            wind_limit=3.0,  # 极低的风速限制
            under_keel_margin=0.5,
        )
        test_time = self.tz.localize(datetime(2025, 6, 1, 12, 0))
        result = self.calculator.check_point(
            test_time, self.ship, low_wind_limit_berth, self.tide_curve, self.wind_forecast
        )
        self.assertFalse(result.wind_check)

    def test_find_windows(self) -> None:
        """测试靠泊窗口查找。"""
        start_time = self.tz.localize(datetime(2025, 6, 1, 0, 0))
        end_time = self.tz.localize(datetime(2025, 6, 2, 0, 0))

        windows = self.calculator.find_windows(
            start_time, end_time, self.ship, self.berth, self.tide_curve, self.wind_forecast
        )

        # 应该能找到一些窗口
        self.assertIsInstance(windows, list)
        # 窗口时长都应该满足最低要求
        for window in windows:
            self.assertGreaterEqual(window.duration_minutes, self.calculator.threshold.min_window_minutes)

    def test_window_confidence(self) -> None:
        """测试窗口置信度计算。"""
        start_time = self.tz.localize(datetime(2025, 6, 1, 0, 0))
        end_time = self.tz.localize(datetime(2025, 6, 2, 0, 0))

        windows = self.calculator.find_windows(
            start_time, end_time, self.ship, self.berth, self.tide_curve, self.wind_forecast
        )

        if windows:
            for window in windows:
                self.assertGreaterEqual(window.confidence, 0.0)
                self.assertLessEqual(window.confidence, 1.0)

    def test_safety_threshold_explain(self) -> None:
        """测试阈值说明生成。"""
        threshold = SafetyThreshold()
        explanation = threshold.explain()
        self.assertIn("安全阈值配置", explanation)
        self.assertIn("富余水深", explanation)
        self.assertIn("风速限制", explanation)

    def test_result_explain(self) -> None:
        """测试结果解释生成。"""
        test_time = self.tz.localize(datetime(2025, 6, 1, 6, 0))
        result = self.calculator.check_point(
            test_time, self.ship, self.berth, self.tide_curve, self.wind_forecast
        )
        explanation = result.explain()
        self.assertIn("吃水校验", explanation)
        self.assertIn("风速校验", explanation)
        self.assertIn("潮位", explanation)
        self.assertIn("可用水深", explanation)


if __name__ == "__main__":
    unittest.main()
