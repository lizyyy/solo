"""测试批次对比"""

import pytest
from datetime import datetime

from roast_review.models import TemperaturePoint, RoastBatch, FirstCrackInfo, FirstCrackType, CupScore
from roast_review.batch_comparator import BatchComparator


class TestBatchComparator:
    @pytest.fixture
    def comparator(self):
        return BatchComparator()

    def test_compare_single_batch_raises_error(self, comparator):
        with pytest.raises(ValueError, match="至少需要一个批次进行对比"):
            comparator.compare([])

    def test_compare_multiple_batches(self, comparator):
        points1 = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=540, bean_temp=198),
            TemperaturePoint(time_seconds=720, bean_temp=214),
        ]
        batch1 = RoastBatch(
            batch_id="batch1",
            coffee_name="Coffee1",
            green_weight_g=300,
            roasted_weight_g=255,
            roast_date=datetime.now(),
            curve_points=points1,
            first_crack=FirstCrackInfo(start_time_seconds=540, start_temp=198, crack_type=FirstCrackType.NORMAL),
            cup_score=CupScore(
                aroma=9.0, flavor=9.0, aftertaste=9.0, acidity=9.0,
                body=9.0, balance=9.0, uniformity=9.0, overall=9.0,
            ),
        )

        points2 = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=360, bean_temp=192),
            TemperaturePoint(time_seconds=540, bean_temp=210),
        ]
        batch2 = RoastBatch(
            batch_id="batch2",
            coffee_name="Coffee2",
            green_weight_g=300,
            roasted_weight_g=250,
            roast_date=datetime.now(),
            curve_points=points2,
            first_crack=FirstCrackInfo(start_time_seconds=360, start_temp=192, crack_type=FirstCrackType.EARLY),
            cup_score=CupScore(
                aroma=7.0, flavor=7.0, aftertaste=7.0, acidity=7.0,
                body=7.0, balance=7.0, uniformity=7.0, overall=7.0,
            ),
        )

        comparison = comparator.compare([batch1, batch2])

        assert comparison["total_batches"] == 2
        assert len(comparison["comparison_table"]) == 2
        assert len(comparison["anomalies"]) > 0
        assert len(comparison["recommendations"]) > 0

        assert comparison["summary"]["best_batch"] == "batch1"
        assert comparison["summary"]["worst_batch"] == "batch2"

    def test_compare_detects_early_first_crack(self, comparator):
        points = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=100, bean_temp=190),
            TemperaturePoint(time_seconds=500, bean_temp=210),
        ]
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
            first_crack=FirstCrackInfo(start_time_seconds=100, start_temp=190, crack_type=FirstCrackType.EARLY),
        )

        comparison = comparator.compare([batch])
        early_anomalies = [
            a for a in comparison["anomalies"]
            if a["type"] == "early_first_crack"
        ]
        assert len(early_anomalies) == 1

    def test_compare_detects_missing_first_crack(self, comparator):
        points = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=300, bean_temp=180),
            TemperaturePoint(time_seconds=600, bean_temp=210),
        ]
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
        )

        comparison = comparator.compare([batch])
        missing_fc = [
            a for a in comparison["anomalies"]
            if a["type"] == "missing_first_crack"
        ]
        assert len(missing_fc) == 1
        assert missing_fc[0]["severity"] == "high"

    def test_compare_detects_missing_cup_score(self, comparator):
        points = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=300, bean_temp=180),
            TemperaturePoint(time_seconds=600, bean_temp=210),
        ]
        batch = RoastBatch(
            batch_id="test",
            coffee_name="Test",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points,
            first_crack=FirstCrackInfo(start_time_seconds=400, start_temp=195),
        )

        comparison = comparator.compare([batch])
        missing_score = [
            a for a in comparison["anomalies"]
            if a["type"] == "missing_cup_score"
        ]
        assert len(missing_score) == 1

    def test_compare_summary_statistics(self, comparator):
        points1 = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=300, bean_temp=180),
            TemperaturePoint(time_seconds=600, bean_temp=210),
        ]
        batch1 = RoastBatch(
            batch_id="batch1",
            coffee_name="Test1",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points1,
        )

        points2 = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=400, bean_temp=190),
            TemperaturePoint(time_seconds=800, bean_temp=215),
        ]
        batch2 = RoastBatch(
            batch_id="batch2",
            coffee_name="Test2",
            green_weight_g=300,
            roast_date=datetime.now(),
            curve_points=points2,
        )

        comparison = comparator.compare([batch1, batch2])

        assert comparison["summary"]["avg_total_time"] == 700
        assert comparison["summary"]["min_total_time"] == 600
        assert comparison["summary"]["max_total_time"] == 800
        assert comparison["summary"]["avg_dropout_temp"] == 212.5
