from __future__ import annotations

import csv
import hashlib
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    ConflictRecord,
    ConflictType,
    EvidenceItem,
    ManualCorrection,
    ModelOutput,
    OnlineFeedback,
    Sample,
    Severity,
)


def _load_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _severity_from_confidence_and_agreement(
    confidences: list[float], agreement_count: int, total_sources: int
) -> Severity:
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.5
    disagreement_ratio = 1.0 - (agreement_count / total_sources) if total_sources else 0
    if avg_conf > 0.85 and disagreement_ratio > 0.5:
        return Severity.HIGH
    if avg_conf > 0.70 or disagreement_ratio > 0.3:
        return Severity.MEDIUM
    return Severity.LOW


def _make_conflict_id(sample_id: str, conflict_type: ConflictType, extra: str = "") -> str:
    raw = f"{sample_id}:{conflict_type.value}:{extra}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


class ConflictDetector:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        self.samples: dict[str, Sample] = {}
        self.model_outputs: dict[str, list[ModelOutput]] = defaultdict(list)
        self.manual_corrections: dict[str, list[ManualCorrection]] = defaultdict(list)
        self.online_feedback: dict[str, list[OnlineFeedback]] = defaultdict(list)
        self.conflicts: list[ConflictRecord] = []

    def load_data(self) -> None:
        for row in _load_csv(self.data_dir / "samples.csv"):
            s = Sample(**row)
            self.samples[s.sample_id] = s

        for row in _load_csv(self.data_dir / "model_outputs.csv"):
            row["confidence"] = float(row["confidence"])
            m = ModelOutput(**row)
            self.model_outputs[m.sample_id].append(m)

        for row in _load_csv(self.data_dir / "manual_corrections.csv"):
            mc = ManualCorrection(**row)
            self.manual_corrections[mc.sample_id].append(mc)

        for row in _load_csv(self.data_dir / "online_feedback.csv"):
            of = OnlineFeedback(**row)
            self.online_feedback[of.sample_id].append(of)

    def detect_all(self, model_version: Optional[str] = None, audit_store_path: Optional[str | Path] = None) -> list[ConflictRecord]:
        self.conflicts.clear()
        for sample_id in self.samples:
            self._detect_model_vs_manual(sample_id, model_version)
            self._detect_model_vs_online(sample_id, model_version)
            self._detect_manual_vs_online(sample_id)
            self._detect_multi_model(sample_id, model_version)
            self._detect_manual_disagreement(sample_id)
        if audit_store_path:
            self._restore_resolved_status(audit_store_path)
        self.conflicts.sort(key=lambda c: (c.severity.value, c.sample_id), reverse=True)
        return self.conflicts

    def _restore_resolved_status(self, audit_store_path: str | Path) -> None:
        import json as _json
        path = Path(audit_store_path)
        if not path.exists():
            return
        with open(path, encoding="utf-8") as f:
            notes_data = _json.load(f)
        resolved_ids: set[str] = set()
        resolutions: dict[str, str] = {}
        for n in notes_data:
            if n.get("source") == "conflict_resolution" and n.get("new_value") == "resolved":
                tid = n.get("target_id", "")
                content = n.get("note_content", "")
                resolved_ids.add(tid)
                resolutions[tid] = content
        for c in self.conflicts:
            if c.conflict_id in resolved_ids:
                c.resolved = True
                c.resolution = resolutions.get(c.conflict_id, "")

    def _detect_model_vs_manual(self, sample_id: str, model_version: Optional[str] = None) -> None:
        outputs = self.model_outputs.get(sample_id, [])
        corrections = self.manual_corrections.get(sample_id, [])
        for out in outputs:
            if model_version and out.model_version != model_version:
                continue
            for corr in corrections:
                if out.predicted_label != corr.corrected_label:
                    evidence = [
                        EvidenceItem(
                            source=f"model:{out.model_version}",
                            label=out.predicted_label,
                            detail=f"置信度={out.confidence:.2f}",
                            timestamp=out.predicted_at,
                        ),
                        EvidenceItem(
                            source=f"annotator:{corr.annotator_id}",
                            label=corr.corrected_label,
                            detail=corr.correction_reason,
                            timestamp=corr.corrected_at,
                        ),
                    ]
                    sources = [f"model:{out.model_version}", f"annotator:{corr.annotator_id}"]
                    judgment = (
                        f"模型{out.model_version}预测'{out.predicted_label}'(置信度{out.confidence:.2f})"
                        f"与标注员{corr.annotator_id}修正为'{corr.corrected_label}'不一致;"
                        f"修正原因:{corr.correction_reason}"
                    )
                    severity = _severity_from_confidence_and_agreement(
                        [out.confidence], 1, 2
                    )
                    self.conflicts.append(
                        ConflictRecord(
                            conflict_id=_make_conflict_id(sample_id, ConflictType.MODEL_VS_MANUAL, f"{out.model_version}:{corr.annotator_id}"),
                            sample_id=sample_id,
                            conflict_type=ConflictType.MODEL_VS_MANUAL,
                            severity=severity,
                            model_version=out.model_version,
                            sources_involved=sources,
                            auto_judgment=judgment,
                            evidence_chain=evidence,
                        )
                    )

    def _detect_model_vs_online(self, sample_id: str, model_version: Optional[str] = None) -> None:
        outputs = self.model_outputs.get(sample_id, [])
        feedbacks = self.online_feedback.get(sample_id, [])
        for out in outputs:
            if model_version and out.model_version != model_version:
                continue
            for fb in feedbacks:
                if out.predicted_label != fb.feedback_label:
                    evidence = [
                        EvidenceItem(
                            source=f"model:{out.model_version}",
                            label=out.predicted_label,
                            detail=f"置信度={out.confidence:.2f}",
                            timestamp=out.predicted_at,
                        ),
                        EvidenceItem(
                            source=f"feedback:{fb.feedback_source}",
                            label=fb.feedback_label,
                            detail=fb.feedback_note,
                            timestamp=fb.feedback_at,
                        ),
                    ]
                    sources = [f"model:{out.model_version}", f"feedback:{fb.feedback_source}"]
                    judgment = (
                        f"模型{out.model_version}预测'{out.predicted_label}'"
                        f"与线上反馈({fb.feedback_source})'{fb.feedback_label}'不一致;"
                        f"反馈备注:{fb.feedback_note}"
                    )
                    severity = _severity_from_confidence_and_agreement(
                        [out.confidence], 1, 2
                    )
                    if fb.feedback_source in ("pathology_report",):
                        severity = Severity.HIGH
                    self.conflicts.append(
                        ConflictRecord(
                            conflict_id=_make_conflict_id(sample_id, ConflictType.MODEL_VS_ONLINE, f"{out.model_version}:{fb.feedback_source}"),
                            sample_id=sample_id,
                            conflict_type=ConflictType.MODEL_VS_ONLINE,
                            severity=severity,
                            model_version=out.model_version,
                            sources_involved=sources,
                            auto_judgment=judgment,
                            evidence_chain=evidence,
                        )
                    )

    def _detect_manual_vs_online(self, sample_id: str) -> None:
        corrections = self.manual_corrections.get(sample_id, [])
        feedbacks = self.online_feedback.get(sample_id, [])
        for corr in corrections:
            for fb in feedbacks:
                if corr.corrected_label != fb.feedback_label:
                    evidence = [
                        EvidenceItem(
                            source=f"annotator:{corr.annotator_id}",
                            label=corr.corrected_label,
                            detail=corr.correction_reason,
                            timestamp=corr.corrected_at,
                        ),
                        EvidenceItem(
                            source=f"feedback:{fb.feedback_source}",
                            label=fb.feedback_label,
                            detail=fb.feedback_note,
                            timestamp=fb.feedback_at,
                        ),
                    ]
                    sources = [f"annotator:{corr.annotator_id}", f"feedback:{fb.feedback_source}"]
                    judgment = (
                        f"标注员{corr.annotator_id}修正为'{corr.corrected_label}'"
                        f"与线上反馈({fb.feedback_source})'{fb.feedback_label}'不一致"
                    )
                    severity = Severity.MEDIUM
                    self.conflicts.append(
                        ConflictRecord(
                            conflict_id=_make_conflict_id(sample_id, ConflictType.MANUAL_VS_ONLINE, f"{corr.annotator_id}:{fb.feedback_source}"),
                            sample_id=sample_id,
                            conflict_type=ConflictType.MANUAL_VS_ONLINE,
                            severity=severity,
                            sources_involved=sources,
                            auto_judgment=judgment,
                            evidence_chain=evidence,
                        )
                    )

    def _detect_multi_model(self, sample_id: str, model_version: Optional[str] = None) -> None:
        outputs = self.model_outputs.get(sample_id, [])
        if len(outputs) < 2:
            return
        labels_by_version: dict[str, str] = {}
        for out in outputs:
            if model_version and out.model_version != model_version:
                labels_by_version[out.model_version] = out.predicted_label
                continue
            labels_by_version[out.model_version] = out.predicted_label
        unique_labels = set(labels_by_version.values())
        if len(unique_labels) <= 1:
            return
        evidence = [
            EvidenceItem(
                source=f"model:{ver}",
                label=label,
                detail=f"置信度={next(o.confidence for o in outputs if o.model_version == ver):.2f}",
                timestamp=next(o.predicted_at for o in outputs if o.model_version == ver),
            )
            for ver, label in labels_by_version.items()
        ]
        sources = [f"model:{ver}" for ver in labels_by_version]
        label_summary = "; ".join(f"{ver}→'{label}'" for ver, label in labels_by_version.items())
        judgment = f"同一样本不同模型版本预测不一致: {label_summary}"
        confidences = [
            o.confidence for o in outputs if o.model_version in labels_by_version
        ]
        severity = _severity_from_confidence_and_agreement(confidences, 1, len(unique_labels))
        self.conflicts.append(
            ConflictRecord(
                conflict_id=_make_conflict_id(sample_id, ConflictType.MULTI_MODEL_CONFLICT),
                sample_id=sample_id,
                conflict_type=ConflictType.MULTI_MODEL_CONFLICT,
                severity=severity,
                sources_involved=sources,
                auto_judgment=judgment,
                evidence_chain=evidence,
            )
        )

    def _detect_manual_disagreement(self, sample_id: str) -> None:
        corrections = self.manual_corrections.get(sample_id, [])
        if len(corrections) < 2:
            return
        labels = set(c.corrected_label for c in corrections)
        if len(labels) <= 1:
            return
        evidence = [
            EvidenceItem(
                source=f"annotator:{c.annotator_id}",
                label=c.corrected_label,
                detail=c.correction_reason,
                timestamp=c.corrected_at,
            )
            for c in corrections
        ]
        sources = [f"annotator:{c.annotator_id}" for c in corrections]
        label_summary = "; ".join(
            f"{c.annotator_id}→'{c.corrected_label}'" for c in corrections
        )
        judgment = f"多个标注员修正不一致: {label_summary}"
        self.conflicts.append(
            ConflictRecord(
                conflict_id=_make_conflict_id(sample_id, ConflictType.MANUAL_DISAGREEMENT),
                sample_id=sample_id,
                conflict_type=ConflictType.MANUAL_DISAGREEMENT,
                severity=Severity.HIGH,
                sources_involved=sources,
                auto_judgment=judgment,
                evidence_chain=evidence,
            )
        )
