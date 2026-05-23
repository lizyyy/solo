from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models import (
    Show, Seat, GroupOrder, ReserveWindow, SeatChangeRequest,
    LockReport, ExceptionLog, SeatStatus, OrderStatus, ChangeStatus,
    ReserveWindowStatus, ExceptionType
)
from schemas import (
    ShowCreate, GroupOrderCreate, SeatChangeRequestCreate,
    SeatChangeReview, ExceptionLogCreate, ManualCorrection, LockReportCreate
)
from config import settings

class SeatService:
    @staticmethod
    def check_seats_available(db: Session, seat_ids: List[int], show_id: Optional[int] = None) -> tuple[bool, List[int], List[int], List[int]]:
        query = db.query(Seat).filter(Seat.id.in_(seat_ids))
        seats = query.all()
        found_ids = {s.id for s in seats}
        missing_ids = [sid for sid in seat_ids if sid not in found_ids]
        wrong_show_ids = []
        if show_id is not None:
            wrong_show_ids = [s.id for s in seats if s.show_id != show_id]
        unavailable = [s.id for s in seats if s.status != SeatStatus.AVAILABLE]
        all_valid = len(missing_ids) == 0 and len(unavailable) == 0 and len(wrong_show_ids) == 0
        return all_valid, unavailable, missing_ids, wrong_show_ids

    @staticmethod
    def lock_seats(db: Session, seat_ids: List[int], order_id: int) -> List[Seat]:
        seats = db.query(Seat).filter(Seat.id.in_(seat_ids)).all()
        for seat in seats:
            seat.status = SeatStatus.LOCKED
            seat.locked_by_order_id = order_id
            seat.locked_at = datetime.now()
        db.flush()
        return seats

    @staticmethod
    def release_seats(db: Session, seat_ids: List[int]) -> List[Seat]:
        seats = db.query(Seat).filter(Seat.id.in_(seat_ids)).all()
        for seat in seats:
            seat.status = SeatStatus.AVAILABLE
            seat.locked_by_order_id = None
            seat.locked_at = None
        db.flush()
        return seats

class ReserveWindowService:
    @staticmethod
    def create_window(db: Session, order_id: int, show_id: int, seat_ids: List[int],
                     minutes: Optional[int] = None) -> ReserveWindow:
        if minutes is None:
            minutes = settings.DEFAULT_RESERVE_MINUTES
        expire_at = datetime.now() + timedelta(minutes=minutes)
        window = ReserveWindow(
            order_id=order_id,
            show_id=show_id,
            seat_ids=seat_ids,
            expire_at=expire_at,
            status=ReserveWindowStatus.ACTIVE
        )
        db.add(window)
        db.flush()
        return window

    @staticmethod
    def check_expired_windows(db: Session) -> List[ReserveWindow]:
        now = datetime.now()
        expired = db.query(ReserveWindow).filter(
            and_(
                ReserveWindow.status == ReserveWindowStatus.ACTIVE,
                ReserveWindow.expire_at < now
            )
        ).all()
        return expired

    @staticmethod
    def expire_window(db: Session, window: ReserveWindow, reason: str = "超时自动释放"):
        window.status = ReserveWindowStatus.EXPIRED
        window.released_at = datetime.now()
        window.released_reason = reason
        SeatService.release_seats(db, window.seat_ids)
        db.flush()

