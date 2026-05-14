from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import os
import json
import pandas as pd
from io import BytesIO
from models import db, AppAccount, ApiKey, ExpirationPolicy, UsageLog, RollbackSwitch, RiskItem
from sqlalchemy import and_, or_

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, '../data/api_rotation.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'dev-key-rotation-2024'

db.init_app(app)

with app.app_context():
    db.create_all()
    if ExpirationPolicy.query.count() == 0:
        default_policies = [
            ExpirationPolicy(name='90天标准', days=90, description='标准90天轮换策略'),
            ExpirationPolicy(name='30天高安全', days=30, description='高安全环境30天轮换'),
            ExpirationPolicy(name='180天低风险', days=180, description='低风险系统180天轮换')
        ]
        db.session.add_all(default_policies)
        db.session.commit()

@app.route('/api/apps', methods=['GET'])
def get_apps():
    apps = AppAccount.query.all()
    result = []
    for app in apps:
        latest_key = ApiKey.query.filter_by(app_id=app.id).order_by(ApiKey.created_at.desc()).first()
        result.append({
            'id': app.id,
            'app_name': app.app_name,
            'app_id': app.app_id,
            'owner': app.owner,
            'owner_email': app.owner_email,
            'environment': app.environment,
            'status': app.status,
            'latest_key_version': latest_key.version if latest_key else None,
            'expires_at': latest_key.expires_at.isoformat() if latest_key and latest_key.expires_at else None,
            'created_at': app.created_at.isoformat()
        })
    return jsonify(result)

@app.route('/api/apps', methods=['POST'])
def create_app():
    data = request.json
    app = AppAccount(
        app_name=data['app_name'],
        app_id=data['app_id'],
        owner=data['owner'],
        owner_email=data['owner_email'],
        environment=data.get('environment', 'production'),
        status=data.get('status', 'active')
    )
    db.session.add(app)
    db.session.commit()
    return jsonify({'id': app.id, 'message': '应用创建成功'})

@app.route('/api/apps/batch', methods=['POST'])
def batch_import_apps():
    data = request.json
    results = {'success': 0, 'failed': 0, 'errors': []}
    
    for item in data.get('apps', []):
        try:
            existing = AppAccount.query.filter_by(app_id=item['app_id']).first()
            if existing:
                results['failed'] += 1
                results['errors'].append(f"应用ID {item['app_id']} 已存在")
                continue
            
            app = AppAccount(
                app_name=item['app_name'],
                app_id=item['app_id'],
                owner=item['owner'],
                owner_email=item['owner_email'],
                environment=item.get('environment', 'production'),
                status=item.get('status', 'active')
            )
            db.session.add(app)
            results['success'] += 1
        except Exception as e:
            results['failed'] += 1
            results['errors'].append(f"{item.get('app_id', 'unknown')}: {str(e)}")
    
    db.session.commit()
    return jsonify(results)

@app.route('/api/apps/<int:app_id>/keys', methods=['GET'])
def get_app_keys(app_id):
    keys = ApiKey.query.filter_by(app_id=app_id).order_by(ApiKey.created_at.desc()).all()
    result = []
    for key in keys:
        result.append({
            'id': key.id,
            'version': key.version,
            'key_prefix': key.key_prefix,
            'status': key.status,
            'policy_id': key.policy_id,
            'created_at': key.created_at.isoformat(),
            'expires_at': key.expires_at.isoformat() if key.expires_at else None,
            'rotated_at': key.rotated_at.isoformat() if key.rotated_at else None
        })
    return jsonify(result)

