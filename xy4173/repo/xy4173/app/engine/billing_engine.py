from dataclasses import dataclass, field
from datetime import datetime, timedelta, time
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import (
    Reservation, SwipeLog, Instrument, BillingRule, 
    ResearchGroup, Bill, User
)


@dataclass
class BillingResult:
    success: bool = True
    message: str = ""
    base_duration_hours: float = 0.0
    base_amount: float = 0.0
    overtime_duration_hours: float = 0.0
    overtime_amount: float = 0.0
    night_duration_hours: float = 0.0
    night_amount: float = 0.0
    weekend_duration_hours: float = 0.0
    weekend_amount: float = 0.0
    discount_amount: float = 0.0
    discount_reason: Optional[str] = None
    total_amount: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)


def calculate_duration(start_time: datetime, end_time: datetime) -> float:
    if end_time <= start_time:
        return 0.0
    delta = end_time - start_time
    return round(delta.total_seconds() / 3600, 2)


def is_night_time(dt: datetime, night_start: time = time(22, 0), 
                  night_end: time = time(6, 0)) -> bool:
    t = dt.time()
    if night_start > night_end:
        return t >= night_start or t < night_end
    return night_start <= t < night_end


def is_weekend(dt: datetime) -> bool:
    return dt.weekday() >= 5


def split_time_segments(start_time: datetime, end_time: datetime,
                         night_start: time = time(22, 0),
                         night_end: time = time(6, 0)) -> Dict[str, float]:
    segments = {
        "normal": 0.0,
        "night": 0.0,
        "weekend": 0.0,
        "weekend_night": 0.0
    }
    
    if end_time <= start_time:
        return segments
    
    current = start_time
    while current < end_time:
        next_hour = current + timedelta(hours=1)
        segment_end = min(next_hour, end_time)
        segment_duration = (segment_end - current).total_seconds() / 3600
        
        is_night = is_night_time(current, night_start, night_end)
        is_weekend_day = is_weekend(current)
        
        if is_weekend_day and is_night:
            segments["weekend_night"] += segment_duration
        elif is_weekend_day:
            segments["weekend"] += segment_duration
        elif is_night:
            segments["night"] += segment_duration
        else:
            segments["normal"] += segment_duration
        
        current = next_hour
    
    return segments


def calculate_overtime(total_duration: float, base_hours: float = 0) -> float:
    if total_duration <= base_hours:
        return 0.0
    return round(total_duration - base_hours, 2)


def calculate_night_surcharge(night_hours: float, base_rate: float,
                               multiplier: float = 1.0) -> Tuple[float, float]:
    if multiplier <= 1.0:
        return (night_hours, 0.0)
    surcharge_amount = night_hours * base_rate * (multiplier - 1.0)
    return (night_hours, round(surcharge_amount, 2))


def calculate_weekend_surcharge(weekend_hours: float, base_rate: float,
                                 multiplier: float = 1.5) -> Tuple[float, float]:
    if multiplier <= 1.0:
        return (weekend_hours, 0.0)
    surcharge_amount = weekend_hours * base_rate * (multiplier - 1.0)
    return (weekend_hours, round(surcharge_amount, 2))


def apply_discount(total_amount: float, discount_rate: float = 1.0) -> Tuple[float, float]:
    if discount_rate >= 1.0:
        return (total_amount, 0.0)
    discount_amount = total_amount * (1.0 - discount_rate)
    final_amount = total_amount - discount_amount
    return (round(final_amount, 2), round(discount_amount, 2))


def find_applicable_rules(db: Session, reservation: Reservation,
                          instrument: Instrument = None) -> List[BillingRule]:
    rules = []
    
    instrument_id = reservation.instrument_id
    research_group_id = reservation.research_group_id
    
    query = db.query(BillingRule).filter(
        BillingRule.is_active == True
    )
    
    instrument_rules = query.filter(
        BillingRule.instrument_id == instrument_id
    ).all()
    rules.extend(instrument_rules)
    
    if research_group_id:
        group_rules = query.filter(
            BillingRule.research_group_id == research_group_id
        ).all()
        rules.extend(group_rules)
    
    general_rules = query.filter(
        BillingRule.instrument_id.is_(None),
        BillingRule.research_group_id.is_(None)
    ).all()
    rules.extend(general_rules)
    
    rules.sort(key=lambda r: r.priority, reverse=True)
    
    now = datetime.now()
    filtered = []
    for rule in rules:
        if rule.valid_from and now < rule.valid_from:
            continue
        if rule.valid_to and now > rule.valid_to:
            continue
        filtered.append(rule)
    
    return filtered


