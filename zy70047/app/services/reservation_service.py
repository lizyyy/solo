from datetime import datetime
from app import db
from app.models import SparePart, WorkOrder, Reservation, StockAlarm, PartSubstitution
from app.services.common import generate_id, log_operation
from app.services.alarm_service import check_and_create_alarm


def get_or_create_work_order(order_no, **kwargs):
    wo = WorkOrder.query.filter_by(order_no=order_no).first()
    if not wo:
        wo = WorkOrder(
            order_no=order_no,
            equipment_id=kwargs.get('equipment_id'),
            equipment_name=kwargs.get('equipment_name'),
            order_type=kwargs.get('order_type'),
            priority=kwargs.get('priority', 'NORMAL'),
            created_by=kwargs.get('operator')
        )
        db.session.add(wo)
        db.session.flush()
        log_operation(
            'WORK_ORDER_CREATE',
            order_no=order_no,
            operator=kwargs.get('operator'),
            note=f'创建工单 {order_no}'
        )
    return wo


def check_available_quantity(part_code):
    part = SparePart.query.filter_by(part_code=part_code).first()
    if not part:
        return None
    return part.available_qty


def find_substitute_parts(part_code, required_qty):
    substitutes = PartSubstitution.query.filter(
        PartSubstitution.original_part_code == part_code,
        PartSubstitution.is_active == True
    ).order_by(PartSubstitution.priority).all()
    
    result = []
    for sub in substitutes:
        substitute_part = SparePart.query.filter_by(part_code=sub.substitute_part_code).first()
        if substitute_part and substitute_part.available_qty >= required_qty:
            result.append({
                'part_code': substitute_part.part_code,
                'part_name': substitute_part.part_name,
                'available_qty': substitute_part.available_qty,
                'priority': sub.priority
            })
    return result


def reserve_spare_part(order_no, part_code, requested_qty, operator='system', **kwargs):
    part = SparePart.query.filter_by(part_code=part_code).first()
    if not part:
        return {
            'success': False,
            'code': 'PART_NOT_FOUND',
            'message': f'备件 {part_code} 不存在',
            'needs_review': False
        }
    
    if requested_qty <= 0:
        return {
            'success': False,
            'code': 'INVALID_QTY',
            'message': '预占数量必须大于0',
            'needs_review': False
        }
    
    existing_reservation = Reservation.query.filter_by(
        order_no=order_no,
        part_code=part_code
    ).first()
    
    if existing_reservation:
        if existing_reservation.requested_qty == requested_qty and \
           existing_reservation.status in ['RESERVED', 'PARTIAL']:
            return {
                'success': True,
                'code': 'IDEMPOTENT_RESERVATION',
                'message': '重复请求，已返回上次预占结果',
                'reservation': existing_reservation.to_dict(),
                'needs_review': False
            }
        if existing_reservation.status == 'COMPLETED':
            return {
                'success': False,
                'code': 'RESERVATION_COMPLETED',
                'message': '该预占已完成领用',
                'reservation': existing_reservation.to_dict(),
                'needs_review': False
            }
    
    get_or_create_work_order(order_no, operator=operator, **kwargs)
    
    before_state = {
        'part_code': part.part_code,
        'part_name': part.part_name,
        'total_stock': part.total_stock,
        'reserved_qty': part.reserved_qty,
        'available_qty': part.available_qty
    }
    
    available_qty = part.available_qty
    can_reserve = min(requested_qty, available_qty)
    
    result = {
        'success': False,
        'code': '',
        'message': '',
        'needs_review': False,
        'warnings': [],
        'substitute_options': []
    }
    
    if can_reserve == 0:
        substitute_options = find_substitute_parts(part_code, requested_qty)
        if substitute_options:
            result.update({
                'code': 'NO_STOCK_WITH_SUBSTITUTE',
                'message': f'备件 {part_code} 库存不足，有 {len(substitute_options)} 个替代件可用',
                'substitute_options': substitute_options,
                'needs_review': False
            })
        else:
            alarm = check_and_create_alarm(
                part_code=part_code,
                alarm_type='STOCK_OUT',
                alarm_level='CRITICAL',
                related_order_no=order_no,
                message=f'工单 {order_no} 预占 {requested_qty} 个 {part.part_name}，库存为0',
                needs_review=True
            )
            result.update({
                'code': 'NO_STOCK',
                'message': f'备件 {part_code} 库存为0，已创建库存告警',
                'alarm_id': alarm.alarm_id if alarm else None,
                'needs_review': True
            })
        log_operation(
            'RESERVE_FAIL',
            order_no=order_no,
            part_code=part_code,
            before_state=before_state,
            after_state=before_state,
            change_qty=0,
            operator=operator,
            note=f'预占失败：{result["message"]}'
        )
        return result
    
    part.reserved_qty += can_reserve
    part.available_qty = part.total_stock - part.reserved_qty
    
    if existing_reservation:
        existing_reservation.requested_qty = requested_qty
        existing_reservation.reserved_qty = can_reserve
        existing_reservation.status = 'PARTIAL' if can_reserve < requested_qty else 'RESERVED'
        reservation = existing_reservation
    else:
        reservation = Reservation(
            reservation_id=generate_id('RES'),
            order_no=order_no,
            part_code=part_code,
            part_name=part.part_name,
            requested_qty=requested_qty,
            reserved_qty=can_reserve,
            used_qty=0,
            released_qty=0,
            status='PARTIAL' if can_reserve < requested_qty else 'RESERVED',
            reserved_by=operator
        )
        db.session.add(reservation)
    
    after_state = {
        'part_code': part.part_code,
        'part_name': part.part_name,
        'total_stock': part.total_stock,
        'reserved_qty': part.reserved_qty,
        'available_qty': part.available_qty
    }
    
    change_amount = can_reserve * part.unit_price
    
    log_operation(
        'RESERVE_SUCCESS',
        order_no=order_no,
        part_code=part_code,
        before_state=before_state,
        after_state=after_state,
        change_qty=can_reserve,
        change_amount=change_amount,
        operator=operator,
        note=f'成功预占 {can_reserve}/{requested_qty} 个 {part.part_name}'
    )
    
    if can_reserve < requested_qty:
        substitute_options = find_substitute_parts(part_code, requested_qty - can_reserve)
        if substitute_options:
            result['warnings'].append(f'部分预占，剩余 {requested_qty - can_reserve} 个可用替代件')
            result['substitute_options'] = substitute_options
            result['needs_review'] = False
        else:
            alarm = check_and_create_alarm(
                part_code=part_code,
                alarm_type='PARTIAL_RESERVE',
                alarm_level='WARNING',
                related_order_no=order_no,
                related_reservation_id=reservation.reservation_id,
                message=f'工单 {order_no} 部分预占 {part.part_name}，已预占 {can_reserve}/{requested_qty}',
                needs_review=True
            )
            result['warnings'].append('部分预占，需要人工复核')
            result['alarm_id'] = alarm.alarm_id if alarm else None
            result['needs_review'] = True
    
    safety_check = check_safety_stock_after_reserve(part, order_no, reservation.reservation_id)
    if safety_check:
        result['warnings'].append(safety_check['message'])
        if safety_check.get('needs_review'):
            result['needs_review'] = True
    
    result.update({
        'success': True,
        'code': 'RESERVED',
        'message': f'成功预占 {can_reserve} 个 {part.part_name}' if can_reserve == requested_qty 
                  else f'部分预占 {can_reserve}/{requested_qty} 个 {part.part_name}',
        'reservation': reservation.to_dict(),
        'part_after': after_state
    })
    
    db.session.flush()
    return result


