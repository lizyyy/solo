from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from .loader import DataLoader, DataQualityChecker
from .models import (
    DataQualityWarning,
    DecisionSource,
    ReviewDecision,
    ReviewSession,
    ReviewStatus,
    SampleRecord,
    SampleReviewResult,
    WarningType,
)


class ReviewOrchestrator:
    def __init__(
        self,
        session_id: Optional[str] = None,
        model_version: str = "v1.0.0",
        threshold: float = 0.5,
        model_predict_fn: Optional[Callable] = None,
    ) -> None:
        if session_id is None:
            session_id = hashlib.md5(
                datetime.now().isoformat().encode()
            ).hexdigest()[:12]

        self._session = ReviewSession(
            session_id=session_id,
            model_version=model_version,
            threshold=threshold,
        )
        self._loader = DataLoader()
        self._checker = DataQualityChecker()
        self._model_predict_fn = model_predict_fn or self._default_predict
        self._processed_ids: set = set()

    @property
    def session(self) -> ReviewSession:
        return self._session

    @staticmethod
    def _default_predict(features: Dict[str, Any], threshold: float) -> Dict[str, Any]:
        score = 0.0
        for v in features.values():
            if isinstance(v, (int, float)):
                score += v
        score = score / max(len(features), 1)
        label = "positive" if score >= threshold else "negative"
        return {"label": label, "score": score}

    def load_samples(self, records: List[SampleRecord]) -> None:
        pre_dedup_warnings = self._checker.check(records)
        leakage_warnings = [w for w in pre_dedup_warnings if w.warning_type == WarningType.SAMPLE_LEAKAGE]
        self._session.warnings.extend(leakage_warnings)

        accepted, dup_warnings = self._loader.add_records(records)
        self._session.warnings.extend(dup_warnings)

        quality_warnings = self._checker.check(accepted)
        non_leakage = [w for w in quality_warnings if w.warning_type != WarningType.SAMPLE_LEAKAGE]
        self._session.warnings.extend(non_leakage)

    def review_all(self) -> List[SampleReviewResult]:
        results: List[SampleReviewResult] = []
        for record in self._loader.records:
            result = self._review_single(record)
            results.append(result)
        self._session.sample_results = results
        return results

    def _review_single(self, record: SampleRecord) -> SampleReviewResult:
        if record.sample_id in self._processed_ids:
            return SampleReviewResult(
                sample=record,
                decision=ReviewDecision(
                    sample_id=record.sample_id,
                    decision_source=DecisionSource.MODEL,
                    decided_label="SKIP_DUPLICATE",
                    model_version=self._session.model_version,
                    threshold=self._session.threshold,
                    evidence={"reason": "已在本次会话中处理过，跳过重复评测"},
                ),
                status=ReviewStatus.NEEDS_REVIEW,
                warnings=[
                    DataQualityWarning(
                        warning_type=WarningType.DUPLICATE_SAMPLE,
                        sample_ids=[record.sample_id],
                        detail=f"样本 {record.sample_id} 在同一次会话中被重复提交评测",
                    )
                ],
            )

        self._processed_ids.add(record.sample_id)

        sample_warnings = self._get_sample_warnings(record.sample_id)

        has_null = any(v is None for v in record.features.values()) or len(record.features) == 0
        has_conflict = (
            record.original_label is not None
            and record.human_label is not None
            and record.original_label != record.human_label
        )
        missing_ref = record.reference_result is None

        if has_null:
            prediction = {"label": "UNKNOWN", "score": None}
        else:
            prediction = self._model_predict_fn(record.features, self._session.threshold)

        if record.human_label is not None:
            decision_source = DecisionSource.HUMAN_CORRECTION
            decided_label = record.human_label
            status = ReviewStatus.HUMAN_CORRECTED
            human_reason = None
            if has_conflict:
                human_reason = (
                    f"人工标签('{record.human_label}')覆盖模型/原始标签('{record.original_label}')"
                )
        elif has_null or missing_ref or has_conflict:
            decision_source = DecisionSource.NEEDS_REVIEW
            decided_label = prediction.get("label", "UNKNOWN")
            status = ReviewStatus.NEEDS_REVIEW
            human_reason = None
        else:
            decision_source = DecisionSource.MODEL
            decided_label = prediction.get("label", "UNKNOWN")
            status = ReviewStatus.MODEL_APPROVED
            human_reason = None

        evidence: Dict[str, Any] = {
            "model_prediction": prediction,
            "has_null_features": has_null,
            "has_label_conflict": has_conflict,
            "missing_reference": missing_ref,
            "original_source": record.source,
        }
        if has_conflict:
            evidence["conflict_detail"] = {
                "original_label": record.original_label,
                "human_label": record.human_label,
            }

        decision = ReviewDecision(
            sample_id=record.sample_id,
            decision_source=decision_source,
            decided_label=decided_label,
            model_version=self._session.model_version,
            threshold=self._session.threshold,
            evidence=evidence,
            human_operator=None,
            human_reason=human_reason,
            original_label=record.original_label,
            reference_result=record.reference_result,
        )
        self._session.decisions.append(decision)

        return SampleReviewResult(
            sample=record,
            decision=decision,
            status=status,
            warnings=sample_warnings,
        )

    def _get_sample_warnings(self, sample_id: str) -> List[DataQualityWarning]:
        return [w for w in self._session.warnings if sample_id in w.sample_ids]

    def get_summary(self) -> Dict[str, int]:
        model_count = sum(
            1 for d in self._session.decisions if d.decision_source == DecisionSource.MODEL
        )
        human_count = sum(
            1 for d in self._session.decisions if d.decision_source == DecisionSource.HUMAN_CORRECTION
        )
        review_count = sum(
            1 for d in self._session.decisions if d.decision_source == DecisionSource.NEEDS_REVIEW
        )
        return {
            "total": len(self._session.decisions),
            "model_approved": model_count,
            "human_corrected": human_count,
            "needs_review": review_count,
        }