@app.route('/api/apps/<int:app_id>/keys', methods=['POST'])
def create_key(app_id):
    data = request.json
    app = AppAccount.query.get_or_404(app_id)
    
    latest_key = ApiKey.query.filter_by(app_id=app_id).order_by(ApiKey.created_at.desc()).first()
    new_version = 1 if not latest_key else latest_key.version + 1
    
    policy = ExpirationPolicy.query.get(data['policy_id'])
    expires_at = datetime.utcnow() + timedelta(days=policy.days)
    
    key = ApiKey(
        app_id=app_id,
        version=new_version,
        key_prefix=data['key_prefix'],
        policy_id=data['policy_id'],
        expires_at=expires_at
    )
    db.session.add(key)
    
    if latest_key:
        latest_key.status = 'deprecated'
        latest_key.rotated_at = datetime.utcnow()
    
    db.session.commit()
    return jsonify({'id': key.id, 'version': new_version, 'message': '密钥创建成功'})

@app.route('/api/policies', methods=['GET'])
def get_policies():
    policies = ExpirationPolicy.query.all()
    result = []
    for p in policies:
        result.append({
            'id': p.id,
            'name': p.name,
            'days': p.days,
            'description': p.description
        })
    return jsonify(result)

@app.route('/api/logs', methods=['GET'])
def get_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    
    query = UsageLog.query
    if status:
        query = query.filter_by(status=status)
    
    logs = query.order_by(UsageLog.created_at.desc()).paginate(page=page, per_page=per_page)
    result = []
    for log in logs.items:
        app = AppAccount.query.get(log.app_id)
        result.append({
            'id': log.id,
            'app_id': log.app_id,
            'app_name': app.app_name if app else '未知',
            'key_version': log.key_version,
            'action': log.action,
            'status': log.status,
            'error_message': log.error_message,
            'operator': log.operator,
            'created_at': log.created_at.isoformat()
        })
    return jsonify({
        'logs': result,
        'total': logs.total,
        'page': page,
        'pages': logs.pages
    })

@app.route('/api/logs/<int:log_id>', methods=['GET'])
def get_log_detail(log_id):
    log = UsageLog.query.get_or_404(log_id)
    app = AppAccount.query.get(log.app_id)
    return jsonify({
        'id': log.id,
        'app_id': log.app_id,
        'app_name': app.app_name if app else '未知',
        'app_owner': app.owner if app else '未知',
        'key_version': log.key_version,
        'action': log.action,
        'status': log.status,
        'error_message': log.error_message,
        'operator': log.operator,
        'operator_email': log.operator_email,
        'reason': log.reason,
        'created_at': log.created_at.isoformat(),
        'resolved_at': log.resolved_at.isoformat() if log.resolved_at else None,
        'resolved_by': log.resolved_by,
        'resolution_notes': log.resolution_notes,
        'extra_data': log.extra_data
    })

@app.route('/api/logs/<int:log_id>/resolve', methods=['POST'])
def resolve_log(log_id):
    log = UsageLog.query.get_or_404(log_id)
    data = request.json
    log.resolved_at = datetime.utcnow()
    log.resolved_by = data['resolved_by']
    log.resolution_notes = data['resolution_notes']
    log.status = 'success'
    db.session.commit()
    return jsonify({'message': '问题已处理'})

@app.route('/api/risks', methods=['GET'])
def get_risks():
    risks = RiskItem.query.order_by(RiskItem.created_at.desc()).all()
    result = []
    for risk in risks:
        app = AppAccount.query.get(risk.app_id)
        result.append({
            'id': risk.id,
            'app_id': risk.app_id,
            'app_name': app.app_name if app else '未知',
            'risk_type': risk.risk_type,
            'severity': risk.severity,
            'description': risk.description,
            'owner': app.owner if app else '未知',
            'status': risk.status,
            'created_at': risk.created_at.isoformat()
        })
    return jsonify(result)

