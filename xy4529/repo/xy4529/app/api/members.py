from flask import request, jsonify
from app.api import bp
from app import db
from app.models import Member, AuditLog
from datetime import datetime

@bp.route('/members', methods=['GET'])
def get_members():
    members = Member.query.all()
    return jsonify([member.to_dict() for member in members])

@bp.route('/members/<int:id>', methods=['GET'])
def get_member(id):
    member = Member.query.get_or_404(id)
    return jsonify(member.to_dict())

@bp.route('/members', methods=['POST'])
def create_member():
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No input data'}), 400
    
    required_fields = ['name', 'phone']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    if Member.query.filter_by(phone=data['phone']).first():
        return jsonify({'error': 'Member with this phone number already exists'}), 400
    
    member = Member(
        name=data['name'],
        phone=data['phone'],
        member_level=data.get('member_level', '普通会员'),
        remaining_times=data.get('remaining_times', 0),
        is_active=data.get('is_active', True)
    )
    
    db.session.add(member)
    db.session.commit()
    
    audit_log = AuditLog(
        action='CREATE_MEMBER',
        result='SUCCESS',
        details=f"Created member: {member.name}, Phone: {member.phone}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify(member.to_dict()), 201

@bp.route('/members/<int:id>', methods=['PUT'])
def update_member(id):
    member = Member.query.get_or_404(id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No input data'}), 400
    
    if 'phone' in data:
        existing_member = Member.query.filter_by(phone=data['phone']).first()
        if existing_member and existing_member.id != id:
            return jsonify({'error': 'Member with this phone number already exists'}), 400
    
    updateable_fields = ['name', 'phone', 'member_level', 'remaining_times', 'is_active']
    for field in updateable_fields:
        if field in data:
            setattr(member, field, data[field])
    
    db.session.commit()
    
    audit_log = AuditLog(
        action='UPDATE_MEMBER',
        result='SUCCESS',
        details=f"Updated member: {member.name}, Phone: {member.phone}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify(member.to_dict())

@bp.route('/members/<int:id>', methods=['DELETE'])
def delete_member(id):
    member = Member.query.get_or_404(id)
    
    if member.reservations.count() > 0:
        return jsonify({'error': 'Cannot delete member with existing reservations'}), 400
    
    member_name = member.name
    member_phone = member.phone
    db.session.delete(member)
    db.session.commit()
    
    audit_log = AuditLog(
        action='DELETE_MEMBER',
        result='SUCCESS',
        details=f"Deleted member: {member_name}, Phone: {member_phone}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify({'message': 'Member deleted successfully'}), 200

@bp.route('/members/<int:id>/add_times', methods=['POST'])
def add_member_times(id):
    member = Member.query.get_or_404(id)
    data = request.get_json()
    
    if not data or 'times' not in data:
        return jsonify({'error': 'Missing required field: times'}), 400
    
    times_to_add = data['times']
    if not isinstance(times_to_add, int) or times_to_add <= 0:
        return jsonify({'error': 'Times must be a positive integer'}), 400
    
    member.remaining_times += times_to_add
    db.session.commit()
    
    audit_log = AuditLog(
        action='ADD_MEMBER_TIMES',
        result='SUCCESS',
        details=f"Added {times_to_add} times to member: {member.name}. New balance: {member.remaining_times}"
    )
    db.session.add(audit_log)
    db.session.commit()
    
    return jsonify({
        'message': f'Added {times_to_add} times successfully',
        'remaining_times': member.remaining_times
    })
