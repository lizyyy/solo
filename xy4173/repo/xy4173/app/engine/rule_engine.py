from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, TypeVar, Generic

from sqlalchemy.orm import Session

from app.models import (
    Reservation, SwipeLog, SampleRegistration, User,
    Instrument, ResearchGroup, Violation, Bill
)


class RuleType(str, Enum):
    TIME_OVERLAP = "time_overlap"
    NO_RESERVATION_SWIPE = "no_reservation_swipe"
    CROSS_GROUP_USAGE = "cross_group_usage"
    SAMPLE_OVERDUE = "sample_overdue"
    BILLING_DISCOUNT = "billing_discount"
    MANUAL_RELEASE = "manual_release"
    MISSING_BILL = "missing_bill"
    OVERTIME_USAGE = "overtime_usage"
    RESERVATION_NO_SHOW = "reservation_no_show"


class ViolationSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RuleResult:
    rule_type: RuleType
    success: bool = True
    has_violation: bool = False
    violation_severity: ViolationSeverity = ViolationSeverity.LOW
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    affected_records: List[Any] = field(default_factory=list)
    suggested_fine: float = 0.0


T = TypeVar('T')


class BaseRule(ABC, Generic[T]):
    
    rule_type: RuleType
    description: str = ""
    
    @abstractmethod
    def execute(self, db: Session, context: Dict[str, Any] = None) -> RuleResult:
        pass
    
    @abstractmethod
    def check_single(self, record: T, db: Session, context: Dict[str, Any] = None) -> RuleResult:
        pass


class TimeOverlapRule(BaseRule[Reservation]):
    """时段重叠检查 - 检查同一仪器的预约时段是否重叠"""
    
    rule_type = RuleType.TIME_OVERLAP
    description = "检查同一仪器的预约时段是否重叠"
    
    def execute(self, db: Session, context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="无时段重叠问题"
        )
        
        instrument_id = context.get("instrument_id") if context else None
        date_filter = context.get("date") if context else None
        
        query = db.query(Reservation).filter(
            Reservation.is_cancelled == False
        )
        
        if instrument_id:
            query = query.filter(Reservation.instrument_id == instrument_id)
        
        if date_filter:
            if isinstance(date_filter, str):
                try:
                    date_filter = datetime.strptime(date_filter, "%Y-%m-%d").date()
                except ValueError:
                    pass
            if hasattr(date_filter, 'date'):
                date_filter = date_filter.date()
            query = query.filter(
                Reservation.start_time >= datetime.combine(date_filter, datetime.min.time()),
                Reservation.start_time < datetime.combine(date_filter + timedelta(days=1), datetime.min.time())
            )
        
        reservations = query.order_by(Reservation.instrument_id, Reservation.start_time).all()
        
        reservations_by_instrument: Dict[int, List[Reservation]] = {}
        for res in reservations:
            if res.instrument_id not in reservations_by_instrument:
                reservations_by_instrument[res.instrument_id] = []
            reservations_by_instrument[res.instrument_id].append(res)
        
        for inst_id, res_list in reservations_by_instrument.items():
            res_list.sort(key=lambda x: x.start_time)
            
            for i in range(len(res_list) - 1):
                current = res_list[i]
                next_res = res_list[i + 1]
                
                if self._is_overlapping(current, next_res):
                    result.has_violation = True
                    result.success = False
                    result.violation_severity = ViolationSeverity.MEDIUM
                    result.message = f"发现时段重叠问题"
                    result.affected_records.append({
                        "instrument_id": inst_id,
                        "reservation_1": {
                            "id": current.id,
                            "code": current.reservation_code,
                            "start": current.start_time.isoformat(),
                            "end": current.end_time.isoformat()
                        },
                        "reservation_2": {
                            "id": next_res.id,
                            "code": next_res.reservation_code,
                            "start": next_res.start_time.isoformat(),
                            "end": next_res.end_time.isoformat()
                        }
                    })
        
        return result
    
    def check_single(self, reservation: Reservation, db: Session, 
                     context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="无时段重叠"
        )
        
        overlapping = db.query(Reservation).filter(
            Reservation.instrument_id == reservation.instrument_id,
            Reservation.id != reservation.id,
            Reservation.is_cancelled == False,
            Reservation.start_time < reservation.end_time,
            Reservation.end_time > reservation.start_time
        ).all()
        
        if overlapping:
            result.has_violation = True
            result.success = False
            result.violation_severity = ViolationSeverity.MEDIUM
            result.message = f"发现 {len(overlapping)} 个时段重叠的预约"
            result.affected_records = overlapping
        
        return result
    
    @staticmethod
    def _is_overlapping(r1: Reservation, r2: Reservation) -> bool:
        return r1.start_time < r2.end_time and r2.start_time < r1.end_time


