from datetime import datetime
from app import db
from app.models import SparePart, PartSubstitution
from app.services.common import log_operation
from app.services.alarm_service import check_and_create_alarm


def get_part_by_code(part_code):
    return SparePart.query.filter_by(part_code=part_code).first()


def get_all_parts():
    return SparePart.query.order_by(SparePart.part_code).all()


def create_or_update_part(part_data, operator='system'):
    part = SparePart.query.filter_by(part_code=part_data['part_code']).first()
    
    before_state = None
    if part:
        before_state = part.to_dict()
    
    if not part:
        part = SparePart(
            part_code=part_data['part_code'],
            part_name=part_data['part_name'],
            category=part_data.get('category'),
            unit=part_data.get('unit', '个'),
            unit_price=part_data.get('unit_price', 0.0),
            total_stock=part_data.get('total_stock', 0),
            min_stock=part_data.get('min_stock', 0),
            safety_stock=part_data.get('safety_stock', 0),
            location=part_data.get('location'),
            supplier=part_data.get('supplier'),
            lead_time_days=part_data.get('lead_time_days', 7)
        )
        part.available_qty = part.total_stock
        db.session.add(part)
        log_operation(
            'PART_CREATE',
            part_code=part.part_code,
            operator=operator,
            note=f'创建备件 {part.part_code} - {part.part_name}'
        )
    else:
        old_total = part.total_stock
        old_reserved = part.reserved_qty
        
        part.part_name = part_data.get('part_name', part.part_name)
        part.category = part_data.get('category', part.category)
        part.unit = part_data.get('unit', part.unit)
        part.unit_price = part_data.get('unit_price', part.unit_price)
        part.min_stock = part_data.get('min_stock', part.min_stock)
        part.safety_stock = part_data.get('safety_stock', part.safety_stock)
        part.location = part_data.get('location', part.location)
        part.supplier = part_data.get('supplier', part.supplier)
        part.lead_time_days = part_data.get('lead_time_days', part.lead_time_days)
        
        if 'total_stock' in part_data:
            stock_change = part_data['total_stock'] - old_total
            part.total_stock = part_data['total_stock']
            part.available_qty = part.total_stock - part.reserved_qty
            
            change_amount = stock_change * part.unit_price
            log_operation(
                'STOCK_ADJUST',
                part_code=part.part_code,
                before_state=before_state,
                after_state=part.to_dict(),
                change_qty=stock_change,
                change_amount=change_amount,
                operator=operator,
                note=f'调整库存：{old_total} -> {part.total_stock}'
            )
        
        log_operation(
            'PART_UPDATE',
            part_code=part.part_code,
            before_state=before_state,
            after_state=part.to_dict(),
            operator=operator,
            note=f'更新备件信息 {part.part_code}'
        )
    
    db.session.flush()
    
    if part.available_qty < part.min_stock:
        check_and_create_alarm(
            part_code=part.part_code,
            alarm_type='MIN_STOCK_BREACH',
            alarm_level='CRITICAL',
            message=f'库存调整后可用库存 {part.available_qty} 低于最小库存 {part.min_stock}',
            needs_review=True
        )
    elif part.available_qty < part.safety_stock:
        check_and_create_alarm(
            part_code=part.part_code,
            alarm_type='SAFETY_STOCK_BREACH',
            alarm_level='WARNING',
            message=f'库存调整后可用库存 {part.available_qty} 低于安全库存 {part.safety_stock}',
            needs_review=False
        )
    
    return part


def add_stock(part_code, qty, operator='system', note=''):
    part = get_part_by_code(part_code)
    if not part:
        return None
    
    before_state = part.to_dict()
    old_total = part.total_stock
    
    part.total_stock += qty
    part.available_qty = part.total_stock - part.reserved_qty
    
    after_state = part.to_dict()
    change_amount = qty * part.unit_price
    
    log_operation(
        'STOCK_IN',
        part_code=part_code,
        before_state=before_state,
        after_state=after_state,
        change_qty=qty,
        change_amount=change_amount,
        operator=operator,
        note=note or f'入库 {qty} 个，原库存 {old_total}'
    )
    
    db.session.flush()
    return part


def get_part_substitutions(part_code):
    subs = PartSubstitution.query.filter(
        PartSubstitution.original_part_code == part_code,
        PartSubstitution.is_active == True
    ).order_by(PartSubstitution.priority).all()
    
    result = []
    for sub in subs:
        substitute_part = SparePart.query.filter_by(part_code=sub.substitute_part_code).first()
        result.append({
            'id': sub.id,
            'original_part_code': sub.original_part_code,
            'substitute_part_code': sub.substitute_part_code,
            'substitute_part_name': substitute_part.part_name if substitute_part else None,
            'available_qty': substitute_part.available_qty if substitute_part else 0,
            'priority': sub.priority
        })
    return result


def add_substitution(original_code, substitute_code, priority=1, operator='system'):
    existing = PartSubstitution.query.filter_by(
        original_part_code=original_code,
        substitute_part_code=substitute_code
    ).first()
    
    if existing:
        existing.is_active = True
        existing.priority = priority
        db.session.flush()
        return existing
    
    sub = PartSubstitution(
        original_part_code=original_code,
        substitute_part_code=substitute_code,
        priority=priority,
        is_active=True
    )
    db.session.add(sub)
    db.session.flush()
    
    log_operation(
        'SUBSTITUTE_ADD',
        part_code=original_code,
        operator=operator,
        note=f'添加替代件：{original_code} -> {substitute_code} (优先级 {priority})'
    )
    
    return sub


def get_part_pool_overview():
    parts = get_all_parts()
    
    overview = {
        'total_parts': len(parts),
        'normal_stock': 0,
        'warning_stock': 0,
        'critical_stock': 0,
        'total_reserved': 0,
        'parts': []
    }
    
    for part in parts:
        overview['total_reserved'] += part.reserved_qty
        
        if part.available_qty < part.min_stock:
            status = 'CRITICAL'
            overview['critical_stock'] += 1
        elif part.available_qty < part.safety_stock:
            status = 'WARNING'
            overview['warning_stock'] += 1
        else:
            status = 'NORMAL'
            overview['normal_stock'] += 1
        
        overview['parts'].append({
            **part.to_dict(),
            'stock_status': status
        })
    
    return overview
