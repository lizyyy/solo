from datetime import datetime
from app import db

class Tank(db.Model):
    __tablename__ = 'tanks'
    
    id = db.Column(db.Integer, primary_key=True)
    serial_number = db.Column(db.String(50), unique=True, nullable=False)
    volume = db.Column(db.Float, nullable=False)  
    tank_type = db.Column(db.String(20), nullable=False)  
    current_pressure = db.Column(db.Float, nullable=False, default=0)  
    inspection_expiry_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    fill_records = db.relationship('FillRecord', backref='tank', lazy='dynamic', cascade='all, delete-orphan')
    dive_plan_tanks = db.relationship('DivePlanTank', backref='tank', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'serial_number': self.serial_number,
            'volume': self.volume,
            'tank_type': self.tank_type,
            'current_pressure': self.current_pressure,
            'inspection_expiry_date': self.inspection_expiry_date.strftime('%Y-%m-%d'),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class FillRecord(db.Model):
    __tablename__ = 'fill_records'
    
    id = db.Column(db.Integer, primary_key=True)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    oxygen_partial_pressure = db.Column(db.Float, nullable=False)  
    fill_pressure = db.Column(db.Float, nullable=False)  
    fill_date = db.Column(db.DateTime, default=datetime.utcnow)
    operator = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tank_id': self.tank_id,
            'oxygen_partial_pressure': self.oxygen_partial_pressure,
            'fill_pressure': self.fill_pressure,
            'fill_date': self.fill_date.isoformat() if self.fill_date else None,
            'operator': self.operator,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class OxygenTarget(db.Model):
    __tablename__ = 'oxygen_targets'
    
    id = db.Column(db.Integer, primary_key=True)
    depth = db.Column(db.Float, nullable=False)  
    max_oxygen_partial_pressure = db.Column(db.Float, nullable=False, default=1.4)  
    description = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'depth': self.depth,
            'max_oxygen_partial_pressure': self.max_oxygen_partial_pressure,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class DivePlan(db.Model):
    __tablename__ = 'dive_plans'
    
    id = db.Column(db.Integer, primary_key=True)
    plan_name = db.Column(db.String(200), nullable=False)
    dive_date = db.Column(db.Date, nullable=False)
    dive_site = db.Column(db.String(200), nullable=False)
    coach = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='draft')  
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    dive_plan_tanks = db.relationship('DivePlanTank', backref='dive_plan', lazy='dynamic', cascade='all, delete-orphan')
    risk_assessments = db.relationship('RiskAssessment', backref='dive_plan', lazy='dynamic', cascade='all, delete-orphan')
    reviews = db.relationship('Review', backref='dive_plan', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'plan_name': self.plan_name,
            'dive_date': self.dive_date.strftime('%Y-%m-%d'),
            'dive_site': self.dive_site,
            'coach': self.coach,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class DivePlanTank(db.Model):
    __tablename__ = 'dive_plan_tanks'
    
    id = db.Column(db.Integer, primary_key=True)
    dive_plan_id = db.Column(db.Integer, db.ForeignKey('dive_plans.id'), nullable=False)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('dive_plan_id', 'tank_id', 'role', name='_dive_plan_tank_role_uc'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'dive_plan_id': self.dive_plan_id,
            'tank_id': self.tank_id,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class RiskAssessment(db.Model):
    __tablename__ = 'risk_assessments'
    
    id = db.Column(db.Integer, primary_key=True)
    dive_plan_id = db.Column(db.Integer, db.ForeignKey('dive_plans.id'), nullable=False)
    risk_type = db.Column(db.String(50), nullable=False)
    tank_id = db.Column(db.Integer, db.ForeignKey('tanks.id'), nullable=True)
    details = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False)  
    resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.String(100))
    resolved_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'dive_plan_id': self.dive_plan_id,
            'risk_type': self.risk_type,
            'tank_id': self.tank_id,
            'details': self.details,
            'severity': self.severity,
            'resolved': self.resolved,
            'resolved_by': self.resolved_by,
            'resolved_reason': self.resolved_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Review(db.Model):
    __tablename__ = 'reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    dive_plan_id = db.Column(db.Integer, db.ForeignKey('dive_plans.id'), nullable=False)
    risk_assessment_id = db.Column(db.Integer, db.ForeignKey('risk_assessments.id'), nullable=True)
    reviewer = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(20), nullable=False)  
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'dive_plan_id': self.dive_plan_id,
            'risk_assessment_id': self.risk_assessment_id,
            'reviewer': self.reviewer,
            'action': self.action,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
