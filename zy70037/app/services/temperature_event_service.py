from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models.temperature_events import TemperatureEvent
from ..models.freezers import Freezer
from ..schemas.temperature_events import (
    TemperatureEventCreate,
    TemperatureEventUpdate,
    TemperatureEventQuery,
)


class TemperatureEventService:
    def __init__(self, db: Session):
        self.db = db

    def _build_query(self, query_params: TemperatureEventQuery):
        query = self.db.query(TemperatureEvent)

        if query_params.freezer_id is not None:
            query = query.filter(TemperatureEvent.freezer_id == query_params.freezer_id)
        if query_params.status:
            query = query.filter(TemperatureEvent.status == query_params.status)
        if query_params.event_type:
            query = query.filter(TemperatureEvent.event_type == query_params.event_type)
        if query_params.start_time:
            query = query.filter(TemperatureEvent.detected_at >= query_params.start_time)
        if query_params.end_time:
            query = query.filter(TemperatureEvent.detected_at <= query_params.end_time)

        return query

    def list(self, query_params: TemperatureEventQuery) -> Tuple[List[TemperatureEvent], int]:
        query = self._build_query(query_params)
        total = query.count()
        events = (
            query.order_by(TemperatureEvent.detected_at.desc())
            .offset((query_params.page - 1) * query_params.page_size)
            .limit(query_params.page_size)
            .all()
        )
        return events, total

    def get_by_id(self, event_id: int) -> Optional[TemperatureEvent]:
        return self.db.query(TemperatureEvent).filter(TemperatureEvent.id == event_id).first()

    def create(self, data: TemperatureEventCreate) -> TemperatureEvent:
        if not data.detected_at:
            data.detected_at = datetime.utcnow()

        event = TemperatureEvent(
            freezer_id=data.freezer_id,
            temperature=data.temperature,
            event_type=data.event_type,
            status=data.status,
            detected_at=data.detected_at,
            description=data.description,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def update(self, event_id: int, data: TemperatureEventUpdate) -> Optional[TemperatureEvent]:
        event = self.get_by_id(event_id)
        if not event:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(event, field, value)

        if data.status == "resolved" and not event.resolved_at:
            event.resolved_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(event)
        return event

    def delete(self, event_id: int) -> bool:
        event = self.get_by_id(event_id)
        if not event:
            return False
        self.db.delete(event)
        self.db.commit()
        return True

    def get_by_freezer(self, freezer_id: int, status: Optional[str] = None) -> List[TemperatureEvent]:
        query = self.db.query(TemperatureEvent).filter(TemperatureEvent.freezer_id == freezer_id)
        if status:
            query = query.filter(TemperatureEvent.status == status)
        return query.order_by(TemperatureEvent.detected_at.desc()).all()

    def check_and_create_event(self, freezer: Freezer, temperature: float, description: Optional[str] = None) -> Optional[TemperatureEvent]:
        event_type = None
        if temperature > freezer.max_temperature:
            event_type = "high_temp"
        elif temperature < freezer.min_temperature:
            event_type = "low_temp"

        if event_type:
            existing = (
                self.db.query(TemperatureEvent)
                .filter(
                    and_(
                        TemperatureEvent.freezer_id == freezer.id,
                        TemperatureEvent.event_type == event_type,
                        TemperatureEvent.status.in_(["pending", "processing"]),
                    )
                )
                .first()
            )

            if not existing:
                return self.create(
                    TemperatureEventCreate(
                        freezer_id=freezer.id,
                        temperature=temperature,
                        event_type=event_type,
                        status="pending",
                        description=description or f"温度异常: {temperature}°C",
                    )
                )

        return None
