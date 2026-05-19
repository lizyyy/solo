from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import ResultSnapshot, GrayBatch
from app.services.validation_service import ValidationService
from datetime import datetime
import json


class SnapshotService:
    def __init__(self, db: Session):
        self.db = db

    def create_snapshot(
        self,
        batch_id: int,
        snapshot_type: str,
        snapshot_data: str,
        created_by: str,
    ) -> ResultSnapshot:
        batch = self.db.query(GrayBatch).filter(GrayBatch.id == batch_id).first()
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        snapshot_hash = ValidationService.generate_data_hash(snapshot_data)

        db_snapshot = ResultSnapshot(
            batch_id=batch_id,
            snapshot_type=snapshot_type,
            snapshot_data=snapshot_data,
            snapshot_hash=snapshot_hash,
            created_by=created_by,
        )
        self.db.add(db_snapshot)
        self.db.commit()
        self.db.refresh(db_snapshot)
        return db_snapshot

    def create_batch_result_snapshot(
        self, batch_id: int, created_by: str
    ) -> ResultSnapshot:
        batch = self.db.query(GrayBatch).filter(GrayBatch.id == batch_id).first()
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        result_data = {
            "batch_id": batch.id,
            "batch_code": batch.batch_code,
            "batch_name": batch.batch_name,
            "status": batch.status.value,
            "override_strategy": batch.override_strategy.value,
            "created_by": batch.created_by,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
            "metric_windows": [],
        }

        for window in batch.metric_windows:
            window_data = {
                "window_id": window.id,
                "metric_name": window.metric_name,
                "window_start": window.window_start.isoformat(),
                "window_end": window.window_end.isoformat(),
                "tags": window.tags,
                "gap_segments": [],
            }

            for gap in window.gap_segments:
                gap_data = {
                    "gap_id": gap.id,
                    "gap_type": gap.gap_type.value,
                    "gap_start": gap.gap_start.isoformat(),
                    "gap_end": gap.gap_end.isoformat(),
                    "expected_points": gap.expected_points,
                    "actual_points": gap.actual_points,
                    "fill_rate": gap.fill_rate,
                    "is_backfilled": gap.is_backfilled,
                    "backfilled_at": gap.backfilled_at.isoformat() if gap.backfilled_at else None,
                    "backfill_sources": [],
                }

                for source in gap.backfill_sources:
                    source_data = {
                        "source_id": source.id,
                        "source_type": source.source_type.value,
                        "source_name": source.source_name,
                        "source_config": source.source_config,
                        "data_hash": source.data_hash,
                        "record_count": source.record_count,
                    }
                    gap_data["backfill_sources"].append(source_data)

                window_data["gap_segments"].append(gap_data)

            result_data["metric_windows"].append(window_data)

        return self.create_snapshot(
            batch_id=batch_id,
            snapshot_type="batch_result",
            snapshot_data=json.dumps(result_data, ensure_ascii=False),
            created_by=created_by,
        )

    def get_snapshot(self, snapshot_id: int) -> Optional[ResultSnapshot]:
        return self.db.query(ResultSnapshot).filter(ResultSnapshot.id == snapshot_id).first()

    def list_snapshots(
        self, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[ResultSnapshot]:
        query = self.db.query(ResultSnapshot)
        if batch_id:
            query = query.filter(ResultSnapshot.batch_id == batch_id)
        return query.order_by(ResultSnapshot.created_at.desc()).offset(skip).limit(limit).all()

    def export_snapshot(self, snapshot_id: int) -> Optional[dict]:
        snapshot = self.get_snapshot(snapshot_id)
        if not snapshot:
            return None

        return {
            "snapshot_id": snapshot.id,
            "batch_id": snapshot.batch_id,
            "snapshot_type": snapshot.snapshot_type,
            "snapshot_hash": snapshot.snapshot_hash,
            "created_by": snapshot.created_by,
            "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
            "data": json.loads(snapshot.snapshot_data),
        }
