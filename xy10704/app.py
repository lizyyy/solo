from flask import Flask, request, jsonify, render_template_string, send_file
from flask_cors import CORS
import uuid
import json
from datetime import datetime
from io import BytesIO
import csv
from models import (
    init_db, TenantConfig, EnvVar, ConfigSnapshot, 
    RollbackRecord, PublishLog, get_db
)

app = Flask(__name__)
CORS(app)

init_db()

def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def validate_gray_scope(gray_scope: str) -> tuple:
    try:
        gray_data = json.loads(gray_scope) if isinstance(gray_scope, str) else gray_scope
    except:
        return False, "灰度范围格式错误，必须是JSON格式"
    
    if not isinstance(gray_data, dict):
        return False, "灰度范围必须是对象格式"
    
    allowed_types = ['tenant_list', 'percentage', 'all']
    if gray_data.get('type') not in allowed_types:
        return False, f"灰度类型必须是以下之一: {', '.join(allowed_types)}"
    
    if gray_data.get('type') == 'percentage':
        percentage = gray_data.get('value', 0)
        if not isinstance(percentage, (int, float)) or percentage < 0 or percentage > 100:
            return False, "百分比值必须在0-100之间"
    
    if gray_data.get('type') == 'tenant_list':
        if not isinstance(gray_data.get('tenants', []), list):
            return False, "租户列表必须是数组格式"
    
    return True, None

@app.route('/')
def index():
    with open('templates/index.html', 'r', encoding='utf-8') as f:
        return render_template_string(f.read())

@app.route('/api/configs', methods=['GET'])
def get_configs():
    keyword = request.args.get('keyword', '')
    configs = TenantConfig.search(keyword)
    return jsonify({'success': True, 'data': configs})

@app.route('/api/configs/<tenant_id>', methods=['GET'])
def get_tenant_configs(tenant_id):
    configs = TenantConfig.get_by_tenant(tenant_id)
    return jsonify({'success': True, 'data': configs})

@app.route('/api/configs', methods=['POST'])
def create_config():
    data = request.json
    required_fields = ['tenant_id', 'tenant_name', 'config_key', 'config_value', 'gray_scope', 'created_by']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400
    
    is_valid, error_msg = validate_gray_scope(data['gray_scope'])
    if not is_valid:
        return jsonify({'success': False, 'error': error_msg}), 400
    
    raw_input = json.dumps(data, ensure_ascii=False)
    processed_result = json.dumps({
        'config_key': data['config_key'],
        'config_value': data['config_value'],
        'gray_scope': data['gray_scope'],
        'processed_at': datetime.now().isoformat()
    }, ensure_ascii=False)
    
    config_id = TenantConfig.create(
        data['tenant_id'], data['tenant_name'], data['config_key'],
        data['config_value'], raw_input, data['gray_scope'], data['created_by']
    )
    TenantConfig.update(config_id, processed_result=processed_result)
    
    return jsonify({'success': True, 'data': {'id': config_id}})

@app.route('/api/env/<tenant_id>/<env_name>', methods=['GET'])
def get_env_vars(tenant_id, env_name):
    vars = EnvVar.get_by_tenant_and_env(tenant_id, env_name)
    return jsonify({'success': True, 'data': vars})

@app.route('/api/snapshots', methods=['GET'])
def get_snapshots():
    tenant_id = request.args.get('tenant_id')
    snapshots = ConfigSnapshot.list_all(tenant_id)
    return jsonify({'success': True, 'data': snapshots})

@app.route('/api/snapshots/<snapshot_id>', methods=['GET'])
def get_snapshot(snapshot_id):
    snapshot = ConfigSnapshot.get(snapshot_id)
    if not snapshot:
        return jsonify({'success': False, 'error': '快照不存在'}), 404
    return jsonify({'success': True, 'data': snapshot})

