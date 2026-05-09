from datetime import datetime
from app import db
from enum import Enum


class DefectSeverity(Enum):
    CRITICAL = 'CRITICAL'
    HIGH = 'HIGH'
    MEDIUM = 'MEDIUM'
    LOW = 'LOW'


class TicketStatus(Enum):
    PENDING = 'PENDING'
    ASSIGNED = 'ASSIGNED'
    IN_PROGRESS = 'IN_PROGRESS'
    COMPLETED = 'COMPLETED'
    REINSPECTED = 'REINSPECTED'
    REOPENED = 'REOPENED'
    CLOSED = 'CLOSED'


STATUS_TRANSITIONS = {
    TicketStatus.PENDING: [TicketStatus.ASSIGNED],
    TicketStatus.ASSIGNED: [TicketStatus.IN_PROGRESS],
    TicketStatus.IN_PROGRESS: [TicketStatus.COMPLETED],
    TicketStatus.COMPLETED: [TicketStatus.REINSPECTED, TicketStatus.REOPENED],
    TicketStatus.REOPENED: [TicketStatus.ASSIGNED],
    TicketStatus.REINSPECTED: [TicketStatus.CLOSED],
    TicketStatus.CLOSED: []
}


class InspectionItem(db.Model):
    __tablename__ = 'inspection_items'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    equipment = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    defects = db.relationship('DefectTicket', backref='inspection_item', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'equipment': self.equipment,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class DefectTicket(db.Model):
    __tablename__ = 'defect_tickets'

    id = db.Column(db.Integer, primary_key=True)
    inspection_item_id = db.Column(db.Integer, db.ForeignKey('inspection_items.id'), nullable=False)
    severity = db.Column(db.Enum(DefectSeverity), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum(TicketStatus), default=TicketStatus.PENDING, nullable=False)
    version = db.Column(db.Integer, default=1, nullable=False)
    downtime_hours = db.Column(db.Float, default=0)
    created_by = db.Column(db.String(50), nullable=False)
    assigned_to = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    work_orders = db.relationship('WorkOrder', backref='defect_ticket', lazy=True)
    reinspections = db.relationship('Reinspection', backref='defect_ticket', lazy=True)
    downtime_records = db.relationship('DowntimeRecord', backref='defect_ticket', lazy=True)

    __mapper_args__ = {
        'version_id_col': version
    }

    def can_transition_to(self, new_status: TicketStatus) -> bool:
        return new_status in STATUS_TRANSITIONS[self.status]

    def to_dict(self):
        return {
            'id': self.id,
            'inspection_item_id': self.inspection_item_id,
            'severity': self.severity.value,
            'description': self.description,
            'status': self.status.value,
            'version': self.version,
            'downtime_hours': self.downtime_hours,
            'created_by': self.created_by,
            'assigned_to': self.assigned_to,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class WorkOrder(db.Model):
    __tablename__ = 'work_orders'

    id = db.Column(db.Integer, primary_key=True)
    defect_ticket_id = db.Column(db.Integer, db.ForeignKey('defect_tickets.id'), nullable=False)
    assignee = db.Column(db.String(50), nullable=False)
    instructions = db.Column(db.Text)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'defect_ticket_id': self.defect_ticket_id,
            'assignee': self.assignee,
            'instructions': self.instructions,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat()
        }


class Reinspection(db.Model):
    __tablename__ = 'reinspections'

    id = db.Column(db.Integer, primary_key=True)
    defect_ticket_id = db.Column(db.Integer, db.ForeignKey('defect_tickets.id'), nullable=False)
    inspector = db.Column(db.String(50), nullable=False)
    result = db.Column(db.Boolean, nullable=False)
    comments = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'defect_ticket_id': self.defect_ticket_id,
            'inspector': self.inspector,
            'result': self.result,
            'comments': self.comments,
            'created_at': self.created_at.isoformat()
        }


class DowntimeRecord(db.Model):
    __tablename__ = 'downtime_records'

    id = db.Column(db.Integer, primary_key=True)
    defect_ticket_id = db.Column(db.Integer, db.ForeignKey('defect_tickets.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    duration_hours = db.Column(db.Float)
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'defect_ticket_id': self.defect_ticket_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration_hours': self.duration_hours,
            'reason': self.reason,
            'created_at': self.created_at.isoformat()
        }


class ImpactStatistics(db.Model):
    __tablename__ = 'impact_statistics'

    id = db.Column(db.Integer, primary_key=True)
    period_start = db.Column(db.DateTime, nullable=False)
    period_end = db.Column(db.DateTime, nullable=False)
    total_tickets = db.Column(db.Integer, default=0)
    critical_count = db.Column(db.Integer, default=0)
    high_count = db.Column(db.Integer, default=0)
    medium_count = db.Column(db.Integer, default=0)
    low_count = db.Column(db.Integer, default=0)
    total_downtime_hours = db.Column(db.Float, default=0)
    avg_resolution_hours = db.Column(db.Float, default=0)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'period_start': self.period_start.isoformat(),
            'period_end': self.period_end.isoformat(),
            'total_tickets': self.total_tickets,
            'critical_count': self.critical_count,
            'high_count': self.high_count,
            'medium_count': self.medium_count,
            'low_count': self.low_count,
            'total_downtime_hours': self.total_downtime_hours,
            'avg_resolution_hours': self.avg_resolution_hours,
            'generated_at': self.generated_at.isoformat()
        }
