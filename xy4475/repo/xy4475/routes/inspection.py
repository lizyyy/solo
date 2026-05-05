from flask import Blueprint, jsonify, request
from extensions import db
from models import Inspection, Case
from datetime import datetime
from dateutil.relativedelta import relativedelta

inspection_bp = Blueprint('inspection', __name__)

@inspection_bp.route('', methods=['GET'])
def get_all_inspections():
    """获取所有检验记录"""
    inspections = Inspection.query.all()
    # 检查是否超期
    for inspection in inspections:
        _check_overdue(inspection)
    db.session.commit()
    return jsonify([inspection.to_dict() for inspection in inspections])

@inspection_bp.route('/<int:inspection_id>', methods=['GET'])
def get_inspection_by_id(inspection_id):
    """根据ID获取检验记录"""
    inspection = Inspection.query.get_or_404(inspection_id)
    _check_overdue(inspection)
    db.session.commit()
    return jsonify(inspection.to_dict())

@inspection_bp.route('/case/<int:case_id>', methods=['GET'])
def get_inspections_by_case(case_id):
    """根据案件ID获取检验记录"""
    inspections = Inspection.query.filter_by(case_id=case_id).order_by(Inspection.inspection_step).all()
    # 检查是否超期
    for inspection in inspections:
        _check_overdue(inspection)
    db.session.commit()
    return jsonify([inspection.to_dict() for inspection in inspections])

@inspection_bp.route('', methods=['POST'])
def create_inspection():
    """创建新检验步骤"""
    data = request.get_json()
    
    # 检查案件是否存在
    case = Case.query.get(data.get('case_id'))
    if not case:
        return jsonify({'error': '案件不存在'}), 404
    
    # 检查步骤是否已存在
    existing_inspection = Inspection.query.filter_by(
        case_id=data.get('case_id'),
        inspection_step=data.get('inspection_step')
    ).first()
    if existing_inspection:
        return jsonify({'error': '该步骤已存在'}), 400
    
    # 解析时间
    start_time = datetime.now()
    if data.get('start_time'):
        try:
            start_time = datetime.strptime(data.get('start_time'), '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                start_time = datetime.strptime(data.get('start_time'), '%Y-%m-%d')
            except ValueError:
                pass
    
    end_time = None
    if data.get('end_time'):
        try:
            end_time = datetime.strptime(data.get('end_time'), '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                end_time = datetime.strptime(data.get('end_time'), '%Y-%m-%d')
            except ValueError:
                pass
    
    inspection = Inspection(
        case_id=data.get('case_id'),
        inspection_step=data.get('inspection_step'),
        step_name=data.get('step_name'),
        inspector=data.get('inspector'),
        start_time=start_time,
        end_time=end_time,
        status=data.get('status', '进行中'),
        result=data.get('result')
    )
    
    # 检查是否超期
    _check_overdue(inspection)
    
    db.session.add(inspection)
    db.session.commit()
    
    return jsonify(inspection.to_dict()), 201

@inspection_bp.route('/<int:inspection_id>/complete', methods=['PUT'])
def complete_inspection(inspection_id):
    """完成检验步骤"""
    inspection = Inspection.query.get_or_404(inspection_id)
    data = request.get_json()
    
    # 不能重复完成
    if inspection.status == '已完成':
        return jsonify({'error': '该检验步骤已完成'}), 400
    
    inspection.status = '已完成'
    inspection.end_time = datetime.now()
    inspection.result = data.get('result', '')
    
    db.session.commit()
    
    return jsonify(inspection.to_dict())

@inspection_bp.route('/overdue', methods=['GET'])
def get_overdue_inspections():
    """获取所有超期的检验"""
    # 首先检查所有进行中的检验是否超期
    ongoing_inspections = Inspection.query.filter_by(status='进行中').all()
    for inspection in ongoing_inspections:
        _check_overdue(inspection)
    db.session.commit()
    
    # 获取所有超期的检验
    overdue_inspections = Inspection.query.filter_by(is_overdue=True).all()
    
    return jsonify({
        'overdue_count': len(overdue_inspections),
        'overdue_inspections': [inspection.to_dict() for inspection in overdue_inspections]
    })

@inspection_bp.route('/<int:inspection_id>', methods=['PUT'])
def update_inspection(inspection_id):
    """更新检验信息"""
    inspection = Inspection.query.get_or_404(inspection_id)
    data = request.get_json()
    
    # 检查步骤是否与其他步骤冲突
    if 'inspection_step' in data and data['inspection_step'] != inspection.inspection_step:
        existing_inspection = Inspection.query.filter_by(
            case_id=inspection.case_id,
            inspection_step=data['inspection_step']
        ).first()
        if existing_inspection:
            return jsonify({'error': '该步骤已存在'}), 400
    
    # 更新字段
    if 'inspection_step' in data:
        inspection.inspection_step = data['inspection_step']
    if 'step_name' in data:
        inspection.step_name = data['step_name']
    if 'inspector' in data:
        inspection.inspector = data['inspector']
    if 'status' in data:
        inspection.status = data['status']
    if 'result' in data:
        inspection.result = data['result']
    
    # 解析时间
    if 'start_time' in data:
        try:
            inspection.start_time = datetime.strptime(data['start_time'], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                inspection.start_time = datetime.strptime(data['start_time'], '%Y-%m-%d')
            except ValueError:
                pass
    
    if 'end_time' in data:
        if data['end_time']:
            try:
                inspection.end_time = datetime.strptime(data['end_time'], '%Y-%m-%d %H:%M:%S')
            except ValueError:
                try:
                    inspection.end_time = datetime.strptime(data['end_time'], '%Y-%m-%d')
                except ValueError:
                    pass
        else:
            inspection.end_time = None
    
    # 检查是否超期
    _check_overdue(inspection)
    
    db.session.commit()
    
    return jsonify(inspection.to_dict())

@inspection_bp.route('/<int:inspection_id>', methods=['DELETE'])
def delete_inspection(inspection_id):
    """删除检验记录"""
    inspection = Inspection.query.get_or_404(inspection_id)
    
    db.session.delete(inspection)
    db.session.commit()
    
    return jsonify({'message': '检验记录删除成功'}), 204

def _check_overdue(inspection):
    """检查检验是否超期"""
    if inspection.status == '已完成' or inspection.is_overdue:
        return
    
    # 获取案件的截止日期
    case = Case.query.get(inspection.case_id)
    if not case:
        return
    
    # 如果检验开始时间超过了案件截止日期，标记为超期
    now = datetime.now()
    deadline = datetime.combine(case.deadline, datetime.min.time())
    
    if now > deadline:
        inspection.is_overdue = True
