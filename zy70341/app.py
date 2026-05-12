from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from config import Config
from models import db
from services import (
    create_risk_event,
    add_to_graylist,
    evaluate_transaction,
    review_user,
    check_auto_expire,
    get_user_risk_timeline,
    get_graylist_detail,
    get_daily_stats,
    get_all_daily_stats,
    RISK_TYPE_CONFIG,
    DEFAULT_SINGLE_LIMIT,
    DEFAULT_DAILY_LIMIT
)

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

with app.app_context():
    db.create_all()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'time': datetime.utcnow().isoformat()})

@app.route('/api/v1/risk-events', methods=['POST'])
def api_create_risk_event():
    data = request.get_json()
    required = ['event_id', 'user_id', 'risk_type']
    for field in required:
        if field not in data:
            return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400
    
    result = create_risk_event(data)
    status_code = 200 if result['is_duplicate'] else 201
    return jsonify(result), status_code

@app.route('/api/v1/graylist', methods=['POST'])
def api_add_to_graylist():
    data = request.get_json()
    if 'user_id' not in data:
        return jsonify({'success': False, 'error': '缺少必填字段: user_id'}), 400
    
    custom_config = {}
    if 'single_transaction_limit' in data:
        custom_config['single_transaction_limit'] = data['single_transaction_limit']
    if 'daily_transaction_limit' in data:
        custom_config['daily_transaction_limit'] = data['daily_transaction_limit']
    if 'expires_at' in data:
        custom_config['expires_at'] = datetime.fromisoformat(data['expires_at'])
    if 'auto_expire' in data:
        custom_config['auto_expire'] = data['auto_expire']
    
    result = add_to_graylist(
        user_id=data['user_id'],
        trigger_event_id=data.get('trigger_event_id'),
        reason=data.get('reason'),
        custom_config=custom_config if custom_config else None
    )
    
    status_code = 200 if result.get('updated') else 201
    return jsonify(result), status_code if result['success'] else 400

@app.route('/api/v1/transactions/evaluate', methods=['POST'])
def api_evaluate_transaction():
    data = request.get_json()
    required = ['user_id', 'amount']
    for field in required:
        if field not in data:
            return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400
    
    try:
        amount = float(data['amount'])
        if amount < 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': '金额必须为非负数'}), 400
    
    transaction_time = None
    if 'transaction_time' in data:
        transaction_time = datetime.fromisoformat(data['transaction_time'])
    
    result = evaluate_transaction(
        user_id=data['user_id'],
        amount=amount,
        transaction_time=transaction_time
    )
    
    return jsonify({'success': True, 'data': result})

@app.route('/api/v1/users/<user_id>/review', methods=['POST'])
def api_review_user(user_id):
    data = request.get_json()
    if 'decision' not in data:
        return jsonify({'success': False, 'error': '缺少必填字段: decision'}), 400
    
    result = review_user(
        user_id=user_id,
        decision=data['decision'],
        reviewer_id=data.get('reviewer_id'),
        remark=data.get('remark'),
        evidence=data.get('evidence')
    )
    
    return jsonify(result), 200 if result['success'] else 400

@app.route('/api/v1/users/<user_id>/risk-timeline', methods=['GET'])
def api_get_user_risk_timeline(user_id):
    result = get_user_risk_timeline(user_id)
    return jsonify({'success': True, 'data': result})

@app.route('/api/v1/graylist/<user_id>', methods=['GET'])
def api_get_graylist_detail(user_id):
    result = get_graylist_detail(user_id)
    return jsonify(result), 200 if result['success'] else 404

@app.route('/api/v1/stats/daily', methods=['GET'])
def api_get_daily_stats():
    date_str = request.args.get('date')
    if date_str:
        d = datetime.strptime(date_str, '%Y-%m-%d').date()
        result = get_daily_stats(d)
    else:
        result = get_daily_stats()
    return jsonify(result)

@app.route('/api/v1/stats/daily/range', methods=['GET'])
def api_get_daily_stats_range():
    start_str = request.args.get('start')
    end_str = request.args.get('end')
    
    start_date = datetime.strptime(start_str, '%Y-%m-%d').date() if start_str else None
    end_date = datetime.strptime(end_str, '%Y-%m-%d').date() if end_str else None
    
    result = get_all_daily_stats(start_date, end_date)
    return jsonify(result)

@app.route('/api/v1/auto-expire/check', methods=['POST'])
def api_check_auto_expire():
    result = check_auto_expire()
    return jsonify({'success': True, 'data': result})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
