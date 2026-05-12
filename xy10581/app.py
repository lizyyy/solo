from flask import Flask, request, jsonify
from datetime import datetime, timedelta
from models import db, Store, Card, RechargeBatch, Transaction, BalanceFreeze, RiskEvent, CallbackLog, ManualCorrection
from risk_engine import validate_all_checks, process_refund_to_original_batch, create_risk_event
import json
import uuid

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///prepaid_card.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def to_dict(obj):
    if obj is None:
        return None
    result = {}
    for column in obj.__table__.columns:
        value = getattr(obj, column.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        result[column.name] = value
    return result

@app.route('/api/v1/stores', methods=['POST'])
def create_store():
    data = request.json
    store = Store(
        id=data.get('id', generate_id('STORE')),
        name=data['name'],
        address=data.get('address')
    )
    db.session.add(store)
    db.session.commit()
    return jsonify({'success': True, 'data': to_dict(store)}), 201

@app.route('/api/v1/cards', methods=['POST'])
def create_card():
    data = request.json
    
    if 'request_id' in data:
        existing = Transaction.query.filter_by(request_id=data['request_id']).first()
        if existing:
            existing_card = Card.query.get(existing.card_id)
            return jsonify({
                'success': True,
                'data': to_dict(existing_card),
                'message': '重复请求，返回已有结果'
            })
    
    card = Card(
        id=data.get('id', generate_id('CARD')),
        card_number=data['card_number'],
        holder_name=data['holder_name'],
        status='ACTIVE'
    )
    db.session.add(card)
    db.session.commit()
    return jsonify({'success': True, 'data': to_dict(card)}), 201

@app.route('/api/v1/cards/<card_id>/recharge', methods=['POST'])
def recharge_card(card_id):
    data = request.json
    
    if 'request_id' in data:
        existing = Transaction.query.filter_by(request_id=data['request_id']).first()
        if existing:
            return jsonify({
                'success': True,
                'data': to_dict(existing),
                'message': '重复请求，返回已有结果'
            })
    
    card = Card.query.get(card_id)
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'}), 404
    if card.status != 'ACTIVE':
        return jsonify({'success': False, 'error': '卡片状态异常'}), 400
    
    batch_id = generate_id('BATCH')
    batch = RechargeBatch(
        id=batch_id,
        card_id=card_id,
        amount=data['amount'],
        remaining_amount=data['amount'],
        recharge_channel=data.get('channel', 'ONLINE')
    )
    
    trans = Transaction(
        id=generate_id('TXN'),
        card_id=card_id,
        transaction_type='RECHARGE',
        amount=data['amount'],
        status='SUCCESS',
        request_id=data.get('request_id'),
        recharge_batch_id=batch_id
    )
    
    card.total_balance += data['amount']
    card.available_balance += data['amount']
    
    db.session.add(batch)
    db.session.add(trans)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'transaction': to_dict(trans),
            'batch': to_dict(batch),
            'card': to_dict(card)
        }
    }), 200

@app.route('/api/v1/transactions/consume', methods=['POST'])
def consume():
    data = request.json
    now = datetime.utcnow()
    
    if 'request_id' in data:
        existing = Transaction.query.filter_by(request_id=data['request_id']).first()
        if existing:
            return jsonify({
                'success': existing.status == 'SUCCESS',
                'data': to_dict(existing),
                'message': '重复请求，返回已有结果'
            })
    
    validation = validate_all_checks(
        data['card_id'],
        data['store_id'],
        data['amount'],
        now
    )
    
    trans = Transaction(
        id=generate_id('TXN'),
        card_id=data['card_id'],
        store_id=data['store_id'],
        transaction_type='CONSUME',
        amount=data['amount'],
        request_id=data.get('request_id')
    )
    
    if not validation['success']:
        trans.status = 'FAILED'
        trans.failure_reason = validation['reason']
        db.session.add(trans)
        db.session.commit()
        return jsonify({
            'success': False,
            'error': validation['reason'],
            'data': to_dict(trans)
        }), 400
    
    card = validation['card']
    
    risk = validation['risk_checks']['multi_store']
    if risk['risk_detected']:
        create_risk_event(
            data['card_id'],
            trans.id,
            risk['risk_type'],
            risk['risk_level'],
            risk['description']
        )
        trans.status = 'PENDING_RISK'
        trans.failure_reason = f'风险检测: {risk["description"]}'
        db.session.add(trans)
        db.session.commit()
        return jsonify({
            'success': False,
            'error': f'风险检测: {risk["description"]}',
            'data': to_dict(trans)
        }), 400
    
    batches = RechargeBatch.query.filter_by(
        card_id=data['card_id'],
        status='ACTIVE'
    ).order_by(RechargeBatch.recharge_time.asc()).all()
    
    remaining = data['amount']
    used_batch = None
    for batch in batches:
        if remaining <= 0:
            break
        if batch.remaining_amount > 0:
            deduct = min(batch.remaining_amount, remaining)
            batch.remaining_amount -= deduct
            remaining -= deduct
            if used_batch is None:
                used_batch = batch
    
    card.available_balance -= data['amount']
    trans.status = 'SUCCESS'
    if used_batch:
        trans.recharge_batch_id = used_batch.id
    
    db.session.add(trans)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'transaction': to_dict(trans),
            'card': to_dict(card)
        }
    }), 200

