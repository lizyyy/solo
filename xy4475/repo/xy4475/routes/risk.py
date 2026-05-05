from flask import Blueprint, jsonify, request
from extensions import db
from models import RiskReview, Case, SealRecord, Inspection, InventoryLog
from datetime import datetime

risk_bp = Blueprint('risk', __name__)

@risk_bp.route('', methods=['GET'])
def get_all_risk_reviews():
    """获取所有风险复核记录"""
    reviews = RiskReview.query.order_by(RiskReview.review_time.desc()).all()
    return jsonify([review.to_dict() for review in reviews])

@risk_bp.route('/<int:review_id>', methods=['GET'])
def get_risk_review_by_id(review_id):
    """根据ID获取风险复核记录"""
    review = RiskReview.query.get_or_404(review_id)
    return jsonify(review.to_dict())

@risk_bp.route('/case/<int:case_id>', methods=['GET'])
def get_risk_reviews_by_case(case_id):
    """根据案件ID获取风险复核记录"""
    reviews = RiskReview.query.filter_by(case_id=case_id).order_by(RiskReview.review_time.desc()).all()
    return jsonify([review.to_dict() for review in reviews])

@risk_bp.route('/type/<risk_type>', methods=['GET'])
def get_risk_reviews_by_type(risk_type):
    """根据风险类型获取风险复核记录"""
    reviews = RiskReview.query.filter_by(risk_type=risk_type).order_by(RiskReview.review_time.desc()).all()
    return jsonify([review.to_dict() for review in reviews])

@risk_bp.route('/unresolved', methods=['GET'])
def get_unresolved_risk_reviews():
    """获取所有未解决的风险复核记录"""
    reviews = RiskReview.query.filter_by(is_resolved=False).order_by(RiskReview.review_time.desc()).all()
    return jsonify({
        'unresolved_count': len(reviews),
        'unresolved_reviews': [review.to_dict() for review in reviews]
    })

@risk_bp.route('/detect', methods=['GET'])
def detect_risks():
    """自动检测风险"""
    detected_risks = []
    
    # 1. 检测封签断链
    broken_seals = SealRecord.query.filter_by(is_chain_complete=False).all()
    broken_evidence_ids = set()
    for record in broken_seals:
        broken_evidence_ids.add(record.evidence_id)
    
    for evidence_id in broken_evidence_ids:
        # 获取相关信息
        seal_records = SealRecord.query.filter_by(evidence_id=evidence_id).order_by(SealRecord.operation_time).all()
        if seal_records:
            evidence = seal_records[0].evidence
            case = evidence.case if evidence else None
            
            detected_risks.append({
                'risk_type': '封签断链',
                'risk_level': '高',
                'risk_description': f'证物 {evidence.evidence_name if evidence else "未知"} (编号: {evidence.evidence_number if evidence else "未知"}) 存在封签断链风险',
                'case_id': case.id if case else None,
                'case_number': case.case_number if case else None,
                'evidence_id': evidence_id,
                'details': {
                    'seal_records': [record.to_dict() for record in seal_records]
                }
            })
    
    # 2. 检测检验超期
    overdue_inspections = Inspection.query.filter_by(is_overdue=True, status='进行中').all()
    for inspection in overdue_inspections:
        case = inspection.case
        
        detected_risks.append({
            'risk_type': '检验超期',
            'risk_level': '中',
            'risk_description': f'案件 {case.case_name if case else "未知"} (编号: {case.case_number if case else "未知"}) 的检验步骤 {inspection.inspection_step}: {inspection.step_name} 已超期',
            'case_id': case.id if case else None,
            'case_number': case.case_number if case else None,
            'inspection_id': inspection.id,
            'details': {
                'inspection': inspection.to_dict()
            }
        })
    
    # 3. 检测借阅未归还
    overdue_borrows = InventoryLog.query.filter_by(is_returned=False, is_overdue=True).all()
    for log in overdue_borrows:
        case = log.case
        
        detected_risks.append({
            'risk_type': '借阅未归还',
            'risk_level': '中',
            'risk_description': f'借阅人 {log.borrower} 于 {log.operation_time.strftime("%Y-%m-%d")} 借阅的证物/案件已超期未归还',
            'case_id': case.id if case else None,
            'case_number': case.case_number if case else None,
            'inventory_log_id': log.id,
            'details': {
                'inventory_log': log.to_dict()
            }
        })
    
    # 4. 检测未归还的借阅（即使未超期）
    unreturned_borrows = InventoryLog.query.filter_by(is_returned=False, is_overdue=False).all()
    for log in unreturned_borrows:
        case = log.case
        
        detected_risks.append({
            'risk_type': '借阅未归还',
            'risk_level': '低',
            'risk_description': f'借阅人 {log.borrower} 于 {log.operation_time.strftime("%Y-%m-%d")} 借阅的证物/案件尚未归还，预期归还时间: {log.expected_return_time.strftime("%Y-%m-%d") if log.expected_return_time else "未设置"}',
            'case_id': case.id if case else None,
            'case_number': case.case_number if case else None,
            'inventory_log_id': log.id,
            'details': {
                'inventory_log': log.to_dict()
            }
        })
    
    # 检查是否有未解决的风险复核记录
    unresolved_reviews = RiskReview.query.filter_by(is_resolved=False).all()
    unresolved_dict = {}
    for review in unresolved_reviews:
        key = f"{review.risk_type}_{review.case_id}_{review.risk_description[:50]}"
        unresolved_dict[key] = review
    
    # 过滤掉已经存在的未解决风险
    new_risks = []
    for risk in detected_risks:
        key = f"{risk['risk_type']}_{risk['case_id']}_{risk['risk_description'][:50]}"
        if key not in unresolved_dict:
            new_risks.append(risk)
    
    return jsonify({
        'total_detected': len(detected_risks),
        'new_risks': len(new_risks),
        'existing_unresolved': len(unresolved_reviews),
        'detected_risks': detected_risks
    })

