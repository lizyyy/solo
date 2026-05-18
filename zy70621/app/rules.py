from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from app import models


class OrderStatus:
    PENDING = "pending"
    ASSIGNED = "assigned"
    PROCESSING = "processing"
    OUTSOURCED = "outsourced"
    COMPLETED = "completed"
    VERIFIED = "verified"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class RuleEngine:
    @staticmethod
    def calculate_expected_completion(reported_at: datetime, sla_hours: int) -> datetime:
        return reported_at + timedelta(hours=sla_hours)

    @staticmethod
    def check_overdue(order: models.RepairOrder) -> bool:
        if order.status in [OrderStatus.COMPLETED, OrderStatus.VERIFIED, OrderStatus.CLOSED, OrderStatus.CANCELLED]:
            return False
        if not order.expected_completion_at:
            return False
        return datetime.now() > order.expected_completion_at

    @staticmethod
    def update_overdue_status(db: Session, order: models.RepairOrder) -> bool:
        is_overdue = RuleEngine.check_overdue(order)
        if order.is_overdue != is_overdue:
            order.is_overdue = is_overdue
            db.commit()
        return is_overdue

    @staticmethod
    def batch_update_overdue(db: Session) -> int:
        from sqlalchemy import and_, or_
        active_statuses = [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.PROCESSING, OrderStatus.OUTSOURCED]
        orders = db.query(models.RepairOrder).filter(
            and_(
                models.RepairOrder.status.in_(active_statuses),
                models.RepairOrder.is_overdue == False
            )
        ).all()
        
        count = 0
        for order in orders:
            if RuleEngine.check_overdue(order):
                order.is_overdue = True
                count += 1
        db.commit()
        return count

    @staticmethod
    def check_duplicate_reminder(db: Session, order_id: int, content: str, window_minutes: int = 30) -> Optional[models.Reminder]:
        from sqlalchemy import and_
        cutoff_time = datetime.now() - timedelta(minutes=window_minutes)
        similar = db.query(models.Reminder).filter(
            and_(
                models.Reminder.repair_order_id == order_id,
                models.Reminder.reminded_at >= cutoff_time
            )
        ).all()
        
        for reminder in similar:
            if RuleEngine._content_similarity(reminder.content, content) > 0.7:
                return reminder
        return None

    @staticmethod
    def _content_similarity(text1: str, text2: str) -> float:
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        if not words1 or not words2:
            return 0.0
        intersection = words1 & words2
        union = words1 | words2
        return len(intersection) / len(union)

    @staticmethod
    def find_merge_candidates(db: Session, order: models.RepairOrder, window_hours: int = 24) -> List[models.RepairOrder]:
        from sqlalchemy import and_
        cutoff_time = datetime.now() - timedelta(hours=window_hours)
        candidates = db.query(models.RepairOrder).filter(
            and_(
                models.RepairOrder.building_room_id == order.building_room_id,
                models.RepairOrder.id != order.id,
                models.RepairOrder.reported_at >= cutoff_time,
                models.RepairOrder.is_merged == False,
                models.RepairOrder.status.notin_([OrderStatus.CLOSED, OrderStatus.CANCELLED])
            )
        ).all()
        
        result = []
        for candidate in candidates:
            if RuleEngine._content_similarity(order.description, candidate.description) > 0.5:
                result.append(candidate)
        return result

    @staticmethod
    def merge_orders(db: Session, source_order: models.RepairOrder, target_order: models.RepairOrder, operated_by: str) -> bool:
        source_order.is_merged = True
        source_order.merged_into_order_id = target_order.id
        source_order.status = OrderStatus.CLOSED
        
        for reminder in source_order.reminders:
            reminder.repair_order_id = target_order.id
        
        target_order.reminder_count += source_order.reminder_count
        
        log = models.StatusLog(
            repair_order_id=source_order.id,
            from_status=source_order.status,
            to_status=OrderStatus.CLOSED,
            operated_by=operated_by,
            operation_type="merge",
            notes=f"合并到工单 {target_order.order_no}",
            conclusion=f"工单已合并，目标工单ID: {target_order.id}"
        )
        db.add(log)
        
        log2 = models.StatusLog(
            repair_order_id=target_order.id,
            from_status=target_order.status,
            to_status=target_order.status,
            operated_by=operated_by,
            operation_type="merge_receive",
            notes=f"接收合并工单 {source_order.order_no}",
            conclusion=f"已接收合并工单，催办次数+{source_order.reminder_count}"
        )
        db.add(log2)
        
        db.commit()
        return True

    @staticmethod
    def get_next_status(current_status: str, transition: str) -> Optional[str]:
        status_flow = {
            OrderStatus.PENDING: {
                "assign": OrderStatus.ASSIGNED,
                "outsource": OrderStatus.OUTSOURCED,
                "cancel": OrderStatus.CANCELLED
            },
            OrderStatus.ASSIGNED: {
                "start": OrderStatus.PROCESSING,
                "outsource": OrderStatus.OUTSOURCED,
                "reassign": OrderStatus.ASSIGNED,
                "cancel": OrderStatus.CANCELLED
            },
            OrderStatus.PROCESSING: {
                "complete": OrderStatus.COMPLETED,
                "outsource": OrderStatus.OUTSOURCED,
                "reassign": OrderStatus.ASSIGNED,
                "cancel": OrderStatus.CANCELLED
            },
            OrderStatus.OUTSOURCED: {
                "complete": OrderStatus.COMPLETED,
                "take_back": OrderStatus.PROCESSING,
                "cancel": OrderStatus.CANCELLED
            },
            OrderStatus.COMPLETED: {
                "verify": OrderStatus.VERIFIED,
                "reopen": OrderStatus.PROCESSING
            },
            OrderStatus.VERIFIED: {
                "close": OrderStatus.CLOSED,
                "reopen": OrderStatus.PROCESSING
            }
        }
        
        if current_status in status_flow and transition in status_flow[current_status]:
            return status_flow[current_status][transition]
        return None