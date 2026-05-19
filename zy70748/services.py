import uuid
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from database import Incident, AttributionClue, ProcessAction, IncidentStatus
from schemas import (
    IncidentCreate, IncidentUpdate, StatusTransition,
    AttributionClueCreate, IncidentQuery, IncidentExport
)


class IncidentService:
    def __init__(self, db: Session):
        self.db = db

    def generate_id(self) -> str:
        return f"inc-{uuid.uuid4().hex[:12]}"

    def generate_clue_id(self) -> str:
        return f"clue-{uuid.uuid4().hex[:12]}"

    def generate_action_id(self) -> str:
        return f"act-{uuid.uuid4().hex[:12]}"

    def check_idempotency(self, incident_id: str) -> Optional[Incident]:
        return self.db.query(Incident).filter(Incident.id == incident_id).first()

    def detect_overlapping_window(
        self, tenant_id: str, metric_name: str, start_time: datetime, end_time: datetime
    ) -> Optional[Incident]:
        return self.db.query(Incident).filter(
            Incident.tenant_id == tenant_id,
            Incident.metric_name == metric_name,
            Incident.status != IncidentStatus.WITHDRAWN,
            Incident.start_time < end_time,
            Incident.end_time > start_time
        ).first()

    def create_incident(self, data: IncidentCreate) -> Tuple[Incident, bool]:
        if data.id:
            existing = self.check_idempotency(data.id)
            if existing:
                return existing, False

        overlapping = self.detect_overlapping_window(
            data.tenant_id, data.metric_name, data.start_time, data.end_time
        )
        if overlapping:
            return overlapping, False

        incident_id = data.id or self.generate_id()
        incident = Incident(
            id=incident_id,
            tenant_id=data.tenant_id,
            tenant_name=data.tenant_name,
            metric_name=data.metric_name,
            metric_value=data.metric_value,
            baseline_value=data.baseline_value,
            deviation_ratio=data.deviation_ratio,
            start_time=data.start_time,
            end_time=data.end_time,
            title=data.title,
            created_by=data.created_by,
            raw_input=data.raw_input,
            status=IncidentStatus.CREATED
        )
        self.db.add(incident)
        self.db.commit()
        self.db.refresh(incident)
        return incident, True

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        return self.db.query(Incident).filter(Incident.id == incident_id).first()

    def query_incidents(self, query: IncidentQuery) -> Tuple[List[Incident], int]:
        q = self.db.query(Incident)
        if query.tenant_id:
            q = q.filter(Incident.tenant_id == query.tenant_id)
        if query.status:
            q = q.filter(Incident.status == query.status)
        if query.start_time_from:
            q = q.filter(Incident.start_time >= query.start_time_from)
        if query.start_time_to:
            q = q.filter(Incident.start_time <= query.start_time_to)

        total = q.count()
        q = q.order_by(Incident.created_at.desc())
        offset = (query.page - 1) * query.page_size
        incidents = q.offset(offset).limit(query.page_size).all()
        return incidents, total

    VALID_STATUS_TRANSITIONS = {
        IncidentStatus.CREATED: [IncidentStatus.INVESTIGATING, IncidentStatus.WITHDRAWN],
        IncidentStatus.INVESTIGATING: [IncidentStatus.ATTRIBUTED, IncidentStatus.WITHDRAWN],
        IncidentStatus.ATTRIBUTED: [IncidentStatus.RESOLVED, IncidentStatus.WITHDRAWN],
        IncidentStatus.RESOLVED: [IncidentStatus.CLOSED, IncidentStatus.WITHDRAWN],
        IncidentStatus.CLOSED: [],
        IncidentStatus.WITHDRAWN: [],
    }

    def is_valid_transition(self, from_status: str, to_status: str) -> bool:
        valid_next = self.VALID_STATUS_TRANSITIONS.get(from_status, [])
        return to_status in valid_next

    def transition_status(self, incident_id: str, transition: StatusTransition) -> tuple[Optional[Incident], bool]:
        incident = self.get_incident(incident_id)
        if not incident:
            return None, False

        from_status = incident.status
        to_status = transition.target_status

        if not self.is_valid_transition(from_status, to_status):
            return incident, False

        incident.status = to_status
        self.db.add(incident)

        action = ProcessAction(
            id=self.generate_action_id(),
            incident_id=incident_id,
            action_type="status_change",
            operator=transition.operator,
            conclusion=transition.conclusion,
            from_status=from_status,
            to_status=to_status
        )
        self.db.add(action)
        self.db.commit()
        self.db.refresh(incident)
        return incident, True

    def add_clue(self, incident_id: str, clue_data: AttributionClueCreate) -> Optional[AttributionClue]:
        incident = self.get_incident(incident_id)
        if not incident:
            return None

        existing_clue = self.db.query(AttributionClue).filter(
            AttributionClue.incident_id == incident_id,
            AttributionClue.source_system == clue_data.source_system,
            AttributionClue.clue_type == clue_data.clue_type,
            AttributionClue.description == clue_data.description
        ).first()

        if existing_clue:
            return existing_clue

        clue = AttributionClue(
            id=self.generate_clue_id(),
            incident_id=incident_id,
            source_system=clue_data.source_system,
            clue_type=clue_data.clue_type,
            description=clue_data.description,
            confidence=clue_data.confidence,
            is_primary=clue_data.is_primary,
            created_by=clue_data.created_by
        )
        self.db.add(clue)

        action = ProcessAction(
            id=self.generate_action_id(),
            incident_id=incident_id,
            action_type="add_clue",
            operator=clue_data.created_by,
            conclusion=f"新增线索: {clue_data.clue_type}"
        )
        self.db.add(action)
        self.db.commit()
        self.db.refresh(clue)
        return clue

    def manual_correct(self, incident_id: str, update_data: IncidentUpdate, operator: str) -> Optional[Incident]:
        incident = self.get_incident(incident_id)
        if not incident:
            return None

        changes = []
        if update_data.title is not None:
            incident.title = update_data.title
            changes.append("title")
        if update_data.summary is not None:
            incident.summary = update_data.summary
            changes.append("summary")
        if update_data.metric_value is not None:
            incident.metric_value = update_data.metric_value
            changes.append("metric_value")
        if update_data.baseline_value is not None:
            incident.baseline_value = update_data.baseline_value
            changes.append("baseline_value")
        if update_data.deviation_ratio is not None:
            incident.deviation_ratio = update_data.deviation_ratio
            changes.append("deviation_ratio")

        self.db.add(incident)

        action = ProcessAction(
            id=self.generate_action_id(),
            incident_id=incident_id,
            action_type="manual_correct",
            operator=operator,
            conclusion=f"人工修正字段: {', '.join(changes)}"
        )
        self.db.add(action)
        self.db.commit()
        self.db.refresh(incident)
        return incident

    def withdraw_incident(self, incident_id: str, operator: str, reason: str) -> tuple[Optional[Incident], bool]:
        incident = self.get_incident(incident_id)
        if not incident:
            return None, False

        from_status = incident.status
        if IncidentStatus.WITHDRAWN not in self.VALID_STATUS_TRANSITIONS.get(from_status, []):
            return incident, False

        incident.status = IncidentStatus.WITHDRAWN
        self.db.add(incident)

        action = ProcessAction(
            id=self.generate_action_id(),
            incident_id=incident_id,
            action_type="status_change",
            operator=operator,
            conclusion=f"撤回事故: {reason}",
            from_status=from_status,
            to_status=IncidentStatus.WITHDRAWN
        )
        self.db.add(action)
        self.db.commit()
        self.db.refresh(incident)
        return incident, True

    def close_incident(self, incident_id: str, operator: str, conclusion: str) -> tuple[Optional[Incident], bool]:
        incident = self.get_incident(incident_id)
        if not incident:
            return None, False

        from_status = incident.status
        if IncidentStatus.CLOSED not in self.VALID_STATUS_TRANSITIONS.get(from_status, []):
            return incident, False

        incident.status = IncidentStatus.CLOSED
        incident.summary = conclusion
        self.db.add(incident)

        action = ProcessAction(
            id=self.generate_action_id(),
            incident_id=incident_id,
            action_type="status_change",
            operator=operator,
            conclusion=f"关闭事故: {conclusion}",
            from_status=from_status,
            to_status=IncidentStatus.CLOSED
        )
        self.db.add(action)
        self.db.commit()
        self.db.refresh(incident)
        return incident, True

    def export_incident(self, incident_id: str) -> Optional[IncidentExport]:
        incident = self.get_incident(incident_id)
        if not incident:
            return None

        primary_clue = None
        for clue in incident.clues:
            if clue.is_primary:
                primary_clue = clue.description
                break

        final_conclusion = None
        for action in reversed(incident.actions):
            if action.to_status == IncidentStatus.CLOSED or action.to_status == IncidentStatus.WITHDRAWN:
                final_conclusion = action.conclusion
                break

        closed_at = None
        if incident.status in [IncidentStatus.CLOSED, IncidentStatus.WITHDRAWN]:
            for action in reversed(incident.actions):
                if action.to_status in [IncidentStatus.CLOSED, IncidentStatus.WITHDRAWN]:
                    closed_at = action.created_at
                    break

        return IncidentExport(
            incident_id=incident.id,
            title=incident.title,
            tenant_id=incident.tenant_id,
            tenant_name=incident.tenant_name,
            metric_name=incident.metric_name,
            metric_value=incident.metric_value,
            baseline_value=incident.baseline_value,
            deviation_ratio=incident.deviation_ratio,
            start_time=incident.start_time,
            end_time=incident.end_time,
            status=incident.status,
            summary=incident.summary,
            clue_count=len(incident.clues),
            primary_clue=primary_clue,
            final_conclusion=final_conclusion,
            created_at=incident.created_at,
            closed_at=closed_at
        )

    def get_clues(self, incident_id: str) -> List[AttributionClue]:
        return self.db.query(AttributionClue).filter(
            AttributionClue.incident_id == incident_id
        ).order_by(AttributionClue.created_at.desc()).all()

    def get_actions(self, incident_id: str) -> List[ProcessAction]:
        return self.db.query(ProcessAction).filter(
            ProcessAction.incident_id == incident_id
        ).order_by(ProcessAction.created_at.desc()).all()
