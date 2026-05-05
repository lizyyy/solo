from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Batch(db.Model):
    __tablename__ = 'batches'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    sample_name = db.Column(db.String(100), nullable=False)
    collection_date = db.Column(db.Date, nullable=True)
    location = db.Column(db.String(200), nullable=True)
    sample_type = db.Column(db.String(50), nullable=True)
    technician = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    particles = db.relationship('Particle', backref='batch', lazy='dynamic', cascade='all, delete-orphan')
    controls = db.relationship('Control', backref='batch', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'sample_name': self.sample_name,
            'collection_date': self.collection_date.isoformat() if self.collection_date else None,
            'location': self.location,
            'sample_type': self.sample_type,
            'technician': self.technician,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'particle_count': self.particles.count()
        }

class Particle(db.Model):
    __tablename__ = 'particles'
    
    id = db.Column(db.Integer, primary_key=True)
    particle_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=False, index=True)
    
    image_path = db.Column(db.String(500), nullable=True)
    x_coordinate = db.Column(db.Float, nullable=True)
    y_coordinate = db.Column(db.Float, nullable=True)
    
    area = db.Column(db.Float, nullable=True)
    perimeter = db.Column(db.Float, nullable=True)
    aspect_ratio = db.Column(db.Float, nullable=True)
    circularity = db.Column(db.Float, nullable=True)
    solidity = db.Column(db.Float, nullable=True)
    extent = db.Column(db.Float, nullable=True)
    mean_intensity = db.Column(db.Float, nullable=True)
    max_intensity = db.Column(db.Float, nullable=True)
    min_intensity = db.Column(db.Float, nullable=True)
    color_r = db.Column(db.Integer, nullable=True)
    color_g = db.Column(db.Integer, nullable=True)
    color_b = db.Column(db.Integer, nullable=True)
    
    auto_classification = db.Column(db.String(20), nullable=True)
    auto_confidence = db.Column(db.Float, nullable=True)
    
    manual_classification = db.Column(db.String(20), nullable=True)
    manual_confidence = db.Column(db.Float, nullable=True)
    reviewed_by = db.Column(db.String(50), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    
    risk_level = db.Column(db.String(20), nullable=True)
    is_flagged = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_final_classification(self):
        return self.manual_classification or self.auto_classification or 'unclear'
    
    def get_final_confidence(self):
        return self.manual_confidence or self.auto_confidence or 0.0
    
    def to_dict(self, include_batch=False):
        result = {
            'id': self.id,
            'particle_id': self.particle_id,
            'batch_id': self.batch.batch_id if self.batch else None,
            'image_path': self.image_path,
            'x_coordinate': self.x_coordinate,
            'y_coordinate': self.y_coordinate,
            'area': self.area,
            'perimeter': self.perimeter,
            'aspect_ratio': self.aspect_ratio,
            'circularity': self.circularity,
            'solidity': self.solidity,
            'extent': self.extent,
            'mean_intensity': self.mean_intensity,
            'max_intensity': self.max_intensity,
            'min_intensity': self.min_intensity,
            'color_r': self.color_r,
            'color_g': self.color_g,
            'color_b': self.color_b,
            'auto_classification': self.auto_classification,
            'auto_confidence': self.auto_confidence,
            'manual_classification': self.manual_classification,
            'manual_confidence': self.manual_confidence,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_notes': self.review_notes,
            'final_classification': self.get_final_classification(),
            'final_confidence': self.get_final_confidence(),
            'risk_level': self.risk_level,
            'is_flagged': self.is_flagged,
            'is_reviewed': self.manual_classification is not None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_batch and self.batch:
            result['batch_info'] = self.batch.to_dict()
        return result

class Control(db.Model):
    __tablename__ = 'controls'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=False, index=True)
    
    control_type = db.Column(db.String(50), nullable=False)
    control_name = db.Column(db.String(100), nullable=False)
    
    particle_count = db.Column(db.Integer, default=0)
    fiber_count = db.Column(db.Integer, default=0)
    bubble_count = db.Column(db.Integer, default=0)
    
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch.batch_id if self.batch else None,
            'control_type': self.control_type,
            'control_name': self.control_name,
            'particle_count': self.particle_count,
            'fiber_count': self.fiber_count,
            'bubble_count': self.bubble_count,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(50), nullable=False)
    entity_type = db.Column(db.String(50), nullable=True)
    entity_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.Text, nullable=True)
    user = db.Column(db.String(50), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'details': self.details,
            'user': self.user,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
