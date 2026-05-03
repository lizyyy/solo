"""
测试统计评估模块
"""

from datetime import datetime
from tempfile import TemporaryDirectory
from typing import List

import numpy as np
import pytest

from label_drift_inspector.models import (
    AnnotationRecord,
    LabelSchema,
    PredictionRecord,
    SamplingFeedback,
    SplitType,
)
from label_drift_inspector.auditor import (
    AnnotatorDriftDetector,
    AuditEngine,
    ConsistencyCalculator,
    ConfusionMatrixGenerator,
    DataLeakageDetector,
    HighRiskSampleDetector,
)


class TestConsistencyCalculator:
    def test_calculate_overall_agreement_with_predictions(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1", "label2": "标签2"},
        )

        now = datetime.now()
        annotations = [
            AnnotationRecord(
                session_id=f"s{i:03d}",
                turn_id=None,
                text=f"文本{i}",
                label="label1" if i < 7 else "label2",
                annotator_id="a01",
                annotated_at=now,
            )
            for i in range(10)
        ]

        predictions = [
            PredictionRecord(
                session_id=f"s{i:03d}",
                turn_id=None,
                predicted_label="label1" if i < 5 else "label2",
                confidence=0.9,
                model_version="v1.0",
                predicted_at=now,
            )
            for i in range(10)
        ]

        agreement = ConsistencyCalculator.calculate_overall_agreement(
            annotations=annotations,
            predictions=predictions,
        )

        assert 0 < agreement < 1

    def test_calculate_per_label_agreement(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1", "label2": "标签2"},
        )

        now = datetime.now()
        annotations = []
        predictions = []

        for i in range(10):
            label = "label1" if i < 5 else "label2"
            annotations.append(
                AnnotationRecord(
                    session_id=f"s{i:03d}",
                    turn_id=None,
                    text=f"文本{i}",
                    label=label,
                    annotator_id="a01",
                    annotated_at=now,
                )
            )

            pred_label = label if i % 2 == 0 else ("label2" if label == "label1" else "label1")
            predictions.append(
                PredictionRecord(
                    session_id=f"s{i:03d}",
                    turn_id=None,
                    predicted_label=pred_label,
                    confidence=0.9,
                    model_version="v1.0",
                    predicted_at=now,
                )
            )

        per_label = ConsistencyCalculator.calculate_per_label_agreement(
            annotations=annotations,
            predictions=predictions,
        )

        assert "label1" in per_label
        assert "label2" in per_label

    def test_calculate_cohen_kappa(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1", "label2": "标签2"},
        )

        now = datetime.now()
        annotations = []
        predictions = []

        for i in range(20):
            label = "label1" if i < 10 else "label2"
            annotations.append(
                AnnotationRecord(
                    session_id=f"s{i:03d}",
                    turn_id=None,
                    text=f"文本{i}",
                    label=label,
                    annotator_id="a01",
                    annotated_at=now,
                )
            )

            pred_label = label if i < 15 else ("label2" if label == "label1" else "label1")
            predictions.append(
                PredictionRecord(
                    session_id=f"s{i:03d}",
                    turn_id=None,
                    predicted_label=pred_label,
                    confidence=0.9,
                    model_version="v1.0",
                    predicted_at=now,
                )
            )

        kappa = ConsistencyCalculator.calculate_cohen_kappa(
            annotations=annotations,
            predictions=predictions,
        )

        assert kappa is not None
        assert -1 <= kappa <= 1


class TestConfusionMatrixGenerator:
    def test_generate_confusion_matrix(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1", "label2": "标签2", "label3": "标签3"},
        )

        now = datetime.now()
        annotations = []
        predictions = []

        for i in range(30):
            if i < 10:
                true_label = "label1"
                pred_label = "label1" if i < 8 else "label2"
            elif i < 20:
                true_label = "label2"
                pred_label = "label2" if i < 17 else "label3"
            else:
                true_label = "label3"
                pred_label = "label3" if i < 28 else "label1"

            annotations.append(
                AnnotationRecord(
                    session_id=f"s{i:03d}",
                    turn_id=None,
                    text=f"文本{i}",
                    label=true_label,
                    annotator_id="a01",
                    annotated_at=now,
                )
            )

            predictions.append(
                PredictionRecord(
                    session_id=f"s{i:03d}",
                    turn_id=None,
                    predicted_label=pred_label,
                    confidence=0.9,
                    model_version="v1.0",
                    predicted_at=now,
                )
            )

        result = ConfusionMatrixGenerator.generate(
            annotations=annotations,
            predictions=predictions,
            schema=schema,
        )

        assert "matrix" in result
        assert "labels" in result
        assert "statistics" in result
        assert result["total_samples"] == 30

        stats = result["statistics"]
        for label in ["label1", "label2", "label3"]:
            assert label in stats
            assert "precision" in stats[label]
            assert "recall" in stats[label]
            assert "f1" in stats[label]
            assert "support" in stats[label]


class TestAnnotatorDriftDetector:
    def test_calculate_kl_divergence(self):
        p = {"label1": 0.5, "label2": 0.5}
        q = {"label1": 0.5, "label2": 0.5}

        kl = AnnotatorDriftDetector.calculate_kl_divergence(p, q)
        assert kl == pytest.approx(0.0, abs=1e-6)

    def test_calculate_js_divergence(self):
        p = {"label1": 1.0, "label2": 0.0}
        q = {"label1": 0.0, "label2": 1.0}

        js = AnnotatorDriftDetector.calculate_js_divergence(p, q)
        assert js > 0

    def test_detect_annotator_drift(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1", "label2": "标签2", "label3": "标签3"},
        )

        now = datetime.now()
        annotations = []

        for i in range(30):
            if i < 10:
                label = "label1" if i < 9 else "label2"
                annotator = "balanced_annotator"
            elif i < 20:
                label = "label1"
                annotator = "biased_annotator"
            else:
                label = "label3"
                annotator = "other_annotator"

            annotations.append(
                AnnotationRecord(
                    session_id=f"s{i:03d}",
                    turn_id=None,
                    text=f"文本{i}",
                    label=label,
                    annotator_id=annotator,
                    annotated_at=now,
                )
            )

        drifts = AnnotatorDriftDetector.detect(
            annotations=annotations,
            schema=schema,
        )

        assert len(drifts) == 3

        biased_drift = next(d for d in drifts if d["annotator_id"] == "biased_annotator")
        assert biased_drift["drift_score"] > 0
        assert "unusual_labels" in biased_drift


class TestDataLeakageDetector:
    def test_detect_data_leakage(self):
        now = datetime.now()
        annotations = []

        for i in range(6):
            if i < 3:
                session_id = "leaking_session"
                split = SplitType.TRAIN if i == 0 else SplitType.VAL
            else:
                session_id = f"safe_session_{i}"
                split = SplitType.TRAIN

            annotations.append(
                AnnotationRecord(
                    session_id=session_id,
                    turn_id=f"t{i:02d}",
                    text=f"文本{i}",
                    label="label1",
                    annotator_id="a01",
                    annotated_at=now,
                    split=split,
                )
            )

        leakages = DataLeakageDetector.detect(annotations=annotations)

        assert len(leakages) == 1
        assert leakages[0]["session_id"] == "leaking_session"
        assert "train" in leakages[0]["splits"]
        assert "val" in leakages[0]["splits"]
        assert leakages[0]["severity"] == "high"

    def test_no_data_leakage(self):
        now = datetime.now()
        annotations = []

        for i in range(5):
            annotations.append(
                AnnotationRecord(
                    session_id=f"session_{i}",
                    turn_id=None,
                    text=f"文本{i}",
                    label="label1",
                    annotator_id="a01",
                    annotated_at=now,
                    split=SplitType.TRAIN if i < 3 else SplitType.VAL,
                )
            )

        leakages = DataLeakageDetector.detect(annotations=annotations)

        assert len(leakages) == 0


class TestHighRiskSampleDetector:
    def test_detect_high_risk_with_disagreement(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1", "label2": "标签2"},
        )

        now = datetime.now()
        annotations = [
            AnnotationRecord(
                session_id="s001",
                turn_id=None,
                text="这是一段很长的测试文本内容",
                label="label1",
                annotator_id="a01",
                annotated_at=now,
            ),
        ]

        predictions = [
            PredictionRecord(
                session_id="s001",
                turn_id=None,
                predicted_label="label2",
                confidence=0.9,
                model_version="v1.0",
                predicted_at=now,
            ),
        ]

        high_risk = HighRiskSampleDetector.detect(
            annotations=annotations,
            predictions=predictions,
            schema=schema,
        )

        assert len(high_risk) == 1
        assert "标注-预测不一致" in high_risk[0]["risk_factors"][0]
        assert high_risk[0]["risk_score"] > 0

    def test_detect_high_risk_with_low_confidence(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1"},
        )

        now = datetime.now()
        annotations = [
            AnnotationRecord(
                session_id="s001",
                turn_id=None,
                text="测试文本",
                label="label1",
                annotator_id="a01",
                annotated_at=now,
            ),
        ]

        predictions = [
            PredictionRecord(
                session_id="s001",
                turn_id=None,
                predicted_label="label1",
                confidence=0.3,
                model_version="v1.0",
                predicted_at=now,
            ),
        ]

        high_risk = HighRiskSampleDetector.detect(
            annotations=annotations,
            predictions=predictions,
            schema=schema,
        )

        assert len(high_risk) == 1
        assert any("低置信度" in f for f in high_risk[0]["risk_factors"])

    def test_detect_high_risk_with_invalid_label(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"valid_label": "有效标签"},
        )

        now = datetime.now()
        annotations = [
            AnnotationRecord(
                session_id="s001",
                turn_id=None,
                text="测试文本",
                label="invalid_label",
                annotator_id="a01",
                annotated_at=now,
            ),
        ]

        high_risk = HighRiskSampleDetector.detect(
            annotations=annotations,
            schema=schema,
        )

        assert len(high_risk) == 1
        assert any("无效标签" in f for f in high_risk[0]["risk_factors"])


class TestAuditEngine:
    def test_run_audit_basic(self):
        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "标签1", "label2": "标签2"},
        )

        now = datetime.now()
        annotations = [
            AnnotationRecord(
                session_id=f"s{i:03d}",
                turn_id=None,
                text=f"测试文本{i}",
                label="label1" if i < 5 else "label2",
                annotator_id="a01",
                annotated_at=now,
                split=SplitType.TRAIN if i < 3 else SplitType.VAL,
            )
            for i in range(10)
        ]

        predictions = [
            PredictionRecord(
                session_id=f"s{i:03d}",
                turn_id=None,
                predicted_label="label1" if i < 4 else "label2",
                confidence=0.9,
                model_version="v1.0",
                predicted_at=now,
            )
            for i in range(10)
        ]

        result = AuditEngine.run_audit(
            annotations=annotations,
            schema=schema,
            predictions=predictions,
        )

        assert result.audit_id is not None
        assert result.schema_version == "1.0.0"
        assert result.audit_timestamp is not None
        assert result.consistency_metrics is not None
        assert result.summary is not None
        assert "total_annotations" in result.summary
        assert result.summary["total_annotations"] == 10
