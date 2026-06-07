import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict
from .models import (
    Booking,
    Batch,
    TicketType,
    BookingStatus,
    AuthReminderLevel,
    ProcessingStep,
    ProcessingRecord,
    RunSession,
    ProjectState,
)


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def start_session(state: ProjectState, command: str) -> RunSession:
    session = RunSession(
        session_id=generate_id("sess_"),
        command=command,
        bookings_before=[b.model_copy() for b in state.bookings],
    )
    state.sessions.append(session)
    state.current_session_id = session.session_id
    return session


def end_session(state: ProjectState) -> Optional[RunSession]:
    if not state.current_session_id:
        return None
    session = get_current_session(state)
    if session:
        session.ended_at = datetime.now()
        session.bookings_after = [b.model_copy() for b in state.bookings]
    state.current_session_id = None
    return session


def get_current_session(state: ProjectState) -> Optional[RunSession]:
    if not state.current_session_id:
        return None
    for s in state.sessions:
        if s.session_id == state.current_session_id:
            return s
    return None


def add_record(
    state: ProjectState,
    step: ProcessingStep,
    details: str,
    booking_id: Optional[str] = None,
    operator: str = "系统",
    before_status: Optional[BookingStatus] = None,
    after_status: Optional[BookingStatus] = None,
) -> None:
    session = get_current_session(state)
    if not session:
        return
    record = ProcessingRecord(
        step=step,
        details=details,
        booking_id=booking_id,
        operator=operator,
        before_status=before_status,
        after_status=after_status,
    )
    session.records.append(record)


def import_group_booking(
    state: ProjectState,
    bookings_data: List[dict],
    operator: str = "录音师小段",
) -> List[Booking]:
    new_bookings = []
    for data in bookings_data:
        booking = Booking(
            id=generate_id("bk_"),
            room_name=data["room_name"],
            date=data["date"],
            time_slot=data["time_slot"],
            band_name=data["band_name"],
            contact=data["contact"],
            ticket_type=TicketType(data.get("ticket_type", "未知")),
            batch_id=data.get("batch_id"),
        )
        state.bookings.append(booking)
        new_bookings.append(booking)
        add_record(
            state,
            ProcessingStep.IMPORT,
            f"导入预约: {booking.band_name} {booking.date} {booking.time_slot}",
            booking_id=booking.id,
            operator=operator,
            before_status=None,
            after_status=BookingStatus.PENDING,
        )
    return new_bookings


def build_batches(state: ProjectState) -> List[Batch]:
    batch_map: Dict[str, Batch] = {}
    for booking in state.bookings:
        if not booking.batch_id:
            continue
        if booking.batch_id not in batch_map:
            batch_map[booking.batch_id] = Batch(
                batch_id=booking.batch_id,
                date=booking.date,
            )
        batch = batch_map[booking.batch_id]
        if booking.id not in batch.bookings:
            batch.bookings.append(booking.id)
        if booking.ticket_type not in batch.ticket_types:
            batch.ticket_types.append(booking.ticket_type)
    for batch in batch_map.values():
        has_paid = TicketType.PAID in batch.ticket_types
        has_comp = TicketType.COMPLIMENTARY in batch.ticket_types
        batch.is_mixed = has_paid and has_comp
    state.batches = list(batch_map.values())
    return state.batches


def detect_mixed_batches(state: ProjectState) -> List[Tuple[Booking, Batch]]:
    build_batches(state)
    mixed_bookings = []
    for booking in state.bookings:
        if not booking.batch_id:
            continue
        if booking.status in [BookingStatus.RESOLVED, BookingStatus.ARCHIVED]:
            continue
        batch = next((b for b in state.batches if b.batch_id == booking.batch_id), None)
        if batch and batch.is_mixed:
            before = booking.status
            booking.status = BookingStatus.MIXED_BATCH
            booking.auth_reminder = AuthReminderLevel.WARNING
            if not any("待人工复核" in note for note in booking.notes):
                booking.notes.append(f"批次{booking.batch_id}存在赠票售票混批，待人工复核")
            booking.updated_at = datetime.now()
            mixed_bookings.append((booking, batch))
            add_record(
                state,
                ProcessingStep.DETECT_MIXED,
                f"检测到混批: 批次{booking.batch_id}包含赠票和售票",
                booking_id=booking.id,
                before_status=before,
                after_status=BookingStatus.MIXED_BATCH,
            )
    return mixed_bookings


