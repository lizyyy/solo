from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import json
import hashlib

from models import db, Contract, Signer, SignException, SignLog, ContractVersion, SignEvidence
from models import ContractStatus, SignerStatus, ExceptionType, ExceptionStatus

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../database/esigndb.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)
db.init_app(app)


def model_to_dict(model):
    result = {}
    for column in model.__table__.columns:
        value = getattr(model, column.name)
        if isinstance(value, datetime):
            result[column.name] = value.isoformat()
        elif hasattr(value, 'value'):
            result[column.name] = value.value
        else:
            result[column.name] = value
    return result


@app.route('/api/contracts', methods=['GET'])
def get_contracts():
    contracts = Contract.query.all()
    return jsonify([model_to_dict(c) for c in contracts])


@app.route('/api/contracts/<int:contract_id>', methods=['GET'])
def get_contract(contract_id):
    contract = Contract.query.get_or_404(contract_id)
    result = model_to_dict(contract)
    result['signers'] = [model_to_dict(s) for s in contract.signers]
    result['versions'] = [model_to_dict(v) for v in contract.versions]
    return jsonify(result)


@app.route('/api/contracts', methods=['POST'])
def create_contract():
    data = request.json
    contract = Contract(
        title=data['title'],
        content=data.get('content', ''),
        created_by=data.get('created_by', 'system')
    )
    db.session.add(contract)
    db.session.flush()
    
    version = ContractVersion(
        contract_id=contract.id,
        version=contract.version,
        content=contract.content,
        change_log='初始版本',
        created_by=contract.created_by
    )
    db.session.add(version)
    db.session.commit()
    
    return jsonify(model_to_dict(contract)), 201


@app.route('/api/contracts/<int:contract_id>/signers', methods=['POST'])
def add_signer(contract_id):
    contract = Contract.query.get_or_404(contract_id)
    data = request.json
    
    original_input = {
        'name': data['name'],
        'phone': data['phone'],
        'email': data.get('email'),
        'id_card': data.get('id_card')
    }
    
    signer = Signer(
        contract_id=contract_id,
        name=data['name'],
        phone=data['phone'],
        email=data.get('email'),
        id_card=data.get('id_card'),
        order=data['order'],
        original_input=original_input
    )
    db.session.add(signer)
    db.session.commit()
    
    return jsonify(model_to_dict(signer)), 201


@app.route('/api/contracts/<int:contract_id>/start', methods=['POST'])
def start_signing(contract_id):
    contract = Contract.query.get_or_404(contract_id)
    contract.status = ContractStatus.IN_PROGRESS
    db.session.commit()
    return jsonify(model_to_dict(contract))


@app.route('/api/exceptions', methods=['GET'])
def get_exceptions():
    exceptions = SignException.query.order_by(SignException.created_at.desc()).all()
    result = []
    for exc in exceptions:
        exc_dict = model_to_dict(exc)
        if exc.signer:
            exc_dict['signer_name'] = exc.signer.name
            exc_dict['signer_phone'] = exc.signer.phone
        if exc.contract:
            exc_dict['contract_title'] = exc.contract.title
        result.append(exc_dict)
    return jsonify(result)


@app.route('/api/exceptions/<int:exception_id>', methods=['GET'])
def get_exception(exception_id):
    exc = SignException.query.get_or_404(exception_id)
    result = model_to_dict(exc)
    if exc.signer:
        result['signer'] = model_to_dict(exc.signer)
    if exc.contract:
        result['contract'] = model_to_dict(exc.contract)
    return jsonify(result)


@app.route('/api/exceptions/<int:exception_id>/handle', methods=['POST'])
def handle_exception(exception_id):
    exc = SignException.query.get_or_404(exception_id)
    data = request.json
    
    exc.status = ExceptionStatus.PROCESSING if data.get('status') == 'processing' else ExceptionStatus.RESOLVED
    exc.handled_by = data.get('handled_by', 'admin')
    exc.handled_at = datetime.utcnow()
    exc.handling_notes = data.get('handling_notes', '')
    
    if exc.status == ExceptionStatus.RESOLVED:
        if exc.signer:
            exc.signer.status = SignerStatus.PENDING
            exc.signer.processed_result = {
                'resolution': data.get('handling_notes'),
                'handled_by': exc.handled_by,
                'handled_at': exc.handled_at.isoformat()
            }
    
    db.session.commit()
    return jsonify(model_to_dict(exc))


