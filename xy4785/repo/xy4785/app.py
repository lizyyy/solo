from flask import Flask, request, jsonify, g
from flask_jwt_extended import (
    JWTManager, create_access_token, 
    get_jwt_identity, jwt_required
)
from datetime import datetime
from functools import wraps
from models import (
    db, Role, Building, User, Ticket, Dispatch, AuditLog
)
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)
jwt = JWTManager(app)

def log_audit(action, resource_type=None, resource_id=None, description=None, success=True):
    try:
        user_id = None
        username = None
        role_name = None
        
        if hasattr(g, 'current_user') and g.current_user:
            user_id = g.current_user.id
            username = g.current_user.username
            role_name = g.current_user.get_role_name()
        
        audit = AuditLog(
            user_id=user_id,
            username=username,
            role_name=role_name,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent'),
            success=success
        )
        db.session.add(audit)
        db.session.commit()
    except Exception as e:
        app.logger.error(f"Failed to log audit: {str(e)}")
        db.session.rollback()

def get_current_user():
    identity = get_jwt_identity()
    if identity:
        return User.query.get(identity.get('id'))
    return None

@app.before_request
def load_current_user():
    try:
        if request.endpoint and 'login' not in request.endpoint:
            user = get_current_user()
            if user:
                g.current_user = user
    except Exception:
        pass

def requires_role(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'current_user') or not g.current_user:
                log_audit(
                    action=AuditLog.ACTION_UNAUTHORIZED,
                    description=f"未授权访问: {request.method} {request.path}",
                    success=False
                )
                return jsonify({"error": "未授权，请先登录"}), 401
            
            user_role = g.current_user.get_role_name()
            if user_role not in allowed_roles:
                log_audit(
                    action=AuditLog.ACTION_UNAUTHORIZED,
                    resource_type='endpoint',
                    description=f"角色权限不足: 用户角色={user_role}, 需要角色={allowed_roles}",
                    success=False
                )
                return jsonify({
                    "error": "权限不足",
                    "current_role": user_role,
                    "required_roles": list(allowed_roles)
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def can_access_ticket(ticket_id, action='read'):
    if not hasattr(g, 'current_user') or not g.current_user:
        return False, "未授权"
    
    user = g.current_user
    ticket = Ticket.query.get(ticket_id)
    
    if not ticket:
        return False, "工单不存在"
    
    if user.is_admin():
        return True, None
    
    if user.is_resident():
        if ticket.submitter_id == user.id:
            if action == 'read' or action == 'update_note':
                return True, None
            return False, "住户只能查看和补充自己的工单备注"
        return False, "不能查看其他住户的工单"
    
    if user.is_butler():
        if user.assigned_building_id == ticket.building_id:
            return True, None
        return False, "楼栋管家只能处理所属楼栋的工单"
    
    if user.is_technician():
        dispatch = Dispatch.query.filter_by(
            ticket_id=ticket.id, 
            technician_id=user.id
        ).first()
        if dispatch:
            return True, None
        return False, "维修师傅只能查看派给自己的工单"
    
    return False, "未知的权限类型"

def can_reassign():
    if not hasattr(g, 'current_user') or not g.current_user:
        return False, "未授权"
    
    if g.current_user.is_admin():
        return True, None
    
    return False, "只有管理员才能改派工单"

def can_view_audit():
    if not hasattr(g, 'current_user') or not g.current_user:
        return False, "未授权"
    
    if g.current_user.is_admin():
        return True, None
    
    return False, "只有管理员才能查看审计日志"

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "用户名和密码不能为空"}), 400
    
    user = User.query.filter_by(username=username).first()
    
    if not user or not user.check_password(password):
        log_audit(
            action=AuditLog.ACTION_LOGIN,
            description=f"登录失败: 用户名={username}",
            success=False
        )
        return jsonify({"error": "用户名或密码错误"}), 401
    
    access_token = create_access_token(
        identity={
            'id': user.id, 
            'username': user.username,
            'role': user.get_role_name()
        }
    )
    
    log_audit(
        action=AuditLog.ACTION_LOGIN,
        resource_type='user',
        resource_id=user.id,
        description=f"用户 {user.username} 登录成功"
    )
    
    return jsonify({
        "access_token": access_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.get_role_name()
        }
    }), 200

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    user = g.current_user
    if not user:
        return jsonify({"error": "用户不存在"}), 404
    
    log_audit(
        action=AuditLog.ACTION_QUERY,
        resource_type='user',
        resource_id=user.id,
        description=f"查看个人信息"
    )
    
    return jsonify({
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "phone": user.phone,
        "role": user.get_role_name(),
        "assigned_building_id": user.assigned_building_id
    }), 200

