"""测试一爆检测器"""

import pytest
from datetime import datetime

from roast_review.models import TemperaturePoint, RoastBatch, FirstCrackInfo, FirstCrackType
from roast_review.first_cracker import FirstCrackDetector


class TestFirstCrackDetector:
    @pytest.fixture
    def detector(self):
        return FirstCrackDetector()

    @pytest.fixture
    def sample_batch(self):
        points = []
        for i in range(0, 721, 30):
            temp = 25 + (i / 720) * 185
            points.append(TemperaturePoint(time_seconds=i, bean_temp=temp))

        return RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
        )

    def test_detect_auto_returns_first_crack(self, detector, sample_batch):
        fc = detector.detect_auto(sample_batch)
        assert fc is not None
        assert fc.start_time_seconds >= 0
        assert 185 <= fc.start_temp <= 220

    def test_detect_auto_no_curve_data(self, detector):
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=[],
        )
        fc = detector.detect_auto(batch)
        assert fc is None
        assert "没有温度曲线数据" in detector.warnings[0]

    def test_mark_manual_valid(self, detector, sample_batch):
        batch = detector.mark_manual(
            sample_batch,
            start_time_seconds=540,
            start_temp=198,
        )
        assert batch.first_crack is not None
        assert batch.first_crack.start_time_seconds == 540
        assert batch.first_crack.start_temp == 198

    def test_mark_manual_temp_out_of_range(self, detector, sample_batch):
        with pytest.raises(ValueError, match="一爆起始温度异常"):
            detector.mark_manual(
                sample_batch,
                start_time_seconds=540,
                start_temp=100,
            )

    def test_mark_manual_end_before_start(self, detector, sample_batch):
        with pytest.raises(ValueError, match="一爆结束时间必须晚于开始时间"):
            detector.mark_manual(
                sample_batch,
                start_time_seconds=540,
                start_temp=198,
                end_time_seconds=500,
            )

    def test_validate_existing_normal(self, detector, sample_batch):
        batch = sample_batch.model_copy(
            update={
                "first_crack": FirstCrackInfo(
                    start_time_seconds=540,
                    start_temp=198,
                )
            }
        )
        issues = detector.validate_existing(batch)
        assert len(issues) == 0

    def test_validate_existing_low_temp(self, detector, sample_batch):
        batch = sample_batch.model_copy(
            update={
                "first_crack": FirstCrackInfo(
                    start_time_seconds=540,
                    start_temp=150,
                )
            }
        )
        issues = detector.validate_existing(batch)
        assert any("偏低" in issue for issue in issues)

    def test_validate_existing_no_fc(self, detector, sample_batch):
        issues = detector.validate_existing(sample_batch)
        assert "批次没有一爆标记" in issues[0]

    def test_classify_early_crack(self, detector, sample_batch):
        batch = sample_batch.model_copy(
            update={
                "curve_points": [
                    TemperaturePoint(time_seconds=0, bean_temp=25),
                    TemperaturePoint(time_seconds=360, bean_temp=190),
                    TemperaturePoint(time_seconds=1000, bean_temp=210),
                ]
            }
        )
        fc = detector.mark_manual(
            batch,
            start_time_seconds=360,
            start_temp=190,
        )
        assert fc.first_crack.crack_type == FirstCrackType.EARLY

    def test_classify_late_crack(self, detector, sample_batch):
        batch = sample_batch.model_copy(
            update={
                "curve_points": [
                    TemperaturePoint(time_seconds=0, bean_temp=25),
                    TemperaturePoint(time_seconds=400, bean_temp=150),
                    TemperaturePoint(time_seconds=500, bean_temp=190),
                ]
            }
        )
        fc = detector.mark_manual(
            batch,
            start_time_seconds=450,
            start_temp=190,
        )
        assert fc.first_crack.crack_type == FirstCrackType.LATE
