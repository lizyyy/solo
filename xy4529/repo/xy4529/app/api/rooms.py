from flask import request, jsonify
from app.api import bp
from app import db
from app.models import Room, AuditLog
from datetime import datetime

@bp.route('/rooms', methods=['GET'])
def get_rooms():
    rooms = Room.query.all()
    return jsonify([room.to_dict() for room in rooms])

@bp.route('/rooms/<int:id>', methods=['GET'])
def get_room(id):
    room = Room.query.get_or_404(id)
    return jsonify(room.to_dict())

@bp.route('/rooms', methods=['POST'])
def create_room():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No input data'}), 400
    
    required_fields = ['name']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    if Room.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Room with this name already exists'}), 400
    
    room = Room(
        name=data['name'],
        description=data.get('description'),
        capacity=data.get('capacity', 1),
        equipment=data.get('equipment'),
        is_active=data.get('is_active', True)
    )
    
    db.session.add(room)
    db.session.commit()
    
    audit_log = AuditLog(
        action='CREATE_ROOM',
        result='SUCCESS',
        details=f"Created room: {room.name}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify(room.to_dict()), 201

@bp.route('/rooms/<int:id>', methods=['PUT'])
def update_room(id):
    room = Room.query.get_or_404(id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No input data'}), 400
    
    if 'name' in data:
        existing_room = Room.query.filter_by(name=data['name']).first()
        if existing_room and existing_room.id != id:
            return jsonify({'error': 'Room with this name already exists'}), 400
    
    updateable_fields = ['name', 'description', 'capacity', 'equipment', 'is_active']
    for field in updateable_fields:
        if field in data:
            setattr(room, field, data[field])
    
    db.session.commit()
    
    audit_log = AuditLog(
        action='UPDATE_ROOM',
        result='SUCCESS',
        details=f"Updated room: {room.name}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify(room.to_dict())

@bp.route('/rooms/<int:id>', methods=['DELETE'])
def delete_room(id):
    room = Room.query.get_or_404(id)
    
    if room.reservations.count() > 0:
        return jsonify({'error': 'Cannot delete room with existing reservations'}), 400
    
    room_name = room.name
    db.session.delete(room)
    db.session.commit()
    
    audit_log = AuditLog(
        action='DELETE_ROOM',
        result='SUCCESS',
        details=f"Deleted room: {room_name}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify({'message': 'Room deleted successfully'}), 200
