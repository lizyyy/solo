import hashlib
import json
import re
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g
from models import db, Role, FieldStrategy, RoleFieldMapping, AuditLog, LogHistory, AccessAudit

MASK_TYPES = {
    'none': '不脱敏',
    'phone': '手机号脱敏',
    'email': '邮箱脱敏',
    'idcard': '身份证脱敏',
    'name': '姓名脱敏',
    'hash': '哈希脱敏',
    'hide': '完全隐藏'
}

LOG_FIELDS = [
    'event_id', 'user_id', 'user_name', 'action', 'resource',
    'ip_address', 'user_agent', 'request_data', 'response_data',
    'status', 'timestamp'
]

DEMO_USERS = {
    'admin': {'id': 'admin_001', 'name': '管理员', 'role': 'admin'},
    'auditor': {'id': 'auditor_001', 'name': '审计员', 'role': 'auditor'},
    'viewer': {'id': 'viewer_001', 'name': '普通查看者', 'role': 'viewer'},
    'operator': {'id': 'operator_001', 'name': '运维人员', 'role': 'operator'}
}


def mask_value(value, mask_type):
    if value is None:
        return None
    if mask_type == 'none':
        return value
    if mask_type == 'hide':
        return '******'
    if mask_type == 'hash':
        return hashlib.md5(str(value).encode()).hexdigest()[:16]
    value_str = str(value)
    if mask_type == 'phone' and len(value_str) >= 7:
        return value_str[:3] + '****' + value_str[-4:]
    if mask_type == 'email' and '@' in value_str:
        parts = value_str.split('@')
        name = parts[0]
        if len(name) > 2:
            return name[:2] + '***@' + parts[1]
        return '***@' + parts[1]
    if mask_type == 'idcard' and len(value_str) >= 15:
        return value_str[:6] + '********' + value_str[-4:]
    if mask_type == 'name' and len(value_str) >= 2:
        return value_str[0] + '*' * (len(value_str) - 1)
    return value_str


def get_role_field_strategies(role_name):
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return {}
    mappings = RoleFieldMapping.query.filter_by(role_id=role.id, visible=True).all()
    strategies = {}
    for mapping in mappings:
        fs = FieldStrategy.query.get(mapping.field_strategy_id)
        if fs:
            strategies[fs.field_name] = {
                'mask_type': fs.mask_type,
                'visible': mapping.visible
            }
    return strategies


def apply_desensitization(log_dict, role_name):
    strategies = get_role_field_strategies(role_name)
    result = {}
    for field, value in log_dict.items():
        if field in strategies:
            if not strategies[field]['visible']:
                result[field] = '[无权限]'
            else:
                result[field] = mask_value(value, strategies[field]['mask_type'])
        else:
            result[field] = value
    return result


def log_to_dict(log):
    return {
        'id': log.id,
        'event_id': log.event_id,
        'user_id': log.user_id,
        'user_name': log.user_name,
        'action': log.action,
        'resource': log.resource,
        'ip_address': log.ip_address,
        'user_agent': log.user_agent,
        'request_data': log.request_data,
        'response_data': log.response_data,
        'status': log.status,
        'timestamp': log.timestamp.strftime('%Y-%m-%d %H:%M:%S') if log.timestamp else None,
        'is_withdrawn': log.is_withdrawn
    }


def generate_watermark(operator_info, export_time):
    return {
        'watermark': {
            'generated_at': export_time.strftime('%Y-%m-%d %H:%M:%S'),
            'operator_id': operator_info.get('id'),
            'operator_name': operator_info.get('name'),
            'operator_role': operator_info.get('role'),
            'system': '审计日志脱敏授权系统',
            'hash': hashlib.md5(
                f"{operator_info.get('id')}|{export_time.strftime('%Y%m%d%H%M%S')}|audit_export"
                .encode()
            ).hexdigest()[:12]
        }
    }


def record_access(operator_info, action, target_log_ids=None, filters=None, 
                  export_format=None, watermark_applied=False, status='success'):
    access = AccessAudit(
        operator_id=operator_info.get('id'),
        operator_name=operator_info.get('name'),
        operator_role=operator_info.get('role'),
        action=action,
        target_log_ids=json.dumps(target_log_ids) if target_log_ids else None,
        filters=json.dumps(filters) if filters else None,
        export_format=export_format,
        watermark_applied=watermark_applied,
        ip_address=request.remote_addr,
        status=status
    )
    db.session.add(access)
    db.session.commit()
    return access


def record_log_history(log_id, action_type, old_data, new_data, operator_info, reason=''):
    history = LogHistory(
        log_id=log_id,
        action_type=action_type,
        old_data=json.dumps(old_data, ensure_ascii=False) if old_data else None,
        new_data=json.dumps(new_data, ensure_ascii=False) if new_data else None,
        operator_id=operator_info.get('id'),
        operator_name=operator_info.get('name'),
        reason=reason
    )
    db.session.add(history)
    db.session.commit()
    return history


def get_auth_user():
    user_type = request.headers.get('X-User-Type', 'viewer')
    return DEMO_USERS.get(user_type, DEMO_USERS['viewer'])


