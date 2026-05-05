from flask import Blueprint, jsonify, request
from extensions import db
from models import Case, Evidence, SealRecord, Inspection, InventoryLog, RiskReview
from datetime import datetime

query_bp = Blueprint('query', __name__)

@query_bp.route('/case/<int:case_id>', methods=['GET'])
def query_case_full(case_id):
    """查询案件的完整信息，包括所有关联数据"""
    # 获取案件基本信息
    case = Case.query.get_or_404(case_id)
    
    # 获取证物信息
    evidences = Evidence.query.filter_by(case_id=case_id).all()
    evidence_list = []
    for evidence in evidences:
        # 获取证物的封签历史
        seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time).all()
        
        # 获取证物的取还库日志
        inventory_logs = InventoryLog.query.filter_by(evidence_id=evidence.id).order_by(InventoryLog.operation_time.desc()).all()
        
        evidence_list.append({
            'evidence': evidence.to_dict(),
            'seal_records': [record.to_dict() for record in seal_records],
            'inventory_logs': [log.to_dict() for log in inventory_logs]
        })
    
    # 获取检验记录
    inspections = Inspection.query.filter_by(case_id=case_id).order_by(Inspection.inspection_step).all()
    
    # 获取取还库日志（按案件）
    inventory_logs = InventoryLog.query.filter_by(case_id=case_id).order_by(InventoryLog.operation_time.desc()).all()
    
    # 获取风险复核记录
    risk_reviews = RiskReview.query.filter_by(case_id=case_id).order_by(RiskReview.review_time.desc()).all()
    
    # 统计风险信息
    unresolved_risks = RiskReview.query.filter_by(case_id=case_id, is_resolved=False).count()
    high_risk_risks = RiskReview.query.filter_by(case_id=case_id, risk_level='高', is_resolved=False).count()
    
    # 统计封签链状态
    broken_chain = False
    for evidence in evidences:
        seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).all()
        for record in seal_records:
            if not record.is_chain_complete:
                broken_chain = True
                break
        if broken_chain:
            break
    
    # 统计检验超期
    overdue_inspections = Inspection.query.filter_by(case_id=case_id, is_overdue=True, status='进行中').count()
    
    # 统计借阅未归还
    unreturned_items = InventoryLog.query.filter_by(case_id=case_id, is_returned=False).count()
    overdue_items = InventoryLog.query.filter_by(case_id=case_id, is_returned=False, is_overdue=True).count()
    
    result = {
        'case': case.to_dict(),
        'evidences': evidence_list,
        'inspections': [inspection.to_dict() for inspection in inspections],
        'inventory_logs': [log.to_dict() for log in inventory_logs],
        'risk_reviews': [review.to_dict() for review in risk_reviews],
        'statistics': {
            'evidence_count': len(evidences),
            'inspection_count': len(inspections),
            'inventory_log_count': len(inventory_logs),
            'risk_review_count': len(risk_reviews),
            'unresolved_risks': unresolved_risks,
            'high_risk_risks': high_risk_risks,
            'broken_chain': broken_chain,
            'overdue_inspections': overdue_inspections,
            'unreturned_items': unreturned_items,
            'overdue_items': overdue_items
        }
    }
    
    return jsonify(result)

@query_bp.route('/case/number/<case_number>', methods=['GET'])
def query_case_by_number(case_number):
    """根据案件编号查询案件的完整信息"""
    case = Case.query.filter_by(case_number=case_number).first_or_404()
    return query_case_full(case.id)

