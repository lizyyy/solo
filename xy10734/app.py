from flask import Flask, jsonify, request, send_file, render_template_string
from flask_cors import CORS
import json
import os
import csv
from datetime import datetime, timedelta
from collections import defaultdict
import threading

app = Flask(__name__)
CORS(app)

DATA_DIR = 'data'
os.makedirs(DATA_DIR, exist_ok=True)
USAGE_FILE = os.path.join(DATA_DIR, 'usage_records.json')
TOKENS_FILE = os.path.join(DATA_DIR, 'access_tokens.json')
APPS_FILE = os.path.join(DATA_DIR, 'client_apps.json')
BILLING_FILE = os.path.join(DATA_DIR, 'billing_records.json')
EXPORT_DIR = os.path.join(DATA_DIR, 'exports')
os.makedirs(EXPORT_DIR, exist_ok=True)

lock = threading.Lock()

def load_json(filename, default):
    with lock:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        return default

def save_json(filename, data):
    with lock:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def init_data():
    apps = load_json(APPS_FILE, [])
    if not apps:
        apps = [
            {"id": "app_001", "name": "电商数据同步系统", "owner": "张三", "status": "active", "balance": 8500, "threshold": 1000, "created_at": "2024-01-15T08:00:00"},
            {"id": "app_002", "name": "用户画像分析", "owner": "李四", "status": "active", "balance": 2300, "threshold": 500, "created_at": "2024-02-20T10:30:00"},
            {"id": "app_003", "name": "实时风控接口", "owner": "王五", "status": "warning", "balance": 450, "threshold": 500, "created_at": "2024-03-10T14:15:00"}
        ]
        save_json(APPS_FILE, apps)
    
    tokens = load_json(TOKENS_FILE, [])
    if not tokens:
        tokens = [
            {"id": "tok_001", "app_id": "app_001", "token": "ak_abc123", "status": "active", "rate_limit": 1000, "created_at": "2024-01-15T08:05:00"},
            {"id": "tok_002", "app_id": "app_002", "token": "ak_def456", "status": "active", "rate_limit": 500, "created_at": "2024-02-20T10:35:00"},
            {"id": "tok_003", "app_id": "app_003", "token": "ak_ghi789", "status": "active", "rate_limit": 200, "created_at": "2024-03-10T14:20:00"}
        ]
        save_json(TOKENS_FILE, tokens)
    
    usage = load_json(USAGE_FILE, [])
    if not usage:
        base_time = datetime.now() - timedelta(hours=24)
        for i in range(100):
            hour_offset = i // 5
            app_idx = i % 3
            apps_list = ["app_001", "app_002", "app_003"]
            tokens_list = ["tok_001", "tok_002", "tok_003"]
            count = 50 + (i % 20) * 10
            is_anomaly = i in [23, 47, 89]
            if is_anomaly:
                count = 5000 + i * 100
            is_dirty = i in [15, 33, 66]
            status = "success"
            error_msg = ""
            if is_anomaly:
                status = "blocked"
                error_msg = "异常峰值拦截：请求量超过阈值10倍"
            elif is_dirty:
                status = "error"
                error_msg = "参数校验失败：无效的时间戳格式"
            ts = base_time + timedelta(hours=hour_offset, minutes=i % 60)
            usage.append({
                "id": f"usage_{i:04d}",
                "app_id": apps_list[app_idx],
                "token_id": tokens_list[app_idx],
                "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
                "count": count,
                "raw_input": {"api_version": "v1", "client_ip": f"192.168.1.{i % 255}", "user_agent": "python-requests/2.31.0"},
                "processed_result": {"billed": count if status == "success" else 0, "status": status},
                "status": status,
                "error_message": error_msg,
                "retry_count": 0
            })
        save_json(USAGE_FILE, usage)
    
    billing = load_json(BILLING_FILE, [])
    if not billing:
        billing = [
            {"id": "bill_001", "app_id": "app_001", "period": "2024-05", "total_usage": 125000, "amount": 1250.0, "status": "paid", "balance_alert": False, "created_at": "2024-05-01T00:00:00"},
            {"id": "bill_002", "app_id": "app_002", "period": "2024-05", "total_usage": 45000, "amount": 450.0, "status": "paid", "balance_alert": True, "alert_handled": True, "handled_by": "管理员A", "handled_at": "2024-05-02T10:00:00", "created_at": "2024-05-01T00:00:00"},
            {"id": "bill_003", "app_id": "app_003", "period": "2024-05", "total_usage": 18000, "amount": 180.0, "status": "pending", "balance_alert": True, "alert_handled": False, "created_at": "2024-05-01T00:00:00"}
        ]
        save_json(BILLING_FILE, billing)

init_data()

@app.route('/')
def index():
    return render_template_string(open('templates/index.html', encoding='utf-8').read())

@app.route('/api/apps', methods=['GET'])
def get_apps():
    apps = load_json(APPS_FILE, [])
    return jsonify({"data": apps})

