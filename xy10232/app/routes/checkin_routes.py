from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from app import db
from app.models import CheckinEvent, PatrolRoute, PatrolPoint, Caregiver, RoutePoint
from app.errors import CheckinError

checkin_bp = Blueprint('checkin', __name__)


@checkin_bp.route('', methods=['GET'])
def list_checkins():
    route_id = request.args.get('route_id', type=int)
    caregiver_id = request.args.get('caregiver_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = CheckinEvent.query
    
    if route_id:
        query = query.filter_by(route_id=route_id)
    if caregiver_id:
        query = query.filter_by(caregiver_id=caregiver_id)
    if start_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        query = query.filter(CheckinEvent.checkin_time >= start_dt)
    if end_date:
        end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        query = query.filter(CheckinEvent.checkin_time < end_dt)
    
    checkins = query.order_by(CheckinEvent.checkin_time.desc()).all()
    return jsonify({
        'success': True,
        'data': [c.to_dict() for c in checkins]
    })


@checkin_bp.route('/<int:checkin_id>', methods=['GET'])
def get_checkin(checkin_id):
    checkin = CheckinEvent.query.get_or_404(checkin_id)
    return jsonify({
        'success': True,
        'data': checkin.to_dict()
    })


@checkin_bp.route('', methods=['POST'])
def create_checkin():
    data = request.get_json()
    
    required_fields = ['route_id', 'point_id', 'caregiver_id']
    for field in required_fields:
        if not data.get(field):
            raise CheckinError(f'缺少必要字段: {field}')
    
    route = PatrolRoute.query.get(data['route_id'])
    if not route or route.status != 'active':
        raise CheckinError(
            '巡更路线不存在或未启用',
            {'route_id': data['route_id']}
        )
    
    point = PatrolPoint.query.get(data['point_id'])
    if not point:
        raise CheckinError(
            '巡更点不存在',
            {'point_id': data['point_id']}
        )
    
    caregiver = Caregiver.query.get(data['caregiver_id'])
    if not caregiver or caregiver.status != 'active':
        raise CheckinError(
            '护理员不存在或未激活',
            {'caregiver_id': data['caregiver_id']}
        )
    
    route_point = RoutePoint.query.filter_by(
        route_id=data['route_id'],
        point_id=data['point_id']
    ).first()
    
    if not route_point:
        raise CheckinError(
            '该巡更点不在此巡更路线中',
            {'route_id': data['route_id'], 'point_id': data['point_id']}
        )
    
    checkin_time_str = data.get('checkin_time')
    if checkin_time_str:
        try:
            checkin_time = datetime.strptime(checkin_time_str, '%Y-%m-%d %H:%M:%S')
        except ValueError:
            raise CheckinError('打卡时间格式错误，应为 YYYY-MM-DD HH:MM:SS')
    else:
        checkin_time = datetime.utcnow()
    
    checkin_type = data.get('checkin_type', 'normal')
    if checkin_type not in ['normal', 'supplement']:
        raise CheckinError(
            '无效的打卡类型',
            {'valid_types': ['normal', 'supplement']}
        )
    
    existing = CheckinEvent.query.filter_by(
        route_id=data['route_id'],
        point_id=data['point_id'],
        caregiver_id=data['caregiver_id']
    ).filter(
        CheckinEvent.checkin_time >= checkin_time - timedelta(hours=12),
        CheckinEvent.checkin_time <= checkin_time + timedelta(hours=12)
    ).first()
    
    if existing and checkin_type == 'normal':
        raise CheckinError(
            '该巡更点在此班次已打卡，如需修改请申请补录',
            {'existing_checkin_id': existing.id}
        )
    
    checkin = CheckinEvent(
        route_id=data['route_id'],
        point_id=data['point_id'],
        caregiver_id=data['caregiver_id'],
        checkin_time=checkin_time,
        checkin_type=checkin_type,
        status='completed',
        location_verified=data.get('location_verified', True),
        notes=data.get('notes', '')
    )
    
    db.session.add(checkin)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': checkin.to_dict(),
        'message': '打卡成功'
    }), 201


@checkin_bp.route('/batch', methods=['POST'])
def batch_checkin():
    data = request.get_json()
    checkins_data = data.get('checkins', [])
    
    if not checkins_data:
        raise CheckinError('批量打卡数据不能为空')
    
    results = []
    errors = []
    
    for idx, checkin_data in enumerate(checkins_data):
        try:
            required_fields = ['route_id', 'point_id', 'caregiver_id']
            for field in required_fields:
                if not checkin_data.get(field):
                    raise CheckinError(f'第 {idx+1} 条记录缺少字段: {field}')
            
            checkin_time_str = checkin_data.get('checkin_time')
            if checkin_time_str:
                checkin_time = datetime.strptime(checkin_time_str, '%Y-%m-%d %H:%M:%S')
            else:
                checkin_time = datetime.utcnow()
            
            checkin = CheckinEvent(
                route_id=checkin_data['route_id'],
                point_id=checkin_data['point_id'],
                caregiver_id=checkin_data['caregiver_id'],
                checkin_time=checkin_time,
                checkin_type=checkin_data.get('checkin_type', 'normal'),
                status='completed',
                location_verified=checkin_data.get('location_verified', True),
                notes=checkin_data.get('notes', '')
            )
            
            db.session.add(checkin)
            results.append({
                'index': idx + 1,
                'success': True,
                'checkin': checkin.to_dict()
            })
        except Exception as e:
            db.session.rollback()
            errors.append({
                'index': idx + 1,
                'success': False,
                'error': str(e)
            })
    
    if errors:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {
                'code': 'BATCH_CHECKIN_ERROR',
                'message': f'批量打卡失败，共 {len(errors)} 条记录出错',
                'details': {'errors': errors}
            }
        }), 400
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': results,
        'message': f'批量打卡成功，共 {len(results)} 条记录'
    }), 201