@query_bp.route('/cases', methods=['GET'])
def query_cases_with_filters():
    """查询案件列表，支持多种筛选条件"""
    query = Case.query
    
    # 基础筛选
    case_type = request.args.get('case_type', '')
    if case_type:
        query = query.filter_by(case_type=case_type)
    
    status = request.args.get('status', '')
    if status:
        query = query.filter_by(case_status=status)
    
    keyword = request.args.get('keyword', '')
    if keyword:
        query = query.filter(
            (Case.case_number.contains(keyword)) |
            (Case.case_name.contains(keyword)) |
            (Case.entrusted_by.contains(keyword))
        )
    
    # 日期范围筛选
    start_date = request.args.get('start_date', '')
    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(Case.entrust_date >= start_date_obj)
        except ValueError:
            pass
    
    end_date = request.args.get('end_date', '')
    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(Case.entrust_date <= end_date_obj)
        except ValueError:
            pass
    
    # 风险状态筛选
    has_risk = request.args.get('has_risk', '')
    if has_risk:
        # 获取有未解决风险的案件ID
        risk_case_ids = db.session.query(RiskReview.case_id).filter_by(is_resolved=False).distinct().all()
        risk_case_ids = [id[0] for id in risk_case_ids]
        if has_risk == 'true':
            query = query.filter(Case.id.in_(risk_case_ids))
        elif has_risk == 'false':
            query = query.filter(~Case.id.in_(risk_case_ids))
    
    # 封签断链筛选
    has_broken_chain = request.args.get('has_broken_chain', '')
    if has_broken_chain:
        # 获取有封签断链的案件ID
        broken_chain_evidence_ids = db.session.query(SealRecord.evidence_id).filter_by(is_chain_complete=False).distinct().all()
        broken_chain_evidence_ids = [id[0] for id in broken_chain_evidence_ids]
        
        broken_chain_case_ids = db.session.query(Evidence.case_id).filter(Evidence.id.in_(broken_chain_evidence_ids)).distinct().all()
        broken_chain_case_ids = [id[0] for id in broken_chain_case_ids]
        
        if has_broken_chain == 'true':
            query = query.filter(Case.id.in_(broken_chain_case_ids))
        elif has_broken_chain == 'false':
            query = query.filter(~Case.id.in_(broken_chain_case_ids))
    
    # 检验超期筛选
    has_overdue_inspection = request.args.get('has_overdue_inspection', '')
    if has_overdue_inspection:
        # 获取有检验超期的案件ID
        overdue_inspection_case_ids = db.session.query(Inspection.case_id).filter_by(is_overdue=True, status='进行中').distinct().all()
        overdue_inspection_case_ids = [id[0] for id in overdue_inspection_case_ids]
        
        if has_overdue_inspection == 'true':
            query = query.filter(Case.id.in_(overdue_inspection_case_ids))
        elif has_overdue_inspection == 'false':
            query = query.filter(~Case.id.in_(overdue_inspection_case_ids))
    
    # 借阅未归还筛选
    has_unreturned = request.args.get('has_unreturned', '')
    if has_unreturned:
        # 获取有借阅未归还的案件ID
        unreturned_case_ids = db.session.query(InventoryLog.case_id).filter_by(is_returned=False).distinct().all()
        unreturned_case_ids = [id[0] for id in unreturned_case_ids]
        
        if has_unreturned == 'true':
            query = query.filter(Case.id.in_(unreturned_case_ids))
        elif has_unreturned == 'false':
            query = query.filter(~Case.id.in_(unreturned_case_ids))
    
    # 排序
    sort_by = request.args.get('sort_by', 'create_time')
    sort_order = request.args.get('sort_order', 'desc')
    
    if sort_by == 'case_number':
        sort_column = Case.case_number
    elif sort_by == 'case_name':
        sort_column = Case.case_name
    elif sort_by == 'entrust_date':
        sort_column = Case.entrust_date
    elif sort_by == 'deadline':
        sort_column = Case.deadline
    else:
        sort_column = Case.create_time
    
    if sort_order == 'asc':
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    
    # 分页
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    cases = pagination.items
    
    # 为每个案件添加统计信息
    case_list = []
    for case in cases:
        # 统计风险信息
        unresolved_risks = RiskReview.query.filter_by(case_id=case.id, is_resolved=False).count()
        
        # 统计封签链状态
        broken_chain = False
        evidences = Evidence.query.filter_by(case_id=case.id).all()
        for evidence in evidences:
            seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).all()
            for record in seal_records:
                if not record.is_chain_complete:
                    broken_chain = True
                    break
            if broken_chain:
                break
        
        # 统计检验超期
        overdue_inspections = Inspection.query.filter_by(case_id=case.id, is_overdue=True, status='进行中').count()
        
        # 统计借阅未归还
        unreturned_items = InventoryLog.query.filter_by(case_id=case.id, is_returned=False).count()
        
        case_dict = case.to_dict()
        case_dict.update({
            'unresolved_risks': unresolved_risks,
            'broken_chain': broken_chain,
            'overdue_inspections': overdue_inspections,
            'unreturned_items': unreturned_items
        })
        
        case_list.append(case_dict)
    
    result = {
        'cases': case_list,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages,
            'has_prev': pagination.has_prev,
            'has_next': pagination.has_next
        }
    }
    
    return jsonify(result)

@query_bp.route('/risks/summary', methods=['GET'])
def query_risk_summary():
    """查询风险汇总信息"""
    # 未解决的风险总数
    unresolved_total = RiskReview.query.filter_by(is_resolved=False).count()
    
    # 按风险类型统计
    risk_type_stats = db.session.query(
        RiskReview.risk_type,
        db.func.count(RiskReview.id).label('count')
    ).filter_by(is_resolved=False).group_by(RiskReview.risk_type).all()
    
    # 按风险级别统计
    risk_level_stats = db.session.query(
        RiskReview.risk_level,
        db.func.count(RiskReview.id).label('count')
    ).filter_by(is_resolved=False).group_by(RiskReview.risk_level).all()
    
    # 封签断链的证物数量
    broken_chain_evidence_ids = db.session.query(SealRecord.evidence_id).filter_by(is_chain_complete=False).distinct().all()
    broken_chain_count = len(broken_chain_evidence_ids)
    
    # 检验超期数量
    overdue_inspection_count = Inspection.query.filter_by(is_overdue=True, status='进行中').count()
    
    # 借阅未归还数量
    unreturned_count = InventoryLog.query.filter_by(is_returned=False).count()
    overdue_count = InventoryLog.query.filter_by(is_returned=False, is_overdue=True).count()
    
    # 有风险的案件数量
    risk_case_ids = db.session.query(RiskReview.case_id).filter_by(is_resolved=False).distinct().all()
    risk_case_count = len(risk_case_ids)
    
    result = {
        'summary': {
            'unresolved_risk_total': unresolved_total,
            'broken_chain_count': broken_chain_count,
            'overdue_inspection_count': overdue_inspection_count,
            'unreturned_item_count': unreturned_count,
            'overdue_item_count': overdue_count,
            'risk_case_count': risk_case_count
        },
        'risk_type_stats': [{'risk_type': stat.risk_type, 'count': stat.count} for stat in risk_type_stats],
        'risk_level_stats': [{'risk_level': stat.risk_level, 'count': stat.count} for stat in risk_level_stats]
    }
    
    return jsonify(result)
