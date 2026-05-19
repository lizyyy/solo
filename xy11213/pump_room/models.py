from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from enum import Enum

db = SQLAlchemy()

class PumpRoomStatus(Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    MAINTENANCE = "maintenance"

class RepairStatus(Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    ARRIVED = "arrived"
    REINSPECTING = "reinspecting"
    CLOSED = "closed"
    ESCALATED = "escalated"

class OperationType(Enum):
    CREATE = "create"
    ASSIGN = "assign"
    ARRIVE = "arrive"
    REINSPECT = "reinspect"
    CLOSE = "close"
    ESCALATE = "escalate"
    BLOCK = "block"
    RELEASE = "release"

class PumpRoom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    location = db.Column(db.String(200))
    status = db.Column(db.Enum(PumpRoomStatus), default=PumpRoomStatus.NORMAL)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    repairs = db.relationship('Repair', backref='pump_room', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Staff(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    assigned_tasks = db.relationship('Repair', foreign_keys='Repair.assigned_to', backref='assignee', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'role': self.role,
            'created_at': self.created_at.isoformat()
        }

class Repair(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pump_room_id = db.Column(db.Integer, db.ForeignKey('pump_room.id'), nullable=False)
    report_source = db.Column(db.String(100))
    problem_type = db.Column(db.String(100))
    description = db.Column(db.Text)
    reporter = db.Column(db.String(100))
    reporter_phone = db.Column(db.String(20))
    status = db.Column(db.Enum(RepairStatus), default=RepairStatus.PENDING)
    assigned_to = db.Column(db.Integer, db.ForeignKey('staff.id'))
    assigned_at = db.Column(db.DateTime)
    arrived_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)
    escalated_at = db.Column(db.DateTime)
    escalation_level = db.Column(db.Integer, default=0)
    is_blocked = db.Column(db.Boolean, default=False)
    block_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    reinspections = db.relationship('Reinspection', backref='repair', lazy=True, cascade='all, delete-orphan')
    operation_logs = db.relationship('OperationLog', backref='repair', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'pump_room_id': self.pump_room_id,
            'pump_room_name': self.pump_room.name if self.pump_room else None,
            'report_source': self.report_source,
            'problem_type': self.problem_type,
            'description': self.description,
            'reporter': self.reporter,
            'reporter_phone': self.reporter_phone,
            'status': self.status.value,
            'assigned_to': self.assigned_to,
            'assignee_name': self.assignee.name if self.assignee else None,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'arrived_at': self.arrived_at.isoformat() if self.arrived_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'escalated_at': self.escalated_at.isoformat() if self.escalated_at else None,
            'escalation_level': self.escalation_level,
            'is_blocked': self.is_blocked,
            'block_reason': self.block_reason,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Reinspection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    repair_id = db.Column(db.Integer, db.ForeignKey('repair.id'), nullable=False)
    inspector = db.Column(db.String(100))
    result = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    is_passed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'repair_id': self.repair_id,
            'inspector': self.inspector,
            'result': self.result,
            'description': self.description,
            'is_passed': self.is_passed,
            'created_at': self.created_at.isoformat()
        }

class OperationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    repair_id = db.Column(db.Integer, db.ForeignKey('repair.id'))
    operation_type = db.Column(db.Enum(OperationType), nullable=False)
    operator = db.Column(db.String(100))
    reason = db.Column(db.Text)
    details = db.Column(db.Text)
    batch_id = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'repair_id': self.repair_id,
            'operation_type': self.operation_type.value,
            'operator': self.operator,
            'reason': self.reason,
            'details': self.details,
            'batch_id': self.batch_id,
            'created_at': self.created_at.isoformat()
        }

class BatchOperation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(100), unique=True, nullable=False)
    operation_type = db.Column(db.String(50))
    total_count = db.Column(db.Integer, default=0)
    success_count = db.Column(db.Integer, default=0)
    fail_count = db.Column(db.Integer, default=0)
    success_ids = db.Column(db.Text)
    fail_details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'operation_type': self.operation_type,
            'total_count': self.total_count,
            'success_count': self.success_count,
            'fail_count': self.fail_count,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
