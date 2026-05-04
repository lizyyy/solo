from datetime import datetime
from extensions import db

class Equipment(db.Model):
    __tablename__ = 'equipment'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='available')  # available, maintenance, disabled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Fridge(db.Model):
    __tablename__ = 'fridge'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # cold, frozen
    total_capacity = db.Column(db.Float, nullable=False)  # 总容量（升）
    used_capacity = db.Column(db.Float, default=0.0)  # 已使用容量
    status = db.Column(db.String(20), default='available')  # available, maintenance, disabled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'total_capacity': self.total_capacity,
            'used_capacity': self.used_capacity,
            'available_capacity': self.total_capacity - self.used_capacity,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Volunteer(db.Model):
    __tablename__ = 'volunteer'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    qualification_type = db.Column(db.String(100), nullable=False)  # 资质类型，如食品安全证
    qualification_number = db.Column(db.String(100))
    qualification_valid_from = db.Column(db.Date, nullable=False)
    qualification_valid_until = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='active')  # active, inactive, suspended
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'qualification_type': self.qualification_type,
            'qualification_number': self.qualification_number,
            'qualification_valid_from': self.qualification_valid_from.isoformat() if self.qualification_valid_from else None,
            'qualification_valid_until': self.qualification_valid_until.isoformat() if self.qualification_valid_until else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Application(db.Model):
    __tablename__ = 'application'
    
    id = db.Column(db.Integer, primary_key=True)
    applicant_name = db.Column(db.String(100), nullable=False)
    applicant_phone = db.Column(db.String(20))
    activity_name = db.Column(db.String(200), nullable=False)
    activity_description = db.Column(db.Text)
    participant_count = db.Column(db.Integer, nullable=False)
    
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    
    volunteer_id = db.Column(db.Integer, db.ForeignKey('volunteer.id'))
    volunteer = db.relationship('Volunteer', backref='applications')
    
    equipment_ids = db.Column(db.Text)  # JSON 格式存储设备 ID 列表
    fridge_usage = db.Column(db.Text)  # JSON 格式存储冷藏格使用信息
    
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, need_materials, confirmed
    risk_level = db.Column(db.String(20), default='low')  # low, medium, high
    risk_notes = db.Column(db.Text)  # 风控检查结果
    
    materials_needed = db.Column(db.Text)  # JSON 格式存储需要补充的材料
    reviewer_id = db.Column(db.Integer)
    reviewer_name = db.Column(db.String(100))
    review_notes = db.Column(db.Text)
    reviewed_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'applicant_name': self.applicant_name,
            'applicant_phone': self.applicant_phone,
            'activity_name': self.activity_name,
            'activity_description': self.activity_description,
            'participant_count': self.participant_count,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'volunteer_id': self.volunteer_id,
            'volunteer_name': self.volunteer.name if self.volunteer else None,
            'equipment_ids': self.equipment_ids,
            'fridge_usage': self.fridge_usage,
            'status': self.status,
            'risk_level': self.risk_level,
            'risk_notes': self.risk_notes,
            'materials_needed': self.materials_needed,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer_name,
            'review_notes': self.review_notes,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('application.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # create, check_risk, approve, reject, modify, confirm, submit_materials
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20))
    risk_level = db.Column(db.String(20))
    risk_notes = db.Column(db.Text)
    reviewer_id = db.Column(db.Integer)
    reviewer_name = db.Column(db.String(100))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    application = db.relationship('Application', backref='audit_logs')
    
    def to_dict(self):
        return {
            'id': self.id,
            'application_id': self.application_id,
            'action': self.action,
            'old_status': self.old_status,
            'new_status': self.new_status,
            'risk_level': self.risk_level,
            'risk_notes': self.risk_notes,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer_name,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class EquipmentUsage(db.Model):
    __tablename__ = 'equipment_usage'
    
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('application.id'), nullable=False)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    application = db.relationship('Application', backref='equipment_usages')
    equipment = db.relationship('Equipment', backref='usages')
    
    def to_dict(self):
        return {
            'id': self.id,
            'application_id': self.application_id,
            'equipment_id': self.equipment_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class FridgeUsage(db.Model):
    __tablename__ = 'fridge_usage'
    
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('application.id'), nullable=False)
    fridge_id = db.Column(db.Integer, db.ForeignKey('fridge.id'), nullable=False)
    usage_capacity = db.Column(db.Float, nullable=False)  # 使用的容量（升）
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    application = db.relationship('Application', backref='fridge_usages')
    fridge = db.relationship('Fridge', backref='usages')
    
    def to_dict(self):
        return {
            'id': self.id,
            'application_id': self.application_id,
            'fridge_id': self.fridge_id,
            'usage_capacity': self.usage_capacity,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
