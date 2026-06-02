import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    Conflict,
    ConflictResolution,
    Correction,
    EvalStatus,
    Evidence,
    Evaluation,
)
from .store import Store


class ConflictDetector:
    def __init__(self, store: Store):
        self.store = store

    def detect_conflicts(self, sample_id: str) -> List[Conflict]:
        sample = self.store.get_sample(sample_id)
        if sample is None:
            return []

        evaluations = self.store.get_evaluations_for_sample(sample_id)
        feedback_list = self.store.get_feedback_for_sample(sample_id)
        existing_conflicts = self.store.list_conflicts()
        existing_keys = {
            (c.sample_id, c.model_claim, c.imported_claim) for c in existing_conflicts
        }
        conflicts: List[Conflict] = []

        imported_label = sample.metadata.get("cluster_label")
        imported_cause = sample.metadata.get("root_cause")

        for ev in evaluations:
            if imported_label and ev.cluster_label != imported_label:
                model_claim = f"cluster_label={ev.cluster_label}, root_cause={ev.root_cause}"
                imported_claim = f"cluster_label={imported_label}, root_cause={imported_cause or 'N/A'}"
                key = (sample_id, model_claim, imported_claim)
                if key not in existing_keys:
                    model_ev = [e for e in ev.evidence]
                    imported_ev = [
                        Evidence(
                            kind="imported_metadata",
                            location=f"sample:{sample_id}",
                            content=f"导入时标注 cluster_label={imported_label}",
                            confidence=1.0,
                        )
                    ]
                    suggested = (
                        f"模型判断为 [{ev.cluster_label}]，但导入数据标注为 [{imported_label}]。"
                        f"请人工确认哪个正确，或标注需要复核。"
                    )
                    cf = Conflict(
                        sample_id=sample_id,
                        model_claim=model_claim,
                        imported_claim=imported_claim,
                        model_evidence=model_ev,
                        imported_evidence=imported_ev,
                        suggested_action=suggested,
                        resolution=ConflictResolution.PENDING,
                    )
                    self.store.save_conflict(cf)
                    conflicts.append(cf)
                    existing_keys.add(key)
                ev.status = EvalStatus.CONFLICT
                self.store.save_evaluation(ev)

            if imported_cause and ev.root_cause != imported_cause:
                model_claim = f"root_cause={ev.root_cause}"
                imported_claim = f"root_cause={imported_cause}"
                key = (sample_id, model_claim, imported_claim)
                already = key in existing_keys
                if not already:
                    model_ev = [e for e in ev.evidence]
                    imported_ev = [
                        Evidence(
                            kind="imported_metadata",
                            location=f"sample:{sample_id}",
                            content=f"导入时标注 root_cause={imported_cause}",
                            confidence=1.0,
                        )
                    ]
                    suggested = (
                        f"模型判断根因为 [{ev.root_cause}]，但导入数据标注为 [{imported_cause}]。"
                        f"请人工确认哪个正确，或标注需要复核。"
                    )
                    cf = Conflict(
                        sample_id=sample_id,
                        model_claim=model_claim,
                        imported_claim=imported_claim,
                        model_evidence=model_ev,
                        imported_evidence=imported_ev,
                        suggested_action=suggested,
                        resolution=ConflictResolution.PENDING,
                    )
                    self.store.save_conflict(cf)
                    conflicts.append(cf)
                    existing_keys.add(key)
                    if ev.status != EvalStatus.CONFLICT:
                        ev.status = EvalStatus.CONFLICT
                        self.store.save_evaluation(ev)

        for fb in feedback_list:
            if fb.feedback_type in ("disagree", "wrong_cluster", "wrong_cause"):
                latest_ev = self.store.get_latest_evaluation(sample_id)
                if latest_ev is None:
                    continue
                model_claim = f"cluster_label={latest_ev.cluster_label}, root_cause={latest_ev.root_cause}"
                imported_claim = f"线上反馈: {fb.feedback_content}"
                key = (sample_id, model_claim, imported_claim)
                if key in existing_keys:
                    continue
                model_ev = [e for e in latest_ev.evidence]
                imported_ev = [
                    Evidence(
                        kind="online_feedback",
                        location=f"feedback:{fb.feedback_id}",
                        content=f"[{fb.reporter}] {fb.feedback_content}",
                        confidence=0.8,
                    )
                ]
                suggested = (
                    f"线上反馈认为模型判断有误 [{fb.feedback_type}]。"
                    f"反馈内容：{fb.feedback_content}。请人工复核。"
                )
                cf = Conflict(
                    sample_id=sample_id,
                    model_claim=model_claim,
                    imported_claim=imported_claim,
                    model_evidence=model_ev,
                    imported_evidence=imported_ev,
                    suggested_action=suggested,
                    resolution=ConflictResolution.PENDING,
                )
                self.store.save_conflict(cf)
                conflicts.append(cf)
                existing_keys.add(key)
                if latest_ev.status != EvalStatus.CONFLICT:
                    latest_ev.status = EvalStatus.CONFLICT
                    self.store.save_evaluation(latest_ev)

        return conflicts

    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: ConflictResolution,
        detail: str = "",
        apply_to_eval: bool = True,
    ) -> Conflict:
        cf = self.store.get_conflict(conflict_id)
        if cf is None:
            raise ValueError(f"冲突 {conflict_id} 不存在")
        cf.resolution = resolution
        cf.resolution_detail = detail
        self.store.save_conflict(cf)

        if apply_to_eval and resolution == ConflictResolution.RESOLVED:
            evaluations = self.store.get_evaluations_for_sample(cf.sample_id)
            for ev in evaluations:
                if ev.status == EvalStatus.CONFLICT:
                    ev.status = EvalStatus.MANUAL_CORRECTED
                    self.store.save_evaluation(ev)
        return cf

    def detect_all(self) -> List[Conflict]:
        samples = self.store.list_samples()
        all_conflicts: List[Conflict] = []
        for s in samples:
            all_conflicts.extend(self.detect_conflicts(s.sample_id))
        return all_conflicts

    @staticmethod
    def load_corrections(path: str) -> List[Dict[str, Any]]:
        raw = Path(path).read_text(encoding="utf-8")
        return json.loads(raw)