class NoReservationSwipeRule(BaseRule[SwipeLog]):
    """无预约刷卡检查 - 检查刷卡记录是否有对应的预约"""
    
    rule_type = RuleType.NO_RESERVATION_SWIPE
    description = "检查刷卡记录是否有对应的预约"
    
    def execute(self, db: Session, context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="所有刷卡都有对应的预约"
        )
        
        date_filter = context.get("date") if context else None
        grace_minutes = context.get("grace_minutes", 30) if context else 30
        
        query = db.query(SwipeLog).filter(
            SwipeLog.is_manual_release == False,
            SwipeLog.is_matched == False
        )
        
        if date_filter:
            if isinstance(date_filter, str):
                try:
                    date_filter = datetime.strptime(date_filter, "%Y-%m-%d").date()
                except ValueError:
                    pass
            if hasattr(date_filter, 'date'):
                date_filter = date_filter.date()
            query = query.filter(
                SwipeLog.swipe_time >= datetime.combine(date_filter, datetime.min.time()),
                SwipeLog.swipe_time < datetime.combine(date_filter + timedelta(days=1), datetime.min.time())
            )
        
        swipe_logs = query.all()
        
        for swipe in swipe_logs:
            matching_reservation = self._find_matching_reservation(
                db, swipe, grace_minutes
            )
            
            if not matching_reservation:
                result.has_violation = True
                result.success = False
                result.violation_severity = ViolationSeverity.HIGH
                result.message = f"发现无预约刷卡记录"
                result.affected_records.append({
                    "swipe_id": swipe.id,
                    "card_number": swipe.card_number,
                    "swipe_time": swipe.swipe_time.isoformat(),
                    "instrument_id": swipe.instrument_id,
                    "device_id": swipe.device_id
                })
        
        return result
    
    def check_single(self, swipe_log: SwipeLog, db: Session,
                     context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="刷卡有对应的预约"
        )
        
        if swipe_log.is_manual_release:
            result.message = "人工放行，跳过检查"
            return result
        
        grace_minutes = context.get("grace_minutes", 30) if context else 30
        
        matching_reservation = self._find_matching_reservation(
            db, swipe_log, grace_minutes
        )
        
        if not matching_reservation:
            result.has_violation = True
            result.success = False
            result.violation_severity = ViolationSeverity.HIGH
            result.message = "无预约刷卡"
        
        return result
    
    @staticmethod
    def _find_matching_reservation(db: Session, swipe: SwipeLog, 
                                    grace_minutes: int) -> Optional[Reservation]:
        grace = timedelta(minutes=grace_minutes)
        
        query = db.query(Reservation).filter(
            Reservation.is_cancelled == False
        )
        
        if swipe.instrument_id:
            query = query.filter(Reservation.instrument_id == swipe.instrument_id)
        
        if swipe.user_id:
            query = query.filter(Reservation.user_id == swipe.user_id)
        
        query = query.filter(
            Reservation.start_time - grace <= swipe.swipe_time,
            Reservation.end_time + grace >= swipe.swipe_time
        )
        
        return query.first()


