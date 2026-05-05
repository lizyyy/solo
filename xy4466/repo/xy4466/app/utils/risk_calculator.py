from datetime import datetime, timedelta
import json
from app import db
from app.models import (
    StampApplication, Stamp, Authorization, StampLoan, 
    StampCabinetLog, AuditResult
)
from flask import current_app

def calculate_application_risk(application):
    """
    计算单个用印申请的风险评分和状态
    """
    risk_factors = []
    risk_score = 0.0
    status = 'pending'
    
    risk_rules = current_app.config.get('RISK_RULES', {})
    
    auth_check = check_authorization(
        application.applicant_id,
        application.stamp_code
    )
    
    if not auth_check['authorized']:
        risk_factors.append({
            'type': 'unauthorized',
            'description': auth_check['message'],
            'severity': 'high'
        })
        risk_score += 50
    
    active_loans = StampLoan.query.filter_by(
        stamp_code=application.stamp_code,
        status='on_loan'
    ).all()
    
    if active_loans:
        overdue_loans = [loan for loan in active_loans if loan.is_overdue]
        if overdue_loans:
            risk_factors.append({
                'type': 'overdue_loan',
                'description': f'印章 {application.stamp_code} 有 {len(overdue_loans)} 笔逾期未归还记录',
                'severity': 'high'
            })
            risk_score += 40
        else:
            risk_factors.append({
                'type': 'active_loan',
                'description': f'印章 {application.stamp_code} 当前有 {len(active_loans)} 笔外借记录',
                'severity': 'medium'
            })
            risk_score += 15
    
    document_type = application.document_type
    high_risk_documents = risk_rules.get('high_risk_documents', [
        '担保合同', '贷款合同', '股权转让协议', '重大资产处置'
    ])
    
    if document_type in high_risk_documents:
        risk_factors.append({
            'type': 'high_risk_document',
            'description': f'高风险文件类型: {document_type}',
            'severity': 'medium'
        })
        risk_score += 20
    
    stamp = Stamp.query.filter_by(stamp_code=application.stamp_code).first()
    if stamp and stamp.status != 'in_cabinet':
        risk_factors.append({
            'type': 'stamp_unavailable',
            'description': f'印章 {application.stamp_code} 当前状态为: {stamp.status}',
            'severity': 'medium'
        })
        risk_score += 25
    
    if risk_score == 0:
        status = 'approved'
    elif risk_score >= 50:
        status = 'rejected'
    elif risk_score >= 30:
        status = 'hold'
    else:
        status = 'reviewing'
    
    application.risk_score = risk_score
    application.risk_factors = json.dumps(risk_factors, ensure_ascii=False)
    application.status = status
    
    return application

def check_authorization(employee_id, stamp_code):
    """
    检查员工是否有使用特定印章的授权
    """
    today = datetime.utcnow().date()
    
    authorization = Authorization.query.filter_by(
        employee_id=employee_id,
        stamp_code=stamp_code,
        is_active=True
    ).first()
    
    if not authorization:
        return {
            'authorized': False,
            'message': f'员工 {employee_id} 没有使用印章 {stamp_code} 的授权'
        }
    
    start_date = authorization.start_date.date()
    if start_date > today:
        return {
            'authorized': False,
            'message': f'授权尚未生效，生效日期: {start_date}'
        }
    
    if authorization.end_date:
        end_date = authorization.end_date.date()
        if end_date < today:
            return {
                'authorized': False,
                'message': f'授权已过期，过期日期: {end_date}'
            }
    
    return {
        'authorized': True,
        'message': '授权有效',
        'authorization': authorization.to_dict()
    }

def check_overdue_loans():
    """
    检查所有逾期未归还的外借记录
    """
    today = datetime.utcnow().date()
    
    overdue_loans = StampLoan.query.filter(
        StampLoan.status == 'on_loan',
        StampLoan.expected_return_date < today
    ).all()
    
    updated_count = 0
    for loan in overdue_loans:
        if not loan.is_overdue:
            loan.is_overdue = True
            updated_count += 1
    
    db.session.commit()
    
    return {
        'message': '逾期检查完成',
        'total_overdue': len(overdue_loans),
        'updated_count': updated_count,
        'overdue_loans': [loan.to_dict() for loan in overdue_loans]
    }

