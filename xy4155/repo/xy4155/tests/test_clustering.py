import os
import tempfile
import pytest
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock

from lens_inspector.clustering import (
    AnomalyScorer,
    DefectClusterer,
    ClusteringPipeline,
)
from lens_inspector.models import (
    LensInspection,
    ImageFeatures,
    DefectDetection,
    DefectType,
    InspectionStatus,
)


class TestAnomalyScorer:
    def test_init_default_weights(self):
        scorer = AnomalyScorer()
        assert scorer.sharpness_weight == 0.3
        assert scorer.dark_corner_weight == 0.2

    def test_score_single_image_normal(self):
        features = ImageFeatures(
            image_id="test",
            file_path="/test.jpg",
            sharpness=200.0,
            sharpness_score=0.1,
            dark_corner_score=0.05,
            color_shift_score=0.1,
            dead_pixel_count=0,
            hot_pixel_count=0,
            noise_level=0.1,
        )

        scorer = AnomalyScorer()
        score, breakdown = scorer.score_single_image(features)

        assert 0 <= score <= 1
        assert "sharpness" in breakdown
        assert "dark_corner" in breakdown

    def test_score_single_image_high_anomaly(self):
        features = ImageFeatures(
            image_id="test",
            file_path="/test.jpg",
            sharpness=10.0,
            sharpness_score=0.9,
            dark_corner_score=0.8,
            color_shift_score=0.7,
            dead_pixel_count=30,
            hot_pixel_count=20,
            noise_level=0.8,
        )

        scorer = AnomalyScorer()
        score, breakdown = scorer.score_single_image(features)

        assert score > 0.5

    def test_score_lens_inspection_empty(self):
        inspection = LensInspection(lens_id="test")

        scorer = AnomalyScorer()
        score, breakdown = scorer.score_lens_inspection(inspection)

        assert score == 0.0
        assert breakdown == {}

    def test_score_lens_inspection_with_features(self):
        features = ImageFeatures(
            image_id="img1",
            file_path="/test.jpg",
            sharpness_score=0.3,
            dark_corner_score=0.2,
        )

        inspection = LensInspection(
            lens_id="test",
            image_features={"img1": features},
        )

        scorer = AnomalyScorer()
        score, breakdown = scorer.score_lens_inspection(inspection)

        assert score >= 0


class TestDefectClusterer:
    def test_init_default(self):
        clusterer = DefectClusterer()
        assert clusterer.n_clusters == 6
        assert clusterer.random_state == 42

    def test_fit_with_insufficient_data(self):
        inspection = LensInspection(lens_id="test")

        clusterer = DefectClusterer(n_clusters=3)
        result = clusterer.fit({"test": inspection})

        assert result is clusterer

    def test_predict_without_fit(self):
        inspection = LensInspection(lens_id="test")

        clusterer = DefectClusterer()
        cluster_id, label, similar = clusterer.predict(inspection)

        assert cluster_id == -1
        assert label == "未聚类"

    def test_transform_without_fit(self):
        inspections = {
            "L1": LensInspection(lens_id="L1"),
            "L2": LensInspection(lens_id="L2"),
        }

        clusterer = DefectClusterer()
        result = clusterer.transform(inspections)

        assert result == inspections


class TestClusteringPipeline:
    def test_init_default(self):
        pipeline = ClusteringPipeline()
        assert isinstance(pipeline.scorer, AnomalyScorer)
        assert isinstance(pipeline.clusterer, DefectClusterer)

    def test_process_inspections_empty(self):
        pipeline = ClusteringPipeline()
        result = pipeline.process_inspections({})

        assert result == {}

    def test_process_inspections_single(self):
        features = ImageFeatures(
            image_id="img1",
            file_path="/test.jpg",
            sharpness_score=0.3,
        )

        inspection = LensInspection(
            lens_id="L1",
            image_features={"img1": features},
        )

        pipeline = ClusteringPipeline()
        result = pipeline.process_inspections({"L1": inspection})

        assert "L1" in result
        assert result["L1"].anomaly_score > 0

    def test_get_anomaly_summary_empty(self):
        pipeline = ClusteringPipeline()
        summary = pipeline.get_anomaly_summary({})

        assert summary["count"] == 0

    def test_get_anomaly_summary_with_data(self):
        inspection1 = LensInspection(
            lens_id="L1",
            anomaly_score=0.8,
            cluster_label="暗角问题",
        )

        inspection2 = LensInspection(
            lens_id="L2",
            anomaly_score=0.2,
            cluster_label="正常/无问题",
        )

        pipeline = ClusteringPipeline()
        summary = pipeline.get_anomaly_summary({"L1": inspection1, "L2": inspection2})

        assert summary["count"] == 2
        assert summary["high_anomaly_count"] == 1
        assert "clusters" in summary

    def test_find_similar_defects_not_found(self):
        pipeline = ClusteringPipeline()
        similar = pipeline.find_similar_defects("NOT_EXIST", {})

        assert similar == []
