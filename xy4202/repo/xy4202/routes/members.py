from flask import Blueprint, request, jsonify
from extensions import db
from models.models import Member
from datetime import datetime

members = Blueprint('members', __name__)

def generate_member_number():
    current_year = datetime.now().year
    last_member = Member.query.order_by(Member.id.desc()).first()
    next_id = 1 if not last_member else last_member.id + 1
    return f"M{current_year}{next_id:04d}"

@members.route('/', methods=['GET'])
def get_members():
    member_list = Member.query.all()
    return jsonify([m.to_dict() for m in member_list]), 200

@members.route('/<int:member_id>', methods=['GET'])
def get_member(member_id):
    member = Member.query.get_or_404(member_id)
    return jsonify(member.to_dict()), 200

@members.route('/', methods=['POST'])
def create_member():
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': '会员姓名不能为空'}), 400
    
    # 自动生成会员编号
    member_number = data.get('member_number') or generate_member_number()
    
    # 检查会员编号是否已存在
    existing = Member.query.filter_by(member_number=member_number).first()
    if existing:
        return jsonify({'error': '会员编号已存在'}), 400
    
    member = Member(
        member_number=member_number,
        name=data['name'],
        id_card=data.get('id_card'),
        phone=data.get('phone'),
        address=data.get('address'),
        gender=data.get('gender'),
        birth_date=datetime.strptime(data['birth_date'], '%Y-%m-%d').date() if data.get('birth_date') else None,
        is_blacklisted=data.get('is_blacklisted', False),
        blacklist_reason=data.get('blacklist_reason')
    )
    
    db.session.add(member)
    db.session.commit()
    
    return jsonify(member.to_dict()), 201

@members.route('/<int:member_id>', methods=['PUT'])
def update_member(member_id):
    member = Member.query.get_or_404(member_id)
    data = request.get_json()
    
    if 'name' in data:
        member.name = data['name']
    if 'phone' in data:
        member.phone = data['phone']
    if 'address' in data:
        member.address = data['address']
    if 'is_blacklisted' in data:
        member.is_blacklisted = data['is_blacklisted']
    if 'blacklist_reason' in data:
        member.blacklist_reason = data['blacklist_reason']
    
    db.session.commit()
    
    return jsonify(member.to_dict()), 200

@members.route('/<int:member_id>', methods=['DELETE'])
def delete_member(member_id):
    member = Member.query.get_or_404(member_id)
    
    db.session.delete(member)
    db.session.commit()
    
    return jsonify({'message': '会员已删除'}), 200

@members.route('/blacklist', methods=['GET'])
def get_blacklisted_members():
    blacklisted = Member.query.filter_by(is_blacklisted=True).all()
    return jsonify([m.to_dict() for m in blacklisted]), 200
