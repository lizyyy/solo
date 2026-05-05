import os
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from models import db, Sample, AnomalySample, DuplicateSample, AuditLog
from import_service import ImportService
from report_service import ReportService
from config import config

api_bp = Blueprint('api', __name__)

import_service = ImportService()
report_service = ReportService()

# 支持的数据类型
SUPPORTED_DATA_TYPES = ['registration', 'colorimeter', 'friction', 'washing', 'review']

@api_bp.route('/import/csv', methods=['POST'])
def import_csv():
    """导入CSV文件"""
    if 'file' not in request.files:
        return jsonify({'error': '没有文件上传'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    # 获取数据类型参数
    data_type = request.form.get('data_type', 'registration')
    if data_type not in SUPPORTED_DATA_TYPES:
        return jsonify({'error': f'不支持的数据类型: {data_type}'}), 400
    
    try:
        # 保存上传的文件
        filename = secure_filename(file.filename)
        upload_path = os.path.join(config['default'].UPLOAD_FOLDER, filename)
        file.save(upload_path)
        
        # 导入数据
        results = import_service.import_csv(upload_path, filename, data_type)
        
        return jsonify({
            'message': f'CSV文件导入完成',
            'filename': filename,
            'data_type': data_type,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@api_bp.route('/import/json', methods=['POST'])
def import_json():
    """导入JSON文件"""
    if 'file' not in request.files:
        return jsonify({'error': '没有文件上传'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    # 获取数据类型参数
    data_type = request.form.get('data_type', 'colorimeter')
    if data_type not in SUPPORTED_DATA_TYPES:
        return jsonify({'error': f'不支持的数据类型: {data_type}'}), 400
    
    try:
        # 保存上传的文件
        filename = secure_filename(file.filename)
        upload_path = os.path.join(config['default'].UPLOAD_FOLDER, filename)
        file.save(upload_path)
        
        # 导入数据
        results = import_service.import_json(upload_path, filename, data_type)
        
        return jsonify({
            'message': f'JSON文件导入完成',
            'filename': filename,
            'data_type': data_type,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@api_bp.route('/samples', methods=['GET'])
def get_samples():
    """查询样本列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        sample_id = request.args.get('sample_id')
        risk_level = request.args.get('risk_level')
        status = request.args.get('status')
        
        # 构建查询
        query = Sample.query
        
        if sample_id:
            query = query.filter(Sample.sample_id.contains(sample_id))
        if risk_level:
            query = query.filter_by(risk_level=risk_level)
        if status:
            query = query.filter_by(status=status)
        
        # 分页
        pagination = query.order_by(Sample.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        samples = [sample.to_dict() for sample in pagination.items]
        
        return jsonify({
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages,
            'samples': samples
        })
        
    except Exception as e:
        return jsonify({'error': f'查询失败: {str(e)}'}), 500

@api_bp.route('/samples/<int:sample_id>', methods=['GET'])
def get_sample(sample_id):
    """查询单个样本详情"""
    try:
        sample = Sample.query.get(sample_id)
        if not sample:
            return jsonify({'error': '样本不存在'}), 404
        
        # 获取关联的异常和重复记录
        anomalies = AnomalySample.query.filter_by(fixed_sample_id=sample.id).all()
        duplicates = DuplicateSample.query.filter_by(original_sample_id=sample.id).all()
        
        result = sample.to_dict()
        result['related_anomalies'] = [a.to_dict() for a in anomalies]
        result['related_duplicates'] = [d.to_dict() for d in duplicates]
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'查询失败: {str(e)}'}), 500

@api_bp.route('/samples/by-code/<sample_id_str>', methods=['GET'])
def get_sample_by_code(sample_id_str):
    """通过样本编号查询样本详情"""
    try:
        sample = Sample.query.filter_by(sample_id=sample_id_str).first()
        if not sample:
            return jsonify({'error': '样本不存在'}), 404
        
        # 获取关联的异常和重复记录
        anomalies = AnomalySample.query.filter_by(fixed_sample_id=sample.id).all()
        duplicates = DuplicateSample.query.filter_by(original_sample_id=sample.id).all()
        
        result = sample.to_dict()
        result['related_anomalies'] = [a.to_dict() for a in anomalies]
        result['related_duplicates'] = [d.to_dict() for d in duplicates]
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'查询失败: {str(e)}'}), 500

@api_bp.route('/anomalies', methods=['GET'])
def get_anomalies():
    """查询异常样本列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_fixed = request.args.get('is_fixed', type=bool)
        anomaly_type = request.args.get('anomaly_type')
        filename = request.args.get('filename')
        
        # 构建查询
        query = AnomalySample.query
        
        if is_fixed is not None:
            query = query.filter_by(is_fixed=is_fixed)
        if anomaly_type:
            query = query.filter_by(anomaly_type=anomaly_type)
        if filename:
            query = query.filter(AnomalySample.original_filename.contains(filename))
        
        # 分页
        pagination = query.order_by(AnomalySample.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        anomalies = [anomaly.to_dict() for anomaly in pagination.items]
        
        return jsonify({
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages,
            'anomalies': anomalies
        })
        
    except Exception as e:
        return jsonify({'error': f'查询失败: {str(e)}'}), 500

@api_bp.route('/anomalies/<int:anomaly_id>', methods=['GET'])
def get_anomaly(anomaly_id):
    """查询单个异常详情"""
    try:
        anomaly = AnomalySample.query.get(anomaly_id)
        if not anomaly:
            return jsonify({'error': '异常记录不存在'}), 404
        
        return jsonify(anomaly.to_dict())
        
    except Exception as e:
        return jsonify({'error': f'查询失败: {str(e)}'}), 500

@api_bp.route('/anomalies/<int:anomaly_id>/fix', methods=['POST'])
def fix_anomaly(anomaly_id):
    """人工标记修复异常"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体不能为空'}), 400
        
        fixed_by = data.get('fixed_by', 'anonymous')
        
        sample, error = import_service.fix_anomaly(
            anomaly_id=anomaly_id,
            fix_data=data,
            fixed_by=fixed_by
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'message': '异常已修复',
            'sample': sample.to_dict()
        })
        
    except Exception as e:
        return jsonify({'error': f'修复失败: {str(e)}'}), 500

@api_bp.route('/duplicates', methods=['GET'])
def get_duplicates():
    """查询重复样本列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        sample_id = request.args.get('sample_id')
        
        # 构建查询
        query = DuplicateSample.query
        
        if status:
            query = query.filter_by(status=status)
        if sample_id:
            query = query.filter(DuplicateSample.sample_id.contains(sample_id))
        
        # 分页
        pagination = query.order_by(DuplicateSample.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        duplicates = [dup.to_dict() for dup in pagination.items]
        
        return jsonify({
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages,
            'duplicates': duplicates
        })
        
    except Exception as e:
        return jsonify({'error': f'查询失败: {str(e)}'}), 500

@api_bp.route('/duplicates/<int:duplicate_id>/resolve', methods=['POST'])
def resolve_duplicate(duplicate_id):
    """解决重复样本"""
    try:
        duplicate = DuplicateSample.query.get(duplicate_id)
        if not duplicate:
            return jsonify({'error': '重复记录不存在'}), 404
        
        if duplicate.status != 'pending':
            return jsonify({'error': '该重复已被处理'}), 400
        
        data = request.get_json()
        action = data.get('action')  # 'merge' 或 'discard'
        resolved_by = data.get('resolved_by', 'anonymous')
        notes = data.get('notes', '')
        
        if action not in ['merge', 'discard']:
            return jsonify({'error': '无效的操作类型，必须是 merge 或 discard'}), 400
        
        # 更新重复记录状态
        duplicate.status = action
        duplicate.resolved_by = resolved_by
        duplicate.resolved_at = datetime.utcnow()
        duplicate.resolution_notes = notes
        
        db.session.commit()
        
        # 记录审计日志
        audit_log = AuditLog(
            action='resolve_duplicate',
            entity_type='duplicate',
            entity_id=duplicate.id,
            details=json.dumps({
                'action': action,
                'notes': notes
            }, ensure_ascii=False),
            user=resolved_by
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'message': f'重复记录已{ "合并" if action == "merge" else "丢弃" }',
            'duplicate': duplicate.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'处理失败: {str(e)}'}), 500

@api_bp.route('/samples/<int:sample_id>/recalculate-risk', methods=['POST'])
def recalculate_risk(sample_id):
    """重新计算样本风险"""
    try:
        sample = Sample.query.get(sample_id)
        if not sample:
            return jsonify({'error': '样本不存在'}), 404
        
        sample.risk_score, sample.risk_level = import_service._calculate_risk(sample)
        db.session.commit()
        
        # 记录审计日志
        audit_log = AuditLog(
            action='recalculate_risk',
            entity_type='sample',
            entity_id=sample.id,
            details=json.dumps({
                'new_risk_score': sample.risk_score,
                'new_risk_level': sample.risk_level
            }, ensure_ascii=False)
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'message': '风险已重新计算',
            'sample_id': sample.sample_id,
            'risk_score': sample.risk_score,
            'risk_level': sample.risk_level
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'计算失败: {str(e)}'}), 500

@api_bp.route('/reports/markdown', methods=['GET'])
def export_markdown_report():
    """导出Markdown检测报告"""
    try:
        # 获取时间范围参数
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        include_all_anomalies = request.args.get('include_all_anomalies', 'true').lower() == 'true'
        
        start_date = None
        end_date = None
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        
        # 生成报告
        report_content = report_service.generate_markdown_report(
            start_date=start_date,
            end_date=end_date,
            include_all_anomalies=include_all_anomalies
        )
        
        # 记录审计日志
        filename = f'textile_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        audit_log = AuditLog(
            action='export',
            entity_type='report',
            details=json.dumps({
                'format': 'markdown',
                'include_all_anomalies': include_all_anomalies
            }, ensure_ascii=False),
            export_filename=filename
        )
        db.session.add(audit_log)
        db.session.commit()
        
        # 返回报告内容
        return jsonify({
            'filename': filename,
            'content': report_content
        })
        
    except Exception as e:
        return jsonify({'error': f'生成报告失败: {str(e)}'}), 500

@api_bp.route('/reports/markdown/download', methods=['GET'])
def download_markdown_report():
    """下载Markdown检测报告文件"""
    try:
        # 获取时间范围参数
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        include_all_anomalies = request.args.get('include_all_anomalies', 'true').lower() == 'true'
        
        start_date = None
        end_date = None
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        
        # 生成报告
        report_content = report_service.generate_markdown_report(
            start_date=start_date,
            end_date=end_date,
            include_all_anomalies=include_all_anomalies
        )
        
        # 保存到临时文件
        filename = f'textile_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        temp_path = os.path.join(config['default'].UPLOAD_FOLDER, filename)
        
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        # 记录审计日志
        audit_log = AuditLog(
            action='export',
            entity_type='report',
            details=json.dumps({
                'format': 'markdown',
                'include_all_anomalies': include_all_anomalies
            }, ensure_ascii=False),
            export_filename=filename
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return send_file(
            temp_path,
            as_attachment=True,
            download_name=filename,
            mimetype='text/markdown'
        )
        
    except Exception as e:
        return jsonify({'error': f'生成报告失败: {str(e)}'}), 500

@api_bp.route('/reports/audit', methods=['GET'])
def export_audit_package():
    """导出JSON审计包"""
    try:
        # 获取时间范围参数
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        
        # 生成审计包
        audit_package = report_service.generate_audit_package(
            start_date=start_date,
            end_date=end_date
        )
        
        # 记录审计日志
        filename = f'audit_package_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        audit_log = AuditLog(
            action='export',
            entity_type='audit',
            details=json.dumps({
                'format': 'json'
            }, ensure_ascii=False),
            export_filename=filename
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'filename': filename,
            'content': json.loads(audit_package)
        })
        
    except Exception as e:
        return jsonify({'error': f'生成审计包失败: {str(e)}'}), 500

@api_bp.route('/reports/audit/download', methods=['GET'])
def download_audit_package():
    """下载JSON审计包文件"""
    try:
        # 获取时间范围参数
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        
        # 生成审计包
        audit_package = report_service.generate_audit_package(
            start_date=start_date,
            end_date=end_date
        )
        
        # 保存到临时文件
        filename = f'audit_package_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        temp_path = os.path.join(config['default'].UPLOAD_FOLDER, filename)
        
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(audit_package)
        
        # 记录审计日志
        audit_log = AuditLog(
            action='export',
            entity_type='audit',
            details=json.dumps({
                'format': 'json'
            }, ensure_ascii=False),
            export_filename=filename
        )
        db.session.add(audit_log)
        db.session.commit()
        
        return send_file(
            temp_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/json'
        )
        
    except Exception as e:
        return jsonify({'error': f'生成审计包失败: {str(e)}'}), 500

@api_bp.route('/stats', methods=['GET'])
def get_statistics():
    """获取统计信息"""
    try:
        stats = {
            'samples': {
                'total': Sample.query.count(),
                'by_risk_level': {
                    'critical': Sample.query.filter_by(risk_level='critical').count(),
                    'warning': Sample.query.filter_by(risk_level='warning').count(),
                    'normal': Sample.query.filter_by(risk_level='normal').count()
                },
                'by_status': {
                    'normal': Sample.query.filter_by(status='normal').count(),
                    'fixed': Sample.query.filter_by(status='fixed').count(),
                    'duplicate': Sample.query.filter_by(status='duplicate').count()
                }
            },
            'anomalies': {
                'total': AnomalySample.query.count(),
                'pending': AnomalySample.query.filter_by(is_fixed=False).count(),
                'fixed': AnomalySample.query.filter_by(is_fixed=True).count()
            },
            'duplicates': {
                'total': DuplicateSample.query.count(),
                'pending': DuplicateSample.query.filter_by(status='pending').count(),
                'resolved': DuplicateSample.query.filter(DuplicateSample.status != 'pending').count()
            }
        }
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': f'获取统计信息失败: {str(e)}'}), 500
