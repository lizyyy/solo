from flask import Blueprint, request, jsonify
from app.models import Meter, MeterReading, Bill, AbnormalRecord, BillStatus
from app.services import (
    create_meter, submit_reading, submit_estimated_reading,
    update_estimated_to_actual, review_abnormal,
    generate_bill, issue_bill, pay_bill, correct_bill, reissue_bill,
    get_meter_history, get_bill_history, generate_report,
    meter_to_dict, reading_to_dict, bill_to_dict, abnormal_to_dict
)

main_bp = Blueprint('main', __name__)

@main_bp.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'name': '水电抄表纠错 API',
        'version': '1.0.0'
    })

@main_bp.route('/api/meters', methods=['POST'])
def create_meter_endpoint():
    try:
        data = request.get_json()
        meter = create_meter(data)
        return jsonify({
            'success': True,
            'data': meter_to_dict(meter),
            'message': '表计创建成功'
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/meters', methods=['GET'])
def list_meters():
    meters = Meter.query.order_by(Meter.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [meter_to_dict(m) for m in meters]
    })

@main_bp.route('/api/meters/<int:meter_id>', methods=['GET'])
def get_meter(meter_id):
    meter = Meter.query.get(meter_id)
    if not meter:
        return jsonify({'success': False, 'message': '表计不存在'}), 404
    return jsonify({
        'success': True,
        'data': meter_to_dict(meter)
    })

@main_bp.route('/api/meters/<int:meter_id>/history', methods=['GET'])
def get_meter_history_endpoint(meter_id):
    try:
        history = get_meter_history(meter_id)
        return jsonify({
            'success': True,
            'data': history
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/meters/<int:meter_id>/readings', methods=['POST'])
def submit_reading_endpoint(meter_id):
    try:
        data = request.get_json()
        result = submit_reading(meter_id, data)
        return jsonify(result), 200 if result['success'] else 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/meters/<int:meter_id>/estimated-reading', methods=['POST'])
def submit_estimated_reading_endpoint(meter_id):
    try:
        data = request.get_json() or {}
        result = submit_estimated_reading(meter_id, data)
        return jsonify(result), 200 if result['success'] else 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/meters/<int:meter_id>/update-estimated', methods=['POST'])
def update_estimated_to_actual_endpoint(meter_id):
    try:
        data = request.get_json()
        if not data.get('billing_period'):
            return jsonify({
                'success': False,
                'message': '必须提供计费周期'
            }), 400
        result = update_estimated_to_actual(meter_id, data['billing_period'], data)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/meters/<int:meter_id>/readings', methods=['GET'])
def list_readings(meter_id):
    readings = MeterReading.query.filter_by(meter_id=meter_id).order_by(MeterReading.reading_time.desc()).all()
    return jsonify({
        'success': True,
        'data': [reading_to_dict(r) for r in readings]
    })

@main_bp.route('/api/abnormals', methods=['GET'])
def list_abnormals():
    status = request.args.get('status')
    query = AbnormalRecord.query
    if status:
        query = query.filter_by(status=status)
    abnormals = query.order_by(AbnormalRecord.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [abnormal_to_dict(a) for a in abnormals]
    })

@main_bp.route('/api/abnormals/<int:abnormal_id>/review', methods=['POST'])
def review_abnormal_endpoint(abnormal_id):
    try:
        data = request.get_json()
        result = review_abnormal(abnormal_id, data)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/bills', methods=['POST'])
def generate_bill_endpoint():
    try:
        data = request.get_json()
        if not data.get('meter_id') or not data.get('billing_period'):
            return jsonify({
                'success': False,
                'message': '必须提供表计ID和计费周期'
            }), 400
        result = generate_bill(data['meter_id'], data['billing_period'], data)
        return jsonify(result), 200 if result['success'] else 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/bills', methods=['GET'])
def list_bills():
    status = request.args.get('status')
    meter_id = request.args.get('meter_id')
    billing_period = request.args.get('billing_period')
    
    query = Bill.query
    if status:
        query = query.filter_by(status=status)
    if meter_id:
        query = query.filter_by(meter_id=int(meter_id))
    if billing_period:
        query = query.filter_by(billing_period=billing_period)
    
    bills = query.order_by(Bill.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [bill_to_dict(b) for b in bills]
    })

@main_bp.route('/api/bills/<int:bill_id>', methods=['GET'])
def get_bill(bill_id):
    bill = Bill.query.get(bill_id)
    if not bill:
        return jsonify({'success': False, 'message': '账单不存在'}), 404
    return jsonify({
        'success': True,
        'data': bill_to_dict(bill)
    })

@main_bp.route('/api/bills/<int:bill_id>/history', methods=['GET'])
def get_bill_history_endpoint(bill_id):
    try:
        history = get_bill_history(bill_id)
        return jsonify({
            'success': True,
            'data': history
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/bills/<int:bill_id>/issue', methods=['POST'])
def issue_bill_endpoint(bill_id):
    try:
        data = request.get_json() or {}
        result = issue_bill(bill_id, data)
        return jsonify(result), 200 if result['success'] else 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/bills/<int:bill_id>/pay', methods=['POST'])
def pay_bill_endpoint(bill_id):
    try:
        data = request.get_json() or {}
        result = pay_bill(bill_id, data)
        return jsonify(result), 200 if result['success'] else 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/bills/<int:bill_id>/correct', methods=['POST'])
def correct_bill_endpoint(bill_id):
    try:
        data = request.get_json()
        result = correct_bill(bill_id, data)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/bills/<int:bill_id>/reissue', methods=['POST'])
def reissue_bill_endpoint(bill_id):
    try:
        data = request.get_json()
        result = reissue_bill(bill_id, data)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@main_bp.route('/api/report', methods=['GET'])
def generate_report_endpoint():
    billing_period = request.args.get('billing_period')
    report = generate_report(billing_period)
    return jsonify({
        'success': True,
        'data': report
    })

@main_bp.route('/api/export/report', methods=['GET'])
def export_report():
    billing_period = request.args.get('billing_period')
    report = generate_report(billing_period)
    
    lines = []
    lines.append('=' * 60)
    lines.append('水电抄表收费报告')
    lines.append('=' * 60)
    lines.append(f'计费周期: {report["billing_period"]}')
    lines.append('')
    lines.append('--- 汇总统计 ---')
    s = report['summary']
    lines.append(f'总账单数: {s["total_bills"]}')
    lines.append(f'总金额: ¥{s["total_amount"]}')
    lines.append(f'已缴费金额: ¥{s["paid_amount"]} ({s["paid_count"]}笔)')
    lines.append(f'未缴费金额: ¥{s["unpaid_amount"]} ({s["unpaid_count"]}笔)')
    lines.append(f'估读账单: {s["estimated_bills_count"]}笔')
    lines.append(f'已修正账单: {s["corrected_bills_count"]}笔')
    lines.append(f'待处理异常: {s["pending_abnormals_count"]}笔')
    lines.append('')
    lines.append('--- 账单明细 ---')
    for b in report['bill_details']:
        lines.append(f'  账单号: {b["bill_no"]}')
        lines.append(f'    表计: {b["meter_no"]} ({b["customer_name"]})')
        lines.append(f'    周期: {b["billing_period"]}')
        lines.append(f'    读数: {b["previous_reading"]} → {b["current_reading"]} = {b["usage"]}')
        lines.append(f'    单价: ¥{b["unit_price"]} | 金额: ¥{b["amount"]}')
        lines.append(f'    状态: {b["status"]} | 估读: {b["is_estimated"]}')
        for c in b['corrections']:
            lines.append(f'    [修正] {c["reason"]}: ¥{c["old_amount"]} → ¥{c["new_amount"]} ({c["operator"]})')
        lines.append('')
    lines.append('')
    lines.append('--- 异常记录 ---')
    for a in report['abnormal_details']:
        lines.append(f'  ID: {a["id"]} | 类型: {a["abnormal_type"]}')
        lines.append(f'    表计: {a["meter_no"]} | 状态: {a["status"]}')
        lines.append(f'    描述: {a["description"]}')
        if a['review_remark']:
            lines.append(f'    复核: {a["reviewer"]} - {a["review_remark"]}')
        for h in a['history']:
            lines.append(f'    [历史] {h["time"]}: {h["old_status"]} → {h["new_status"]} ({h["operator"]})')
        lines.append('')
    
    return '\n'.join(lines), 200, {'Content-Type': 'text/plain; charset=utf-8'}

@main_bp.errorhandler(404)
def not_found(e):
    return jsonify({
        'success': False,
        'message': 'API端点不存在'
    }), 404

@main_bp.errorhandler(500)
def server_error(e):
    return jsonify({
        'success': False,
        'message': f'服务器错误: {str(e)}'
    }), 500
