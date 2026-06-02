from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass

from .models import (
    ModelOutput, Annotation, ThresholdConfig, EvaluationResult,
    Evidence, SensitiveType, DesensitizationLevel, ErrorType,
    StratifiedGroup, EvaluationSummary, ConflictCase
)


class PrivacyEvaluator:
    def __init__(self, thresholds: Dict[SensitiveType, ThresholdConfig]):
        self.thresholds = thresholds

    def _make_evidence(self, source_type: str, source_id: str, field: str,
                       value, link: Optional[str] = None) -> Evidence:
        return Evidence(
            source_type=source_type,
            source_id=source_id,
            field=field,
            value=value,
            link=link
        )

    def _match_entities(self, model_output: ModelOutput,
                        annotations: List[Annotation]) -> List[EvaluationResult]:
        results: List[EvaluationResult] = []
        rid = model_output.record_id

        record_annotations = [a for a in annotations if a.record_id == rid]
        detected_entities = model_output.detected_entities

        matched_annotations = set()
        matched_detected = set()

        for det_idx, detected in enumerate(detected_entities):
            det_type = detected["type"]
            det_start = detected.get("start", -1)
            det_end = detected.get("end", -1)
            det_value = detected.get("value", "")
            det_level = detected["level"]

            best_match = None
            best_overlap = 0

            for ann_idx, ann in enumerate(record_annotations):
                if ann_idx in matched_annotations:
                    continue

                if ann.sensitive_type != det_type:
                    continue

                overlap_start = max(det_start, ann.start_pos)
                overlap_end = min(det_end, ann.end_pos)
                overlap = max(0, overlap_end - overlap_start)

                if overlap > best_overlap:
                    best_overlap = overlap
                    best_match = (ann_idx, ann)

            if best_match:
                ann_idx, ann = best_match
                matched_annotations.add(ann_idx)
                matched_detected.add(det_idx)

                if det_level == ann.expected_level:
                    results.append(EvaluationResult(
                        record_id=rid,
                        sensitive_type=ann.sensitive_type,
                        is_correct=True,
                        model_level=det_level,
                        expected_level=ann.expected_level,
                        detected_value=det_value,
                        expected_value=ann.original_value,
                        evidences=[
                            self._make_evidence("model_output", rid, "detected_entities",
                                                {"type": det_type.value, "value": det_value,
                                                 "level": det_level.value},
                                                model_output.raw_log),
                            self._make_evidence("annotation", rid, "expected_level",
                                                ann.expected_level.value,
                                                f"ground_truth.csv#record={rid}")
                        ]
                    ))
                else:
                    results.append(EvaluationResult(
                        record_id=rid,
                        sensitive_type=ann.sensitive_type,
                        is_correct=False,
                        error_type=ErrorType.WRONG_LEVEL,
                        model_level=det_level,
                        expected_level=ann.expected_level,
                        detected_value=det_value,
                        expected_value=ann.original_value,
                        evidences=[
                            self._make_evidence("model_output", rid, "detected_entities",
                                                {"type": det_type.value, "value": det_value,
                                                 "level": det_level.value},
                                                model_output.raw_log),
                            self._make_evidence("annotation", rid, "expected_level",
                                                ann.expected_level.value,
                                                f"ground_truth.csv#record={rid}")
                        ],
                        note=f"脱敏级别不匹配：模型输出{det_level.value}，期望{ann.expected_level.value}"
                    ))
            else:
                for ann_idx, ann in enumerate(record_annotations):
                    if ann_idx in matched_annotations:
                        continue
                    overlap_start = max(det_start, ann.start_pos)
                    overlap_end = min(det_end, ann.end_pos)
                    overlap = max(0, overlap_end - overlap_start)
                    if overlap > 0:
                        matched_annotations.add(ann_idx)
                        matched_detected.add(det_idx)
                        results.append(EvaluationResult(
                            record_id=rid,
                            sensitive_type=det_type,
                            is_correct=False,
                            error_type=ErrorType.MISMATCH_TYPE,
                            model_level=det_level,
                            expected_level=ann.expected_level,
                            detected_value=det_value,
                            expected_value=ann.original_value,
                            evidences=[
                                self._make_evidence("model_output", rid, "detected_entities",
                                                    {"type": det_type.value, "value": det_value},
                                                    model_output.raw_log),
                                self._make_evidence("annotation", rid, "sensitive_type",
                                                    ann.sensitive_type.value,
                                                    f"ground_truth.csv#record={rid}")
                            ],
                            note=f"类型不匹配：模型识别为{det_type.value}，标注为{ann.sensitive_type.value}"
                        ))
                        break
                else:
                    expected_level = DesensitizationLevel.NOT_MASKED
                    results.append(EvaluationResult(
                        record_id=rid,
                        sensitive_type=det_type,
                        is_correct=False,
                        error_type=ErrorType.FALSE_POSITIVE,
                        model_level=det_level,
                        expected_level=expected_level,
                        detected_value=det_value,
                        evidences=[
                            self._make_evidence("model_output", rid, "detected_entities",
                                                {"type": det_type.value, "value": det_value,
                                                 "level": det_level.value},
                                                model_output.raw_log),
                            self._make_evidence("annotation", rid, "expected_level",
                                                "not_masked (无标注)",
                                                f"ground_truth.csv#record={rid}")
                        ],
                        note=f"误报：模型识别出{det_value}({det_type.value})，但标注中不存在"
                    ))
                    matched_detected.add(det_idx)

        for ann_idx, ann in enumerate(record_annotations):
            if ann_idx not in matched_annotations:
                results.append(EvaluationResult(
                    record_id=rid,
                    sensitive_type=ann.sensitive_type,
                    is_correct=False,
                    error_type=ErrorType.FALSE_NEGATIVE,
                    model_level=DesensitizationLevel.NOT_MASKED,
                    expected_level=ann.expected_level,
                    expected_value=ann.original_value,
                    evidences=[
                        self._make_evidence("model_output", rid, "detected_entities",
                                            "未检测到",
                                            model_output.raw_log),
                        self._make_evidence("annotation", rid, "expected_level",
                                            ann.expected_level.value,
                                            f"ground_truth.csv#record={rid}")
                    ],
                    note=f"漏检：{ann.original_value}({ann.sensitive_type.value})未被模型检测到"
                ))

        return results

    def evaluate(self, model_outputs: List[ModelOutput],
                 annotations: List[Annotation],
                 conflicts: Optional[List[ConflictCase]] = None,
                 notes: Optional[Dict[str, List[Dict]]] = None) -> EvaluationSummary:
        all_results: List[EvaluationResult] = []

        for output in model_outputs:
            if not output.original_text.strip():
                continue

            results = self._match_entities(output, annotations)
            if notes:
                for r in results:
                    if r.record_id in notes:
                        note_texts = [n["note"] for n in notes[r.record_id]]
                        if r.note:
                            r.note = r.note + "\n" + "\n".join(note_texts)
                        else:
                            r.note = "\n".join(note_texts)
            all_results.extend(results)

        return self._summarize(all_results, model_outputs, conflicts)

    def _summarize(self, results: List[EvaluationResult],
                   model_outputs: List[ModelOutput],
                   conflicts: Optional[List[ConflictCase]] = None) -> EvaluationSummary:
        tp = sum(1 for r in results if r.is_correct)
        fp = sum(1 for r in results if r.error_type == ErrorType.FALSE_POSITIVE)
        fn = sum(1 for r in results if r.error_type == ErrorType.FALSE_NEGATIVE)
        wp = sum(1 for r in results if r.error_type == ErrorType.WRONG_LEVEL)
        mt = sum(1 for r in results if r.error_type == ErrorType.MISMATCH_TYPE)

        total_errors = fp + fn + wp + mt
        total = tp + total_errors

        precision = tp / (tp + fp + wp + mt) if (tp + fp + wp + mt) > 0 else 0.0
        recall = tp / (tp + fn + wp + mt) if (tp + fn + wp + mt) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        by_type = self._stratify_by_sensitive_type(results)
        by_error = self._stratify_by_error_type(results)

        model_version = model_outputs[0].model_version if model_outputs else "unknown"

        unresolved_conflicts = []
        if conflicts:
            unresolved_conflicts = [c for c in conflicts if not c.resolved]
            for conflict in unresolved_conflicts:
                if conflict.conflict_type in by_error:
                    by_error[conflict.conflict_type.value].error_count += 1
                    by_error[conflict.conflict_type.value].error_types[ErrorType.CONFLICT.value] = \
                        by_error[conflict.conflict_type.value].error_types.get(ErrorType.CONFLICT.value, 0) + 1

        notes_list = []
        for st, th in self.thresholds.items():
            if st in by_type:
                group = by_type[st]
                t = len(group.records)
                c = sum(1 for r in group.records if r.is_correct)
                p = c / t if t > 0 else 0
                if p < th.precision_threshold:
                    notes_list.append(
                        f"[{st.value}] 准确率{p:.2%} 低于阈值{th.precision_threshold:.2%} - {th.description}"
                    )

        return EvaluationSummary(
            model_version=model_version,
            total_records=total,
            correct_count=tp,
            error_count=total_errors,
            precision=precision,
            recall=recall,
            f1_score=f1,
            by_sensitive_type=by_type,
            by_error_type=by_error,
            conflicts=unresolved_conflicts,
            notes=notes_list
        )

    def _stratify_by_sensitive_type(self, results: List[EvaluationResult]) -> Dict[str, StratifiedGroup]:
        groups: Dict[str, List[EvaluationResult]] = defaultdict(list)
        for r in results:
            groups[r.sensitive_type.value].append(r)

        result: Dict[str, StratifiedGroup] = {}
        for key, records in groups.items():
            total = len(records)
            correct = sum(1 for r in records if r.is_correct)
            errors = total - correct
            error_types: Dict[str, int] = defaultdict(int)
            for r in records:
                if r.error_type:
                    error_types[r.error_type.value] += 1

            result[key] = StratifiedGroup(
                group_key=key,
                group_name=key,
                total_count=total,
                correct_count=correct,
                error_count=errors,
                error_types=dict(error_types),
                records=records
            )
        return result

    def _stratify_by_error_type(self, results: List[EvaluationResult]) -> Dict[str, StratifiedGroup]:
        groups: Dict[str, List[EvaluationResult]] = defaultdict(list)
        for r in results:
            if r.error_type:
                groups[r.error_type.value].append(r)
            else:
                groups["correct"].append(r)

        result: Dict[str, StratifiedGroup] = {}
        for key, records in groups.items():
            total = len(records)
            correct = sum(1 for r in records if r.is_correct)
            errors = total - correct
            error_types: Dict[str, int] = defaultdict(int)
            for r in records:
                if r.error_type:
                    error_types[r.error_type.value] += 1

            result[key] = StratifiedGroup(
                group_key=key,
                group_name=key,
                total_count=total,
                correct_count=correct,
                error_count=errors,
                error_types=dict(error_types),
                records=records
            )
        return result
