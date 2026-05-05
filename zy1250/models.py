from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import json

db = SQLAlchemy()

class RpcService(db.Model):
    """老 RPC 服务定义（从 rpc-services.yaml 导入）"""
    __tablename__ = 'rpc_services'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    namespace = db.Column(db.String(200), default='')
    version = db.Column(db.String(50), default='v1')
    
    methods = db.relationship('RpcMethod', backref='service', lazy='dynamic',
                              cascade='all, delete-orphan')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RpcMethod(db.Model):
    """老 RPC 方法定义"""
    __tablename__ = 'rpc_methods'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('rpc_services.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    
    request_fields_json = db.Column(db.Text, default='[]')
    response_fields_json = db.Column(db.Text, default='[]')
    
    deadline_ms = db.Column(db.Integer, default=30000)  # 默认 30s
    retry_policy_json = db.Column(db.Text, default='{}')
    error_codes_json = db.Column(db.Text, default='[]')
    idempotent_key = db.Column(db.String(200), default='')
    metadata_json = db.Column(db.Text, default='[]')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def request_fields(self):
        return json.loads(self.request_fields_json) if self.request_fields_json else []
    
    @request_fields.setter
    def request_fields(self, value):
        self.request_fields_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def response_fields(self):
        return json.loads(self.response_fields_json) if self.response_fields_json else []
    
    @response_fields.setter
    def response_fields(self, value):
        self.response_fields_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def retry_policy(self):
        return json.loads(self.retry_policy_json) if self.retry_policy_json else {}
    
    @retry_policy.setter
    def retry_policy(self, value):
        self.retry_policy_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def error_codes(self):
        return json.loads(self.error_codes_json) if self.error_codes_json else []
    
    @error_codes.setter
    def error_codes(self, value):
        self.error_codes_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def metadata(self):
        return json.loads(self.metadata_json) if self.metadata_json else []
    
    @metadata.setter
    def metadata(self, value):
        self.metadata_json = json.dumps(value, ensure_ascii=False)

class ProtoService(db.Model):
    """Proto 服务定义（从 .proto 文件导入）"""
    __tablename__ = 'proto_services'
    
    id = db.Column(db.Integer, primary_key=True)
    package = db.Column(db.String(200), nullable=False)
    service_name = db.Column(db.String(200), nullable=False)
    proto_file_path = db.Column(db.String(500), nullable=False)
    
    methods = db.relationship('ProtoMethod', backref='service', lazy='dynamic',
                              cascade='all, delete-orphan')
    messages = db.relationship('ProtoMessage', backref='service', lazy='dynamic',
                              cascade='all, delete-orphan')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ProtoMethod(db.Model):
    """Proto 方法定义"""
    __tablename__ = 'proto_methods'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('proto_services.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    
    request_type = db.Column(db.String(200), nullable=False)
    response_type = db.Column(db.String(200), nullable=False)
    
    is_client_streaming = db.Column(db.Boolean, default=False)
    is_server_streaming = db.Column(db.Boolean, default=False)
    
    options_json = db.Column(db.Text, default='{}')
    comments = db.Column(db.Text, default='')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def options(self):
        return json.loads(self.options_json) if self.options_json else {}
    
    @options.setter
    def options(self, value):
        self.options_json = json.dumps(value, ensure_ascii=False)

class ProtoMessage(db.Model):
    """Proto 消息定义"""
    __tablename__ = 'proto_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('proto_services.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    
    fields_json = db.Column(db.Text, default='[]')
    nested_types_json = db.Column(db.Text, default='[]')
    comments = db.Column(db.Text, default='')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def fields(self):
        return json.loads(self.fields_json) if self.fields_json else []
    
    @fields.setter
    def fields(self, value):
        self.fields_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def nested_types(self):
        return json.loads(self.nested_types_json) if self.nested_types_json else []
    
    @nested_types.setter
    def nested_types(self, value):
        self.nested_types_json = json.dumps(value, ensure_ascii=False)

class MigrationTask(db.Model):
    """迁移评审任务"""
    __tablename__ = 'migration_tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    
    rpc_service_id = db.Column(db.Integer, db.ForeignKey('rpc_services.id'), nullable=True)
    proto_service_id = db.Column(db.Integer, db.ForeignKey('proto_services.id'), nullable=True)
    
    status = db.Column(db.String(50), default='pending')  # pending, running, completed, failed
    progress = db.Column(db.Integer, default=0)  # 0-100
    
    config_json = db.Column(db.Text, default='{}')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    rpc_service = db.relationship('RpcService', backref='tasks', foreign_keys=[rpc_service_id])
    proto_service = db.relationship('ProtoService', backref='tasks', foreign_keys=[proto_service_id])
    
    @property
    def config(self):
        return json.loads(self.config_json) if self.config_json else {}
    
    @config.setter
    def config(self, value):
        self.config_json = json.dumps(value, ensure_ascii=False)

class MethodMapping(db.Model):
    """方法映射关系"""
    __tablename__ = 'method_mappings'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('migration_tasks.id'), nullable=False)
    
    rpc_method_id = db.Column(db.Integer, db.ForeignKey('rpc_methods.id'), nullable=True)
    proto_method_id = db.Column(db.Integer, db.ForeignKey('proto_methods.id'), nullable=True)
    
    mapping_status = db.Column(db.String(50), default='pending')  # pending, matched, manual, missing
    
    field_mappings_json = db.Column(db.Text, default='[]')
    notes = db.Column(db.Text, default='')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rpc_method = db.relationship('RpcMethod', backref='mappings', foreign_keys=[rpc_method_id])
    proto_method = db.relationship('ProtoMethod', backref='mappings', foreign_keys=[proto_method_id])
    
    @property
    def field_mappings(self):
        return json.loads(self.field_mappings_json) if self.field_mappings_json else []
    
    @field_mappings.setter
    def field_mappings(self, value):
        self.field_mappings_json = json.dumps(value, ensure_ascii=False)

class ComparisonResult(db.Model):
    """对比结果"""
    __tablename__ = 'comparison_results'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('migration_tasks.id'), nullable=False)
    method_mapping_id = db.Column(db.Integer, db.ForeignKey('method_mappings.id'), nullable=True)
    
    comparison_type = db.Column(db.String(50), nullable=False)  # field, deadline, status_code, retry, error_mapping, metadata
    
    legacy_data_json = db.Column(db.Text, default='{}')
    grpc_data_json = db.Column(db.Text, default='{}')
    
    is_match = db.Column(db.Boolean, default=False)
    details_json = db.Column(db.Text, default='{}')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    @property
    def legacy_data(self):
        return json.loads(self.legacy_data_json) if self.legacy_data_json else {}
    
    @legacy_data.setter
    def legacy_data(self, value):
        self.legacy_data_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def grpc_data(self):
        return json.loads(self.grpc_data_json) if self.grpc_data_json else {}
    
    @grpc_data.setter
    def grpc_data(self, value):
        self.grpc_data_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def details(self):
        return json.loads(self.details_json) if self.details_json else {}
    
    @details.setter
    def details(self, value):
        self.details_json = json.dumps(value, ensure_ascii=False)

