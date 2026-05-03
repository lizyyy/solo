"""
测试数据模型模块
"""

import json
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from label_drift_inspector.models import (
    AnnotationRecord,
    ConsistencyMetrics,
    LabelSchema,
    PredictionRecord,
    ReviewDecision,
    ReviewRecord,
    SamplingFeedback,
    SplitType,
)


class TestLabelSchema:
    def test_create_label_schema(self):
        labels = {"label1": "描述1", "label2": "描述2"}
        schema = LabelSchema(
            name="test_schema",
            version="1.0.0",
            labels=labels,
        )

        assert schema.name == "test_schema"
        assert schema.version == "1.0.0"
        assert schema.labels == labels

    def test_all_labels_property(self):
        labels = {"label1": "描述1", "label2": "描述2", "label3": "描述3"}
        schema = LabelSchema(
            name="test_schema",
            version="1.0.0",
            labels=labels,
        )

        assert set(schema.all_labels) == {"label1", "label2", "label3"}

    def test_validate_label(self):
        labels = {"valid_label": "有效标签"}
        schema = LabelSchema(
            name="test_schema",
            version="1.0.0",
            labels=labels,
        )

        assert schema.validate_label("valid_label") is True
        assert schema.validate_label("invalid_label") is False

    def test_with_parent_labels(self):
        labels = {"child1": "子标签1", "child2": "子标签2"}
        parent_labels = {"parent": ["child1", "child2"]}

        schema = LabelSchema(
            name="test_schema",
            version="1.0.0",
            labels=labels,
            parent_labels=parent_labels,
        )

        assert schema.parent_labels == parent_labels


class TestAnnotationRecord:
    def test_create_annotation_record(self):
        now = datetime.now()
        record = AnnotationRecord(
            session_id="session_001",
            turn_id="turn_01",
            text="这是测试文本",
            label="test_label",
            annotator_id="annotator_01",
            annotated_at=now,
            split=SplitType.TRAIN,
        )

        assert record.session_id == "session_001"
        assert record.turn_id == "turn_01"
        assert record.text == "这是测试文本"
        assert record.label == "test_label"
        assert record.annotator_id == "annotator_01"
        assert record.annotated_at == now
        assert record.split == SplitType.TRAIN

    def test_annotation_record_to_dict(self):
        now = datetime.now()
        record = AnnotationRecord(
            session_id="session_001",
            turn_id=None,
            text="测试文本",
            label="label",
            annotator_id="annotator_01",
            annotated_at=now,
            split=SplitType.UNKNOWN,
        )

        result = record.to_dict()

        assert result["session_id"] == "session_001"
        assert result["turn_id"] is None
        assert result["label"] == "label"
        assert result["split"] == "unknown"
        assert "annotated_at" in result


class TestPredictionRecord:
    def test_create_prediction_record(self):
        now = datetime.now()
        record = PredictionRecord(
            session_id="session_001",
            turn_id="turn_01",
            predicted_label="predicted_label",
            confidence=0.85,
            model_version="v1.0",
            predicted_at=now,
        )

        assert record.session_id == "session_001"
        assert record.predicted_label == "predicted_label"
        assert record.confidence == 0.85
        assert record.model_version == "v1.0"

    def test_prediction_record_to_dict(self):
        now = datetime.now()
        record = PredictionRecord(
            session_id="session_001",
            turn_id=None,
            predicted_label="label",
            confidence=0.9,
            model_version="v1.0",
            predicted_at=now,
        )

        result = record.to_dict()

        assert result["session_id"] == "session_001"
        assert result["confidence"] == 0.9
        assert "predicted_at" in result


