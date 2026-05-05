from flask import request, jsonify
from app.api import bp
from app import db
from app.models import Reservation, Room, Member, AuditLog
from datetime import datetime, timedelta
import random
import string
from flask import current_app

def generate_door_code(length=6):
    return ''.join(random.choices(string.digits, k=length))

def generate_unique_door_code():
    code = generate_door_code(current_app.config['DOOR_CODE_LENGTH'])
    while Reservation.query.filter_by(door_code=code).first():
        code = generate_door_code(current_app.config['DOOR_CODE_LENGTH'])
    return code

def parse_datetime(datetime_str):
    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']:
        try:
            return datetime.strptime(datetime_str, fmt)
        except ValueError:
            continue
    return None

def check_room_availability(room_id, start_time, end_time, exclude_reservation_id=None):
    query = Reservation.query.filter(
        Reservation.room_id == room_id,
        Reservation.is_cancelled == False
    )
    
    if exclude_reservation_id:
        query = query.filter(Reservation.id != exclude_reservation_id)
    
    conflicting_reservations = query.filter(
        Reservation.start_time < end_time,
        Reservation.end_time > start_time
    ).all()
    
    return len(conflicting_reservations) == 0

@bp.route('/reservations', methods=['GET'])
def get_reservations():
    reservations = Reservation.query.order_by(Reservation.start_time.desc()).all()
    return jsonify([reservation.to_dict() for reservation in reservations])

@bp.route('/reservations/<int:id>', methods=['GET'])
def get_reservation(id):
    reservation = Reservation.query.get_or_404(id)
    return jsonify(reservation.to_dict())

@bp.route('/reservations', methods=['POST'])
def create_reservation():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No input data'}), 400
    
    required_fields = ['member_id', 'room_id', 'start_time', 'end_time']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    member = Member.query.get(data['member_id'])
    if not member:
        return jsonify({'error': 'Member not found'}), 404
    
    if not member.is_active:
        return jsonify({'error': 'Member is not active'}), 400
    
    if member.remaining_times <= 0:
        return jsonify({'error': 'Member has no remaining times'}), 400
    
    room = Room.query.get(data['room_id'])
    if not room:
        return jsonify({'error': 'Room not found'}), 404
    
    if not room.is_active:
        return jsonify({'error': 'Room is not active'}), 400
    
    start_time = parse_datetime(data['start_time'])
    end_time = parse_datetime(data['end_time'])
    
    if not start_time or not end_time:
        return jsonify({'error': 'Invalid datetime format. Use YYYY-MM-DD HH:MM:SS or ISO format'}), 400
    
    if start_time >= end_time:
        return jsonify({'error': 'End time must be after start time'}), 400
    
    if start_time < datetime.utcnow():
        return jsonify({'error': 'Start time must be in the future'}), 400
    
    if not check_room_availability(room.id, start_time, end_time):
        return jsonify({'error': 'Room is not available during this time'}), 400
    
    door_code = generate_unique_door_code()
    
    reservation = Reservation(
        member_id=member.id,
        room_id=room.id,
        start_time=start_time,
        end_time=end_time,
        door_code=door_code,
        is_cancelled=False
    )
    
    db.session.add(reservation)
    db.session.commit()
    
    audit_log = AuditLog(
        member_id=member.id,
        room_id=room.id,
        reservation_id=reservation.id,
        action='CREATE_RESERVATION',
        result='SUCCESS',
        details=f"Created reservation for {member.name} in {room.name} from {start_time} to {end_time}. Door code: {door_code}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    try:
        from app.services.webhook import send_door_code_webhook
        send_door_code_webhook(reservation)
    except Exception as e:
        print(f"Webhook notification failed: {e}")
    
    return jsonify(reservation.to_dict()), 201

@bp.route('/reservations/<int:id>/cancel', methods=['POST'])
def cancel_reservation(id):
    reservation = Reservation.query.get_or_404(id)
    
    if reservation.is_cancelled:
        return jsonify({'error': 'Reservation is already cancelled'}), 400
    
    if reservation.check_in_time:
        return jsonify({'error': 'Cannot cancel a checked-in reservation'}), 400
    
    reservation.is_cancelled = True
    db.session.commit()
    
    member = reservation.member
    member.remaining_times += 1
    db.session.commit()
    
    audit_log = AuditLog(
        member_id=reservation.member_id,
        room_id=reservation.room_id,
        reservation_id=reservation.id,
        action='CANCEL_RESERVATION',
        result='SUCCESS',
        details=f"Cancelled reservation for {member.name} in {reservation.room.name}. Times returned to member."
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify(reservation.to_dict())

@bp.route('/reservations/<int:id>', methods=['DELETE'])
def delete_reservation(id):
    reservation = Reservation.query.get_or_404(id)
    
    if reservation.check_in_time:
        return jsonify({'error': 'Cannot delete a checked-in reservation'}), 400
    
    if not reservation.is_cancelled:
        member = reservation.member
        member.remaining_times += 1
    
    reservation_details = reservation.to_dict()
    db.session.delete(reservation)
    db.session.commit()
    
    audit_log = AuditLog(
        member_id=reservation.member_id,
        room_id=reservation.room_id,
        reservation_id=reservation.id,
        action='DELETE_RESERVATION',
        result='SUCCESS',
        details=f"Deleted reservation: {reservation_details}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify({'message': 'Reservation deleted successfully'}), 200
