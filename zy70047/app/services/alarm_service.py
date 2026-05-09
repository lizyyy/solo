from datetime import datetime
from app import db
from app.models import StockAlarm, SparePart, Reservation
from app.services.common import generate_id


def check_and_create_alarm(part_code, alarm_type, alarm_level, 
                           related_order_no=None, related_reservation_id=None,
                           message='', needs_review=False):
    part = SparePart.query.filter_by(part_code=part_code).first()
    if not part:
        return None
    
    existing = StockAlarm.query.filter(
        StockAlarm.part_code == part_code,
        StockAlarm.alarm_type == alarm_type,
        StockAlarm.reviewed == False,
        StockAlarm.resolved_at == None
    ).first()
    
    if existing:
        existing.current_stock = part.total_stock
        existing.reserved_qty = part.reserved_qty
        existing.available_qty = part.available_qty
        existing.updated_at = datetime.utcnow()
        if message:
            existing.message = message
        db.session.flush()
        return existing
    
    alarm = StockAlarm(
        alarm_id=generate_id('ALM'),
        part_code=part_code,
        part_name=part.part_name,
        alarm_type=alarm_type,
        alarm_level=alarm_level,
        current_stock=part.total_stock,
        reserved_qty=part.reserved_qty,
        available_qty=part.available_qty,
        min_stock=part.min_stock,
        safety_stock=part.safety_stock,
        related_order_no=related_order_no,
        related_reservation_id=related_reservation_id,
        message=message,
        needs_review=needs_review
    )
    
    db.session.add(alarm)
    db.session.flush()
    return alarm


def resolve_alarm(alarm_id, operator='system', note=''):
    alarm = StockAlarm.query.filter_by(alarm_id=alarm_id).first()
    if not alarm:
        return {
            'success': False,
            'message': '告警不存在'
        }
    
    alarm.resolved_at = datetime.utcnow()
    alarm.reviewed = True
    alarm.reviewed_by = operator
    alarm.reviewed_at = datetime.utcnow()
    alarm.review_note = note
    
    db.session.flush()
    
    return {
        'success': True,
        'message': '告警已解决',
        'alarm': alarm.to_dict()
    }


def check_global_stock_alarms():
    parts = SparePart.query.all()
    alarms = []
    
    for part in parts:
        if part.available_qty < part.min_stock:
            alarm = check_and_create_alarm(
                part_code=part.part_code,
                alarm_type='MIN_STOCK_BREACH',
                alarm_level='CRITICAL',
                message=f'全局检查：可用库存 {part.available_qty} 低于最小库存 {part.min_stock}',
                needs_review=True
            )
            alarms.append(alarm)
        elif part.available_qty < part.safety_stock:
            alarm = check_and_create_alarm(
                part_code=part.part_code,
                alarm_type='SAFETY_STOCK_BREACH',
                alarm_level='WARNING',
                message=f'全局检查：可用库存 {part.available_qty} 低于安全库存 {part.safety_stock}',
                needs_review=False
            )
            alarms.append(alarm)
    
    return [a.to_dict() for a in alarms if a]


def get_pending_alarms(needs_review_only=False):
    query = StockAlarm.query.filter(
        StockAlarm.reviewed == False,
        StockAlarm.resolved_at == None
    )
    
    if needs_review_only:
        query = query.filter(StockAlarm.needs_review == True)
    
    alarms = query.order_by(StockAlarm.created_at.desc()).all()
    return [a.to_dict() for a in alarms]


def get_reservation_impacted_orders(part_code):
    reservations = Reservation.query.filter(
        Reservation.part_code == part_code,
        Reservation.status.in_(['RESERVED', 'PARTIAL'])
    ).all()
    
    return [
        {
            'order_no': r.order_no,
            'reservation_id': r.reservation_id,
            'requested_qty': r.requested_qty,
            'reserved_qty': r.reserved_qty,
            'status': r.status
        }
        for r in reservations
    ]
