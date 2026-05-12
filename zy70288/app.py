from flask import Flask, request, jsonify
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import json
import os

app = Flask(__name__)

DATA_DIR = 'data'
os.makedirs(DATA_DIR, exist_ok=True)

def load_data(filename, default):
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default

def save_data(filename, data):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

tenants = load_data('tenants.json', {})
energy_readings = load_data('energy_readings.json', {})
area_rules = load_data('area_rules.json', {})
bills = load_data('bills.json', {})
disputes = load_data('disputes.json', {})
audit_logs = load_data('audit_logs.json', [])

def generate_id(prefix):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"{prefix}-{timestamp}"

def log_audit(action, details):
    audit_logs.append({
        'timestamp': datetime.now().isoformat(),
        'action': action,
        'details': details
    })
    save_data('audit_logs.json', audit_logs)

def validate_required_fields(data, required_fields):
    missing = [field for field in required_fields if field not in data or not data[field]]
    if missing:
        return {'error': f'缺少必填字段: {", ".join(missing)}', 'missing_fields': missing}, 400
    return None

@app.route('/api/tenants', methods=['POST'])
def create_tenant():
    data = request.json
    validation = validate_required_fields(data, ['tenant_id', 'tenant_name', 'floor', 'area', 'start_date'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    tenant_id = data['tenant_id']
    if tenant_id in tenants:
        return jsonify({'error': '租户ID已存在', 'tenant_id': tenant_id}), 409
    
    tenant = {
        'tenant_id': tenant_id,
        'tenant_name': data['tenant_name'],
        'floor': data['floor'],
        'area': data['area'],
        'start_date': data['start_date'],
        'end_date': data.get('end_date'),
        'contact_person': data.get('contact_person'),
        'contact_phone': data.get('contact_phone'),
        'status': 'active',
        'created_at': datetime.now().isoformat()
    }
    
    tenants[tenant_id] = tenant
    save_data('tenants.json', tenants)
    log_audit('create_tenant', {'tenant_id': tenant_id})
    
    return jsonify({'message': '租户创建成功', 'tenant': tenant}), 201

@app.route('/api/tenants', methods=['GET'])
def get_tenants():
    return jsonify({'tenants': list(tenants.values())})

@app.route('/api/tenants/<tenant_id>', methods=['GET'])
def get_tenant(tenant_id):
    if tenant_id not in tenants:
        return jsonify({'error': '租户不存在', 'tenant_id': tenant_id}), 404
    return jsonify(tenants[tenant_id])

@app.route('/api/tenants/<tenant_id>', methods=['PUT'])
def update_tenant(tenant_id):
    if tenant_id not in tenants:
        return jsonify({'error': '租户不存在', 'tenant_id': tenant_id}), 404
    
    data = request.json
    tenant = tenants[tenant_id]
    
    if 'tenant_name' in data:
        tenant['tenant_name'] = data['tenant_name']
    if 'floor' in data:
        tenant['floor'] = data['floor']
    if 'area' in data:
        tenant['area'] = data['area']
    if 'start_date' in data:
        tenant['start_date'] = data['start_date']
    if 'end_date' in data:
        tenant['end_date'] = data['end_date']
    if 'contact_person' in data:
        tenant['contact_person'] = data['contact_person']
    if 'contact_phone' in data:
        tenant['contact_phone'] = data['contact_phone']
    if 'status' in data:
        tenant['status'] = data['status']
    
    tenant['updated_at'] = datetime.now().isoformat()
    save_data('tenants.json', tenants)
    log_audit('update_tenant', {'tenant_id': tenant_id, 'changes': data})
    
    return jsonify({'message': '租户更新成功', 'tenant': tenant})

@app.route('/api/energy-readings', methods=['POST'])
def create_energy_reading():
    data = request.json
    validation = validate_required_fields(data, ['type', 'period_start', 'period_end', 'total_consumption', 'total_cost'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    energy_type = data['type']
    period_start = data['period_start']
    period_end = data['period_end']
    
    existing_key = f"{energy_type}_{period_start}_{period_end}"
    if existing_key in energy_readings:
        return jsonify({
            'error': '该时段能耗读数已存在，如需修改请使用更新接口',
            'existing_reading': energy_readings[existing_key]
        }), 409
    
    reading_id = generate_id('ER')
    reading = {
        'reading_id': reading_id,
        'type': energy_type,
        'period_start': period_start,
        'period_end': period_end,
        'total_consumption': data['total_consumption'],
        'total_cost': data['total_cost'],
        'unit_price': data.get('unit_price', data['total_cost'] / data['total_consumption'] if data['total_consumption'] > 0 else 0),
        'source': data.get('source', 'manual'),
        'status': 'pending_allocation',
        'created_at': datetime.now().isoformat()
    }
    
    energy_readings[existing_key] = reading
    save_data('energy_readings.json', energy_readings)
    log_audit('create_energy_reading', {'reading_id': reading_id, 'type': energy_type})
    
    return jsonify({'message': '能耗读数创建成功', 'reading': reading}), 201

@app.route('/api/energy-readings', methods=['GET'])
def get_energy_readings():
    return jsonify({'readings': list(energy_readings.values())})

@app.route('/api/area-rules', methods=['POST'])
def create_area_rule():
    data = request.json
    validation = validate_required_fields(data, ['floor', 'public_area_ratio', 'air_conditioning_ratio', 'elevator_ratio', 'lighting_ratio'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    floor = data['floor']
    if floor in area_rules:
        return jsonify({'error': '该楼层面积规则已存在', 'floor': floor}), 409
    
    rule = {
        'floor': floor,
        'public_area_ratio': data['public_area_ratio'],
        'air_conditioning_ratio': data['air_conditioning_ratio'],
        'elevator_ratio': data['elevator_ratio'],
        'lighting_ratio': data['lighting_ratio'],
        'description': data.get('description'),
        'effective_date': data.get('effective_date', datetime.now().strftime('%Y-%m-%d')),
        'created_at': datetime.now().isoformat()
    }
    
    area_rules[floor] = rule
    save_data('area_rules.json', area_rules)
    log_audit('create_area_rule', {'floor': floor})
    
    return jsonify({'message': '面积规则创建成功', 'rule': rule}), 201

@app.route('/api/area-rules', methods=['GET'])
def get_area_rules():
    return jsonify({'rules': list(area_rules.values())})

@app.route('/api/area-rules/<floor>', methods=['GET'])
def get_area_rule(floor):
    if floor not in area_rules:
        return jsonify({'error': '该楼层面积规则不存在', 'floor': floor}), 404
    return jsonify(area_rules[floor])

def calculate_month_usage_ratio(tenant, period_start, period_end):
    try:
        start = datetime.strptime(period_start, '%Y-%m-%d')
        end = datetime.strptime(period_end, '%Y-%m-%d')
        tenant_start = datetime.strptime(tenant['start_date'], '%Y-%m-%d')
        tenant_end = datetime.strptime(tenant['end_date'], '%Y-%m-%d') if tenant.get('end_date') else end + timedelta(days=1)
        
        if tenant_start > end or tenant_end <= start:
            return 0
        
        actual_start = max(start, tenant_start)
        actual_end = min(end, tenant_end)
        total_days = (end - start).days
        usage_days = (actual_end - actual_start).days
        
        return usage_days / total_days if total_days > 0 else 1
    except:
        return 1

def get_total_tenant_area(floor):
    return sum(t['area'] for t in tenants.values() if t['floor'] == floor and t['status'] == 'active')

def get_floor_area_rule(floor):
    if floor in area_rules:
        return area_rules[floor]
    
    total_floors = len(area_rules) if area_rules else 1
    default_ratio = 1 / total_floors
    
    return {
        'floor': floor,
        'public_area_ratio': 0.1,
        'air_conditioning_ratio': default_ratio,
        'elevator_ratio': default_ratio,
        'lighting_ratio': default_ratio
    }

@app.route('/api/allocate', methods=['POST'])
def allocate_energy():
    data = request.json
    validation = validate_required_fields(data, ['reading_id', 'month'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    reading_id = data['reading_id']
    month = data['month']
    
    reading = None
    for r in energy_readings.values():
        if r['reading_id'] == reading_id:
            reading = r
            break
    
    if not reading:
        return jsonify({'error': '能耗读数不存在', 'reading_id': reading_id}), 404
    
    if reading['status'] == 'allocated':
        return jsonify({
            'error': '该能耗读数已完成分摊，禁止重复分摊',
            'reading': reading
        }), 400
    
    energy_type = reading['type']
    period_start = reading['period_start']
    period_end = reading['period_end']
    total_cost = reading['total_cost']
    
    active_tenants = [t for t in tenants.values() if t['status'] == 'active']
    
    if not active_tenants:
        return jsonify({'error': '没有活跃租户，无法分摊'}), 400
    
    allocations = []
    total_area = sum(t['area'] for t in active_tenants)
    
    for tenant in active_tenants:
        floor_rule = get_floor_area_rule(tenant['floor'])
        area_ratio = tenant['area'] / total_area if total_area > 0 else 0
        usage_ratio = calculate_month_usage_ratio(tenant, period_start, period_end)
        
        type_ratio = {
            'air_conditioning': floor_rule['air_conditioning_ratio'],
            'elevator': floor_rule['elevator_ratio'],
            'lighting': floor_rule['lighting_ratio']
        }.get(energy_type, 1.0)
        
        public_ratio = floor_rule['public_area_ratio']
        
        private_cost = total_cost * (1 - public_ratio) * area_ratio * usage_ratio
        public_cost = total_cost * public_ratio * type_ratio * usage_ratio
        
        tenant_total_cost = private_cost + public_cost
        tenant_consumption = reading['total_consumption'] * (tenant_total_cost / total_cost) if total_cost > 0 else 0
        
        allocation = {
            'tenant_id': tenant['tenant_id'],
            'tenant_name': tenant['tenant_name'],
            'floor': tenant['floor'],
            'area': tenant['area'],
            'area_ratio': area_ratio,
            'usage_ratio': usage_ratio,
            'type_ratio': type_ratio,
            'private_cost': round(private_cost, 2),
            'public_cost': round(public_cost, 2),
            'total_cost': round(tenant_total_cost, 2),
            'consumption': round(tenant_consumption, 4)
        }
        
        allocations.append(allocation)
    
    allocation_result = {
        'allocation_id': generate_id('AL'),
        'reading_id': reading_id,
        'energy_type': energy_type,
        'month': month,
        'period_start': period_start,
        'period_end': period_end,
        'total_cost': total_cost,
        'allocations': allocations,
        'status': 'draft',
        'created_at': datetime.now().isoformat()
    }
    
    reading['status'] = 'allocated'
    reading['allocation_id'] = allocation_result['allocation_id']
    
    save_data('energy_readings.json', energy_readings)
    log_audit('allocate_energy', {'reading_id': reading_id, 'allocation_id': allocation_result['allocation_id']})
    
    return jsonify({'message': '分摊计算成功', 'allocation': allocation_result}), 201

@app.route('/api/bills', methods=['POST'])
def create_bill():
    data = request.json
    validation = validate_required_fields(data, ['tenant_id', 'month', 'items'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    tenant_id = data['tenant_id']
    month = data['month']
    
    if tenant_id not in tenants:
        return jsonify({'error': '租户不存在', 'tenant_id': tenant_id}), 404
    
    bill_id = generate_id('BL')
    tenant = tenants[tenant_id]
    
    total_amount = sum(item['amount'] for item in data['items'])
    
    bill = {
        'bill_id': bill_id,
        'tenant_id': tenant_id,
        'tenant_name': tenant['tenant_name'],
        'month': month,
        'items': data['items'],
        'total_amount': round(total_amount, 2),
        'status': 'draft',
        'created_at': datetime.now().isoformat()
    }
    
    bills[bill_id] = bill
    save_data('bills.json', bills)
    log_audit('create_bill', {'bill_id': bill_id, 'tenant_id': tenant_id})
    
    return jsonify({'message': '账单创建成功', 'bill': bill}), 201

@app.route('/api/bills', methods=['GET'])
def get_bills():
    tenant_id = request.args.get('tenant_id')
    month = request.args.get('month')
    
    filtered = list(bills.values())
    if tenant_id:
        filtered = [b for b in filtered if b['tenant_id'] == tenant_id]
    if month:
        filtered = [b for b in filtered if b['month'] == month]
    
    return jsonify({'bills': filtered})

@app.route('/api/bills/<bill_id>', methods=['GET'])
def get_bill(bill_id):
    if bill_id not in bills:
        return jsonify({'error': '账单不存在', 'bill_id': bill_id}), 404
    return jsonify(bills[bill_id])

@app.route('/api/bills/<bill_id>/status', methods=['PUT'])
def update_bill_status(bill_id):
    if bill_id not in bills:
        return jsonify({'error': '账单不存在', 'bill_id': bill_id}), 404
    
    data = request.json
    validation = validate_required_fields(data, ['status'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    bill = bills[bill_id]
    old_status = bill['status']
    new_status = data['status']
    
    valid_transitions = {
        'draft': ['pending_review', 'cancelled'],
        'pending_review': ['approved', 'rejected', 'disputed'],
        'approved': ['sent', 'disputed'],
        'rejected': ['draft'],
        'sent': ['paid', 'disputed', 'overdue'],
        'disputed': ['resolved', 'pending_review'],
        'resolved': ['approved'],
        'paid': [],
        'overdue': ['paid'],
        'cancelled': []
    }
    
    if new_status not in valid_transitions.get(old_status, []):
        return jsonify({
            'error': '非法状态流转',
            'current_status': old_status,
            'requested_status': new_status,
            'allowed_transitions': valid_transitions.get(old_status, [])
        }), 400
    
    bill['status'] = new_status
    bill['status_updated_at'] = datetime.now().isoformat()
    
    if 'reason' in data:
        bill['status_reason'] = data['reason']
    
    save_data('bills.json', bills)
    log_audit('update_bill_status', {'bill_id': bill_id, 'from': old_status, 'to': new_status})
    
    return jsonify({'message': '状态更新成功', 'bill': bill})

@app.route('/api/disputes', methods=['POST'])
def create_dispute():
    data = request.json
    validation = validate_required_fields(data, ['bill_id', 'tenant_id', 'reason'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    bill_id = data['bill_id']
    tenant_id = data['tenant_id']
    
    if bill_id not in bills:
        return jsonify({'error': '账单不存在', 'bill_id': bill_id}), 404
    
    bill = bills[bill_id]
    if bill['tenant_id'] != tenant_id:
        return jsonify({'error': '该账单不属于该租户', 'bill_id': bill_id, 'tenant_id': tenant_id}), 400
    
    dispute_id = generate_id('DP')
    dispute = {
        'dispute_id': dispute_id,
        'bill_id': bill_id,
        'tenant_id': tenant_id,
        'tenant_name': bill['tenant_name'],
        'month': bill['month'],
        'reason': data['reason'],
        'description': data.get('description'),
        'evidence': data.get('evidence', []),
        'status': 'open',
        'created_at': datetime.now().isoformat()
    }
    
    disputes[dispute_id] = dispute
    save_data('disputes.json', disputes)
    
    bill['status'] = 'disputed'
    save_data('bills.json', bills)
    
    log_audit('create_dispute', {'dispute_id': dispute_id, 'bill_id': bill_id})
    
    return jsonify({'message': '争议已创建', 'dispute': dispute}), 201

@app.route('/api/disputes', methods=['GET'])
def get_disputes():
    tenant_id = request.args.get('tenant_id')
    status = request.args.get('status')
    
    filtered = list(disputes.values())
    if tenant_id:
        filtered = [d for d in filtered if d['tenant_id'] == tenant_id]
    if status:
        filtered = [d for d in filtered if d['status'] == status]
    
    return jsonify({'disputes': filtered})

@app.route('/api/disputes/<dispute_id>', methods=['PUT'])
def resolve_dispute(dispute_id):
    if dispute_id not in disputes:
        return jsonify({'error': '争议不存在', 'dispute_id': dispute_id}), 404
    
    data = request.json
    validation = validate_required_fields(data, ['resolution', 'resolved_by'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    dispute = disputes[dispute_id]
    dispute['resolution'] = data['resolution']
    dispute['resolved_by'] = data['resolved_by']
    dispute['resolution_notes'] = data.get('notes')
    dispute['resolved_at'] = datetime.now().isoformat()
    dispute['status'] = 'resolved'
    
    save_data('disputes.json', disputes)
    
    bill = bills[dispute['bill_id']]
    bill['status'] = 'resolved'
    save_data('bills.json', bills)
    
    log_audit('resolve_dispute', {'dispute_id': dispute_id, 'bill_id': dispute['bill_id']})
    
    return jsonify({'message': '争议已处理', 'dispute': dispute})

@app.route('/api/manual-correction', methods=['POST'])
def manual_correction():
    data = request.json
    validation = validate_required_fields(data, ['bill_id', 'correction_type', 'correction_value', 'reason', 'approved_by'])
    if validation:
        return jsonify(validation[0]), validation[1]
    
    bill_id = data['bill_id']
    if bill_id not in bills:
        return jsonify({'error': '账单不存在', 'bill_id': bill_id}), 404
    
    bill = bills[bill_id]
    
    correction = {
        'correction_id': generate_id('MC'),
        'type': data['correction_type'],
        'value': data['correction_value'],
        'reason': data['reason'],
        'approved_by': data['approved_by'],
        'timestamp': datetime.now().isoformat()
    }
    
    if 'corrections' not in bill:
        bill['corrections'] = []
    bill['corrections'].append(correction)
    
    if data['correction_type'] == 'amount_adjustment':
        bill['total_amount'] += data['correction_value']
        bill['total_amount'] = round(bill['total_amount'], 2)
    
    bill['status'] = 'pending_review'
    bill['last_correction'] = correction
    
    save_data('bills.json', bills)
    log_audit('manual_correction', {'bill_id': bill_id, 'correction': correction})
    
    return jsonify({'message': '人工修正已应用', 'bill': bill}), 201

@app.route('/api/export/<bill_id>', methods=['GET'])
def export_bill(bill_id):
    if bill_id not in bills:
        return jsonify({'error': '账单不存在', 'bill_id': bill_id}), 404
    
    bill = bills[bill_id]
    tenant = tenants.get(bill['tenant_id'], {})
    
    export_data = {
        'export_date': datetime.now().isoformat(),
        'bill': bill,
        'tenant_info': tenant,
        'disputes': [d for d in disputes.values() if d['bill_id'] == bill_id]
    }
    
    return jsonify(export_data)

@app.route('/api/audit-logs', methods=['GET'])
def get_audit_logs():
    return jsonify({'logs': audit_logs[-100:]})

@app.route('/api/reset', methods=['POST'])
def reset_data():
    global tenants, energy_readings, area_rules, bills, disputes, audit_logs
    tenants = {}
    energy_readings = {}
    area_rules = {}
    bills = {}
    disputes = {}
    audit_logs = []
    
    save_data('tenants.json', tenants)
    save_data('energy_readings.json', energy_readings)
    save_data('area_rules.json', area_rules)
    save_data('bills.json', bills)
    save_data('disputes.json', disputes)
    save_data('audit_logs.json', audit_logs)
    
    return jsonify({'message': '数据已重置'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
