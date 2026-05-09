from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.dispatches import Dispatch
from ..models.maintenance_providers import MaintenanceProvider
from ..models.stores import Store
from ..models.freezers import Freezer
from ..models.regions import Region
from ..models.temperature_events import TemperatureEvent
from ..config import settings
from ..schemas.dispatches import (
    DispatchCreate,
    DispatchUpdate,
    DispatchQuery,
    DispatchAssign,
    DispatchAccept,
    DispatchComplete,
)


class DispatchService:
    def __init__(self, db: Session):
        self.db = db

    def _build_query(self, query_params: DispatchQuery):
        query = self.db.query(Dispatch)

        if query_params.temperature_event_id is not None:
            query = query.filter(Dispatch.temperature_event_id == query_params.temperature_event_id)
        if query_params.provider_id is not None:
            query = query.filter(Dispatch.provider_id == query_params.provider_id)
        if query_params.worker_id is not None:
            query = query.filter(Dispatch.worker_id == query_params.worker_id)
        if query_params.status:
            query = query.filter(Dispatch.status == query_params.status)
        if query_params.priority:
            query = query.filter(Dispatch.priority == query_params.priority)
        if query_params.escalation_level is not None:
            query = query.filter(Dispatch.escalation_level == query_params.escalation_level)
        if query_params.start_time:
            query = query.filter(Dispatch.created_at >= query_params.start_time)
        if query_params.end_time:
            query = query.filter(Dispatch.created_at <= query_params.end_time)

        return query

    def list(self, query_params: DispatchQuery) -> Tuple[List[Dispatch], int]:
        query = self._build_query(query_params)
        total = query.count()
        dispatches = (
            query.order_by(Dispatch.created_at.desc())
            .offset((query_params.page - 1) * query_params.page_size)
            .limit(query_params.page_size)
            .all()
        )
        return dispatches, total

    def get_by_id(self, dispatch_id: int) -> Optional[Dispatch]:
        return self.db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()

    def get_by_code(self, dispatch_code: str) -> Optional[Dispatch]:
        return self.db.query(Dispatch).filter(Dispatch.dispatch_code == dispatch_code).first()

    def _generate_dispatch_code(self) -> str:
        today = datetime.utcnow().strftime("%Y%m%d")
        prefix = f"DISP{today}"
        count = self.db.query(Dispatch).filter(Dispatch.dispatch_code.like(f"{prefix}%")).count() + 1
        return f"{prefix}{count:04d}"

    def _calculate_target_time(self, priority: str) -> datetime:
        now = datetime.utcnow()
        if priority == "urgent":
            return now + timedelta(minutes=settings.DISPATCH_TIMEOUT_MINUTES)
        elif priority == "high":
            return now + timedelta(minutes=settings.DISPATCH_TIMEOUT_MINUTES * 2)
        else:
            return now + timedelta(minutes=settings.DISPATCH_TIMEOUT_MINUTES * 4)

    def create(self, data: DispatchCreate) -> Dispatch:
        dispatch_code = self._generate_dispatch_code()
        target_time = self._calculate_target_time(data.priority)

        dispatch = Dispatch(
            temperature_event_id=data.temperature_event_id,
            provider_id=data.provider_id,
            worker_id=data.worker_id,
            dispatch_code=dispatch_code,
            status="pending",
            priority=data.priority,
            target_time=target_time,
            notes=data.notes,
        )
        self.db.add(dispatch)

        event = self.db.query(TemperatureEvent).filter(TemperatureEvent.id == data.temperature_event_id).first()
        if event:
            event.status = "processing"

        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch

    def update(self, dispatch_id: int, data: DispatchUpdate) -> Optional[Dispatch]:
        dispatch = self.get_by_id(dispatch_id)
        if not dispatch:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(dispatch, field, value)

        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch

    def delete(self, dispatch_id: int) -> bool:
        dispatch = self.get_by_id(dispatch_id)
        if not dispatch:
            return False
        self.db.delete(dispatch)
        self.db.commit()
        return True

    def assign_worker(self, dispatch_id: int, data: DispatchAssign) -> Optional[Dispatch]:
        dispatch = self.get_by_id(dispatch_id)
        if not dispatch:
            return None

        dispatch.worker_id = data.worker_id
        dispatch.dispatched_at = datetime.utcnow()
        dispatch.status = "dispatched"
        if data.notes:
            dispatch.notes = (dispatch.notes or "") + "\n" + data.notes

        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch

    def accept(self, dispatch_id: int, data: DispatchAccept) -> Optional[Dispatch]:
        dispatch = self.get_by_id(dispatch_id)
        if not dispatch:
            return None

        dispatch.accepted_at = datetime.utcnow()
        dispatch.status = "in_progress"
        if data.notes:
            dispatch.notes = (dispatch.notes or "") + "\n" + data.notes

        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch

    def complete(self, dispatch_id: int, data: DispatchComplete) -> Optional[Dispatch]:
        dispatch = self.get_by_id(dispatch_id)
        if not dispatch:
            return None

        dispatch.completed_at = datetime.utcnow()
        dispatch.status = "completed"
        if data.notes:
            dispatch.notes = (dispatch.notes or "") + "\n" + data.notes

        event = self.db.query(TemperatureEvent).filter(TemperatureEvent.id == dispatch.temperature_event_id).first()
        if event:
            event.status = "resolved"
            event.resolved_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(dispatch)
        return dispatch

    def find_provider_for_event(self, event: TemperatureEvent) -> Optional[MaintenanceProvider]:
        freezer = self.db.query(Freezer).filter(Freezer.id == event.freezer_id).first()
        if not freezer:
            return None

        store = self.db.query(Store).filter(Store.id == freezer.store_id).first()
        if not store:
            return None

        region_id = store.region_id
        if not region_id:
            return None

        providers = (
            self.db.query(MaintenanceProvider)
            .filter(
                and_(
                    MaintenanceProvider.region_id == region_id,
                    MaintenanceProvider.is_active == True,
                )
            )
            .all()
        )

        if not providers:
            region = self.db.query(Region).filter(Region.id == region_id).first()
            if region and region.parent_region_id:
                providers = (
                    self.db.query(MaintenanceProvider)
                    .filter(
                        and_(
                            MaintenanceProvider.region_id == region.parent_region_id,
                            MaintenanceProvider.is_active == True,
                        )
                    )
                    .all()
                )

        if providers:
            return providers[0]

        return None

    def auto_dispatch(self, event: TemperatureEvent) -> Optional[Dispatch]:
        provider = self.find_provider_for_event(event)
        if not provider:
            return None

        priority = "urgent" if event.event_type == "high_temp" else "normal"

        return self.create(
            DispatchCreate(
                temperature_event_id=event.id,
                provider_id=provider.id,
                worker_id=None,
                priority=priority,
                notes=f"自动派单 - 温度事件: {event.id}",
            )
        )

    def get_pending_dispatches(self) -> List[Dispatch]:
        return self.db.query(Dispatch).filter(Dispatch.status == "pending").order_by(Dispatch.created_at.asc()).all()
