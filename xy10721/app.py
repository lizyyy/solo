from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime, timedelta
from collections import defaultdict

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
FINGERPRINTS_FILE = os.path.join(DATA_DIR, 'fingerprints.json')
ALERTS_FILE = os.path.join(DATA_DIR, 'alerts.json')
MERGE_RULES_FILE = os.path.join(DATA_DIR, 'merge_rules.json')
REVIEWS_FILE = os.path.join(DATA_DIR, 'reviews.json')

os.makedirs(DATA_DIR, exist_ok=True)

def load_json(file_path, default=None):
    if default is None:
        default = []
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default

def save_json(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def init_data():
    if not os.path.exists(FINGERPRINTS_FILE):
        fingerprints = [
            {
                "id": "fp_001",
                "name": "支付超时错误",
                "pattern": "Payment timeout after 30s",
                "module": "支付模块",
                "created_at": "2024-01-15T10:00:00",
                "owner": "张工"
            },
            {
                "id": "fp_002",
                "name": "用户登录失败",
                "pattern": "Login failed: invalid credentials",
                "module": "用户模块",
                "created_at": "2024-01-15T11:00:00",
                "owner": "李工"
            },
            {
                "id": "fp_003",
                "name": "数据库连接超时",
                "pattern": "DB connection timeout",
                "module": "数据库",
                "created_at": "2024-01-15T12:00:00",
                "owner": "王工"
            }
        ]
        save_json(FINGERPRINTS_FILE, fingerprints)
    
    if not os.path.exists(ALERTS_FILE):
        alerts = [
            {
                "id": "alert_001",
                "fingerprint_id": "fp_001",
                "timestamp": "2024-01-16T08:30:00",
                "affected_users": 15,
                "message": "Payment timeout after 30s - Order #12345",
                "merged": False,
                "silent_window_failed": True,
                "reviewed": False
            },
            {
                "id": "alert_002",
                "fingerprint_id": "fp_001",
                "timestamp": "2024-01-16T08:35:00",
                "affected_users": 8,
                "message": "Payment timeout after 30s - Order #12346",
                "merged": True,
                "silent_window_failed": False,
                "reviewed": False
            },
            {
                "id": "alert_003",
                "fingerprint_id": "fp_001",
                "timestamp": "2024-01-16T08:40:00",
                "affected_users": 22,
                "message": "Payment timeout after 30s - Order #12347",
                "merged": True,
                "silent_window_failed": False,
                "reviewed": False
            },
            {
                "id": "alert_004",
                "fingerprint_id": "fp_002",
                "timestamp": "2024-01-16T09:00:00",
                "affected_users": 5,
                "message": "Login failed: invalid credentials - User #789",
                "merged": False,
                "silent_window_failed": False,
                "reviewed": False
            },
            {
                "id": "alert_005",
                "fingerprint_id": "fp_002",
                "timestamp": "2024-01-16T09:15:00",
                "affected_users": 3,
                "message": "Login failed: invalid credentials - User #790",
                "merged": True,
                "silent_window_failed": False,
                "reviewed": False
            },
            {
                "id": "alert_006",
                "fingerprint_id": "fp_003",
                "timestamp": "2024-01-16T10:00:00",
                "affected_users": 50,
                "message": "DB connection timeout - User query failed",
                "merged": False,
                "silent_window_failed": True,
                "reviewed": False
            },
            {
                "id": "alert_007",
                "fingerprint_id": "fp_003",
                "timestamp": "2024-01-16T10:05:00",
                "affected_users": 45,
                "message": "DB connection timeout - Product query failed",
                "merged": True,
                "silent_window_failed": True,
                "reviewed": False
            },
            {
                "id": "alert_008",
                "fingerprint_id": "fp_003",
                "timestamp": "2024-01-16T10:10:00",
                "affected_users": 38,
                "message": "DB connection timeout - Cart update failed",
                "merged": True,
                "silent_window_failed": True,
                "reviewed": False
            }
        ]
        save_json(ALERTS_FILE, alerts)
    
    if not os.path.exists(MERGE_RULES_FILE):
        merge_rules = [
            {
                "id": "rule_001",
                "fingerprint_id": "fp_001",
                "name": "支付超时合并规则",
                "time_window_minutes": 10,
                "max_affected_users": 20,
                "auto_merge": True,
                "created_at": "2024-01-15T14:00:00",
                "status": "active"
            },
            {
                "id": "rule_002",
                "fingerprint_id": "fp_002",
                "name": "登录失败合并规则",
                "time_window_minutes": 15,
                "max_affected_users": 10,
                "auto_merge": True,
                "created_at": "2024-01-15T15:00:00",
                "status": "active"
            },
            {
                "id": "rule_003",
                "fingerprint_id": "fp_003",
                "name": "数据库超时合并规则",
                "time_window_minutes": 5,
                "max_affected_users": 30,
                "auto_merge": False,
                "created_at": "2024-01-15T16:00:00",
                "status": "requires_attention"
            }
        ]
        save_json(MERGE_RULES_FILE, merge_rules)
    
    if not os.path.exists(REVIEWS_FILE):
        reviews = [
            {
                "id": "review_001",
                "alert_id": "alert_001",
                "fingerprint_id": "fp_001",
                "handler": "客服主管-陈经理",
                "reason": "静默窗口超时，支付系统第三方接口波动",
                "action_taken": "已通知支付团队排查，建议增加重试机制",
                "resolution": "问题已定位，第三方接口恢复正常",
                "reviewed_at": "2024-01-16T11:00:00",
                "follow_up_required": True
            }
        ]
        save_json(REVIEWS_FILE, reviews)

init_data()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/fingerprints', methods=['GET', 'POST'])
def fingerprints():
    if request.method == 'GET':
        data = load_json(FINGERPRINTS_FILE)
        return jsonify(data)
    else:
        new_fp = request.json
        new_fp['id'] = f"fp_{int(datetime.now().timestamp())}"
        new_fp['created_at'] = datetime.now().isoformat()
        data = load_json(FINGERPRINTS_FILE)
        data.append(new_fp)
        save_json(FINGERPRINTS_FILE, data)
        return jsonify(new_fp), 201

@app.route('/api/alerts', methods=['GET', 'POST'])
def alerts():
    if request.method == 'GET':
        data = load_json(ALERTS_FILE)
        return jsonify(data)
    else:
        new_alert = request.json
        new_alert['id'] = f"alert_{int(datetime.now().timestamp())}"
        new_alert['timestamp'] = datetime.now().isoformat()
        data = load_json(ALERTS_FILE)
        data.append(new_alert)
        save_json(ALERTS_FILE, data)
        return jsonify(new_alert), 201

@app.route('/api/alerts/<alert_id>', methods=['PUT'])
def update_alert(alert_id):
    data = load_json(ALERTS_FILE)
    for i, alert in enumerate(data):
        if alert['id'] == alert_id:
            old_affected = alert.get('affected_users', 0)
            data[i].update(request.json)
            save_json(ALERTS_FILE, data)
            
            new_affected = data[i].get('affected_users', 0)
            if old_affected != new_affected:
                recalculate_merges(data[i]['fingerprint_id'])
            
            return jsonify(data[i])
    return jsonify({"error": "Alert not found"}), 404

@app.route('/api/merge-rules', methods=['GET', 'POST'])
def merge_rules():
    if request.method == 'GET':
        data = load_json(MERGE_RULES_FILE)
        return jsonify(data)
    else:
        new_rule = request.json
        new_rule['id'] = f"rule_{int(datetime.now().timestamp())}"
        new_rule['created_at'] = datetime.now().isoformat()
        data = load_json(MERGE_RULES_FILE)
        data.append(new_rule)
        save_json(MERGE_RULES_FILE, data)
        return jsonify(new_rule), 201

@app.route('/api/merge-rules/<rule_id>', methods=['PUT'])
def update_merge_rule(rule_id):
    data = load_json(MERGE_RULES_FILE)
    for i, rule in enumerate(data):
        if rule['id'] == rule_id:
            data[i].update(request.json)
            save_json(MERGE_RULES_FILE, data)
            recalculate_merges(rule.get('fingerprint_id'))
            return jsonify(data[i])
    return jsonify({"error": "Rule not found"}), 404

@app.route('/api/reviews', methods=['GET', 'POST'])
def reviews():
    if request.method == 'GET':
        data = load_json(REVIEWS_FILE)
        return jsonify(data)
    else:
        new_review = request.json
        new_review['id'] = f"review_{int(datetime.now().timestamp())}"
        new_review['reviewed_at'] = datetime.now().isoformat()
        data = load_json(REVIEWS_FILE)
        data.append(new_review)
        save_json(REVIEWS_FILE, data)
        
        alerts = load_json(ALERTS_FILE)
        for alert in alerts:
            if alert['id'] == new_review.get('alert_id'):
                alert['reviewed'] = True
        save_json(ALERTS_FILE, alerts)
        
        return jsonify(new_review), 201

def recalculate_merges(fingerprint_id=None):
    alerts = load_json(ALERTS_FILE)
    rules = load_json(MERGE_RULES_FILE)
    
    rule_map = {r['fingerprint_id']: r for r in rules}
    
    for alert in alerts:
        if fingerprint_id and alert['fingerprint_id'] != fingerprint_id:
            continue
            
        rule = rule_map.get(alert['fingerprint_id'])
        if rule:
            affected = alert.get('affected_users', 0)
            threshold = rule.get('max_affected_users', 100)
            
            if affected > threshold:
                alert['silent_window_failed'] = True
                alert['merged'] = False
            else:
                alert['silent_window_failed'] = False
    
    save_json(ALERTS_FILE, alerts)

@app.route('/api/statistics')
def statistics():
    alerts = load_json(ALERTS_FILE)
    fingerprints = load_json(FINGERPRINTS_FILE)
    reviews = load_json(REVIEWS_FILE)
    
    total_alerts = len(alerts)
    merged_alerts = sum(1 for a in alerts if a['merged'])
    silent_failed = sum(1 for a in alerts if a['silent_window_failed'])
    reviewed = sum(1 for a in alerts if a['reviewed'])
    
    by_fingerprint = defaultdict(lambda: {"count": 0, "affected_users": 0})
    for alert in alerts:
        by_fingerprint[alert['fingerprint_id']]['count'] += 1
        by_fingerprint[alert['fingerprint_id']]['affected_users'] += alert.get('affected_users', 0)
    
    fp_map = {fp['id']: fp['name'] for fp in fingerprints}
    fingerprint_stats = []
    for fp_id, stats in by_fingerprint.items():
        fingerprint_stats.append({
            "fingerprint_id": fp_id,
            "fingerprint_name": fp_map.get(fp_id, "Unknown"),
            "alert_count": stats['count'],
            "total_affected_users": stats['affected_users']
        })
    
    return jsonify({
        "summary": {
            "total_alerts": total_alerts,
            "merged_alerts": merged_alerts,
            "silent_window_failed": silent_failed,
            "reviewed": reviewed,
            "total_affected_users": sum(a.get('affected_users', 0) for a in alerts)
        },
        "by_fingerprint": fingerprint_stats
    })

@app.route('/api/recalculate', methods=['POST'])
def trigger_recalculate():
    recalculate_merges()
    return jsonify({"message": "重新计算完成"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
