from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class AccessRequest(db.Model):
    """调阅申请表"""
    __tablename__ = 'access_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    request_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    request_date = db.Column(db.Date, nullable=False)
    requester_name = db.Column(db.String(100), nullable=False)
    requester_department = db.Column(db.String(100))
    requester_id_card = db.Column(db.String(50))
    
    archive_category = db.Column(db.String(100))  # 档案类别
    archive_no = db.Column(db.String(100))  # 档案号
    archive_title = db.Column(db.String(200))  # 档案标题
    archive_date_range = db.Column(db.String(100))  # 档案年代范围
    
    access_reason = db.Column(db.Text)  # 调阅理由
    access_method = db.Column(db.String(50))  # 调阅方式：查阅/复制/借出
    access_duration = db.Column(db.String(50))  # 调阅时长
    
    security_level = db.Column(db.String(50))  # 密级：公开/内部/秘密/机密/绝密
    
    status = db.Column(db.String(50), default='pending')  # 状态：待审核/通过/拒绝/需补充授权/需隔离处理/需主管复核
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    reviews = db.relationship('ReviewRecord', backref='access_request', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_no': self.request_no,
            'request_date': self.request_date.strftime('%Y-%m-%d') if self.request_date else None,
            'requester_name': self.requester_name,
            'requester_department': self.requester_department,
            'requester_id_card': self.requester_id_card,
            'archive_category': self.archive_category,
            'archive_no': self.archive_no,
            'archive_title': self.archive_title,
            'archive_date_range': self.archive_date_range,
            'access_reason': self.access_reason,
            'access_method': self.access_method,
            'access_duration': self.access_duration,
            'security_level': self.security_level,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }


class TemperatureHumidity(db.Model):
    """库房温湿度记录表"""
    __tablename__ = 'temperature_humidity'
    
    id = db.Column(db.Integer, primary_key=True)
    storage_room = db.Column(db.String(100), nullable=False)  # 库房编号/名称
    record_date = db.Column(db.Date, nullable=False)
    record_time = db.Column(db.Time)
    
    temperature = db.Column(db.Float)  # 温度(℃)
    humidity = db.Column(db.Float)  # 湿度(%)
    
    # 温湿度状态：正常/偏高/偏低/异常
    temp_status = db.Column(db.String(20), default='normal')
    humidity_status = db.Column(db.String(20), default='normal')
    
    recorder = db.Column(db.String(100))  # 记录人
    remarks = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'storage_room': self.storage_room,
            'record_date': self.record_date.strftime('%Y-%m-%d') if self.record_date else None,
            'record_time': self.record_time.strftime('%H:%M:%S') if self.record_time else None,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'temp_status': self.temp_status,
            'humidity_status': self.humidity_status,
            'recorder': self.recorder,
            'remarks': self.remarks,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }


class SecurityClearance(db.Model):
    """密级授权表"""
    __tablename__ = 'security_clearances'
    
    id = db.Column(db.Integer, primary_key=True)
    user_name = db.Column(db.String(100), nullable=False)
    user_id_card = db.Column(db.String(50), index=True)
    department = db.Column(db.String(100))
    
    # 授权密级：公开/内部/秘密/机密/绝密
    clearance_level = db.Column(db.String(50), nullable=False)
    
    # 授权范围
    authorized_archive_categories = db.Column(db.Text)  # 授权档案类别，多个用逗号分隔
    authorized_date_range = db.Column(db.String(100))  # 授权年代范围
    
    valid_from = db.Column(db.Date, nullable=False)
    valid_to = db.Column(db.Date)  # 为空表示长期有效
    
    authorization_doc_no = db.Column(db.String(100))  # 授权文件编号
    authorizer = db.Column(db.String(100))  # 授权人
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_name': self.user_name,
            'user_id_card': self.user_id_card,
            'department': self.department,
            'clearance_level': self.clearance_level,
            'authorized_archive_categories': self.authorized_archive_categories,
            'authorized_date_range': self.authorized_date_range,
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if self.valid_from else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if self.valid_to else None,
            'authorization_doc_no': self.authorization_doc_no,
            'authorizer': self.authorizer,
            'is_active': self.is_active,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }


class PestMoldTreatment(db.Model):
    """虫霉处理记录表"""
    __tablename__ = 'pest_mold_treatments'
    
    id = db.Column(db.Integer, primary_key=True)
    archive_no = db.Column(db.String(100), nullable=False, index=True)
    archive_title = db.Column(db.String(200))
    
    # 问题类型：虫害/霉害/虫霉并发
    problem_type = db.Column(db.String(50), nullable=False)
    discovery_date = db.Column(db.Date)
    
    # 严重程度：轻微/中等/严重
    severity = db.Column(db.String(20))
    
    # 处理状态：待处理/处理中/已处理/已隔离
    treatment_status = db.Column(db.String(20), default='pending')
    
    treatment_method = db.Column(db.Text)  # 处理方法
    treatment_date = db.Column(db.Date)
    treated_by = db.Column(db.String(100))  # 处理人
    
    quarantine_end_date = db.Column(db.Date)  # 隔离结束日期
    inspection_result = db.Column(db.String(200))  # 检查结果
    
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'archive_no': self.archive_no,
            'archive_title': self.archive_title,
            'problem_type': self.problem_type,
            'discovery_date': self.discovery_date.strftime('%Y-%m-%d') if self.discovery_date else None,
            'severity': self.severity,
            'treatment_status': self.treatment_status,
            'treatment_method': self.treatment_method,
            'treatment_date': self.treatment_date.strftime('%Y-%m-%d') if self.treatment_date else None,
            'treated_by': self.treated_by,
            'quarantine_end_date': self.quarantine_end_date.strftime('%Y-%m-%d') if self.quarantine_end_date else None,
            'inspection_result': self.inspection_result,
            'remarks': self.remarks,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }


class OutboundSeal(db.Model):
    """出库封签记录表"""
    __tablename__ = 'outbound_seals'
    
    id = db.Column(db.Integer, primary_key=True)
    seal_no = db.Column(db.String(100), unique=True, nullable=False, index=True)  # 封签编号
    
    archive_no = db.Column(db.String(100), nullable=False, index=True)
    archive_title = db.Column(db.String(200))
    
    # 封签类型：出库封签/入库封签/临时封签
    seal_type = db.Column(db.String(50))
    
    seal_date = db.Column(db.Date, nullable=False)
    sealed_by = db.Column(db.String(100))  # 封签人
    
    # 封签状态：有效/已拆封/已作废
    seal_status = db.Column(db.String(20), default='active')
    
    unseal_date = db.Column(db.Date)  # 拆封日期
    unsealed_by = db.Column(db.String(100))  # 拆封人
    unseal_reason = db.Column(db.String(200))  # 拆封原因
    
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'seal_no': self.seal_no,
            'archive_no': self.archive_no,
            'archive_title': self.archive_title,
            'seal_type': self.seal_type,
            'seal_date': self.seal_date.strftime('%Y-%m-%d') if self.seal_date else None,
            'sealed_by': self.sealed_by,
            'seal_status': self.seal_status,
            'unseal_date': self.unseal_date.strftime('%Y-%m-%d') if self.unseal_date else None,
            'unsealed_by': self.unsealed_by,
            'unseal_reason': self.unseal_reason,
            'remarks': self.remarks,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }


class ReviewRecord(db.Model):
    """复核记录表"""
    __tablename__ = 'review_records'
    
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('access_requests.id'), nullable=False)
    
    # 复核结果：通过/拒绝/需补充授权/需隔离处理/需主管复核
    review_result = db.Column(db.String(50), nullable=False)
    
    reviewer = db.Column(db.String(100), nullable=False)  # 复核人
    review_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 复核备注
    review_remark = db.Column(db.Text)
    
    # 是否需要主管复核
    needs_supervisor_review = db.Column(db.Boolean, default=False)
    supervisor_reviewer = db.Column(db.String(100))  # 主管复核人
    supervisor_review_date = db.Column(db.DateTime)
    supervisor_remark = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'request_id': self.request_id,
            'review_result': self.review_result,
            'reviewer': self.reviewer,
            'review_date': self.review_date.strftime('%Y-%m-%d %H:%M:%S') if self.review_date else None,
            'review_remark': self.review_remark,
            'needs_supervisor_review': self.needs_supervisor_review,
            'supervisor_reviewer': self.supervisor_reviewer,
            'supervisor_review_date': self.supervisor_review_date.strftime('%Y-%m-%d %H:%M:%S') if self.supervisor_review_date else None,
            'supervisor_remark': self.supervisor_remark,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }


class AuditLog(db.Model):
    """审计日志表"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # 操作类型：导入/查询/复核/导出/修改/删除
    action_type = db.Column(db.String(50), nullable=False)
    
    # 操作模块：调阅申请/温湿度/密级授权/虫霉处理/出库封签
    module = db.Column(db.String(50), nullable=False)
    
    # 关联的记录标识
    related_record_id = db.Column(db.Integer)
    related_record_no = db.Column(db.String(100))
    
    # 操作人
    operator = db.Column(db.String(100))
    
    # 操作详情
    action_details = db.Column(db.Text)
    
    # IP地址
    ip_address = db.Column(db.String(50))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action_type': self.action_type,
            'module': self.module,
            'related_record_id': self.related_record_id,
            'related_record_no': self.related_record_no,
            'operator': self.operator,
            'action_details': self.action_details,
            'ip_address': self.ip_address,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }
