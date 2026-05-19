from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import MetricWindow, GapSegment, BackfillSource
from app.schemas import MetricWindowCreate, GapSegmentCreate, BackfillSourceCreate
from app.services.validation_service import ValidationService
from app.models.models import OverrideStrategy
from datetime import datetime


class WindowService:
    def __init__(self, db: Session):
        self.db = db

    def create_metric_window(
        self, window_data: MetricWindowCreate
    ) -> MetricWindow:
        valid, msg = ValidationService.validate_time_window(
            window_data.window_start, window_data.window_end
        )
        if not valid:
            raise ValueError(msg)

        db_window = MetricWindow(**window_data.model_dump())
        self.db.add(db_window)
        self.db.commit()
        self.db.refresh(db_window)
        return db_window

    def get_metric_window(self, window_id: int) -> Optional[MetricWindow]:
        return self.db.query(MetricWindow).filter(MetricWindow.id == window_id).first()

    def list_metric_windows(
        self, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[MetricWindow]:
        query = self.db.query(MetricWindow)
        if batch_id:
            query = query.filter(MetricWindow.batch_id == batch_id)
        return query.offset(skip).limit(limit).all()

    def delete_metric_window(self, window_id: int) -> bool:
        db_window = self.get_metric_window(window_id)
        if not db_window:
            return False
        self.db.delete(db_window)
        self.db.commit()
        return True


class GapSegmentService:
    def __init__(self, db: Session):
        self.db = db

    def create_gap_segment(self, gap_data: GapSegmentCreate) -> GapSegment:
        window = self.db.query(MetricWindow).filter(
            MetricWindow.id == gap_data.metric_window_id
        ).first()
        if not window:
            raise ValueError(f"指标窗口 {gap_data.metric_window_id} 不存在")

        valid, msg = ValidationService.validate_gap_within_window(
            gap_data.gap_start, gap_data.gap_end, window.window_start, window.window_end
        )
        if not valid:
            raise ValueError(msg)

        valid, msg, overlaps = ValidationService.check_gap_overlap(
            self.db, gap_data.metric_window_id, gap_data.gap_start, gap_data.gap_end
        )
        if not valid:
            raise ValueError(msg)

        db_gap = GapSegment(**gap_data.model_dump())
        if gap_data.expected_points is not None and gap_data.actual_points is not None:
            db_gap.fill_rate = ValidationService.calculate_fill_rate(
                gap_data.expected_points, gap_data.actual_points
            )

        self.db.add(db_gap)
        self.db.commit()
        self.db.refresh(db_gap)
        return db_gap

    def get_gap_segment(self, gap_id: int) -> Optional[GapSegment]:
        return self.db.query(GapSegment).filter(GapSegment.id == gap_id).first()

    def list_gap_segments(
        self, metric_window_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[GapSegment]:
        query = self.db.query(GapSegment)
        if metric_window_id:
            query = query.filter(GapSegment.metric_window_id == metric_window_id)
        return query.offset(skip).limit(limit).all()

    def mark_backfilled(
        self,
        gap_id: int,
        actual_points: Optional[int] = None,
        override_strategy: OverrideStrategy = OverrideStrategy.PROTECT,
    ) -> Tuple[Optional[GapSegment], bool, str]:
        """
        标记缺口为已回填
        返回: (缺口对象, 是否成功处理, 处理消息)
        """
        db_gap = self.get_gap_segment(gap_id)
        if not db_gap:
            return None, False, "缺口不存在"

        # 检查是否已有真实观测数据
        has_existing = ValidationService.has_existing_observations(db_gap)
        
        if has_existing:
            if override_strategy == OverrideStrategy.PROTECT:
                # 保护模式：不修改已有数据，但仍标记为已处理（跳过回填）
                db_gap.is_backfilled = True
                db_gap.backfilled_at = datetime.utcnow()
                self.db.commit()
                self.db.refresh(db_gap)
                return db_gap, True, "保护模式：保留原有观测数据，跳过回填覆盖"
            elif override_strategy == OverrideStrategy.MERGE:
                # 合并模式：保留原有数据，不覆盖
                db_gap.is_backfilled = True
                db_gap.backfilled_at = datetime.utcnow()
                self.db.commit()
                self.db.refresh(db_gap)
                return db_gap, True, "合并模式：保留原有观测数据，不覆盖"
        
        # FORCE 模式 或 没有现有数据：正常回填
        db_gap.is_backfilled = True
        db_gap.backfilled_at = datetime.utcnow()

        if actual_points is not None:
            db_gap.actual_points = actual_points
            if db_gap.expected_points:
                db_gap.fill_rate = ValidationService.calculate_fill_rate(
                    db_gap.expected_points, actual_points
                )

        self.db.commit()
        self.db.refresh(db_gap)
        
        if has_existing:
            return db_gap, True, "强制模式：已覆盖原有观测数据"
        return db_gap, True, "回填完成"

    def delete_gap_segment(self, gap_id: int) -> bool:
        db_gap = self.get_gap_segment(gap_id)
        if not db_gap:
            return False
        self.db.delete(db_gap)
        self.db.commit()
        return True


class BackfillSourceService:
    def __init__(self, db: Session):
        self.db = db

    def create_backfill_source(
        self, source_data: BackfillSourceCreate
    ) -> BackfillSource:
        gap = self.db.query(GapSegment).filter(
            GapSegment.id == source_data.gap_segment_id
        ).first()
        if not gap:
            raise ValueError(f"缺口片段 {source_data.gap_segment_id} 不存在")

        if source_data.data_hash:
            valid, msg = ValidationService.deduplicate_backfill_by_hash(
                self.db, source_data.gap_segment_id, source_data.data_hash
            )
            if not valid:
                raise ValueError(msg)

        db_source = BackfillSource(**source_data.model_dump())
        self.db.add(db_source)
        self.db.commit()
        self.db.refresh(db_source)
        return db_source

    def get_backfill_source(self, source_id: int) -> Optional[BackfillSource]:
        return self.db.query(BackfillSource).filter(BackfillSource.id == source_id).first()

    def list_backfill_sources(
        self, gap_segment_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[BackfillSource]:
        query = self.db.query(BackfillSource)
        if gap_segment_id:
            query = query.filter(BackfillSource.gap_segment_id == gap_segment_id)
        return query.offset(skip).limit(limit).all()

    def delete_backfill_source(self, source_id: int) -> bool:
        db_source = self.get_backfill_source(source_id)
        if not db_source:
            return False
        self.db.delete(db_source)
        self.db.commit()
        return True
