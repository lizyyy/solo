from flask import request, jsonify
from app.api import bp
from app import db
from app.models import Reservation, Room, Member, AuditLog
from datetime import datetime, timedelta
from flask import current_app

def is_within_time_window(reservation):
    now = datetime.utcnow()
    start_window = reservation.start_time - timedelta(minutes=current_app.config['DOOR_CODE_EXPIRE_MINUTES'])
    end_window = reservation.end_time + timedelta(minutes=current_app.config['DOOR_CODE_EXPIRE_MINUTES'])
    
    return start_window <= now <= end_window

@bp.route('/verify', methods=['POST'])
def verify_door_code():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No input data'}), 400
    
    required_fields = ['door_code', 'room_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    door_code = data['door_code']
    room_id = data['room_id']
    
    reservation = Reservation.query.filter_by(door_code=door_code).first()
    
    if not reservation:
        audit_log = AuditLog(
            room_id=room_id,
            action='VERIFY_DOOR_CODE',
            result='FAILED',
            details=f"Door code {door_code} not found for room {room_id}"
        )
        db.session.add(audit_log)
        db.session.commit()
        return jsonify({'error': 'Invalid door code', 'authorized': False}), 404
    
    if reservation.room_id != room_id:
        audit_log = AuditLog(
            member_id=reservation.member_id,
            room_id=room_id,
            reservation_id=reservation.id,
            action='VERIFY_DOOR_CODE',
            result='FAILED',
            details=f"Door code {door_code} is for room {reservation.room_id}, not {room_id}"
        )
        db.session.add(audit_log)
        db.session.commit()
        return jsonify({'error': 'Door code does not match this room', 'authorized': False}), 400
    
    if reservation.is_cancelled:
        audit_log = AuditLog(
            member_id=reservation.member_id,
            room_id=reservation.room_id,
            reservation_id=reservation.id,
            action='VERIFY_DOOR_CODE',
            result='FAILED',
            details=f"Reservation {reservation.id} has been cancelled"
        )
        db.session.add(audit_log)
        db.session.commit()
        return jsonify({'error': 'Reservation has been cancelled', 'authorized': False}), 400
    
    if reservation.check_in_time:
        audit_log = AuditLog(
            member_id=reservation.member_id,
            room_id=reservation.room_id,
            reservation_id=reservation.id,
            action='VERIFY_DOOR_CODE',
            result='FAILED',
            details=f"Door code {door_code} already used. Check-in time: {reservation.check_in_time}"
        )
        db.session.add(audit_log)
        db.session.commit()
        return jsonify({'error': 'Door code already used', 'authorized': False}), 400
    
    member = reservation.member
    if not member.is_active:
        audit_log = AuditLog(
            member_id=reservation.member_id,
            room_id=reservation.room_id,
            reservation_id=reservation.id,
            action='VERIFY_DOOR_CODE',
            result='FAILED',
            details=f"Member {member.name} is not active"
        )
        db.session.add(audit_log)
        db.session.commit()
        return jsonify({'error': 'Member is not active', 'authorized': False}), 400
    
    if member.remaining_times <= 0:
        audit_log = AuditLog(
            member_id=reservation.member_id,
            room_id=reservation.room_id,
            reservation_id=reservation.id,
            action='VERIFY_DOOR_CODE',
            result='FAILED',
            details=f"Member {member.name} has no remaining times"
        )
        db.session.add(audit_log)
        db.session.commit()
        return jsonify({'error': 'Member has no remaining times', 'authorized': False}), 400
    
    if not is_within_time_window(reservation):
        now = datetime.utcnow()
        audit_log = AuditLog(
            member_id=reservation.member_id,
            room_id=reservation.room_id,
            reservation_id=reservation.id,
            action='VERIFY_DOOR_CODE',
            result='FAILED',
            details=f"Verification time {now} is outside reservation window. Reservation: {reservation.start_time} - {reservation.end_time}"
        )
        db.session.add(audit_log)
        db.session.commit()
        return jsonify({'error': 'Verification time outside reservation window', 'authorized': False}), 400
    
    reservation.check_in_time = datetime.utcnow()
    member.remaining_times -= 1
    db.session.commit()
    
    audit_log = AuditLog(
        member_id=reservation.member_id,
        room_id=reservation.room_id,
        reservation_id=reservation.id,
        action='VERIFY_DOOR_CODE',
        result='SUCCESS',
        details=f"Door code {door_code} verified successfully for {member.name} in {reservation.room.name}. Check-in time: {reservation.check_in_time}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    try:
        from app.services.webhook import send_verification_webhook
        send_verification_webhook(reservation, member, True)
    except Exception as e:
        print(f"Webhook notification failed: {e}")
    
    return jsonify({
        'authorized': True,
        'reservation': reservation.to_dict(),
        'member': member.to_dict(),
        'room': reservation.room.to_dict()
    })

@bp.route('/audit-logs', methods=['GET'])
def get_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).all()
    return jsonify([log.to_dict() for log in logs])

@bp.route('/audit-logs/<int:id>', methods=['GET'])
def get_audit_log(id):
    log = AuditLog.query.get_or_404(id)
    return jsonify(log.to_dict())
