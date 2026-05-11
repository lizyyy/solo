from flask import Blueprint, request, jsonify
from app.services.compensation_service import CompensationService
from app.services.exceptions import BusinessError

compensation_bp = Blueprint('compensation', __name__)


@compensation_bp.errorhandler(BusinessError)
def handle_business_error(error):
    response = {
        'success': False,
        'error': {
            'code': error.code,
            'message': error.message,
            'details': error.details
        }
    }
    return jsonify(response), error.http_code


@compensation_bp.route('/', methods=['POST'])
def create_compensation():
    data = request.get_json()
    try:
        compensation = CompensationService.create_compensation(data)
        return jsonify({
            'success': True,
            'data': compensation.to_dict(),
            'message': '赔付记录创建成功，待支付'
        }), 201
    except BusinessError as e:
        return handle_business_error(e)


@compensation_bp.route('/<compensation_no>', methods=['GET'])
def get_compensation(compensation_no):
    try:
        compensation = CompensationService.get_compensation(compensation_no)
        return jsonify({
            'success': True,
            'data': compensation.to_dict()
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@compensation_bp.route('/<compensation_no>/pay', methods=['POST'])
def mark_paid(compensation_no):
    data = request.get_json() or {}
    try:
        compensation = CompensationService.mark_paid(
            compensation_no,
            data.get('payment_method', 'cash')
        )
        return jsonify({
            'success': True,
            'data': compensation.to_dict(),
            'message': '赔付已完成'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@compensation_bp.route('/<compensation_no>/waive', methods=['POST'])
def waive_compensation(compensation_no):
    data = request.get_json()
    try:
        compensation = CompensationService.waive_compensation(
            compensation_no,
            data.get('reason', '未提供原因')
        )
        return jsonify({
            'success': True,
            'data': compensation.to_dict(),
            'message': '赔付已豁免'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@compensation_bp.route('/', methods=['GET'])
def list_compensations():
    rider_id = request.args.get('rider_id')
    status = request.args.get('status')
    reconciliation_status = request.args.get('reconciliation_status')
    compensations = CompensationService.list_compensations(
        rider_id, status, reconciliation_status
    )
    return jsonify({
        'success': True,
        'data': [c.to_dict() for c in compensations]
    }), 200


@compensation_bp.route('/<compensation_no>/reconcile', methods=['POST'])
def reconcile_compensation(compensation_no):
    data = request.get_json()
    try:
        compensation = CompensationService.reconcile_compensation(
            compensation_no,
            data['is_valid'],
            data.get('remarks')
        )
        status_msg = '有效' if data['is_valid'] else '存在差异'
        return jsonify({
            'success': True,
            'data': compensation.to_dict(),
            'message': f'赔付记录对账{status_msg}'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@compensation_bp.route('/reconciliation', methods=['GET'])
def get_reconciliation_report():
    report = CompensationService.get_compensation_reconciliation_report()
    return jsonify({
        'success': True,
        'data': report,
        'message': '赔付对账报告生成完成'
    }), 200
