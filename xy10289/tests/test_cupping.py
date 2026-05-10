"""测试杯测分数管理"""

import pytest
from datetime import datetime
import json
import tempfile
import os

from roast_review.models import TemperaturePoint, RoastBatch, FirstCrackInfo, CupScore
from roast_review.cupping_analyzer import CupScoreManager


class TestCupScoreManager:
    @pytest.fixture
    def manager(self):
        return CupScoreManager()

    @pytest.fixture
    def sample_batch(self):
        return RoastBatch(
            batch_id="test",
            coffee_name="Test Coffee",
            green_weight_g=300,
            roast_date=datetime.now(),
            first_crack=FirstCrackInfo(start_time_seconds=540, start_temp=198),
        )

    def test_associate_valid_scores(self, manager, sample_batch):
        batch = manager.associate(
            sample_batch,
            aroma=8.5,
            flavor=8.8,
            aftertaste=8.3,
            acidity=8.0,
            body=7.8,
            balance=8.5,
            uniformity=9.0,
            overall=8.5,
        )
        assert batch.cup_score is not None
        assert batch.cup_score.aroma == 8.5
        assert batch.cup_score.flavor == 8.8

    def test_associate_invalid_score_range(self, manager, sample_batch):
        with pytest.raises(ValueError, match="杯测分数必须在"):
            manager.associate(
                sample_batch,
                aroma=11.0,
                flavor=8.8,
                aftertaste=8.3,
                acidity=8.0,
                body=7.8,
                balance=8.5,
                uniformity=9.0,
                overall=8.5,
            )

    def test_associate_negative_defects(self, manager, sample_batch):
        with pytest.raises(ValueError, match="缺陷分不能为负值"):
            manager.associate(
                sample_batch,
                aroma=8.5,
                flavor=8.8,
                aftertaste=8.3,
                acidity=8.0,
                body=7.8,
                balance=8.5,
                uniformity=9.0,
                overall=8.5,
                defects=-1.0,
            )

    def test_import_from_json(self, manager, sample_batch):
        data = {
            "aroma": 8.5,
            "flavor": 8.8,
            "aftertaste": 8.3,
            "acidity": 8.0,
            "body": 7.8,
            "balance": 8.5,
            "uniformity": 9.0,
            "overall": 8.5,
            "defects": 0.5,
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            temp_path = f.name

        try:
            batch = manager.import_from_file(sample_batch, temp_path)
            assert batch.cup_score is not None
            assert batch.cup_score.total_score == pytest.approx(66.9)
        finally:
            os.unlink(temp_path)

    def test_analyze_correlations_needs_multiple_batches(self, manager, sample_batch):
        batch1 = manager.associate(
            sample_batch,
            aroma=8.0,
            flavor=8.0,
            aftertaste=8.0,
            acidity=8.0,
            body=8.0,
            balance=8.0,
            uniformity=8.0,
            overall=8.0,
        )

        result = manager.analyze_correlations([batch1])
        assert "error" in result

    def test_analyze_correlations(self, manager):
        points1 = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=540, bean_temp=198),
            TemperaturePoint(time_seconds=720, bean_temp=214),
        ]
        batch1 = RoastBatch(
            batch_id="batch1",
            coffee_name="Test1",
            green_weight_g=300,
            roasted_weight_g=255,
            roast_date=datetime.now(),
            curve_points=points1,
            first_crack=FirstCrackInfo(start_time_seconds=540, start_temp=198),
        )
        batch1 = manager.associate(
            batch1,
            aroma=9.0,
            flavor=9.0,
            aftertaste=9.0,
            acidity=9.0,
            body=9.0,
            balance=9.0,
            uniformity=9.0,
            overall=9.0,
        )

        points2 = [
            TemperaturePoint(time_seconds=0, bean_temp=25),
            TemperaturePoint(time_seconds=360, bean_temp=192),
            TemperaturePoint(time_seconds=540, bean_temp=214),
        ]
        batch2 = RoastBatch(
            batch_id="batch2",
            coffee_name="Test2",
            green_weight_g=300,
            roasted_weight_g=250,
            roast_date=datetime.now(),
            curve_points=points2,
            first_crack=FirstCrackInfo(start_time_seconds=360, start_temp=192),
        )
        batch2 = manager.associate(
            batch2,
            aroma=7.0,
            flavor=7.0,
            aftertaste=7.0,
            acidity=7.0,
            body=7.0,
            balance=7.0,
            uniformity=7.0,
            overall=7.0,
        )

        result = manager.analyze_correlations([batch1, batch2])
        assert "correlations" in result
        assert len(result["correlations"]) >= 1

    def test_export_score_summary(self, manager, sample_batch):
        batch = manager.associate(
            sample_batch,
            aroma=8.5,
            flavor=8.8,
            aftertaste=8.3,
            acidity=8.0,
            body=7.8,
            balance=8.5,
            uniformity=9.0,
            overall=8.5,
        )

        summary = manager.export_score_summary([batch])
        assert len(summary) == 1
        assert summary[0]["batch_id"] == "test"
        assert summary[0]["total_score"] == pytest.approx(67.4)
