from datetime import datetime
from marshmallow import Schema, fields
from app import db

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey('interview.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)  # upload, anonymize, review, rollback, export
    user = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<AuditLog {self.id}: {self.action}>'

# Schema 定义
class AuditLogSchema(Schema):
    id = fields.Int(dump_only=True)
    interview_id = fields.Int()
    action = fields.Str()
    user = fields.Str()
    description = fields.Str()
    ip_address = fields.Str()
    created_at = fields.DateTime(format='iso')
