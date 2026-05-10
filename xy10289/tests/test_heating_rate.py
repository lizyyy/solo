"""测试升温率计算"""

import pytest
from datetime import datetime

from roast_review.models import TemperaturePoint, RoastBatch, FirstCrackInfo, CupScore
from roast_review.heating_rate import HeatingRateCalculator


class TestHeatingRateCalculator:
    @pytest.fixture
    def calculator(self):
        return HeatingRateCalculator()

    @pytest.fixture
    def sample_batch(self):
        points = []
        temp = 25
        for i in range(0, 601, 10):
            temp += 3
            if temp > 210:
                temp = 210
            points.append(TemperaturePoint(time_seconds=i, bean_temp=temp))

        return RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
            first_crack=FirstCrackInfo(start_time_seconds=400, start_temp=185),
        )

    def test_calculate_returns_profile(self, calculator, sample_batch):
        profile = calculator.calculate(sample_batch)
        assert profile.batch_id == "test"
        assert len(profile.rate_points) > 0

    def test_calculate_no_curve_data(self, calculator):
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=[],
        )
        profile = calculator.calculate(batch)
        assert "没有温度曲线数据" in profile.anomalies[0]

    def test_avg_rate_before_first_crack(self, calculator, sample_batch):
        profile = calculator.calculate(sample_batch)
        assert profile.avg_rate_0_to_first_crack is not None
        assert profile.avg_rate_0_to_first_crack > 0

    def test_avg_rate_after_first_crack(self, calculator, sample_batch):
        profile = calculator.calculate(sample_batch)
        assert profile.avg_rate_first_crack_to_drop is not None

    def test_peak_rate_detected(self, calculator, sample_batch):
        profile = calculator.calculate(sample_batch)
        assert profile.peak_rate is not None
        assert profile.peak_rate_time is not None

    def test_detects_rising_too_fast(self, calculator):
        points = []
        temp = 25
        for i in range(0, 301, 10):
            temp += 20
            points.append(TemperaturePoint(time_seconds=i, bean_temp=min(temp, 210)))

        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
        )
        profile = calculator.calculate(batch)
        assert any("升温过快" in a for a in profile.anomalies)

    def test_detects_stall(self, calculator):
        points = []
        temp = 25
        for i in range(0, 201, 10):
            temp += 3
            points.append(TemperaturePoint(time_seconds=i, bean_temp=temp))

        for i in range(210, 401, 10):
            temp -= 2
            points.append(TemperaturePoint(time_seconds=i, bean_temp=max(temp, 25)))

        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
        )
        profile = calculator.calculate(batch)
        assert any("停滞" in a or "下降" in a for a in profile.anomalies)

    def test_compare_rates(self, calculator, sample_batch):
        batch2 = RoastBatch(
            batch_id="test2",
            coffee_name="Test2",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=[
                TemperaturePoint(time_seconds=0, bean_temp=25),
                TemperaturePoint(time_seconds=100, bean_temp=100),
                TemperaturePoint(time_seconds=200, bean_temp=150),
                TemperaturePoint(time_seconds=300, bean_temp=180),
                TemperaturePoint(time_seconds=400, bean_temp=195),
                TemperaturePoint(time_seconds=500, bean_temp=205),
                TemperaturePoint(time_seconds=600, bean_temp=210),
            ],
        )

        profile1 = calculator.calculate(sample_batch)
        profile2 = calculator.calculate(batch2)

        comparison = calculator.compare_rates([profile1, profile2])
        assert len(comparison) == 2
        assert comparison[0]["batch_id"] == "test"
        assert comparison[1]["batch_id"] == "test2"