def process_normal_bookings(state: ProjectState) -> List[Booking]:
    processed = []
    for booking in state.bookings:
        if booking.status in [BookingStatus.RESOLVED, BookingStatus.ARCHIVED]:
            continue
        if booking.status == BookingStatus.PENDING:
            batch = next((b for b in state.batches if b.batch_id == booking.batch_id), None)
            if batch and not batch.is_mixed:
                before = booking.status
                booking.status = BookingStatus.NORMAL
                booking.auth_reminder = AuthReminderLevel.NONE
                booking.updated_at = datetime.now()
                processed.append(booking)
                add_record(
                    state,
                    ProcessingStep.DETECT_MIXED,
                    f"批次{booking.batch_id}正常，无混批",
                    booking_id=booking.id,
                    before_status=before,
                    after_status=BookingStatus.NORMAL,
                )
    return processed


def add_contract_screenshot(
    state: ProjectState,
    booking_id: str,
    screenshot_path: str,
    contract_ticket_type: str,
    operator: str = "录音师小段",
) -> Optional[Booking]:
    booking = next((b for b in state.bookings if b.id == booking_id), None)
    if not booking:
        return None
    before = booking.status
    booking.contract_screenshot = screenshot_path
    booking.contract_ticket_type = TicketType(contract_ticket_type)
    booking.status = BookingStatus.NEEDS_CONTRACT if not booking.contract_ticket_type else BookingStatus.PENDING
    booking.notes.append(f"补录合同页截图: {screenshot_path}，合同标注为{contract_ticket_type}")
    booking.updated_at = datetime.now()
    add_record(
        state,
        ProcessingStep.ADD_CONTRACT,
        f"补录合同页: {screenshot_path}, 合同票种: {contract_ticket_type}",
        booking_id=booking.id,
        operator=operator,
        before_status=before,
        after_status=booking.status,
    )
    return booking


def update_auth_reminders(state: ProjectState) -> List[Booking]:
    updated = []
    for booking in state.bookings:
        before = booking.auth_reminder
        if booking.status == BookingStatus.MIXED_BATCH:
            booking.auth_reminder = AuthReminderLevel.WARNING
        elif booking.status == BookingStatus.NEEDS_CONTRACT:
            booking.auth_reminder = AuthReminderLevel.INFO
        elif booking.contract_screenshot and booking.contract_ticket_type:
            if booking.ticket_type != booking.contract_ticket_type:
                booking.auth_reminder = AuthReminderLevel.WARNING
                booking.notes.append(f"接龙票种({booking.ticket_type})与合同票种({booking.contract_ticket_type})不一致，以合同为准")
                booking.ticket_type = booking.contract_ticket_type
                booking.updated_at = datetime.now()
            else:
                booking.auth_reminder = AuthReminderLevel.NONE
                booking.status = BookingStatus.NORMAL
                booking.updated_at = datetime.now()
        else:
            booking.auth_reminder = AuthReminderLevel.NONE
        if before != booking.auth_reminder:
            updated.append(booking)
            add_record(
                state,
                ProcessingStep.UPDATE_AUTH,
                f"授权提醒从{before}更新为{booking.auth_reminder}",
                booking_id=booking.id,
                before_status=None,
                after_status=None,
            )
    return updated


def review_mixed_booking(
    state: ProjectState,
    booking_id: str,
    new_status: BookingStatus,
    notes: str = "",
    operator: str = "录音师小段",
) -> Optional[Booking]:
    booking = next((b for b in state.bookings if b.id == booking_id), None)
    if not booking:
        return None
    before = booking.status
    booking.status = new_status
    if notes:
        booking.notes.append(f"人工复核: {notes}")
    booking.updated_at = datetime.now()
    if new_status == BookingStatus.NORMAL:
        booking.auth_reminder = AuthReminderLevel.NONE
    add_record(
        state,
        ProcessingStep.REVIEW,
        f"人工复核: {new_status.value}, 备注: {notes}",
        booking_id=booking.id,
        operator=operator,
        before_status=before,
        after_status=new_status,
    )
    return booking


def rerun_processing(state: ProjectState, operator: str = "录音师小段") -> dict:
    add_record(
        state,
        ProcessingStep.RERUN,
        "重新运行全流程处理",
        operator=operator,
    )
    for booking in state.bookings:
        if booking.status not in [BookingStatus.RESOLVED, BookingStatus.ARCHIVED]:
            booking.status = BookingStatus.PENDING
            booking.updated_at = datetime.now()
    mixed = detect_mixed_batches(state)
    normal = process_normal_bookings(state)
    auth_updated = update_auth_reminders(state)
    return {
        "mixed_detected": len(mixed),
        "normal_processed": len(normal),
        "auth_updated": len(auth_updated),
    }
