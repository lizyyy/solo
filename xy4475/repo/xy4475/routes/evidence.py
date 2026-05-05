from flask import Blueprint, jsonify, request
from extensions import db
from models import Evidence, SealRecord, Case
from datetime import datetime

evidence_bp = Blueprint('evidence', __name__)

@evidence_bp.route('', methods=['GET'])
def get_all_evidences():
    """获取所有证物"""
    evidences = Evidence.query.all()
    return jsonify([evidence.to_dict() for evidence in evidences])

@evidence_bp.route('/<int:evidence_id>', methods=['GET'])
def get_evidence_by_id(evidence_id):
    """根据ID获取证物"""
    evidence = Evidence.query.get_or_404(evidence_id)
    return jsonify(evidence.to_dict())

@evidence_bp.route('/number/<evidence_number>', methods=['GET'])
def get_evidence_by_number(evidence_number):
    """根据证物编号获取证物"""
    evidence = Evidence.query.filter_by(evidence_number=evidence_number).first_or_404()
    return jsonify(evidence.to_dict())

@evidence_bp.route('/seal/<seal_number>', methods=['GET'])
def get_evidence_by_seal(seal_number):
    """根据封签编号获取证物"""
    evidence = Evidence.query.filter_by(seal_number=seal_number).first_or_404()
    return jsonify(evidence.to_dict())

@evidence_bp.route('/case/<int:case_id>', methods=['GET'])
def get_evidences_by_case(case_id):
    """根据案件ID获取证物"""
    evidences = Evidence.query.filter_by(case_id=case_id).all()
    return jsonify([evidence.to_dict() for evidence in evidences])

@evidence_bp.route('', methods=['POST'])
def create_evidence():
    """创建新证物"""
    data = request.get_json()
    
    # 检查证物编号是否已存在
    existing_evidence = Evidence.query.filter_by(evidence_number=data.get('evidence_number')).first()
    if existing_evidence:
        return jsonify({'error': '证物编号已存在'}), 400
    
    # 检查封签编号是否已存在
    existing_seal = Evidence.query.filter_by(seal_number=data.get('seal_number')).first()
    if existing_seal:
        return jsonify({'error': '封签编号已存在'}), 400
    
    # 检查案件是否存在
    case = Case.query.get(data.get('case_id'))
    if not case:
        return jsonify({'error': '案件不存在'}), 404
    
    evidence = Evidence(
        evidence_number=data.get('evidence_number'),
        evidence_name=data.get('evidence_name'),
        evidence_type=data.get('evidence_type'),
        seal_number=data.get('seal_number'),
        case_id=data.get('case_id')
    )
    
    db.session.add(evidence)
    db.session.commit()
    
    return jsonify(evidence.to_dict()), 201

@evidence_bp.route('/scan', methods=['POST'])
def scan_seal():
    """封签扫码（防止断链）"""
    data = request.get_json()
    
    # 验证必填字段
    required_fields = ['seal_number', 'operation', 'operator', 'location']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    # 查找证物
    evidence = Evidence.query.filter_by(seal_number=data.get('seal_number')).first()
    if not evidence:
        # 尝试查找封签记录
        seal_record = SealRecord.query.filter_by(seal_number=data.get('seal_number')).first()
        if seal_record:
            evidence = Evidence.query.get(seal_record.evidence_id)
        if not evidence:
            return jsonify({'error': '未找到对应证物'}), 404
    
    # 检查封签链完整性
    last_seal_record = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time.desc()).first()
    
    # 验证操作合法性
    if data['operation'] == '解封':
        # 解封必须有有效的封签记录
        if last_seal_record and last_seal_record.operation == '解封':
            return jsonify({'error': '该证物已处于解封状态，不能再次解封'}), 400
        
        # 创建解封记录
        seal_record = SealRecord(
            evidence_id=evidence.id,
            operation='解封',
            operator=data['operator'],
            seal_number=data['seal_number'],
            location=data['location'],
            purpose=data.get('purpose', ''),
            previous_seal=None,
            next_seal=None,
            is_chain_complete=False  # 解封后封签链中断
        )
        
        db.session.add(seal_record)
        
        # 如果有上一个记录，更新链信息
        if last_seal_record:
            last_seal_record.next_seal = data['seal_number']
            seal_record.previous_seal = last_seal_record.seal_number
        
    elif data['operation'] == '封签':
        # 封签必须有有效的解封记录，或者是首次封签
        if last_seal_record and last_seal_record.operation == '封签':
            return jsonify({'error': '该证物已处于封签状态，不能再次封签'}), 400
        
        # 检查是否需要新的封签编号
        if data.get('new_seal_number'):
            # 验证新封签编号是否已存在
            existing_evidence = Evidence.query.filter_by(seal_number=data['new_seal_number']).first()
            if existing_evidence:
                return jsonify({'error': '新封签编号已被其他证物使用'}), 400
            
            existing_record = SealRecord.query.filter_by(seal_number=data['new_seal_number']).first()
            if existing_record:
                return jsonify({'error': '新封签编号已被使用'}), 400
            
            # 更新证物的当前封签编号
            evidence.seal_number = data['new_seal_number']
            seal_number_to_use = data['new_seal_number']
        else:
            seal_number_to_use = data['seal_number']
        
        # 创建封签记录
        seal_record = SealRecord(
            evidence_id=evidence.id,
            operation='封签',
            operator=data['operator'],
            seal_number=seal_number_to_use,
            location=data['location'],
            purpose=data.get('purpose', ''),
            previous_seal=None,
            next_seal=None,
            is_chain_complete=True  # 封签后封签链完整
        )
        
        db.session.add(seal_record)
        
        # 如果有上一个记录，更新链信息
        if last_seal_record:
            last_seal_record.next_seal = seal_number_to_use
            seal_record.previous_seal = last_seal_record.seal_number
        
        # 检查所有历史记录，确保封签链完整
        all_seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time).all()
        for i in range(1, len(all_seal_records)):
            prev = all_seal_records[i-1]
            curr = all_seal_records[i]
            if prev.next_seal != curr.seal_number or curr.previous_seal != prev.seal_number:
                curr.is_chain_complete = False
        
    else:
        return jsonify({'error': '无效的操作类型，只能是"封签"或"解封"'}), 400
    
    db.session.commit()
    
    # 检查封签链完整性
    all_records = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time).all()
    chain_complete = True
    for record in all_records:
        if not record.is_chain_complete:
            chain_complete = False
            break
    
    result = {
        'message': f'{data["operation"]}操作成功',
        'evidence': evidence.to_dict(),
        'seal_record': seal_record.to_dict(),
        'chain_complete': chain_complete
    }
    
    return jsonify(result), 201

