from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

from .models import (
    Annotation,
    ConflictCase,
    EvalLog,
    EvalResult,
    EvidenceLink,
    Judgement,
    RerunDiff,
    RunSummary,
    Stratum,
    ThresholdNote,
)
from .store import Store


_STRATUM_IMP_RULES: list[tuple[int, Stratum]] = [
    (100000, Stratum.HIGH_VOLUME),
    (10000, Stratum.MID_VOLUME),
    (1, Stratum.LOW_VOLUME),
]


def classify_stratum(log: EvalLog) -> Stratum:
    if log.impressions is None or log.impressions == 0:
        return Stratum.NEW_CREATIVE
    for threshold, stratum in _STRATUM_IMP_RULES:
        if log.impressions >= threshold:
            return stratum
    return Stratum.UNCLASSIFIED


def _check_threshold(
    metric_name: str, value: Optional[float], operator: str, threshold: float
) -> Optional[bool]:
    if value is None:
        return None
    ops: dict[str, Any] = {
        ">=": lambda a, b: a >= b,
        "<=": lambda a, b: a <= b,
        ">": lambda a, b: a > b,
        "<": lambda a, b: a < b,
        "==": lambda a, b: abs(a - b) < 1e-9,
        "!=": lambda a, b: abs(a - b) >= 1e-9,
    }
    op_fn = ops.get(operator)
    if op_fn is None:
        return None
    return op_fn(value, threshold)


