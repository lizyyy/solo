import uuid
import hashlib
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from schemas import (
    ViolationSample, OriginalAnnotation, SampleStatus, ChangeType,
    HistoryRecord, ManualEdit, ModelOutput, BoundaryRule,
)

REQUIRED_STATUSES_BEFORE_KB_REVIEW = {
    SampleStatus.MODEL_OUTPUT_ADDED,
    SampleStatus.LOW_CONFIDENCE,
    SampleStatus.MODEL_VERSION_UPDATED,
}


class SampleManager:
    def __init__(self):
        self.samples = {}
        self.video_id_index = defaultdict(list)
        self.annotation_hash_index = {}
        self.boundary_rules = self._init_boundary_rules()

    def _init_boundary_rules(self):
        return [
            BoundaryRule("BR001", "Low confidence not auto confirm",
                "Confidence < 0.6 needs manual review", "confidence < 0.6",
                "Mark LOW_CONFIDENCE, no direct CONFIRMED_NORMAL", True),
            BoundaryRule("BR002", "Annotator conclusion not auto copy",
                "Manager must compare model output", "no model comparison",
                "Force MANAGER_REVIEWED, require model output", True),
            BoundaryRule("BR003", "Duplicate import dedup",
                "Same source+line no duplicate sample", "hash exists",
                "Update history only, keep evidence chain", False),
            BoundaryRule("BR004", "Wrong caliber rollback",
                "Wrong caliber sample rollback to re-annotate", "caliber error",
                "Rollback status, keep all history", True),
            BoundaryRule("BR005", "KB review requires model output",
                "Must have model output before KB review", "len(model_outputs)==0",
                "Block, raise missing evidence error", False),
            BoundaryRule("BR006", "Status transition pre-check",
                "KB review only in specific statuses", "status not in set",
                "Block, prompt to complete manager review", False),
        ]

    def _compute_annotation_hash(self, source_file, line_number, raw_content):
        return hashlib.sha256("{}:{}:{}".format(
            source_file, line_number, raw_content.strip()).encode("utf-8")).hexdigest()

    def _generate_sample_id(self):
        return "SAMPLE-" + uuid.uuid4().hex[:12].upper()

    def _generate_record_id(self):
        return "REC-" + uuid.uuid4().hex[:10].upper()

    def _snapshot_sample(self, sample):
        return {
            "sample_id": sample.sample_id,
            "current_status": sample.current_status.value,
            "current_annotation": sample.current_annotation,
            "model_outputs_count": len(sample.model_outputs),
            "manager_notes": sample.manager_notes,
            "is_low_confidence": sample.is_low_confidence,
            "has_model_output": len(sample.model_outputs) > 0,
        }

    def _add_history(self, sample, change_type, operator, before, after,
                     manual_edits=None, comment=None):
        record = HistoryRecord(
            record_id=self._generate_record_id(),
            change_type=change_type,
            timestamp=datetime.now(),
            operator=operator,
            before_snapshot=before,
            after_snapshot=after,
            manual_edits=manual_edits or [],
            comment=comment,
        )
        sample.history.append(record)
        sample.updated_at = datetime.now()

    def _validate_before_kb_review(self, sample, editor_name, final_status):
        if len(sample.model_outputs) == 0:
            raise ValueError("[BR005] KB editor " + editor_name + " blocked: no model output evidence. " +
                "Sample " + sample.sample_id + " model_outputs is empty.")
        if sample.current_status not in REQUIRED_STATUSES_BEFORE_KB_REVIEW:
            allowed = ", ".join(s.value for s in REQUIRED_STATUSES_BEFORE_KB_REVIEW)
            raise ValueError("[BR006] KB editor " + editor_name + " blocked: current status=" +
                sample.current_status.value + ". Must be one of: " + allowed)
        if sample.is_low_confidence and final_status == SampleStatus.CONFIRMED_NORMAL:
            raise ValueError("[BR001] KB editor " + editor_name +
                " blocked: low confidence sample cannot confirm as normal directly.")

    def import_annotator_message(
            self, source_file, line_number, raw_content,
            annotator_name, video_id, cover_image_url,
            conclusion=None, operator="system"):
        ahash = self._compute_annotation_hash(source_file, line_number, raw_content)
        if ahash in self.annotation_hash_index:
            existing = self.samples[self.annotation_hash_index[ahash]]
            before = self._snapshot_sample(existing)
            existing.updated_at = datetime.now()
            after = self._snapshot_sample(existing)
            has_mo = "yes" if len(existing.model_outputs) > 0 else "no"
            self._add_history(existing, ChangeType.DUPLICATE_DETECTED, operator, before, after, None,
                "[BR003] Duplicate import. Has model output: " + has_mo +
                ", status: " + existing.current_status.value + ". No new sample created.")
            return existing, False
        orig = OriginalAnnotation(
            source_file=source_file,
            line_number=line_number,
            raw_content=raw_content,
            annotator_conclusion=conclusion or "",
            annotator_name=annotator_name,
            conclusion=conclusion,
            annotation_hash=ahash,
        )
        sid = self._generate_sample_id()
        sample = ViolationSample(
            sample_id=sid,
            cover_image_url=cover_image_url,
            video_id=video_id,
            current_status=SampleStatus.ANNOTATOR_IMPORTED,
            original_annotation=orig,
            current_annotation=raw_content,
        )
        self.samples[sid] = sample
        self.video_id_index[video_id].append(sid)
        self.annotation_hash_index[ahash] = sid
        self._add_history(sample, ChangeType.CREATE, operator, {},
            self._snapshot_sample(sample), None,
            "Imported: source_file=" + source_file + " line=" + str(line_number) +
            ". Annotator conclusion for reference only (BR002). Need manager review + model output.")
        return sample, True

    def manager_review(self, sample_id, manager_name,
                       manager_notes=None, edited_annotation=None):
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)
        manual_edits = []
        if edited_annotation and edited_annotation != sample.current_annotation:
            manual_edits.append(ManualEdit(
                field="current_annotation",
                old_value=sample.current_annotation,
                new_value=edited_annotation,
                operator=manager_name,
                reason="Manager reviewed and corrected, not auto-copy annotator conclusion (BR002)",
                editor=manager_name,
                field_changed="current_annotation",
            ))
            sample.current_annotation = edited_annotation
        if manager_notes:
            sample.manager_notes = manager_notes
        sample.current_status = SampleStatus.MANAGER_REVIEWED
        after = self._snapshot_sample(sample)
        comment = (manager_name + " reviewed and corrected annotation, " if manual_edits else
                   manager_name + " reviewed, ") + "status=MANAGER_REVIEWED. Need model output next (BR002)."
        self._add_history(sample, ChangeType.MANAGER_REVIEW, manager_name, before, after, manual_edits, comment)
        return sample

    def add_model_output(self, sample_id, version, violation_score,
                         confidence, raw_fragment, operator,
                         model_metadata=None):
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)
        mo = ModelOutput(
            version=version,
            violation_score=violation_score,
            confidence=confidence,
            raw_fragment=raw_fragment,
            operator=operator,
            timestamp=datetime.now(),
            model_metadata=model_metadata or {},
        )
        sample.model_outputs.append(mo)
        if confidence < 0.6:
            sample.is_low_confidence = True
            sample.current_status = SampleStatus.LOW_CONFIDENCE
            comment = operator + " added model output v" + version + ", confidence=" + str(confidence) + " < 0.6, enter LOW_CONFIDENCE (BR001)."
        else:
            if sample.current_status == SampleStatus.MANAGER_REVIEWED:
                sample.current_status = SampleStatus.MODEL_OUTPUT_ADDED
            sample.is_low_confidence = False
            comment = operator + " added model output v" + version + ", enter MODEL_OUTPUT_ADDED, ready for KB review."
        after = self._snapshot_sample(sample)
        self._add_history(sample, ChangeType.MODEL_OUTPUT_ADD, operator, before, after, None, comment)
        return sample

    def update_model_version(self, sample_id, old_version, new_version,
                             new_violation_score, new_confidence,
                             new_raw_fragment, operator,
                             model_metadata=None):
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)
        old_output = None
        for m in sample.model_outputs:
            if m.version == old_version:
                old_output = m
                break
        if not old_output:
            raise ValueError("Version " + old_version + " not found.")
        manual_edits = [
            ManualEdit("version", old_version, new_version, operator, "Model version update",
                       operator, "model_output." + old_version + ".version"),
            ManualEdit("violation_score", old_output.violation_score, new_violation_score,
                       operator, "Model version update", operator,
                       "model_output." + old_version + ".violation_score"),
            ManualEdit("confidence", old_output.confidence, new_confidence,
                       operator, "Model version update", operator,
                       "model_output." + old_version + ".confidence"),
        ]
        old_output.version = new_version
        old_output.violation_score = new_violation_score
        old_output.confidence = new_confidence
        old_output.raw_fragment = new_raw_fragment
        old_output.timestamp = datetime.now()
        if model_metadata:
            manual_edits.append(ManualEdit("model_metadata",
                str(old_output.model_metadata), str(model_metadata),
                operator, "Model version update", operator,
                "model_output." + old_version + ".model_metadata"))
            old_output.model_metadata.update(model_metadata)
        if new_confidence < 0.6:
            sample.is_low_confidence = True
            sample.current_status = SampleStatus.LOW_CONFIDENCE
            comment = "Model v" + old_version + " -> v" + new_version + ", confidence=" + str(new_confidence) + " < 0.6, enter LOW_CONFIDENCE (BR001)."
        else:
            sample.is_low_confidence = False
            sample.current_status = SampleStatus.MODEL_VERSION_UPDATED
            comment = "Model v" + old_version + " -> v" + new_version + ", enter MODEL_VERSION_UPDATED, ready for KB review."
        after = self._snapshot_sample(sample)
        self._add_history(sample, ChangeType.MODEL_VERSION_UPDATE, operator, before, after, manual_edits, comment)
        return sample

    def rollback_to_status(self, sample_id, target_status, operator, reason):
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)
        sample.current_status = target_status
        after = self._snapshot_sample(sample)
        self._add_history(sample, ChangeType.ROLLBACK, operator, before, after, None,
            "Rollback to " + target_status.value + ", reason: " + reason + " (BR004, keep all history).")
        return sample

    def kb_editor_review(self, sample_id, editor_name, final_status, kb_notes=None):
        sample = self.samples[sample_id]
        self._validate_before_kb_review(sample, editor_name, final_status)
        before = self._snapshot_sample(sample)
        sample.current_status = final_status
        if kb_notes:
            sample.kb_editor_notes = kb_notes
        after = self._snapshot_sample(sample)
        mvs = ", ".join(m.version for m in sample.model_outputs)
        self._add_history(sample, ChangeType.STATUS_CHANGE, editor_name, before, after, None,
            "KB editor " + editor_name + " review done: " + final_status.value +
            ". Evidence: " + str(len(sample.model_outputs)) + " model outputs (" + mvs + ").")
        return sample

    def get_manager_review_delta(self, sample_id):
        sample = self.samples.get(sample_id)
        if not sample:
            return None
        mrr = [r for r in sample.history if r.change_type == ChangeType.MANAGER_REVIEW]
        if not mrr:
            return None
        deltas = []
        for r in mrr:
            deltas.append({
                "record_id": r.record_id,
                "timestamp": r.timestamp,
                "operator": r.operator,
                "comment": r.comment,
                "before_status": r.before_snapshot.get("current_status"),
                "after_status": r.after_snapshot.get("current_status"),
                "before_annotation": r.before_snapshot.get("current_annotation"),
                "after_annotation": r.after_snapshot.get("current_annotation"),
                "manual_edits": [
                    {"field": e.field_changed or e.field, "old_value": e.old_value,
                     "new_value": e.new_value, "reason": e.reason}
                    for e in r.manual_edits
                ],
            })
        mar = [r for r in sample.history
               if r.change_type in (ChangeType.MODEL_OUTPUT_ADD, ChangeType.MODEL_VERSION_UPDATE)]
        mds = []
        for r in mar:
            mds.append({
                "record_id": r.record_id,
                "timestamp": r.timestamp,
                "operator": r.operator,
                "comment": r.comment,
                "before_model_count": r.before_snapshot.get("model_outputs_count", 0),
                "after_model_count": r.after_snapshot.get("model_outputs_count", 0),
                "before_has_model": r.before_snapshot.get("has_model_output", False),
                "after_has_model": r.after_snapshot.get("has_model_output", False),
            })
        return {
            "sample_id": sample_id,
            "current_status": sample.current_status.value,
            "has_model_output": len(sample.model_outputs) > 0,
            "manager_review_deltas": deltas,
            "model_output_deltas": mds,
            "can_proceed_to_kb_review": (
                len(sample.model_outputs) > 0
                and sample.current_status in REQUIRED_STATUSES_BEFORE_KB_REVIEW
            ),
        }

    def get_sample_history(self, sample_id):
        return self.samples[sample_id].history

    def get_sample_by_id(self, sample_id):
        return self.samples.get(sample_id)

    def get_samples_by_status(self, status):
        return [s for s in self.samples.values() if s.current_status == status]

    def get_low_confidence_samples(self):
        return [s for s in self.samples.values() if s.is_low_confidence]

    def get_stats(self):
        sc = defaultdict(int)
        for s in self.samples.values():
            sc[s.current_status.value] += 1
        return {
            "total_samples": len(self.samples),
            "low_confidence_count": len(self.get_low_confidence_samples()),
            "status_distribution": dict(sc),
            "total_history_records": sum(len(s.history) for s in self.samples.values()),
            "samples_with_model_output": sum(1 for s in self.samples.values() if len(s.model_outputs) > 0),
            "samples_without_model_output": sum(1 for s in self.samples.values() if len(s.model_outputs) == 0),
        }

    def generate_consistency_report(self):
        samples_report = []
        for sample_id, sample in self.samples.items():
            delta = self.get_manager_review_delta(sample_id)
            samples_report.append({
                "sample_id": sample.sample_id,
                "video_id": sample.video_id,
                "original_source": sample.original_annotation.source_file + "#L" + str(sample.original_annotation.line_number),
                "original_annotator": sample.original_annotation.annotator_name,
                "original_conclusion": sample.original_annotation.conclusion,
                "current_annotation": sample.current_annotation,
                "current_status": sample.current_status.value,
                "has_model_output": len(sample.model_outputs) > 0,
                "model_output_versions": [m.version for m in sample.model_outputs],
                "is_low_confidence": sample.is_low_confidence,
                "manager_notes": sample.manager_notes,
                "kb_editor_notes": sample.kb_editor_notes,
                "history_record_count": len(sample.history),
                "can_proceed_to_kb_review": delta["can_proceed_to_kb_review"] if delta else False,
                "evidence_chain_complete": (
                    len(sample.model_outputs) > 0
                    and sample.current_status in REQUIRED_STATUSES_BEFORE_KB_REVIEW.union({
                        SampleStatus.CONFIRMED_VIOLATION, SampleStatus.CONFIRMED_NORMAL,
                        SampleStatus.NEEDS_REVIEW, SampleStatus.MANAGER_REVIEWED,
                        SampleStatus.ROLLED_BACK
                    })
                ),
            })
        stats = self.get_stats()
        boundary_rules_report = []
        for r in self.boundary_rules:
            boundary_rules_report.append({
                "rule_id": r.rule_id,
                "name": r.name,
                "description": r.description,
                "condition": r.condition,
                "action": r.action,
                "rollback_supported": r.rollback_supported,
            })
        return {
            "report_generated_at": datetime.now().isoformat(),
            "stats": stats,
            "boundary_rules": boundary_rules_report,
            "required_kb_review_statuses": [s.value for s in REQUIRED_STATUSES_BEFORE_KB_REVIEW],
            "samples": samples_report,
        }

    def export_report_json(self, output_path=None):
        report = self.generate_consistency_report()
        js = json.dumps(report, ensure_ascii=False, indent=2, default=str)
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(js)
        return js
