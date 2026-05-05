from flask import request, jsonify, make_response
from app.routes import api
from app import db
from app.models import (
    StampApplication, Stamp, StampLoan, ExpressDelivery,
    Review, AuditResult, Authorization
)
from datetime import datetime
import json

@api.route('/export/handover/<int:application_id>', methods=['GET'])
def export_handover_form(application_id):
    """导出 Markdown 格式的用印交接单"""
    application = StampApplication.query.get_or_404(application_id)
    
    stamp = Stamp.query.filter_by(stamp_code=application.stamp_code).first()
    
    reviews = Review.query.filter_by(application_id=application_id).order_by(
        Review.review_date.desc()
    ).all()
    
    markdown_content = generate_handover_markdown(application, stamp, reviews)
    
    response = make_response(markdown_content)
    response.headers["Content-Disposition"] = f"attachment; filename=handover_{application.application_number}.md"
    response.headers["Content-type"] = "text/markdown"
    
    return response

@api.route('/export/handover/batch', methods=['POST'])
def export_batch_handover_forms():
    """批量导出用印交接单"""
    data = request.get_json()
    application_ids = data.get('application_ids', [])
    
    if not application_ids:
        return jsonify({'error': 'No application IDs provided'}), 400
    
    markdown_content = ""
    
    for app_id in application_ids:
        application = StampApplication.query.get(app_id)
        if application:
            stamp = Stamp.query.filter_by(stamp_code=application.stamp_code).first()
            reviews = Review.query.filter_by(application_id=app_id).order_by(
                Review.review_date.desc()
            ).all()
            
            markdown_content += generate_handover_markdown(application, stamp, reviews)
            markdown_content += "\n\n---\n\n"
    
    if not markdown_content:
        return jsonify({'error': 'No valid applications found'}), 404
    
    response = make_response(markdown_content)
    response.headers["Content-Disposition"] = f"attachment; filename=handover_batch_{datetime.now().strftime('%Y%m%d')}.md"
    response.headers["Content-type"] = "text/markdown"
    
    return response

@api.route('/export/audit', methods=['GET'])
def export_audit_package():
    """导出 JSON 格式的审计包"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    status = request.args.get('status')
    
    query = StampApplication.query
    
    if start_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        query = query.filter(StampApplication.application_date >= start_dt)
    if end_date:
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        query = query.filter(StampApplication.application_date <= end_dt)
    if status:
        query = query.filter(StampApplication.status == status)
    
    applications = query.all()
    
    audit_package = {
        'export_date': datetime.now().isoformat(),
        'period': {
            'start_date': start_date,
            'end_date': end_date
        },
        'applications': [],
        'stamps': [],
        'loans': [],
        'reviews': [],
        'audit_results': []
    }
    
    stamp_codes = set()
    loan_ids = set()
    review_ids = set()
    
    for app in applications:
        app_dict = app.to_dict()
        audit_package['applications'].append(app_dict)
        stamp_codes.add(app.stamp_code)
        
        for review in app.reviews:
            audit_package['reviews'].append(review.to_dict())
        
        for audit_result in app.audit_results:
            audit_package['audit_results'].append(audit_result.to_dict())
    
    for stamp_code in stamp_codes:
        stamp = Stamp.query.filter_by(stamp_code=stamp_code).first()
        if stamp:
            audit_package['stamps'].append(stamp.to_dict())
            
            loans = StampLoan.query.filter_by(stamp_code=stamp_code).all()
            for loan in loans:
                audit_package['loans'].append(loan.to_dict())
    
    response = make_response(json.dumps(audit_package, ensure_ascii=False, indent=2))
    response.headers["Content-Disposition"] = f"attachment; filename=audit_package_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    response.headers["Content-type"] = "application/json"
    
    return response

@api.route('/export/audit/<int:audit_result_id>', methods=['GET'])
def export_single_audit(audit_result_id):
    """导出单个审计结果"""
    audit_result = AuditResult.query.get_or_404(audit_result_id)
    
    application = None
    if audit_result.application_id:
        application = StampApplication.query.get(audit_result.application_id)
    
    audit_package = {
        'export_date': datetime.now().isoformat(),
        'audit_result': audit_result.to_dict(),
        'application': application.to_dict() if application else None
    }
    
    if application:
        audit_package['reviews'] = [r.to_dict() for r in application.reviews]
        audit_package['stamp'] = Stamp.query.filter_by(
            stamp_code=application.stamp_code
        ).first().to_dict() if Stamp.query.filter_by(
            stamp_code=application.stamp_code
        ).first() else None
    
    response = make_response(json.dumps(audit_package, ensure_ascii=False, indent=2))
    response.headers["Content-Disposition"] = f"attachment; filename=audit_{audit_result.audit_number}.json"
    response.headers["Content-type"] = "application/json"
    
    return response

def generate_handover_markdown(application, stamp, reviews):
    """生成用印交接单 Markdown 内容"""
    content = f"""# 用印交接单

## 基本信息

| 项目 | 内容 |
|------|------|
| 申请编号 | {application.application_number} |
| 申请人 | {application.applicant_name} |
| 部门 | {application.department or '-'} |
| 申请日期 | {application.application_date.strftime('%Y-%m-%d') if application.application_date else '-'} |
| 状态 | {get_status_text(application.status)} |
| 风险评分 | {application.risk_score} |

## 印章信息

| 项目 | 内容 |
|------|------|
| 印章编号 | {application.stamp_code} |
| 印章名称 | {stamp.stamp_name if stamp else '-'} |
| 印章类型 | {stamp.stamp_type if stamp else '-'} |

## 文件信息

| 项目 | 内容 |
|------|------|
| 文件类型 | {application.document_type} |
| 文件标题 | {application.document_title} |
| 用印原因 | {application.usage_reason or '-'} |
| 预计用印日期 | {application.expected_use_date.strftime('%Y-%m-%d') if application.expected_use_date else '-'} |

"""
    
    if reviews:
        content += """## 复核记录

| 复核人 | 复核日期 | 原状态 | 新状态 | 备注 |
|--------|----------|--------|--------|------|
"""
        for review in reviews:
            content += f"| {review.reviewer_name} | {review.review_date.strftime('%Y-%m-%d %H:%M') if review.review_date else '-'} | {get_status_text(review.original_status)} | {get_status_text(review.new_status)} | {review.notes} |\n"
    
    content += f"""
---

**交接单生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

**说明**: 此交接单由系统自动生成，请核对信息无误后签字确认。
"""
    
    return content

def get_status_text(status):
    """获取状态文本"""
    status_map = {
        'pending': '待处理',
        'reviewing': '审核中',
        'approved': '已批准',
        'rejected': '已拒绝',
        'completed': '已完成',
        'hold': '暂缓'
    }
    return status_map.get(status, status)
