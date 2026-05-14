from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import uuid
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
CORS(app)

# 数据存储
cart_db = {}
coupon_db = {}
trial_db = {}
mutex_rules = []
price_explanations = {}

# 状态枚举
STATUS_SUCCESS = 'success'
STATUS_PENDING_REVIEW = 'pending_review'
STATUS_BLOCKED = 'blocked'
STATUS_RETRYABLE = 'retryable'

# 初始化互斥规则
def init_mutex_rules():
    global mutex_rules
    mutex_rules = [
        {
            'rule_id': 'R001',
            'name': '满减与折扣互斥',
            'description': '满减优惠券和折扣优惠券不能同时使用',
            'coupon_types': ['fixed_amount', 'percentage'],
            'enabled': True
        },
        {
            'rule_id': 'R002',
            'name': '同类型优惠券互斥',
            'description': '相同类型的优惠券不能同时使用',
            'coupon_types': None,
            'same_type_only': True,
            'enabled': True
        }
    ]

# 初始化样例数据
def init_sample_data():
    global cart_db, coupon_db, trial_db
    
    cart1 = {
        'cart_id': 'CART001',
        'user_id': 'U001',
        'items': [
            {'item_id': 'I001', 'name': 'iPhone 15', 'price': 6999, 'quantity': 1},
            {'item_id': 'I002', 'name': 'AirPods Pro', 'price': 1899, 'quantity': 2}
        ],
        'total_original': 6999 + 1899 * 2,
        'created_at': datetime.now().isoformat()
    }
    cart_db['CART001'] = cart1
    
    coupon1 = {'coupon_id': 'CP001', 'name': '满5000减500', 'type': 'fixed_amount', 'value': 500, 'min_spend': 5000, 'enabled': True}
    coupon2 = {'coupon_id': 'CP002', 'name': '9折优惠券', 'type': 'percentage', 'value': 0.9, 'min_spend': 1000, 'enabled': True}
    coupon3 = {'coupon_id': 'CP003', 'name': '满3000减300', 'type': 'fixed_amount', 'value': 300, 'min_spend': 3000, 'enabled': True}
    coupon4 = {'coupon_id': 'CP004', 'name': '85折优惠券', 'type': 'percentage', 'value': 0.85, 'min_spend': 2000, 'enabled': True}
    coupon5 = {'coupon_id': 'CP005', 'name': '脏数据-无效类型', 'type': 'invalid_type', 'value': 100, 'min_spend': 0, 'enabled': True}
    
    coupon_db['CP001'] = coupon1
    coupon_db['CP002'] = coupon2
    coupon_db['CP003'] = coupon3
    coupon_db['CP004'] = coupon4
    coupon_db['CP005'] = coupon5

@app.route('/api/cart/<cart_id>', methods=['GET'])
def get_cart(cart_id):
    cart = cart_db.get(cart_id)
    if not cart:
        return jsonify({'error': 'Cart not found'}), 404
    return jsonify(cart)

@app.route('/api/coupon/<coupon_id>', methods=['GET'])
def get_coupon(coupon_id):
    coupon = coupon_db.get(coupon_id)
    if not coupon:
        return jsonify({'error': 'Coupon not found'}), 404
    return jsonify(coupon)

@app.route('/api/coupons', methods=['GET'])
def list_coupons():
    return jsonify(list(coupon_db.values()))