class OrderService:
    @staticmethod
    def create_order(db: Session, order_data: GroupOrderCreate) -> tuple[Optional[GroupOrder], Optional[ReserveWindow], Optional[ExceptionLog]]:
        all_available, unavailable, missing, wrong_show = SeatService.check_seats_available(
            db, order_data.seat_ids, order_data.show_id
        )
        if not all_available:
            error_parts = []
            if missing:
                error_parts.append(f"座位不存在: {missing}")
            if wrong_show:
                error_parts.append(f"座位不属于当前演出: {wrong_show}")
            if unavailable:
                error_parts.append(f"座位不可用: {unavailable}")
            exc_log = ExceptionLogService.create_log(
                db,
                exception_type=ExceptionType.SEAT_NOT_AVAILABLE,
                endpoint="/api/v1/orders",
                original_input=order_data.model_dump(),
                error_message="; ".join(error_parts)
            )
            return None, None, exc_log

        existing_lock = db.query(GroupOrder).join(ReserveWindow).filter(
            and_(
                GroupOrder.contact_phone == order_data.contact_phone,
                GroupOrder.show_id == order_data.show_id,
                ReserveWindow.status == ReserveWindowStatus.ACTIVE
            )
        ).first()
        if existing_lock:
            exc_log = ExceptionLogService.create_log(
                db,
                exception_type=ExceptionType.DUPLICATE_LOCK,
                endpoint="/api/v1/orders",
                original_input=order_data.model_dump(),
                error_message=f"该手机号已有活跃锁座: 订单{existing_lock.id}"
            )
            return None, None, exc_log

        order = GroupOrder(
            show_id=order_data.show_id,
            contact_name=order_data.contact_name,
            contact_phone=order_data.contact_phone,
            group_name=order_data.group_name,
            requested_seats_count=order_data.requested_seats_count,
            notes=order_data.notes,
            status=OrderStatus.PENDING
        )
        db.add(order)
        db.flush()

        SeatService.lock_seats(db, order_data.seat_ids, order.id)
        window = ReserveWindowService.create_window(db, order.id, order_data.show_id, order_data.seat_ids)

        seats = db.query(Seat).filter(Seat.id.in_(order_data.seat_ids)).all()
        order.total_amount = sum(s.price for s in seats)
        order.actual_seats_count = len(seats)

        show = db.query(Show).filter(Show.id == order_data.show_id).first()
        show.available_seats -= len(seats)

        ReportService.create_lock_report(
            db,
            show_id=order_data.show_id,
            order_id=order.id,
            report_type="seat_lock",
            seat_ids=order_data.seat_ids,
            seat_count=len(order_data.seat_ids),
            details={"action": "create_order", "contact": order_data.contact_phone}
        )

        db.commit()
        db.refresh(order)
        db.refresh(window)
        return order, window, None

    @staticmethod
    def cancel_order(db: Session, order_id: int, reason: str) -> Optional[GroupOrder]:
        order = db.query(GroupOrder).filter(GroupOrder.id == order_id).first()
        if not order:
            return None

        windows = db.query(ReserveWindow).filter(
            and_(
                ReserveWindow.order_id == order_id,
                ReserveWindow.status == ReserveWindowStatus.ACTIVE
            )
        ).all()

        all_seat_ids = []
        for window in windows:
            window.status = ReserveWindowStatus.RELEASED
            window.released_at = datetime.now()
            window.released_reason = reason
            all_seat_ids.extend(window.seat_ids)

        if all_seat_ids:
            SeatService.release_seats(db, all_seat_ids)
            show = db.query(Show).filter(Show.id == order.show_id).first()
            show.available_seats += len(all_seat_ids)

        order.status = OrderStatus.CANCELLED
        db.commit()
        db.refresh(order)
        return order

class ChangeRequestService:
    @staticmethod
    def create_change_request(db: Session, data: SeatChangeRequestCreate) -> tuple[Optional[SeatChangeRequest], Optional[ExceptionLog]]:
        order = db.query(GroupOrder).filter(GroupOrder.id == data.order_id).first()
        if not order or order.status == OrderStatus.CANCELLED:
            exc_log = ExceptionLogService.create_log(
                db,
                exception_type=ExceptionType.INVALID_CHANGE,
                endpoint="/api/v1/change-requests",
                original_input=data.model_dump(),
                error_message="订单不存在或已取消"
            )
            return None, exc_log

        all_available, unavailable, missing, wrong_show = SeatService.check_seats_available(
            db, data.requested_seat_ids, data.show_id
        )
        if not all_available:
            error_parts = []
            if missing:
                error_parts.append(f"目标座位不存在: {missing}")
            if wrong_show:
                error_parts.append(f"目标座位不属于当前演出: {wrong_show}")
            if unavailable:
                error_parts.append(f"目标座位不可用: {unavailable}")
            exc_log = ExceptionLogService.create_log(
                db,
                exception_type=ExceptionType.SEAT_NOT_AVAILABLE,
                endpoint="/api/v1/change-requests",
                original_input=data.model_dump(),
                error_message="; ".join(error_parts)
            )
            return None, exc_log

        change_request = SeatChangeRequest(
            order_id=data.order_id,
            show_id=data.show_id,
            original_seat_ids=data.original_seat_ids,
            requested_seat_ids=data.requested_seat_ids,
            new_seat_count=data.new_seat_count,
            reason=data.reason,
            status=ChangeStatus.PENDING_REVIEW
        )
        db.add(change_request)
        db.commit()
        db.refresh(change_request)
        return change_request, None

    @staticmethod
    def review_change_request(db: Session, request_id: int, review: SeatChangeReview) -> Optional[SeatChangeRequest]:
        change_request = db.query(SeatChangeRequest).filter(SeatChangeRequest.id == request_id).first()
        if not change_request or change_request.status != ChangeStatus.PENDING_REVIEW:
            return None

        change_request.status = review.status
        change_request.review_notes = review.review_notes
        change_request.reviewed_by = review.reviewed_by
        change_request.reviewed_at = datetime.now()
        change_request.compensation_amount = review.compensation_amount or 0

        if review.status == ChangeStatus.APPROVED:
            SeatService.release_seats(db, change_request.original_seat_ids)
            SeatService.lock_seats(db, change_request.requested_seat_ids, change_request.order_id)

            order = db.query(GroupOrder).filter(GroupOrder.id == change_request.order_id).first()
            order.requested_seats_count = change_request.new_seat_count
            order.status = OrderStatus.MODIFIED

            windows = db.query(ReserveWindow).filter(
                ReserveWindow.order_id == change_request.order_id,
                ReserveWindow.status == ReserveWindowStatus.ACTIVE
            ).all()
            for window in windows:
                window.seat_ids = change_request.requested_seat_ids

        db.commit()
        db.refresh(change_request)
        return change_request

