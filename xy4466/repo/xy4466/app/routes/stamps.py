from flask import request, jsonify
from app.routes import api
from app import db
from app.models import Stamp
from datetime import datetime
import json

@api.route('/stamps', methods=['GET'])
def get_stamps():
    """获取印章列表，支持筛选"""
    status = request.args.get('status')
    stamp_code = request.args.get('stamp_code')
    stamp_name = request.args.get('stamp_name')
    stamp_type = request.args.get('stamp_type')
    
    query = Stamp.query
    
    if status:
        query = query.filter(Stamp.status == status)
    if stamp_code:
        query = query.filter(Stamp.stamp_code.contains(stamp_code))
    if stamp_name:
        query = query.filter(Stamp.stamp_name.contains(stamp_name))
    if stamp_type:
        query = query.filter(Stamp.stamp_type == stamp_type)
    
    sort_by = request.args.get('sort_by', 'stamp_code')
    sort_order = request.args.get('sort_order', 'asc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(Stamp, sort_by).desc())
    else:
        query = query.order_by(getattr(Stamp, sort_by))
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'stamps': [stamp.to_dict() for stamp in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/stamps/<int:stamp_id>', methods=['GET'])
def get_stamp(stamp_id):
    """获取单个印章详情"""
    stamp = Stamp.query.get_or_404(stamp_id)
    return jsonify(stamp.to_dict())

@api.route('/stamps', methods=['POST'])
def create_stamp():
    """创建新印章"""
    data = request.get_json()
    
    if 'stamp_code' not in data or 'stamp_name' not in data or 'stamp_type' not in data:
        return jsonify({'error': 'Missing required fields: stamp_code, stamp_name, stamp_type'}), 400
    
    existing_stamp = Stamp.query.filter_by(stamp_code=data['stamp_code']).first()
    if existing_stamp:
        return jsonify({'error': 'Stamp with this code already exists'}), 400
    
    new_stamp = Stamp(
        stamp_code=data['stamp_code'],
        stamp_name=data['stamp_name'],
        stamp_type=data['stamp_type'],
        status=data.get('status', 'in_cabinet'),
        location=data.get('location')
    )
    
    db.session.add(new_stamp)
    db.session.commit()
    
    return jsonify(new_stamp.to_dict()), 201

@api.route('/stamps/<int:stamp_id>', methods=['PUT'])
def update_stamp(stamp_id):
    """更新印章信息"""
    stamp = Stamp.query.get_or_404(stamp_id)
    data = request.get_json()
    
    if 'stamp_name' in data:
        stamp.stamp_name = data['stamp_name']
    if 'stamp_type' in data:
        stamp.stamp_type = data['stamp_type']
    if 'status' in data:
        stamp.status = data['status']
    if 'location' in data:
        stamp.location = data['location']
    
    db.session.commit()
    
    return jsonify(stamp.to_dict())

@api.route('/stamps/<int:stamp_id>', methods=['DELETE'])
def delete_stamp(stamp_id):
    """删除印章"""
    stamp = Stamp.query.get_or_404(stamp_id)
    
    db.session.delete(stamp)
    db.session.commit()
    
    return jsonify({'message': 'Stamp deleted successfully'})
