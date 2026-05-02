from flask import Blueprint, request, jsonify
from extensions import db
from models.models import AuditLog

audit = Blueprint('audit', __name__)

@audit.route('/logs', methods=['GET'])
def get_audit_logs():
    # 获取查询参数
    action = request.args.get('action')
    target_type = request.args.get('target_type')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    # 构建查询
    query = AuditLog.query
    
    if action:
        query = query.filter_by(action=action)
    if target_type:
        query = query.filter_by(target_type=target_type)
    
    # 排序和分页
    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    total = query.count()
    
    return jsonify({
        'total': total,
        'logs': [log.to_dict() for log in logs]
    }), 200

@audit.route('/logs/<int:log_id>', methods=['GET'])
def get_audit_log(log_id):
    log = AuditLog.query.get_or_404(log_id)
    return jsonify(log.to_dict()), 200