class Engine:
    def __init__(self, store: Store) -> None:
        self.store = store

    def ingest_eval_log(self, log: EvalLog) -> EvalLog:
        existing = self.store.get_eval_log(log.log_id)
        if existing is not None:
            return existing
        log.ingested_at = datetime.now()
        self.store.upsert_eval_log(log)
        return log

    def ingest_annotation(self, ann: Annotation) -> Annotation:
        existing = self.store.find_annotation(ann.creative_id, ann.arm_name)
        if existing is not None:
            if existing.annotation_id != ann.annotation_id:
                ann.annotation_id = existing.annotation_id
            ann.ingested_at = datetime.now()
        self.store.upsert_annotation(ann)
        return ann

    def ingest_threshold_note(self, note: ThresholdNote) -> ThresholdNote:
        note.ingested_at = datetime.now()
        self.store.upsert_threshold_note(note)
        return note

    def ingest_conflict_case(self, cc: ConflictCase) -> ConflictCase:
        cc.ingested_at = datetime.now()
        self.store.upsert_conflict_case(cc)
        return cc

    def _resolve_latest_logs(self, logs: list[EvalLog]) -> tuple[list[EvalLog], dict[str, str]]:
        grouped: dict[str, list[EvalLog]] = defaultdict(list)
        for log in logs:
            key = f"{log.creative_id}:{log.arm_name}"
            grouped[key].append(log)

        latest_logs: list[EvalLog] = []
        superseded_map: dict[str, str] = {}

        for fp, group in grouped.items():
            sorted_group = sorted(
                group,
                key=lambda x: (x.log_timestamp is not None, x.log_timestamp or x.ingested_at),
                reverse=True,
            )
            latest_logs.append(sorted_group[0])
            for old_log in sorted_group[1:]:
                superseded_map[old_log.log_id] = sorted_group[0].log_id

        return latest_logs, superseded_map

    def evaluate(self, run_id: Optional[str] = None) -> RunSummary:
        if run_id is None:
            run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

        all_logs = self.store.list_eval_logs()
        threshold_notes = self.store.list_threshold_notes()
        conflicts = self.store.list_conflict_cases()
        conflict_map: dict[str, ConflictCase] = {}
        for c in conflicts:
            key = f"{c.creative_id}:{c.arm_name}"
            conflict_map[key] = c

        latest_logs, superseded_map = self._resolve_latest_logs(all_logs)
        latest_set = {log.log_id for log in latest_logs}

        results: list[EvalResult] = []
        stratum_counts: dict[str, int] = defaultdict(int)
        judgement_counts: dict[str, int] = defaultdict(int)
        duplicate_count = len(all_logs) - len(latest_logs)
        null_count = 0
        exception_count = 0
        conflict_count = 0

        for log in all_logs:
            is_superseded = log.log_id not in latest_set
            superseded_by = superseded_map.get(log.log_id)

            if log.has_nulls and not is_superseded:
                null_count += 1

            if not is_superseded:
                stratum = classify_stratum(log)
                stratum_counts[stratum.value] += 1
            else:
                stratum = classify_stratum(log)

            evidence_links: list[EvidenceLink] = []
            evidence_links.append(
                EvidenceLink(
                    source_type="eval_log",
                    source_id=log.log_id,
                    source_file=log.source_file,
                    detail=f"原始评测日志 impressions={log.impressions}",
                )
            )

            annotation = self.store.find_annotation(log.creative_id, log.arm_name)
            if annotation is not None:
                evidence_links.append(
                    EvidenceLink(
                        source_type="annotation",
                        source_id=annotation.annotation_id,
                        source_file=annotation.source_file,
                        detail=f"标注标签={annotation.label} 标注人={annotation.annotator}",
                    )
                )

            metric_values: dict[str, Optional[float]] = {
                "impressions": float(log.impressions) if log.impressions is not None else None,
                "clicks": float(log.clicks) if log.clicks is not None else None,
                "conversions": log.conversions,
                "revenue": log.revenue,
                "ctr": log.ctr,
                "cvr": log.cvr,
            }

            threshold_results: list[dict[str, Any]] = []
            pass_count = 0
            fail_count = 0
            null_metric_count = 0

            relevant_notes = [
                n for n in threshold_notes if n.stratum == stratum.value or n.stratum == "*"
            ]

            for note in relevant_notes:
                val = metric_values.get(note.metric)
                check = _check_threshold(note.metric, val, note.operator, note.threshold)
                threshold_results.append(
                    {
                        "metric": note.metric,
                        "value": val,
                        "operator": note.operator,
                        "threshold": note.threshold,
                        "passed": check,
                        "note_id": note.note_id,
                        "note_source": note.source_file,
                    }
                )
                evidence_links.append(
                    EvidenceLink(
                        source_type="threshold_note",
                        source_id=note.note_id,
                        source_file=note.source_file,
                        detail=f"{note.metric} {note.operator} {note.threshold}: {'通过' if check else '未通过' if check is False else '无法判定'}",
                    )
                )
                if check is True:
                    pass_count += 1
                elif check is False:
                    fail_count += 1
                else:
                    null_metric_count += 1

            is_superseded = log.log_id in superseded_map
            superseded_by = superseded_map.get(log.log_id)

            conflict_key = f"{log.creative_id}:{log.arm_name}"
            conflict = conflict_map.get(conflict_key)
            is_exception = False
            exception_reason = ""

            if is_superseded:
                is_exception = True
                exception_reason = f"已被更新日志替代(→{superseded_by})"

            if conflict is not None:
                conflict_count += 1
                is_exception = True
                exception_reason += ("; " if exception_reason else "") + f"冲突案例: {conflict.reason}"
                evidence_links.append(
                    EvidenceLink(
                        source_type="conflict_case",
                        source_id=conflict.conflict_id,
                        source_file=conflict.source_file,
                        detail=f"评测判定={conflict.eval_judgement} 标注={conflict.annotation_label} 原因={conflict.reason}",
                    )
                )

            if log.has_nulls:
                is_exception = True
                exception_reason += ("; " if exception_reason else "") + "存在空值指标"

            if is_exception:
                exception_count += 1

            if is_superseded:
                judgement = Judgement.SKIPPED
            elif conflict is not None:
                judgement = Judgement.CONFLICT
            elif null_metric_count > 0 and fail_count == 0:
                judgement = Judgement.BORDERLINE
            elif fail_count > 0:
                judgement = Judgement.FAIL
            else:
                judgement = Judgement.PASS

            if annotation is not None:
                label_judgement_map = {
                    "pass": Judgement.PASS,
                    "fail": Judgement.FAIL,
                    "borderline": Judgement.BORDERLINE,
                }
                annotation_judgement = label_judgement_map.get(annotation.label.lower())
                if (
                    annotation_judgement is not None
                    and judgement != annotation_judgement
                    and judgement not in (Judgement.CONFLICT, Judgement.SKIPPED)
                ):
                    is_exception = True
                    exception_reason += (
                        "; " if exception_reason else ""
                    ) + f"自动判定={judgement.value}与标注={annotation.label}不一致"
                    judgement = Judgement.CONFLICT
                    conflict_count += 1
                    exception_count += 1

            judgement_counts[judgement.value] += 1

            result = EvalResult(
                result_id=f"r_{uuid.uuid4().hex[:8]}",
                creative_id=log.creative_id,
                arm_name=log.arm_name,
                judgement=judgement,
                stratum=stratum,
                metric_values=metric_values,
                threshold_results=threshold_results,
                evidence_links=evidence_links,
                is_duplicate=is_superseded,
                duplicate_of=superseded_by,
                is_exception=is_exception,
                exception_reason=exception_reason,
                run_id=run_id,
                source_log_id=log.log_id,
                source_file=log.source_file,
                evaluated_at=datetime.now(),
            )
            self.store.insert_eval_result(result)
            results.append(result)

        summary = RunSummary(
            run_id=run_id,
            total_samples=len(all_logs),
            unique_samples=len(latest_logs),
            duplicate_count=duplicate_count,
            null_count=null_count,
            exception_count=exception_count,
            stratum_counts=dict(stratum_counts),
            judgement_counts=dict(judgement_counts),
            conflict_count=conflict_count,
            evaluated_at=datetime.now(),
        )
        self.store.insert_run_summary(summary)
        return summary

    def rerun_diff(
        self, current_run_id: Optional[str] = None, previous_run_id: Optional[str] = None
    ) -> RerunDiff:
        run_ids = self.store.list_run_ids()
        if len(run_ids) < 2:
            raise ValueError("至少需要两次评测才能对比，当前不足两次")

        if current_run_id is None:
            current_run_id = run_ids[0]
        if previous_run_id is None:
            for rid in run_ids:
                if rid != current_run_id:
                    previous_run_id = rid
                    break

        current_results = self.store.list_results_by_run(current_run_id)
        previous_results = self.store.list_results_by_run(previous_run_id)

        current_map: dict[str, EvalResult] = {r.fingerprint: r for r in current_results}
        previous_map: dict[str, EvalResult] = {r.fingerprint: r for r in previous_results}

        current_keys = set(current_map.keys())
        previous_keys = set(previous_map.keys())

        sample_added = sorted(current_keys - previous_keys)
        sample_removed = sorted(previous_keys - current_keys)
        common_keys = current_keys & previous_keys

        sample_changed: list[dict[str, Any]] = []
        metric_only_changes: list[dict[str, Any]] = []
        sample_only_changes: list[dict[str, Any]] = []
        metric_diffs: list[dict[str, Any]] = []

        for key in sorted(common_keys):
            curr = current_map[key]
            prev = previous_map[key]

            metric_delta: dict[str, Any] = {}
            metric_changed = False
            for m, v in curr.metric_values.items():
                pv = prev.metric_values.get(m)
                if v != pv:
                    metric_changed = True
                metric_delta[m] = {
                    "current": v,
                    "previous": pv,
                    "delta": (v - pv) if v is not None and pv is not None else None,
                }

            if metric_changed:
                metric_diffs.append(
                    {
                        "fingerprint": key,
                        "creative_id": curr.creative_id,
                        "arm_name": curr.arm_name,
                        "metrics": metric_delta,
                    }
                )

            judgement_changed = curr.judgement != prev.judgement
            stratum_changed = curr.stratum != prev.stratum
            exception_changed = curr.is_exception != prev.is_exception

            structure_changed = stratum_changed or exception_changed

            if judgement_changed or structure_changed or metric_changed:
                sample_changed.append(
                    {
                        "fingerprint": key,
                        "creative_id": curr.creative_id,
                        "arm_name": curr.arm_name,
                        "judgement_changed": judgement_changed,
                        "previous_judgement": prev.judgement.value,
                        "current_judgement": curr.judgement.value,
                        "stratum_changed": stratum_changed,
                        "previous_stratum": prev.stratum.value,
                        "current_stratum": curr.stratum.value,
                        "exception_changed": exception_changed,
                        "metric_changed": metric_changed,
                    }
                )

            if metric_changed and not structure_changed and not judgement_changed:
                metric_only_changes.append(
                    {
                        "fingerprint": key,
                        "creative_id": curr.creative_id,
                        "arm_name": curr.arm_name,
                        "metrics": metric_delta,
                    }
                )

            if (structure_changed or judgement_changed) and not metric_changed:
                sample_only_changes.append(
                    {
                        "fingerprint": key,
                        "creative_id": curr.creative_id,
                        "arm_name": curr.arm_name,
                        "judgement_changed": judgement_changed,
                        "stratum_changed": stratum_changed,
                        "exception_changed": exception_changed,
                    }
                )

        summary = {
            "current_run_id": current_run_id,
            "previous_run_id": previous_run_id,
            "total_current": len(current_results),
            "total_previous": len(previous_results),
            "samples_added_count": len(sample_added),
            "samples_removed_count": len(sample_removed),
            "samples_changed_count": len(sample_changed),
            "metric_only_change_count": len(metric_only_changes),
            "sample_only_change_count": len(sample_only_changes),
            "metric_diff_count": len(metric_diffs),
        }

        diff = RerunDiff(
            current_run_id=current_run_id,
            previous_run_id=previous_run_id,
            metric_diffs=metric_diffs,
            sample_added=sample_added,
            sample_removed=sample_removed,
            sample_changed=sample_changed,
            metric_only_changes=metric_only_changes,
            sample_only_changes=sample_only_changes,
            summary=summary,
        )
        self.store.insert_rerun_diff(diff)
        return diff

    def trace(self, creative_id: str, arm_name: str, run_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        if run_id is None:
            run_id = self.store.get_latest_run_id()
        if run_id is None:
            return None

        result = self.store.find_result_by_creative_arm(creative_id, arm_name, run_id)
        if result is None:
            return None

        log = self.store.get_eval_log(result.source_log_id)
        annotation = self.store.find_annotation(creative_id, arm_name)
        conflict = self.store.find_conflict(creative_id, arm_name)

        return {
            "result": result,
            "source_log": log,
            "annotation": annotation,
            "conflict": conflict,
        }
