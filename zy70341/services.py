from datetime import datetime, timedelta, date
from models import db, RiskEvent, GraylistEntry, ReviewRecord, DailyRiskStats, BlacklistEntry

DEFAULT_SINGLE_LIMIT = 1000.0
DEFAULT_DAILY_LIMIT = 5000.0
SEVERE_SINGLE_LIMIT = 100.0
SEVERE_DAILY_LIMIT = 500.0
NORMAL_EXPIRE_DAYS = 7
SEVERE_EXPIRE_DAYS = 30

RISK_TYPE_CONFIG = {
    'bot_detection': {'severity': 'medium', 'single_limit': DEFAULT_SINGLE_LIMIT, 'daily_limit': DEFAULT_DAILY_LIMIT, 'expire_days': NORMAL_EXPIRE_DAYS},
    'ip_anomaly': {'severity': 'medium', 'single_limit': DEFAULT_SINGLE_LIMIT, 'daily_limit': DEFAULT_DAILY_LIMIT, 'expire_days': NORMAL_EXPIRE_DAYS},
    'device_anomaly': {'severity': 'medium', 'single_limit': DEFAULT_SINGLE_LIMIT, 'daily_limit': DEFAULT_DAILY_LIMIT, 'expire_days': NORMAL_EXPIRE_DAYS},
    'fraud_suspected': {'severity': 'high', 'single_limit': SEVERE_SINGLE_LIMIT, 'daily_limit': SEVERE_DAILY_LIMIT, 'expire_days': SEVERE_EXPIRE_DAYS},
    'money_laundering': {'severity': 'critical', 'single_limit': 0, 'daily_limit': 0, 'expire_days': SEVERE_EXPIRE_DAYS},
    'phishing': {'severity': 'critical', 'single_limit': 0, 'daily_limit': 0, 'expire_days': SEVERE_EXPIRE_DAYS},
}

def get_or_create_daily_stats():
    today = date.today()
    stats = DailyRiskStats.query.filter_by(date=today).first()
    if not stats:
        stats = DailyRiskStats(
            date=today,
            total_events=0,
            added_to_graylist=0,
            upgraded_to_blacklist=0,
            transactions_limited=0,
            amount_limited=0.0,
            reviewed_passed=0,
            auto_expired=0
        )
        db.session.add(stats)
        db.session.flush()
    return stats

def create_risk_event(data):
    existing = RiskEvent.query.filter_by(event_id=data['event_id']).first()
    if existing:
        return {'success': True, 'data': existing.to_dict(), 'is_duplicate': True}
    
    event = RiskEvent(
        event_id=data['event_id'],
        user_id=data['user_id'],
        risk_type=data['risk_type'],
        severity=data.get('severity', RISK_TYPE_CONFIG.get(data['risk_type'], {}).get('severity', 'medium')),
        evidence=data.get('evidence', {}),
        description=data.get('description'),
        source=data.get('source', 'system')
    )
    db.session.add(event)
    
    stats = get_or_create_daily_stats()
    stats.total_events += 1
    
    db.session.commit()
    return {'success': True, 'data': event.to_dict(), 'is_duplicate': False}

def add_to_graylist(user_id, trigger_event_id=None, reason=None, custom_config=None):
    blacklisted = BlacklistEntry.query.filter_by(user_id=user_id).first()
    if blacklisted:
        return {'success': False, 'error': '用户已在黑名单中', 'code': 'ALREADY_BLACKLISTED'}
    
    existing = GraylistEntry.query.filter_by(user_id=user_id, status='active').first()
    now = datetime.utcnow()
    if existing and not (existing.auto_expire and now > existing.expires_at):
        config = custom_config or {}
        if 'single_transaction_limit' in config:
            existing.single_transaction_limit = min(existing.single_transaction_limit, config['single_transaction_limit'])
        if 'daily_transaction_limit' in config:
            existing.daily_transaction_limit = min(existing.daily_transaction_limit, config['daily_transaction_limit'])
        if 'expires_at' in config:
            existing.expires_at = config['expires_at']
        db.session.commit()
        return {'success': True, 'data': existing.to_dict(), 'updated': True}
    
    config = custom_config or {}
    entry = GraylistEntry(
        user_id=user_id,
        status='active',
        single_transaction_limit=config.get('single_transaction_limit', DEFAULT_SINGLE_LIMIT),
        daily_transaction_limit=config.get('daily_transaction_limit', DEFAULT_DAILY_LIMIT),
        effective_from=now,
        expires_at=config.get('expires_at', now + timedelta(days=NORMAL_EXPIRE_DAYS)),
        auto_expire=config.get('auto_expire', True),
        reason=reason,
        trigger_event_id=trigger_event_id
    )
    db.session.add(entry)
    
    stats = get_or_create_daily_stats()
    stats.added_to_graylist += 1
    
    db.session.commit()
    return {'success': True, 'data': entry.to_dict(), 'updated': False}