@app.route('/api/tokens', methods=['GET'])
def get_tokens():
    tokens = load_json(TOKENS_FILE, [])
    return jsonify({"data": tokens})

@app.route('/api/usage', methods=['GET'])
def get_usage():
    usage = load_json(USAGE_FILE, [])
    app_id = request.args.get('app_id')
    status = request.args.get('status')
    search = request.args.get('search')
    if app_id:
        usage = [u for u in usage if u['app_id'] == app_id]
    if status:
        usage = [u for u in usage if u['status'] == status]
    if search:
        search_lower = search.lower()
        usage = [u for u in usage if search_lower in u.get('error_message', '').lower() or search_lower in u['app_id'].lower()]
    return jsonify({"data": usage, "total": len(usage)})

@app.route('/api/usage/<usage_id>/retry', methods=['POST'])
def retry_usage(usage_id):
    usage = load_json(USAGE_FILE, [])
    for u in usage:
        if u['id'] == usage_id:
            u['status'] = 'success'
            u['error_message'] = ''
            u['retry_count'] = u.get('retry_count', 0) + 1
            u['processed_result']['status'] = 'success'
            u['processed_result']['billed'] = u['count']
            save_json(USAGE_FILE, usage)
            return jsonify({"success": True, "data": u})
    return jsonify({"success": False, "error": "记录未找到"}), 404

@app.route('/api/billing', methods=['GET'])
def get_billing():
    billing = load_json(BILLING_FILE, [])
    return jsonify({"data": billing})

@app.route('/api/billing/<bill_id>/handle_alert', methods=['POST'])
def handle_alert(bill_id):
    billing = load_json(BILLING_FILE, [])
    data = request.get_json()
    for b in billing:
        if b['id'] == bill_id:
            b['alert_handled'] = True
            b['handled_by'] = data.get('handled_by', '管理员')
            b['handled_at'] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
            save_json(BILLING_FILE, billing)
            return jsonify({"success": True, "data": b})
    return jsonify({"success": False, "error": "账单未找到"}), 404

@app.route('/api/diagnose/<app_id>', methods=['GET'])
def diagnose(app_id):
    usage = load_json(USAGE_FILE, [])
    apps = load_json(APPS_FILE, [])
    app = next((a for a in apps if a['id'] == app_id), None)
    if not app:
        return jsonify({"success": False, "error": "应用未找到"}), 404
    app_usage = [u for u in usage if u['app_id'] == app_id]
    total = len(app_usage)
    success = len([u for u in app_usage if u['status'] == 'success'])
    blocked = len([u for u in app_usage if u['status'] == 'blocked'])
    errors = len([u for u in app_usage if u['status'] == 'error'])
    error_types = defaultdict(int)
    for u in app_usage:
        if u['error_message']:
            error_types[u['error_message']] += 1
    return jsonify({
        "success": True,
        "data": {
            "app": app,
            "summary": {"total": total, "success": success, "blocked": blocked, "errors": errors},
            "error_types": dict(error_types)
        }
    })

@app.route('/api/rollback/<usage_id>', methods=['POST'])
def rollback_usage(usage_id):
    usage = load_json(USAGE_FILE, [])
    for u in usage:
        if u['id'] == usage_id and u['status'] == 'success':
            u['status'] = 'pending'
            u['processed_result']['status'] = 'pending'
            u['processed_result']['billed'] = 0
            save_json(USAGE_FILE, usage)
            return jsonify({"success": True, "data": u})
    return jsonify({"success": False, "error": "无法回滚该记录"}), 400

@app.route('/api/export', methods=['GET'])
def export_data():
    usage = load_json(USAGE_FILE, [])
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"usage_export_{timestamp}.csv"
    filepath = os.path.join(EXPORT_DIR, filename)
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['ID', '应用ID', '令牌ID', '时间', '请求量', '状态', '错误信息', '重试次数'])
        for u in usage:
            writer.writerow([
                u['id'], u['app_id'], u['token_id'], u['timestamp'], u['count'], u['status'], u.get('error_message', ''), u.get('retry_count', 0)])
    return send_file(filepath, as_attachment=True, download_name=filename)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    usage = load_json(USAGE_FILE, [])
    apps = load_json(APPS_FILE, [])
    billing = load_json(BILLING_FILE, [])
    stats = {
        "total_requests": sum(u['count'] for u in usage),
        "success_rate": f"{len([u for u in usage if u['status'] == 'success']) / len(usage) * 100:.1f}%" if usage else "0%",
        "active_apps": len([a for a in apps if a['status'] == 'active']),
        "pending_alerts": len([b for b in billing if b.get('balance_alert') and not b.get('alert_handled')])
    }
    return jsonify({"data": stats})

@app.route('/console')
def console():
    return render_template_string(open('templates/console.html', encoding='utf-8').read())

if __name__ == '__main__':
    app.run(debug=True, port=5001)
