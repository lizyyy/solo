from datetime import datetime
from app import db

class DataTable(db.Model):
    __tablename__ = 'data_tables'
    id = db.Column(db.Integer, primary_key=True)
    table_name = db.Column(db.String(200), nullable=False)
    database_name = db.Column(db.String(100), nullable=False)
    schema_name = db.Column(db.String(100))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    migration_history = db.Column(db.JSON, default=list)
    
    rules = db.relationship('QualityRule', backref='data_table', lazy=True)

class QualityRule(db.Model):
    __tablename__ = 'quality_rules'
    id = db.Column(db.Integer, primary_key=True)
    rule_code = db.Column(db.String(100), unique=True, nullable=False)
    rule_name = db.Column(db.String(200), nullable=False)
    rule_type = db.Column(db.String(50), nullable=False)
    table_id = db.Column(db.Integer, db.ForeignKey('data_tables.id'), nullable=False)
    column_name = db.Column(db.String(100))
    expression = db.Column(db.Text)
    threshold = db.Column(db.Float)
    severity = db.Column(db.String(20), default='warning')
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    name_history = db.Column(db.JSON, default=list)
    
    silences = db.relationship('RuleSilence', backref='rule', lazy=True)
    alerts = db.relationship('Alert', backref='rule', lazy=True)

class RuleSilence(db.Model):
    __tablename__ = 'rule_silences'
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('quality_rules.id'), nullable=False)
    table_id = db.Column(db.Integer, db.ForeignKey('data_tables.id'), nullable=False)
    applicant = db.Column(db.String(100), nullable=False)
    approver = db.Column(db.String(100))
    reason = db.Column(db.Text, nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='pending')
    restore_status = db.Column(db.String(20), default='pending')
    restore_attempts = db.Column(db.Integer, default=0)
    last_restore_attempt = db.Column(db.DateTime)
    restore_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime)
    expired_at = db.Column(db.DateTime)
    restored_at = db.Column(db.DateTime)
    
    alert_history = db.Column(db.JSON, default=list)
    
    @property
    def is_active(self):
        now = datetime.utcnow()
        return (self.status == 'approved' and 
                self.start_time <= now <= self.end_time and
                self.restore_status == 'pending')
    
    @property
    def is_expired(self):
        now = datetime.utcnow()
        return self.status == 'approved' and now > self.end_time

class Alert(db.Model):
    __tablename__ = 'alerts'
    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('quality_rules.id'), nullable=False)
    table_id = db.Column(db.Integer, db.ForeignKey('data_tables.id'), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='warning')
    message = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')
    merged_into = db.Column(db.Integer, db.ForeignKey('alerts.id'))
    merged_alerts = db.relationship('Alert', backref=db.backref('merged_parent', remote_side=[id]))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    silenced_by = db.Column(db.Integer, db.ForeignKey('rule_silences.id'))
