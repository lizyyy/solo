import json
import csv
from io import StringIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, make_response
from app import db
from app.models import Interview, AuditLog, InterviewSummary

export_bp = Blueprint('export', __name__)

@export_bp.route('/review-report', methods=['GET'])
def export_review_report():
    """
    导出指定日期的复核报告
    支持 JSON 和 CSV 格式
    """
    try:
        # 获取查询参数
        date_str = request.args.get('date')
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        format_type = request.args.get('format', 'json').lower()
        include_details = request.args.get('include_details', 'false').lower() == 'true'
        
        # 解析日期范围
        if date_str:
            # 单日期模式
            try:
                target_date = datetime.fromisoformat(date_str).date()
                start_date = datetime.combine(target_date, datetime.min.time())
                end_date = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
        elif start_date_str and end_date_str:
            # 日期范围模式
            try:
                start_date = datetime.fromisoformat(start_date_str)
                end_date = datetime.fromisoformat(end_date_str)
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
        else:
            # 默认导出最近7天
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)
        
        # 查询复核相关的访谈
        # 包括已审核通过、已拒绝、已回滚的访谈
        interviews = Interview.query.filter(
            Interview.updated_at >= start_date,
            Interview.updated_at < end_date,
            Interview.status.in_(['reviewed', 'rolled_back', 'completed'])
        ).order_by(Interview.updated_at.desc()).all()
        
        # 准备报告数据
        report_data = []
        
        for interview in interviews:
            # 获取相关信息
            summary = InterviewSummary.query.filter_by(interview_id=interview.id).first()
            
            # 获取复核相关的审计日志
            review_logs = AuditLog.query.filter(
                AuditLog.interview_id == interview.id,
                AuditLog.action.in_(['review_approve', 'review_reject', 'rollback'])
            ).order_by(AuditLog.created_at.desc()).all()
            
            interview_data = {
                'interview_id': interview.id,
                'filename': interview.filename,
                'researcher_name': interview.researcher_name,
                'interview_date': interview.interview_date.isoformat() if interview.interview_date else None,
                'status': interview.status,
                'created_at': interview.created_at.isoformat(),
                'updated_at': interview.updated_at.isoformat(),
                'review_actions': []
            }
            
            # 添加摘要信息
            if summary:
                interview_data['keywords'] = json.loads(summary.keywords) if summary.keywords else []
                interview_data['summary_preview'] = summary.summary_content[:500] + '...' if len(summary.summary_content) > 500 else summary.summary_content
            
            # 添加复核操作记录
            for log in review_logs:
                interview_data['review_actions'].append({
                    'action': log.action,
                    'user': log.user,
                    'description': log.description,
                    'timestamp': log.created_at.isoformat()
                })
            
            # 如果需要详细信息，添加更多内容
            if include_details:
                interview_data['anonymized_content_preview'] = interview.anonymized_content[:1000] + '...' if interview.anonymized_content and len(interview.anonymized_content) > 1000 else interview.anonymized_content
            
            report_data.append(interview_data)
        
        # 生成统计信息
        statistics = {
            'total_interviews': len(interviews),
            'reviewed_count': len([i for i in interviews if i.status == 'reviewed']),
            'rolled_back_count': len([i for i in interviews if i.status == 'rolled_back']),
            'pending_review_count': len([i for i in interviews if i.status == 'completed']),
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        }
        
        # 根据格式返回
        if format_type == 'csv':
            return _generate_csv_response(report_data, statistics)
        else:
            # JSON 格式
            return jsonify({
                'report_date': datetime.utcnow().isoformat(),
                'statistics': statistics,
                'interviews': report_data
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _generate_csv_response(report_data, statistics):
    """
    生成 CSV 格式的响应
    """
    output = StringIO()
    writer = csv.writer(output)
    
    # 写入统计信息
    writer.writerow(['复核报告统计'])
    writer.writerow(['总访谈数', statistics['total_interviews']])
    writer.writerow(['已审核通过', statistics['reviewed_count']])
    writer.writerow(['已回滚', statistics['rolled_back_count']])
    writer.writerow(['待审核', statistics['pending_review_count']])
    writer.writerow(['日期范围', f"{statistics['date_range']['start']} 到 {statistics['date_range']['end']}"])
    writer.writerow([])  # 空行
    
    # 写入访谈详情
    writer.writerow([
        '访谈ID', '文件名', '研究员', '访谈日期', '状态',
        '创建时间', '更新时间', '关键词', '最后操作'
    ])
    
    for interview in report_data:
        keywords = ', '.join(interview.get('keywords', []))
        last_action = interview['review_actions'][0]['action'] if interview['review_actions'] else 'N/A'
        
        writer.writerow([
            interview['interview_id'],
            interview['filename'],
            interview['researcher_name'] or 'N/A',
            interview['interview_date'] or 'N/A',
            interview['status'],
            interview['created_at'],
            interview['updated_at'],
            keywords,
            last_action
        ])
    
    output.seek(0)
    
    # 创建响应
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename=review_report_{datetime.utcnow().strftime("%Y%m%d")}.csv'
    
    return response

@export_bp.route('/audit-logs', methods=['GET'])
def export_audit_logs():
    """
    导出审计日志
    """
    try:
        # 获取查询参数
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        action = request.args.get('action')
        format_type = request.args.get('format', 'json').lower()
        
        # 构建查询
        query = AuditLog.query
        
        # 日期范围
        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str)
                query = query.filter(AuditLog.created_at >= start_date)
            except ValueError:
                return jsonify({'error': 'Invalid start_date format'}), 400
        
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str)
                query = query.filter(AuditLog.created_at <= end_date)
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        
        # 操作类型过滤
        if action:
            query = query.filter(AuditLog.action == action)
        
        # 执行查询
        logs = query.order_by(AuditLog.created_at.desc()).all()
        
        # 准备数据
        logs_data = []
        for log in logs:
            logs_data.append({
                'id': log.id,
                'interview_id': log.interview_id,
                'action': log.action,
                'user': log.user,
                'description': log.description,
                'ip_address': log.ip_address,
                'created_at': log.created_at.isoformat()
            })
        
        # 根据格式返回
        if format_type == 'csv':
            return _generate_audit_csv_response(logs_data)
        else:
            return jsonify({
                'total': len(logs_data),
                'logs': logs_data
            })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _generate_audit_csv_response(logs_data):
    """
    生成审计日志的 CSV 响应
    """
    output = StringIO()
    writer = csv.writer(output)
    
    # 写入表头
    writer.writerow([
        '日志ID', '访谈ID', '操作类型', '用户',
        '描述', 'IP地址', '时间'
    ])
    
    # 写入数据
    for log in logs_data:
        writer.writerow([
            log['id'],
            log['interview_id'] or 'N/A',
            log['action'],
            log['user'] or 'N/A',
            log['description'] or 'N/A',
            log['ip_address'] or 'N/A',
            log['created_at']
        ])
    
    output.seek(0)
    
    # 创建响应
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename=audit_logs_{datetime.utcnow().strftime("%Y%m%d")}.csv'
    
    return response