@risk_bp.route('', methods=['POST'])
def create_risk_review():
    """创建风险复核记录"""
    data = request.get_json()
    
    # 检查案件是否存在
    case = Case.query.get(data.get('case_id'))
    if not case:
        return jsonify({'error': '案件不存在'}), 404
    
    review = RiskReview(
        case_id=data.get('case_id'),
        risk_type=data.get('risk_type'),
        risk_level=data.get('risk_level'),
        risk_description=data.get('risk_description'),
        reviewer=data.get('reviewer'),
        review_comment=data.get('review_comment')
    )
    
    db.session.add(review)
    db.session.commit()
    
    return jsonify(review.to_dict()), 201

@risk_bp.route('/auto-create', methods=['POST'])
def auto_create_risk_reviews():
    """自动创建风险复核记录"""
    # 先检测风险
    detect_result = detect_risks().get_json()
    detected_risks = detect_result.get('detected_risks', [])
    
    created_count = 0
    errors = []
    
    for risk in detected_risks:
        try:
            # 检查是否已存在未解决的相同风险
            existing = RiskReview.query.filter_by(
                case_id=risk.get('case_id'),
                risk_type=risk.get('risk_type'),
                risk_description=risk.get('risk_description'),
                is_resolved=False
            ).first()
            
            if existing:
                continue
            
            review = RiskReview(
                case_id=risk.get('case_id'),
                risk_type=risk.get('risk_type'),
                risk_level=risk.get('risk_level'),
                risk_description=risk.get('risk_description'),
                reviewer='系统自动检测',
                review_comment=f'系统自动检测到风险，请相关人员复核处理。详情：{str(risk.get("details", {}))}'
            )
            
            db.session.add(review)
            created_count += 1
        except Exception as e:
            errors.append(f'创建风险记录失败: {str(e)}')
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'提交失败: {str(e)}'}), 500
    
    return jsonify({
        'created_count': created_count,
        'errors': errors,
        'message': f'成功创建 {created_count} 条风险复核记录'
    }), 201

@risk_bp.route('/<int:review_id>/resolve', methods=['PUT'])
def resolve_risk_review(review_id):
    """解决风险复核记录"""
    review = RiskReview.query.get_or_404(review_id)
    data = request.get_json()
    
    if review.is_resolved:
        return jsonify({'error': '该风险已解决'}), 400
    
    review.is_resolved = True
    review.resolution_time = datetime.now()
    
    if data.get('resolution_comment'):
        review.review_comment += f'\n处理备注: {data.get("resolution_comment")}'
    
    db.session.commit()
    
    return jsonify(review.to_dict())

@risk_bp.route('/<int:review_id>', methods=['PUT'])
def update_risk_review(review_id):
    """更新风险复核记录"""
    review = RiskReview.query.get_or_404(review_id)
    data = request.get_json()
    
    # 更新字段
    if 'risk_level' in data:
        review.risk_level = data['risk_level']
    if 'risk_description' in data:
        review.risk_description = data['risk_description']
    if 'reviewer' in data:
        review.reviewer = data['reviewer']
    if 'review_comment' in data:
        review.review_comment = data['review_comment']
    if 'is_resolved' in data:
        review.is_resolved = data['is_resolved']
        if data['is_resolved']:
            review.resolution_time = datetime.now()
    
    db.session.commit()
    
    return jsonify(review.to_dict())

@risk_bp.route('/<int:review_id>', methods=['DELETE'])
def delete_risk_review(review_id):
    """删除风险复核记录"""
    review = RiskReview.query.get_or_404(review_id)
    
    db.session.delete(review)
    db.session.commit()
    
    return jsonify({'message': '风险复核记录删除成功'}), 204