def evaluate_transaction(user_id, amount, transaction_time=None):
    transaction_time = transaction_time or datetime.utcnow()
    
    blacklisted = BlacklistEntry.query.filter_by(user_id=user_id).first()
    if blacklisted:
        return {
            'allowed': False,
            'reason': 'BLACKLISTED',
            'message': '用户已在黑名单中，禁止交易',
            'single_limit': 0,
            'daily_limit': 0,
            'daily_used': 0,
            'daily_remaining': 0
        }
    
    active_entry = get_active_graylist_entry(user_id)
    if not active_entry:
        return {
            'allowed': True,
            'reason': 'NO_RESTRICTION',
            'message': '用户无限制',
            'single_limit': None,
            'daily_limit': None,
            'daily_used': 0,
            'daily_remaining': None
        }
    
    single_limit = active_entry.single_transaction_limit
    daily_limit = active_entry.daily_transaction_limit
    
    if amount > single_limit:
        stats = get_or_create_daily_stats()
        stats.transactions_limited += 1
        stats.amount_limited += amount
        db.session.commit()
        
        return {
            'allowed': False,
            'reason': 'SINGLE_TRANSACTION_LIMIT_EXCEEDED',
            'message': f'单笔交易限额{single_limit}元，当前金额{amount}元',
            'single_limit': single_limit,
            'daily_limit': daily_limit,
            'daily_used': 0,
            'daily_remaining': daily_limit,
            'requested_amount': amount
        }
    
    daily_used = 0
    daily_remaining = daily_limit
    
    if daily_used + amount > daily_limit:
        stats = get_or_create_daily_stats()
        stats.transactions_limited += 1
        stats.amount_limited += max(0, daily_used + amount - daily_limit)
        db.session.commit()
        
        return {
            'allowed': False,
            'reason': 'DAILY_LIMIT_EXCEEDED',
            'message': f'日累计限额{daily_limit}元，已使用{daily_used}元，剩余{daily_remaining}元',
            'single_limit': single_limit,
            'daily_limit': daily_limit,
            'daily_used': daily_used,
            'daily_remaining': daily_remaining,
            'requested_amount': amount
        }
    
    return {
        'allowed': True,
        'reason': 'WITHIN_LIMITS',
        'message': '交易在限额范围内',
        'single_limit': single_limit,
        'daily_limit': daily_limit,
        'daily_used': daily_used,
        'daily_remaining': daily_remaining,
        'requested_amount': amount
    }

def get_active_graylist_entry(user_id):
    now = datetime.utcnow()
    entries = GraylistEntry.query.filter_by(user_id=user_id, status='active').all()
    for entry in entries:
        if not (entry.auto_expire and now > entry.expires_at):
            return entry
    return None

