import io
import json
from datetime import datetime
from flask import Flask, request, jsonify, make_response, send_file
from models import db, Role, FieldStrategy, RoleFieldMapping, AuditLog, LogHistory, AccessAudit
from services import (
    apply_desensitization, log_to_dict, generate_watermark,
    record_access, record_log_history, get_auth_user,
    check_export_permission, get_compliance_stats,
    initialize_demo_data, MASK_TYPES, LOG_FIELDS, DEMO_USERS
)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///audit_logs.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()
    initialize_demo_data()


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})


@app.route('/api/roles', methods=['GET'])
def list_roles():
    user = get_auth_user()
    roles = Role.query.all()
    return jsonify({
        'current_user': user,
        'roles': [{
            'id': r.id,
            'name': r.name,
            'can_export': r.can_export
        } for r in roles]
    })


@app.route('/api/roles/<role_name>/permissions', methods=['GET'])
def get_role_permissions(role_name):
    from services import get_role_field_strategies
    strategies = get_role_field_strategies(role_name)
    role = Role.query.filter_by(name=role_name).first()
    return jsonify({
        'role': role_name,
        'can_export': role.can_export if role else False,
        'field_strategies': strategies
    })


@app.route('/api/field-strategies', methods=['GET', 'POST'])
def field_strategies():
    user = get_auth_user()
    if user['role'] != 'admin':
        return jsonify({'error': '仅管理员可配置字段策略'}), 403
    
    if request.method == 'GET':
        strategies = FieldStrategy.query.all()
        return jsonify({
            'available_mask_types': MASK_TYPES,
            'strategies': [{
                'id': s.id,
                'field_name': s.field_name,
                'mask_type': s.mask_type,
                'description': MASK_TYPES.get(s.mask_type, '未知')
            } for s in strategies]
        })
    
    data = request.get_json()
    field_name = data.get('field_name')
    mask_type = data.get('mask_type', 'none')
    
    if not field_name:
        return jsonify({'error': '字段名称必填'}), 400
    if mask_type not in MASK_TYPES:
        return jsonify({'error': f'无效的脱敏类型，可选: {list(MASK_TYPES.keys())}'}), 400
    
    fs = FieldStrategy.query.filter_by(field_name=field_name).first()
    if fs:
        old_type = fs.mask_type
        fs.mask_type = mask_type
        msg = f'更新字段 {field_name} 策略: {old_type} -> {mask_type}'
    else:
        fs = FieldStrategy(field_name=field_name, mask_type=mask_type)
        db.session.add(fs)
        msg = f'创建字段 {field_name} 策略: {mask_type}'
        db.session.flush()
        
        for role in Role.query.all():
            db.session.add(RoleFieldMapping(
                role_id=role.id,
                field_strategy_id=fs.id,
                visible=True
            ))
    
    db.session.commit()
    return jsonify({'message': msg})


@app.route('/api/logs', methods=['GET'])
def list_logs():
    user = get_auth_user()
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    action = request.args.get('action')
    status = request.args.get('status')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    
    query = AuditLog.query.filter_by(is_withdrawn=False)
    if action:
        query = query.filter(AuditLog.action.contains(action))
    if status:
        query = query.filter_by(status=status)
    if start_time:
        query = query.filter(AuditLog.timestamp >= datetime.fromisoformat(start_time))
    if end_time:
        query = query.filter(AuditLog.timestamp <= datetime.fromisoformat(end_time))
    
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
    
    desensitized_logs = [
        apply_desensitization(log_to_dict(log), user['role'])
        for log in logs.items
    ]
    
    filters = {
        'action': action,
        'status': status,
        'start_time': start_time,
        'end_time': end_time
    }
    record_access(user, 'view', filters=filters)
    
    return jsonify({
        'current_user': user,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'pages': logs.pages
        },
        'logs': desensitized_logs
    })


@app.route('/api/logs/<event_id>', methods=['GET'])
def get_log_detail(event_id):
    user = get_auth_user()
    log = AuditLog.query.filter_by(event_id=event_id, is_withdrawn=False).first()
    if not log:
        return jsonify({'error': '日志不存在或已撤回'}), 404
    
    result = apply_desensitization(log_to_dict(log), user['role'])
    record_access(user, 'view_detail', target_log_ids=[log.id])
    return jsonify(result)