@app.route('/api/tickets', methods=['GET'])
@jwt_required()
def get_tickets():
    user = g.current_user
    tickets = []
    
    if user.is_admin():
        tickets = Ticket.query.order_by(Ticket.created_at.desc()).all()
    elif user.is_resident():
        tickets = Ticket.query.filter_by(
            submitter_id=user.id
        ).order_by(Ticket.created_at.desc()).all()
    elif user.is_butler():
        tickets = Ticket.query.filter_by(
            building_id=user.assigned_building_id
        ).order_by(Ticket.created_at.desc()).all()
    elif user.is_technician():
        dispatches = Dispatch.query.filter_by(
            technician_id=user.id
        ).all()
        ticket_ids = [d.ticket_id for d in dispatches]
        if ticket_ids:
            tickets = Ticket.query.filter(
                Ticket.id.in_(ticket_ids)
            ).order_by(Ticket.created_at.desc()).all()
    
    log_audit(
        action=AuditLog.ACTION_QUERY,
        resource_type='ticket',
        description=f"查询工单列表，共 {len(tickets)} 条记录"
    )
    
    return jsonify({
        "tickets": [t.to_dict() for t in tickets]
    }), 200

@app.route('/api/tickets/<int:ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    can_access, error_msg = can_access_ticket(ticket_id, action='read')
    
    if not can_access:
        log_audit(
            action=AuditLog.ACTION_UNAUTHORIZED,
            resource_type='ticket',
            resource_id=ticket_id,
            description=f"越权查看工单: {error_msg}",
            success=False
        )
        return jsonify({"error": error_msg}), 403
    
    ticket = Ticket.query.get(ticket_id)
    
    log_audit(
        action=AuditLog.ACTION_QUERY,
        resource_type='ticket',
        resource_id=ticket_id,
        description=f"查看工单详情: {ticket.title}"
    )
    
    result = ticket.to_dict()
    dispatches = Dispatch.query.filter_by(ticket_id=ticket.id).all()
    result['dispatches'] = [d.to_dict() for d in dispatches]
    
    return jsonify(result), 200

@app.route('/api/tickets', methods=['POST'])
@jwt_required()
def create_ticket():
    user = g.current_user
    data = request.get_json()
    
    if user.is_technician():
        log_audit(
            action=AuditLog.ACTION_UNAUTHORIZED,
            resource_type='ticket',
            description="维修师傅不能创建工单",
            success=False
        )
        return jsonify({"error": "维修师傅不能创建工单"}), 403
    
    title = data.get('title')
    description = data.get('description')
    building_id = data.get('building_id')
    unit_number = data.get('unit_number')
    
    if not title or not building_id:
        return jsonify({"error": "标题和楼栋不能为空"}), 400
    
    building = Building.query.get(building_id)
    if not building:
        return jsonify({"error": "楼栋不存在"}), 404
    
    if user.is_resident() or user.is_butler():
        if user.is_butler() and user.assigned_building_id != building_id:
            log_audit(
                action=AuditLog.ACTION_UNAUTHORIZED,
                resource_type='ticket',
                description=f"楼栋管家尝试为非所属楼栋创建工单: 楼栋ID={building_id}",
                success=False
            )
            return jsonify({"error": "只能为所属楼栋创建工单"}), 403
    
    ticket = Ticket(
        title=title,
        description=description,
        submitter_id=user.id,
        building_id=building_id,
        unit_number=unit_number,
        status=Ticket.STATUS_OPEN
    )
    
    db.session.add(ticket)
    db.session.commit()
    
    log_audit(
        action=AuditLog.ACTION_CREATE,
        resource_type='ticket',
        resource_id=ticket.id,
        description=f"创建工单: {ticket.title}"
    )
    
    return jsonify(ticket.to_dict()), 201

@app.route('/api/tickets/<int:ticket_id>/notes', methods=['PUT'])
@jwt_required()
def update_ticket_notes(ticket_id):
    can_access, error_msg = can_access_ticket(ticket_id, action='update_note')
    
    if not can_access:
        log_audit(
            action=AuditLog.ACTION_UNAUTHORIZED,
            resource_type='ticket',
            resource_id=ticket_id,
            description=f"越权更新工单备注: {error_msg}",
            success=False
        )
        return jsonify({"error": error_msg}), 403
    
    data = request.get_json()
    notes = data.get('notes', '')
    
    ticket = Ticket.query.get(ticket_id)
    old_notes = ticket.notes or ''
    
    if old_notes:
        ticket.notes = old_notes + '\n\n' + f"[{g.current_user.name} {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}]\n{notes}"
    else:
        ticket.notes = f"[{g.current_user.name} {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}]\n{notes}"
    
    db.session.commit()
    
    log_audit(
        action=AuditLog.ACTION_UPDATE,
        resource_type='ticket',
        resource_id=ticket_id,
        description=f"补充工单备注: {ticket.title}"
    )
    
    return jsonify(ticket.to_dict()), 200

@app.route('/api/tickets/<int:ticket_id>/assign', methods=['POST'])
@jwt_required()
def assign_ticket(ticket_id):
    can_reassign_flag, error_msg = can_reassign()
    
    if not can_reassign_flag:
        log_audit(
            action=AuditLog.ACTION_UNAUTHORIZED,
            resource_type='ticket',
            resource_id=ticket_id,
            description=f"越权改派工单: {error_msg}",
            success=False
        )
        return jsonify({"error": error_msg}), 403
    
    data = request.get_json()
    technician_id = data.get('technician_id')
    
    if not technician_id:
        return jsonify({"error": "维修师傅ID不能为空"}), 400
    
    technician = User.query.get(technician_id)
    if not technician or not technician.is_technician():
        return jsonify({"error": "维修师傅不存在或角色不正确"}), 400
    
    ticket = Ticket.query.get(ticket_id)
    if not ticket:
        return jsonify({"error": "工单不存在"}), 404
    
    existing_dispatch = Dispatch.query.filter_by(
        ticket_id=ticket_id,
        technician_id=technician_id
    ).first()
    
    if existing_dispatch:
        return jsonify({"error": "该维修师傅已被派到此工单"}), 400
    
    Dispatch.query.filter_by(ticket_id=ticket_id).delete()
    
    dispatch = Dispatch(
        ticket_id=ticket_id,
        technician_id=technician_id,
        assigned_by=g.current_user.id,
        status='assigned'
    )
    
    ticket.status = Ticket.STATUS_IN_PROGRESS
    
    db.session.add(dispatch)
    db.session.commit()
    
    log_audit(
        action=AuditLog.ACTION_REASSIGN,
        resource_type='ticket',
        resource_id=ticket_id,
        description=f"改派工单: {ticket.title} -> 维修师傅: {technician.name}"
    )
    
    return jsonify({
        "ticket": ticket.to_dict(),
        "dispatch": dispatch.to_dict()
    }), 200

@app.route('/api/tickets/<int:ticket_id>/close', methods=['POST'])
@jwt_required()
def close_ticket(ticket_id):
    can_access, error_msg = can_access_ticket(ticket_id, action='close')
    
    if not can_access:
        if g.current_user.is_resident():
            can_access, error_msg = can_access_ticket(ticket_id, action='read')
            if can_access and error_msg is None:
                pass
            else:
                log_audit(
                    action=AuditLog.ACTION_UNAUTHORIZED,
                    resource_type='ticket',
                    resource_id=ticket_id,
                    description=f"越权关闭工单: {error_msg}",
                    success=False
                )
                return jsonify({"error": error_msg}), 403
        else:
            log_audit(
                action=AuditLog.ACTION_UNAUTHORIZED,
                resource_type='ticket',
                resource_id=ticket_id,
                description=f"越权关闭工单: {error_msg}",
                success=False
            )
            return jsonify({"error": error_msg}), 403
    
    if g.current_user.is_resident():
        ticket = Ticket.query.get(ticket_id)
        if ticket.submitter_id != g.current_user.id:
            log_audit(
                action=AuditLog.ACTION_UNAUTHORIZED,
                resource_type='ticket',
                resource_id=ticket_id,
                description="住户尝试关闭其他住户的工单",
                success=False
            )
            return jsonify({"error": "只能关闭自己提交的工单"}), 403
    
    ticket = Ticket.query.get(ticket_id)
    ticket.status = Ticket.STATUS_CLOSED
    
    db.session.commit()
    
    log_audit(
        action=AuditLog.ACTION_CLOSE,
        resource_type='ticket',
        resource_id=ticket_id,
        description=f"关闭工单: {ticket.title}"
    )
    
    return jsonify(ticket.to_dict()), 200

@app.route('/api/audit', methods=['GET'])
@jwt_required()
def get_audit_logs():
    can_view, error_msg = can_view_audit()
    
    if not can_view:
        log_audit(
            action=AuditLog.ACTION_UNAUTHORIZED,
            resource_type='audit',
            description=f"越权查看审计日志: {error_msg}",
            success=False
        )
        return jsonify({"error": error_msg}), 403
    
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(100).all()
    
    return jsonify({
        "audit_logs": [log.to_dict() for log in logs]
    }), 200

@app.route('/api/users/technicians', methods=['GET'])
@jwt_required()
def get_technicians():
    if not g.current_user.is_admin() and not g.current_user.is_butler():
        log_audit(
            action=AuditLog.ACTION_UNAUTHORIZED,
            resource_type='user',
            description="越权查看维修师傅列表",
            success=False
        )
        return jsonify({"error": "权限不足"}), 403
    
    tech_role = Role.query.filter_by(name='technician').first()
    technicians = User.query.filter_by(role_id=tech_role.id).all()
    
    log_audit(
        action=AuditLog.ACTION_QUERY,
        resource_type='user',
        description=f"查询维修师傅列表，共 {len(technicians)} 人"
    )
    
    return jsonify({
        "technicians": [{
            "id": t.id,
            "username": t.username,
            "name": t.name,
            "phone": t.phone
        } for t in technicians]
    }), 200

@app.route('/api/buildings', methods=['GET'])
@jwt_required()
def get_buildings():
    buildings = Building.query.all()
    
    log_audit(
        action=AuditLog.ACTION_QUERY,
        resource_type='building',
        description=f"查询楼栋列表，共 {len(buildings)} 栋"
    )
    
    return jsonify({
        "buildings": [{
            "id": b.id,
            "name": b.name,
            "address": b.address
        } for b in buildings]
    }), 200

def init_db():
    with app.app_context():
        db.create_all()
        
        if Role.query.count() == 0:
            roles = [
                Role(name='admin', description='系统管理员'),
                Role(name='butler', description='楼栋管家'),
                Role(name='technician', description='维修师傅'),
                Role(name='resident', description='住户')
            ]
            for role in roles:
                db.session.add(role)
            db.session.commit()
        
        admin_role = Role.query.filter_by(name='admin').first()
        butler_role = Role.query.filter_by(name='butler').first()
        tech_role = Role.query.filter_by(name='technician').first()
        resident_role = Role.query.filter_by(name='resident').first()
        
        if Building.query.count() == 0:
            buildings = [
                Building(name='1号楼', address='小区东区'),
                Building(name='2号楼', address='小区东区'),
                Building(name='3号楼', address='小区西区')
            ]
            for b in buildings:
                db.session.add(b)
            db.session.commit()
        
        building1 = Building.query.filter_by(name='1号楼').first()
        building2 = Building.query.filter_by(name='2号楼').first()
        building3 = Building.query.filter_by(name='3号楼').first()
        
        if User.query.count() == 0:
            admin = User(
                username='admin',
                name='系统管理员',
                phone='13800000000',
                role_id=admin_role.id
            )
            admin.set_password('admin123')
            db.session.add(admin)
            
            butler1 = User(
                username='butler1',
                name='张管家',
                phone='13800000001',
                role_id=butler_role.id,
                assigned_building_id=building1.id
            )
            butler1.set_password('butler123')
            db.session.add(butler1)
            
            butler2 = User(
                username='butler2',
                name='李管家',
                phone='13800000002',
                role_id=butler_role.id,
                assigned_building_id=building2.id
            )
            butler2.set_password('butler123')
            db.session.add(butler2)
            
            tech1 = User(
                username='tech1',
                name='王师傅',
                phone='13800000003',
                role_id=tech_role.id
            )
            tech1.set_password('tech123')
            db.session.add(tech1)
            
            tech2 = User(
                username='tech2',
                name='赵师傅',
                phone='13800000004',
                role_id=tech_role.id
            )
            tech2.set_password('tech123')
            db.session.add(tech2)
            
            resident1 = User(
                username='resident1',
                name='陈住户',
                phone='13800000005',
                role_id=resident_role.id
            )
            resident1.set_password('resident123')
            db.session.add(resident1)
            
            resident2 = User(
                username='resident2',
                name='刘住户',
                phone='13800000006',
                role_id=resident_role.id
            )
            resident2.set_password('resident123')
            db.session.add(resident2)
            
            db.session.commit()
            
            admin_user = User.query.filter_by(username='admin').first()
            resident1_user = User.query.filter_by(username='resident1').first()
            resident2_user = User.query.filter_by(username='resident2').first()
            tech1_user = User.query.filter_by(username='tech1').first()
            
            ticket1 = Ticket(
                title='客厅灯具损坏',
                description='客厅吊灯不亮了，需要维修',
                submitter_id=resident1_user.id,
                building_id=building1.id,
                unit_number='101',
                status=Ticket.STATUS_OPEN
            )
            db.session.add(ticket1)
            
            ticket2 = Ticket(
                title='卫生间漏水',
                description='卫生间马桶旁边有漏水现象',
                submitter_id=resident2_user.id,
                building_id=building2.id,
                unit_number='203',
                status=Ticket.STATUS_IN_PROGRESS
            )
            db.session.add(ticket2)
            
            db.session.commit()
            
            ticket2_obj = Ticket.query.filter_by(title='卫生间漏水').first()
            if ticket2_obj:
                dispatch = Dispatch(
                    ticket_id=ticket2_obj.id,
                    technician_id=tech1_user.id,
                    assigned_by=admin_user.id,
                    status='assigned'
                )
                db.session.add(dispatch)
                db.session.commit()
        
        print("数据库初始化完成！")

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
