from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import Optional, List
from .database import engine, Base, get_db
from .models import (
    Visitor, Meeting, ParkingSpot, ParkingReservation, ReservationExtension,
    VisitorStatus, ReservationStatus
)
from .schemas import (
    VisitorCreate, VisitorResponse,
    MeetingCreate, MeetingResponse, MeetingApprove,
    ParkingSpotResponse,
    ParkingReservationCreate, ParkingReservationResponse,
    ReservationExtensionCreate, ReservationExtensionResponse,
    ErrorResponse
)
from .services import (
    BusinessError,
    create_visitor, get_visitor,
    create_meeting, get_meeting, approve_meeting,
    get_available_spots,
    create_reservation, confirm_reservation,
    check_in_reservation, check_out_reservation,
    extend_reservation, cancel_reservation,
    get_reservation,
    get_meeting_with_reservations
)

app = FastAPI(
    title="园区访客车位预约 API",
    description="访客审批、车牌和会议时间限制的访客车位管理系统",
    version="1.0.0"
)


@app.exception_handler(BusinessError)
async def business_error_handler(request: Request, exc: BusinessError):
    return JSONResponse(
        status_code=400,
        content={
            "error": exc.message,
            "code": exc.code,
            "details": exc.details
        }
    )


Base.metadata.create_all(bind=engine)


def init_seed_data(db: Session):
    if db.query(ParkingSpot).count() == 0:
        spots = []
        for i in range(1, 6):
            spots.append(ParkingSpot(
                spot_number=f"V-{i:03d}", zone="A区", is_visitor_spot=True, is_active=True
            ))
        for i in range(6, 11):
            spots.append(ParkingSpot(
                spot_number=f"V-{i:03d}", zone="B区", is_visitor_spot=True, is_active=True
            ))
        db.add_all(spots)
        db.commit()


@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    init_seed_data(db)


@app.post("/api/visitors", response_model=VisitorResponse, responses={400: {"model": ErrorResponse}})
def api_create_visitor(data: VisitorCreate, db: Session = Depends(get_db)):
    return create_visitor(db, data)


@app.get("/api/visitors/{visitor_id}", response_model=VisitorResponse)
def api_get_visitor(visitor_id: int, db: Session = Depends(get_db)):
    visitor = get_visitor(db, visitor_id)
    if not visitor:
        raise BusinessError(
            "访客不存在",
            code="VISITOR_NOT_FOUND",
            details={"visitor_id": visitor_id}
        )
    return visitor


@app.post("/api/meetings", response_model=MeetingResponse, responses={400: {"model": ErrorResponse}})
def api_create_meeting(data: MeetingCreate, db: Session = Depends(get_db)):
    return create_meeting(db, data)


@app.get("/api/meetings/{meeting_id}", response_model=MeetingResponse)
def api_get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = get_meeting(db, meeting_id)
    if not meeting:
        raise BusinessError(
            "会议不存在",
            code="MEETING_NOT_FOUND",
            details={"meeting_id": meeting_id}
        )
    return meeting


@app.post("/api/meetings/{meeting_id}/approve", response_model=MeetingResponse, responses={400: {"model": ErrorResponse}})
def api_approve_meeting(meeting_id: int, data: MeetingApprove, db: Session = Depends(get_db)):
    return approve_meeting(db, meeting_id, data)


@app.get("/api/meetings/{meeting_id}/full", response_model=dict)
def api_get_meeting_full(meeting_id: int, db: Session = Depends(get_db)):
    result = get_meeting_with_reservations(db, meeting_id)
    if result:
        return {
            "meeting": result["meeting"],
            "reservations": result["reservations"]
        }
    raise BusinessError(
        "会议不存在",
        code="MEETING_NOT_FOUND",
        details={"meeting_id": meeting_id}
    )


@app.get("/api/parking-spots", response_model=List[ParkingSpotResponse])
def api_list_spots(db: Session = Depends(get_db)):
    return db.query(ParkingSpot).all()


@app.get("/api/parking-spots/available", response_model=List[ParkingSpotResponse])
def api_available_spots(start: datetime, end: datetime, db: Session = Depends(get_db)):
    return get_available_spots(db, start, end)


@app.post("/api/parking-reservations", response_model=ParkingReservationResponse, responses={400: {"model": ErrorResponse}})
def api_create_reservation(data: ParkingReservationCreate, db: Session = Depends(get_db)):
    return create_reservation(db, data)


@app.get("/api/parking-reservations/{reservation_id}", response_model=ParkingReservationResponse)
def api_get_reservation(reservation_id: int, db: Session = Depends(get_db)):
    reservation = get_reservation(db, reservation_id)
    if not reservation:
        raise BusinessError(
            "预约记录不存在",
            code="RESERVATION_NOT_FOUND",
            details={"reservation_id": reservation_id}
        )
    return reservation


@app.post("/api/parking-reservations/{reservation_id}/confirm", response_model=ParkingReservationResponse, responses={400: {"model": ErrorResponse}})
def api_confirm_reservation(reservation_id: int, db: Session = Depends(get_db)):
    return confirm_reservation(db, reservation_id)


@app.post("/api/parking-reservations/{reservation_id}/check-in", response_model=ParkingReservationResponse, responses={400: {"model": ErrorResponse}})
def api_check_in(reservation_id: int, db: Session = Depends(get_db)):
    return check_in_reservation(db, reservation_id)