@app.route('/api/exceptions/<int:exception_id>/retry', methods=['POST'])
def retry_exception(exception_id):
    exc = SignException.query.get_or_404(exception_id)
    if exc.signer:
        exc.signer.status = SignerStatus.PENDING
        
        log = SignLog(
            signer_id=exc.signer.id,
            action='retry_sign',
            detail=f'异常重试: {exc.description}',
            evidence_hash=hashlib.sha256(f'retry_{exc.signer.id}_{datetime.utcnow()}'.encode()).hexdigest()
        )
        db.session.add(log)
    
    exc.status = ExceptionStatus.RESOLVED
    db.session.commit()
    
    return jsonify({'message': '重试成功'})


@app.route('/api/exceptions/<int:exception_id>/rollback', methods=['POST'])
def rollback_exception(exception_id):
    exc = SignException.query.get_or_404(exception_id)
    if exc.signer:
        exc.signer.status = SignerStatus.RECALLED
        
        log = SignLog(
            signer_id=exc.signer.id,
            action='rollback',
            detail=f'回滚操作: {exc.description}',
            evidence_hash=hashlib.sha256(f'rollback_{exc.signer.id}_{datetime.utcnow()}'.encode()).hexdigest()
        )
        db.session.add(log)
    
    exc.status = ExceptionStatus.CLOSED
    db.session.commit()
    
    return jsonify({'message': '回滚成功'})


@app.route('/api/signers/<int:signer_id>/evidence', methods=['GET'])
def get_signer_evidence(signer_id):
    signer = Signer.query.get_or_404(signer_id)
    evidences = SignEvidence.query.filter_by(signer_id=signer_id).all()
    logs = SignLog.query.filter_by(signer_id=signer_id).all()
    
    return jsonify({
        'signer': model_to_dict(signer),
        'evidences': [model_to_dict(e) for e in evidences],
        'logs': [model_to_dict(l) for l in logs]
    })