@app.route('/api/publish', methods=['POST'])
def publish_config():
    data = request.json
    required_fields = ['tenant_id', 'tenant_name', 'configs', 'env_vars', 'change_type', 'gray_scope', 'created_by']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400
    
    is_valid, error_msg = validate_gray_scope(data['gray_scope'])
    if not is_valid:
        return jsonify({'success': False, 'error': error_msg}), 400
    
    snapshot_id = generate_id('snap')
    
    old_configs = {}
    old_env_vars = {}
    for cfg in TenantConfig.get_by_tenant(data['tenant_id']):
        old_configs[cfg['config_key']] = cfg['config_value']
    for ev in EnvVar.get_by_tenant_and_env(data['tenant_id'], 'prod'):
        old_env_vars[ev['var_key']] = ev['var_value']
    
    gray_intercepted = False
    intercept_reason = None
    try:
        gray_data = json.loads(data['gray_scope']) if isinstance(data['gray_scope'], str) else data['gray_scope']
        if gray_data.get('type') == 'percentage' and gray_data.get('value', 0) > 80:
            gray_intercepted = True
            intercept_reason = "灰度比例超过80%，为了系统稳定性已自动拦截，请调整灰度范围后重试"
        if gray_data.get('type') == 'tenant_list' and len(gray_data.get('tenants', [])) > 50:
            gray_intercepted = True
            intercept_reason = "灰度租户数量超过50个，为了系统稳定性已自动拦截，请分批发布"
    except:
        pass
    
    ConfigSnapshot.create(
        snapshot_id, data['tenant_id'], data['tenant_name'],
        old_configs, data['configs'],
        old_env_vars, data['env_vars'],
        data['change_type'], data['gray_scope'], data['created_by']
    )
    
    status = 'intercepted' if gray_intercepted else 'success'
    ConfigSnapshot.update_status(snapshot_id, status, gray_intercepted, intercept_reason)
    
    log_id = generate_id('log')
    PublishLog.create(
        log_id, data['tenant_id'], 'publish', status,
        data['created_by'], snapshot_id, intercept_reason
    )
    
    return jsonify({
        'success': not gray_intercepted,
        'data': {
            'snapshot_id': snapshot_id,
            'log_id': log_id,
            'gray_intercepted': gray_intercepted,
            'intercept_reason': intercept_reason
        }
    })

@app.route('/api/rollback', methods=['POST'])
def rollback_config():
    data = request.json
    required_fields = ['snapshot_id', 'rollback_reason', 'rollback_type', 'tenant_id', 'tenant_name']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400
    
    rollback_id = generate_id('rbk')
    RollbackRecord.create(
        rollback_id, data['snapshot_id'], data['tenant_id'], 
        data['tenant_name'], data['rollback_reason'], data['rollback_type']
    )
    
    log_id = generate_id('log')
    PublishLog.create(
        log_id, data['tenant_id'], 'rollback', 'pending',
        'system', data['snapshot_id'], "等待人工处理回滚"
    )
    
    return jsonify({
        'success': True,
        'data': {'rollback_id': rollback_id, 'log_id': log_id}
    })

@app.route('/api/rollbacks', methods=['GET'])
def get_rollbacks():
    tenant_id = request.args.get('tenant_id')
    rollbacks = RollbackRecord.list_all(tenant_id)
    return jsonify({'success': True, 'data': rollbacks})

@app.route('/api/rollbacks/<rollback_id>/handle', methods=['POST'])
def handle_rollback(rollback_id):
    data = request.json
    required_fields = ['handled_by', 'handle_note']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400
    
    RollbackRecord.handle_manual(rollback_id, data['handled_by'], data['handle_note'])
    return jsonify({'success': True})

