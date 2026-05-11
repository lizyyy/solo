from flask import Blueprint, request, jsonify
from app.services.equipment_service import EquipmentService
from app.services.exceptions import BusinessError

equipment_bp = Blueprint('equipment', __name__)


@equipment_bp.errorhandler(BusinessError)
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


@equipment_bp.route('/batches', methods=['POST'])
def create_batch():
    data = request.get_json()
    try:
        batch = EquipmentService.create_batch(data)
        return jsonify({
            'success': True,
            'data': batch.to_dict(),
            'message': '装备批次创建成功，待质检'
        }), 201
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/batches/<batch_no>', methods=['GET'])
def get_batch(batch_no):
    try:
        batch = EquipmentService.get_batch(batch_no)
        return jsonify({
            'success': True,
            'data': batch.to_dict()
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/batches/<batch_no>/inspect', methods=['POST'])
def inspect_batch(batch_no):
    data = request.get_json()
    try:
        batch = EquipmentService.inspect_batch(
            batch_no,
            data['inspector'],
            data['inspection_report'],
            data['is_qualified']
        )
        status_msg = '通过' if data['is_qualified'] else '不通过'
        return jsonify({
            'success': True,
            'data': batch.to_dict(),
            'message': f'装备批次质检{status_msg}'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/batches/<batch_no>/verify', methods=['POST'])
def verify_batch(batch_no):
    try:
        batch = EquipmentService.verify_batch_qualified(batch_no)
        return jsonify({
            'success': True,
            'data': {
                'batch_no': batch.batch_no,
                'equipment_type': batch.equipment_type,
                'status': batch.status,
                'is_qualified': batch.is_qualified()
            },
            'message': '装备批次验证通过，可以领用'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/batches/<batch_no>/details', methods=['GET'])
def get_batch_details(batch_no):
    try:
        details = EquipmentService.get_batch_verification_details(batch_no)
        return jsonify({
            'success': True,
            'data': details
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/batches', methods=['GET'])
def list_batches():
    status = request.args.get('status')
    equipment_type = request.args.get('equipment_type')
    batches = EquipmentService.list_batches(status, equipment_type)
    return jsonify({
        'success': True,
        'data': [b.to_dict() for b in batches]
    }), 200


@equipment_bp.route('/', methods=['POST'])
def create_equipment():
    data = request.get_json()
    try:
        equipment = EquipmentService.create_equipment(data)
        return jsonify({
            'success': True,
            'data': equipment.to_dict(),
            'message': '装备创建成功，当前在库'
        }), 201
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/<equipment_no>', methods=['GET'])
def get_equipment(equipment_no):
    try:
        equipment = EquipmentService.get_equipment(equipment_no)
        return jsonify({
            'success': True,
            'data': equipment.to_dict()
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/<equipment_no>/verify', methods=['POST'])
def verify_equipment(equipment_no):
    try:
        equipment = EquipmentService.verify_equipment_available(equipment_no)
        return jsonify({
            'success': True,
            'data': {
                'equipment_no': equipment.equipment_no,
                'equipment_type': equipment.equipment_type,
                'status': equipment.status,
                'is_available': equipment.is_available()
            },
            'message': '装备验证通过，当前可用'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@equipment_bp.route('/', methods=['GET'])
def list_equipment():
    batch_no = request.args.get('batch_no')
    status = request.args.get('status')
    equipment_type = request.args.get('equipment_type')
    equipments = EquipmentService.list_equipment(batch_no, status, equipment_type)
    return jsonify({
        'success': True,
        'data': [e.to_dict() for e in equipments]
    }), 200


@equipment_bp.route('/<equipment_no>/status', methods=['PUT'])
def update_equipment_status(equipment_no):
    data = request.get_json()
    try:
        equipment = EquipmentService.update_equipment_status(
            equipment_no,
            data['new_status']
        )
        return jsonify({
            'success': True,
            'data': equipment.to_dict(),
            'message': '装备状态更新成功'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)