class TestSamplingFeedback:
    def test_create_sampling_feedback(self):
        now = datetime.now()
        feedback = SamplingFeedback(
            session_id="session_001",
            turn_id=None,
            original_label="original",
            reviewer_label="reviewed",
            reviewer_id="reviewer_01",
            is_agreement=False,
            feedback_notes="需要重新标注",
            reviewed_at=now,
        )

        assert feedback.session_id == "session_001"
        assert feedback.original_label == "original"
        assert feedback.reviewer_label == "reviewed"
        assert feedback.is_agreement is False

    def test_sampling_feedback_to_dict(self):
        now = datetime.now()
        feedback = SamplingFeedback(
            session_id="session_001",
            turn_id=None,
            original_label="original",
            reviewer_label="original",
            reviewer_id="reviewer_01",
            is_agreement=True,
            feedback_notes="",
            reviewed_at=now,
        )

        result = feedback.to_dict()

        assert result["is_agreement"] is True
        assert "reviewed_at" in result


class TestReviewRecord:
    def test_create_review_record(self):
        now = datetime.now()
        annotation = AnnotationRecord(
            session_id="session_001",
            turn_id=None,
            text="测试文本",
            label="original_label",
            annotator_id="annotator_01",
            annotated_at=now,
        )

        review = ReviewRecord(
            record_id="rev_001",
            session_id="session_001",
            turn_id=None,
            annotation=annotation,
            prediction=None,
            sampling_feedback=None,
            decision=ReviewDecision.PENDING,
        )

        assert review.record_id == "rev_001"
        assert review.decision == ReviewDecision.PENDING
        assert review.annotation == annotation

    def test_review_record_to_dict(self):
        now = datetime.now()
        annotation = AnnotationRecord(
            session_id="session_001",
            turn_id=None,
            text="测试",
            label="label",
            annotator_id="a01",
            annotated_at=now,
        )

        review = ReviewRecord(
            record_id="rev_001",
            session_id="session_001",
            turn_id=None,
            annotation=annotation,
            prediction=None,
            sampling_feedback=None,
            decision=ReviewDecision.AGREE,
            final_label="label",
            notes="确认无误",
            reviewed_by="r01",
            reviewed_at=now,
        )

        result = review.to_dict()

        assert result["record_id"] == "rev_001"
        assert result["decision"] == "agree"
        assert result["final_label"] == "label"
        assert "annotation" in result


class TestSplitType:
    def test_split_type_values(self):
        assert SplitType.TRAIN.value == "train"
        assert SplitType.VAL.value == "val"
        assert SplitType.TEST.value == "test"
        assert SplitType.UNKNOWN.value == "unknown"

    def test_split_type_from_string(self):
        assert SplitType("train") == SplitType.TRAIN
        assert SplitType("val") == SplitType.VAL
        assert SplitType("test") == SplitType.TEST
        assert SplitType("unknown") == SplitType.UNKNOWN


class TestReviewDecision:
    def test_review_decision_values(self):
        assert ReviewDecision.AGREE.value == "agree"
        assert ReviewDecision.DISAGREE.value == "disagree"
        assert ReviewDecision.NEED_RELABEL.value == "need_relabel"
        assert ReviewDecision.PENDING.value == "pending"


class TestConsistencyMetrics:
    def test_create_consistency_metrics(self):
        metrics = ConsistencyMetrics(
            overall_agreement=0.85,
            cohen_kappa=0.75,
            fleiss_kappa=0.72,
            per_label_agreement={"label1": 0.9, "label2": 0.8},
            per_annotator_agreement={"a1": 0.85, "a2": 0.88},
        )

        assert metrics.overall_agreement == 0.85
        assert metrics.cohen_kappa == 0.75
        assert metrics.per_label_agreement["label1"] == 0.9
        assert metrics.per_annotator_agreement["a1"] == 0.85

    def test_consistency_metrics_with_none_values(self):
        metrics = ConsistencyMetrics(
            overall_agreement=1.0,
            cohen_kappa=None,
            fleiss_kappa=None,
        )

        assert metrics.cohen_kappa is None
        assert metrics.fleiss_kappa is None
