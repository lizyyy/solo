from datetime import datetime
from app import db
from app.errors import StateTransitionError


class Caregiver(db.Model):
    __tablename__ = 'caregivers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    employee_id = db.Column(db.String(50), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'employee_id': self.employee_id,
            'phone': self.phone,
            'status': self.status
        }


class PatrolPoint(db.Model):
    __tablename__ = 'patrol_points'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    location = db.Column(db.String(200))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'location': self.location,
            'description': self.description
        }


class PatrolRoute(db.Model):
    __tablename__ = 'patrol_routes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    shift_type = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    points = db.relationship('RoutePoint', backref='route', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'shift_type': self.shift_type,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'status': self.status,
            'points': [rp.to_dict() for rp in sorted(self.points, key=lambda x: x.order)]
        }


class RoutePoint(db.Model):
    __tablename__ = 'route_points'
    
    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('patrol_routes.id'), nullable=False)
    point_id = db.Column(db.Integer, db.ForeignKey('patrol_points.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False)
    required = db.Column(db.Boolean, default=True)
    tolerance_minutes = db.Column(db.Integer, default=10)
    
    point = db.relationship('PatrolPoint')
    
    def to_dict(self):
        return {
            'id': self.id,
            'route_id': self.route_id,
            'point_id': self.point_id,
            'point_name': self.point.name if self.point else None,
            'point_code': self.point.code if self.point else None,
            'order': self.order,
            'required': self.required,
            'tolerance_minutes': self.tolerance_minutes
        }


class CheckinEvent(db.Model):
    __tablename__ = 'checkin_events'
    
    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('patrol_routes.id'), nullable=False)
    point_id = db.Column(db.Integer, db.ForeignKey('patrol_points.id'), nullable=False)
    caregiver_id = db.Column(db.Integer, db.ForeignKey('caregivers.id'), nullable=False)
    checkin_time = db.Column(db.DateTime, nullable=False)
    checkin_type = db.Column(db.String(20), default='normal')
    status = db.Column(db.String(20), default='completed')
    location_verified = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    route = db.relationship('PatrolRoute')
    point = db.relationship('PatrolPoint')
    caregiver = db.relationship('Caregiver')
    supplement = db.relationship('SupplementRequest', backref='checkin', uselist=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'route_id': self.route_id,
            'route_name': self.route.name if self.route else None,
            'point_id': self.point_id,
            'point_name': self.point.name if self.point else None,
            'caregiver_id': self.caregiver_id,
            'caregiver_name': self.caregiver.name if self.caregiver else None,
            'checkin_time': self.checkin_time.strftime('%Y-%m-%d %H:%M:%S') if self.checkin_time else None,
            'checkin_type': self.checkin_type,
            'status': self.status,
            'location_verified': self.location_verified,
            'notes': self.notes,
            'has_supplement': self.supplement is not None
        }


class SupplementRequest(db.Model):
    __tablename__ = 'supplement_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    checkin_id = db.Column(db.Integer, db.ForeignKey('checkin_events.id'), nullable=False)
    requester_id = db.Column(db.Integer, db.ForeignKey('caregivers.id'), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey('caregivers.id'))
    reason = db.Column(db.Text, nullable=False)
    evidence = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    review_comment = db.Column(db.Text)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)
    
    requester = db.relationship('Caregiver', foreign_keys=[requester_id])
    reviewer = db.relationship('Caregiver', foreign_keys=[reviewer_id])
    
    VALID_TRANSITIONS = {
        'pending': ['approved', 'rejected'],
        'approved': [],
        'rejected': []
    }
    
    def can_transition_to(self, new_status):
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])
    
    def transition_to(self, new_status, reviewer_id, review_comment=None):
        if not self.can_transition_to(new_status):
            raise StateTransitionError(
                f'无法从状态 [{self.status}] 转换到 [{new_status}]',
                {'current_status': self.status, 'target_status': new_status}
            )
        self.status = new_status
        self.reviewer_id = reviewer_id
        self.review_comment = review_comment
        self.reviewed_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'id': self.id,
            'checkin_id': self.checkin_id,
            'requester_id': self.requester_id,
            'requester_name': self.requester.name if self.requester else None,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer.name if self.reviewer else None,
            'reason': self.reason,
            'evidence': self.evidence,
            'status': self.status,
            'review_comment': self.review_comment,
            'requested_at': self.requested_at.strftime('%Y-%m-%d %H:%M:%S') if self.requested_at else None,
            'reviewed_at': self.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if self.reviewed_at else None
        }


