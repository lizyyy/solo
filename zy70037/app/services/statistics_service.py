from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from ..models.temperature_events import TemperatureEvent
from ..models.dispatches import Dispatch
from ..models.repair_receipts import RepairReceipt
from ..models.parts import PartsUsage
from ..models.maintenance_providers import MaintenanceProvider
from ..models.stores import Store
from ..models.freezers import Freezer
from ..schemas.statistics import (
    TemperatureEventStats,
    DispatchStats,
    RepairStats,
    ClosedLoopStats,
    ProviderPerformance,
    StorePerformance,
    StatisticsQuery,
)


class StatisticsService:
    def __init__(self, db: Session):
        self.db = db

    def _apply_time_filters(self, query, model, start_time: Optional[datetime], end_time: Optional[datetime], time_field="created_at"):
        field = getattr(model, time_field)
        if start_time:
            query = query.filter(field >= start_time)
        if end_time:
            query = query.filter(field <= end_time)
        return query

    def get_temperature_event_stats(self, query_params: StatisticsQuery) -> TemperatureEventStats:
        base_query = self._apply_time_filters(
            self.db.query(TemperatureEvent),
            TemperatureEvent,
            query_params.start_time,
            query_params.end_time,
            "detected_at"
        )

        if query_params.store_id:
            base_query = base_query.join(Freezer, TemperatureEvent.freezer_id == Freezer.id).filter(
                Freezer.store_id == query_params.store_id
            )

        total = base_query.count()
        pending = base_query.filter(TemperatureEvent.status == "pending").count()
        processing = base_query.filter(TemperatureEvent.status == "processing").count()
        resolved = base_query.filter(TemperatureEvent.status == "resolved").count()
        high_temp = base_query.filter(TemperatureEvent.event_type == "high_temp").count()
        low_temp = base_query.filter(TemperatureEvent.event_type == "low_temp").count()

        resolved_events = base_query.filter(
            and_(TemperatureEvent.status == "resolved", TemperatureEvent.resolved_at.isnot(None))
        ).all()

        avg_hours = None
        if resolved_events:
            total_hours = sum(
                (e.resolved_at - e.detected_at).total_seconds() / 3600
                for e in resolved_events
                if e.detected_at and e.resolved_at
            )
            avg_hours = total_hours / len(resolved_events) if resolved_events else None

        return TemperatureEventStats(
            total_events=total,
            pending_events=pending,
            processing_events=processing,
            resolved_events=resolved,
            high_temp_count=high_temp,
            low_temp_count=low_temp,
            avg_resolve_hours=avg_hours,
        )

    def get_dispatch_stats(self, query_params: StatisticsQuery) -> DispatchStats:
        base_query = self._apply_time_filters(
            self.db.query(Dispatch),
            Dispatch,
            query_params.start_time,
            query_params.end_time
        )

        if query_params.provider_id:
            base_query = base_query.filter(Dispatch.provider_id == query_params.provider_id)

        total = base_query.count()
        pending = base_query.filter(Dispatch.status == "pending").count()
        accepted = base_query.filter(Dispatch.status == "in_progress").count()
        completed = base_query.filter(Dispatch.status == "completed").count()
        escalated = base_query.filter(Dispatch.escalation_level > 0).count()

        completed_dispatches = base_query.filter(Dispatch.status == "completed").all()

        avg_response = None
        avg_completion = None
        on_time_count = 0

        if completed_dispatches:
            response_times = []
            completion_times = []

            for d in completed_dispatches:
                if d.dispatched_at and d.accepted_at:
                    response_times.append((d.accepted_at - d.dispatched_at).total_seconds() / 3600)
                if d.dispatched_at and d.completed_at:
                    completion_times.append((d.completed_at - d.dispatched_at).total_seconds() / 3600)
                if d.completed_at and d.target_time:
                    if d.completed_at <= d.target_time:
                        on_time_count += 1

            if response_times:
                avg_response = sum(response_times) / len(response_times)
            if completion_times:
                avg_completion = sum(completion_times) / len(completion_times)

        on_time_rate = None
        if completed > 0:
            on_time_rate = on_time_count / completed * 100

        return DispatchStats(
            total_dispatches=total,
            pending_dispatches=pending,
            accepted_dispatches=accepted,
            completed_dispatches=completed,
            avg_response_time_hours=avg_response,
            avg_completion_time_hours=avg_completion,
            on_time_rate=on_time_rate,
            escalated_count=escalated,
        )

    def get_repair_stats(self, query_params: StatisticsQuery) -> RepairStats:
        base_query = self._apply_time_filters(
            self.db.query(RepairReceipt),
            RepairReceipt,
            query_params.start_time,
            query_params.end_time
        )

        total = base_query.count()

        completed_receipts = base_query.filter(RepairReceipt.status == "completed").all()

        avg_work_hours = None
        avg_rating = None

        if completed_receipts:
            work_hours_list = [r.work_hours for r in completed_receipts if r.work_hours > 0]
            if work_hours_list:
                avg_work_hours = sum(work_hours_list) / len(work_hours_list)

            ratings = [r.store_rating for r in completed_receipts if r.store_rating is not None]
            if ratings:
                avg_rating = sum(ratings) / len(ratings)

        parts_query = self._apply_time_filters(
            self.db.query(PartsUsage),
            PartsUsage,
            query_params.start_time,
            query_params.end_time
        )
        total_parts_cost = (
            parts_query.with_entities(func.sum(PartsUsage.quantity * PartsUsage.unit_price)).scalar() or 0.0
        )

        return RepairStats(
            total_repairs=total,
            avg_work_hours=avg_work_hours,
            avg_rating=avg_rating,
            total_parts_cost=total_parts_cost,
        )

    def get_closed_loop_stats(self, query_params: StatisticsQuery) -> ClosedLoopStats:
        return ClosedLoopStats(
            temperature_event_stats=self.get_temperature_event_stats(query_params),
            dispatch_stats=self.get_dispatch_stats(query_params),
            repair_stats=self.get_repair_stats(query_params),
        )

    def get_provider_performance(self, query_params: StatisticsQuery) -> List[ProviderPerformance]:
        providers = self.db.query(MaintenanceProvider).all()
        results = []

        for provider in providers:
            params = StatisticsQuery(
                start_time=query_params.start_time,
                end_time=query_params.end_time,
                provider_id=provider.id,
            )

            dispatch_stats = self.get_dispatch_stats(params)

            receipts = (
                self._apply_time_filters(
                    self.db.query(RepairReceipt),
                    RepairReceipt,
                    query_params.start_time,
                    query_params.end_time
                )
                .join(Dispatch, RepairReceipt.dispatch_id == Dispatch.id)
                .filter(Dispatch.provider_id == provider.id)
                .all()
            )

            avg_rating = None
            ratings = [r.store_rating for r in receipts if r.store_rating is not None]
            if ratings:
                avg_rating = sum(ratings) / len(ratings)

            results.append(
                ProviderPerformance(
                    provider_id=provider.id,
                    provider_name=provider.name,
                    total_dispatches=dispatch_stats.total_dispatches,
                    completed_dispatches=dispatch_stats.completed_dispatches,
                    avg_response_time_hours=dispatch_stats.avg_response_time_hours,
                    avg_completion_time_hours=dispatch_stats.avg_completion_time_hours,
                    on_time_rate=dispatch_stats.on_time_rate,
                    escalated_count=dispatch_stats.escalated_count,
                    avg_rating=avg_rating,
                )
            )

        return results

    def get_store_performance(self, query_params: StatisticsQuery) -> List[StorePerformance]:
        stores = self.db.query(Store).all()
        if query_params.store_id:
            stores = [s for s in stores if s.id == query_params.store_id]

        results = []

        for store in stores:
            params = StatisticsQuery(
                start_time=query_params.start_time,
                end_time=query_params.end_time,
                store_id=store.id,
            )

            event_stats = self.get_temperature_event_stats(params)

            results.append(
                StorePerformance(
                    store_id=store.id,
                    store_name=store.name,
                    total_events=event_stats.total_events,
                    resolved_events=event_stats.resolved_events,
                    avg_resolve_hours=event_stats.avg_resolve_hours,
                )
            )

        return results
