from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import uuid
import json
import hashlib

from models import (
    Resource, Reservation, Waitlist, WaitlistNotification, WaitlistReport,
    OperationLog, ReservationStatus, WaitlistStatus, NotificationChannel
)
from schemas import (
    ReservationCreate, WaitlistCreate, ReservationCancel, WaitlistConfirm,
    WaitlistManualUpdate, ReportGenerate
)


def generate_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"


def get_resource_by_code(db: Session, resource_code: str) -> Optional[Resource]:
    return db.query(Resource).filter(Resource.resource_code == resource_code).first()


def check_time_overlap(db: Session, resource_id: int, start_time: datetime, end_time: datetime, exclude_reservation_id: Optional[int] = None) -> bool:
    query = db.query(Reservation).filter(
        Reservation.resource_id == resource_id,
        Reservation.status == ReservationStatus.CONFIRMED,
        or_(
            and_(Reservation.start_time < end_time, Reservation.end_time > start_time),
        )
    )
    if exclude_reservation_id:
        query = query.filter(Reservation.id != exclude_reservation_id)
    return query.first() is not None


def create_reservation(db: Session, reservation: ReservationCreate) -> Tuple[Optional[Reservation], Optional[str]]:
    resource = get_resource_by_code(db, reservation.resource_code)
    if not resource:
        return None, f"Resource {reservation.resource_code} not found"

    if check_time_overlap(db, resource.id, reservation.start_time, reservation.end_time):
        return None, "Time slot already reserved"

    db_reservation = Reservation(
        reservation_no=generate_no("RES"),
        resource_id=resource.id,
        booker_id=reservation.booker_id,
        booker_name=reservation.booker_name,
        booker_contact=reservation.booker_contact,
        start_time=reservation.start_time,
        end_time=reservation.end_time,
        raw_request=reservation.raw_request
    )
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    return db_reservation, None


def cancel_reservation(db: Session, reservation_id: int, cancel_data: ReservationCancel) -> Tuple[Optional[Reservation], Optional[str]]:
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        return None, "Reservation not found"

    if reservation.status == ReservationStatus.CANCELLED:
        return None, "Reservation already cancelled"

    original_status = reservation.status
    reservation.status = ReservationStatus.CANCELLED
    reservation.cancel_reason = cancel_data.cancel_reason
    reservation.cancelled_at = datetime.now()
    reservation.cancel_operator = cancel_data.cancel_operator

    log_operation(
        db, "CANCEL_RESERVATION", "Reservation", reservation_id,
        cancel_data.cancel_operator or "system",
        json.dumps({"status": original_status}),
        json.dumps({"status": ReservationStatus.CANCELLED, "reason": cancel_data.cancel_reason}),
        cancel_data.cancel_reason
    )

    db.commit()
    db.refresh(reservation)

    trigger_waitlist_notifications(db, reservation)

    return reservation, None


def add_to_waitlist(db: Session, waitlist: WaitlistCreate) -> Tuple[Optional[Waitlist], Optional[str]]:
    resource = get_resource_by_code(db, waitlist.resource_code)
    if not resource:
        return None, f"Resource {waitlist.resource_code} not found"

    existing = db.query(Waitlist).filter(
        Waitlist.resource_id == resource.id,
        Waitlist.user_id == waitlist.user_id,
        Waitlist.status.in_([WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED])
    ).first()
    if existing:
        return None, "Already in waitlist for this resource"

    max_position = db.query(Waitlist).filter(
        Waitlist.resource_id == resource.id,
        Waitlist.status == WaitlistStatus.WAITING
    ).count()

    db_waitlist = Waitlist(
        waitlist_no=generate_no("WLT"),
        resource_id=resource.id,
        user_id=waitlist.user_id,
        user_name=waitlist.user_name,
        user_contact=waitlist.user_contact,
        priority=waitlist.priority,
        desired_start_time=waitlist.desired_start_time,
        desired_end_time=waitlist.desired_end_time,
        status=WaitlistStatus.WAITING,
        queue_position=max_position + 1,
        raw_request=waitlist.raw_request
    )
    db.add(db_waitlist)
    db.commit()
    db.refresh(db_waitlist)

    reorder_waitlist(db, resource.id)

    return db_waitlist, None


def reorder_waitlist(db: Session, resource_id: int) -> None:
    waitlists = db.query(Waitlist).filter(
        Waitlist.resource_id == resource_id,
        Waitlist.status == WaitlistStatus.WAITING
    ).order_by(
        Waitlist.priority.desc(),
        Waitlist.created_at.asc()
    ).all()

    for idx, waitlist in enumerate(waitlists, 1):
        waitlist.queue_position = idx

    db.commit()


