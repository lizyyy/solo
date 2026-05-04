import os
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app import db
from app.models import Interview, InterviewSchema, InterviewSummary, InterviewSummarySchema, Authorization, AuthorizationSchema, AuditLog

interview_bp = Blueprint('interviews', __name__)

# 初始化Schema
interview_schema = InterviewSchema()
interviews_schema = InterviewSchema(many=True)
summary_schema = InterviewSummarySchema()
authorization_schema = AuthorizationSchema()

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

@interview_bp.route('/upload', methods=['POST'])
def upload_interview():
    """
    上传访谈转写JSON和受访者授权表
    """
    try:
        # 检查是否有文件上传
        if 'interview_file' not in request.files:
            return jsonify({'error': 'No interview file provided'}), 400
        
        interview_file = request.files['interview_file']
        
        if interview_file.filename == '':
            return jsonify({'error': 'No selected interview file'}), 400
        
        # 处理授权表（可选）
        authorization_file = request.files.get('authorization_file')
        
        # 获取其他表单数据
        researcher_name = request.form.get('researcher_name')
        interview_date_str = request.form.get('interview_date')
        
        # 解析访谈日期
        interview_date = None
        if interview_date_str:
            try:
                interview_date = datetime.fromisoformat(interview_date_str)
            except ValueError:
                return jsonify({'error': 'Invalid interview date format. Use ISO format (YYYY-MM-DD)'}), 400
        
        # 处理访谈文件
        if interview_file and allowed_file(interview_file.filename):
            filename = secure_filename(interview_file.filename)
            
            # 读取文件内容
            interview_content = interview_file.read().decode('utf-8')
            
            # 创建访谈记录
            interview = Interview(
                filename=filename,
                original_content=interview_content,
                researcher_name=researcher_name,
                interview_date=interview_date,
                status='pending'
            )
            db.session.add(interview)
            db.session.flush()  # 获取ID
            
            # 处理授权表
            if authorization_file and allowed_file(authorization_file.filename):
                auth_filename = secure_filename(authorization_file.filename)
                auth_content = authorization_file.read().decode('utf-8')
                
                authorization = Authorization(
                    interview_id=interview.id,
                    filename=auth_filename,
                    content=auth_content,
                    authorization_status='pending'
                )
                db.session.add(authorization)
            
            # 记录审计日志
            audit_log = AuditLog(
                interview_id=interview.id,
                action='upload',
                user=researcher_name or 'anonymous',
                description=f'上传访谈文件: {filename}',
                ip_address=request.remote_addr,
                created_at=datetime.utcnow()
            )
            db.session.add(audit_log)
            
            db.session.commit()
            
            # 提交异步脱敏任务（延迟导入避免循环导入）
            from app.tasks import process_interview_anonymization
            task = process_interview_anonymization.delay(interview.id)
            
            return jsonify({
                'message': 'Interview uploaded successfully',
                'interview_id': interview.id,
                'task_id': task.id,
                'status': 'processing'
            }), 202
        
        return jsonify({'error': 'File type not allowed'}), 400
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@interview_bp.route('', methods=['GET'])
def get_interviews():
    """
    获取访谈列表（支持分页和过滤）
    """
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status = request.args.get('status')
        researcher = request.args.get('researcher')
        
        # 构建查询
        query = Interview.query
        
        if status:
            query = query.filter(Interview.status == status)
        if researcher:
            query = query.filter(Interview.researcher_name.like(f'%{researcher}%'))
        
        # 分页查询
        pagination = query.order_by(Interview.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        interviews = pagination.items
        
        return jsonify({
            'interviews': interviews_schema.dump(interviews),
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@interview_bp.route('/<int:interview_id>', methods=['GET'])
def get_interview(interview_id):
    """
    获取单个访谈的详细信息
    """
    try:
        # 使用 get 而不是 get_or_404，以便更好地控制错误处理
        interview = Interview.query.get(interview_id)
        if interview is None:
            return jsonify({'error': 'Interview not found'}), 404
        
        # 获取相关信息
        summary = InterviewSummary.query.filter_by(interview_id=interview_id).first()
        authorizations = Authorization.query.filter_by(interview_id=interview_id).all()
        
        result = interview_schema.dump(interview)
        
        if summary:
            result['summary'] = summary_schema.dump(summary)
        if authorizations:
            result['authorizations'] = authorization_schema.dump(authorizations, many=True)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@interview_bp.route('/<int:interview_id>/summary', methods=['GET'])
def get_interview_summary(interview_id):
    """
    获取访谈的脱敏摘要
    """
    try:
        summary = InterviewSummary.query.filter_by(interview_id=interview_id).first_or_404()
        return jsonify(summary_schema.dump(summary))
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@interview_bp.route('/<int:interview_id>/original', methods=['GET'])
def get_original_content(interview_id):
    """
    获取访谈原始内容（仅授权用户可访问）
    """
    try:
        interview = Interview.query.get_or_404(interview_id)
        
        # 记录审计日志
        audit_log = AuditLog(
            interview_id=interview_id,
            action='access_original',
            user='anonymous',  # 后续可扩展为认证用户
            description=f'访问原始内容: {interview.filename}',
            ip_address=request.remote_addr,
            created_at=datetime.utcnow()
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'interview_id': interview_id,
            'filename': interview.filename,
            'original_content': interview.original_content
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@interview_bp.route('/<int:interview_id>/anonymized', methods=['GET'])
def get_anonymized_content(interview_id):
    """
    获取访谈脱敏内容
    """
    try:
        interview = Interview.query.get_or_404(interview_id)
        
        if not interview.anonymized_content:
            return jsonify({'error': 'Anonymized content not available yet'}), 404
        
        return jsonify({
            'interview_id': interview_id,
            'filename': interview.filename,
            'status': interview.status,
            'anonymized_content': interview.anonymized_content
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