@app.post("/api/parking-reservations/{reservation_id}/check-out", response_model=ParkingReservationResponse, responses={400: {"model": ErrorResponse}})
def api_check_out(reservation_id: int, db: Session = Depends(get_db)):
    return check_out_reservation(db, reservation_id)


@app.post("/api/parking-reservations/{reservation_id}/extend", response_model=ParkingReservationResponse, responses={400: {"model": ErrorResponse}})
def api_extend_reservation(data: ReservationExtensionCreate, db: Session = Depends(get_db)):
    return extend_reservation(db, data)


@app.post("/api/parking-reservations/{reservation_id}/cancel", response_model=ParkingReservationResponse, responses={400: {"model": ErrorResponse}})
def api_cancel_reservation(reservation_id: int, db: Session = Depends(get_db)):
    return cancel_reservation(db, reservation_id)


@app.get("/api/reports/dashboard", response_model=dict)
def api_dashboard(db: Session = Depends(get_db)):
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    tomorrow_start = today_start + timedelta(days=1)
    
    total_reservations = db.query(ParkingReservation).count()
    
    today_reservations = db.query(ParkingReservation).filter(
        ParkingReservation.created_at >= today_start,
        ParkingReservation.created_at < tomorrow_start
    ).all()
    
    status_counts = {
        "pending": 0,
        "locked": 0,
        "in_use": 0,
        "completed": 0,
        "cancelled": 0,
        "expired": 0,
        "extended": 0
    }
    for r in today_reservations:
        status_key = r.status.value
        if status_key in status_counts:
            status_counts[status_key] += 1
    
    active_reservations = db.query(ParkingReservation).filter(
        ParkingReservation.status.in_([
            ReservationStatus.LOCKED,
            ReservationStatus.CONFIRMED,
            ReservationStatus.IN_USE,
            ReservationStatus.EXTENDED
        ])
    ).all()
    
    total_spots = db.query(ParkingSpot).filter(
        ParkingSpot.is_visitor_spot == True,
        ParkingSpot.is_active == True
    ).count()
    
    utilized_spots = len(set(r.spot_id for r in active_reservations if r.spot_id is not None))
    
    extensions_today = db.query(ReservationExtension).filter(
        ReservationExtension.created_at >= today_start,
        ReservationExtension.created_at < tomorrow_start
    ).count()
    
    upcoming_conflicts = []
    
    return {
        "date": today.isoformat(),
        "overview": {
            "total_spots": total_spots,
            "utilized_spots": utilized_spots,
            "utilization_rate": round(utilized_spots / total_spots if total_spots > 0 else 0, 2),
        },
        "today_stats": {
            "total": len(today_reservations),
            "by_status": status_counts,
            "extensions": extensions_today
        },
        "active_reservations": [
            {
                "id": r.id,
                "spot_id": r.spot_id,
                "license_plate": r.license_plate,
                "status": r.status.value,
                "scheduled_start": r.scheduled_start.isoformat(),
                "scheduled_end": r.scheduled_end.isoformat()
            } for r in active_reservations
        ],
        "potential_conflicts": upcoming_conflicts
    }


@app.get("/api/reports/by-meeting/{meeting_id}", response_model=dict)
def api_report_by_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = get_meeting(db, meeting_id)
    if not meeting:
        raise BusinessError(
            "会议不存在",
            code="MEETING_NOT_FOUND",
            details={"meeting_id": meeting_id}
        )
    reservations = db.query(ParkingReservation).filter(
        ParkingReservation.meeting_id == meeting_id
    ).order_by(ParkingReservation.created_at.desc()).all()
    
    visitor = db.query(Visitor).filter(Visitor.id == meeting.visitor_id).first()
    
    extensions = []
    for r in reservations:
        exts = db.query(ReservationExtension).filter(
            ReservationExtension.reservation_id == r.id
        ).order_by(ReservationExtension.created_at.desc()).all()
        extensions.extend(exts)
    
    return {
        "meeting": {
            "id": meeting.id,
            "host_name": meeting.host_name,
            "host_department": meeting.host_department,
            "meeting_room": meeting.meeting_room,
            "purpose": meeting.purpose,
            "scheduled_start": meeting.scheduled_start.isoformat(),
            "scheduled_end": meeting.scheduled_end.isoformat(),
            "status": meeting.status.value,
            "approval_note": meeting.approval_note
        },
        "visitor": {
            "id": visitor.id,
            "name": visitor.name,
            "company": visitor.company,
            "phone": visitor.phone,
            "license_plate": visitor.license_plate
        },
        "reservations": [
            {
                "id": r.id,
                "spot_id": r.spot_id,
                "license_plate": r.license_plate,
                "status": r.status.value,
                "scheduled_start": r.scheduled_start.isoformat(),
                "scheduled_end": r.scheduled_end.isoformat(),
                "actual_start": r.actual_start.isoformat() if r.actual_start else None,
                "actual_end": r.actual_end.isoformat() if r.actual_end else None,
                "source_record": r.source_record,
                "created_at": r.created_at.isoformat()
            } for r in reservations
        ],
        "extensions": [
            {
                "id": e.id,
                "reservation_id": e.reservation_id,
                "original_end": e.original_end.isoformat(),
                "new_end": e.new_end.isoformat(),
                "reason": e.reason,
                "created_at": e.created_at.isoformat()
            } for e in extensions
        ],
        "review_summary": {
            "total_reservations": len(reservations),
            "has_extensions": len(extensions),
            "reservation_status": [r.status.value for r in reservations],
            "license_plate_match": all(r.license_plate == visitor.license_plate for r in reservations)
        }
    }