def check_export_permission(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_auth_user()
        role = Role.query.filter_by(name=user['role']).first()
        if not role or not role.can_export:
            record_access(user, 'export_denied', status='denied')
            return jsonify({'error': '该角色无导出权限'}), 403
        return f(*args, **kwargs)
    return decorated


def get_compliance_stats(days=7):
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    stats = {
        'period': {
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d')
        },
        'total_logs': AuditLog.query.filter(
            AuditLog.timestamp >= start_date,
            AuditLog.timestamp <= end_date
        ).count(),
        'withdrawn_logs': AuditLog.query.filter(
            AuditLog.timestamp >= start_date,
            AuditLog.timestamp <= end_date,
            AuditLog.is_withdrawn == True
        ).count(),
        'supplemented_logs': LogHistory.query.filter(
            LogHistory.action_type == 'supplement',
            LogHistory.created_at >= start_date,
            LogHistory.created_at <= end_date
        ).count(),
        'access_by_role': {},
        'export_count': 0,
        'view_count': 0,
        'anomalies': []
    }
    
    for role_name in ['admin', 'auditor', 'viewer', 'operator']:
        count = AccessAudit.query.filter(
            AccessAudit.operator_role == role_name,
            AccessAudit.timestamp >= start_date,
            AccessAudit.timestamp <= end_date
        ).count()
        stats['access_by_role'][role_name] = count
    
    stats['export_count'] = AccessAudit.query.filter(
        AccessAudit.action == 'export',
        AccessAudit.timestamp >= start_date,
        AccessAudit.timestamp <= end_date
    ).count()
    
    stats['view_count'] = AccessAudit.query.filter(
        AccessAudit.action == 'view',
        AccessAudit.timestamp >= start_date,
        AccessAudit.timestamp <= end_date
    ).count()
    
    denied_count = AccessAudit.query.filter(
        AccessAudit.status == 'denied',
        AccessAudit.timestamp >= start_date,
        AccessAudit.timestamp <= end_date
    ).count()
    if denied_count > 0:
        stats['anomalies'].append(f'有 {denied_count} 次权限拒绝记录')
    
    return stats


def initialize_demo_data():
    if Role.query.count() == 0:
        db.session.add_all([
            Role(name='admin', can_export=True),
            Role(name='auditor', can_export=True),
            Role(name='viewer', can_export=False),
            Role(name='operator', can_export=False)
        ])
        db.session.commit()
    
    default_strategies = {
        'user_id': 'hash',
        'user_name': 'name',
        'ip_address': 'phone',
        'request_data': 'hide',
        'response_data': 'hide'
    }
    
    for field, mask_type in default_strategies.items():
        if not FieldStrategy.query.filter_by(field_name=field).first():
            fs = FieldStrategy(field_name=field, mask_type=mask_type)
            db.session.add(fs)
    db.session.commit()
    
    admin_role = Role.query.filter_by(name='admin').first()
    auditor_role = Role.query.filter_by(name='auditor').first()
    viewer_role = Role.query.filter_by(name='viewer').first()
    operator_role = Role.query.filter_by(name='operator').first()
    
    all_fields = FieldStrategy.query.all()
    for fs in all_fields:
        if not RoleFieldMapping.query.filter_by(role_id=admin_role.id, field_strategy_id=fs.id).first():
            db.session.add(RoleFieldMapping(role_id=admin_role.id, field_strategy_id=fs.id, visible=True))
        if not RoleFieldMapping.query.filter_by(role_id=auditor_role.id, field_strategy_id=fs.id).first():
            db.session.add(RoleFieldMapping(role_id=auditor_role.id, field_strategy_id=fs.id, visible=True))
        if not RoleFieldMapping.query.filter_by(role_id=viewer_role.id, field_strategy_id=fs.id).first():
            visible = fs.field_name not in ['request_data', 'response_data']
            db.session.add(RoleFieldMapping(role_id=viewer_role.id, field_strategy_id=fs.id, visible=visible))
        if not RoleFieldMapping.query.filter_by(role_id=operator_role.id, field_strategy_id=fs.id).first():
            db.session.add(RoleFieldMapping(role_id=operator_role.id, field_strategy_id=fs.id, visible=True))
    
    db.session.commit()
    
    if AuditLog.query.count() == 0:
        demo_logs = [
            {
                'event_id': f'EVT-{str(i+1).zfill(6)}',
                'user_id': f'UID-{str(1000 + i)}',
                'user_name': ['张三', '李四', '王五', '赵六', '钱七'][i % 5],
                'action': ['用户登录', '修改密码', '查看报表', '导出数据', '系统配置'][i % 5],
                'resource': ['/api/login', '/api/password', '/api/reports', '/api/export', '/api/settings'][i % 5],
                'ip_address': f'192.168.1.{100 + i}',
                'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'request_data': json.dumps({'key': f'value_{i}'}, ensure_ascii=False),
                'response_data': json.dumps({'success': True}, ensure_ascii=False),
                'status': 'success' if i % 3 != 0 else 'failed',
                'timestamp': datetime.utcnow() - timedelta(hours=i * 2)
            }
            for i in range(20)
        ]
        
        for log_data in demo_logs:
            log = AuditLog(**log_data)
            db.session.add(log)
        db.session.commit()