@app.route('/api/logs/<event_id>/history', methods=['GET'])
def get_log_history(event_id):
    user = get_auth_user()
    log = AuditLog.query.filter_by(event_id=event_id).first()
    if not log:
        return jsonify({'error': '日志不存在'}), 404
    
    histories = LogHistory.query.filter_by(log_id=log.id
        ).order_by(LogHistory.created_at.desc()).all()
    
    return jsonify({
        'event_id': event_id,
        'history_count': len(histories),
        'histories': [{
            'id': h.id,
            'action_type': h.action_type,
            'old_data': json.loads(h.old_data) if h.old_data else None,
            'new_data': json.loads(h.new_data) if h.new_data else None,
            'operator_id': h.operator_id,
            'operator_name': h.operator_name,
            'reason': h.reason,
            'created_at': h.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for h in histories]
    })


@app.route('/api/logs/supplement', methods=['POST'])
def supplement_log():
    user = get_auth_user()
    if user['role'] not in ['admin', 'auditor']:
        return jsonify({'error': '仅管理员和审计员可补录日志'}), 403
    
    data = request.get_json()
    event_id = data.get('event_id')
    if not event_id:
        return jsonify({'error': 'event_id 必填'}), 400
    
    existing = AuditLog.query.filter_by(event_id=event_id).first()
    if existing:
        return jsonify({'error': '该 event_id 已存在，无法补录'}), 400
    
    log_data = {
        'event_id': event_id,
        'user_id': data.get('user_id'),
        'user_name': data.get('user_name'),
        'action': data.get('action', '手动补录'),
        'resource': data.get('resource'),
        'ip_address': data.get('ip_address'),
        'user_agent': data.get('user_agent'),
        'request_data': data.get('request_data'),
        'response_data': data.get('response_data'),
        'status': data.get('status', 'success')
    }
    
    log = AuditLog(**log_data)
    db.session.add(log)
    db.session.flush()
    
    record_log_history(
        log_id=log.id,
        action_type='supplement',
        old_data=None,
        new_data=log_data,
        operator_info=user,
        reason=data.get('reason', '无')
    )
    record_access(user, 'supplement', target_log_ids=[log.id])
    db.session.commit()
    
    return jsonify({
        'message': '日志补录成功',
        'event_id': event_id,
        'log_id': log.id
    })


@app.route('/api/logs/<event_id>/withdraw', methods=['POST'])
def withdraw_log(event_id):
    user = get_auth_user()
    if user['role'] != 'admin':
        return jsonify({'error': '仅管理员可撤回日志'}), 403
    
    log = AuditLog.query.filter_by(event_id=event_id).first()
    if not log:
        return jsonify({'error': '日志不存在'}), 404
    if log.is_withdrawn:
        return jsonify({'error': '日志已撤回'}), 400
    
    data = request.get_json() or {}
    old_data = log_to_dict(log)
    log.is_withdrawn = True
    
    record_log_history(
        log_id=log.id,
        action_type='withdraw',
        old_data=old_data,
        new_data={'is_withdrawn': True},
        operator_info=user,
        reason=data.get('reason', '无')
    )
    record_access(user, 'withdraw', target_log_ids=[log.id])
    db.session.commit()
    
    return jsonify({'message': '日志撤回成功', 'event_id': event_id})


@app.route('/api/logs/export', methods=['POST'])
@check_export_permission
def export_logs():
    user = get_auth_user()
    data = request.get_json() or {}
    
    export_format = data.get('format', 'json')
    if export_format not in ['json', 'csv']:
        return jsonify({'error': '仅支持 json 和 csv 格式'}), 400
    
    action = data.get('action')
    status = data.get('status')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    log_ids = data.get('log_ids')
    
    query = AuditLog.query.filter_by(is_withdrawn=False)
    if log_ids:
        query = query.filter(AuditLog.id.in_(log_ids))
    else:
        if action:
            query = query.filter(AuditLog.action.contains(action))
        if status:
            query = query.filter_by(status=status)
        if start_time:
            query = query.filter(AuditLog.timestamp >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.filter(AuditLog.timestamp <= datetime.fromisoformat(end_time))
    
    logs = query.order_by(AuditLog.timestamp.desc()).all()
    target_ids = [log.id for log in logs]
    
    desensitized_logs = [
        apply_desensitization(log_to_dict(log), user['role'])
        for log in logs
    ]
    
    export_time = datetime.utcnow()
    watermark = generate_watermark(user, export_time)
    
    if export_format == 'json':
        content = json.dumps({
            **watermark,
            'export_info': {
                'total_count': len(logs),
                'export_time': export_time.strftime('%Y-%m-%d %H:%M:%S'),
                'filters': {
                    'action': action,
                    'status': status,
                    'start_time': start_time,
                    'end_time': end_time,
                    'log_ids': log_ids
                }
            },
            'logs': desensitized_logs
        }, ensure_ascii=False, indent=2)
        filename = f'audit_export_{export_time.strftime("%Y%m%d_%H%M%S")}.json'
        mimetype = 'application/json'
        encoding = 'utf-8'
    else:
        headers = LOG_FIELDS + ['is_withdrawn']
        lines = [','.join(headers)]
        for log in desensitized_logs:
            row = [str(log.get(h, '')).replace(',', '，') for h in headers]
            lines.append(','.join(row))
        
        wm_lines = [
            '# 审计日志导出文件',
            f'# 导出水印: {watermark["watermark"]["hash"]}',
            f'# 导出时间: {watermark["watermark"]["generated_at"]}',
            f'# 操作人: {watermark["watermark"]["operator_name"]} ({watermark["watermark"]["operator_role"]})',
            f'# 操作人ID: {watermark["watermark"]["operator_id"]}',
            '#'
        ]
        content = '\n'.join(wm_lines + lines)
        filename = f'audit_export_{export_time.strftime("%Y%m%d_%H%M%S")}.csv'
        mimetype = 'text/csv'
        encoding = 'utf-8-sig'
    
    record_access(
        user, 'export',
        target_log_ids=target_ids,
        filters={
            'action': action, 'status': status,
            'start_time': start_time, 'end_time': end_time
        },
        export_format=export_format,
        watermark_applied=True
    )
    
    buffer = io.BytesIO(content.encode(encoding))
    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype=mimetype
    )


@app.route('/api/access-audit', methods=['GET'])
def access_audit():
    user = get_auth_user()
    if user['role'] not in ['admin', 'auditor']:
        return jsonify({'error': '仅管理员和审计员可查看访问审计'}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    accesses = AccessAudit.query.order_by(AccessAudit.timestamp.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': accesses.total,
            'pages': accesses.pages
        },
        'records': [{
            'id': a.id,
            'operator_id': a.operator_id,
            'operator_name': a.operator_name,
            'operator_role': a.operator_role,
            'action': a.action,
            'export_format': a.export_format,
            'watermark_applied': a.watermark_applied,
            'timestamp': a.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'ip_address': a.ip_address,
            'status': a.status
        } for a in accesses.items]
    })