class Difference(db.Model):
    """差异记录"""
    __tablename__ = 'differences'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('migration_tasks.id'), nullable=False)
    comparison_result_id = db.Column(db.Integer, db.ForeignKey('comparison_results.id'), nullable=True)
    
    difference_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='warning')  # critical, warning, info
    
    legacy_value_json = db.Column(db.Text, default='null')
    grpc_value_json = db.Column(db.Text, default='null')
    
    description = db.Column(db.Text, nullable=False)
    suggestion = db.Column(db.Text, default='')
    
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.String(100), default='')
    resolved_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    @property
    def legacy_value(self):
        return json.loads(self.legacy_value_json) if self.legacy_value_json else None
    
    @legacy_value.setter
    def legacy_value(self, value):
        self.legacy_value_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def grpc_value(self):
        return json.loads(self.grpc_value_json) if self.grpc_value_json else None
    
    @grpc_value.setter
    def grpc_value(self, value):
        self.grpc_value_json = json.dumps(value, ensure_ascii=False)

class ManualConfirmation(db.Model):
    """人工确认记录"""
    __tablename__ = 'manual_confirmations'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('migration_tasks.id'), nullable=False)
    difference_id = db.Column(db.Integer, db.ForeignKey('differences.id'), nullable=True)
    
    confirmed_by = db.Column(db.String(100), nullable=False)
    confirmation_type = db.Column(db.String(50), nullable=False)  # accept, reject, ignore
    
    comment = db.Column(db.Text, default='')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ExportRecord(db.Model):
    """导出记录"""
    __tablename__ = 'export_records'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('migration_tasks.id'), nullable=False)
    
    format_type = db.Column(db.String(20), nullable=False)  # markdown, json
    file_path = db.Column(db.String(500), nullable=False)
    
    exported_by = db.Column(db.String(100), default='system')
    export_config_json = db.Column(db.Text, default='{}')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    @property
    def export_config(self):
        return json.loads(self.export_config_json) if self.export_config_json else {}
    
    @export_config.setter
    def export_config(self, value):
        self.export_config_json = json.dumps(value, ensure_ascii=False)

class BadExample(db.Model):
    """坏样例校验记录"""
    __tablename__ = 'bad_examples'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('migration_tasks.id'), nullable=True)
    
    example_type = db.Column(db.String(50), nullable=False)  # field_mismatch, deadline_mismatch, status_code_mismatch, error_mapping, metadata
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    
    test_data_json = db.Column(db.Text, default='{}')
    expected_issues_json = db.Column(db.Text, default='[]')
    
    is_detected = db.Column(db.Boolean, default=False)
    detected_issues_json = db.Column(db.Text, default='[]')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tested_at = db.Column(db.DateTime, nullable=True)
    
    @property
    def test_data(self):
        return json.loads(self.test_data_json) if self.test_data_json else {}
    
    @test_data.setter
    def test_data(self, value):
        self.test_data_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def expected_issues(self):
        return json.loads(self.expected_issues_json) if self.expected_issues_json else []
    
    @expected_issues.setter
    def expected_issues(self, value):
        self.expected_issues_json = json.dumps(value, ensure_ascii=False)
    
    @property
    def detected_issues(self):
        return json.loads(self.detected_issues_json) if self.detected_issues_json else []
    
    @detected_issues.setter
    def detected_issues(self, value):
        self.detected_issues_json = json.dumps(value, ensure_ascii=False)