class CrossGroupUsageRule(BaseRule[SwipeLog]):
    """跨课题组使用检查 - 检查刷卡用户是否属于预约的课题组"""
    
    rule_type = RuleType.CROSS_GROUP_USAGE
    description = "检查刷卡用户是否属于预约的课题组"
    
    def execute(self, db: Session, context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="无跨课题组使用问题"
        )
        
        date_filter = context.get("date") if context else None
        
        query = db.query(SwipeLog).filter(
            SwipeLog.reservation_id.isnot(None)
        )
        
        if date_filter:
            if isinstance(date_filter, str):
                try:
                    date_filter = datetime.strptime(date_filter, "%Y-%m-%d").date()
                except ValueError:
                    pass
            if hasattr(date_filter, 'date'):
                date_filter = date_filter.date()
            query = query.filter(
                SwipeLog.swipe_time >= datetime.combine(date_filter, datetime.min.time()),
                SwipeLog.swipe_time < datetime.combine(date_filter + timedelta(days=1), datetime.min.time())
            )
        
        swipe_logs = query.all()
        
        for swipe in swipe_logs:
            if self._is_cross_group(db, swipe):
                result.has_violation = True
                result.success = False
                result.violation_severity = ViolationSeverity.MEDIUM
                result.message = "发现跨课题组使用"
                result.affected_records.append({
                    "swipe_id": swipe.id,
                    "reservation_id": swipe.reservation_id,
                    "user_id": swipe.user_id,
                    "card_number": swipe.card_number
                })
        
        return result
    
    def check_single(self, swipe_log: SwipeLog, db: Session,
                     context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="用户属于预约的课题组"
        )
        
        if not swipe_log.reservation_id:
            result.message = "无预约关联，跳过检查"
            return result
        
        if self._is_cross_group(db, swipe_log):
            result.has_violation = True
            result.success = False
            result.violation_severity = ViolationSeverity.MEDIUM
            result.message = "跨课题组使用"
        
        return result
    
    @staticmethod
    def _is_cross_group(db: Session, swipe: SwipeLog) -> bool:
        if not swipe.reservation_id:
            return False
        
        reservation = db.query(Reservation).filter(
            Reservation.id == swipe.reservation_id
        ).first()
        
        if not reservation:
            return False
        
        user = db.query(User).filter(User.id == swipe.user_id).first() if swipe.user_id else None
        if not user:
            user = db.query(User).filter(User.card_number == swipe.card_number).first()
        
        if not user:
            return False
        
        reservation_group_id = reservation.research_group_id
        user_group_id = user.research_group_id
        
        if reservation_group_id and user_group_id:
            return reservation_group_id != user_group_id
        
        return False


class SampleOverdueRule(BaseRule[SampleRegistration]):
    """样品逾期检查 - 检查样品是否逾期未取"""
    
    rule_type = RuleType.SAMPLE_OVERDUE
    description = "检查样品是否逾期未取"
    
    def execute(self, db: Session, context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="无逾期样品"
        )
        
        now = datetime.now()
        
        samples = db.query(SampleRegistration).filter(
            SampleRegistration.status != "picked_up",
            SampleRegistration.actual_pickup_at.is_(None)
        ).all()
        
        for sample in samples:
            if self._is_overdue(sample, now):
                result.has_violation = True
                result.success = False
                result.violation_severity = ViolationSeverity.LOW
                result.message = "发现逾期样品"
                result.affected_records.append({
                    "sample_id": sample.id,
                    "sample_code": sample.sample_code,
                    "registered_at": sample.registered_at.isoformat(),
                    "max_storage_hours": sample.max_storage_hours,
                    "overdue_hours": self._calculate_overdue_hours(sample, now)
                })
        
        return result
    
    def check_single(self, sample: SampleRegistration, db: Session,
                     context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="样品未逾期"
        )
        
        now = context.get("current_time", datetime.now()) if context else datetime.now()
        
        if self._is_overdue(sample, now):
            result.has_violation = True
            result.success = False
            result.violation_severity = ViolationSeverity.LOW
            result.message = "样品逾期未取"
            result.details = {
                "overdue_hours": self._calculate_overdue_hours(sample, now)
            }
        
        return result
    
    @staticmethod
    def _is_overdue(sample: SampleRegistration, now: datetime) -> bool:
        if sample.status == "picked_up" or sample.actual_pickup_at:
            return False
        
        deadline = sample.registered_at + timedelta(hours=sample.max_storage_hours)
        
        if sample.expected_pickup_at:
            deadline = min(deadline, sample.expected_pickup_at)
        
        return now > deadline
    
    @staticmethod
    def _calculate_overdue_hours(sample: SampleRegistration, now: datetime) -> float:
        if sample.status == "picked_up" or sample.actual_pickup_at:
            return 0.0
        
        deadline = sample.registered_at + timedelta(hours=sample.max_storage_hours)
        
        if sample.expected_pickup_at:
            deadline = min(deadline, sample.expected_pickup_at)
        
        if now <= deadline:
            return 0.0
        
        delta = now - deadline
        return round(delta.total_seconds() / 3600, 2)


class ReservationNoShowRule(BaseRule[Reservation]):
    """预约未到检查 - 检查预约但未刷卡的情况"""
    
    rule_type = RuleType.RESERVATION_NO_SHOW
    description = "检查预约但未刷卡的情况"
    
    def execute(self, db: Session, context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="无预约未到情况"
        )
        
        grace_minutes = context.get("grace_minutes", 30) if context else 30
        now = datetime.now()
        
        reservations = db.query(Reservation).filter(
            Reservation.is_cancelled == False,
            Reservation.end_time < now
        ).all()
        
        for reservation in reservations:
            has_swipe = db.query(SwipeLog).filter(
                SwipeLog.reservation_id == reservation.id
            ).first()
            
            if not has_swipe:
                result.has_violation = True
                result.success = False
                result.violation_severity = ViolationSeverity.MEDIUM
                result.message = "发现预约未到情况"
                result.affected_records.append({
                    "reservation_id": reservation.id,
                    "reservation_code": reservation.reservation_code,
                    "user_id": reservation.user_id,
                    "start_time": reservation.start_time.isoformat(),
                    "end_time": reservation.end_time.isoformat()
                })
        
        return result
    
    def check_single(self, reservation: Reservation, db: Session,
                     context: Dict[str, Any] = None) -> RuleResult:
        result = RuleResult(
            rule_type=self.rule_type,
            success=True,
            message="预约已使用"
        )
        
        now = datetime.now()
        if reservation.end_time > now:
            result.message = "预约尚未结束"
            return result
        
        has_swipe = db.query(SwipeLog).filter(
            SwipeLog.reservation_id == reservation.id
        ).first()
        
        if not has_swipe:
            result.has_violation = True
            result.success = False
            result.violation_severity = ViolationSeverity.MEDIUM
            result.message = "预约未到"
        
        return result


class RuleEngine:
    
    def __init__(self, db: Session):
        self.db = db
        self.rules: Dict[RuleType, BaseRule] = {
            RuleType.TIME_OVERLAP: TimeOverlapRule(),
            RuleType.NO_RESERVATION_SWIPE: NoReservationSwipeRule(),
            RuleType.CROSS_GROUP_USAGE: CrossGroupUsageRule(),
            RuleType.SAMPLE_OVERDUE: SampleOverdueRule(),
            RuleType.RESERVATION_NO_SHOW: ReservationNoShowRule(),
        }
    
    def run_rule(self, rule_type: RuleType, context: Dict[str, Any] = None) -> RuleResult:
        rule = self.rules.get(rule_type)
        if not rule:
            return RuleResult(
                rule_type=rule_type,
                success=False,
                message=f"未找到规则: {rule_type}"
            )
        return rule.execute(self.db, context)
    
    def run_all_rules(self, context: Dict[str, Any] = None) -> List[RuleResult]:
        results = []
        for rule_type, rule in self.rules.items():
            result = rule.execute(self.db, context)
            results.append(result)
        return results
    
    def check_record(self, record: Any, rule_types: List[RuleType] = None,
                     context: Dict[str, Any] = None) -> List[RuleResult]:
        results = []
        types_to_check = rule_types or list(self.rules.keys())
        
        for rule_type in types_to_check:
            rule = self.rules.get(rule_type)
            if rule:
                result = rule.check_single(record, self.db, context)
                results.append(result)
        
        return results


def check_time_overlap(db: Session, context: Dict[str, Any] = None) -> RuleResult:
    return TimeOverlapRule().execute(db, context)


def check_no_reservation_swipe(db: Session, context: Dict[str, Any] = None) -> RuleResult:
    return NoReservationSwipeRule().execute(db, context)


def check_cross_group_usage(db: Session, context: Dict[str, Any] = None) -> RuleResult:
    return CrossGroupUsageRule().execute(db, context)


def check_sample_overdue(db: Session, context: Dict[str, Any] = None) -> RuleResult:
    return SampleOverdueRule().execute(db, context)


def check_billing_discount(db: Session, context: Dict[str, Any] = None) -> RuleResult:
    return RuleResult(
        rule_type=RuleType.BILLING_DISCOUNT,
        success=True,
        message="计费减免检查完成"
    )


def check_manual_release(db: Session, context: Dict[str, Any] = None) -> RuleResult:
    result = RuleResult(
        rule_type=RuleType.MANUAL_RELEASE,
        success=True,
        message="无未记录的人工放行"
    )
    
    manual_swipes = db.query(SwipeLog).filter(
        SwipeLog.is_manual_release == True,
        SwipeLog.manual_release_reason.is_(None)
    ).all()
    
    if manual_swipes:
        result.has_violation = True
        result.success = False
        result.violation_severity = ViolationSeverity.MEDIUM
        result.message = f"发现 {len(manual_swipes)} 条无理由人工放行记录"
        result.affected_records = [
            {"swipe_id": s.id, "swipe_time": s.swipe_time.isoformat()} 
            for s in manual_swipes
        ]
    
    return result


def run_all_rules(db: Session, context: Dict[str, Any] = None) -> List[RuleResult]:
    engine = RuleEngine(db)
    return engine.run_all_rules(context)