@app.route('/api/init-sample-data', methods=['POST'])
def init_sample_data():
    ContractVersion.query.delete()
    SignEvidence.query.delete()
    SignLog.query.delete()
    SignException.query.delete()
    Signer.query.delete()
    Contract.query.delete()
    db.session.commit()
    
    contract1 = Contract(
        title='采购合同-2024-001',
        content='甲方同意向乙方采购以下商品...',
        version='1.0',
        status=ContractStatus.IN_PROGRESS,
        created_by='业务分析师A'
    )
    db.session.add(contract1)
    db.session.flush()
    
    contract2 = Contract(
        title='服务协议-SA-2024',
        content='根据双方约定，提供以下服务...',
        version='2.1',
        status=ContractStatus.IN_PROGRESS,
        created_by='业务分析师B'
    )
    db.session.add(contract2)
    db.session.flush()
    
    v1 = ContractVersion(
        contract_id=contract2.id,
        version='1.0',
        content='根据双方约定，提供服务...',
        change_log='初始版本',
        created_by='业务分析师B'
    )
    v2 = ContractVersion(
        contract_id=contract2.id,
        version='2.0',
        content='根据双方约定，提供以下服务，新增条款A...',
        change_log='新增条款A',
        created_by='业务分析师B'
    )
    v3 = ContractVersion(
        contract_id=contract2.id,
        version='2.1',
        content='根据双方约定，提供以下服务，新增条款A，修改条款B...',
        change_log='修改条款B',
        created_by='业务分析师B'
    )
    db.session.add_all([v1, v2, v3])
    
    signer1 = Signer(
        contract_id=contract1.id,
        name='张三',
        phone='13800138000',
        email='zhangsan@example.com',
        id_card='110101199001011234',
        order=1,
        status=SignerStatus.SIGNED,
        original_input={'name': '张三', 'phone': '13800138000', 'email': 'zhangsan@example.com'},
        processed_result={'sms_verified': True, 'signature_valid': True},
        signed_at=datetime.utcnow()
    )
    signer2 = Signer(
        contract_id=contract1.id,
        name='李四(脏数据)',
        phone='13800-ABC-000',
        email='lisi#example.com',
        order=2,
        status=SignerStatus.FAILED,
        original_input={'name': '李四', 'phone': '13800-ABC-000', 'email': 'lisi#example.com', 'note': '手动录入错误'}
    )
    signer3 = Signer(
        contract_id=contract1.id,
        name='王五',
        phone='13900139000',
        order=3,
        status=SignerStatus.FAILED,
        original_input={'name': '王五', 'phone': '13900139000'}
    )
    signer4 = Signer(
        contract_id=contract2.id,
        name='赵六',
        phone='13700137000',
        order=1,
        status=SignerStatus.RECALLED,
        original_input={'name': '赵六', 'phone': '13700137000'},
        processed_result={'recalled': True, 'reason': '合同内容变更', 'reissued_to': '赵六(新)'}
    )
    signer5 = Signer(
        contract_id=contract2.id,
        name='钱七',
        phone='13600136000',
        order=2,
        status=SignerStatus.PENDING,
        original_input={'name': '钱七', 'phone': '13600136000'}
    )
    db.session.add_all([signer1, signer2, signer3, signer4, signer5])
    db.session.flush()
    
    exc1 = SignException(
        contract_id=contract1.id,
        signer_id=signer2.id,
        type=ExceptionType.DIRTY_DATA,
        status=ExceptionStatus.OPEN,
        description='签署人信息格式错误：电话号码含字母，邮箱格式无效',
        raw_data={'phone': '13800-ABC-000', 'email': 'lisi#example.com', 'validation_errors': ['invalid_phone', 'invalid_email']}
    )
    exc2 = SignException(
        contract_id=contract1.id,
        signer_id=signer3.id,
        type=ExceptionType.SMS_BLOCKED,
        status=ExceptionStatus.PROCESSING,
        description='短信验证被拦截：运营商拦截，用户收不到验证码',
        raw_data={'sms_provider': '阿里云', 'error_code': 'BLOCKED_BY_CARRIER', 'attempts': 3},
        handled_by='运维小王',
        handled_at=datetime.utcnow(),
        handling_notes='正在联系运营商解除拦截'
    )
    exc3 = SignException(
        contract_id=contract2.id,
        signer_id=signer4.id,
        type=ExceptionType.RECALL_REISSUE,
        status=ExceptionStatus.RESOLVED,
        description='撤回重签：合同条款变更，需重新签署',
        raw_data={'old_version': '1.0', 'new_version': '2.1', 'reason': '客户要求修改付款条款'},
        handled_by='业务分析师B',
        handled_at=datetime.utcnow(),
        handling_notes='已通知客户重新签署'
    )
    db.session.add_all([exc1, exc2, exc3])
    
    log1 = SignLog(
        signer_id=signer1.id,
        action='sign_complete',
        detail='签署完成，验证通过',
        ip_address='192.168.1.100',
        evidence_hash=hashlib.sha256(f'sign_{signer1.id}'.encode()).hexdigest()
    )
    db.session.add(log1)
    
    evidence1 = SignEvidence(
        contract_id=contract1.id,
        signer_id=signer1.id,
        evidence_type='signature',
        evidence_data={'signature_image': 'base64_encoded_image', 'sms_code': '123456'},
        evidence_hash=hashlib.sha256(f'evidence_{signer1.id}'.encode()).hexdigest()
    )
    db.session.add(evidence1)
    
    db.session.commit()
    
    return jsonify({'message': '样例数据初始化成功'})


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
