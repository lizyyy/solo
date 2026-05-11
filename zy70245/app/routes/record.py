from flask import Blueprint, request, jsonify
from app.services.record_service import RecordService
from app.services.exceptions import BusinessError

record_bp = Blueprint('record', __name__)


@record_bp.errorhandler(BusinessError)
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


@record_bp.route('/issue', methods=['POST'])
def create_issue_record():
    data = request.get_json()
    try:
        record = RecordService.create_issue_record(data)
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': '领用记录创建成功，待签收确认'
        }), 201
    except BusinessError as e:
        return handle_business_error(e)


@record_bp.route('/return', methods=['POST'])
def create_return_record():
    data = request.get_json()
    try:
        record = RecordService.create_return_record(data)
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': '归还记录创建成功，待确认'
        }), 201
    except BusinessError as e:
        return handle_business_error(e)


@record_bp.route('/<record_no>', methods=['GET'])
def get_record(record_no):
    try:
        record = RecordService.get_record(record_no)
        return jsonify({
            'success': True,
            'data': record.to_dict()
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@record_bp.route('/<record_no>/confirm', methods=['POST'])
def confirm_record(record_no):
    data = request.get_json()
    try:
        record = RecordService.confirm_record(record_no, data['signature'])
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': '记录确认成功'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@record_bp.route('/<record_no>/reject', methods=['POST'])
def reject_record(record_no):
    data = request.get_json()
    try:
        record = RecordService.reject_record(record_no, data.get('reason', '未提供原因'))
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': '记录已拒绝'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@record_bp.route('/', methods=['GET'])
def list_records():
    rider_id = request.args.get('rider_id')
    record_type = request.args.get('record_type')
    status = request.args.get('status')
    records = RecordService.list_records(rider_id, record_type, status)
    return jsonify({
        'success': True,
        'data': [r.to_dict() for r in records]
    }), 200


@record_bp.route('/<record_no>/verify', methods=['POST'])
def verify_record(record_no):
    try:
        verification = RecordService.verify_record_consistency(record_no)
        return jsonify({
            'success': True,
            'data': verification,
            'message': '记录一致性验证完成'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@record_bp.route('/reconciliation', methods=['GET'])
def get_reconciliation_report():
    report = RecordService.get_reconciliation_report()
    return jsonify({
        'success': True,
        'data': report,
        'message': '对账报告生成完成'
    }), 200
