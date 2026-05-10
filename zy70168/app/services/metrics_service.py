from datetime import datetime, timedelta
from typing import Optional, List, Dict
import uuid

from sqlalchemy import select, and_, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Event, EventStatus, LatencyWindow, MetricSnapshot, SnapshotSource,
    Alert, AlertStatus, Ranking, RankingType, CorrectionReport, CorrectionSource
)
from app.schemas import EventCreate, ManualCorrectionRequest, ProcessResult
from app.config import settings
from app.services.alert_rules import AlertRuleService


def _normalize_bucket_time(event_time: datetime) -> datetime:
    return event_time.replace(minute=0, second=0, microsecond=0)


class MetricsService:
    @staticmethod
    async def _get_latency_window(db: AsyncSession, metric_name: str) -> int:
        stmt = select(LatencyWindow).where(
            LatencyWindow.metric_name == metric_name,
            LatencyWindow.is_active == True
        )
        result = await db.execute(stmt)
        window = result.scalar_one_or_none()
        return window.window_seconds if window else settings.DEFAULT_LATENCY_WINDOW_SECONDS

    @staticmethod
    async def _check_duplicate(db: AsyncSession, event_id: str) -> Optional[Event]:
        stmt = select(Event).where(Event.id == event_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _calculate_metric_value(
        db: AsyncSession, metric_name: str, entity_id: str, bucket_time: datetime
    ) -> float:
        start_time = bucket_time
        end_time = bucket_time + timedelta(hours=1)
        
        stmt = select(func.sum(Event.metric_value)).where(
            and_(
                Event.metric_name == metric_name,
                Event.entity_id == entity_id,
                Event.event_time >= start_time,
                Event.event_time < end_time,
                Event.status.notin_([EventStatus.DUPLICATE, EventStatus.ABORTED])
            )
        )
        result = await db.execute(stmt)
        total = result.scalar_one()
        return float(total or 0.0)

    @staticmethod
    async def _get_latest_snapshot(
        db: AsyncSession, metric_name: str, entity_id: str, bucket_time: datetime
    ) -> Optional[MetricSnapshot]:
        stmt = select(MetricSnapshot).where(
            and_(
                MetricSnapshot.metric_name == metric_name,
                MetricSnapshot.entity_id == entity_id,
                MetricSnapshot.bucket_time == bucket_time,
                MetricSnapshot.is_latest == True
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_events_for_bucket(
        db: AsyncSession, metric_name: str, entity_id: str, bucket_time: datetime
    ) -> List[Event]:
        start_time = bucket_time
        end_time = bucket_time + timedelta(hours=1)
        
        stmt = select(Event).where(
            and_(
                Event.metric_name == metric_name,
                Event.entity_id == entity_id,
                Event.event_time >= start_time,
                Event.event_time < end_time,
                Event.status.notin_([EventStatus.DUPLICATE, EventStatus.ABORTED])
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def process_event(
        db: AsyncSession, event_data: EventCreate
    ) -> ProcessResult:
        existing = await MetricsService._check_duplicate(db, event_data.event_id)
        if existing:
            return ProcessResult(
                event_id=existing.id,
                status=EventStatus.DUPLICATE,
                is_late=existing.is_late,
                message=f"事件已存在，状态: {existing.status.value}",
                snapshot=None
            )

        ingest_time = datetime.utcnow()
        latency_window = await MetricsService._get_latency_window(db, event_data.metric_name)
        latency_seconds = int((ingest_time - event_data.event_time).total_seconds())
        is_late = latency_seconds > latency_window

        event = Event(
            id=event_data.event_id,
            event_time=event_data.event_time,
            ingest_time=ingest_time,
            metric_name=event_data.metric_name,
            metric_value=event_data.metric_value,
            entity_id=event_data.entity_id,
            dimensions=event_data.dimensions or {},
            is_late=is_late,
            latency_seconds=latency_seconds,
            status=EventStatus.PENDING
        )
        db.add(event)
        await db.flush()

        if event_data.metric_value < 0:
            event.status = EventStatus.ABORTED
            await db.commit()
            return ProcessResult(
                event_id=event.id,
                status=EventStatus.ABORTED,
                is_late=is_late,
                message=f"异常拦截：指标值 {event_data.metric_value} 为负数",
                snapshot=None
            )

        bucket_time = _normalize_bucket_time(event_data.event_time)
        
        latest_snapshot = await MetricsService._get_latest_snapshot(
            db, event_data.metric_name, event_data.entity_id, bucket_time
        )

        if latest_snapshot and latest_snapshot.is_manual_overridden:
            event.status = EventStatus.PROCESSED
            await db.commit()
            return ProcessResult(
                event_id=event.id,
                status=EventStatus.PROCESSED,
                is_late=is_late,
                message="指标已被人工修正，跳过自动计算",
                snapshot=None
            )

        new_value = await MetricsService._calculate_metric_value(
            db, event_data.metric_name, event_data.entity_id, bucket_time
        )
        events_for_bucket = await MetricsService._get_events_for_bucket(
            db, event_data.metric_name, event_data.entity_id, bucket_time
        )
        event_ids = [e.id for e in events_for_bucket]

        triggered_alerts = []
        triggered_reports = []
        affected_alert_ids = []
        affected_ranking_ids = []

        original_value = 0.0
        if latest_snapshot:
            original_value = latest_snapshot.value
            stmt = update(MetricSnapshot).where(
                and_(
                    MetricSnapshot.metric_name == event_data.metric_name,
                    MetricSnapshot.entity_id == event_data.entity_id,
                    MetricSnapshot.bucket_time == bucket_time,
                    MetricSnapshot.is_latest == True
                )
            ).values(is_latest=False)
            await db.execute(stmt)
            await db.flush()

        source = SnapshotSource.LATE_EVENT_CORRECTION if is_late else SnapshotSource.REAL_TIME
        new_version = (latest_snapshot.version + 1) if latest_snapshot else 1

        new_snapshot = MetricSnapshot(
            snapshot_time=datetime.utcnow(),
            metric_name=event_data.metric_name,
            entity_id=event_data.entity_id,
            bucket_time=bucket_time,
            value=new_value,
            version=new_version,
            source=source,
            is_latest=True,
            is_manual_overridden=False,
            event_ids=event_ids
        )
        db.add(new_snapshot)
        await db.flush()

        rule = AlertRuleService.should_alert(event_data.metric_name, new_value)
        if rule:
            if latest_snapshot:
                stmt = select(Alert).where(
                    and_(
                        Alert.metric_name == event_data.metric_name,
                        Alert.entity_id == event_data.entity_id,
                        Alert.bucket_time == bucket_time,
                        Alert.alert_type == rule.alert_type,
                        Alert.status == AlertStatus.ACTIVE
                    )
                )
                result = await db.execute(stmt)
                existing_alert = result.scalar_one_or_none()
                
                if existing_alert:
                    existing_alert.current_value = new_value
                    await db.flush()
                    triggered_alerts.append(existing_alert)
                else:
                    alert = Alert(
                        alert_id=f"alert_{uuid.uuid4().hex[:8]}",
                        metric_name=event_data.metric_name,
                        entity_id=event_data.entity_id,
                        alert_time=datetime.utcnow(),
                        bucket_time=bucket_time,
                        threshold=rule.threshold,
                        original_value=new_value,
                        current_value=new_value,
                        alert_type=rule.alert_type,
                        status=AlertStatus.ACTIVE,
                        snapshot_id=new_snapshot.id
                    )
                    db.add(alert)
                    await db.flush()
                    triggered_alerts.append(alert)
            else:
                alert = Alert(
                    alert_id=f"alert_{uuid.uuid4().hex[:8]}",
                    metric_name=event_data.metric_name,
                    entity_id=event_data.entity_id,
                    alert_time=datetime.utcnow(),
                    bucket_time=bucket_time,
                    threshold=rule.threshold,
                    original_value=new_value,
                    current_value=new_value,
                    alert_type=rule.alert_type,
                    status=AlertStatus.ACTIVE,
                    snapshot_id=new_snapshot.id
                )
                db.add(alert)
                await db.flush()
                triggered_alerts.append(alert)

        if is_late:
            if original_value != new_value:
                stmt = select(Alert).where(
                    and_(
                        Alert.metric_name == event_data.metric_name,
                        Alert.entity_id == event_data.entity_id,
                        Alert.bucket_time == bucket_time,
                        Alert.status == AlertStatus.ACTIVE
                    )
                )
                result = await db.execute(stmt)
                active_alerts = list(result.scalars().all())
                
                for alert in active_alerts:
                    rule = AlertRuleService.get_rule(alert.metric_name, alert.alert_type)
                    if rule and not AlertRuleService._check_threshold(rule, new_value):
                        alert.status = AlertStatus.REVOKED
                        alert.revoked_time = datetime.utcnow()
                        alert.revoke_reason = "迟到事件修正后指标不再满足告警条件"
                        affected_alert_ids.append(alert.id)

                ranking_date = bucket_time.replace(hour=0, minute=0, second=0, microsecond=0)
                stmt = select(Ranking).where(
                    and_(
                        Ranking.ranking_type == RankingType.DAILY,
                        Ranking.metric_name == event_data.metric_name,
                        Ranking.ranking_date == ranking_date,
                        Ranking.is_latest == True
                    )
                )
                result = await db.execute(stmt)
                existing_rankings = list(result.scalars().all())
                
                if existing_rankings:
                    affected_ranking_ids = [r.id for r in existing_rankings]
                    stmt_update = update(Ranking).where(
                        and_(
                            Ranking.ranking_type == RankingType.DAILY,
                            Ranking.metric_name == event_data.metric_name,
                            Ranking.ranking_date == ranking_date,
                            Ranking.is_latest == True
                        )
                    ).values(is_latest=False)
                    await db.execute(stmt_update)

                    all_entity_stmt = select(MetricSnapshot.entity_id, MetricSnapshot.value).where(
                        and_(
                            MetricSnapshot.metric_name == event_data.metric_name,
                            MetricSnapshot.bucket_time >= ranking_date,
                            MetricSnapshot.bucket_time < ranking_date + timedelta(days=1),
                            MetricSnapshot.is_latest == True
                        )
                    )
                    result = await db.execute(all_entity_stmt)
                    entity_values: Dict[str, float] = {}
                    for row in result.all():
                        eid, val = row
                        entity_values[eid] = entity_values.get(eid, 0) + val

                    sorted_entities = sorted(
                        entity_values.items(), key=lambda x: x[1], reverse=True
                    )
                    
                    max_version = max(r.version for r in existing_rankings) if existing_rankings else 0
                    new_version_rank = max_version + 1
                    
                    for rank_idx, (eid, value) in enumerate(sorted_entities, start=1):
                        new_ranking = Ranking(
                            ranking_type=RankingType.DAILY,
                            metric_name=event_data.metric_name,
                            ranking_date=ranking_date,
                            entity_id=eid,
                            rank=rank_idx,
                            value=value,
                            version=new_version_rank,
                            is_latest=True,
                            is_replayed=True
                        )
                        db.add(new_ranking)

                report = CorrectionReport(
                    report_id=f"report_{uuid.uuid4().hex[:8]}",
                    correction_time=datetime.utcnow(),
                    metric_name=event_data.metric_name,
                    entity_id=event_data.entity_id,
                    event_time=event_data.event_time,
                    bucket_time=bucket_time,
                    original_value=original_value,
                    new_value=new_value,
                    source=CorrectionSource.LATE_EVENT,
                    affected_alerts=affected_alert_ids,
                    affected_rankings=affected_ranking_ids,
                    operator=None,
                    reason=f"迟到事件修正，延迟 {latency_seconds} 秒"
                )
                db.add(report)
                await db.flush()
                triggered_reports.append(report)

        event.status = EventStatus.PROCESSED
        await db.commit()
        await db.refresh(event)
        await db.refresh(new_snapshot)

        snapshot_response = {
            "id": new_snapshot.id,
            "snapshot_time": new_snapshot.snapshot_time,
            "metric_name": new_snapshot.metric_name,
            "entity_id": new_snapshot.entity_id,
            "bucket_time": new_snapshot.bucket_time,
            "value": new_snapshot.value,
            "version": new_snapshot.version,
            "source": new_snapshot.source,
            "is_latest": new_snapshot.is_latest,
            "is_manual_overridden": new_snapshot.is_manual_overridden,
            "event_ids": new_snapshot.event_ids
        }

        alert_responses = []
        for alert in triggered_alerts:
            alert_responses.append({
                "id": alert.id,
                "alert_id": alert.alert_id,
                "metric_name": alert.metric_name,
                "entity_id": alert.entity_id,
                "alert_time": alert.alert_time,
                "bucket_time": alert.bucket_time,
                "threshold": alert.threshold,
                "original_value": alert.original_value,
                "current_value": alert.current_value,
                "alert_type": alert.alert_type,
                "status": alert.status,
                "revoked_time": alert.revoked_time,
                "revoke_reason": alert.revoke_reason
            })

        report_responses = []
        for report in triggered_reports:
            report_responses.append({
                "id": report.id,
                "report_id": report.report_id,
                "correction_time": report.correction_time,
                "metric_name": report.metric_name,
                "entity_id": report.entity_id,
                "event_time": report.event_time,
                "bucket_time": report.bucket_time,
                "original_value": report.original_value,
                "new_value": report.new_value,
                "source": report.source,
                "affected_alerts": report.affected_alerts,
                "affected_rankings": report.affected_rankings,
                "operator": report.operator,
                "reason": report.reason
            })

        return ProcessResult(
            event_id=event.id,
            status=event.status,
            is_late=event.is_late,
            message=f"{'迟到事件' if is_late else '正常事件'}处理完成",
            snapshot=snapshot_response,
            triggered_alerts=alert_responses,
            triggered_reports=report_responses
        )

    @staticmethod
    async def apply_manual_correction(
        db: AsyncSession, request: ManualCorrectionRequest
    ) -> Dict:
        bucket_time = _normalize_bucket_time(request.bucket_time)
        
        stmt = select(MetricSnapshot).where(
            and_(
                MetricSnapshot.metric_name == request.metric_name,
                MetricSnapshot.entity_id == request.entity_id,
                MetricSnapshot.bucket_time == bucket_time,
                MetricSnapshot.is_latest == True
            )
        )
        result = await db.execute(stmt)
        latest_snapshot = result.scalar_one_or_none()

        original_value = latest_snapshot.value if latest_snapshot else 0.0

        if latest_snapshot:
            stmt_update = update(MetricSnapshot).where(
                and_(
                    MetricSnapshot.metric_name == request.metric_name,
                    MetricSnapshot.entity_id == request.entity_id,
                    MetricSnapshot.bucket_time == bucket_time,
                    MetricSnapshot.is_latest == True
                )
            ).values(is_latest=False)
            await db.execute(stmt_update)

        new_version = (latest_snapshot.version + 1) if latest_snapshot else 1

        new_snapshot = MetricSnapshot(
            snapshot_time=datetime.utcnow(),
            metric_name=request.metric_name,
            entity_id=request.entity_id,
            bucket_time=bucket_time,
            value=request.new_value,
            version=new_version,
            source=SnapshotSource.MANUAL,
            is_latest=True,
            is_manual_overridden=True,
            event_ids=latest_snapshot.event_ids if latest_snapshot else []
        )
        db.add(new_snapshot)
        await db.flush()

        affected_alert_ids = []
        affected_ranking_ids = []

        stmt = select(Alert).where(
            and_(
                Alert.metric_name == request.metric_name,
                Alert.entity_id == request.entity_id,
                Alert.bucket_time == bucket_time,
                Alert.status == AlertStatus.ACTIVE
            )
        )
        result = await db.execute(stmt)
        active_alerts = list(result.scalars().all())
        
        for alert in active_alerts:
            rule = AlertRuleService.get_rule(alert.metric_name, alert.alert_type)
            if rule and not AlertRuleService._check_threshold(rule, request.new_value):
                alert.status = AlertStatus.REVOKED
                alert.revoked_time = datetime.utcnow()
                alert.revoke_reason = f"人工修正撤销: {request.reason or '未说明原因'}"
                affected_alert_ids.append(alert.id)

        ranking_date = bucket_time.replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = select(Ranking).where(
            and_(
                Ranking.ranking_type == RankingType.DAILY,
                Ranking.metric_name == request.metric_name,
                Ranking.ranking_date == ranking_date,
                Ranking.is_latest == True
            )
        )
        result = await db.execute(stmt)
        existing_rankings = list(result.scalars().all())
        
        if existing_rankings:
            affected_ranking_ids = [r.id for r in existing_rankings]
            stmt_update_rank = update(Ranking).where(
                and_(
                    Ranking.ranking_type == RankingType.DAILY,
                    Ranking.metric_name == request.metric_name,
                    Ranking.ranking_date == ranking_date,
                    Ranking.is_latest == True
                )
            ).values(is_latest=False)
            await db.execute(stmt_update_rank)

            all_entity_stmt = select(MetricSnapshot.entity_id, MetricSnapshot.value).where(
                and_(
                    MetricSnapshot.metric_name == request.metric_name,
                    MetricSnapshot.bucket_time >= ranking_date,
                    MetricSnapshot.bucket_time < ranking_date + timedelta(days=1),
                    MetricSnapshot.is_latest == True
                )
            )
            result = await db.execute(all_entity_stmt)
            entity_values: Dict[str, float] = {}
            for row in result.all():
                eid, val = row
                entity_values[eid] = entity_values.get(eid, 0) + val

            sorted_entities = sorted(
                entity_values.items(), key=lambda x: x[1], reverse=True
            )
            
            max_version = max(r.version for r in existing_rankings) if existing_rankings else 0
            new_version_rank = max_version + 1
            
            for rank_idx, (eid, value) in enumerate(sorted_entities, start=1):
                new_ranking = Ranking(
                    ranking_type=RankingType.DAILY,
                    metric_name=request.metric_name,
                    ranking_date=ranking_date,
                    entity_id=eid,
                    rank=rank_idx,
                    value=value,
                    version=new_version_rank,
                    is_latest=True,
                    is_replayed=True
                )
                db.add(new_ranking)

        report = CorrectionReport(
            report_id=f"report_{uuid.uuid4().hex[:8]}",
            correction_time=datetime.utcnow(),
            metric_name=request.metric_name,
            entity_id=request.entity_id,
            event_time=None,
            bucket_time=bucket_time,
            original_value=original_value,
            new_value=request.new_value,
            source=CorrectionSource.MANUAL,
            affected_alerts=affected_alert_ids,
            affected_rankings=affected_ranking_ids,
            operator=request.operator,
            reason=request.reason
        )
        db.add(report)
        await db.commit()

        return {
            "success": True,
            "original_value": original_value,
            "new_value": request.new_value,
            "version": new_version,
            "affected_alerts_count": len(affected_alert_ids),
            "affected_rankings_count": len(affected_ranking_ids),
            "report_id": report.report_id
        }

    @staticmethod
    async def revoke_alert(
        db: AsyncSession, alert_id: str, reason: str
    ) -> Optional[Dict]:
        stmt = select(Alert).where(Alert.alert_id == alert_id)
        result = await db.execute(stmt)
        alert = result.scalar_one_or_none()
        
        if not alert:
            return None
        
        alert.status = AlertStatus.REVOKED
        alert.revoked_time = datetime.utcnow()
        alert.revoke_reason = reason
        await db.commit()
        await db.refresh(alert)
        
        return {
            "alert_id": alert.alert_id,
            "status": alert.status,
            "revoked_time": alert.revoked_time,
            "reason": alert.revoke_reason
        }

    @staticmethod
    async def replay_ranking(
        db: AsyncSession, ranking_type: RankingType, metric_name: str, ranking_date: datetime
    ) -> Dict:
        ranking_date = ranking_date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        stmt = select(Ranking).where(
            and_(
                Ranking.ranking_type == ranking_type,
                Ranking.metric_name == metric_name,
                Ranking.ranking_date == ranking_date,
                Ranking.is_latest == True
            )
        )
        result = await db.execute(stmt)
        existing_rankings = list(result.scalars().all())
        
        if existing_rankings:
            stmt_update = update(Ranking).where(
                and_(
                    Ranking.ranking_type == ranking_type,
                    Ranking.metric_name == metric_name,
                    Ranking.ranking_date == ranking_date,
                    Ranking.is_latest == True
                )
            ).values(is_latest=False)
            await db.execute(stmt_update)

        start_time = ranking_date
        end_time = ranking_date + timedelta(days=1)
        
        all_entity_stmt = select(MetricSnapshot.entity_id, MetricSnapshot.value).where(
            and_(
                MetricSnapshot.metric_name == metric_name,
                MetricSnapshot.bucket_time >= start_time,
                MetricSnapshot.bucket_time < end_time,
                MetricSnapshot.is_latest == True
            )
        )
        result = await db.execute(all_entity_stmt)
        entity_values: Dict[str, float] = {}
        for row in result.all():
            eid, val = row
            entity_values[eid] = entity_values.get(eid, 0) + val

        sorted_entities = sorted(
            entity_values.items(), key=lambda x: x[1], reverse=True
        )
        
        max_version = max(r.version for r in existing_rankings) if existing_rankings else 0
        new_version_rank = max_version + 1
        
        created_count = 0
        for rank_idx, (eid, value) in enumerate(sorted_entities, start=1):
            new_ranking = Ranking(
                ranking_type=ranking_type,
                metric_name=metric_name,
                ranking_date=ranking_date,
                entity_id=eid,
                rank=rank_idx,
                value=value,
                version=new_version_rank,
                is_latest=True,
                is_replayed=True
            )
            db.add(new_ranking)
            created_count += 1

        await db.commit()
        
        return {
            "success": True,
            "ranking_type": ranking_type.value,
            "metric_name": metric_name,
            "ranking_date": ranking_date,
            "version": new_version_rank,
            "entity_count": created_count,
            "prev_version_archived": len(existing_rankings) > 0
        }
