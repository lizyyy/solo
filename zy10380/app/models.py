from datetime import datetime
from app import db
import uuid

class UploadPackage(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    uploaded_by = db.Column(db.String(100), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='UPLOADED')
    error_message = db.Column(db.Text)
    
    parse_result = db.relationship('ParseResult', back_populates='upload_package', uselist=False)
    batches = db.relationship('WriteBatch', back_populates='upload_package', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'uploaded_by': self.uploaded_by,
            'uploaded_at': self.uploaded_at.isoformat(),
            'status': self.status,
            'error_message': self.error_message
        }

class ParseResult(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_package_id = db.Column(db.String(36), db.ForeignKey('upload_package.id'), nullable=False)
    total_records = db.Column(db.Integer, default=0)
    valid_records = db.Column(db.Integer, default=0)
    invalid_records = db.Column(db.Integer, default=0)
    parsed_at = db.Column(db.DateTime, default=datetime.utcnow)
    parsed_by = db.Column(db.String(100))
    status = db.Column(db.String(50), default='PENDING')
    raw_data = db.Column(db.Text)
    validation_errors = db.Column(db.Text)
    
    upload_package = db.relationship('UploadPackage', back_populates='parse_result')
    preview_diffs = db.relationship('PreviewDiff', back_populates='parse_result', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'upload_package_id': self.upload_package_id,
            'total_records': self.total_records,
            'valid_records': self.valid_records,
            'invalid_records': self.invalid_records,
            'parsed_at': self.parsed_at.isoformat(),
            'parsed_by': self.parsed_by,
            'status': self.status
        }

class PreviewDiff(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parse_result_id = db.Column(db.String(36), db.ForeignKey('parse_result.id'), nullable=False)
    diff_type = db.Column(db.String(50), nullable=False)
    record_identifier = db.Column(db.String(255))
    current_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    confidence_score = db.Column(db.Float, default=1.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    parse_result = db.relationship('ParseResult', back_populates='preview_diffs')
    
    def to_dict(self):
        return {
            'id': self.id,
            'parse_result_id': self.parse_result_id,
            'diff_type': self.diff_type,
            'record_identifier': self.record_identifier,
            'current_value': self.current_value,
            'new_value': self.new_value,
            'confidence_score': self.confidence_score,
            'created_at': self.created_at.isoformat()
        }

class ConfirmationToken(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_package_id = db.Column(db.String(36), db.ForeignKey('upload_package.id'), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    created_by = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    confirmed_at = db.Column(db.DateTime)
    confirmed_by = db.Column(db.String(100))
    status = db.Column(db.String(50), default='PENDING')
    
    def is_expired(self):
        return datetime.utcnow() > self.expires_at
    
    def to_dict(self):
        return {
            'id': self.id,
            'upload_package_id': self.upload_package_id,
            'token': self.token,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat(),
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'confirmed_by': self.confirmed_by,
            'status': self.status,
            'is_expired': self.is_expired()
        }

class WriteBatch(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_package_id = db.Column(db.String(36), db.ForeignKey('upload_package.id'), nullable=False)
    batch_number = db.Column(db.Integer, nullable=False)
    total_records = db.Column(db.Integer, default=0)
    success_records = db.Column(db.Integer, default=0)
    failed_records = db.Column(db.Integer, default=0)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    status = db.Column(db.String(50), default='PENDING')
    written_by = db.Column(db.String(100))
    error_details = db.Column(db.Text)
    
    upload_package = db.relationship('UploadPackage', back_populates='batches')
    revocation_window = db.relationship('RevocationWindow', back_populates='write_batch', uselist=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'upload_package_id': self.upload_package_id,
            'batch_number': self.batch_number,
            'total_records': self.total_records,
            'success_records': self.success_records,
            'failed_records': self.failed_records,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'written_by': self.written_by
        }

class RevocationWindow(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    write_batch_id = db.Column(db.String(36), db.ForeignKey('write_batch.id'), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    revoked_at = db.Column(db.DateTime)
    revoked_by = db.Column(db.String(100))
    status = db.Column(db.String(50), default='ACTIVE')
    revocation_reason = db.Column(db.Text)
    
    write_batch = db.relationship('WriteBatch', back_populates='revocation_window')
    
    def is_expired(self):
        return datetime.utcnow() > self.expires_at
    
    def can_revoke(self):
        return self.status == 'ACTIVE' and not self.is_expired()
    
    def to_dict(self):
        return {
            'id': self.id,
            'write_batch_id': self.write_batch_id,
            'expires_at': self.expires_at.isoformat(),
            'revoked_at': self.revoked_at.isoformat() if self.revoked_at else None,
            'revoked_by': self.revoked_by,
            'status': self.status,
            'revocation_reason': self.revocation_reason,
            'is_expired': self.is_expired(),
            'can_revoke': self.can_revoke()
        }

class OperationHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    upload_package_id = db.Column(db.String(36), nullable=False)
    operation = db.Column(db.String(100), nullable=False)
    operator = db.Column(db.String(100), nullable=False)
    operated_at = db.Column(db.DateTime, default=datetime.utcnow)
    from_status = db.Column(db.String(50))
    to_status = db.Column(db.String(50))
    details = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'upload_package_id': self.upload_package_id,
            'operation': self.operation,
            'operator': self.operator,
            'operated_at': self.operated_at.isoformat(),
            'from_status': self.from_status,
            'to_status': self.to_status,
            'details': self.details
        }
