from flask import Blueprint, jsonify, request
from extensions import db
from models import Case
from datetime import datetime

cases_bp = Blueprint('cases', __name__)

@cases_bp.route('', methods=['GET'])
def get_all_cases():
    """获取所有案件"""
    cases = Case.query.all()
    return jsonify([case.to_dict() for case in cases])

@cases_bp.route('/<int:case_id>', methods=['GET'])
def get_case_by_id(case_id):
    """根据ID获取案件"""
    case = Case.query.get_or_404(case_id)
    return jsonify(case.to_dict())

@cases_bp.route('/number/<case_number>', methods=['GET'])
def get_case_by_number(case_number):
    """根据案件编号获取案件"""
    case = Case.query.filter_by(case_number=case_number).first_or_404()
    return jsonify(case.to_dict())

@cases_bp.route('', methods=['POST'])
def create_case():
    """创建新案件"""
    data = request.get_json()
    
    # 检查案件编号是否已存在
    existing_case = Case.query.filter_by(case_number=data.get('case_number')).first()
    if existing_case:
        return jsonify({'error': '案件编号已存在'}), 400
    
    # 解析日期
    try:
        entrust_date = datetime.strptime(data.get('entrust_date'), '%Y-%m-%d').date()
        deadline = datetime.strptime(data.get('deadline'), '%Y-%m-%d').date()
    except ValueError as e:
        return jsonify({'error': f'日期格式错误: {str(e)}'}), 400
    
    case = Case(
        case_number=data.get('case_number'),
        case_name=data.get('case_name'),
        case_type=data.get('case_type'),
        entrusted_by=data.get('entrusted_by'),
        entrust_date=entrust_date,
        deadline=deadline,
        case_status=data.get('case_status', '待处理')
    )
    
    db.session.add(case)
    db.session.commit()
    
    return jsonify(case.to_dict()), 201

@cases_bp.route('/import', methods=['POST'])
def import_cases():
    """批量导入委托单"""
    data_list = request.get_json()
    if not isinstance(data_list, list):
        return jsonify({'error': '导入数据格式错误，应为数组'}), 400
    
    imported_count = 0
    failed_count = 0
    errors = []
    
    for i, data in enumerate(data_list):
        try:
            # 检查案件编号是否已存在
            existing_case = Case.query.filter_by(case_number=data.get('case_number')).first()
            if existing_case:
                errors.append(f"第{i+1}条: 案件编号 {data.get('case_number')} 已存在")
                failed_count += 1
                continue
            
            # 解析日期
            try:
                entrust_date = datetime.strptime(data.get('entrust_date'), '%Y-%m-%d').date()
                deadline = datetime.strptime(data.get('deadline'), '%Y-%m-%d').date()
            except ValueError as e:
                errors.append(f"第{i+1}条: 日期格式错误: {str(e)}")
                failed_count += 1
                continue
            
            case = Case(
                case_number=data.get('case_number'),
                case_name=data.get('case_name'),
                case_type=data.get('case_type'),
                entrusted_by=data.get('entrusted_by'),
                entrust_date=entrust_date,
                deadline=deadline,
                case_status=data.get('case_status', '待处理')
            )
            
            db.session.add(case)
            imported_count += 1
        except Exception as e:
            errors.append(f"第{i+1}条: 导入失败: {str(e)}")
            failed_count += 1
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'提交失败: {str(e)}'}), 500
    
    result = {
        'imported_count': imported_count,
        'failed_count': failed_count,
        'errors': errors
    }
    
    return jsonify(result), 201

@cases_bp.route('/<int:case_id>', methods=['PUT'])
def update_case(case_id):
    """更新案件信息"""
    case = Case.query.get_or_404(case_id)
    data = request.get_json()
    
    # 检查案件编号是否与其他案件冲突
    if 'case_number' in data and data['case_number'] != case.case_number:
        existing_case = Case.query.filter_by(case_number=data['case_number']).first()
        if existing_case:
            return jsonify({'error': '案件编号已存在'}), 400
    
    # 更新字段
    if 'case_number' in data:
        case.case_number = data['case_number']
    if 'case_name' in data:
        case.case_name = data['case_name']
    if 'case_type' in data:
        case.case_type = data['case_type']
    if 'entrusted_by' in data:
        case.entrusted_by = data['entrusted_by']
    if 'case_status' in data:
        case.case_status = data['case_status']
    
    # 解析日期
    if 'entrust_date' in data:
        try:
            case.entrust_date = datetime.strptime(data['entrust_date'], '%Y-%m-%d').date()
        except ValueError as e:
            return jsonify({'error': f'委托日期格式错误: {str(e)}'}), 400
    
    if 'deadline' in data:
        try:
            case.deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
        except ValueError as e:
            return jsonify({'error': f'截止日期格式错误: {str(e)}'}), 400
    
    db.session.commit()
    
    return jsonify(case.to_dict())

@cases_bp.route('/<int:case_id>', methods=['DELETE'])
def delete_case(case_id):
    """删除案件"""
    case = Case.query.get_or_404(case_id)
    
    db.session.delete(case)
    db.session.commit()
    
    return jsonify({'message': '案件删除成功'}), 204

@cases_bp.route('/search', methods=['GET'])
def search_cases():
    """搜索案件"""
    keyword = request.args.get('keyword', '')
    case_type = request.args.get('case_type', '')
    status = request.args.get('status', '')
    
    query = Case.query
    
    if keyword:
        query = query.filter(
            (Case.case_number.contains(keyword)) |
            (Case.case_name.contains(keyword)) |
            (Case.entrusted_by.contains(keyword))
        )
    
    if case_type:
        query = query.filter_by(case_type=case_type)
    
    if status:
        query = query.filter_by(case_status=status)
    
    cases = query.all()
    
    return jsonify([case.to_dict() for case in cases])
