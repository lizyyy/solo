from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.escalations import Escalation
from ..models.dispatches import Dispatch
from ..models.users import User
from ..models.regions import Region
from ..config import settings
from ..schemas.escalations import (
    EscalationCreate,
    EscalationUpdate,
    EscalationQuery,
)


class EscalationService:
    def __init__(self, db: Session):
        self.db = db

    def _build_query(self, query_params: EscalationQuery):
        query = self.db.query(Escalation)

        if query_params.dispatch_id is not None:
            query = query.filter(Escalation.dispatch_id == query_params.dispatch_id)
        if query_params.level is not None:
            query = query.filter(Escalation.level == query_params.level)
        if query_params.resolved is not None:
            query = query.filter(Escalation.resolved == query_params.resolved)

        return query

    def list(self, query_params: EscalationQuery) -> Tuple[List[Escalation], int]:
        query = self._build_query(query_params)
        total = query.count()
        escalations = (
            query.order_by(Escalation.created_at.desc())
            .offset((query_params.page - 1) * query_params.page_size)
            .limit(query_params.page_size)
            .all()
        )
        return escalations, total

    def get_by_id(self, escalation_id: int) -> Optional[Escalation]:
        return self.db.query(Escalation).filter(Escalation.id == escalation_id).first()

    def create(self, data: EscalationCreate) -> Escalation:
        escalation = Escalation(
            dispatch_id=data.dispatch_id,
            level=data.level,
            escalated_at=datetime.utcnow(),
            escalated_to=data.escalated_to,
            escalated_to_id=data.escalated_to_id,
            reason=data.reason,
            action_taken=data.action_taken,
            resolved=0,
        )
        self.db.add(escalation)

        dispatch = self.db.query(Dispatch).filter(Dispatch.id == data.dispatch_id).first()
        if dispatch:
            dispatch.escalation_level = data.level

        self.db.commit()
        self.db.refresh(escalation)
        return escalation

    def update(self, escalation_id: int, data: EscalationUpdate) -> Optional[Escalation]:
        escalation = self.get_by_id(escalation_id)
        if not escalation:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(escalation, field, value)

        if data.resolved == 1 and not escalation.resolved_at:
            escalation.resolved_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(escalation)
        return escalation

    def delete(self, escalation_id: int) -> bool:
        escalation = self.get_by_id(escalation_id)
        if not escalation:
            return False
        self.db.delete(escalation)
        self.db.commit()
        return True

    def get_by_dispatch(self, dispatch_id: int) -> List[Escalation]:
        return (
            self.db.query(Escalation)
            .filter(Escalation.dispatch_id == dispatch_id)
            .order_by(Escalation.level.desc(), Escalation.created_at.desc())
            .all()
        )

    def _get_region_manager_for_dispatch(self, dispatch: Dispatch) -> Optional[User]:
        from ..models.temperature_events import TemperatureEvent
        from ..models.freezers import Freezer
        from ..models.stores import Store

        event = self.db.query(TemperatureEvent).filter(TemperatureEvent.id == dispatch.temperature_event_id).first()
        if not event:
            return None

        freezer = self.db.query(Freezer).filter(Freezer.id == event.freezer_id).first()
        if not freezer:
            return None

        store = self.db.query(Store).filter(Store.id == freezer.store_id).first()
        if not store:
            return None

        region = self.db.query(Region).filter(Region.id == store.region_id).first()
        if region and region.manager_id:
            return self.db.query(User).filter(User.id == region.manager_id).first()

        return None

    def check_and_escalate(self, dispatch: Dispatch) -> Optional[Escalation]:
        now = datetime.utcnow()
        base_time = dispatch.dispatched_at or dispatch.created_at
        elapsed_minutes = (now - base_time).total_seconds() / 60

        current_level = dispatch.escalation_level
        next_level = current_level + 1

        should_escalate = False
        reason = ""

        if next_level == 1 and elapsed_minutes >= settings.FIRST_ESCALATION_MINUTES:
            should_escalate = True
            reason = f"派单已超时{int(elapsed_minutes)}分钟未处理（首次升级）"
        elif next_level == 2 and elapsed_minutes >= settings.SECOND_ESCALATION_MINUTES:
            should_escalate = True
            reason = f"派单已超时{int(elapsed_minutes)}分钟未处理（二次升级）"

        if should_escalate and next_level <= 2:
            manager = self._get_region_manager_for_dispatch(dispatch)

            escalation_data = EscalationCreate(
                dispatch_id=dispatch.id,
                level=next_level,
                escalated_to=manager.name if manager else "区域经理",
                escalated_to_id=manager.id if manager else None,
                reason=reason,
                action_taken=None,
            )

            return self.create(escalation_data)

        return None

    def process_overdue_dispatches(self) -> List[Escalation]:
        dispatches = (
            self.db.query(Dispatch)
            .filter(
                and_(
                    Dispatch.status.in_(["pending", "dispatched", "in_progress"]),
                    Dispatch.escalation_level < 2,
                )
            )
            .all()
        )

        escalations = []
        for dispatch in dispatches:
            escalation = self.check_and_escalate(dispatch)
            if escalation:
                escalations.append(escalation)

        return escalations