def trigger_waitlist_notifications(db: Session, cancelled_reservation: Reservation) -> None:
    resource_id = cancelled_reservation.resource_id

    waitlists = db.query(Waitlist).filter(
        Waitlist.resource_id == resource_id,
        Waitlist.status == WaitlistStatus.WAITING
    ).order_by(
        Waitlist.queue_position.asc()
    ).all()

    for waitlist in waitlists[:1]:
        notify_waitlist_user(db, waitlist, cancelled_reservation)


def generate_deduplication_key(waitlist_id: int, reservation_id: int, timestamp: datetime) -> str:
    key = f"{waitlist_id}:{reservation_id}:{timestamp.strftime('%Y%m%d%H')}"
    return hashlib.md5(key.encode()).hexdigest()


def notify_waitlist_user(db: Session, waitlist: Waitlist, reservation: Reservation) -> None:
    dedup_key = generate_deduplication_key(waitlist.id, reservation.id, datetime.now())

    existing = db.query(WaitlistNotification).filter(
        WaitlistNotification.deduplication_key == dedup_key
    ).first()
    if existing:
        return

    notification = WaitlistNotification(
        waitlist_id=waitlist.id,
        reservation_id=reservation.id,
        notification_channel=NotificationChannel.IN_APP,
        notification_content=f"Slot available: {reservation.start_time} - {reservation.end_time}",
        sent_at=datetime.now(),
        delivered=True,
        deduplication_key=dedup_key,
        raw_payload=json.dumps({
            "waitlist_id": waitlist.id,
            "reservation_id": reservation.id,
            "cancelled_by": reservation.cancel_operator,
            "cancel_reason": reservation.cancel_reason
        })
    )
    db.add(notification)

    waitlist.status = WaitlistStatus.NOTIFIED
    waitlist.notified_at = datetime.now()
    waitlist.confirm_deadline = datetime.now() + timedelta(minutes=30)

    log_operation(
        db, "NOTIFY_WAITLIST", "Waitlist", waitlist.id,
        "system",
        json.dumps({"status": WaitlistStatus.WAITING}),
        json.dumps({"status": WaitlistStatus.NOTIFIED, "deadline": waitlist.confirm_deadline.isoformat()}),
        "Reservation cancelled, notifying next in queue"
    )

    db.commit()


def confirm_waitlist_slot(db: Session, waitlist_id: int, confirm_data: WaitlistConfirm) -> Tuple[Optional[Waitlist], Optional[str]]:
    waitlist = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not waitlist:
        return None, "Waitlist entry not found"

    if waitlist.status != WaitlistStatus.NOTIFIED:
        return None, f"Invalid status: {waitlist.status}. Expected NOTIFIED"

    if waitlist.confirm_deadline and datetime.now() > waitlist.confirm_deadline:
        waitlist.status = WaitlistStatus.EXPIRED
        waitlist.expired_at = datetime.now()
        waitlist.processing_notes = (waitlist.processing_notes or "") + f"\nConfirmed after deadline: {datetime.now()}"
        db.commit()
        return None, "Confirmation deadline expired"

    original_status = waitlist.status

    if confirm_data.confirm:
        waitlist.status = WaitlistStatus.CONFIRMED
        waitlist.confirmed_at = datetime.now()

        latest_notification = db.query(WaitlistNotification).filter(
            WaitlistNotification.waitlist_id == waitlist_id
        ).order_by(WaitlistNotification.sent_at.desc()).first()

        if latest_notification and latest_notification.reservation_id:
            cancelled_reservation = db.query(Reservation).filter(
                Reservation.id == latest_notification.reservation_id
            ).first()

            if cancelled_reservation:
                new_reservation = Reservation(
                    reservation_no=generate_no("RES"),
                    resource_id=waitlist.resource_id,
                    booker_id=waitlist.user_id,
                    booker_name=waitlist.user_name,
                    booker_contact=waitlist.user_contact,
                    start_time=cancelled_reservation.start_time,
                    end_time=cancelled_reservation.end_time,
                    status=ReservationStatus.CONFIRMED,
                    raw_request=json.dumps({"from_waitlist": waitlist_id})
                )
                db.add(new_reservation)

                latest_notification.receipt_confirmed = True
                latest_notification.receipt_at = datetime.now()

        reorder_waitlist(db, waitlist.resource_id)
    else:
        waitlist.status = WaitlistStatus.CANCELLED
        waitlist.processing_notes = (waitlist.processing_notes or "") + "\nUser declined slot"

    log_operation(
        db, "CONFIRM_WAITLIST", "Waitlist", waitlist_id,
        waitlist.user_id,
        json.dumps({"status": original_status}),
        json.dumps({"status": waitlist.status, "confirmed": confirm_data.confirm}),
        "User confirmed waitlist slot"
    )

    db.commit()
    db.refresh(waitlist)

    return waitlist, None