@app.route('/api/trial', methods=['POST'])
def create_trial():
    data = request.json
    cart_id = data.get('cart_id')
    coupon_ids = data.get('coupon_ids', [])
    
    if not cart_id or cart_id not in cart_db:
        return jsonify({'error': 'Invalid cart_id'}), 400
    
    cart = cart_db[cart_id]
    coupons = [coupon_db[cid] for cid in coupon_ids if cid in coupon_db]
    
    errors = []
    warnings = []
    status = STATUS_SUCCESS
    
    for cid in coupon_ids:
        if cid not in coupon_db:
            errors.append(f'优惠券 {cid} 不存在')
            status = STATUS_BLOCKED
    
    for coupon in coupons:
        if coupon['type'] not in ['fixed_amount', 'percentage']:
            errors.append(f'优惠券 {coupon["name"]} 类型无效')
            status = STATUS_BLOCKED
    
    if not errors:
        for rule in mutex_rules:
            if not rule.get('enabled', True):
                continue
                
            if rule.get('same_type_only'):
                type_counts = defaultdict(int)
                for coupon in coupons:
                    type_counts[coupon['type']] += 1
                for ctype, count in type_counts.items():
                    if count > 1:
                        errors.append(f'互斥规则违规: {rule["name"]} - 检测到 {count} 个 {ctype} 类型优惠券')
                        status = STATUS_BLOCKED
            elif rule.get('coupon_types'):
                matched_types = set()
                for coupon in coupons:
                    if coupon['type'] in rule['coupon_types']:
                        matched_types.add(coupon['type'])
                if len(matched_types) >= 2:
                    errors.append(f'互斥规则违规: {rule["name"]} - 不能同时使用 {", ".join(matched_types)} 类型优惠券')
                    status = STATUS_BLOCKED
    
    original_total = cart['total_original']
    final_total = original_total
    applied_coupons = []
    calculation_steps = []
    
    if status != STATUS_BLOCKED:
        current_total = original_total
        for coupon in coupons:
            if current_total >= coupon['min_spend']:
                if coupon['type'] == 'fixed_amount':
                    discount = coupon['value']
                    new_total = current_total - discount
                    calculation_steps.append({
                        'coupon': coupon['name'],
                        'type': 'fixed_amount',
                        'before': current_total,
                        'discount': discount,
                        'after': new_total
                    })
                    current_total = new_total
                    applied_coupons.append(coupon['coupon_id'])
                elif coupon['type'] == 'percentage':
                    discount = current_total * (1 - coupon['value'])
                    new_total = current_total * coupon['value']
                    calculation_steps.append({
                        'coupon': coupon['name'],
                        'type': 'percentage',
                        'before': current_total,
                        'discount': round(discount, 2),
                        'after': round(new_total, 2)
                    })
                    current_total = round(new_total, 2)
                    applied_coupons.append(coupon['coupon_id'])
            else:
                warnings.append(f'优惠券 {coupon["name"]} 未满足最低消费要求')
        
        final_total = current_total
    
    trial_id = f'TRIAL{uuid.uuid4().hex[:6].upper()}'
    trial = {
        'trial_id': trial_id,
        'cart_id': cart_id,
        'cart_snapshot': cart,
        'coupon_ids': coupon_ids,
        'coupons_snapshot': coupons,
        'original_total': original_total,
        'final_total': final_total,
        'applied_coupons': applied_coupons,
        'calculation_steps': calculation_steps,
        'status': status,
        'errors': errors,
        'warnings': warnings,
        'created_at': datetime.now().isoformat(),
        'rollback_history': []
    }
    
    trial_db[trial_id] = trial
    
    explanation_id = f'EXP{uuid.uuid4().hex[:6].upper()}'
    price_explanations[explanation_id] = {
        'explanation_id': explanation_id,
        'trial_id': trial_id,
        'original_total': original_total,
        'final_total': final_total,
        'total_discount': original_total - final_total,
        'calculation_steps': calculation_steps,
        'created_at': datetime.now().isoformat()
    }
    
    return jsonify({
        'trial_id': trial_id,
        'status': status,
        'original_total': original_total,
        'final_total': final_total,
        'errors': errors,
        'warnings': warnings,
        'explanation_id': explanation_id
    })

@app.route('/api/trial/<trial_id>', methods=['GET'])
def get_trial(trial_id):
    trial = trial_db.get(trial_id)
    if not trial:
        return jsonify({'error': 'Trial not found'}), 404
    return jsonify(trial)

@app.route('/api/trials', methods=['GET'])
def list_trials():
    return jsonify(list(trial_db.values()))