class BillingEngine:
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_reservation_bill(self, reservation: Reservation,
                                    actual_start: datetime = None,
                                    actual_end: datetime = None) -> BillingResult:
        result = BillingResult(success=True, message="计费计算成功")
        
        instrument = self.db.query(Instrument).filter(
            Instrument.id == reservation.instrument_id
        ).first()
        
        if not instrument:
            result.success = False
            result.message = "未找到仪器信息"
            return result
        
        start_time = actual_start or reservation.start_time
        end_time = actual_end or reservation.end_time
        
        total_duration = calculate_duration(start_time, end_time)
        result.base_duration_hours = total_duration
        
        rules = find_applicable_rules(self.db, reservation, instrument)
        
        base_rate = instrument.hourly_rate
        overtime_multiplier = 1.5
        overtime_start = 0
        night_multiplier = 1.0
        night_start = time(22, 0)
        night_end = time(6, 0)
        weekend_multiplier = 1.5
        discount_rate = 1.0
        discount_reason = None
        
        for rule in rules:
            if rule.base_hourly_rate > 0:
                base_rate = rule.base_hourly_rate
            
            if rule.overtime_rate_multiplier > 1.0:
                overtime_multiplier = rule.overtime_rate_multiplier
            
            if rule.overtime_start_hours > 0:
                overtime_start = rule.overtime_start_hours
            
            if rule.night_rate_multiplier > 1.0:
                night_multiplier = rule.night_rate_multiplier
                night_start = rule.night_start_time
                night_end = rule.night_end_time
            
            if rule.weekend_rate_multiplier > 1.0:
                weekend_multiplier = rule.weekend_rate_multiplier
            
            if rule.discount_rate < 1.0:
                discount_rate = rule.discount_rate
                discount_reason = rule.discount_reason
                break
        
        segments = split_time_segments(start_time, end_time, night_start, night_end)
        
        normal_hours = segments["normal"]
        night_hours = segments["night"]
        weekend_hours = segments["weekend"]
        weekend_night_hours = segments["weekend_night"]
        
        base_amount = normal_hours * base_rate
        result.base_amount = round(base_amount, 2)
        
        overtime_hours = calculate_overtime(total_duration, overtime_start)
        result.overtime_duration_hours = overtime_hours
        if overtime_hours > 0 and overtime_multiplier > 1.0:
            result.overtime_amount = round(
                overtime_hours * base_rate * (overtime_multiplier - 1.0), 2
            )
        
        if night_hours > 0 and night_multiplier > 1.0:
            result.night_duration_hours = night_hours
            result.night_amount = round(
                night_hours * base_rate * (night_multiplier - 1.0), 2
            )
        
        if weekend_hours > 0 and weekend_multiplier > 1.0:
            result.weekend_duration_hours = weekend_hours
            result.weekend_amount = round(
                weekend_hours * base_rate * (weekend_multiplier - 1.0), 2
            )
        
        subtotal = (
            result.base_amount + 
            result.overtime_amount + 
            result.night_amount + 
            result.weekend_amount
        )
        
        if discount_rate < 1.0:
            final_amount, discount_amount = apply_discount(subtotal, discount_rate)
            result.discount_amount = discount_amount
            result.discount_reason = discount_reason
            result.total_amount = final_amount
        else:
            result.total_amount = round(subtotal, 2)
        
        result.details = {
            "base_rate": base_rate,
            "overtime_multiplier": overtime_multiplier,
            "overtime_start_hours": overtime_start,
            "night_multiplier": night_multiplier,
            "weekend_multiplier": weekend_multiplier,
            "discount_rate": discount_rate,
            "segments": segments
        }
        
        return result
    
    def create_bill_record(self, reservation: Reservation,
                           billing_result: BillingResult,
                           bill_date: datetime = None) -> Bill:
        bill_date = bill_date or datetime.now()
        
        bill = Bill(
            bill_code=f"BILL_{bill_date.strftime('%Y%m%d')}_{reservation.id:04d}",
            user_id=reservation.user_id,
            reservation_id=reservation.id,
            instrument_id=reservation.instrument_id,
            research_group_id=reservation.research_group_id,
            bill_date=bill_date,
            base_duration_hours=billing_result.base_duration_hours,
            base_amount=billing_result.base_amount,
            overtime_duration_hours=billing_result.overtime_duration_hours,
            overtime_amount=billing_result.overtime_amount,
            night_duration_hours=billing_result.night_duration_hours,
            night_amount=billing_result.night_amount,
            discount_amount=billing_result.discount_amount,
            discount_reason=billing_result.discount_reason,
            total_amount=billing_result.total_amount,
            status="pending",
            is_waived=False,
            is_paid=False
        )
        
        self.db.add(bill)
        self.db.commit()
        self.db.refresh(bill)
        
        return bill


def calculate_bill(db: Session, reservation: Reservation,
                   actual_start: datetime = None,
                   actual_end: datetime = None) -> BillingResult:
    engine = BillingEngine(db)
    return engine.calculate_reservation_bill(reservation, actual_start, actual_end)
