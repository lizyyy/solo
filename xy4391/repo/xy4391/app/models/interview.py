from datetime import datetime
from marshmallow import Schema, fields
from app import db

class Interview(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_content = db.Column(db.Text, nullable=False)
    anonymized_content = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, reviewed, rolled_back
    researcher_name = db.Column(db.String(100), nullable=True)
    interview_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    versions = db.relationship('InterviewVersion', backref='interview', lazy='dynamic', cascade='all, delete-orphan')
    summary = db.relationship('InterviewSummary', backref='interview', uselist=False, cascade='all, delete-orphan')
    authorizations = db.relationship('Authorization', backref='interview', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Interview {self.id}: {self.filename}>'

class InterviewVersion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey('interview.id'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('interview_id', 'version_number'),)
    
    def __repr__(self):
        return f'<InterviewVersion {self.interview_id}.{self.version_number}>'

class InterviewSummary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey('interview.id'), nullable=False, unique=True)
    summary_content = db.Column(db.Text, nullable=False)
    keywords = db.Column(db.Text, nullable=True)  # 存储为 JSON 字符串
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<InterviewSummary {self.interview_id}>'

# Schema 定义
class InterviewSchema(Schema):
    id = fields.Int(dump_only=True)
    filename = fields.Str()
    original_content = fields.Str()
    anonymized_content = fields.Str()
    status = fields.Str()
    researcher_name = fields.Str()
    interview_date = fields.DateTime(format='iso')
    created_at = fields.DateTime(format='iso')
    updated_at = fields.DateTime(format='iso')

class InterviewVersionSchema(Schema):
    id = fields.Int(dump_only=True)
    interview_id = fields.Int()
    version_number = fields.Int()
    content = fields.Str()
    created_at = fields.DateTime(format='iso')

class InterviewSummarySchema(Schema):
    id = fields.Int(dump_only=True)
    interview_id = fields.Int()
    summary_content = fields.Str()
    keywords = fields.Str()
    created_at = fields.DateTime(format='iso')
    updated_at = fields.DateTime(format='iso')
