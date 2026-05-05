from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Sample(db.Model):
    __tablename__ = 'samples'
    
    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    sample_name = db.Column(db.String(200))
    fabric_type = db.Column(db.String(100))
    
    # 色差仪读数
    delta_e = db.Column(db.Float)
    delta_l = db.Column(db.Float)
    delta_a = db.Column(db.Float)
    delta_b = db.Column(db.Float)
    
    # 摩擦测试
    friction_dry_grade = db.Column(db.Integer)
    friction_wet_grade = db.Column(db.Integer)
    
    # 洗涤测试
    washing_color_fastness = db.Column(db.Integer)
    washing_staining = db.Column(db.Integer)
    
    # 人工复核
    review_notes = db.Column(db.Text)
    reviewed_by = db.Column(db.String(100))
    reviewed_at = db.Column(db.DateTime)
    
    # 风险评估
    risk_score = db.Column(db.Float, default=0.0)
    risk_level = db.Column(db.String(20), default='normal')  # normal, warning, critical
    
    # 状态
    status = db.Column(db.String(20), default='normal')  # normal, duplicate, fixed, pending
    is_active = db.Column(db.Boolean, default=True)
    
    # 元数据
    import_date = db.Column(db.DateTime, default=datetime.utcnow)
    import_source = db.Column(db.String(100))  # 导入来源文件名
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'sample_id': self.sample_id,
            'sample_name': self.sample_name,
            'fabric_type': self.fabric_type,
            'delta_e': self.delta_e,
            'delta_l': self.delta_l,
            'delta_a': self.delta_a,
            'delta_b': self.delta_b,
            'friction_dry_grade': self.friction_dry_grade,
            'friction_wet_grade': self.friction_wet_grade,
            'washing_color_fastness': self.washing_color_fastness,
            'washing_staining': self.washing_staining,
            'review_notes': self.review_notes,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'risk_score': self.risk_score,
            'risk_level': self.risk_level,
            'status': self.status,
            'is_active': self.is_active,
            'import_date': self.import_date.isoformat() if self.import_date else None,
            'import_source': self.import_source,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class AnomalySample(db.Model):
    __tablename__ = 'anomaly_samples'
    
    id = db.Column(db.Integer, primary_key=True)
    original_filename = db.Column(db.String(200), nullable=False, index=True)
    line_number = db.Column(db.Integer, nullable=False)
    sample_id = db.Column(db.String(50))  # 可能为空（缺字段情况）
    raw_data = db.Column(db.Text, nullable=False)  # 原始数据JSON
    anomaly_type = db.Column(db.String(50), nullable=False)  # missing_field, invalid_id, out_of_range, duplicate
    anomaly_reason = db.Column(db.Text, nullable=False)
    affected_fields = db.Column(db.Text)  # JSON格式存储受影响的字段
    
    # 处理状态
    is_fixed = db.Column(db.Boolean, default=False)
    fixed_by = db.Column(db.String(100))
    fixed_at = db.Column(db.DateTime)
    fix_notes = db.Column(db.Text)
    
    # 关联到修复后的样本
    fixed_sample_id = db.Column(db.Integer, db.ForeignKey('samples.id'))
    fixed_sample = db.relationship('Sample', backref='anomaly_source')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'original_filename': self.original_filename,
            'line_number': self.line_number,
            'sample_id': self.sample_id,
            'raw_data': self.raw_data,
            'anomaly_type': self.anomaly_type,
            'anomaly_reason': self.anomaly_reason,
            'affected_fields': self.affected_fields,
            'is_fixed': self.is_fixed,
            'fixed_by': self.fixed_by,
            'fixed_at': self.fixed_at.isoformat() if self.fixed_at else None,
            'fix_notes': self.fix_notes,
            'fixed_sample_id': self.fixed_sample_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DuplicateSample(db.Model):
    __tablename__ = 'duplicate_samples'
    
    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.String(50), nullable=False, index=True)
    original_sample_id = db.Column(db.Integer, db.ForeignKey('samples.id'))
    original_sample = db.relationship('Sample', backref='duplicates', foreign_keys=[original_sample_id])
    
    # 重复数据来源
    source_filename = db.Column(db.String(200), nullable=False)
    line_number = db.Column(db.Integer)
    raw_data = db.Column(db.Text, nullable=False)
    
    # 差异字段
    differing_fields = db.Column(db.Text)  # JSON格式存储差异字段
    
    # 处理状态
    status = db.Column(db.String(20), default='pending')  # pending, merged, discarded
    resolved_by = db.Column(db.String(100))
    resolved_at = db.Column(db.DateTime)
    resolution_notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'sample_id': self.sample_id,
            'original_sample_id': self.original_sample_id,
            'source_filename': self.source_filename,
            'line_number': self.line_number,
            'raw_data': self.raw_data,
            'differing_fields': self.differing_fields,
            'status': self.status,
            'resolved_by': self.resolved_by,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolution_notes': self.resolution_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(50), nullable=False, index=True)  # import, update, fix, export, review
    entity_type = db.Column(db.String(50))  # sample, anomaly, duplicate
    entity_id = db.Column(db.Integer)
    
    # 操作详情
    details = db.Column(db.Text)  # JSON格式的操作详情
    user = db.Column(db.String(100))
    ip_address = db.Column(db.String(50))
    
    # 关联数据
    import_source = db.Column(db.String(200))  # 导入文件名
    export_filename = db.Column(db.String(200))  # 导出文件名
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'details': self.details,
            'user': self.user,
            'ip_address': self.ip_address,
            'import_source': self.import_source,
            'export_filename': self.export_filename,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
