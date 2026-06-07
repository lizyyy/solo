import uuid
from typing import Dict, Any, Optional
import copy

from .models import (
    EvalSlice, FeatureSnapshot, ThresholdReplayResult,
    CoverageGapRecord, RecordStatus
)
from .storage import DataStore


class ThresholdReplayEngine:
    def __init__(self, store: DataStore):
        self.store = store

    def _apply_threshold_adjustment(
        self,
        original_recall: float,
        threshold_config: Dict[str, Any],
        is_old_caliber: bool = False
    ) -> float:
        base_adjustment = threshold_config.get("recall_bonus", 0.0)
        sensitivity = threshold_config.get("sensitivity", 1.0)

        if is_old_caliber:
            adjustment = base_adjustment * sensitivity * 0.8
        else:
            adjustment = base_adjustment * sensitivity

        new_recall = min(original_recall + adjustment, 0.99)
        return round(new_recall, 4)

    def replay_with_snapshot(
        self,
        slice_id: str,
        snapshot_id: str,
        is_old_caliber: bool = False,
        note: Optional[str] = None
    ) -> Optional[ThresholdReplayResult]:
        slice_obj = self.store.get_slice(slice_id)
        snapshot = self.store.get_feature_snapshot(snapshot_id)

        if not slice_obj or not snapshot:
            return None

        replayed_recall = self._apply_threshold_adjustment(
            slice_obj.recall,
            snapshot.threshold_config,
            is_old_caliber=is_old_caliber
        )

        replay_result = ThresholdReplayResult(
            replay_id=f"replay_{uuid.uuid4().hex[:8]}",
            feature_snapshot_id=snapshot_id,
            slice_id=slice_id,
            original_recall=slice_obj.recall,
            replayed_recall=replayed_recall,
            recall_change=replayed_recall - slice_obj.recall,
            applied_threshold=copy.deepcopy(snapshot.threshold_config),
            note=note
        )

        self.store.save_threshold_replay(replay_result)
        return replay_result

    def update_gap_after_replay(
        self,
        record_id: str,
        replay_result: ThresholdReplayResult,
        is_old_caliber: bool = False
    ):
        gap = self.store.get_gap_record(record_id)
        if not gap:
            return

        new_recall_gap = gap.total_recall - replay_result.replayed_recall

        if is_old_caliber:
            new_status = RecordStatus.OLD_CALIBER
        elif new_recall_gap < 0.1:
            new_status = RecordStatus.FIXED
        else:
            new_status = RecordStatus.NEED_REVIEW

        self.store.update_gap_status(
            record_id,
            new_status,
            note=f"阈值回放: 召回率从 {replay_result.original_recall:.2%} → {replay_result.replayed_recall:.2%}"
        )

    def generate_replay_report(
        self,
        replay_results: list,
        slices: list
    ) -> str:
        slice_map = {s.slice_id: s for s in slices}
        lines = []
        lines.append("=" * 70)
        lines.append("              阈 值 回 放 结 果 报 告")
        lines.append("=" * 70)

        for replay in replay_results:
            slice_obj = slice_map.get(replay.slice_id)
            if not slice_obj:
                continue

            change_symbol = "↑" if replay.recall_change > 0 else "↓"
            lines.append("")
            lines.append(f"  切片: {slice_obj.slice_name}")
            lines.append(f"  特征快照: {replay.feature_snapshot_id}")
            lines.append(f"  原召回率: {replay.original_recall:.2%}")
            lines.append(f"  回放后召回率: {replay.replayed_recall:.2%}")
            lines.append(f"  变化: {change_symbol} {abs(replay.recall_change):.2%}")
            if replay.note:
                lines.append(f"  备注: {replay.note}")

        lines.append("")
        lines.append("=" * 70)
        return "\n".join(lines)
