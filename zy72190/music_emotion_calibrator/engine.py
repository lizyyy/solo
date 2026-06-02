from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Optional

from .models import (
    CalibrationRecord,
    CalibratorRun,
    EvidenceChain,
    JudgmentSource,
    ManualCorrection,
    ModelOutput,
    OnlineFeedback,
    Sample,
)


class Calibrator:
    def __init__(self):
        self._samples: dict[str, Sample] = {}
        self._model_outputs: dict[str, ModelOutput] = {}
        self._manual_corrections: dict[str, ManualCorrection] = {}
        self._online_feedback: dict[str, OnlineFeedback] = {}
        self._source_files: dict[str, str] = {}

    def load_samples(self, data: list[dict], source_file: str = "") -> None:
        self._source_files["samples"] = source_file
        for item in data:
            s = Sample(**item)
            self._samples[s.sample_id] = s

    def load_model_outputs(self, data: list[dict], source_file: str = "") -> None:
        self._source_files["model_outputs"] = source_file
        for item in data:
            m = ModelOutput(**item)
            self._model_outputs[m.sample_id] = m

    def load_manual_corrections(self, data: list[dict], source_file: str = "") -> None:
        self._source_files["manual_corrections"] = source_file
        for item in data:
            c = ManualCorrection(**item)
            self._manual_corrections[c.sample_id] = c

    def load_online_feedback(self, data: list[dict], source_file: str = "") -> None:
        self._source_files["online_feedback"] = source_file
        for item in data:
            f = OnlineFeedback(**item)
            self._online_feedback[f.sample_id] = f

    def calibrate(self) -> CalibratorRun:
        now = datetime.now().isoformat()
        run_id = self._compute_run_id(now)

        records: list[CalibrationRecord] = []
        all_sample_ids = set(self._samples.keys()) | set(self._model_outputs.keys())

        for sid in sorted(all_sample_ids):
            record = self._calibrate_one(sid, now)
            if record is not None:
                records.append(record)

        summary = self._build_summary(records)

        return CalibratorRun(
            run_id=run_id,
            run_timestamp=now,
            input_files=dict(self._source_files),
            records=records,
            summary=summary,
        )

    def _calibrate_one(self, sid: str, timestamp: str) -> Optional[CalibrationRecord]:
        sample = self._samples.get(sid)
        model_out = self._model_outputs.get(sid)
        correction = self._manual_corrections.get(sid)
        feedback = self._online_feedback.get(sid)

        if model_out is None:
            return None

        sample_fingerprint = sample.fingerprint() if sample else "unknown"

        evidence_items: list[dict] = []
        evidence_items.append(
            {
                "type": "model_output",
                "predicted_emotion": model_out.predicted_emotion,
                "confidence_score": model_out.confidence_score,
                "model_version": model_out.model_version,
                "inference_timestamp": model_out.inference_timestamp,
            }
        )

        if correction:
            evidence_items.append(correction.to_evidence())
        if feedback:
            evidence_items.append(feedback.to_evidence())

        final_emotion, final_source, agreement, reasoning = self._resolve(
            model_out, correction, feedback
        )

        chain = EvidenceChain(
            sample_id=sid,
            decision=final_emotion,
            decision_source=final_source,
            evidence_items=evidence_items,
            reasoning=reasoning,
        )

        return CalibrationRecord(
            sample_id=sid,
            sample_fingerprint=sample_fingerprint,
            final_emotion=final_emotion,
            final_source=final_source,
            evidence_chain=chain,
            model_prediction=model_out.predicted_emotion,
            model_confidence=model_out.confidence_score,
            model_version=model_out.model_version,
            manual_correction=correction.corrected_emotion if correction else None,
            online_feedback=feedback.user_reported_emotion if feedback else None,
            agreement_status=agreement,
            processing_timestamp=timestamp,
            original_source_file=self._source_files.get("model_outputs", ""),
        )

    def _resolve(self, model_out, correction, feedback):
        predicted = model_out.predicted_emotion
        reasoning_parts = [f"模型预测={predicted} (置信度{model_out.confidence_score:.2f})"]

        if correction and feedback:
            if correction.corrected_emotion == feedback.user_reported_emotion:
                if correction.corrected_emotion != predicted:
                    reasoning_parts.append(
                        f"人工修正={correction.corrected_emotion} 与线上反馈={feedback.user_reported_emotion} 一致且与模型不同，采信人工修正"
                    )
                    return (
                        correction.corrected_emotion,
                        JudgmentSource.MANUAL,
                        "correction_and_feedback_agree_model_disagrees",
                        "; ".join(reasoning_parts),
                    )
                else:
                    reasoning_parts.append(
                        f"模型、人工修正、线上反馈三方一致={predicted}"
                    )
                    return (
                        predicted,
                        JudgmentSource.MODEL,
                        "all_agree",
                        "; ".join(reasoning_parts),
                    )
            else:
                reasoning_parts.append(
                    f"人工修正={correction.corrected_emotion} 与线上反馈={feedback.user_reported_emotion} 不一致，需复核"
                )
                return (
                    predicted,
                    JudgmentSource.REQUIRES_REVIEW,
                    "correction_feedback_conflict",
                    "; ".join(reasoning_parts),
                )

        if correction:
            if correction.corrected_emotion != predicted:
                reasoning_parts.append(
                    f"人工修正={correction.corrected_emotion} 与模型不同，采信人工修正"
                )
                return (
                    correction.corrected_emotion,
                    JudgmentSource.MANUAL,
                    "correction_disagrees_with_model",
                    "; ".join(reasoning_parts),
                )
            else:
                reasoning_parts.append(f"人工修正确认模型预测={predicted}")
                return (
                    predicted,
                    JudgmentSource.MODEL,
                    "correction_confirms_model",
                    "; ".join(reasoning_parts),
                )

        if feedback:
            if feedback.thumbs_up is False:
                reasoning_parts.append(
                    f"线上反馈踩={feedback.user_reported_emotion}，标记需复核"
                )
                return (
                    predicted,
                    JudgmentSource.REQUIRES_REVIEW,
                    "negative_online_feedback",
                    "; ".join(reasoning_parts),
                )
            if feedback.user_reported_emotion != predicted:
                reasoning_parts.append(
                    f"线上反馈={feedback.user_reported_emotion} 与模型不同，仅线上反馈不足以推翻模型，标记需复核"
                )
                return (
                    predicted,
                    JudgmentSource.REQUIRES_REVIEW,
                    "feedback_disagrees_model_only",
                    "; ".join(reasoning_parts),
                )
            reasoning_parts.append("线上反馈确认模型预测")
            return (
                predicted,
                JudgmentSource.MODEL,
                "feedback_confirms_model",
                "; ".join(reasoning_parts),
            )

        reasoning_parts.append("仅模型输出，无其他信号")
        return (
            predicted,
            JudgmentSource.MODEL,
            "model_only",
            "; ".join(reasoning_parts),
        )

    def _build_summary(self, records: list[CalibrationRecord]) -> dict:
        total = len(records)
        by_source: dict[str, int] = {}
        by_agreement: dict[str, int] = {}
        by_emotion: dict[str, int] = {}
        exceptions = 0

        for r in records:
            by_source[r.final_source.value] = by_source.get(r.final_source.value, 0) + 1
            by_agreement[r.agreement_status] = by_agreement.get(r.agreement_status, 0) + 1
            by_emotion[r.final_emotion] = by_emotion.get(r.final_emotion, 0) + 1
            if r.final_source == JudgmentSource.REQUIRES_REVIEW:
                exceptions += 1

        return {
            "total_samples": total,
            "by_final_source": by_source,
            "by_agreement_status": by_agreement,
            "by_final_emotion": by_emotion,
            "requires_review_count": exceptions,
            "requires_review_ratio": round(exceptions / max(total, 1), 4),
        }

    def _compute_run_id(self, timestamp: str) -> str:
        sample_ids = sorted(self._samples.keys())
        model_ids = sorted(self._model_outputs.keys())
        blob = json.dumps(
            {"samples": sample_ids, "models": model_ids, "ts": timestamp},
            sort_keys=True,
        )
        return hashlib.sha256(blob.encode()).hexdigest()[:16]