def check_safety_stock_after_reserve(part, order_no, reservation_id):
    projected_available = part.available_qty
    
    if projected_available < part.safety_stock:
        alarm = check_and_create_alarm(
            part_code=part.part_code,
            alarm_type='SAFETY_STOCK_BREACH',
            alarm_level='WARNING' if projected_available > part.min_stock else 'CRITICAL',
            related_order_no=order_no,
            related_reservation_id=reservation_id,
            message=f'预占后可用库存 {projected_available} 低于安全库存 {part.safety_stock}',
            needs_review=projected_available < part.min_stock
        )
        return {
            'message': f'安全库存告警：可用库存 {projected_available} < 安全库存 {part.safety_stock}',
            'alarm_id': alarm.alarm_id if alarm else None,
            'needs_review': projected_available < part.min_stock
        }
    
    return None


def use_spare_part(reservation_id, used_qty, operator='system'):
    reservation = Reservation.query.filter_by(reservation_id=reservation_id).first()
    if not reservation:
        return {
            'success': False,
            'code': 'RESERVATION_NOT_FOUND',
            'message': '预占记录不存在',
            'needs_review': False
        }
    
    if reservation.status == 'COMPLETED':
        return {
            'success': False,
            'code': 'ALREADY_COMPLETED',
            'message': '该预占已完成',
            'reservation': reservation.to_dict(),
            'needs_review': False
        }
    
    available_for_use = reservation.reserved_qty - reservation.used_qty
    if used_qty > available_for_use:
        return {
            'success': False,
            'code': 'EXCEED_RESERVED',
            'message': f'领用数量 {used_qty} 超过剩余预占数量 {available_for_use}',
            'needs_review': False
        }
    
    if used_qty <= 0:
        return {
            'success': False,
            'code': 'INVALID_QTY',
            'message': '领用数量必须大于0',
            'needs_review': False
        }
    
    part = SparePart.query.filter_by(part_code=reservation.part_code).first()
    
    before_reservation = reservation.to_dict()
    before_part = {
        'part_code': part.part_code,
        'total_stock': part.total_stock,
        'reserved_qty': part.reserved_qty,
        'available_qty': part.available_qty
    }
    
    reservation.used_qty += used_qty
    
    if part:
        part.total_stock -= used_qty
        part.reserved_qty -= used_qty
        part.available_qty = part.total_stock - part.reserved_qty
    
    if reservation.used_qty >= reservation.reserved_qty:
        reservation.status = 'COMPLETED'
    
    after_reservation = reservation.to_dict()
    after_part = {
        'part_code': part.part_code,
        'total_stock': part.total_stock,
        'reserved_qty': part.reserved_qty,
        'available_qty': part.available_qty
    } if part else None
    
    change_amount = used_qty * (part.unit_price if part else 0)
    
    log_operation(
        'USE_SPARE',
        order_no=reservation.order_no,
        part_code=reservation.part_code,
        before_state=before_reservation,
        after_state=after_reservation,
        change_qty=used_qty,
        change_amount=change_amount,
        operator=operator,
        note=f'领用 {used_qty} 个 {reservation.part_name}'
    )
    
    result = {
        'success': True,
        'code': 'USED',
        'message': f'成功领用 {used_qty} 个 {reservation.part_name}',
        'reservation': after_reservation,
        'part_after': after_part,
        'needs_review': False
    }
    
    if part and part.available_qty < part.min_stock:
        alarm = check_and_create_alarm(
            part_code=part.part_code,
            alarm_type='MIN_STOCK_BREACH',
            alarm_level='CRITICAL',
            message=f'领用后可用库存 {part.available_qty} 低于最小库存 {part.min_stock}',
            needs_review=True
        )
        result['warnings'] = [f'最小库存告警：可用库存 {part.available_qty} < 最小库存 {part.min_stock}']
        result['alarm_id'] = alarm.alarm_id if alarm else None
        result['needs_review'] = True
    
    db.session.flush()
    return result