@app.route('/api/v1/cards/<card_id>/report-lost', methods=['POST'])
def report_lost(card_id):
    data = request.json
    card = Card.query.get(card_id)
    
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'}), 404
    
    if card.is_lost:
        return jsonify({
            'success': True,
            'message': '卡片已处于挂失状态',
            'data': to_dict(card)
        })
    
    card.is_lost = True
    card.lost_at = datetime.utcnow()
    card.status = 'LOST'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': to_dict(card)
    }), 200

@app.route('/api/v1/cards/<card_id>/resolve-lost', methods=['POST'])
def resolve_lost(card_id):
    data = request.json
    card = Card.query.get(card_id)
    
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'}), 404
    
    if not card.is_lost:
        return jsonify({
            'success': True,
            'message': '卡片未处于挂失状态',
            'data': to_dict(card)
        })
    
    card.is_lost = False
    card.status = 'ACTIVE'
    card.lost_at = None
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': to_dict(card)
    }), 200

@app.route('/api/v1/cards/<card_id>/freeze', methods=['POST'])
def freeze_balance(card_id):
    data = request.json
    
    card = Card.query.get(card_id)
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'}), 404
    if card.available_balance < data['amount']:
        return jsonify({'success': False, 'error': '可用余额不足'}), 400
    
    freeze = BalanceFreeze(
        id=generate_id('FREEZE'),
        card_id=card_id,
        amount=data['amount'],
        reason=data['reason'],
        frozen_by=data.get('operator', 'SYSTEM')
    )
    
    card.frozen_balance += data['amount']
    
    db.session.add(freeze)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'freeze': to_dict(freeze),
            'card': to_dict(card)
        }
    }), 200

@app.route('/api/v1/cards/<card_id>/unfreeze', methods=['POST'])
def unfreeze_balance(card_id):
    data = request.json
    
    freeze = BalanceFreeze.query.get(data['freeze_id'])
    if not freeze or freeze.card_id != card_id:
        return jsonify({'success': False, 'error': '冻结记录不存在'}), 404
    
    if freeze.status != 'ACTIVE':
        return jsonify({'success': False, 'error': '冻结已解除'}), 400
    
    freeze.status = 'UNFROZEN'
    freeze.unfrozen_at = datetime.utcnow()
    freeze.unfrozen_by = data.get('operator', 'SYSTEM')
    
    card = Card.query.get(card_id)
    card.frozen_balance -= freeze.amount
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'freeze': to_dict(freeze),
            'card': to_dict(card)
        }
    }), 200

@app.route('/api/v1/transactions/<trans_id>/refund', methods=['POST'])
def refund(trans_id):
    data = request.json
    
    if 'request_id' in data:
        existing = Transaction.query.filter_by(request_id=data['request_id']).first()
        if existing:
            return jsonify({
                'success': True,
                'data': to_dict(existing),
                'message': '重复请求，返回已有结果'
            })
    
    original = Transaction.query.get(trans_id)
    if not original:
        return jsonify({'success': False, 'error': '原始交易不存在'}), 404
    if original.transaction_type != 'CONSUME' or original.status != 'SUCCESS':
        return jsonify({'success': False, 'error': '该交易不可退款'}), 400
    
    refund_amount = data.get('amount', original.amount)
    if refund_amount > original.amount:
        return jsonify({'success': False, 'error': '退款金额不能超过原交易金额'}), 400
    
    card = Card.query.get(original.card_id)
    
    process_refund_to_original_batch(original.card_id, refund_amount, trans_id)
    
    refund_trans = Transaction(
        id=generate_id('TXN'),
        card_id=original.card_id,
        store_id=original.store_id,
        transaction_type='REFUND',
        amount=refund_amount,
        status='SUCCESS',
        request_id=data.get('request_id'),
        parent_transaction_id=trans_id,
        recharge_batch_id=original.recharge_batch_id
    )
    
    card.available_balance += refund_amount
    card.total_balance += refund_amount
    
    db.session.add(refund_trans)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'refund_transaction': to_dict(refund_trans),
            'original_transaction': to_dict(original),
            'card': to_dict(card)
        }
    }), 200

