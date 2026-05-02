from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import Order, CabinetEvent, Discrepancy
from datetime import datetime, timedelta
from typing import List, Dict, Any
from collections import defaultdict


def check_charged_but_not_borrowed(db: Session) -> List[Discrepancy]:
    discrepancies = []
    orders = db.query(Order).filter(Order.status == "completed").all()
    
    for order in orders:
        borrow_events = db.query(CabinetEvent).filter(
            and_(
                CabinetEvent.order_id == order.id,
                CabinetEvent.event_type == "borrow"
            )
        ).all()
        
        if not borrow_events:
            discrepancy = Discrepancy(
                type="charged_but_not_borrowed",
                order_id=order.id,
                cabinet_id=order.cabinet_id,
                slot_id=order.slot_id,
                description=f"订单 {order.id} 已扣费但没有借出事件记录"
            )
            discrepancies.append(discrepancy)
    
    return discrepancies


def check_cross_day_return(db: Session) -> List[Discrepancy]:
    discrepancies = []
    orders = db.query(Order).filter(Order.end_time.isnot(None)).all()
    
    for order in orders:
        if order.start_time.date() != order.end_time.date():
            discrepancy = Discrepancy(
                type="cross_day_return",
                order_id=order.id,
                cabinet_id=order.cabinet_id,
                slot_id=order.slot_id,
                description=f"订单 {order.id} 跨日归还: {order.start_time.date()} -> {order.end_time.date()}"
            )
            discrepancies.append(discrepancy)
    
    return discrepancies


def check_duplicate_slot_events(db: Session) -> List[Discrepancy]:
    discrepancies = []
    events = db.query(CabinetEvent).order_by(CabinetEvent.cabinet_id, CabinetEvent.slot_id, CabinetEvent.event_time).all()
    
    slot_events = defaultdict(list)
    for event in events:
        key = (event.cabinet_id, event.slot_id)
        slot_events[key].append(event)
    
    for (cabinet_id, slot_id), event_list in slot_events.items():
        for i in range(1, len(event_list)):
            prev = event_list[i-1]
            curr = event_list[i]
            
            if prev.event_type == curr.event_type:
                time_diff = (curr.event_time - prev.event_time).total_seconds() / 60
                if time_diff < 30:
                    discrepancy = Discrepancy(
                        type="duplicate_slot_event",
                        order_id=curr.order_id,
                        cabinet_id=cabinet_id,
                        slot_id=slot_id,
                        description=f"槽位 {slot_id} 在 {prev.event_time} 和 {curr.event_time} 有重复 {curr.event_type} 事件 (间隔 {time_diff:.1f} 分钟)",
                        event_id=curr.id
                    )
                    discrepancies.append(discrepancy)
    
    return discrepancies


def run_reconciliation(db: Session) -> Dict[str, Any]:
    db.query(Discrepancy).delete()
    
    discrepancies = []
    discrepancies.extend(check_charged_but_not_borrowed(db))
    discrepancies.extend(check_cross_day_return(db))
    discrepancies.extend(check_duplicate_slot_events(db))
    
    for d in discrepancies:
        db.add(d)
    
    db.commit()
    
    summary = {
        "total_orders": db.query(Order).count(),
        "total_events": db.query(CabinetEvent).count(),
        "total_discrepancies": len(discrepancies),
        "discrepancies_by_type": {
            "charged_but_not_borrowed": len([d for d in discrepancies if d.type == "charged_but_not_borrowed"]),
            "cross_day_return": len([d for d in discrepancies if d.type == "cross_day_return"]),
            "duplicate_slot_event": len([d for d in discrepancies if d.type == "duplicate_slot_event"])
        }
    }
    
    return summary
