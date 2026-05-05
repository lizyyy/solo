from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class AliasTemplate(db.Model):
    __tablename__ = 'alias_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    aliases = db.relationship('FieldAlias', backref='template', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_default': self.is_default,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class FieldAlias(db.Model):
    __tablename__ = 'field_aliases'
    
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('alias_templates.id'), nullable=False)
    standard_field = db.Column(db.String(100), nullable=False)  # 标准字段名
    aliases = db.Column(db.Text, nullable=False)  # 别名列表，用逗号分隔
    description = db.Column(db.Text)
    
    def get_aliases_list(self):
        return [a.strip().lower() for a in self.aliases.split(',') if a.strip()]
    
    def to_dict(self):
        return {
            'id': self.id,
            'template_id': self.template_id,
            'standard_field': self.standard_field,
            'aliases': self.get_aliases_list(),
            'description': self.description
        }

class Team(db.Model):
    __tablename__ = 'teams'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    community = db.Column(db.String(200))  # 所属社区
    contact_person = db.Column(db.String(100))
    contact_phone = db.Column(db.String(50))
    source_file = db.Column(db.String(255))  # 来源文件名
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    members = db.relationship('Member', backref='team', lazy='dynamic', cascade='all, delete-orphan')
    boats = db.relationship('Boat', backref='team', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'community': self.community,
            'contact_person': self.contact_person,
            'contact_phone': self.contact_phone,
            'source_file': self.source_file,
            'member_count': self.members.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Member(db.Model):
    __tablename__ = 'members'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    member_number = db.Column(db.String(50))  # 队员号/选手ID
    name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.String(10))
    age = db.Column(db.Integer)
    weight = db.Column(db.Float)
    id_card = db.Column(db.String(50))  # 身份证号（用于查重）
    role = db.Column(db.String(50))  # 角色：划手、鼓手、舵手
    source_file = db.Column(db.String(255))
    source_row = db.Column(db.Integer)  # 来源文件行号
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'team_id': self.team_id,
            'team_name': self.team.name if self.team else None,
            'member_number': self.member_number,
            'name': self.name,
            'gender': self.gender,
            'age': self.age,
            'weight': self.weight,
            'id_card': self.id_card,
            'role': self.role,
            'source_file': self.source_file,
            'source_row': self.source_row
        }

class Boat(db.Model):
    __tablename__ = 'boats'
    
    id = db.Column(db.Integer, primary_key=True)
    boat_number = db.Column(db.String(50), nullable=False)  # 船号/艇号
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'))
    capacity = db.Column(db.Integer, default=22)
    status = db.Column(db.String(50), default='available')  # available, assigned, maintenance
    source_file = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'boat_number': self.boat_number,
            'team_id': self.team_id,
            'team_name': self.team.name if self.team else None,
            'capacity': self.capacity,
            'status': self.status,
            'source_file': self.source_file
        }

class RaceSchedule(db.Model):
    __tablename__ = 'race_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    race_name = db.Column(db.String(200), nullable=False)
    race_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    track_number = db.Column(db.Integer)  # 赛道号
    boat_number = db.Column(db.String(50))
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'))
    round_type = db.Column(db.String(50))  # 预赛、半决赛、决赛
    source_file = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'race_name': self.race_name,
            'race_date': self.race_date.isoformat() if self.race_date else None,
            'start_time': str(self.start_time) if self.start_time else None,
            'end_time': str(self.end_time) if self.end_time else None,
            'track_number': self.track_number,
            'boat_number': self.boat_number,
            'team_id': self.team_id,
            'team_name': self.team.name if self.team else None,
            'round_type': self.round_type,
            'source_file': self.source_file
        }

class Risk(db.Model):
    __tablename__ = 'risks'
    
    id = db.Column(db.Integer, primary_key=True)
    risk_type = db.Column(db.String(100), nullable=False)  # duplicate_member, age_violation, weight_violation, boat_conflict, schedule_conflict
    severity = db.Column(db.String(20), default='warning')  # info, warning, error
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    related_type = db.Column(db.String(50))  # member, team, boat, schedule
    related_id = db.Column(db.Integer)
    source_file = db.Column(db.String(255))
    source_row = db.Column(db.Integer)
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.String(100))
    resolved_at = db.Column(db.DateTime)
    resolved_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'risk_type': self.risk_type,
            'severity': self.severity,
            'title': self.title,
            'description': self.description,
            'related_type': self.related_type,
            'related_id': self.related_id,
            'source_file': self.source_file,
            'source_row': self.source_row,
            'is_resolved': self.is_resolved,
            'resolved_by': self.resolved_by,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_note': self.resolved_note,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ReviewNote(db.Model):
    __tablename__ = 'review_notes'
    
    id = db.Column(db.Integer, primary_key=True)
    related_type = db.Column(db.String(50))  # member, team, boat, schedule, risk
    related_id = db.Column(db.Integer)
    note = db.Column(db.Text, nullable=False)
    reviewer = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'related_type': self.related_type,
            'related_id': self.related_id,
            'note': self.note,
            'reviewer': self.reviewer,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class UnmappedRow(db.Model):
    __tablename__ = 'unmapped_rows'
    
    id = db.Column(db.Integer, primary_key=True)
    source_file = db.Column(db.String(255), nullable=False)
    row_number = db.Column(db.Integer, nullable=False)
    field_name = db.Column(db.String(100))
    field_value = db.Column(db.Text)
    expected_field = db.Column(db.String(100))
    error_message = db.Column(db.Text)
    row_data = db.Column(db.Text)  # JSON字符串存储整行数据
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'source_file': self.source_file,
            'row_number': self.row_number,
            'field_name': self.field_name,
            'field_value': self.field_value,
            'expected_field': self.expected_field,
            'error_message': self.error_message,
            'row_data': self.row_data,
            'is_resolved': self.is_resolved,
            'resolved_note': self.resolved_note,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ImportSession(db.Model):
    __tablename__ = 'import_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    session_name = db.Column(db.String(200))
    template_id = db.Column(db.Integer, db.ForeignKey('alias_templates.id'))
    file_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # 关系
    imported_files = db.relationship('ImportedFile', backref='session', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_name': self.session_name,
            'template_id': self.template_id,
            'file_count': self.file_count,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

class ImportedFile(db.Model):
    __tablename__ = 'imported_files'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('import_sessions.id'), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20))  # json, csv
    total_rows = db.Column(db.Integer, default=0)
    success_rows = db.Column(db.Integer, default=0)
    error_rows = db.Column(db.Integer, default=0)
    status = db.Column(db.String(50), default='pending')
    error_message = db.Column(db.Text)
    imported_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'file_name': self.file_name,
            'file_type': self.file_type,
            'total_rows': self.total_rows,
            'success_rows': self.success_rows,
            'error_rows': self.error_rows,
            'status': self.status,
            'error_message': self.error_message,
            'imported_at': self.imported_at.isoformat() if self.imported_at else None
        }