@app.route('/api/v1/callback', methods=['POST'])
def callback():
    data = request.json
    callback_id = data.get('callback_id')
    
    existing_log = CallbackLog.query.filter_by(callback_id=callback_id).first()
    if existing_log:
        return jsonify({
            'success': True,
            'is_duplicate': True,
            'message': '重复回调，已处理'
        })
    
    transaction = None
    if data.get('transaction_id'):
        transaction = Transaction.query.get(data['transaction_id'])
    
    log = CallbackLog(
        id=generate_id('CB'),
        callback_id=callback_id,
        transaction_id=data.get('transaction_id'),
        request_data=json.dumps(data, ensure_ascii=False),
        is_duplicate=False
    )
    
    if transaction:
        transaction.callback_id = callback_id
        if data.get('status') == 'SUCCESS' and transaction.status == 'PENDING':
            transaction.status = 'SUCCESS'
    
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'is_duplicate': False,
        'data': to_dict(log)
    }), 200

@app.route('/api/v1/cards/<card_id>', methods=['GET'])
def get_card(card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'}), 404
    
    transactions = Transaction.query.filter_by(card_id=card_id).order_by(Transaction.created_at.desc()).all()
    freezes = BalanceFreeze.query.filter_by(card_id=card_id).order_by(BalanceFreeze.created_at.desc()).all()
    batches = RechargeBatch.query.filter_by(card_id=card_id).order_by(RechargeBatch.recharge_time.desc()).all()
    corrections = ManualCorrection.query.filter_by(card_id=card_id).order_by(ManualCorrection.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'data': {
            'card': to_dict(card),
            'ledger': {
                'transactions': [to_dict(t) for t in transactions],
                'batches': [to_dict(b) for b in batches],
                'freezes': [to_dict(f) for f in freezes],
                'corrections': [to_dict(c) for c in corrections]
            }
        }
    })

@app.route('/api/v1/cards/<card_id>/history', methods=['GET'])
def get_card_history(card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'}), 404
    
    transactions = Transaction.query.filter_by(card_id=card_id).order_by(Transaction.created_at.desc()).all()
    
    history = []
    for t in transactions:
        history.append({
            'type': t.transaction_type,
            'amount': t.amount,
            'status': t.status,
            'time': t.created_at.isoformat(),
            'store_id': t.store_id,
            'failure_reason': t.failure_reason
        })
    
    return jsonify({
        'success': True,
        'data': {
            'card_id': card_id,
            'history': history
        }
    })

@app.route('/api/v1/risk/scan', methods=['POST'])
def risk_scan():
    data = request.json
    card_id = data.get('card_id')
    
    if card_id:
        risks = RiskEvent.query.filter_by(card_id=card_id).order_by(RiskEvent.detected_at.desc()).all()
    else:
        risks = RiskEvent.query.order_by(RiskEvent.detected_at.desc()).all()
    
    return jsonify({
        'success': True,
        'data': {
            'risk_events': [to_dict(r) for r in risks],
            'open_count': sum(1 for r in risks if r.status == 'OPEN')
        }
    })

@app.route('/api/v1/risk/<event_id>/resolve', methods=['POST'])
def resolve_risk(event_id):
    data = request.json
    event = RiskEvent.query.get(event_id)
    
    if not event:
        return jsonify({'success': False, 'error': '风险事件不存在'}), 404
    
    event.status = data.get('status', 'RESOLVED')
    event.resolved_at = datetime.utcnow()
    event.resolved_by = data.get('operator', 'ADMIN')
    event.resolution = data.get('resolution', '')
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': to_dict(event)
    })