def release_reservation(reservation_id, operator='system', reason=''):
    reservation = Reservation.query.filter_by(reservation_id=reservation_id).first()
    if not reservation:
        return {
            'success': False,
            'code': 'RESERVATION_NOT_FOUND',
            'message': '预占记录不存在',
            'needs_review': False
        }
    
    if reservation.status in ['RELEASED', 'COMPLETED']:
        return {
            'success': True,
            'code': 'ALREADY_RELEASED',
            'message': '该预占已释放或完成',
            'reservation': reservation.to_dict(),
            'needs_review': False
        }
    
    releasable_qty = reservation.reserved_qty - reservation.used_qty - reservation.released_qty
    
    if releasable_qty <= 0:
        return {
            'success': False,
            'code': 'NOTHING_TO_RELEASE',
            'message': '没有可释放的预占数量',
            'needs_review': False
        }
    
    part = SparePart.query.filter_by(part_code=reservation.part_code).first()
    
    before_reservation = reservation.to_dict()
    before_part = {
        'part_code': part.part_code,
        'total_stock': part.total_stock,
        'reserved_qty': part.reserved_qty,
        'available_qty': part.available_qty
    } if part else None
    
    reservation.released_qty += releasable_qty
    reservation.status = 'RELEASED'
    
    if part:
        part.reserved_qty -= releasable_qty
        part.available_qty = part.total_stock - part.reserved_qty
    
    after_reservation = reservation.to_dict()
    after_part = {
        'part_code': part.part_code,
        'total_stock': part.total_stock,
        'reserved_qty': part.reserved_qty,
        'available_qty': part.available_qty
    } if part else None
    
    change_amount = -releasable_qty * (part.unit_price if part else 0)
    
    log_operation(
        'RELEASE_RESERVATION',
        order_no=reservation.order_no,
        part_code=reservation.part_code,
        before_state=before_reservation,
        after_state=after_reservation,
        change_qty=-releasable_qty,
        change_amount=change_amount,
        operator=operator,
        note=f'释放预占 {releasable_qty} 个 {reservation.part_name}，原因：{reason}'
    )
    
    result = {
        'success': True,
        'code': 'RELEASED',
        'message': f'成功释放 {releasable_qty} 个 {reservation.part_name}',
        'reservation': after_reservation,
        'part_after': after_part,
        'released_qty': releasable_qty,
        'needs_review': False
    }
    
    db.session.flush()
    return result


def use_substitute_part(order_no, original_part_code, substitute_part_code, 
                        requested_qty, operator='system', **kwargs):
    substitute = PartSubstitution.query.filter(
        PartSubstitution.original_part_code == original_part_code,
        PartSubstitution.substitute_part_code == substitute_part_code,
        PartSubstitution.is_active == True
    ).first()
    
    if not substitute:
        return {
            'success': False,
            'code': 'INVALID_SUBSTITUTE',
            'message': '替代件关系不存在或已失效',
            'needs_review': True
        }
    
    result = reserve_spare_part(
        order_no=order_no,
        part_code=substitute_part_code,
        requested_qty=requested_qty,
        operator=operator,
        **kwargs
    )
    
    if result.get('success') and result.get('reservation'):
        reservation = Reservation.query.filter_by(reservation_id=result['reservation']['reservation_id']).first()
        if reservation:
            reservation.used_substitute = True
            reservation.substitute_part_code = substitute_part_code
            db.session.flush()
            result['reservation'] = reservation.to_dict()
            result['message'] = f'使用替代件 {substitute_part_code} 预占成功'
    
    return result