@app.route('/api/diagnose/<snapshot_id>', methods=['GET'])
def diagnose_snapshot(snapshot_id):
    snapshot = ConfigSnapshot.get(snapshot_id)
    if not snapshot:
        return jsonify({'success': False, 'error': '快照不存在'}), 404
    
    issues = []
    suggestions = []
    
    try:
        gray_scope = json.loads(snapshot['gray_scope']) if isinstance(snapshot['gray_scope'], str) else snapshot['gray_scope']
        if gray_scope.get('type') == 'percentage':
            percentage = gray_scope.get('value', 0)
            if percentage > 80:
                issues.append(f"灰度比例过高 ({percentage}%)，建议控制在80%以内")
                suggestions.append("降低灰度比例，或采用分阶段灰度策略")
    except:
        issues.append("灰度范围JSON解析失败")
    
    configs_before = snapshot['configs_before']
    configs_after = snapshot['configs_after']
    
    changed_keys = set(configs_after.keys()) - set(configs_before.keys())
    if changed_keys:
        suggestions.append(f"新增配置项: {', '.join(changed_keys)}，请确认是否需要同步到其他环境")
    
    rollback = None
    for r in RollbackRecord.list_all(snapshot['tenant_id']):
        if r['snapshot_id'] == snapshot_id:
            rollback = r
            break
    
    return jsonify({
        'success': True,
        'data': {
            'snapshot': snapshot,
            'issues': issues,
            'suggestions': suggestions,
            'rollback_record': rollback
        }
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    tenant_id = request.args.get('tenant_id')
    logs = PublishLog.list_all(tenant_id)
    return jsonify({'success': True, 'data': logs})

@app.route('/api/logs/<log_id>/retry', methods=['POST'])
def retry_publish(log_id):
    PublishLog.increment_retry(log_id)
    return jsonify({'success': True})

@app.route('/api/export', methods=['GET'])
def export_report():
    tenant_id = request.args.get('tenant_id')
    
    snapshots = ConfigSnapshot.list_all(tenant_id)
    rollbacks = RollbackRecord.list_all(tenant_id)
    
    output = BytesIO()
    writer = csv.writer(output)
    
    writer.writerow(['多租户配置发布台诊断报告', '', '', '', '', ''])
    writer.writerow(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S'), '', '', '', ''])
    writer.writerow([])
    
    writer.writerow(['=== 配置快照记录 ===', '', '', '', '', ''])
    writer.writerow(['快照ID', '租户名称', '变更类型', '灰度范围', '是否被拦截', '状态', '创建时间'])
    for snap in snapshots:
        gray_scope_display = snap['gray_scope']
        try:
            gray = json.loads(gray_scope_display) if isinstance(gray_scope_display, str) else gray_scope_display
            if gray.get('type') == 'percentage':
                gray_scope_display = f"按比例: {gray.get('value')}%"
            elif gray.get('type') == 'tenant_list':
                gray_scope_display = f"指定租户: {len(gray.get('tenants', []))}个"
            elif gray.get('type') == 'all':
                gray_scope_display = "全量发布"
        except:
            pass
        
        writer.writerow([
            snap['snapshot_id'],
            snap['tenant_name'],
            snap['change_type'],
            gray_scope_display,
            '是' if snap['gray_intercepted'] else '否',
            snap['status'],
            snap['created_at']
        ])
    
    writer.writerow([])
    writer.writerow(['=== 回滚记录 ===', '', '', '', '', ''])
    writer.writerow(['回滚ID', '关联快照', '租户名称', '回滚原因', '处理人', '处理备注', '是否人工处理', '状态'])
    for rbk in rollbacks:
        writer.writerow([
            rbk['rollback_id'],
            rbk['snapshot_id'],
            rbk['tenant_name'],
            rbk['rollback_reason'],
            rbk['handled_by'] or '-',
            rbk['handle_note'] or '-',
            '是' if rbk['is_manual_handled'] else '否',
            rbk['status']
        ])
    
    output.seek(0)
    
    return send_file(
        output,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'config_diagnose_report_{datetime.now().strftime("%Y%m%d")}.csv'
    )

@app.route('/api/sample-data', methods=['POST'])
def load_sample_data():
    tenants = [
        {'id': 't001', 'name': '电商平台A'},
        {'id': 't002', 'name': '金融服务B'},
        {'id': 't003', 'name': '教育平台C'},
        {'id': 't004', 'name': '医疗系统D'},
        {'id': 't005', 'name': '物流系统E'}
    ]
    
    config_keys = ['payment_timeout', 'max_connections', 'cache_ttl', 'log_level', 'feature_flag_v2']
    
    for tenant in tenants:
        for key in config_keys:
            raw_input = json.dumps({
                'tenant_id': tenant['id'],
                'tenant_name': tenant['name'],
                'config_key': key,
                'config_value': '30000' if key == 'payment_timeout' else '100',
                'gray_scope': '{"type": "percentage", "value": 50}',
                'created_by': 'admin'
            }, ensure_ascii=False)
            
            TenantConfig.create(
                tenant['id'], tenant['name'], key,
                '30000' if key == 'payment_timeout' else '100',
                raw_input,
                '{"type": "percentage", "value": 50}',
                'admin'
            )
    
    EnvVar.create('t001', 'prod', 'DB_HOST', 'mysql.prod.internal', False)
    EnvVar.create('t001', 'prod', 'DB_PORT', '3306', False)
    EnvVar.create('t001', 'prod', 'API_SECRET', 'sk_xxx_123', True)
    
    snap1_id = generate_id('snap')
    ConfigSnapshot.create(
        snap1_id, 't001', '电商平台A',
        {'payment_timeout': '30000'},
        {'payment_timeout': '60000', 'new_feature': 'true'},
        {'DB_HOST': 'mysql.prod.internal'},
        {'DB_HOST': 'mysql.prod.internal', 'NEW_VAR': 'test'},
        'feature_update',
        '{"type": "percentage", "value": 90}',
        'developer_zhang'
    )
    ConfigSnapshot.update_status(
        snap1_id, 'intercepted', True,
        "灰度比例超过80%，为了系统稳定性已自动拦截，请调整灰度范围后重试"
    )
    
    snap2_id = generate_id('snap')
    ConfigSnapshot.create(
        snap2_id, 't002', '金融服务B',
        {'max_connections': '100'},
        {'max_connections': '500'},
        {}, {},
        'performance_tuning',
        '{"type": "all"}',
        'dba_li'
    )
    ConfigSnapshot.update_status(snap2_id, 'success', False, None)
    
    snap3_id = generate_id('snap')
    many_tenants = [f't{i:03d}' for i in range(1, 61)]
    ConfigSnapshot.create(
        snap3_id, 't003', '教育平台C',
        {'cache_ttl': '3600'},
        {'cache_ttl': '7200'},
        {}, {},
        'cache_optimization',
        json.dumps({'type': 'tenant_list', 'tenants': many_tenants}, ensure_ascii=False),
        'ops_wang'
    )
    ConfigSnapshot.update_status(
        snap3_id, 'intercepted', True,
        "灰度租户数量超过50个，为了系统稳定性已自动拦截，请分批发布"
    )
    
    rbk1_id = generate_id('rbk')
    RollbackRecord.create(
        rbk1_id, snap2_id, 't002', '金融服务B',
        '连接数调整后数据库CPU飙升到95%，需要紧急回滚',
        'emergency'
    )
    RollbackRecord.handle_manual(
        rbk1_id, 'sre_zhao',
        '已手动执行回滚脚本，数据库连接数恢复到100，CPU使用率回落至30%左右，业务恢复正常'
    )
    
    rbk2_id = generate_id('rbk')
    RollbackRecord.create(
        rbk2_id, snap1_id, 't001', '电商平台A',
        '灰度拦截后需要重新评估发布策略',
        'normal'
    )
    
    log_ids = [generate_id('log') for _ in range(5)]
    PublishLog.create(log_ids[0], 't001', 'publish', 'intercepted', 'developer_zhang', snap1_id, "灰度比例超过80%")
    PublishLog.create(log_ids[1], 't002', 'publish', 'success', 'dba_li', snap2_id, None)
    PublishLog.create(log_ids[2], 't003', 'publish', 'intercepted', 'ops_wang', snap3_id, "租户数量超过50")
    PublishLog.create(log_ids[3], 't002', 'rollback', 'handled', 'sre_zhao', snap2_id, "人工处理完成")
    PublishLog.create(log_ids[4], 't001', 'rollback', 'pending', 'system', snap1_id, "等待人工处理")
    
    return jsonify({'success': True, 'message': '样例数据加载完成，包含脏数据和回滚记录'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
