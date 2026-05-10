from flask import Blueprint, request, jsonify
from datetime import datetime
from app import db
from app.models import PatrolRoute, RoutePoint, PatrolPoint, Caregiver
from app.errors import PatrolRouteError

routes_bp = Blueprint('routes', __name__)


@routes_bp.route('', methods=['GET'])
def list_routes():
    routes = PatrolRoute.query.all()
    return jsonify({
        'success': True,
        'data': [r.to_dict() for r in routes]
    })


@routes_bp.route('/<int:route_id>', methods=['GET'])
def get_route(route_id):
    route = PatrolRoute.query.get_or_404(route_id)
    return jsonify({
        'success': True,
        'data': route.to_dict()
    })


@routes_bp.route('', methods=['POST'])
def create_route():
    data = request.get_json()
    
    if not data.get('name'):
        raise PatrolRouteError('路线名称不能为空')
    
    if not data.get('shift_type'):
        raise PatrolRouteError('班次类型不能为空')
    
    if not data.get('start_time') or not data.get('end_time'):
        raise PatrolRouteError('开始和结束时间不能为空')
    
    try:
        start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        end_time = datetime.strptime(data['end_time'], '%H:%M').time()
    except ValueError:
        raise PatrolRouteError('时间格式错误，应为 HH:MM 格式')
    
    route = PatrolRoute(
        name=data['name'],
        description=data.get('description', ''),
        shift_type=data['shift_type'],
        start_time=start_time,
        end_time=end_time,
        status=data.get('status', 'active')
    )
    
    db.session.add(route)
    db.session.flush()
    
    points = data.get('points', [])
    for idx, point_data in enumerate(points):
        point = PatrolPoint.query.get(point_data['point_id'])
        if not point:
            db.session.rollback()
            raise PatrolRouteError(
                f'巡更点不存在: {point_data.get("point_id")}',
                {'point_id': point_data.get('point_id')}
            )
        
        route_point = RoutePoint(
            route_id=route.id,
            point_id=point_data['point_id'],
            order=idx + 1,
            required=point_data.get('required', True),
            tolerance_minutes=point_data.get('tolerance_minutes', 10)
        )
        db.session.add(route_point)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': route.to_dict(),
        'message': '巡更路线创建成功'
    }), 201


@routes_bp.route('/<int:route_id>', methods=['PUT'])
def update_route(route_id):
    route = PatrolRoute.query.get_or_404(route_id)
    data = request.get_json()
    
    if 'name' in data:
        route.name = data['name']
    if 'description' in data:
        route.description = data['description']
    if 'shift_type' in data:
        route.shift_type = data['shift_type']
    if 'status' in data:
        route.status = data['status']
    
    if 'start_time' in data:
        route.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
    if 'end_time' in data:
        route.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': route.to_dict(),
        'message': '巡更路线更新成功'
    })


@routes_bp.route('/<int:route_id>', methods=['DELETE'])
def delete_route(route_id):
    route = PatrolRoute.query.get_or_404(route_id)
    
    route.status = 'inactive'
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '巡更路线已停用'
    })


@routes_bp.route('/points', methods=['GET'])
def list_points():
    points = PatrolPoint.query.all()
    return jsonify({
        'success': True,
        'data': [p.to_dict() for p in points]
    })


@routes_bp.route('/points', methods=['POST'])
def create_point():
    data = request.get_json()
    
    if not data.get('name') or not data.get('code'):
        raise PatrolRouteError('巡更点名称和编码不能为空')
    
    existing = PatrolPoint.query.filter_by(code=data['code']).first()
    if existing:
        raise PatrolRouteError(
            f'巡更点编码已存在: {data["code"]}',
            {'code': data['code']}
        )
    
    point = PatrolPoint(
        name=data['name'],
        code=data['code'],
        location=data.get('location', ''),
        description=data.get('description', '')
    )
    
    db.session.add(point)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': point.to_dict(),
        'message': '巡更点创建成功'
    }), 201


@routes_bp.route('/caregivers', methods=['GET'])
def list_caregivers():
    caregivers = Caregiver.query.all()
    return jsonify({
        'success': True,
        'data': [c.to_dict() for c in caregivers]
    })


@routes_bp.route('/caregivers', methods=['POST'])
def create_caregiver():
    data = request.get_json()
    
    if not data.get('name') or not data.get('employee_id'):
        raise PatrolRouteError('护理员姓名和工号不能为空')
    
    existing = Caregiver.query.filter_by(employee_id=data['employee_id']).first()
    if existing:
        raise PatrolRouteError(
            f'员工工号已存在: {data["employee_id"]}',
            {'employee_id': data['employee_id']}
        )
    
    caregiver = Caregiver(
        name=data['name'],
        employee_id=data['employee_id'],
        phone=data.get('phone', ''),
        status=data.get('status', 'active')
    )
    
    db.session.add(caregiver)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': caregiver.to_dict(),
        'message': '护理员创建成功'
    }), 201
