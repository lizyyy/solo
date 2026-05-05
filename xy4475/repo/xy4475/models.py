from extensions import db
from datetime import datetime
from dateutil.relativedelta import relativedelta

class Case(db.Model):
    __tablename__ = 'cases'
    
    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(50), unique=True, nullable=False)
    case_name = db.Column(db.String(200), nullable=False)
    case_type = db.Column(db.String(50), nullable=False)
    entrusted_by = db.Column(db.String(100), nullable=False)
    entrust_date = db.Column(db.Date, nullable=False)
    deadline = db.Column(db.Date, nullable=False)
    case_status = db.Column(db.String(20), default='待处理')
    create_time = db.Column(db.DateTime, default=datetime.now)
    update_time = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    # 关系
    evidences = db.relationship('Evidence', backref='case', lazy='dynamic', cascade='all, delete-orphan')
    inspections = db.relationship('Inspection', backref='case', lazy='dynamic', cascade='all, delete-orphan')
    inventory_logs = db.relationship('InventoryLog', backref='case', lazy='dynamic', cascade='all, delete-orphan')
    risk_reviews = db.relationship('RiskReview', backref='case', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'case_number': self.case_number,
            'case_name': self.case_name,
            'case_type': self.case_type,
            'entrusted_by': self.entrusted_by,
            'entrust_date': self.entrust_date.isoformat() if self.entrust_date else None,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'case_status': self.case_status,
            'create_time': self.create_time.isoformat() if self.create_time else None,
            'update_time': self.update_time.isoformat() if self.update_time else None
        }

class Evidence(db.Model):
    __tablename__ = 'evidences'
    
    id = db.Column(db.Integer, primary_key=True)
    evidence_number = db.Column(db.String(50), unique=True, nullable=False)
    evidence_name = db.Column(db.String(200), nullable=False)
    evidence_type = db.Column(db.String(50), nullable=False)
    seal_number = db.Column(db.String(50), unique=True, nullable=False)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    create_time = db.Column(db.DateTime, default=datetime.now)
    update_time = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    # 关系
    seal_records = db.relationship('SealRecord', backref='evidence', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'evidence_number': self.evidence_number,
            'evidence_name': self.evidence_name,
            'evidence_type': self.evidence_type,
            'seal_number': self.seal_number,
            'case_id': self.case_id,
            'case_number': self.case.case_number if self.case else None,
            'create_time': self.create_time.isoformat() if self.create_time else None,
            'update_time': self.update_time.isoformat() if self.update_time else None
        }

class SealRecord(db.Model):
    __tablename__ = 'seal_records'
    
    id = db.Column(db.Integer, primary_key=True)
    evidence_id = db.Column(db.Integer, db.ForeignKey('evidences.id'), nullable=False)
    operation = db.Column(db.String(20), nullable=False)  # 封签/解封
    operator = db.Column(db.String(50), nullable=False)
    seal_number = db.Column(db.String(50), nullable=False)
    previous_seal = db.Column(db.String(50), nullable=True)
    next_seal = db.Column(db.String(50), nullable=True)
    operation_time = db.Column(db.DateTime, default=datetime.now)
    location = db.Column(db.String(100), nullable=False)
    purpose = db.Column(db.String(200), nullable=True)
    is_chain_complete = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'evidence_id': self.evidence_id,
            'evidence_number': self.evidence.evidence_number if self.evidence else None,
            'operation': self.operation,
            'operator': self.operator,
            'seal_number': self.seal_number,
            'previous_seal': self.previous_seal,
            'next_seal': self.next_seal,
            'operation_time': self.operation_time.isoformat() if self.operation_time else None,
            'location': self.location,
            'purpose': self.purpose,
            'is_chain_complete': self.is_chain_complete
        }

class Inspection(db.Model):
    __tablename__ = 'inspections'
    
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    inspection_step = db.Column(db.Integer, nullable=False)
    step_name = db.Column(db.String(100), nullable=False)
    inspector = db.Column(db.String(50), nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.now)
    end_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='进行中')
    result = db.Column(db.Text, nullable=True)
    is_overdue = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'case_id': self.case_id,
            'case_number': self.case.case_number if self.case else None,
            'inspection_step': self.inspection_step,
            'step_name': self.step_name,
            'inspector': self.inspector,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'status': self.status,
            'result': self.result,
            'is_overdue': self.is_overdue
        }

class InventoryLog(db.Model):
    __tablename__ = 'inventory_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    evidence_id = db.Column(db.Integer, db.ForeignKey('evidences.id'), nullable=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    operation_type = db.Column(db.String(20), nullable=False)  # 入库/出库/归还
    operator = db.Column(db.String(50), nullable=False)
    operation_time = db.Column(db.DateTime, default=datetime.now)
    borrower = db.Column(db.String(50), nullable=True)
    borrow_purpose = db.Column(db.String(200), nullable=True)
    expected_return_time = db.Column(db.DateTime, nullable=True)
    actual_return_time = db.Column(db.DateTime, nullable=True)
    is_returned = db.Column(db.Boolean, default=False)
    is_overdue = db.Column(db.Boolean, default=False)
    location = db.Column(db.String(100), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'evidence_id': self.evidence_id,
            'case_id': self.case_id,
            'case_number': self.case.case_number if self.case else None,
            'operation_type': self.operation_type,
            'operator': self.operator,
            'operation_time': self.operation_time.isoformat() if self.operation_time else None,
            'borrower': self.borrower,
            'borrow_purpose': self.borrow_purpose,
            'expected_return_time': self.expected_return_time.isoformat() if self.expected_return_time else None,
            'actual_return_time': self.actual_return_time.isoformat() if self.actual_return_time else None,
            'is_returned': self.is_returned,
            'is_overdue': self.is_overdue,
            'location': self.location
        }

class RiskReview(db.Model):
    __tablename__ = 'risk_reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    risk_type = db.Column(db.String(50), nullable=False)  # 封签断链/编号冲突/检验超期/借阅未归还
    risk_level = db.Column(db.String(20), nullable=False)  # 高/中/低
    risk_description = db.Column(db.Text, nullable=False)
    reviewer = db.Column(db.String(50), nullable=False)
    review_time = db.Column(db.DateTime, default=datetime.now)
    review_comment = db.Column(db.Text, nullable=False)
    is_resolved = db.Column(db.Boolean, default=False)
    resolution_time = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'case_id': self.case_id,
            'case_number': self.case.case_number if self.case else None,
            'risk_type': self.risk_type,
            'risk_level': self.risk_level,
            'risk_description': self.risk_description,
            'reviewer': self.reviewer,
            'review_time': self.review_time.isoformat() if self.review_time else None,
            'review_comment': self.review_comment,
            'is_resolved': self.is_resolved,
            'resolution_time': self.resolution_time.isoformat() if self.resolution_time else None
        }
