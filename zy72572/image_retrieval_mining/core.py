from datetime import datetime
from typing import List, Dict, Optional, Tuple
import uuid

from .models import (
    BucketType,
    RecordStatus,
    RetrievalRecord,
    ThresholdNote,
    TrainingLog,
    TrainingLogPoint,
    ExperimentComparison,
    MiningResult,
)


class HardCaseMiner:
    def __init__(self):
        self._records: Dict[str, RetrievalRecord] = {}
        self._training_logs: Dict[str, TrainingLog] = {}
        self._threshold_notes: Dict[str, ThresholdNote] = {}
        self._comparisons: Dict[str, ExperimentComparison] = {}
        self._step_log: List[str] = []

    def _log_step(self, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        self._step_log.append(f"[{timestamp}] {message}")

    def import_training_log(
        self,
        log_id: str,
        experiment_name: str,
        points: List[Tuple[int, float, float]],
        model_version: str = "",
    ) -> TrainingLog:
        self._log_step(f"第一步: 导入训练日志曲线 - {experiment_name}")
        log_points = [
            TrainingLogPoint(step=step, train_loss=loss, val_mAP=mAP)
            for step, loss, mAP in points
        ]
        log = TrainingLog(
            log_id=log_id,
            experiment_name=experiment_name,
            points=log_points,
            model_version=model_version,
            imported=True,
        )
        self._training_logs[log_id] = log
        self._log_step(f"  已导入 {len(log_points)} 个训练点, 模型版本: {model_version or '未指定'}")
        return log

    def add_record(
        self,
        image_id: str,
        query: str,
        offline_score: float,
        online_score: float,
        training_log_id: Optional[str] = None,
        remark: str = "",
    ) -> RetrievalRecord:
        record_id = str(uuid.uuid4())[:8]
        record = RetrievalRecord(
            record_id=record_id,
            image_id=image_id,
            query=query,
            offline_score=offline_score,
            online_score=online_score,
            training_log_id=training_log_id,
            remark=remark,
        )
        self._records[record_id] = record

        if record.bucket_diff:
            self._log_step(
                f"  发现分桶差异: {image_id} 离线={record.offline_bucket.value}({offline_score:.3f}) "
                f"线上={record.online_bucket.value}({online_score:.3f}) - 标记为待复核"
            )
            record.status = RecordStatus.PENDING_REVIEW
        else:
            self._log_step(
                f"  记录正常: {image_id} 离线={record.offline_bucket.value} "
                f"线上={record.online_bucket.value}"
            )

        return record

    def add_threshold_note(
        self,
        record_id: str,
        old_offline_score: Optional[float],
        old_online_score: Optional[float],
        new_offline_score: float,
        new_online_score: float,
        caliber_note: str,
        operator: str = "阿越",
    ) -> ThresholdNote:
        note_id = str(uuid.uuid4())[:8]
        note = ThresholdNote(
            note_id=note_id,
            record_id=record_id,
            old_offline_score=old_offline_score,
            old_online_score=old_online_score,
            new_offline_score=new_offline_score,
            new_online_score=new_online_score,
            caliber_note=caliber_note,
            operator=operator,
            applied=False,
        )
        self._threshold_notes[note_id] = note
        self._log_step(
            f"第二步: {operator}补录阈值调参笔记 - 记录ID: {record_id}, "
            f"口径说明: {caliber_note}"
        )
        return note

    def apply_threshold_note(self, note_id: str) -> Optional[RetrievalRecord]:
        note = self._threshold_notes.get(note_id)
        if not note:
            return None

        record = self._records.get(note.record_id)
        if not record:
            return None

        self._log_step(f"第三步: 应用阈值调参笔记到记录 {record.image_id}")

        old_offline_bucket = record.offline_bucket
        old_online_bucket = record.online_bucket

        record.offline_score = note.new_offline_score
        record.online_score = note.new_online_score
        record.offline_bucket = BucketType.from_score(note.new_offline_score)
        record.online_bucket = BucketType.from_score(note.new_online_score)
        record.bucket_diff = record.offline_bucket != record.online_bucket
        record.threshold_note_id = note_id
        record.status = RecordStatus.OLD_CALIBER
        record.updated_at = datetime.now()
        note.applied = True

        self._log_step(
            f"  更新前: 离线={old_offline_bucket.value} 线上={old_online_bucket.value}"
        )
        self._log_step(
            f"  更新后: 离线={record.offline_bucket.value}({note.new_offline_score:.3f}) "
            f"线上={record.online_bucket.value}({note.new_online_score:.3f})"
        )

        self._update_comparisons_for_record(record.record_id)

        return record

    def _update_comparisons_for_record(self, record_id: str) -> None:
        for comp in self._comparisons.values():
            if comp.baseline_record_id == record_id:
                record = self._records[record_id]
                comp.baseline_offline_score = record.offline_score
                comp.baseline_online_score = record.online_score
            if comp.compared_record_id == record_id:
                record = self._records[record_id]
                comp.compared_offline_score = record.offline_score
                comp.compared_online_score = record.online_score
            comp.offline_delta = comp.compared_offline_score - comp.baseline_offline_score
            comp.online_delta = comp.compared_online_score - comp.baseline_online_score

    def add_experiment_comparison(
        self,
        baseline_record_id: str,
        compared_record_id: str,
        note: str = "",
    ) -> Optional[ExperimentComparison]:
        baseline = self._records.get(baseline_record_id)
        compared = self._records.get(compared_record_id)
        if not baseline or not compared:
            return None

        comp_id = str(uuid.uuid4())[:8]
        comp = ExperimentComparison(
            comparison_id=comp_id,
            baseline_record_id=baseline_record_id,
            compared_record_id=compared_record_id,
            baseline_offline_score=baseline.offline_score,
            baseline_online_score=baseline.online_score,
            compared_offline_score=compared.offline_score,
            compared_online_score=compared.online_score,
            note=note,
        )
        self._comparisons[comp_id] = comp
        self._log_step(
            f"  创建实验对比: {baseline.image_id} vs {compared.image_id}, "
            f"离线差: {comp.offline_delta:+.3f}, 线上差: {comp.online_delta:+.3f}"
        )
        return comp

    def manual_fix(
        self,
        record_id: str,
        new_offline_score: float,
        new_online_score: float,
        remark: str = "人工修正",
        operator: str = "阿越",
    ) -> Optional[RetrievalRecord]:
        record = self._records.get(record_id)
        if not record:
            return None

        self._log_step(f"人工修正: {operator}修正记录 {record.image_id}")
        record.offline_score = new_offline_score
        record.online_score = new_online_score
        record.offline_bucket = BucketType.from_score(new_offline_score)
        record.online_bucket = BucketType.from_score(new_online_score)
        record.bucket_diff = record.offline_bucket != record.online_bucket
        record.status = RecordStatus.MANUAL_FIXED
        record.remark = remark
        record.updated_at = datetime.now()

        self._update_comparisons_for_record(record_id)
        return record

    def rerun_record(
        self,
        record_id: str,
        new_offline_score: float,
        new_online_score: float,
    ) -> Optional[RetrievalRecord]:
        record = self._records.get(record_id)
        if not record:
            return None

        self._log_step(f"重跑记录: {record.image_id}")
        record.offline_score = new_offline_score
        record.online_score = new_online_score
        record.offline_bucket = BucketType.from_score(new_offline_score)
        record.online_bucket = BucketType.from_score(new_online_score)
        record.bucket_diff = record.offline_bucket != record.online_bucket
        record.status = RecordStatus.RERUN
        record.updated_at = datetime.now()

        self._update_comparisons_for_record(record_id)
        return record

    def run_mining(self) -> MiningResult:
        records = list(self._records.values())
        comparisons = list(self._comparisons.values())

        result = MiningResult(
            total_count=len(records),
            records=records,
            comparisons=comparisons,
            threshold_notes_applied=sum(
                1 for n in self._threshold_notes.values() if n.applied
            ),
        )

        for r in records:
            if r.status == RecordStatus.NORMAL:
                result.normal_count += 1
            elif r.status == RecordStatus.BUCKET_DIFF:
                result.bucket_diff_count += 1
            elif r.status == RecordStatus.PENDING_REVIEW:
                result.pending_review_count += 1
                result.bucket_diff_count += 1
            elif r.status == RecordStatus.OLD_CALIBER:
                result.old_caliber_count += 1
            elif r.status == RecordStatus.MANUAL_FIXED:
                result.manual_fixed_count += 1
            elif r.status == RecordStatus.RERUN:
                result.rerun_count += 1

        return result

    def get_step_log(self) -> List[str]:
        return list(self._step_log)

    def get_record(self, record_id: str) -> Optional[RetrievalRecord]:
        return self._records.get(record_id)

    def get_training_log(self, log_id: str) -> Optional[TrainingLog]:
        return self._training_logs.get(log_id)

    def get_threshold_note(self, note_id: str) -> Optional[ThresholdNote]:
        return self._threshold_notes.get(note_id)

    def all_records(self) -> List[RetrievalRecord]:
        return list(self._records.values())

    def all_training_logs(self) -> List[TrainingLog]:
        return list(self._training_logs.values())

    def all_threshold_notes(self) -> List[ThresholdNote]:
        return list(self._threshold_notes.values())

    def all_comparisons(self) -> List[ExperimentComparison]:
        return list(self._comparisons.values())
