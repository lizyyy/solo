from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Role(db.Model):
    __tablename__ = 'roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200))
    users = db.relationship('User', backref='role', lazy='dynamic')
    
    def __repr__(self):
        return f'<Role {self.name}>'

class Building(db.Model):
    __tablename__ = 'buildings'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    units = db.relationship('Unit', backref='building', lazy='dynamic')
    tickets = db.relationship('Ticket', backref='building', lazy='dynamic')
    
    def __repr__(self):
        return f'<Building {self.name}>'

class Unit(db.Model):
    __tablename__ = 'units'
    
    id = db.Column(db.Integer, primary_key=True)
    unit_number = db.Column(db.String(20), nullable=False)
    building_id = db.Column(db.Integer, db.ForeignKey('buildings.id'), nullable=False)
    resident_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    def __repr__(self):
        return f'<Unit {self.unit_number}>'

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    assigned_building_id = db.Column(db.Integer, db.ForeignKey('buildings.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 反向关系
    submitted_tickets = db.relationship('Ticket', backref='submitter', foreign_keys='Ticket.submitter_id', lazy='dynamic')
    assigned_dispatches = db.relationship('Dispatch', backref='technician', foreign_keys='Dispatch.technician_id', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_role_name(self):
        return self.role.name if self.role else None
    
    def is_admin(self):
        return self.get_role_name() == 'admin'
    
    def is_butler(self):
        return self.get_role_name() == 'butler'
    
    def is_technician(self):
        return self.get_role_name() == 'technician'
    
    def is_resident(self):
        return self.get_role_name() == 'resident'
    
    def __repr__(self):
        return f'<User {self.username}>'

class Ticket(db.Model):
    __tablename__ = 'tickets'
    
    STATUS_OPEN = 'open'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_RESOLVED = 'resolved'
    STATUS_CLOSED = 'closed'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default=STATUS_OPEN)
    submitter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    building_id = db.Column(db.Integer, db.ForeignKey('buildings.id'), nullable=False)
    unit_number = db.Column(db.String(20))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 反向关系
    dispatches = db.relationship('Dispatch', backref='ticket', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'submitter_id': self.submitter_id,
            'submitter_name': self.submitter.name if self.submitter else None,
            'building_id': self.building_id,
            'building_name': self.building.name if self.building else None,
            'unit_number': self.unit_number,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Ticket {self.id}: {self.title}>'

class Dispatch(db.Model):
    __tablename__ = 'dispatches'
    
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assigned_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='assigned')
    
    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'technician_id': self.technician_id,
            'technician_name': self.technician.name if self.technician else None,
            'assigned_by': self.assigned_by,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'status': self.status
        }
    
    def __repr__(self):
        return f'<Dispatch Ticket {self.ticket_id} -> Tech {self.technician_id}>'

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    ACTION_LOGIN = 'login'
    ACTION_LOGOUT = 'logout'
    ACTION_QUERY = 'query'
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'
    ACTION_REASSIGN = 'reassign'
    ACTION_CLOSE = 'close'
    ACTION_UNAUTHORIZED = 'unauthorized'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    username = db.Column(db.String(80))
    role_name = db.Column(db.String(50))
    action = db.Column(db.String(50), nullable=False)
    resource_type = db.Column(db.String(50))
    resource_id = db.Column(db.Integer)
    description = db.Column(db.String(500))
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    success = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.username,
            'role_name': self.role_name,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'description': self.description,
            'ip_address': self.ip_address,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'success': self.success
        }
    
    def __repr__(self):
        return f'<AuditLog {self.id}: {self.action} by {self.username}>'