class ExceptionLogService:
    @staticmethod
    def create_log(db: Session, exception_type: ExceptionType, endpoint: str,
                   original_input: Dict[str, Any], error_message: str) -> ExceptionLog:
        log = ExceptionLog(
            exception_type=exception_type,
            endpoint=endpoint,
            original_input=original_input,
            error_message=error_message
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def resolve_exception(db: Session, log_id: int, resolution: str, resolved_by: str) -> Optional[ExceptionLog]:
        log = db.query(ExceptionLog).filter(ExceptionLog.id == log_id).first()
        if not log:
            return None
        log.resolved = True
        log.resolution = resolution
        log.resolved_by = resolved_by
        log.resolved_at = datetime.now()
        db.commit()
        db.refresh(log)
        return log

class ReportService:
    @staticmethod
    def create_lock_report(db: Session, show_id: int, order_id: Optional[int], report_type: str,
                          seat_ids: Optional[List[int]], seat_count: Optional[int],
                          details: Optional[Dict[str, Any]] = None, generated_by: str = "system") -> LockReport:
        report = LockReport(
            show_id=show_id,
            order_id=order_id,
            report_type=report_type,
            seat_ids=seat_ids,
            seat_count=seat_count,
            details=details,
            generated_by=generated_by
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def generate_show_report(db: Session, show_id: int) -> Dict[str, Any]:
        show = db.query(Show).filter(Show.id == show_id).first()
        if not show:
            return {}

        total_locked = db.query(Seat).filter(
            Seat.show_id == show_id,
            Seat.status == SeatStatus.LOCKED
        ).count()

        total_sold = db.query(Seat).filter(
            Seat.show_id == show_id,
            Seat.status == SeatStatus.SOLD
        ).count()

        active_windows = db.query(ReserveWindow).filter(
            ReserveWindow.show_id == show_id,
            ReserveWindow.status == ReserveWindowStatus.ACTIVE
        ).count()

        pending_changes = db.query(SeatChangeRequest).filter(
            SeatChangeRequest.show_id == show_id,
            SeatChangeRequest.status == ChangeStatus.PENDING_REVIEW
        ).count()

        orders = db.query(GroupOrder).filter(GroupOrder.show_id == show_id).all()

        return {
            "show": {
                "id": show.id,
                "name": show.name,
                "venue": show.venue,
                "show_time": show.show_time.isoformat()
            },
            "summary": {
                "total_seats": show.total_seats,
                "available_seats": show.available_seats,
                "locked_seats": total_locked,
                "sold_seats": total_sold,
                "active_windows": active_windows,
                "pending_changes": pending_changes
            },
            "orders_count": len(orders),
            "generated_at": datetime.now().isoformat()
        }

class ShowService:
    @staticmethod
    def create_show(db: Session, show_data: ShowCreate) -> Show:
        show = Show(
            name=show_data.name,
            venue=show_data.venue,
            show_time=show_data.show_time,
            total_seats=show_data.total_seats,
            available_seats=show_data.total_seats
        )
        db.add(show)
        db.flush()

        for seat_data in show_data.seats:
            seat = Seat(
                show_id=show.id,
                row=seat_data.row,
                number=seat_data.number,
                section=seat_data.section,
                price=seat_data.price,
                status=SeatStatus.AVAILABLE
            )
            db.add(seat)

        db.commit()
        db.refresh(show)
        return show

    @staticmethod
    def get_show_seats(db: Session, show_id: int) -> List[Seat]:
        return db.query(Seat).filter(Seat.show_id == show_id).all()