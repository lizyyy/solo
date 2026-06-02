from __future__ import annotations

from datetime import datetime
from typing import Optional

from .models import Annotation, CalibratorRun, CalibrationRecord, JudgmentSource


class Annotator:
    def __init__(self, run: CalibratorRun):
        self._run = run
        self._record_map: dict[str, CalibrationRecord] = {
            r.sample_id: r for r in run.records
        }

    def add_annotation(
        self,
        sample_id: str,
        text: str,
        annotator_id: str,
        new_emotion: Optional[str] = None,
    ) -> Annotation:
        record = self._record_map.get(sample_id)
        if record is None:
            raise ValueError(f"sample_id={sample_id} 不在当前校准结果中")

        now = datetime.now().isoformat()
        prev_emotion = record.final_emotion
        prev_source = record.final_source.value

        diff_parts = []
        if new_emotion and new_emotion != prev_emotion:
            diff_parts.append(
                f"情绪由「{prev_emotion}」(来源:{prev_source}) 变更为「{new_emotion}」(来源:manual_annotation)"
            )
            record.final_emotion = new_emotion
            record.final_source = JudgmentSource.MANUAL
            record.evidence_chain.evidence_items.append(
                {
                    "type": "annotation_override",
                    "previous_emotion": prev_emotion,
                    "previous_source": prev_source,
                    "new_emotion": new_emotion,
                    "annotator": annotator_id,
                    "annotation_text": text,
                    "annotation_timestamp": now,
                }
            )
            record.evidence_chain.reasoning += f"; 备注补录({now}): {text} → 变更为{new_emotion}"
            record.agreement_status = "annotated_override"
        else:
            diff_parts.append(f"备注补充，情绪「{prev_emotion}」未变")
            record.evidence_chain.evidence_items.append(
                {
                    "type": "annotation_note",
                    "emotion_unchanged": True,
                    "annotator": annotator_id,
                    "annotation_text": text,
                    "annotation_timestamp": now,
                }
            )
            record.evidence_chain.reasoning += f"; 备注补录({now}): {text}"

        annotation = Annotation(
            sample_id=sample_id,
            annotation_text=text,
            annotator_id=annotator_id,
            annotation_timestamp=now,
            previous_final_emotion=prev_emotion,
            previous_source=prev_source,
            diff_description="; ".join(diff_parts),
        )
        self._run.annotations.append(annotation)
        return annotation

    def list_overrides(self) -> list[Annotation]:
        return [a for a in self._run.annotations if a.previous_final_emotion != ""]

    def diff_summary(self) -> dict:
        annotations = self._run.annotations
        if not annotations:
            return {"total_annotations": 0, "emotions_changed": 0, "emotions_unchanged": 0}

        changed = sum(
            1
            for a in annotations
            if a.previous_final_emotion
            and a.diff_description
            and "未变" not in a.diff_description
        )
        return {
            "total_annotations": len(annotations),
            "emotions_changed": changed,
            "emotions_unchanged": len(annotations) - changed,
        }