def review_user(user_id, decision, reviewer_id=None, remark=None, evidence=None):
    if decision not in ['approve', 'escalate', 'reject']:
        return {'success': False, 'error': '无效的复核决定', 'code': 'INVALID_DECISION'}
    
    active_entry = get_active_graylist_entry(user_id)
    
    if decision == 'approve':
        if not active_entry:
            return {'success': False, 'error': '用户不在灰名单中', 'code': 'NOT_IN_GRAYLIST'}
        
        active_entry.status = 'reviewed_removed'
        
        review = ReviewRecord(
            user_id=user_id,
            reviewer_id=reviewer_id,
            decision='approve',
            remark=remark,
            evidence=evidence,
            related_event_ids=[]
        )
        db.session.add(review)
        
        stats = get_or_create_daily_stats()
        stats.reviewed_passed += 1
        
        db.session.commit()
        return {
            'success': True,
            'data': {
                'review': review.to_dict(),
                'graylist_entry': active_entry.to_dict()
            },
            'message': '复核通过，已解除灰名单限制'
        }
    
    elif decision == 'escalate':
        blacklisted = BlacklistEntry.query.filter_by(user_id=user_id).first()
        if blacklisted:
            return {'success': False, 'error': '用户已在黑名单中', 'code': 'ALREADY_BLACKLISTED'}
        
        if active_entry:
            active_entry.status = 'escalated_to_blacklist'
        
        events = RiskEvent.query.filter_by(user_id=user_id).all()
        event_ids = [e.event_id for e in events]
        
        blacklist = BlacklistEntry(
            user_id=user_id,
            reason=remark or '严重风险升级至黑名单',
            trigger_event_ids=event_ids
        )
        db.session.add(blacklist)
        
        review = ReviewRecord(
            user_id=user_id,
            reviewer_id=reviewer_id,
            decision='escalate',
            remark=remark,
            evidence=evidence,
            related_event_ids=event_ids
        )
        db.session.add(review)
        
        stats = get_or_create_daily_stats()
        stats.upgraded_to_blacklist += 1
        
        db.session.commit()
        return {
            'success': True,
            'data': {
                'review': review.to_dict(),
                'blacklist_entry': blacklist.to_dict()
            },
            'message': '已升级至黑名单'
        }
    
    elif decision == 'reject':
        review = ReviewRecord(
            user_id=user_id,
            reviewer_id=reviewer_id,
            decision='reject',
            remark=remark,
            evidence=evidence,
            related_event_ids=[]
        )
        db.session.add(review)
        db.session.commit()
        return {
            'success': True,
            'data': {
                'review': review.to_dict()
            },
            'message': '复核拒绝，维持当前限制'
        }

def check_auto_expire():
    now = datetime.utcnow()
    expired = GraylistEntry.query.filter(
        GraylistEntry.status == 'active',
        GraylistEntry.auto_expire == True,
        GraylistEntry.expires_at < now
    ).all()
    
    count = 0
    for entry in expired:
        count += 1
    
    stats = get_or_create_daily_stats()
    stats.auto_expired += count
    db.session.commit()
    
    return {'expired_count': count}

def get_user_risk_timeline(user_id):
    events = RiskEvent.query.filter_by(user_id=user_id).order_by(RiskEvent.created_at.desc()).all()
    graylist = GraylistEntry.query.filter_by(user_id=user_id).order_by(GraylistEntry.created_at.desc()).all()
    reviews = ReviewRecord.query.filter_by(user_id=user_id).order_by(ReviewRecord.created_at.desc()).all()
    blacklist = BlacklistEntry.query.filter_by(user_id=user_id).first()
    
    active_entry = get_active_graylist_entry(user_id)
    
    timeline = []
    for event in events:
        timeline.append({
            'type': 'risk_event',
            'time': event.created_at.isoformat(),
            'data': event.to_dict()
        })
    for entry in graylist:
        timeline.append({
            'type': 'graylist_entry',
            'time': entry.created_at.isoformat(),
            'data': entry.to_dict()
        })
    for review in reviews:
        timeline.append({
            'type': 'review',
            'time': review.created_at.isoformat(),
            'data': review.to_dict()
        })
    if blacklist:
        timeline.append({
            'type': 'blacklist',
            'time': blacklist.created_at.isoformat(),
            'data': blacklist.to_dict()
        })
    
    timeline.sort(key=lambda x: x['time'], reverse=True)
    
    current_limits = None
    if blacklist:
        current_limits = {
            'status': 'blacklisted',
            'single_limit': 0,
            'daily_limit': 0,
            'daily_used': 0,
            'daily_remaining': 0
        }
    elif active_entry:
        current_limits = {
            'status': 'graylisted',
            'single_limit': active_entry.single_transaction_limit,
            'daily_limit': active_entry.daily_transaction_limit,
            'daily_used': 0,
            'daily_remaining': active_entry.daily_transaction_limit,
            'expires_at': active_entry.expires_at.isoformat()
        }
    else:
        current_limits = {'status': 'normal'}
    
    trigger_evidence = [e.to_dict() for e in events]
    review_records = [r.to_dict() for r in reviews]
    
    return {
        'user_id': user_id,
        'current_status': current_limits,
        'timeline': timeline,
        'trigger_evidence': trigger_evidence,
        'review_records': review_records,
        'is_blacklisted': blacklist is not None,
        'is_graylisted': active_entry is not None
    }