def manual_update_waitlist(db: Session, waitlist_id: int, update_data: WaitlistManualUpdate) -> Tuple[Optional[Waitlist], Optional[str]]:
    waitlist = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not waitlist:
        return None, "Waitlist entry not found"

    original_data = {
        "status": waitlist.status,
        "priority": waitlist.priority,
        "queue_position": waitlist.queue_position,
        "processing_notes": waitlist.processing_notes
    }

    if update_data.status is not None:
        waitlist.status = update_data.status
    if update_data.priority is not None:
        waitlist.priority = update_data.priority
    if update_data.queue_position is not None:
        waitlist.queue_position = update_data.queue_position
    if update_data.processing_notes:
        waitlist.processing_notes = (waitlist.processing_notes or "") + f"\n[{datetime.now()}] {update_data.processing_notes}"

    log_operation(
        db, "MANUAL_UPDATE", "Waitlist", waitlist_id,
        update_data.operator,
        json.dumps(original_data),
        json.dumps({
            "status": waitlist.status,
            "priority": waitlist.priority,
            "queue_position": waitlist.queue_position
        }),
        update_data.reason
    )

    db.commit()
    db.refresh(waitlist)

    reorder_waitlist(db, waitlist.resource_id)

    return waitlist, None


def log_operation(db: Session, operation_type: str, target_type: str, target_id: int,
                  operator: str, original_data: str, new_data: str, reason: str) -> None:
    log = OperationLog(
        operation_type=operation_type,
        target_type=target_type,
        target_id=target_id,
        operator=operator,
        original_data=original_data,
        new_data=new_data,
        reason=reason
    )
    db.add(log)
    db.commit()


def generate_report(db: Session, report_data: ReportGenerate) -> Tuple[Optional[WaitlistReport], Optional[str]]:
    resource_id = None
    if report_data.resource_code:
        resource = get_resource_by_code(db, report_data.resource_code)
        if not resource:
            return None, f"Resource {report_data.resource_code} not found"
        resource_id = resource.id

    query = db.query(Waitlist).filter(
        Waitlist.created_at >= report_data.period_start,
        Waitlist.created_at <= report_data.period_end
    )
    if resource_id:
        query = query.filter(Waitlist.resource_id == resource_id)

    waitlists = query.all()

    total = len(waitlists)
    notified = sum(1 for w in waitlists if w.status in [WaitlistStatus.NOTIFIED, WaitlistStatus.CONFIRMED, WaitlistStatus.EXPIRED])
    confirmed = sum(1 for w in waitlists if w.status == WaitlistStatus.CONFIRMED)
    expired = sum(1 for w in waitlists if w.status == WaitlistStatus.EXPIRED)
    cancelled = sum(1 for w in waitlists if w.status == WaitlistStatus.CANCELLED)

    wait_times = []
    for w in waitlists:
        if w.confirmed_at:
            wait_time = (w.confirmed_at - w.created_at).total_seconds() / 60
            wait_times.append(wait_time)
    avg_wait = int(sum(wait_times) / len(wait_times)) if wait_times else None

    cancelled_reservations = db.query(Reservation).filter(
        Reservation.status == ReservationStatus.CANCELLED,
        Reservation.cancelled_at >= report_data.period_start,
        Reservation.cancelled_at <= report_data.period_end
    ).all()

    cancel_reasons = {}
    for r in cancelled_reservations:
        if r.cancel_reason:
            cancel_reasons[r.cancel_reason] = cancel_reasons.get(r.cancel_reason, 0) + 1

    report = WaitlistReport(
        report_no=generate_no("RPT"),
        resource_id=resource_id,
        report_type=report_data.report_type,
        period_start=report_data.period_start,
        period_end=report_data.period_end,
        total_waitlist_count=total,
        notified_count=notified,
        confirmed_count=confirmed,
        expired_count=expired,
        cancelled_count=cancelled,
        avg_wait_time_minutes=avg_wait,
        cancellation_reasons=json.dumps(cancel_reasons) if cancel_reasons else None,
        generated_by=report_data.generated_by or "system",
        report_content=json.dumps({
            "summary": f"Total: {total}, Notified: {notified}, Confirmed: {confirmed}, Expired: {expired}, Cancelled: {cancelled}",
            "avg_wait_minutes": avg_wait,
            "cancellation_reasons": cancel_reasons
        })
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return report, None


def check_expired_waitlists(db: Session) -> None:
    expired = db.query(Waitlist).filter(
        Waitlist.status == WaitlistStatus.NOTIFIED,
        Waitlist.confirm_deadline < datetime.now()
    ).all()

    for w in expired:
        original_status = w.status
        w.status = WaitlistStatus.EXPIRED
        w.expired_at = datetime.now()
        w.processing_notes = (w.processing_notes or "") + f"\nAuto-expired at {datetime.now()}"

        log_operation(
            db, "AUTO_EXPIRE", "Waitlist", w.id,
            "system",
            json.dumps({"status": original_status}),
            json.dumps({"status": WaitlistStatus.EXPIRED, "expired_at": w.expired_at.isoformat()}),
            "Confirmation deadline passed"
        )

        reorder_waitlist(db, w.resource_id)

    db.commit()
