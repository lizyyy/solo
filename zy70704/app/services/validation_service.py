from datetime import datetime
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from app.models import GapSegment, MetricWindow, GrayBatch
from app.models.models import OverrideStrategy, BatchStatus
import hashlib
import json


class ValidationService:
    @staticmethod
    def validate_time_window(
        window_start: datetime, window_end: datetime
    ) -> Tuple[bool, str]:
        if window_end <= window_start:
            return False, "窗口结束时间必须大于开始时间"
        return True, ""

    @staticmethod
    def validate_gap_within_window(
        gap_start: datetime, gap_end: datetime, window_start: datetime, window_end: datetime
    ) -> Tuple[bool, str]:
        if gap_start < window_start or gap_end > window_end:
            return False, "缺口时间范围必须在指标窗口范围内"
        if gap_end <= gap_start:
            return False, "缺口结束时间必须大于开始时间"
        return True, ""

    @staticmethod
    def check_gap_overlap(
        db: Session,
        metric_window_id: int,
        gap_start: datetime,
        gap_end: datetime,
        exclude_gap_id: Optional[int] = None,
    ) -> Tuple[bool, str, List[GapSegment]]:
        query = db.query(GapSegment).filter(
            GapSegment.metric_window_id == metric_window_id,
            GapSegment.gap_start < gap_end,
            GapSegment.gap_end > gap_start,
        )

        if exclude_gap_id:
            query = query.filter(GapSegment.id != exclude_gap_id)

        overlapping_gaps = query.all()

        if overlapping_gaps:
            return (
                False,
                f"发现{len(overlapping_gaps)}个重叠的缺口片段",
                overlapping_gaps,
            )
        return True, "", []

    @staticmethod
    def deduplicate_backfill_by_hash(
        db: Session, gap_segment_id: int, data_hash: str
    ) -> Tuple[bool, str]:
        from app.models import BackfillSource

        existing = (
            db.query(BackfillSource)
            .filter(
                BackfillSource.gap_segment_id == gap_segment_id,
                BackfillSource.data_hash == data_hash,
            )
            .first()
        )

        if existing:
            return False, f"相同数据哈希的回填已存在，ID: {existing.id}"
        return True, ""

    @staticmethod
    def check_override_permission(
        batch: GrayBatch, existing_data_present: bool
    ) -> Tuple[bool, str]:
        strategy = batch.override_strategy

        if not existing_data_present:
            return True, "无现有观测数据，允许回填"

        if strategy == OverrideStrategy.PROTECT:
            return (
                False,
                "当前策略为PROTECT（保护模式），不允许覆盖已有观测数据",
            )
        elif strategy == OverrideStrategy.MERGE:
            return True, "当前策略为MERGE（合并模式），将保留原有数据不覆盖"
        elif strategy == OverrideStrategy.FORCE:
            return True, "当前策略为FORCE（强制模式），将覆盖已有观测数据"

        return False, "未知的覆盖策略"

    @staticmethod
    def has_existing_observations(gap: GapSegment) -> bool:
        """检查缺口是否已有真实观测数据"""
        return gap.actual_points is not None and gap.actual_points > 0

    @staticmethod
    def validate_status_transition(
        from_status: BatchStatus, to_status: BatchStatus
    ) -> Tuple[bool, str]:
        valid_transitions = {
            BatchStatus.PENDING: [BatchStatus.APPROVING, BatchStatus.CANCELLED],
            BatchStatus.APPROVING: [
                BatchStatus.APPROVED,
                BatchStatus.REJECTED,
                BatchStatus.PENDING,
            ],
            BatchStatus.APPROVED: [BatchStatus.PROCESSING, BatchStatus.CANCELLED],
            BatchStatus.PROCESSING: [
                BatchStatus.COMPLETED,
                BatchStatus.ROLLBACKED,
                BatchStatus.PENDING,
            ],
            BatchStatus.COMPLETED: [BatchStatus.ROLLBACKED],
            BatchStatus.REJECTED: [BatchStatus.PENDING],
            BatchStatus.CANCELLED: [BatchStatus.PENDING],
            BatchStatus.ROLLBACKED: [BatchStatus.PENDING],
        }

        if to_status not in valid_transitions.get(from_status, []):
            return (
                False,
                f"不允许从 {from_status.value} 状态转换到 {to_status.value} 状态",
            )
        return True, ""

    @staticmethod
    def calculate_fill_rate(expected: int, actual: int) -> float:
        if expected <= 0:
            return 0.0
        return min(1.0, actual / expected)

    @staticmethod
    def generate_data_hash(data: str) -> str:
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    @staticmethod
    def validate_batch_for_processing(batch: GrayBatch) -> Tuple[bool, str]:
        if batch.status != BatchStatus.APPROVED:
            return False, f"批次状态必须为APPROVED，当前为{batch.status}"

        if not batch.metric_windows:
            return False, "批次下没有配置指标窗口"

        for window in batch.metric_windows:
            if not window.gap_segments:
                return False, f"指标窗口{window.id}下没有配置缺口片段"

            for gap in window.gap_segments:
                if not gap.backfill_sources:
                    return False, f"缺口片段{gap.id}下没有配置回填来源"

        return True, ""
