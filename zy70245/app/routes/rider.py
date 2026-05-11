from flask import Blueprint, request, jsonify
from app.services.rider_service import RiderService
from app.services.exceptions import BusinessError

rider_bp = Blueprint('rider', __name__)


@rider_bp.errorhandler(BusinessError)
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


@rider_bp.route('/', methods=['POST'])
def create_rider():
    data = request.get_json()
    try:
        rider = RiderService.create_rider(data)
        return jsonify({
            'success': True,
            'data': rider.to_dict(),
            'message': '骑手档案创建成功'
        }), 201
    except BusinessError as e:
        return handle_business_error(e)


@rider_bp.route('/<rider_id>', methods=['GET'])
def get_rider(rider_id):
    try:
        rider = RiderService.get_rider(rider_id)
        return jsonify({
            'success': True,
            'data': rider.to_dict()
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@rider_bp.route('/<rider_id>/verify', methods=['POST'])
def verify_rider(rider_id):
    try:
        rider = RiderService.verify_rider_active(rider_id)
        return jsonify({
            'success': True,
            'data': {
                'rider_id': rider.rider_id,
                'name': rider.name,
                'status': rider.status,
                'is_active': rider.is_active()
            },
            'message': '骑手档案验证通过，当前处于生效状态'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@rider_bp.route('/<rider_id>/activate', methods=['POST'])
def activate_rider(rider_id):
    try:
        rider = RiderService.activate_rider(rider_id)
        return jsonify({
            'success': True,
            'data': rider.to_dict(),
            'message': '骑手档案已激活'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@rider_bp.route('/<rider_id>/deactivate', methods=['POST'])
def deactivate_rider(rider_id):
    try:
        rider = RiderService.deactivate_rider(rider_id)
        return jsonify({
            'success': True,
            'data': rider.to_dict(),
            'message': '骑手档案已停用'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@rider_bp.route('/<rider_id>/resign', methods=['POST'])
def resign_rider(rider_id):
    try:
        if request.content_type == 'application/json':
            data = request.get_json() or {}
        else:
            data = {}
        rider = RiderService.resign_rider(rider_id, data.get('resignation_date'))
        return jsonify({
            'success': True,
            'data': rider.to_dict(),
            'message': '骑手离职办理完成'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)


@rider_bp.route('/', methods=['GET'])
def list_riders():
    status = request.args.get('status')
    station_id = request.args.get('station_id')
    riders = RiderService.list_riders(status, station_id)
    return jsonify({
        'success': True,
        'data': [r.to_dict() for r in riders]
    }), 200


@rider_bp.route('/<rider_id>/equipment-status', methods=['GET'])
def get_rider_equipment_status(rider_id):
    try:
        status = RiderService.get_rider_equipment_status(rider_id)
        return jsonify({
            'success': True,
            'data': status,
            'message': '骑手装备状态查询成功'
        }), 200
    except BusinessError as e:
        return handle_business_error(e)
