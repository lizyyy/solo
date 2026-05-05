from extensions import db
from datetime import datetime


class CustomsDeclaration(db.Model):
    __tablename__ = 'customs_declarations'
    
    id = db.Column(db.Integer, primary_key=True)
    declaration_no = db.Column(db.String(50), unique=True, nullable=False)
    vessel_name = db.Column(db.String(100))
    voyage_no = db.Column(db.String(50))
    port_of_departure = db.Column(db.String(100))
    port_of_arrival = db.Column(db.String(100))
    arrival_date = db.Column(db.DateTime)
    declaration_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    consignee = db.Column(db.String(200))
    consignor = db.Column(db.String(200))
    
    total_weight = db.Column(db.Float)
    total_packages = db.Column(db.Integer)
    total_containers = db.Column(db.Integer)
    
    status = db.Column(db.String(50), default='pending')
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = db.relationship('DeclarationItem', backref='declaration', lazy=True, cascade='all, delete-orphan')
    seal_records = db.relationship('SealRecord', backref='declaration', lazy=True, cascade='all, delete-orphan')
    xray_inspections = db.relationship('XrayInspection', backref='declaration', lazy=True, cascade='all, delete-orphan')
    lab_samples = db.relationship('LabSample', backref='declaration', lazy=True, cascade='all, delete-orphan')
    risk_assessments = db.relationship('RiskAssessment', backref='declaration', lazy=True, cascade='all, delete-orphan')
    reviews = db.relationship('ReviewRecord', backref='declaration', lazy=True, cascade='all, delete-orphan')


class DeclarationItem(db.Model):
    __tablename__ = 'declaration_items'
    
    id = db.Column(db.Integer, primary_key=True)
    declaration_id = db.Column(db.Integer, db.ForeignKey('customs_declarations.id'), nullable=False)
    
    item_no = db.Column(db.String(20))
    hs_code = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, nullable=False)
    description_en = db.Column(db.Text)
    
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), default='件')
    weight = db.Column(db.Float)
    weight_unit = db.Column(db.String(20), default='kg')
    
    value = db.Column(db.Float)
    currency = db.Column(db.String(10), default='USD')
    
    country_of_origin = db.Column(db.String(100))
    destination_country = db.Column(db.String(100))
    
    is_high_risk = db.Column(db.Boolean, default=False)
    risk_level = db.Column(db.String(20), default='normal')
    risk_reason = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Manifest(db.Model):
    __tablename__ = 'manifests'
    
    id = db.Column(db.Integer, primary_key=True)
    manifest_no = db.Column(db.String(50), unique=True, nullable=False)
    declaration_no = db.Column(db.String(50))
    
    vessel_name = db.Column(db.String(100))
    voyage_no = db.Column(db.String(50))
    port_of_departure = db.Column(db.String(100))
    port_of_arrival = db.Column(db.String(100))
    arrival_date = db.Column(db.DateTime)
    
    consignee = db.Column(db.String(200))
    consignor = db.Column(db.String(200))
    
    container_no = db.Column(db.String(50))
    container_type = db.Column(db.String(20))
    
    seal_no = db.Column(db.String(50))
    seal_type = db.Column(db.String(20))
    
    total_weight = db.Column(db.Float)
    total_packages = db.Column(db.Integer)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = db.relationship('ManifestItem', backref='manifest', lazy=True, cascade='all, delete-orphan')


