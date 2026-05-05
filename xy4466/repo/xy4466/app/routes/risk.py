from flask import request, jsonify
from app.routes import api
from app import db
from app.models import StampApplication, Authorization, StampLoan, StampCabinetLog, AuditResult
from app.utils.risk_calculator import (
    calculate_application_risk,
    check_authorization,
    check_overdue_loans,
    check_unauthorized_access
)
from datetime import datetime
import json

@api.route('/risk/calculate-all', methods=['POST'])
def calculate_all_risks():
    """计算所有待处理申请的风险"""
    applications = StampApplication.query.filter(
        StampApplication.status.in_(['pending', 'reviewing'])
    ).all()
    
    calculated_count = 0
    for app in applications:
        calculate_application_risk(app)
        calculated_count += 1
    
    db.session.commit()
    
    return jsonify({
        'message': 'Risk calculation completed',
        'calculated_count': calculated_count
    })

@api.route('/risk/check-authorizations', methods=['POST'])
def check_all_authorizations():
    """检查所有授权有效性"""
    today = datetime.utcnow().date()
    
    authorizations = Authorization.query.filter_by(is_active=True).all()
    
    expired_count = 0
    expiring_soon_count = 0
    
    for auth in authorizations:
        if auth.end_date:
            end_date = auth.end_date.date()
            days_remaining = (end_date - today).days
            
            if days_remaining < 0:
                auth.is_active = False
                expired_count += 1
            elif days_remaining <= 7:
                expiring_soon_count += 1
    
    db.session.commit()
    
    return jsonify({
        'message': 'Authorization check completed',
        'total_checked': len(authorizations),
        'expired_count': expired_count,
        'expiring_soon_count': expiring_soon_count
    })

@api.route('/risk/check-overdue', methods=['POST'])
def check_all_overdue():
    """检查所有逾期外借"""
    result = check_overdue_loans()
    db.session.commit()
    
    return jsonify(result)

@api.route('/risk/check-unauthorized', methods=['POST'])
def check_unauthorized():
    """检查未授权访问记录"""
    result = check_unauthorized_access()
    return jsonify(result)

@api.route('/risk/assessment/<int:application_id>', methods=['GET'])
def get_risk_assessment(application_id):
    """获取特定申请的风险评估详情"""
    application = StampApplication.query.get_or_404(application_id)
    
    risk_factors = []
    
    auth_check = check_authorization(
        application.applicant_id,
        application.stamp_code
    )
    if not auth_check['authorized']:
        risk_factors.append({
            'type': 'authorization',
            'level': 'high',
            'message': auth_check['message']
        })
    
    active_loans = StampLoan.query.filter_by(
        stamp_code=application.stamp_code,
        status='on_loan'
    ).all()
    
    if active_loans:
        risk_factors.append({
            'type': 'active_loan',
            'level': 'medium',
            'message': f'印章 {application.stamp_code} 当前有 {len(active_loans)} 笔外借记录'
        })
    
    overdue_loans = StampLoan.query.filter_by(
        stamp_code=application.stamp_code,
        status='on_loan',
        is_overdue=True
    ).all()
    
    if overdue_loans:
        risk_factors.append({
            'type': 'overdue_loan',
            'level': 'high',
            'message': f'印章 {application.stamp_code} 有 {len(overdue_loans)} 笔逾期未归还记录'
        })
    
    return jsonify({
        'application_id': application_id,
        'application_number': application.application_number,
        'risk_score': application.risk_score,
        'risk_factors': risk_factors,
        'status': application.status
    })

@api.route('/risk/summary', methods=['GET'])
def get_risk_summary():
    """获取风险概览"""
    today = datetime.utcnow().date()
    
    pending_applications = StampApplication.query.filter_by(status='pending').count()
    approved_applications = StampApplication.query.filter_by(status='approved').count()
    rejected_applications = StampApplication.query.filter_by(status='rejected').count()
    
    active_loans = StampLoan.query.filter_by(status='on_loan').count()
    overdue_loans = StampLoan.query.filter_by(status='on_loan', is_overdue=True).count()
    
    active_authorizations = Authorization.query.filter_by(is_active=True).count()
    expired_authorizations = Authorization.query.filter_by(is_active=False).count()
    
    high_risk_apps = StampApplication.query.filter(
        StampApplication.risk_score >= 70
    ).count()
    
    return jsonify({
        'applications': {
            'pending': pending_applications,
            'approved': approved_applications,
            'rejected': rejected_applications,
            'high_risk': high_risk_apps
        },
        'loans': {
            'active': active_loans,
            'overdue': overdue_loans
        },
        'authorizations': {
            'active': active_authorizations,
            'expired': expired_authorizations
        }
    })