@app.route('/api/v1/manual-correction', methods=['POST'])
def manual_correction():
    data = request.json
    
    card = Card.query.get(data['card_id'])
    if not card:
        return jsonify({'success': False, 'error': '卡片不存在'}), 404
    
    before_state = json.dumps({
        'total_balance': card.total_balance,
        'available_balance': card.available_balance,
        'frozen_balance': card.frozen_balance,
        'status': card.status,
        'is_lost': card.is_lost
    }, ensure_ascii=False)
    
    if 'balance_adjustment' in data:
        card.available_balance += data['balance_adjustment']
        card.total_balance += data['balance_adjustment']
    
    if 'status' in data:
        card.status = data['status']
    
    if 'is_lost' in data:
        card.is_lost = data['is_lost']
        if data['is_lost']:
            card.status = 'LOST'
            card.lost_at = datetime.utcnow()
        else:
            card.status = 'ACTIVE'
            card.lost_at = None
    
    after_state = json.dumps({
        'total_balance': card.total_balance,
        'available_balance': card.available_balance,
        'frozen_balance': card.frozen_balance,
        'status': card.status,
        'is_lost': card.is_lost
    }, ensure_ascii=False)
    
    correction = ManualCorrection(
        id=generate_id('CORR'),
        card_id=data['card_id'],
        transaction_id=data.get('transaction_id'),
        operator=data['operator'],
        correction_type=data['correction_type'],
        before_state=before_state,
        after_state=after_state,
        reason=data['reason']
    )
    
    db.session.add(correction)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'correction': to_dict(correction),
            'card': to_dict(card)
        }
    })

@app.route('/api/v1/reports/stores', methods=['GET'])
def store_report():
    stores = Store.query.all()
    report = []
    
    for store in stores:
        transactions = Transaction.query.filter_by(
            store_id=store.id, transaction_type='CONSUME'
        ).all()
        
        total_amount = sum(t.amount for t in transactions if t.status == 'SUCCESS')
        success_count = sum(1 for t in transactions if t.status == 'SUCCESS')
        fail_count = sum(1 for t in transactions if t.status in ['FAILED', 'PENDING_RISK'])
        
        report.append({
            'store_id': store.id,
            'store_name': store.name,
            'total_transactions': len(transactions),
            'success_count': success_count,
            'fail_count': fail_count,
            'total_amount': total_amount
        })
    
    return jsonify({
        'success': True,
        'data': {
            'store_reports': report,
            'generated_at': datetime.utcnow().isoformat()
        }
    })

@app.route('/api/v1/reports/export', methods=['GET'])
def export_report():
    cards = Card.query.all()
    stores = Store.query.all()
    risks = RiskEvent.query.all()
    
    report = {
        'generated_at': datetime.utcnow().isoformat(),
        'summary': {
            'total_cards': len(cards),
            'active_cards': sum(1 for c in cards if c.status == 'ACTIVE'),
            'lost_cards': sum(1 for c in cards if c.is_lost),
            'total_risk_events': len(risks),
            'open_risk_events': sum(1 for r in risks if r.status == 'OPEN')
        },
        'cards': [to_dict(c) for c in cards],
        'risks': [to_dict(r) for r in risks]
    }
    
    return jsonify({
        'success': True,
        'data': report,
        'export_format': 'JSON'
    })

@app.route('/api/v1/stores', methods=['GET'])
def list_stores():
    stores = Store.query.all()
    return jsonify({
        'success': True,
        'data': [to_dict(s) for s in stores]
    })

@app.route('/api/v1/cards', methods=['GET'])
def list_cards():
    cards = Card.query.all()
    return jsonify({
        'success': True,
        'data': [to_dict(c) for c in cards]
    })

@app.route('/api/v1/init-demo', methods=['POST'])
def init_demo_data():
    store1 = Store(id='STORE001', name='北京朝阳门店', address='北京市朝阳区xxx路1号')
    store2 = Store(id='STORE002', name='上海静安店', address='上海市静安区yyy路2号')
    store3 = Store(id='STORE003', name='广州天河店', address='广州市天河区zzz路3号')
    
    card1 = Card(id='CARD001', card_number='88880001', holder_name='张三', status='ACTIVE')
    card2 = Card(id='CARD002', card_number='88880002', holder_name='李四', status='ACTIVE')
    card3 = Card(id='CARD003', card_number='88880003', holder_name='王五', status='ACTIVE')
    
    db.session.add_all([store1, store2, store3, card1, card2, card3])
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '演示数据初始化完成',
        'data': {
            'stores': ['STORE001', 'STORE002', 'STORE003'],
            'cards': ['CARD001', 'CARD002', 'CARD003']
        }
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