@evidence_bp.route('/<int:evidence_id>/seal-history', methods=['GET'])
def get_seal_history(evidence_id):
    """获取证物的封签历史"""
    evidence = Evidence.query.get_or_404(evidence_id)
    seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time).all()
    
    # 检查封签链完整性
    chain_complete = True
    for record in seal_records:
        if not record.is_chain_complete:
            chain_complete = False
            break
    
    return jsonify({
        'evidence': evidence.to_dict(),
        'chain_complete': chain_complete,
        'seal_records': [record.to_dict() for record in seal_records]
    })

@evidence_bp.route('/broken-chains', methods=['GET'])
def get_broken_chains():
    """获取所有封签断链的证物"""
    # 找到所有有封签记录但链不完整的证物
    broken_records = SealRecord.query.filter_by(is_chain_complete=False).all()
    
    broken_evidence_ids = set()
    for record in broken_records:
        broken_evidence_ids.add(record.evidence_id)
    
    broken_evidences = []
    for evidence_id in broken_evidence_ids:
        evidence = Evidence.query.get(evidence_id)
        if evidence:
            # 获取该证物的封签历史
            seal_records = SealRecord.query.filter_by(evidence_id=evidence_id).order_by(SealRecord.operation_time).all()
            broken_evidences.append({
                'evidence': evidence.to_dict(),
                'seal_records': [record.to_dict() for record in seal_records]
            })
    
    return jsonify({
        'broken_chain_count': len(broken_evidences),
        'broken_chains': broken_evidences
    })

@evidence_bp.route('/<int:evidence_id>', methods=['PUT'])
def update_evidence(evidence_id):
    """更新证物信息"""
    evidence = Evidence.query.get_or_404(evidence_id)
    data = request.get_json()
    
    # 检查证物编号是否与其他证物冲突
    if 'evidence_number' in data and data['evidence_number'] != evidence.evidence_number:
        existing_evidence = Evidence.query.filter_by(evidence_number=data['evidence_number']).first()
        if existing_evidence:
            return jsonify({'error': '证物编号已存在'}), 400
    
    # 检查封签编号是否与其他证物冲突
    if 'seal_number' in data and data['seal_number'] != evidence.seal_number:
        existing_seal = Evidence.query.filter_by(seal_number=data['seal_number']).first()
        if existing_seal:
            return jsonify({'error': '封签编号已存在'}), 400
    
    # 更新字段
    if 'evidence_number' in data:
        evidence.evidence_number = data['evidence_number']
    if 'evidence_name' in data:
        evidence.evidence_name = data['evidence_name']
    if 'evidence_type' in data:
        evidence.evidence_type = data['evidence_type']
    if 'seal_number' in data:
        evidence.seal_number = data['seal_number']
    if 'case_id' in data:
        # 检查案件是否存在
        case = Case.query.get(data['case_id'])
        if not case:
            return jsonify({'error': '案件不存在'}), 404
        evidence.case_id = data['case_id']
    
    db.session.commit()
    
    return jsonify(evidence.to_dict())

@evidence_bp.route('/<int:evidence_id>', methods=['DELETE'])
def delete_evidence(evidence_id):
    """删除证物"""
    evidence = Evidence.query.get_or_404(evidence_id)
    
    db.session.delete(evidence)
    db.session.commit()
    
    return jsonify({'message': '证物删除成功'}), 204
