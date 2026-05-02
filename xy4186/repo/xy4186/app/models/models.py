from datetime import datetime, date
from app import db

class ImportBatch(db.Model):
    __tablename__ = 'import_batches'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_type = db.Column(db.String(50), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    import_date = db.Column(db.DateTime, default=datetime.utcnow)
    total_records = db.Column(db.Integer, default=0)
    success_records = db.Column(db.Integer, default=0)
    failed_records = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='processing')
    
    programs = db.relationship('Program', backref='import_batch', lazy=True)
    contracts = db.relationship('Contract', backref='import_batch', lazy=True)
    broadcast_events = db.relationship('BroadcastEvent', backref='import_batch', lazy=True)

class Program(db.Model):
    __tablename__ = 'programs'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('import_batches.id'), nullable=True)
    
    program_code = db.Column(db.String(50), nullable=False, unique=True)
    program_name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100))
    is_children_program = db.Column(db.Boolean, default=False)
    
    broadcast_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time)
    duration_seconds = db.Column(db.Integer)
    
    channel = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('program_code', 'broadcast_date', name='uq_program_code_date'),
    )

class Contract(db.Model):
    __tablename__ = 'contracts'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('import_batches.id'), nullable=True)
    
    contract_code = db.Column(db.String(50), nullable=False, unique=True)
    contract_name = db.Column(db.String(255))
    advertiser_name = db.Column(db.String(255), nullable=False)
    brand_name = db.Column(db.String(255), nullable=False)
    industry_category = db.Column(db.String(100))
    
    total_amount = db.Column(db.Float, default=0)
    total_duration_seconds = db.Column(db.Integer, default=0)
    used_duration_seconds = db.Column(db.Integer, default=0)
    remaining_duration_seconds = db.Column(db.Integer, default=0)
    
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Advertisement(db.Model):
    __tablename__ = 'advertisements'
    
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('contracts.id'), nullable=True)
    
    ad_code = db.Column(db.String(50), nullable=False, unique=True)
    ad_name = db.Column(db.String(255), nullable=False)
    brand_name = db.Column(db.String(255), nullable=False)
    industry_category = db.Column(db.String(100))
    duration_seconds = db.Column(db.Integer, nullable=False)
    
    is_rerun = db.Column(db.Boolean, default=False)
    original_ad_code = db.Column(db.String(50), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BroadcastEvent(db.Model):
    __tablename__ = 'broadcast_events'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('import_batches.id'), nullable=True)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=True)
    ad_id = db.Column(db.Integer, db.ForeignKey('advertisements.id'), nullable=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('contracts.id'), nullable=True)
    
    event_code = db.Column(db.String(50), unique=True)
    broadcast_date = db.Column(db.Date, nullable=False)
    broadcast_time = db.Column(db.Time, nullable=False)
    
    source_type = db.Column(db.String(20), default='schedule')
    status = db.Column(db.String(20), default='scheduled')
    
    brand_name = db.Column(db.String(255))
    ad_name = db.Column(db.String(255))
    duration_seconds = db.Column(db.Integer)
    industry_category = db.Column(db.String(100))
    
    is_rerun = db.Column(db.Boolean, default=False)
    original_event_id = db.Column(db.Integer, nullable=True)
    
    log_verified = db.Column(db.Boolean, default=False)
    log_match_score = db.Column(db.Float, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BlackoutPeriod(db.Model):
    __tablename__ = 'blackout_periods'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    
    day_of_week = db.Column(db.Integer)
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    
    restricted_categories = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class IndustryConflict(db.Model):
    __tablename__ = 'industry_conflicts'
    
    id = db.Column(db.Integer, primary_key=True)
    category_a = db.Column(db.String(100), nullable=False)
    category_b = db.Column(db.String(100), nullable=False)
    min_interval_seconds = db.Column(db.Integer, default=300)
    
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        db.UniqueConstraint('category_a', 'category_b', name='uq_industry_conflict_pair'),
    )

class ValidationResult(db.Model):
    __tablename__ = 'validation_results'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('broadcast_events.id'), nullable=True)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('contracts.id'), nullable=True)
    
    validation_type = db.Column(db.String(50), nullable=False)
    rule_code = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='warning')
    
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    affected_date = db.Column(db.Date)
    affected_time = db.Column(db.Time)
    
    related_event_ids = db.Column(db.Text)
    related_brand = db.Column(db.String(255))
    
    status = db.Column(db.String(20), default='open')
    resolution_note = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class HumanOpinion(db.Model):
    __tablename__ = 'human_opinions'
    
    id = db.Column(db.Integer, primary_key=True)
    validation_result_id = db.Column(db.Integer, db.ForeignKey('validation_results.id'), nullable=True)
    event_id = db.Column(db.Integer, db.ForeignKey('broadcast_events.id'), nullable=True)
    
    opinion_type = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    reviewer_name = db.Column(db.String(100))
    
    decision = db.Column(db.String(20))
    is_overruled = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(50))
    entity_id = db.Column(db.Integer)
    
    details = db.Column(db.Text)
    operator = db.Column(db.String(100))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
