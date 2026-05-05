from flask import Blueprint, jsonify, request
from extensions import db
from models import InventoryLog, Case, Evidence
from datetime import datetime

inventory_bp = Blueprint('inventory', __name__)

@inventory_bp.route('', methods=['GET'])
def get_all_inventory_logs():
    """获取所有取还库日志"""
    # 检查是否有超期未归还的
    _check_all_overdue()
    
    logs = InventoryLog.query.order_by(InventoryLog.operation_time.desc()).all()
    return jsonify([log.to_dict() for log in logs])

@inventory_bp.route('/<int:log_id>', methods=['GET'])
def get_inventory_log_by_id(log_id):
    """根据ID获取取还库日志"""
    log = InventoryLog.query.get_or_404(log_id)
    # 检查是否超期
    _check_single_overdue(log)
    return jsonify(log.to_dict())

@inventory_bp.route('/case/<int:case_id>', methods=['GET'])
def get_inventory_logs_by_case(case_id):
    """根据案件ID获取取还库日志"""
    # 检查是否有超期未归还的
    _check_all_overdue()
    
    logs = InventoryLog.query.filter_by(case_id=case_id).order_by(InventoryLog.operation_time.desc()).all()
    return jsonify([log.to_dict() for log in logs])

@inventory_bp.route('/evidence/<int:evidence_id>', methods=['GET'])
def get_inventory_logs_by_evidence(evidence_id):
    """根据证物ID获取取还库日志"""
    # 检查是否有超期未归还的
    _check_all_overdue()
    
    logs = InventoryLog.query.filter_by(evidence_id=evidence_id).order_by(InventoryLog.operation_time.desc()).all()
    return jsonify([log.to_dict() for log in logs])

@inventory_bp.route('/borrowed', methods=['GET'])
def get_borrowed_items():
    """获取所有已借出但未归还的项目"""
    # 检查是否有超期未归还的
    _check_all_overdue()
    
    borrowed_logs = InventoryLog.query.filter_by(is_returned=False).all()
    
    return jsonify({
        'borrowed_count': len(borrowed_logs),
        'borrowed_items': [log.to_dict() for log in borrowed_logs]
    })

@inventory_bp.route('/overdue', methods=['GET'])
def get_overdue_borrows():
    """获取所有超期未归还的项目"""
    # 检查是否有超期未归还的
    _check_all_overdue()
    
    overdue_logs = InventoryLog.query.filter_by(is_returned=False, is_overdue=True).all()
    
    return jsonify({
        'overdue_count': len(overdue_logs),
        'overdue_items': [log.to_dict() for log in overdue_logs]
    })

@inventory_bp.route('/check-in', methods=['POST'])
def check_in():
    """入库操作"""
    data = request.get_json()
    
    # 验证必填字段
    required_fields = ['case_id', 'operator', 'location']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    # 检查案件是否存在
    case = Case.query.get(data.get('case_id'))
    if not case:
        return jsonify({'error': '案件不存在'}), 404
    
    # 检查证物是否存在（如果提供了）
    evidence = None
    if data.get('evidence_id'):
        evidence = Evidence.query.get(data.get('evidence_id'))
        if not evidence:
            return jsonify({'error': '证物不存在'}), 404
        
        # 检查证物是否已经入库
        existing_borrowed = InventoryLog.query.filter_by(
            evidence_id=data.get('evidence_id'),
            is_returned=False
        ).first()
        if existing_borrowed:
            return jsonify({'error': '该证物已被借出，无法重复入库'}), 400
    
    log = InventoryLog(
        evidence_id=data.get('evidence_id'),
        case_id=data.get('case_id'),
        operation_type='入库',
        operator=data.get('operator'),
        location=data.get('location'),
        is_returned=True  # 入库默认为已归还状态
    )
    
    db.session.add(log)
    db.session.commit()
    
    return jsonify(log.to_dict()), 201

@inventory_bp.route('/check-out', methods=['POST'])
def check_out():
    """出库（借阅）操作"""
    data = request.get_json()
    
    # 验证必填字段
    required_fields = ['case_id', 'operator', 'borrower', 'location']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    # 检查案件是否存在
    case = Case.query.get(data.get('case_id'))
    if not case:
        return jsonify({'error': '案件不存在'}), 404
    
    # 检查证物是否存在（如果提供了）
    if data.get('evidence_id'):
        evidence = Evidence.query.get(data.get('evidence_id'))
        if not evidence:
            return jsonify({'error': '证物不存在'}), 404
        
        # 检查证物是否已经被借出
        existing_borrowed = InventoryLog.query.filter_by(
            evidence_id=data.get('evidence_id'),
            is_returned=False
        ).first()
        if existing_borrowed:
            return jsonify({'error': '该证物已被借出，无法重复借出'}), 400
    
    # 解析预期归还时间
    expected_return_time = None
    if data.get('expected_return_time'):
        try:
            expected_return_time = datetime.strptime(data.get('expected_return_time'), '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                expected_return_time = datetime.strptime(data.get('expected_return_time'), '%Y-%m-%d')
            except ValueError:
                pass
    
    log = InventoryLog(
        evidence_id=data.get('evidence_id'),
        case_id=data.get('case_id'),
        operation_type='出库',
        operator=data.get('operator'),
        borrower=data.get('borrower'),
        borrow_purpose=data.get('borrow_purpose', ''),
        expected_return_time=expected_return_time,
        location=data.get('location'),
        is_returned=False
    )
    
    db.session.add(log)
    db.session.commit()
    
    return jsonify(log.to_dict()), 201

@inventory_bp.route('/return/<int:log_id>', methods=['PUT'])
def return_item(log_id):
    """归还操作"""
    log = InventoryLog.query.get_or_404(log_id)
    
    # 检查是否已经归还
    if log.is_returned:
        return jsonify({'error': '该项目已归还'}), 400
    
    # 检查操作类型
    if log.operation_type != '出库':
        return jsonify({'error': '只能归还出库的项目'}), 400
    
    log.is_returned = True
    log.actual_return_time = datetime.now()
    
    db.session.commit()
    
    # 创建归还日志
    return_log = InventoryLog(
        evidence_id=log.evidence_id,
        case_id=log.case_id,
        operation_type='归还',
        operator=request.get_json().get('operator', log.operator),
        location=request.get_json().get('location', log.location),
        is_returned=True
    )
    
    db.session.add(return_log)
    db.session.commit()
    
    return jsonify({
        'message': '归还成功',
        'original_log': log.to_dict(),
        'return_log': return_log.to_dict()
    })

@inventory_bp.route('/<int:log_id>', methods=['DELETE'])
def delete_inventory_log(log_id):
    """删除取还库日志"""
    log = InventoryLog.query.get_or_404(log_id)
    
    db.session.delete(log)
    db.session.commit()
    
    return jsonify({'message': '取还库日志删除成功'}), 204

def _check_single_overdue(log):
    """检查单个借阅是否超期"""
    if log.is_returned or log.is_overdue:
        return
    
    if log.expected_return_time:
        now = datetime.now()
        if now > log.expected_return_time:
            log.is_overdue = True
            db.session.commit()

def _check_all_overdue():
    """检查所有未归还的借阅是否超期"""
    borrowed_logs = InventoryLog.query.filter_by(is_returned=False, is_overdue=False).all()
    
    now = datetime.now()
    for log in borrowed_logs:
        if log.expected_return_time and now > log.expected_return_time:
            log.is_overdue = True
    
    db.session.commit()