@app.route('/api/trial/<trial_id>/correct', methods=['POST'])
def correct_trial(trial_id):
    trial = trial_db.get(trial_id)
    if not trial:
        return jsonify({'error': 'Trial not found'}), 404
    
    data = request.json
    new_coupon_ids = data.get('coupon_ids', trial['coupon_ids'])
    manual_override = data.get('manual_override', False)
    operator = data.get('operator', 'system')
    
    previous_state = {
        'coupon_ids': trial['coupon_ids'],
        'final_total': trial['final_total'],
        'status': trial['status'],
        'errors': trial['errors'],
        'corrected_at': datetime.now().isoformat()
    }
    
    trial['rollback_history'].append(previous_state)
    
    cart = trial['cart_snapshot']
    coupons = [coupon_db[cid] for cid in new_coupon_ids if cid in coupon_db]
    
    errors = []
    warnings = []
    status = STATUS_SUCCESS
    
    if not manual_override:
        for rule in mutex_rules:
            if not rule.get('enabled', True):
                continue
            if rule.get('same_type_only'):
                type_counts = defaultdict(int)
                for coupon in coupons:
                    type_counts[coupon['type']] += 1
                for ctype, count in type_counts.items():
                    if count > 1:
                        errors.append(f'互斥规则违规: {rule["name"]}')
                        status = STATUS_PENDING_REVIEW
            elif rule.get('coupon_types'):
                matched_types = set()
                for coupon in coupons:
                    if coupon['type'] in rule['coupon_types']:
                        matched_types.add(coupon['type'])
                if len(matched_types) >= 2:
                    errors.append(f'互斥规则违规: {rule["name"]}')
                    status = STATUS_PENDING_REVIEW
    
    original_total = trial['original_total']
    final_total = original_total
    applied_coupons = []
    calculation_steps = []
    
    if not errors or manual_override:
        current_total = original_total
        status = STATUS_SUCCESS if manual_override else status
        for coupon in coupons:
            if current_total >= coupon['min_spend']:
                if coupon['type'] == 'fixed_amount':
                    discount = coupon['value']
                    new_total = current_total - discount
                    calculation_steps.append({
                        'coupon': coupon['name'],
                        'type': 'fixed_amount',
                        'before': current_total,
                        'discount': discount,
                        'after': new_total
                    })
                    current_total = new_total
                    applied_coupons.append(coupon['coupon_id'])
                elif coupon['type'] == 'percentage':
                    discount = current_total * (1 - coupon['value'])
                    new_total = current_total * coupon['value']
                    calculation_steps.append({
                        'coupon': coupon['name'],
                        'type': 'percentage',
                        'before': current_total,
                        'discount': round(discount, 2),
                        'after': round(new_total, 2)
                    })
                    current_total = round(new_total, 2)
                    applied_coupons.append(coupon['coupon_id'])
        
        final_total = current_total
    
    trial['coupon_ids'] = new_coupon_ids
    trial['coupons_snapshot'] = coupons
    trial['final_total'] = final_total
    trial['applied_coupons'] = applied_coupons
    trial['calculation_steps'] = calculation_steps
    trial['status'] = status
    trial['errors'] = errors if not manual_override else [f'人工强制通过，操作人: {operator}']
    trial['warnings'] = warnings
    trial['corrected_at'] = datetime.now().isoformat()
    trial['corrected_by'] = operator
    trial['manual_override'] = manual_override
    
    return jsonify({
        'trial_id': trial_id,
        'status': status,
        'original_total': original_total,
        'final_total': final_total,
        'errors': trial['errors'],
        'rollback_available': len(trial['rollback_history']) > 0
    })

@app.route('/api/trial/<trial_id>/rollback', methods=['POST'])
def rollback_trial(trial_id):
    trial = trial_db.get(trial_id)
    if not trial:
        return jsonify({'error': 'Trial not found'}), 404
    
    if len(trial['rollback_history']) == 0:
        return jsonify({'error': 'No rollback history available'}), 400
    
    previous_state = trial['rollback_history'].pop()
    
    trial['coupon_ids'] = previous_state['coupon_ids']
    trial['final_total'] = previous_state['final_total']
    trial['status'] = previous_state['status']
    trial['errors'] = previous_state['errors']
    trial['rolled_back_at'] = datetime.now().isoformat()
    
    return jsonify({
        'trial_id': trial_id,
        'status': trial['status'],
        'final_total': trial['final_total'],
        'remaining_rollbacks': len(trial['rollback_history'])
    })

@app.route('/api/explanation/<explanation_id>', methods=['GET'])
def get_explanation(explanation_id):
    explanation = price_explanations.get(explanation_id)
    if not explanation:
        return jsonify({'error': 'Explanation not found'}), 404
    return jsonify(explanation)

@app.route('/api/batch/import', methods=['POST'])
def batch_import():
    data = request.json
    trials = data.get('trials', [])
    results = []
    
    for trial_data in trials:
        try:
            resp = create_trial.__wrapped__(trial_data)
            results.append({
                'success': True,
                'data': resp.get_json()
            })
        except Exception as e:
            results.append({
                'success': False,
                'error': str(e)
            })
    
    return jsonify({
        'total': len(trials),
        'success': sum(1 for r in results if r['success']),
        'failed': sum(1 for r in results if not r['success']),
        'results': results
    })

@app.route('/api/rules', methods=['GET'])
def get_rules():
    return jsonify(mutex_rules)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    status_counts = defaultdict(int)
    for trial in trial_db.values():
        status_counts[trial['status']] += 1
    
    return jsonify({
        'total_trials': len(trial_db),
        'status_breakdown': dict(status_counts),
        'total_carts': len(cart_db),
        'total_coupons': len(coupon_db)
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    init_mutex_rules()
    init_sample_data()
    app.run(debug=True, host='0.0.0.0', port=5000)
