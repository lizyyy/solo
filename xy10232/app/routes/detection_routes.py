from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, date
from app import db
from app.models import MissedPatrol, PatrolRoute, PatrolPoint, Caregiver, CheckinEvent, RoutePoint
from app.errors import DetectionError

detection_bp = Blueprint('detection', __name__)


def get_shift_type_by_time(checkin_time):
    hour = checkin_time.hour
    if 0 <= hour < 8:
        return 'night'
    elif 8 <= hour < 16:
        return 'day'
    else:
        return 'evening'


@detection_bp.route('', methods=['GET'])
def list_missed_patrols():
    status = request.args.get('status')
    caregiver_id = request.args.get('caregiver_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = MissedPatrol.query
    
    if status:
        query = query.filter_by(status=status)
    if caregiver_id:
        query = query.filter_by(caregiver_id=caregiver_id)
    if start_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
        query = query.filter(MissedPatrol.shift_date >= start_dt)
    if end_date:
        end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
        query = query.filter(MissedPatrol.shift_date <= end_dt)
    
    missed = query.order_by(MissedPatrol.shift_date.desc()).all()
    return jsonify({
        'success': True,
        'count': len(missed),
        'data': [m.to_dict() for m in missed]
    })


@detection_bp.route('/<int:missed_id>', methods=['GET'])
def get_missed_patrol(missed_id):
    missed = MissedPatrol.query.get_or_404(missed_id)
    return jsonify({
        'success': True,
        'data': missed.to_dict()
    })


@detection_bp.route('/detect', methods=['POST'])
def detect_missed_patrols():
    data = request.get_json()
    
    route_id = data.get('route_id')
    caregiver_id = data.get('caregiver_id')
    shift_date_str = data.get('shift_date')
    
    if not route_id:
        raise DetectionError('缺少巡更路线ID')
    
    if not shift_date_str:
        raise DetectionError('缺少巡更日期')
    
    try:
        shift_date = datetime.strptime(shift_date_str, '%Y-%m-%d').date()
    except ValueError:
        raise DetectionError('日期格式错误，应为 YYYY-MM-DD')
    
    route = PatrolRoute.query.get(route_id)
    if not route or route.status != 'active':
        raise DetectionError(
            '巡更路线不存在或未启用',
            {'route_id': route_id}
        )
    
    if caregiver_id:
        caregivers = [Caregiver.query.get(caregiver_id)]
        if not caregivers[0]:
            raise DetectionError('护理员不存在', {'caregiver_id': caregiver_id})
    else:
        caregivers = Caregiver.query.filter_by(status='active').all()
    
    results = []
    
    for caregiver in caregivers:
        route_points = RoutePoint.query.filter_by(
            route_id=route_id,
            required=True
        ).all()
        
        for route_point in route_points:
            start_dt = datetime.combine(shift_date, route.start_time)
            end_dt = datetime.combine(shift_date, route.end_time)
            
            if route.start_time > route.end_time:
                end_dt += timedelta(days=1)
            
            existing_checkin = CheckinEvent.query.filter(
                CheckinEvent.route_id == route_id,
                CheckinEvent.point_id == route_point.point_id,
                CheckinEvent.caregiver_id == caregiver.id,
                CheckinEvent.checkin_time >= start_dt,
                CheckinEvent.checkin_time <= end_dt
            ).first()
            
            if not existing_checkin:
                existing_missed = MissedPatrol.query.filter_by(
                    route_id=route_id,
                    point_id=route_point.point_id,
                    caregiver_id=caregiver.id,
                    shift_date=shift_date
                ).first()
                
                if not existing_missed:
                    expected_time = datetime.combine(shift_date, route.start_time)
                    shift_type = get_shift_type_by_time(expected_time)
                    
                    missed = MissedPatrol(
                        route_id=route_id,
                        point_id=route_point.point_id,
                        caregiver_id=caregiver.id,
                        shift_date=shift_date,
                        expected_time=expected_time,
                        status='confirmed',
                        responsibility_shift=f'{shift_date.strftime("%Y-%m-%d")} {route.shift_type}'
                    )
                    db.session.add(missed)
                    results.append(missed.to_dict())
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'count': len(results),
        'data': results,
        'message': f'漏巡检测完成，发现 {len(results)} 条漏巡记录'
    })


@detection_bp.route('/<int:missed_id>/appeal', methods=['POST'])
def appeal_missed_patrol(missed_id):
    data = request.get_json()
    notes = data.get('notes', '')
    
    missed = MissedPatrol.query.get_or_404(missed_id)
    
    try:
        missed.transition_to('appealed', notes)
    except Exception as e:
        db.session.rollback()
        raise DetectionError(str(e))
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': missed.to_dict(),
        'message': '已提交申诉，等待复核'
    })


@detection_bp.route('/<int:missed_id>/resolve', methods=['POST'])
def resolve_missed_patrol(missed_id):
    data = request.get_json()
    notes = data.get('notes', '')
    
    missed = MissedPatrol.query.get_or_404(missed_id)
    
    try:
        missed.transition_to('resolved', notes)
    except Exception as e:
        db.session.rollback()
        raise DetectionError(str(e))
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': missed.to_dict(),
        'message': '漏巡记录已处理完成'
    })


@detection_bp.route('/stats', methods=['GET'])
def get_detection_stats():
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    query = MissedPatrol.query
    
    if start_date_str:
        start_dt = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        query = query.filter(MissedPatrol.shift_date >= start_dt)
    if end_date_str:
        end_dt = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        query = query.filter(MissedPatrol.shift_date <= end_dt)
    
    all_missed = query.all()
    
    stats = {
        'total': len(all_missed),
        'by_status': {
            'confirmed': 0,
            'appealed': 0,
            'resolved': 0
        },
        'by_caregiver': {},
        'by_route': {}
    }
    
    for missed in all_missed:
        stats['by_status'][missed.status] = stats['by_status'].get(missed.status, 0) + 1
        
        caregiver_name = missed.caregiver.name if missed.caregiver else 'Unknown'
        stats['by_caregiver'][caregiver_name] = stats['by_caregiver'].get(caregiver_name, 0) + 1
        
        route_name = missed.route.name if missed.route else 'Unknown'
        stats['by_route'][route_name] = stats['by_route'].get(route_name, 0) + 1
    
    return jsonify({
        'success': True,
        'data': stats
    })