class ManifestItem(db.Model):
    __tablename__ = 'manifest_items'
    
    id = db.Column(db.Integer, primary_key=True)
    manifest_id = db.Column(db.Integer, db.ForeignKey('manifests.id'), nullable=False)
    
    item_no = db.Column(db.String(20))
    hs_code = db.Column(db.String(20))
    description = db.Column(db.Text)
    
    quantity = db.Column(db.Float)
    unit = db.Column(db.String(20))
    weight = db.Column(db.Float)
    weight_unit = db.Column(db.String(20), default='kg')
    
    marks_and_numbers = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SealRecord(db.Model):
    __tablename__ = 'seal_records'
    
    id = db.Column(db.Integer, primary_key=True)
    declaration_id = db.Column(db.Integer, db.ForeignKey('customs_declarations.id'))
    container_no = db.Column(db.String(50), nullable=False)
    
    seal_no = db.Column(db.String(50), nullable=False)
    seal_type = db.Column(db.String(20))
    seal_status = db.Column(db.String(50), default='intact')
    
    install_date = db.Column(db.DateTime)
    install_location = db.Column(db.String(100))
    installed_by = db.Column(db.String(100))
    
    open_date = db.Column(db.DateTime)
    open_location = db.Column(db.String(100))
    opened_by = db.Column(db.String(100))
    open_reason = db.Column(db.Text)
    
    reseal_date = db.Column(db.DateTime)
    new_seal_no = db.Column(db.String(50))
    resealed_by = db.Column(db.String(100))
    
    is_chain_broken = db.Column(db.Boolean, default=False)
    chain_break_reason = db.Column(db.Text)
    
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class XrayInspection(db.Model):
    __tablename__ = 'xray_inspections'
    
    id = db.Column(db.Integer, primary_key=True)
    declaration_id = db.Column(db.Integer, db.ForeignKey('customs_declarations.id'))
    inspection_no = db.Column(db.String(50), unique=True, nullable=False)
    
    container_no = db.Column(db.String(50))
    inspection_date = db.Column(db.DateTime, default=datetime.utcnow)
    inspection_location = db.Column(db.String(100))
    inspector_name = db.Column(db.String(100))
    
    scan_result = db.Column(db.Text)
    scan_images = db.Column(db.Text)
    
    anomalies = db.Column(db.Text)
    anomaly_type = db.Column(db.String(100))
    anomaly_severity = db.Column(db.String(20), default='low')
    
    required_further_inspection = db.Column(db.Boolean, default=False)
    inspection_status = db.Column(db.String(50), default='completed')
    
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LabSample(db.Model):
    __tablename__ = 'lab_samples'
    
    id = db.Column(db.Integer, primary_key=True)
    declaration_id = db.Column(db.Integer, db.ForeignKey('customs_declarations.id'))
    sample_no = db.Column(db.String(50), unique=True, nullable=False)
    
    item_id = db.Column(db.Integer)
    container_no = db.Column(db.String(50))
    
    sample_date = db.Column(db.DateTime, default=datetime.utcnow)
    sample_location = db.Column(db.String(100))
    sampler_name = db.Column(db.String(100))
    
    sample_type = db.Column(db.String(100))
    sample_description = db.Column(db.Text)
    hs_code = db.Column(db.String(20))
    
    expected_test_items = db.Column(db.Text)
    actual_test_items = db.Column(db.Text)
    
    send_to_lab_date = db.Column(db.DateTime)
    lab_receive_date = db.Column(db.DateTime)
    report_date = db.Column(db.DateTime)
    
    test_result = db.Column(db.Text)
    result_summary = db.Column(db.Text)
    is_pass = db.Column(db.Boolean)
    
    test_deadline = db.Column(db.DateTime)
    is_overdue = db.Column(db.Boolean, default=False)
    
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RiskAssessment(db.Model):
    __tablename__ = 'risk_assessments'
    
    id = db.Column(db.Integer, primary_key=True)
    declaration_id = db.Column(db.Integer, db.ForeignKey('customs_declarations.id'))
    item_id = db.Column(db.Integer)
    
    risk_type = db.Column(db.String(50), nullable=False)
    risk_level = db.Column(db.String(20), default='low')
    risk_description = db.Column(db.Text, nullable=False)
    
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    related_data = db.Column(db.Text)
    
    is_reviewed = db.Column(db.Boolean, default=False)
    reviewed_at = db.Column(db.DateTime)
    reviewer_name = db.Column(db.String(100))
    review_status = db.Column(db.String(50), default='pending')
    review_notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ReviewRecord(db.Model):
    __tablename__ = 'review_records'
    
    id = db.Column(db.Integer, primary_key=True)
    declaration_id = db.Column(db.Integer, db.ForeignKey('customs_declarations.id'))
    risk_id = db.Column(db.Integer, db.ForeignKey('risk_assessments.id'))
    
    review_type = db.Column(db.String(50), nullable=False)
    reviewer_name = db.Column(db.String(100), nullable=False)
    review_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    review_status = db.Column(db.String(50), default='pending')
    review_notes = db.Column(db.Text)
    
    related_item_no = db.Column(db.String(20))
    related_container_no = db.Column(db.String(50))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