@app.route('/api/compliance-report', methods=['GET'])
def compliance_report():
    user = get_auth_user()
    if user['role'] not in ['admin', 'auditor']:
        return jsonify({'error': '仅管理员和审计员可查看合规报表'}), 403
    
    days = request.args.get('days', 7, type=int)
    stats = get_compliance_stats(days)
    
    recent_access = AccessAudit.query.order_by(AccessAudit.timestamp.desc()
        ).limit(10).all()
    
    return jsonify({
        'report_info': {
            'generated_at': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            'period_days': days,
            'operator': user['name']
        },
        'summary': stats,
        'recent_access': [{
            'action': a.action,
            'operator': f'{a.operator_name}({a.operator_role})',
            'timestamp': a.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'status': a.status
        } for a in recent_access]
    })


if __name__ == '__main__':
    print("=" * 60)
    print("审计日志脱敏授权 API 服务")
    print("=" * 60)
    print("可用测试用户 (通过请求头 X-User-Type 指定):")
    for key, info in DEMO_USERS.items():
        export_perm = '是' if key in ['admin', 'auditor'] else '否'
        print(f"  {key}: {info['name']} (角色: {info['role']}, 可导出: {export_perm})")
    print("=" * 60)
    app.run(host='0.0.0.0', port=8080, debug=False)
