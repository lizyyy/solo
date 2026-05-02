from flask import Blueprint, request, jsonify
from datetime import datetime

from app import db
from models import Pottery
from services import VersionManager, AuditService, RuleEngine

pottery_bp = Blueprint('pottery', __name__)
rule_engine = RuleEngine()


@pottery_bp.route('', methods=['GET'])
def list_potteries():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    trench = request.args.get('trench')
    layer = request.args.get('layer')
    status = request.args.get('status')
    
    query = Pottery.query
    
    if trench:
        query = query.filter_by(trench=trench)
    if layer:
        query = query.filter_by(layer=layer)
    if status:
        query = query.filter_by(status=status)
    
    pagination = query.order_by(Pottery.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'success': True,
        'data': {
            'potteries': [p.to_dict() for p in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }
    })


@pottery_bp.route('/<pottery_id>', methods=['GET'])
def get_pottery(pottery_id):
    pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': pottery_id
        }), 404
    
    include_issues = request.args.get('include_issues', 'false').lower() == 'true'
    
    return jsonify({
        'success': True,
        'data': pottery.to_dict(include_issues=include_issues)
    })


@pottery_bp.route('', methods=['POST'])
def create_pottery():
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': '请求数据为空'
        }), 400
    
    required_fields = ['pottery_id', 'trench', 'layer']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({
                'success': False,
                'error': f'缺少必填字段: {field}'
            }), 400
    
    existing = Pottery.query.filter_by(pottery_id=data['pottery_id']).first()
    if existing:
        return jsonify({
            'success': False,
            'error': '陶片编号已存在',
            'pottery_id': data['pottery_id']
        }), 409
    
    try:
        pottery = Pottery(
            pottery_id=data['pottery_id'],
            trench=data['trench'],
            layer=data['layer'],
            square=data.get('square'),
            length=data.get('length'),
            width=data.get('width'),
            thickness=data.get('thickness'),
            weight=data.get('weight'),
            decoration=data.get('decoration'),
            paste_type=data.get('paste_type'),
            color=data.get('color'),
            photo_path=data.get('photo_path'),
            photo_hash=data.get('photo_hash'),
            status=data.get('status', 'pending'),
            notes=data.get('notes'),
            created_by=data.get('created_by'),
            updated_by=data.get('updated_by')
        )
        
        db.session.add(pottery)
        db.session.flush()
        
        AuditService.log_pottery_create(
            pottery,
            user=data.get('created_by')
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '陶片创建成功',
            'data': pottery.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'创建陶片失败: {str(e)}'
        }), 500


@pottery_bp.route('/<pottery_id>', methods=['PUT'])
def update_pottery(pottery_id):
    pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': pottery_id
        }), 404
    
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': '请求数据为空'
        }), 400
    
    old_values = pottery.to_dict()
    
    try:
        updatable_fields = [
            'trench', 'layer', 'square', 'length', 'width',
            'thickness', 'weight', 'decoration', 'paste_type',
            'color', 'photo_path', 'photo_hash', 'status', 'notes'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(pottery, field, data[field])
        
        if 'updated_by' in data:
            pottery.updated_by = data['updated_by']
        
        VersionManager.create_version(
            pottery, 'pottery',
            change_reason=data.get('change_reason', '更新陶片信息'),
            created_by=data.get('updated_by')
        )
        
        AuditService.log_pottery_update(
            pottery, old_values,
            user=data.get('updated_by')
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '陶片更新成功',
            'data': pottery.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'更新陶片失败: {str(e)}'
        }), 500


@pottery_bp.route('/<pottery_id>', methods=['DELETE'])
def delete_pottery(pottery_id):
    pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': pottery_id
        }), 404
    
    if pottery.associations:
        return jsonify({
            'success': False,
            'error': '陶片已关联拼接组，无法删除',
            'pottery_id': pottery_id
        }), 400
    
    try:
        AuditService.log_pottery_delete(pottery)
        
        db.session.delete(pottery)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '陶片删除成功',
            'pottery_id': pottery_id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'删除陶片失败: {str(e)}'
        }), 500


@pottery_bp.route('/<pottery_id>/validate', methods=['POST'])
def validate_pottery(pottery_id):
    pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': pottery_id
        }), 404
    
    from models import SpliceGroup
    all_groups = SpliceGroup.query.all()
    
    result = rule_engine.validate_pottery(pottery, all_groups)
    
    return jsonify({
        'success': True,
        'data': result.to_dict()
    })


@pottery_bp.route('/<pottery_id>/versions', methods=['GET'])
def get_pottery_versions(pottery_id):
    pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': pottery_id
        }), 404
    
    versions = VersionManager.get_version_history('pottery', pottery_id)
    
    return jsonify({
        'success': True,
        'data': {
            'pottery_id': pottery_id,
            'versions': versions
        }
    })


@pottery_bp.route('/<pottery_id>/versions/<int:version_number>', methods=['GET'])
def get_pottery_version(pottery_id, version_number):
    pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': pottery_id
        }), 404
    
    version = VersionManager.get_version('pottery', pottery_id, version_number)
    
    if not version:
        return jsonify({
            'success': False,
            'error': '版本不存在',
            'version_number': version_number
        }), 404
    
    return jsonify({
        'success': True,
        'data': version.to_dict()
    })


@pottery_bp.route('/stats', methods=['GET'])
def get_pottery_stats():
    from sqlalchemy import func
    
    total = Pottery.query.count()
    
    status_stats = db.session.query(
        Pottery.status, func.count(Pottery.id)
    ).group_by(Pottery.status).all()
    
    trench_stats = db.session.query(
        Pottery.trench, func.count(Pottery.id)
    ).group_by(Pottery.trench).all()
    
    return jsonify({
        'success': True,
        'data': {
            'total': total,
            'by_status': {status: count for status, count in status_stats},
            'by_trench': {trench: count for trench, count in trench_stats}
        }
    })
