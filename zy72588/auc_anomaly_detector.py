import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import copy

from models import (
    ThresholdNote, ExperimentBucket, StratificationMetric,
    StratificationMetricsRecord, SelfCheckResult, ConflictEvidence,
    ConflictRecord, ConflictStatus, MaterialType
)
from errors import (
    DuplicateImportError, ThresholdMismatchError, ConflictUnresolvedError,
    MaterialTypeError, ExportConsistencyError, StepOrderError
)


class AUCLayerAnomalyDetector:
    def __init__(self):
        self._threshold_notes: Dict[str, ThresholdNote] = {}
        self._threshold_history: Dict[str, List[Tuple[int, Dict[str, float]]]] = {}
        self._experiment_buckets: Dict[str, ExperimentBucket] = {}
        self._metrics_records: Dict[str, StratificationMetricsRecord] = {}
        self._conflicts: Dict[str, ConflictRecord] = {}
        self._history: List[Tuple[datetime, str, str]] = []
        self._current_step: int = 0

    def _log_history(self, action: str, detail: str):
        self._history.append((datetime.now(), action, detail))

    def import_threshold_note(self, note: ThresholdNote) -> Tuple[str, List[SelfCheckResult]]:
        if note.note_id in self._threshold_notes:
            existing = self._threshold_notes[note.note_id]
            raise DuplicateImportError(note.note_id, existing.version, note.version)

        note.import_time = datetime.now()
        self._threshold_notes[note.note_id] = note

        base_note_id = note.note_id.split("_supp_")[0]
        if base_note_id not in self._threshold_history:
            self._threshold_history[base_note_id] = []
        self._threshold_history[base_note_id].append((note.version, dict(note.thresholds)))

        self._log_history("导入阈值调参笔记", f"笔记ID: {note.note_id}, 版本: {note.version}")

        check_results = self._run_self_checks_on_import(note)
        self._current_step = 1
        return note.note_id, check_results

    def import_supplementary_note(self, note: ThresholdNote, original_note_id: str) -> Tuple[str, List[SelfCheckResult]]:
        if original_note_id not in self._threshold_notes:
            raise StepOrderError("补录阈值调参笔记", "先导入原始笔记")

        note.is_supplementary = True
        note.original_note_id = original_note_id
        note.import_time = datetime.now()

        new_note_id = f"{note.note_id}_supp_{uuid.uuid4().hex[:8]}"
        note.note_id = new_note_id
        self._threshold_notes[new_note_id] = note

        base_note_id = original_note_id.split("_supp_")[0]
        if base_note_id not in self._threshold_history:
            self._threshold_history[base_note_id] = []
        self._threshold_history[base_note_id].append((note.version, dict(note.thresholds)))

        self._log_history("补录阈值调参笔记", f"原始笔记ID: {original_note_id}, 新笔记ID: {new_note_id}")
        self._current_step = 1
        return new_note_id, []

    def review_experiment_bucket(self, bucket: ExperimentBucket, reviewer: str = "阿越") -> Tuple[str, List[ConflictRecord]]:
        if self._current_step < 1:
            raise StepOrderError("实验平台负责人补看线上实验桶", "先导入阈值调参笔记")

        bucket.reviewer = reviewer
        bucket.review_time = datetime.now()
        self._experiment_buckets[bucket.bucket_id] = bucket

        self._log_history("补看线上实验桶", f"桶ID: {bucket.bucket_id}, 审核人: {reviewer}")

        conflicts = self._detect_conflicts_with_latest_note(bucket)
        for conflict in conflicts:
            self._conflicts[conflict.conflict_id] = conflict

        self._current_step = 2
        return bucket.bucket_id, conflicts

    def handle_conflict(self, conflict_id: str, status: ConflictStatus, handler: str, comment: str = ""):
        if conflict_id not in self._conflicts:
            raise ValueError(f"冲突记录 {conflict_id} 不存在")

        conflict = self._conflicts[conflict_id]
        conflict.status = status
        conflict.handler = handler
        conflict.handle_time = datetime.now()
        conflict.handle_comment = comment

        action = "确认" if status == ConflictStatus.CONFIRMED else "驳回"
        self._log_history(f"{action}冲突", f"冲突ID: {conflict_id}, 处理人: {handler}")

    def update_stratification_metrics(
        self,
        note_id: str,
        metrics: List[StratificationMetric],
        material_type: MaterialType,
        bucket_id: Optional[str] = None
    ) -> Tuple[str, List[SelfCheckResult]]:
        if self._current_step < 2:
            raise StepOrderError("更新分层指标", "先让实验平台负责人补看线上实验桶")

        pending_conflicts = [c for c in self._conflicts.values() if c.status == ConflictStatus.PENDING]
        if pending_conflicts:
            raise ConflictUnresolvedError(len(pending_conflicts))

        if note_id not in self._threshold_notes:
            raise ValueError(f"阈值调参笔记 {note_id} 不存在")

        note = self._threshold_notes[note_id]
        threshold_mismatches = self._check_threshold_mismatch(note, metrics)
        if threshold_mismatches:
            mismatches = "; ".join([f"{field}: {old}→{new}" for field, old, new in threshold_mismatches])
            self._log_history("阈值旧值告警", f"笔记ID: {note_id}, 差异: {mismatches}")
            for field, old, new in threshold_mismatches:
                raise ThresholdMismatchError(field, old, new)

        record_id = f"metrics_{uuid.uuid4().hex[:12]}"
        record = StratificationMetricsRecord(
            record_id=record_id,
            note_id=note_id,
            bucket_id=bucket_id,
            metrics=metrics,
            calc_time=datetime.now(),
            material_type=material_type
        )
        self._metrics_records[record_id] = record

        self._log_history("更新分层指标", f"记录ID: {record_id}, 材料类型: {material_type.value}")

        check_results = self._run_self_checks_on_metrics(record)
        self._current_step = 3
        return record_id, check_results

    def recalculate_after_supplement(self, original_record_id: str, new_metrics: List[StratificationMetric]) -> str:
        if original_record_id not in self._metrics_records:
            raise ValueError(f"原始指标记录 {original_record_id} 不存在")

        original = self._metrics_records[original_record_id]
        new_record_id = f"metrics_recalc_{uuid.uuid4().hex[:12]}"

        new_record = StratificationMetricsRecord(
            record_id=new_record_id,
            note_id=original.note_id,
            bucket_id=original.bucket_id,
            metrics=new_metrics,
            calc_time=datetime.now(),
            material_type=original.material_type,
            is_recalculated=True,
            original_record_id=original_record_id
        )
        self._metrics_records[new_record_id] = new_record

        self._log_history("补录后重算", f"原始记录ID: {original_record_id}, 新记录ID: {new_record_id}")
        return new_record_id

    def export_metrics(self, record_id: str) -> Dict:
        if record_id not in self._metrics_records:
            raise ValueError(f"指标记录 {record_id} 不存在")

        record = self._metrics_records[record_id]
        export_data = {
            "record_id": record.record_id,
            "note_id": record.note_id,
            "bucket_id": record.bucket_id,
            "material_type": record.material_type.value,
            "calc_time": record.calc_time.isoformat(),
            "metrics": [m.model_dump() for m in record.metrics]
        }

        consistency_check = self._check_export_consistency(record, export_data)
        if not consistency_check.passed:
            raise ExportConsistencyError(
                consistency_check.details.get("diff_fields", []) if consistency_check.details else []
            )

        return export_data

    def get_history(self) -> List[Tuple[datetime, str, str]]:
        return copy.deepcopy(self._history)

    def get_pending_conflicts(self) -> List[ConflictRecord]:
        return [c for c in self._conflicts.values() if c.status == ConflictStatus.PENDING]

    def get_note(self, note_id: str) -> Optional[ThresholdNote]:
        return self._threshold_notes.get(note_id)

    def get_metrics_record(self, record_id: str) -> Optional[StratificationMetricsRecord]:
        return self._metrics_records.get(record_id)

    def _run_self_checks_on_import(self, note: ThresholdNote) -> List[SelfCheckResult]:
        results = []
        results.append(self._check_duplicate_import(note))
        results.append(self._check_note_version_format(note))
        return results

    def _run_self_checks_on_metrics(self, record: StratificationMetricsRecord) -> List[SelfCheckResult]:
        results = []
        note = self._threshold_notes.get(record.note_id)
        if note:
            results.append(self._check_metrics_match_thresholds(note, record))
        results.append(self._check_history_consistency(record))
        return results

    def _check_duplicate_import(self, note: ThresholdNote) -> SelfCheckResult:
        count = sum(1 for n in self._threshold_notes.values()
                    if n.note_id.split("_supp_")[0] == note.note_id.split("_supp_")[0]
                    and not n.is_supplementary)
        passed = count <= 1
        return SelfCheckResult(
            check_name="重复导入检查",
            passed=passed,
            message="没有重复导入" if passed else f"检测到 {count} 次相同笔记的非补录导入",
            details={"count": count, "note_id": note.note_id}
        )

    def _check_note_version_format(self, note: ThresholdNote) -> SelfCheckResult:
        passed = note.version > 0
        return SelfCheckResult(
            check_name="版本号格式检查",
            passed=passed,
            message="版本号格式正确" if passed else "版本号必须大于0",
            details={"version": note.version}
        )

    def _check_threshold_mismatch(self, note: ThresholdNote, metrics: List[StratificationMetric]) -> List[Tuple[str, float, float]]:
        mismatches = []
        base_note_id = note.note_id.split("_supp_")[0]
        history = self._threshold_history.get(base_note_id, [])

        if len(history) <= 1:
            return mismatches

        latest_version, latest_thresholds = history[-1]
        for old_version, old_thresholds in history[:-1]:
            for layer_name, new_threshold in latest_thresholds.items():
                if layer_name not in old_thresholds:
                    continue
                old_threshold = old_thresholds[layer_name]
                if abs(new_threshold - old_threshold) < 0.0001:
                    continue

                for metric in metrics:
                    if metric.layer_name != layer_name:
                        continue

                    is_anomaly_by_new = metric.auc < new_threshold
                    is_anomaly_by_old = metric.auc < old_threshold

                    if is_anomaly_by_new and not is_anomaly_by_old and not metric.is_anomaly:
                        mismatches.append((layer_name, old_threshold, new_threshold))

        return mismatches

    def _check_metrics_match_thresholds(self, note: ThresholdNote, record: StratificationMetricsRecord) -> SelfCheckResult:
        matched_layers = set()
        for metric in record.metrics:
            if metric.layer_name in note.thresholds:
                matched_layers.add(metric.layer_name)
                threshold = note.thresholds[metric.layer_name]
                if metric.auc < threshold and not metric.is_anomaly:
                    metric.is_anomaly = True
                    metric.anomaly_reason = f"AUC({metric.auc:.4f}) 低于阈值({threshold:.4f})"

        all_layers = set(note.thresholds.keys())
        missing = all_layers - matched_layers
        passed = len(missing) == 0
        return SelfCheckResult(
            check_name="分层指标与阈值匹配检查",
            passed=passed,
            message="所有分层都有对应指标" if passed else f"缺少分层: {', '.join(missing)}",
            details={"missing_layers": list(missing)}
        )

    def _check_history_consistency(self, record: StratificationMetricsRecord) -> SelfCheckResult:
        note_exists = record.note_id in self._threshold_notes
        bucket_exists = record.bucket_id is None or record.bucket_id in self._experiment_buckets
        passed = note_exists and bucket_exists
        return SelfCheckResult(
            check_name="历史记录一致性检查",
            passed=passed,
            message="历史记录一致" if passed else "关联的笔记或实验桶不存在",
            details={"note_exists": note_exists, "bucket_exists": bucket_exists}
        )

    def _detect_conflicts_with_latest_note(self, bucket: ExperimentBucket) -> List[ConflictRecord]:
        conflicts = []
        for note_id, note in self._threshold_notes.items():
            if note.is_supplementary:
                continue
            evidences = []
            all_keys = set(note.thresholds.keys()) | set(bucket.thresholds.keys())
            for key in all_keys:
                note_val = note.thresholds.get(key)
                bucket_val = bucket.thresholds.get(key)
                if note_val is None or bucket_val is None:
                    evidences.append(ConflictEvidence(
                        field_name=key,
                        note_value=note_val,
                        bucket_value=bucket_val,
                        description=f"{'笔记' if note_val is None else '实验桶'}缺少阈值 '{key}'"
                    ))
                elif abs(note_val - bucket_val) > 0.0001:
                    evidences.append(ConflictEvidence(
                        field_name=key,
                        note_value=note_val,
                        bucket_value=bucket_val,
                        description=f"阈值 '{key}' 不一致：笔记是 {note_val}，实验桶是 {bucket_val}"
                    ))
            if evidences:
                conflict_id = f"conflict_{uuid.uuid4().hex[:12]}"
                conflicts.append(ConflictRecord(
                    conflict_id=conflict_id,
                    note_id=note_id,
                    bucket_id=bucket.bucket_id,
                    evidences=evidences
                ))
        return conflicts

    def _check_export_consistency(self, record: StratificationMetricsRecord, export_data: Dict) -> SelfCheckResult:
        diff_fields = []
        if record.record_id != export_data.get("record_id"):
            diff_fields.append("record_id")
        if record.note_id != export_data.get("note_id"):
            diff_fields.append("note_id")
        if len(record.metrics) != len(export_data.get("metrics", [])):
            diff_fields.append("metrics_count")

        passed = len(diff_fields) == 0
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=passed,
            message="导出数据一致" if passed else "导出数据与系统存储不一致",
            details={"diff_fields": diff_fields}
        )

    def validate_material_type(self, record_id: str, expected_type: MaterialType):
        record = self._metrics_records.get(record_id)
        if not record:
            raise ValueError(f"指标记录 {record_id} 不存在")
        if record.material_type != expected_type:
            raise MaterialTypeError(expected_type.value, record.material_type.value)
