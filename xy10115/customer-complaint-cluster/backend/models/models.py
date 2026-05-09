from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import relationship

db = SQLAlchemy()


class Complaint(db.Model):
    __tablename__ = 'complaints'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    original_id = db.Column(db.String(100))
    text = db.Column(db.Text, nullable=False)
    original_tags = db.Column(db.Text)
    import_time = db.Column(db.DateTime, default=datetime.utcnow)
    current_cluster_id = db.Column(db.Integer, db.ForeignKey('clusters.id'))
    
    assignments = relationship('ClusterAssignment', backref='complaint', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'original_id': self.original_id,
            'text': self.text,
            'original_tags': self.original_tags,
            'import_time': self.import_time.isoformat() if self.import_time else None,
            'current_cluster_id': self.current_cluster_id
        }


class Cluster(db.Model):
    __tablename__ = 'clusters'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200))
    description = db.Column(db.Text)
    version_id = db.Column(db.Integer, db.ForeignKey('versions.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_manual = db.Column(db.Boolean, default=False)
    keywords = db.Column(db.Text)
    
    complaints = relationship('Complaint', backref='current_cluster', foreign_keys='Complaint.current_cluster_id')
    assignments = relationship('ClusterAssignment', backref='cluster', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'version_id': self.version_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_manual': self.is_manual,
            'keywords': self.keywords
        }


class ClusterAssignment(db.Model):
    __tablename__ = 'cluster_assignments'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id'), nullable=False)
    cluster_id = db.Column(db.Integer, db.ForeignKey('clusters.id'), nullable=False)
    version_id = db.Column(db.Integer, db.ForeignKey('versions.id'), nullable=False)
    confidence = db.Column(db.Float)
    reason = db.Column(db.Text)
    is_manual = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'complaint_id': self.complaint_id,
            'cluster_id': self.cluster_id,
            'version_id': self.version_id,
            'confidence': self.confidence,
            'reason': self.reason,
            'is_manual': self.is_manual,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Version(db.Model):
    __tablename__ = 'versions'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(50))
    parent_version_id = db.Column(db.Integer, db.ForeignKey('versions.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_current = db.Column(db.Boolean, default=False)
    
    clusters = relationship('Cluster', backref='version', foreign_keys='Cluster.version_id')
    assignments = relationship('ClusterAssignment', backref='version', foreign_keys='ClusterAssignment.version_id')
    operations = relationship('OperationLog', backref='version', foreign_keys='OperationLog.version_id')
    child_versions = relationship('Version', backref=db.backref('parent', remote_side=[id]))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'type': self.type,
            'parent_version_id': self.parent_version_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_current': self.is_current
        }


class OperationLog(db.Model):
    __tablename__ = 'operation_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    version_id = db.Column(db.Integer, db.ForeignKey('versions.id'))
    operation_type = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'version_id': self.version_id,
            'operation_type': self.operation_type,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Rule(db.Model):
    __tablename__ = 'rules'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), nullable=False)
    pattern = db.Column(db.Text, nullable=False)
    pattern_type = db.Column(db.String(20), default='keyword')
    cluster_name = db.Column(db.String(200))
    priority = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'pattern': self.pattern,
            'pattern_type': self.pattern_type,
            'cluster_name': self.cluster_name,
            'priority': self.priority,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