def get_graylist_detail(user_id):
    entry = get_active_graylist_entry(user_id)
    if not entry:
        blacklist = BlacklistEntry.query.filter_by(user_id=user_id).first()
        if blacklist:
            return {
                'success': True,
                'data': {
                    'status': 'blacklisted',
                    'user_id': user_id,
                    'reason': blacklist.reason,
                    'trigger_events': [e.to_dict() for e in RiskEvent.query.filter_by(user_id=user_id).all()],
                    'message': '用户已被加入黑名单，禁止所有交易'
                }
            }
        return {'success': False, 'error': '用户不在灰名单中', 'code': 'NOT_IN_GRAYLIST'}
    
    events = RiskEvent.query.filter_by(user_id=user_id).order_by(RiskEvent.created_at.desc()).all()
    reviews = ReviewRecord.query.filter_by(user_id=user_id).order_by(ReviewRecord.created_at.desc()).all()
    
    explanation_parts = []
    explanation_parts.append(f'用户 {user_id} 当前处于灰名单观察期。')
    
    limit_info = f'单笔交易限额: {entry.single_transaction_limit}元，日累计限额: {entry.daily_transaction_limit}元。'
    explanation_parts.append(limit_info)
    
    if entry.auto_expire:
        explanation_parts.append(f'限制将在 {entry.expires_at.isoformat()} 自动解除。')
    else:
        explanation_parts.append('此限制为人工设置，需要人工复核解除。')
    
    if events:
        explanation_parts.append('触发原因：')
        for e in events[:3]:
            explanation_parts.append(f'  - {e.risk_type} ({e.severity}): {e.description or e.source}')
    
    if reviews:
        explanation_parts.append('复核记录：')
        for r in reviews:
            decision_text = {'approve': '通过并解除', 'escalate': '升级黑名单', 'reject': '维持限制'}.get(r.decision, r.decision)
            explanation_parts.append(f'  - {r.created_at.isoformat()}: {decision_text} - {r.remark or "无备注"}')
    
    return {
        'success': True,
        'data': {
            'status': 'graylisted',
            'user_id': user_id,
            'graylist_entry': entry.to_dict(),
            'trigger_events': [e.to_dict() for e in events],
            'review_records': [r.to_dict() for r in reviews],
            'explanation': '\n'.join(explanation_parts)
        }
    }

def get_daily_stats(d=None):
    target_date = d or date.today()
    stats = DailyRiskStats.query.filter_by(date=target_date).first()
    if not stats:
        return {
            'success': True,
            'data': {
                'date': target_date.isoformat(),
                'total_events': 0,
                'added_to_graylist': 0,
                'upgraded_to_blacklist': 0,
                'transactions_limited': 0,
                'amount_limited': 0.0,
                'reviewed_passed': 0,
                'auto_expired': 0
            }
        }
    return {'success': True, 'data': stats.to_dict()}

def get_all_daily_stats(start_date=None, end_date=None):
    query = DailyRiskStats.query
    if start_date:
        query = query.filter(DailyRiskStats.date >= start_date)
    if end_date:
        query = query.filter(DailyRiskStats.date <= end_date)
    stats_list = query.order_by(DailyRiskStats.date.desc()).all()
    return {'success': True, 'data': [s.to_dict() for s in stats_list]}