def check_unauthorized_access():
    """
    检查未授权的印章柜访问记录
    """
    today = datetime.utcnow().date()
    start_of_day = datetime.combine(today, datetime.min.time())
    
    recent_logs = StampCabinetLog.query.filter(
        StampCabinetLog.operation_time >= start_of_day
    ).all()
    
    unauthorized_accesses = []
    
    for log in recent_logs:
        auth_check = check_authorization(log.operator_id, log.stamp_code)
        if not auth_check['authorized']:
            unauthorized_accesses.append({
                'log': log.to_dict(),
                'reason': auth_check['message']
            })
    
    return {
        'message': '未授权访问检查完成',
        'total_checked': len(recent_logs),
        'unauthorized_count': len(unauthorized_accesses),
        'unauthorized_accesses': unauthorized_accesses
    }

def can_approve_application(application):
    """
    判断用印申请是否可以批准盖章
    """
    auth_check = check_authorization(
        application.applicant_id,
        application.stamp_code
    )
    
    if not auth_check['authorized']:
        return {
            'can_approve': False,
            'reason': auth_check['message'],
            'level': 'high'
        }
    
    active_loans = StampLoan.query.filter_by(
        stamp_code=application.stamp_code,
        status='on_loan'
    ).all()
    
    overdue_loans = [loan for loan in active_loans if loan.is_overdue]
    if overdue_loans:
        return {
            'can_approve': False,
            'reason': f'印章 {application.stamp_code} 有 {len(overdue_loans)} 笔逾期未归还记录',
            'level': 'high'
        }
    
    stamp = Stamp.query.filter_by(stamp_code=application.stamp_code).first()
    if stamp and stamp.status == 'on_loan':
        return {
            'can_approve': False,
            'reason': f'印章 {application.stamp_code} 已外借，无法使用',
            'level': 'high'
        }
    
    if application.risk_score >= 50:
        return {
            'can_approve': False,
            'reason': f'风险评分过高 ({application.risk_score})，需要人工复核',
            'level': 'high'
        }
    
    if application.risk_score >= 30:
        return {
            'can_approve': False,
            'reason': f'存在中等风险 ({application.risk_score})，建议人工复核',
            'level': 'medium'
        }
    
    return {
        'can_approve': True,
        'reason': '所有检查通过，可以批准',
        'level': 'low'
    }

def create_audit_result(application, audit_type='automatic'):
    """
    创建审计结果记录
    """
    audit_number = f"AUD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    risk_level = 'low'
    if application.risk_score >= 70:
        risk_level = 'high'
    elif application.risk_score >= 30:
        risk_level = 'medium'
    
    audit_status = 'pass'
    if application.status == 'rejected':
        audit_status = 'fail'
    elif application.status == 'hold':
        audit_status = 'pending'
    
    audit_result = AuditResult(
        audit_number=audit_number,
        application_id=application.id,
        audit_type=audit_type,
        audit_date=datetime.utcnow(),
        risk_score=application.risk_score,
        risk_level=risk_level,
        risk_factors=application.risk_factors,
        audit_status=audit_status
    )
    
    db.session.add(audit_result)
    db.session.commit()
    
    return audit_result

def get_risk_summary():
    """
    获取风险统计摘要
    """
    from sqlalchemy import func
    
    status_stats = db.session.query(
        StampApplication.status,
        func.count(StampApplication.id).label('count')
    ).group_by(StampApplication.status).all()
    
    risk_ranges = [
        {'name': '低风险 (0-29)', 'min': 0, 'max': 29},
        {'name': '中风险 (30-69)', 'min': 30, 'max': 69},
        {'name': '高风险 (70+)', 'min': 70, 'max': 1000}
    ]
    
    risk_stats = []
    for risk_range in risk_ranges:
        count = StampApplication.query.filter(
            StampApplication.risk_score >= risk_range['min'],
            StampApplication.risk_score <= risk_range['max']
        ).count()
        risk_stats.append({
            'range': risk_range['name'],
            'count': count
        })
    
    today = datetime.utcnow().date()
    active_loans_count = StampLoan.query.filter_by(status='on_loan').count()
    overdue_loans_count = StampLoan.query.filter_by(
        status='on_loan',
        is_overdue=True
    ).count()
    
    active_authorizations_count = Authorization.query.filter_by(is_active=True).count()
    
    return {
        'application_status': [{'status': s.status, 'count': s.count} for s in status_stats],
        'risk_distribution': risk_stats,
        'loans': {
            'active': active_loans_count,
            'overdue': overdue_loans_count
        },
        'authorizations': {
            'active': active_authorizations_count
        }
    }
