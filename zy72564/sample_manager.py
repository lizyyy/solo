from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
import hashlib
import json

from models import (
    EvalSample,
    ChangeRecord,
    SampleStatus,
    ChangeType,
    ScoreGapLevel,
)


BUCKET_THRESHOLDS = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]


def score_to_bucket(score: float) -> int:
    for i, threshold in enumerate(BUCKET_THRESHOLDS):
        if score < threshold:
            return i - 1
    return len(BUCKET_THRESHOLDS) - 2


def calculate_score_gap(
    offline_score: Optional[float],
    online_score: Optional[float],
) -> Tuple[Optional[int], Optional[int], ScoreGapLevel]:
    if offline_score is None or online_score is None:
        return None, None, ScoreGapLevel.NONE

    bucket_off = score_to_bucket(offline_score)
    bucket_on = score_to_bucket(online_score)
    diff = abs(bucket_off - bucket_on)

    if diff == 0:
        gap = ScoreGapLevel.NONE
    elif diff == 1:
        gap = ScoreGapLevel.ONE_BUCKET
    else:
        gap = ScoreGapLevel.MULTI_BUCKET

    return bucket_off, bucket_on, gap


class SampleStore:
    def __init__(self):
        self._samples: Dict[str, EvalSample] = {}
        self._changes: List[ChangeRecord] = []
        self._import_keys: Dict[str, str] = {}

    def _make_import_key(self, slice_id: str, original_row_number: int) -> str:
        raw = f"{slice_id}:{original_row_number}"
        return hashlib.md5(raw.encode()).hexdigest()

    def get_sample(self, sample_id: str) -> Optional[EvalSample]:
        return self._samples.get(sample_id)

    def get_sample_by_import_key(self, slice_id: str, original_row_number: int) -> Optional[EvalSample]:
        key = self._make_import_key(slice_id, original_row_number)
        sample_id = self._import_keys.get(key)
        return self._samples.get(sample_id) if sample_id else None

    def list_samples(self, slice_id: Optional[str] = None, status: Optional[SampleStatus] = None) -> List[EvalSample]:
        result = list(self._samples.values())
        if slice_id:
            result = [s for s in result if s.slice_id == slice_id]
        if status:
            result = [s for s in result if s.status == status]
        return sorted(result, key=lambda s: s.original_row_number)

    def list_changes(self, sample_id: Optional[str] = None) -> List[ChangeRecord]:
        result = self._changes
        if sample_id:
            result = [c for c in result if c.sample_id == sample_id]
        return sorted(result, key=lambda c: c.changed_at)

    def _add_change(self, change: ChangeRecord):
        self._changes.append(change)

    def add_sample(self, sample: EvalSample, operator: str = "system"):
        self._samples[sample.sample_id] = sample
        import_key = self._make_import_key(sample.slice_id, sample.original_row_number)
        self._import_keys[import_key] = sample.sample_id

        change = ChangeRecord(
            sample_id=sample.sample_id,
            change_type=ChangeType.CREATE,
            old_value=None,
            new_value=sample.to_dict(),
            changed_by=operator,
            remark="首次导入评测切片",
        )
        self._add_change(change)

    def update_sample_field(
        self,
        sample_id: str,
        field_name: str,
        new_value: Any,
        change_type: ChangeType,
        operator: str = "system",
        remark: Optional[str] = None,
    ) -> bool:
        sample = self._samples.get(sample_id)
        if not sample:
            return False

        old_value = getattr(sample, field_name, None)

        if old_value == new_value:
            return False

        change = ChangeRecord(
            sample_id=sample_id,
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=operator,
            remark=remark,
        )
        self._add_change(change)

        setattr(sample, field_name, new_value)
        sample.updated_at = datetime.now()
        sample.updated_by = operator

        return True

    def update_sample_status(
        self,
        sample_id: str,
        new_status: SampleStatus,
        operator: str = "system",
        remark: Optional[str] = None,
    ) -> bool:
        return self.update_sample_field(
            sample_id=sample_id,
            field_name="status",
            new_value=new_status,
            change_type=ChangeType.STATUS_CHANGE,
            operator=operator,
            remark=remark,
        )