class MissedPatrol(db.Model):
    __tablename__ = 'missed_patrols'
    
    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('patrol_routes.id'), nullable=False)
    point_id = db.Column(db.Integer, db.ForeignKey('patrol_points.id'), nullable=False)
    caregiver_id = db.Column(db.Integer, db.ForeignKey('caregivers.id'), nullable=False)
    shift_date = db.Column(db.Date, nullable=False)
    expected_time = db.Column(db.DateTime, nullable=False)
    detection_time = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='confirmed')
    responsibility_shift = db.Column(db.String(50))
    notes = db.Column(db.Text)
    resolved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    route = db.relationship('PatrolRoute')
    point = db.relationship('PatrolPoint')
    caregiver = db.relationship('Caregiver')
    
    VALID_TRANSITIONS = {
        'confirmed': ['resolved', 'appealed'],
        'appealed': ['confirmed', 'resolved'],
        'resolved': []
    }
    
    def can_transition_to(self, new_status):
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])
    
    def transition_to(self, new_status, notes=None):
        if not self.can_transition_to(new_status):
            raise StateTransitionError(
                f'无法从状态 [{self.status}] 转换到 [{new_status}]',
                {'current_status': self.status, 'target_status': new_status}
            )
        self.status = new_status
        if notes:
            self.notes = notes
        if new_status == 'resolved':
            self.resolved_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'id': self.id,
            'route_id': self.route_id,
            'route_name': self.route.name if self.route else None,
            'point_id': self.point_id,
            'point_name': self.point.name if self.point else None,
            'caregiver_id': self.caregiver_id,
            'caregiver_name': self.caregiver.name if self.caregiver else None,
            'shift_date': self.shift_date.strftime('%Y-%m-%d') if self.shift_date else None,
            'expected_time': self.expected_time.strftime('%Y-%m-%d %H:%M:%S') if self.expected_time else None,
            'detection_time': self.detection_time.strftime('%Y-%m-%d %H:%M:%S') if self.detection_time else None,
            'status': self.status,
            'responsibility_shift': self.responsibility_shift,
            'notes': self.notes,
            'resolved_at': self.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if self.resolved_at else None
        }


class PatrolReport(db.Model):
    __tablename__ = 'patrol_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    report_date = db.Column(db.Date, nullable=False)
    route_id = db.Column(db.Integer, db.ForeignKey('patrol_routes.id'), nullable=False)
    caregiver_id = db.Column(db.Integer, db.ForeignKey('caregivers.id'), nullable=False)
    total_points = db.Column(db.Integer, default=0)
    checked_points = db.Column(db.Integer, default=0)
    missed_points = db.Column(db.Integer, default=0)
    supplement_count = db.Column(db.Integer, default=0)
    completion_rate = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='generated')
    notes = db.Column(db.Text)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    route = db.relationship('PatrolRoute')
    caregiver = db.relationship('Caregiver')
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_date': self.report_date.strftime('%Y-%m-%d') if self.report_date else None,
            'route_id': self.route_id,
            'route_name': self.route.name if self.route else None,
            'caregiver_id': self.caregiver_id,
            'caregiver_name': self.caregiver.name if self.caregiver else None,
            'total_points': self.total_points,
            'checked_points': self.checked_points,
            'missed_points': self.missed_points,
            'supplement_count': self.supplement_count,
            'completion_rate': self.completion_rate,
            'status': self.status,
            'notes': self.notes,
            'generated_at': self.generated_at.strftime('%Y-%m-%d %H:%M:%S') if self.generated_at else None
        }
