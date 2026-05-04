import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models import Interview, InterviewVersion, InterviewSchema, AuditLog

review_bp = Blueprint('review', __name__)

# 初始化Schema
interview_schema = InterviewSchema()
interviews_schema = InterviewSchema(many=True)

@review_bp.route('/pending', methods=['GET'])
def get_pending_reviews():
    """
    获取未复核的访谈列表
    状态为 'completed' 但尚未标记为 'reviewed' 的访谈
    """
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        researcher = request.args.get('researcher')
        
        # 构建查询：状态为 completed 但未 reviewed
        query = Interview.query.filter(
            Interview.status == 'completed'
        )
        
        if researcher:
            query = query.filter(Interview.researcher_name.like(f'%{researcher}%'))
        
        # 分页查询
        pagination = query.order_by(Interview.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        interviews = pagination.items
        
        # 添加额外信息
        result = []
        for interview in interviews:
            interview_data = interview_schema.dump(interview)
            # 获取版本数量
            version_count = InterviewVersion.query.filter_by(
                interview_id=interview.id
            ).count()
            interview_data['version_count'] = version_count
            result.append(interview_data)
        
        return jsonify({
            'interviews': result,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@review_bp.route('/<int:interview_id>/approve', methods=['POST'])
def approve_review(interview_id):
    """
    审核通过访谈
    """
    try:
        interview = Interview.query.get_or_404(interview_id)
        
        # 检查状态
        if interview.status not in ['completed', 'reviewed']:
            return jsonify({
                'error': f'Interview is not in a reviewable state. Current status: {interview.status}'
            }), 400
        
        # 更新状态
        interview.status = 'reviewed'
        interview.updated_at = datetime.utcnow()
        
        # 记录审计日志
        reviewer = request.json.get('reviewer', 'anonymous')
        comments = request.json.get('comments', '')
        
        audit_log = AuditLog(
            interview_id=interview_id,
            action='review_approve',
            user=reviewer,
            description=f'审核通过. 备注: {comments}',
            ip_address=request.remote_addr,
            created_at=datetime.utcnow()
        )
        db.session.add(audit_log)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Interview approved successfully',
            'interview_id': interview_id,
            'status': 'reviewed'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@review_bp.route('/<int:interview_id>/reject', methods=['POST'])
def reject_review(interview_id):
    """
    审核不通过，要求重新处理
    """
    try:
        interview = Interview.query.get_or_404(interview_id)
        
        # 检查状态
        if interview.status != 'completed':
            return jsonify({
                'error': f'Interview is not in a reviewable state. Current status: {interview.status}'
            }), 400
        
        # 获取审核意见
        reviewer = request.json.get('reviewer', 'anonymous')
        reason = request.json.get('reason', '未提供原因')
        
        # 记录审计日志
        audit_log = AuditLog(
            interview_id=interview_id,
            action='review_reject',
            user=reviewer,
            description=f'审核不通过. 原因: {reason}',
            ip_address=request.remote_addr,
            created_at=datetime.utcnow()
        )
        db.session.add(audit_log)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Interview rejected. Please review and reprocess.',
            'interview_id': interview_id,
            'status': interview.status,
            'reason': reason
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@review_bp.route('/<int:interview_id>/rollback', methods=['POST'])
def rollback_anonymization(interview_id):
    """
    回滚一次脱敏结果
    将当前版本回滚到上一个版本
    """
    try:
        interview = Interview.query.get_or_404(interview_id)
        
        # 获取所有版本，按版本号降序排列
        versions = InterviewVersion.query.filter_by(
            interview_id=interview_id
        ).order_by(InterviewVersion.version_number.desc()).all()
        
        if len(versions) < 2:
            return jsonify({
                'error': 'Not enough versions to rollback. Minimum 2 versions required.'
            }), 400
        
        # 当前最新版本
        current_version = versions[0]
        # 上一个版本（要回滚到的版本）
        target_version = versions[1]
        
        # 记录回滚前的状态
        previous_content = interview.anonymized_content
        previous_status = interview.status
        
        # 执行回滚：将访谈内容恢复到上一个版本
        interview.anonymized_content = target_version.content
        interview.status = 'rolled_back'
        interview.updated_at = datetime.utcnow()
        
        # 删除当前最新版本（因为已经回滚）
        db.session.delete(current_version)
        
        # 记录审计日志
        user = request.json.get('user', 'anonymous')
        reason = request.json.get('reason', '未提供原因')
        
        audit_log = AuditLog(
            interview_id=interview_id,
            action='rollback',
            user=user,
            description=f'从版本 {current_version.version_number} 回滚到版本 {target_version.version_number}. 原因: {reason}',
            ip_address=request.remote_addr,
            created_at=datetime.utcnow()
        )
        db.session.add(audit_log)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Rollback completed successfully',
            'interview_id': interview_id,
            'previous_version': current_version.version_number,
            'current_version': target_version.version_number,
            'status': 'rolled_back'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@review_bp.route('/<int:interview_id>/versions', methods=['GET'])
def get_versions(interview_id):
    """
    获取访谈的所有版本历史
    """
    try:
        interview = Interview.query.get_or_404(interview_id)
        
        versions = InterviewVersion.query.filter_by(
            interview_id=interview_id
        ).order_by(InterviewVersion.version_number.asc()).all()
        
        result = []
        for version in versions:
            result.append({
                'version_number': version.version_number,
                'content_preview': version.content[:200] + '...' if len(version.content) > 200 else version.content,
                'created_at': version.created_at.isoformat()
            })
        
        return jsonify({
            'interview_id': interview_id,
            'filename': interview.filename,
            'current_status': interview.status,
            'versions': result,
            'total_versions': len(versions)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@review_bp.route('/<int:interview_id>/versions/<int:version_number>', methods=['GET'])
def get_specific_version(interview_id, version_number):
    """
    获取指定版本的完整内容
    """
    try:
        version = InterviewVersion.query.filter_by(
            interview_id=interview_id,
            version_number=version_number
        ).first_or_404()
        
        # 记录审计日志
        audit_log = AuditLog(
            interview_id=interview_id,
            action='access_version',
            user='anonymous',
            description=f'访问版本 {version_number}',
            ip_address=request.remote_addr,
            created_at=datetime.utcnow()
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'interview_id': interview_id,
            'version_number': version_number,
            'content': version.content,
            'created_at': version.created_at.isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
