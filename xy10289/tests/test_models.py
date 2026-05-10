"""测试数据模型"""

import pytest
from datetime import datetime

from roast_review.models import (
    TemperaturePoint,
    FirstCrackInfo,
    CupScore,
    RoastBatch,
    FirstCrackType,
)


class TestTemperaturePoint:
    def test_valid_point(self):
        point = TemperaturePoint(time_seconds=100, bean_temp=180.0)
        assert point.time_seconds == 100
        assert point.bean_temp == 180.0

    def test_negative_time_raises_error(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            TemperaturePoint(time_seconds=-10, bean_temp=180.0)

    def test_temperature_out_of_range_raises_error(self):
        with pytest.raises(ValueError):
            TemperaturePoint(time_seconds=100, bean_temp=-10.0)
        with pytest.raises(ValueError):
            TemperaturePoint(time_seconds=100, bean_temp=400.0)


class TestFirstCrackInfo:
    def test_valid_first_crack(self):
        fc = FirstCrackInfo(start_time_seconds=540, start_temp=198.0)
        assert fc.start_time_seconds == 540
        assert fc.start_temp == 198.0
        assert fc.crack_type == FirstCrackType.NORMAL

    def test_duration_calculation(self):
        fc = FirstCrackInfo(
            start_time_seconds=540,
            start_temp=198.0,
            end_time_seconds=590,
            end_temp=205.0,
        )
        assert fc.duration_seconds == 50

    def test_duration_none_when_no_end(self):
        fc = FirstCrackInfo(start_time_seconds=540, start_temp=198.0)
        assert fc.duration_seconds is None


class TestCupScore:
    def test_total_score_calculation(self):
        score = CupScore(
            aroma=8.0,
            flavor=8.5,
            aftertaste=8.0,
            acidity=8.0,
            body=8.0,
            balance=8.0,
            uniformity=8.0,
            overall=8.0,
            defects=0.0,
        )
        assert score.total_score == 64.5

    def test_total_score_with_defects(self):
        score = CupScore(
            aroma=8.0,
            flavor=8.0,
            aftertaste=8.0,
            acidity=8.0,
            body=8.0,
            balance=8.0,
            uniformity=8.0,
            overall=8.0,
            defects=2.0,
        )
        assert score.total_score == 62.0

    def test_quality_level_excellent(self):
        score = CupScore(
            aroma=9.0,
            flavor=9.0,
            aftertaste=9.0,
            acidity=9.0,
            body=9.0,
            balance=9.0,
            uniformity=9.0,
            overall=9.0,
        )
        assert "Excellent" in score.quality_level

    def test_quality_level_good(self):
        score = CupScore(
            aroma=8.5,
            flavor=8.5,
            aftertaste=8.5,
            acidity=8.5,
            body=8.5,
            balance=8.5,
            uniformity=8.5,
            overall=8.5,
        )
        assert "Good" in score.quality_level


class TestRoastBatch:
    def test_total_roast_time(self):
        points = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=300, bean_temp=180),
            TemperaturePoint(time_seconds=600, bean_temp=200),
        ]
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test Coffee",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
        )
        assert batch.total_roast_time_seconds == 600

    def test_dropout_temp(self):
        points = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=300, bean_temp=180),
            TemperaturePoint(time_seconds=600, bean_temp=210),
        ]
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test Coffee",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
        )
        assert batch.dropout_temp == 210

    def test_weight_loss_calculation(self):
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test Coffee",
            green_weight_g=300,
            roasted_weight_g=255,
            roast_date=datetime.now(),
        )
        assert batch.weight_loss_percent == 15.0

    def test_first_crack_time_ratio(self):
        points = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=540, bean_temp=198),
            TemperaturePoint(time_seconds=720, bean_temp=210),
        ]
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test Coffee",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
            first_crack=FirstCrackInfo(start_time_seconds=540, start_temp=198),
        )
        assert batch.get_first_crack_time_ratio() == pytest.approx(0.75)

    def test_invalid_green_weight(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RoastBatch(
                batch_id="test",
                coffee_name="Test Coffee",
                green_weight_g=0,
                roast_date=datetime.now(),
            )