class ActiveLearningSampler:
    def __init__(self, store: Optional[SampleStore] = None):
        self.store = store or SampleStore()

    def import_slice(
        self,
        slice_id: str,
        rows: List[Dict[str, Any]],
        operator: str = "linjie",
    ) -> Dict[str, Any]:
        imported = 0
        skipped = 0
        sample_ids = []

        for idx, row in enumerate(rows):
            original_row = row.get("original_row_number", idx + 1)

            existing = self.store.get_sample_by_import_key(slice_id, original_row)
            if existing:
                skipped += 1
                sample_ids.append(existing.sample_id)
                continue

            sample_id = f"{slice_id}_row_{original_row}"
            sample = EvalSample(
                sample_id=sample_id,
                original_row_number=original_row,
                slice_id=slice_id,
                offline_score=row.get("offline_score"),
                online_score=row.get("online_score"),
                remark=row.get("remark"),
                created_by=operator,
                updated_by=operator,
                metadata=row.get("metadata", {}),
            )

            if sample.offline_score is not None and sample.online_score is not None:
                b_off, b_on, gap = calculate_score_gap(sample.offline_score, sample.online_score)
                sample.score_bucket_offline = b_off
                sample.score_bucket_online = b_on
                sample.score_gap_level = gap

            self.store.add_sample(sample, operator=operator)
            imported += 1
            sample_ids.append(sample.sample_id)

        return {
            "slice_id": slice_id,
            "imported": imported,
            "skipped_duplicate": skipped,
            "total": len(rows),
            "sample_ids": sample_ids,
        }

    def add_feature_snapshot(
        self,
        sample_id: str,
        feature_snapshot_id: str,
        operator: str = "linjie",
        remark: Optional[str] = None,
    ) -> bool:
        sample = self.store.get_sample(sample_id)
        if not sample:
            return False

        if sample.status not in (SampleStatus.IMPORTED, SampleStatus.FEATURE_ADDED):
            return False

        updated = self.store.update_sample_field(
            sample_id=sample_id,
            field_name="feature_snapshot_id",
            new_value=feature_snapshot_id,
            change_type=ChangeType.UPDATE_FEATURE,
            operator=operator,
            remark=remark or "补充特征快照编号",
        )

        if updated and sample.status == SampleStatus.IMPORTED:
            self.store.update_sample_status(
                sample_id=sample_id,
                new_status=SampleStatus.FEATURE_ADDED,
                operator=operator,
                remark="特征快照已补充，进入下一阶段",
            )

        return True

    def update_experiment_scores(
        self,
        sample_id: str,
        offline_score: Optional[float] = None,
        online_score: Optional[float] = None,
        operator: str = "linjie",
        remark: Optional[str] = None,
    ) -> Dict[str, Any]:
        sample = self.store.get_sample(sample_id)
        if not sample:
            return {"success": False, "reason": "sample not found"}

        if sample.status not in (SampleStatus.FEATURE_ADDED, SampleStatus.EXPERIMENT_UPDATED, SampleStatus.PENDING_REVIEW):
            return {"success": False, "reason": f"invalid status: {sample.status}"}

        fields_updated = False

        if offline_score is not None and offline_score != sample.offline_score:
            self.store.update_sample_field(
                sample_id=sample_id,
                field_name="offline_score",
                new_value=offline_score,
                change_type=ChangeType.UPDATE_EXPERIMENT,
                operator=operator,
                remark=remark or "更新离线实验分数",
            )
            fields_updated = True

        if online_score is not None and online_score != sample.online_score:
            self.store.update_sample_field(
                sample_id=sample_id,
                field_name="online_score",
                new_value=online_score,
                change_type=ChangeType.UPDATE_EXPERIMENT,
                operator=operator,
                remark=remark or "更新线上实验分数",
            )
            fields_updated = True

        current_off = offline_score if offline_score is not None else sample.offline_score
        current_on = online_score if online_score is not None else sample.online_score

        if current_off is not None and current_on is not None:
            b_off, b_on, gap = calculate_score_gap(current_off, current_on)

            if b_off != sample.score_bucket_offline:
                self.store.update_sample_field(
                    sample_id=sample_id,
                    field_name="score_bucket_offline",
                    new_value=b_off,
                    change_type=ChangeType.UPDATE_EXPERIMENT,
                    operator=operator,
                )

            if b_on != sample.score_bucket_online:
                self.store.update_sample_field(
                    sample_id=sample_id,
                    field_name="score_bucket_online",
                    new_value=b_on,
                    change_type=ChangeType.UPDATE_EXPERIMENT,
                    operator=operator,
                )

            if gap != sample.score_gap_level:
                self.store.update_sample_field(
                    sample_id=sample_id,
                    field_name="score_gap_level",
                    new_value=gap,
                    change_type=ChangeType.UPDATE_EXPERIMENT,
                    operator=operator,
                )

            sample = self.store.get_sample(sample_id)

            if gap == ScoreGapLevel.ONE_BUCKET:
                target_status = SampleStatus.PENDING_REVIEW
                status_remark = "离线线上分差1个桶，转评测运营复核"
            elif gap == ScoreGapLevel.MULTI_BUCKET:
                target_status = SampleStatus.PENDING_REVIEW
                status_remark = "离线线上分差多个桶，转评测运营复核"
            else:
                target_status = SampleStatus.EXPERIMENT_UPDATED
                status_remark = "实验分数更新完成，分差正常"

            if sample.status != target_status:
                self.store.update_sample_status(
                    sample_id=sample_id,
                    new_status=target_status,
                    operator=operator,
                    remark=status_remark,
                )
        else:
            if fields_updated and sample.status == SampleStatus.FEATURE_ADDED:
                self.store.update_sample_status(
                    sample_id=sample_id,
                    new_status=SampleStatus.EXPERIMENT_UPDATED,
                    operator=operator,
                    remark="实验分数更新完成",
                )

        return {"success": True, "needs_review": sample.status == SampleStatus.PENDING_REVIEW}

    def update_remark(
        self,
        sample_id: str,
        remark: str,
        operator: str = "linjie",
    ) -> bool:
        return self.store.update_sample_field(
            sample_id=sample_id,
            field_name="remark",
            new_value=remark,
            change_type=ChangeType.UPDATE_REMARK,
            operator=operator,
            remark="更新备注",
        )

    def review_decision(
        self,
        sample_id: str,
        approved: bool,
        operator: str = "operation",
        review_remark: Optional[str] = None,
    ) -> bool:
        sample = self.store.get_sample(sample_id)
        if not sample or sample.status != SampleStatus.PENDING_REVIEW:
            return False

        new_status = SampleStatus.REVIEW_APPROVED if approved else SampleStatus.REVIEW_REJECTED
        remark = "复核通过" if approved else "复核驳回"
        if review_remark:
            remark += f": {review_remark}"

        change = ChangeRecord(
            sample_id=sample_id,
            change_type=ChangeType.REVIEW_DECISION,
            field_name="review_result",
            old_value="pending_review",
            new_value="approved" if approved else "rejected",
            changed_by=operator,
            remark=remark,
        )
        self.store._add_change(change)

        return self.store.update_sample_status(
            sample_id=sample_id,
            new_status=new_status,
            operator=operator,
            remark=remark,
        )

    def rollback(
        self,
        sample_id: str,
        target_status: SampleStatus,
        operator: str = "operation",
        rollback_remark: Optional[str] = None,
    ) -> bool:
        sample = self.store.get_sample(sample_id)
        if not sample:
            return False

        remark = rollback_remark or f"回滚到状态: {target_status.value}"
        change = ChangeRecord(
            sample_id=sample_id,
            change_type=ChangeType.ROLLBACK,
            field_name="status",
            old_value=sample.status.value,
            new_value=target_status.value,
            changed_by=operator,
            remark=remark,
        )
        self.store._add_change(change)

        return self.store.update_sample_status(
            sample_id=sample_id,
            new_status=target_status,
            operator=operator,
            remark=remark,
        )

    def get_sample_history(self, sample_id: str) -> List[Dict[str, Any]]:
        changes = self.store.list_changes(sample_id=sample_id)
        return [c.to_dict() for c in changes]

    def get_samples_pending_review(self, slice_id: Optional[str] = None) -> List[EvalSample]:
        return self.store.list_samples(slice_id=slice_id, status=SampleStatus.PENDING_REVIEW)
