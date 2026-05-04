from datetime import datetime
from marshmallow import Schema, fields
from app import db

class Authorization(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey('interview.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    respondent_name = db.Column(db.String(100), nullable=True)
    authorization_status = db.Column(db.String(50), default='pending')  # pending, valid, invalid
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Authorization {self.id}: {self.filename}>'

# Schema 定义
class AuthorizationSchema(Schema):
    id = fields.Int(dump_only=True)
    interview_id = fields.Int()
    filename = fields.Str()
    content = fields.Str()
    respondent_name = fields.Str()
    authorization_status = fields.Str()
    created_at = fields.DateTime(format='iso')
    updated_at = fields.DateTime(format='iso')
