from datetime import datetime, timedelta
from models import db, Card, Transaction, RiskEvent, BalanceFreeze, RechargeBatch
import json

MULTI_STORE_TIME_WINDOW_MINUTES = 30
MULTI_STORE_THRESHOLD = 2

def check_card_status(card_id):
    card = Card.query.get(card_id)
    if not card:
        return {'valid': False, 'reason': '卡片不存在'}
    if card.status != 'ACTIVE':
        return {'valid': False, 'reason': f'卡片状态异常: {card.status}'}
    if card.is_lost:
        return {'valid': False, 'reason': '卡片已挂失，禁止消费'}
    return {'valid': True, 'card': card}

def check_balance(card, amount):
    if card.available_balance < amount:
        return {'valid': False, 'reason': f'可用余额不足。可用: {card.available_balance}, 需要: {amount}'}
    return {'valid': True}

def check_frozen_balance(card, amount):
    active_freezes = BalanceFreeze.query.filter_by(
        card_id=card.id, status='ACTIVE'
    ).all()
    total_frozen = sum(f.amount for f in active_freezes)
    if total_frozen > 0 and card.available_balance - total_frozen < amount:
        return {'valid': False, 'reason': f'存在冻结余额，实际可用金额不足。冻结金额: {total_frozen}'}
    return {'valid': True}

def check_multi_store(card_id, store_id, transaction_time):
    time_window = transaction_time - timedelta(minutes=MULTI_STORE_TIME_WINDOW_MINUTES)
    recent_transactions = Transaction.query.filter(
        Transaction.card_id == card_id,
        Transaction.transaction_type == 'CONSUME',
        Transaction.status == 'SUCCESS',
        Transaction.created_at >= time_window,
        Transaction.store_id != store_id
    ).all()
    
    distinct_stores = set()
    for t in recent_transactions:
        distinct_stores.add(t.store_id)
    
    if len(distinct_stores) >= MULTI_STORE_THRESHOLD:
        store_names = ', '.join(distinct_stores)
        description = f'检测到{MULTI_STORE_TIME_WINDOW_MINUTES}分钟内在{MULTI_STORE_THRESHOLD + 1}家不同门店消费: {store_names}'
        return {
            'risk_detected': True,
            'risk_type': 'MULTI_STORE_ABNORMAL',
            'risk_level': 'HIGH',
            'description': description
        }
    return {'risk_detected': False}

def create_risk_event(card_id, transaction_id, risk_type, risk_level, description):
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:-3]
    event = RiskEvent(
        id=f'RE_{timestamp}',
        card_id=card_id,
        transaction_id=transaction_id,
        risk_type=risk_type,
        risk_level=risk_level,
        description=description
    )
    db.session.add(event)
    db.session.commit()
    return event

def process_refund_to_original_batch(card_id, refund_amount, original_transaction_id=None):
    original_trans = None
    if original_transaction_id:
        original_trans = Transaction.query.get(original_transaction_id)
    
    if original_trans and original_trans.recharge_batch_id:
        batch = RechargeBatch.query.get(original_trans.recharge_batch_id)
        if batch and batch.status == 'ACTIVE':
            batch.remaining_amount += refund_amount
            return {'success': True, 'batch_id': batch.id}
    
    batches = RechargeBatch.query.filter_by(
        card_id=card_id, status='ACTIVE'
    ).order_by(RechargeBatch.recharge_time.desc()).all()
    
    remaining = refund_amount
    for batch in batches:
        if remaining <= 0:
            break
        used = batch.amount - batch.remaining_amount
        if used > 0:
            refund_to_batch = min(used, remaining)
            batch.remaining_amount += refund_to_batch
            remaining -= refund_to_batch
    
    return {'success': True, 'remaining': remaining}

def validate_all_checks(card_id, store_id, amount, transaction_time):
    status_check = check_card_status(card_id)
    if not status_check['valid']:
        return {'success': False, 'reason': status_check['reason']}
    
    card = status_check['card']
    
    balance_check = check_balance(card, amount)
    if not balance_check['valid']:
        return {'success': False, 'reason': balance_check['reason']}
    
    freeze_check = check_frozen_balance(card, amount)
    if not freeze_check['valid']:
        return {'success': False, 'reason': freeze_check['reason']}
    
    multi_store_check = check_multi_store(card_id, store_id, transaction_time)
    
    result = {
        'success': True,
        'card': card,
        'risk_checks': {
            'multi_store': multi_store_check
        }
    }
    
    return result
