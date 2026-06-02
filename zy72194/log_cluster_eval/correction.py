import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    ConflictResolution,
    Correction,
    EvalStatus,
    Evaluation,
    OnlineFeedback,
)
from .store import Store


class CorrectionManager:
    def __init__(self, store: Store):
        self.store = store

    def apply_correction(
        self,
        eval_id: str,
        field_corrected: str,
        old_value: str,
        new_value: str,
        corrector: str,
        reason: str,
    ) -> Correction:
        ev = self.store.get_evaluation(eval_id)
        if ev is None:
            raise ValueError(f"评测记录 {eval_id} 不存在")

        c = Correction(
            eval_id=eval_id,
            field_corrected=field_corrected,
            old_value=old_value,
            new_value=new_value,
            corrector=corrector,
            reason=reason,
        )
        self.store.save_correction(c)

        if field_corrected == "cluster_label":
            ev.cluster_label = new_value
        elif field_corrected == "root_cause":
            ev.root_cause = new_value
        elif field_corrected == "confidence":
            ev.confidence = float(new_value)
        elif field_corrected == "status":
            ev.status = EvalStatus(new_value)

        ev.status = EvalStatus.MANUAL_CORRECTED
        self.store.save_evaluation(ev)
        return c

    def mark_for_review(self, eval_id: str, reviewer: str, reason: str) -> Correction:
        ev = self.store.get_evaluation(eval_id)
        if ev is None:
            raise ValueError(f"评测记录 {eval_id} 不存在")
        old_status = ev.status.value
        ev.status = EvalStatus.NEEDS_REVIEW
        self.store.save_evaluation(ev)
        c = Correction(
            eval_id=eval_id,
            field_corrected="status",
            old_value=old_status,
            new_value="needs_review",
            corrector=reviewer,
            reason=reason,
        )
        self.store.save_correction(c)
        return c

    def get_correction_history(self, eval_id: str) -> List[Dict[str, Any]]:
        corrections = self.store.get_corrections_for_eval(eval_id)
        return [c.to_dict() for c in corrections]

    @staticmethod
    def load_corrections_from_file(path: str) -> List[Dict[str, Any]]:
        raw = Path(path).read_text(encoding="utf-8")
        return json.loads(raw)


class FeedbackManager:
    def __init__(self, store: Store):
        self.store = store

    def add_feedback(
        self,
        sample_id: str,
        feedback_type: str,
        feedback_content: str,
        reporter: str,
    ) -> OnlineFeedback:
        fb = OnlineFeedback(
            sample_id=sample_id,
            feedback_type=feedback_type,
            feedback_content=feedback_content,
            reporter=reporter,
        )
        self.store.save_feedback(fb)
        return fb

    @staticmethod
    def load_feedback_from_file(path: str) -> List[Dict[str, Any]]:
        raw = Path(path).read_text(encoding="utf-8")
        return json.loads(raw)