@app.route('/api/risks/export', methods=['GET'])
def export_risks():
    risks = RiskItem.query.order_by(RiskItem.created_at.desc()).all()
    data = []
    for risk in risks:
        app = AppAccount.query.get(risk.app_id)
        policy = ExpirationPolicy.query.get(app.default_policy_id) if app and app.default_policy_id else None
        data.append({
            '负责人': app.owner if app else '未知',
            '应用名称': app.app_name if app else '未知',
            '风险类型': risk.risk_type,
            '严重程度': risk.severity,
            '描述': risk.description,
            '状态': risk.status,
            '发现时间': risk.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            '过期策略': policy.name if policy else '未设置'
        })
    
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for owner in df['负责人'].unique():
            owner_df = df[df['负责人'] == owner]
            owner_df.to_excel(writer, sheet_name=owner[:30], index=False)
    
    output.seek(0)
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'风险清单_{datetime.now().strftime("%Y%m%d")}.xlsx'
    )

@app.route('/api/rollback', methods=['GET'])
def get_rollback_status():
    switches = RollbackSwitch.query.all()
    result = []
    for sw in switches:
        app = AppAccount.query.get(sw.app_id)
        result.append({
            'id': sw.id,
            'app_id': sw.app_id,
            'app_name': app.app_name if app else '未知',
            'enabled': sw.enabled,
            'reason': sw.reason,
            'operator': sw.operator,
            'created_at': sw.created_at.isoformat(),
            'updated_at': sw.updated_at.isoformat()
        })
    return jsonify(result)

@app.route('/api/rollback/<int:app_id>', methods=['POST'])
def toggle_rollback(app_id):
    data = request.json
    sw = RollbackSwitch.query.filter_by(app_id=app_id).first()
    
    if not sw:
        sw = RollbackSwitch(app_id=app_id)
    
    sw.enabled = data['enabled']
    sw.reason = data.get('reason', '')
    sw.operator = data.get('operator', '系统')
    sw.updated_at = datetime.utcnow()
    
    if not sw.id:
        db.session.add(sw)
    
    db.session.commit()
    
    log = UsageLog(
        app_id=app_id,
        action='rollback_toggle',
        status='success',
        operator=data.get('operator', '系统'),
        reason=f"回滚开关{'开启' if data['enabled'] else '关闭'}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'message': '回滚开关已更新', 'enabled': sw.enabled})

@app.route('/api/dashboard/stats', methods=['GET'])
def get_stats():
    total_apps = AppAccount.query.count()
    active_keys = ApiKey.query.filter_by(status='active').count()
    failed_logs = UsageLog.query.filter_by(status='failed').count()
    active_risks = RiskItem.query.filter_by(status='open').count()
    
    expiring_soon = ApiKey.query.filter(
        and_(
            ApiKey.status == 'active',
            ApiKey.expires_at < datetime.utcnow() + timedelta(days=7)
        )
    ).count()
    
    return jsonify({
        'total_apps': total_apps,
        'active_keys': active_keys,
        'failed_logs': failed_logs,
        'active_risks': active_risks,
        'expiring_soon': expiring_soon
    })

@app.route('/api/check-expiring', methods=['POST'])
def check_expiring_keys():
    now = datetime.utcnow()
    warning_date = now + timedelta(days=7)
    
    expiring_keys = ApiKey.query.filter(
        and_(
            ApiKey.status == 'active',
            ApiKey.expires_at < warning_date
        )
    ).all()
    
    results = []
    for key in expiring_keys:
        app = AppAccount.query.get(key.app_id)
        results.append({
            'app_id': app.app_id,
            'app_name': app.app_name,
            'owner': app.owner,
            'key_version': key.version,
            'expires_at': key.expires_at.isoformat(),
            'days_left': (key.expires_at - now).days
        })
        
        existing_risk = RiskItem.query.filter_by(
            app_id=key.app_id,
            risk_type='key_expiring',
            status='open'
        ).first()
        
        if not existing_risk:
            risk = RiskItem(
                app_id=key.app_id,
                risk_type='key_expiring',
                severity='high',
                description=f"密钥将在 {(key.expires_at - now).days} 天后过期",
                status='open'
            )
            db.session.add(risk)
    
    db.session.commit()
    return jsonify({'expiring_keys': results, 'count': len(results)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
