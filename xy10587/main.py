from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List, Optional
import json

from database import SessionLocal, engine, Base, get_db
from models import (
    Member, Coach, Package, Appointment, Leave, NoShow, Transfer,
    Deduction, Commission, StatusHistory, ManualCorrection,
    MemberStatus, CoachStatus, PackageStatus, AppointmentStatus, DeductionReason
)
from schemas import (
    MemberCreate, MemberResponse, CoachCreate, CoachResponse,
    PackageCreate, PackageResponse, AppointmentCreate, AppointmentResponse,
    LeaveRequest, NoShowRequest, ConfirmAttendanceRequest, TransferRequest,
    ManualCorrectionRequest, StatusHistoryResponse, ManualCorrectionResponse,
    CommissionResponse
)
from services import (
    get_or_create_member, get_or_create_coach, create_package,
    create_appointment, confirm_attendance, request_leave,
    record_no_show, transfer_package, apply_manual_correction, check_idempotency
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="健身私教课消课 API", version="1.0.0")

@app.get("/")
def root():
    return {"message": "健身私教课消课 API 运行中", "version": "1.0.0"}

@app.post("/members/", response_model=MemberResponse)
def create_member(member: MemberCreate, db: Session = Depends(get_db)):
    try:
        db_member = get_or_create_member(db, member.name, member.phone)
        db.commit()
        db.refresh(db_member)
        return db_member
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/members/", response_model=List[MemberResponse])
def list_members(status: Optional[MemberStatus] = None, db: Session = Depends(get_db)):
    query = db.query(Member)
    if status:
        query = query.filter(Member.status == status)
    return query.all()

@app.get("/members/{member_id}", response_model=MemberResponse)
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="会员不存在")
    return member

@app.post("/coaches/", response_model=CoachResponse)
def create_coach(coach: CoachCreate, db: Session = Depends(get_db)):
    try:
        db_coach = get_or_create_coach(db, coach.name, coach.phone, coach.commission_rate)
        db.commit()
        db.refresh(db_coach)
        return db_coach
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/coaches/", response_model=List[CoachResponse])
def list_coaches(status: Optional[CoachStatus] = None, db: Session = Depends(get_db)):
    query = db.query(Coach)
    if status:
        query = query.filter(Coach.status == status)
    return query.all()

@app.get("/coaches/{coach_id}", response_model=CoachResponse)
def get_coach(coach_id: int, db: Session = Depends(get_db)):
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="教练不存在")
    return coach

@app.post("/packages/", response_model=PackageResponse)
def create_package_endpoint(package: PackageCreate, db: Session = Depends(get_db)):
    try:
        db_package = create_package(
            db, package.member_id, package.coach_id,
            package.total_sessions, package.purchase_date,
            package.expire_date, package.price
        )
        db.commit()
        db.refresh(db_package)
        return db_package
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/packages/", response_model=List[PackageResponse])
def list_packages(
    member_id: Optional[int] = None,
    coach_id: Optional[int] = None,
    status: Optional[PackageStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Package)
    if member_id:
        query = query.filter(Package.member_id == member_id)
    if coach_id:
        query = query.filter(Package.coach_id == coach_id)
    if status:
        query = query.filter(Package.status == status)
    return query.all()

@app.get("/packages/{package_id}", response_model=PackageResponse)
def get_package(package_id: int, db: Session = Depends(get_db)):
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="课包不存在")
    return package

@app.post("/appointments/", response_model=AppointmentResponse)
def create_appointment_endpoint(appointment: AppointmentCreate, db: Session = Depends(get_db)):
    try:
        db_appointment = create_appointment(
            db, appointment.member_id, appointment.coach_id,
            appointment.package_id, appointment.start_time,
            appointment.end_time, appointment.request_id
        )
        db.commit()
        db.refresh(db_appointment)
        return db_appointment
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/appointments/confirm-attendance")
def confirm_attendance_endpoint(request: ConfirmAttendanceRequest, db: Session = Depends(get_db)):
    try:
        appointment = confirm_attendance(db, request.appointment_id, request.request_id)
        db.commit()
        db.refresh(appointment)
        return {
            "success": True,
            "appointment_id": appointment.id,
            "status": appointment.status.value,
            "deduction_applied": appointment.deduction_applied
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/appointments/leave")
def leave_endpoint(request: LeaveRequest, db: Session = Depends(get_db)):
    try:
        leave = request_leave(db, request.appointment_id, request.request_id, request.reason)
        db.commit()
        db.refresh(leave)
        appointment = db.query(Appointment).filter(Appointment.id == request.appointment_id).first()
        return {
            "success": True,
            "leave_id": leave.id,
            "appointment_status": appointment.status.value,
            "is_before_cutoff": leave.is_before_cutoff,
            "deduction_applied": appointment.deduction_applied
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/appointments/no-show")
def no_show_endpoint(request: NoShowRequest, db: Session = Depends(get_db)):
    try:
        no_show = record_no_show(db, request.appointment_id, request.request_id, request.reason)
        db.commit()
        db.refresh(no_show)
        appointment = db.query(Appointment).filter(Appointment.id == request.appointment_id).first()
        return {
            "success": True,
            "no_show_id": no_show.id,
            "appointment_status": appointment.status.value,
            "deduction_applied": appointment.deduction_applied
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/appointments/", response_model=List[AppointmentResponse])
def list_appointments(
    member_id: Optional[int] = None,
    coach_id: Optional[int] = None,
    status: Optional[AppointmentStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Appointment)
    if member_id:
        query = query.filter(Appointment.member_id == member_id)
    if coach_id:
        query = query.filter(Appointment.coach_id == coach_id)
    if status:
        query = query.filter(Appointment.status == status)
    if start_date:
        query = query.filter(Appointment.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Appointment.start_time <= datetime.combine(end_date, datetime.max.time()))
    return query.order_by(Appointment.start_time).all()

@app.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    return appointment

@app.post("/transfers/")
def transfer_endpoint(request: TransferRequest, db: Session = Depends(get_db)):
    try:
        transfer = transfer_package(
            db, request.from_member_id, request.to_member_id,
            request.package_id, request.transfer_sessions, request.request_id
        )
        db.commit()
        db.refresh(transfer)
        return {
            "success": True,
            "transfer_id": transfer.id,
            "transfer_sessions": transfer.transfer_sessions,
            "from_member_id": transfer.from_member_id,
            "to_member_id": transfer.to_member_id
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/manual-corrections/", response_model=ManualCorrectionResponse)
def manual_correction_endpoint(request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    try:
        correction = apply_manual_correction(
            db, request.entity_type, request.entity_id,
            request.after_data, request.operator, request.reason, request.request_id
        )
        db.commit()
        db.refresh(correction)
        return correction
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/status-history/", response_model=List[StatusHistoryResponse])
def get_status_history(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(StatusHistory)
    if entity_type:
        query = query.filter(StatusHistory.entity_type == entity_type)
    if entity_id:
        query = query.filter(StatusHistory.entity_id == entity_id)
    return query.order_by(StatusHistory.created_at.desc()).all()

@app.get("/reports/member-ledger/{member_id}")
def get_member_ledger(member_id: int, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="会员不存在")
    
    packages = db.query(Package).filter(Package.member_id == member_id).all()
    deductions = db.query(Deduction).filter(Deduction.member_id == member_id).order_by(Deduction.created_at.desc()).all()
    
    package_summaries = []
    for pkg in packages:
        coach = db.query(Coach).filter(Coach.id == pkg.coach_id).first()
        package_summaries.append({
            "package_id": pkg.id,
            "coach_name": coach.name if coach else None,
            "coach_id": pkg.coach_id,
            "total_sessions": pkg.total_sessions,
            "used_sessions": pkg.used_sessions,
            "remaining_sessions": pkg.remaining_sessions,
            "purchase_date": pkg.purchase_date.isoformat(),
            "expire_date": pkg.expire_date.isoformat(),
            "status": pkg.status.value,
            "price": pkg.price,
            "per_session_price": pkg.per_session_price
        })
    
    deduction_records = []
    for ded in deductions:
        appointment = db.query(Appointment).filter(Appointment.id == ded.appointment_id).first() if ded.appointment_id else None
        coach = db.query(Coach).filter(Coach.id == ded.coach_id).first()
        deduction_records.append({
            "deduction_id": ded.id,
            "package_id": ded.package_id,
            "coach_name": coach.name if coach else None,
            "sessions": ded.sessions,
            "reason": ded.reason.value,
            "appointment_id": ded.appointment_id,
            "appointment_time": appointment.start_time.isoformat() if appointment else None,
            "created_at": ded.created_at.isoformat()
        })
    
    total_remaining = sum(p.remaining_sessions for p in packages)
    total_used = sum(p.used_sessions for p in packages)
    
    return {
        "member_id": member.id,
        "member_name": member.name,
        "total_packages": len(packages),
        "total_remaining_sessions": total_remaining,
        "total_used_sessions": total_used,
        "packages": package_summaries,
        "deduction_records": deduction_records
    }

@app.get("/reports/coach-schedule/{coach_id}")
def get_coach_schedule(
    coach_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="教练不存在")
    
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(days=7)
    
    appointments = db.query(Appointment).filter(
        Appointment.coach_id == coach_id,
        Appointment.start_time >= datetime.combine(start_date, datetime.min.time()),
        Appointment.start_time <= datetime.combine(end_date, datetime.max.time())
    ).order_by(Appointment.start_time).all()
    
    schedule = []
    for app in appointments:
        member = db.query(Member).filter(Member.id == app.member_id).first()
        schedule.append({
            "appointment_id": app.id,
            "member_id": app.member_id,
            "member_name": member.name if member else None,
            "package_id": app.package_id,
            "start_time": app.start_time.isoformat(),
            "end_time": app.end_time.isoformat(),
            "status": app.status.value,
            "deduction_applied": app.deduction_applied
        })
    
    status_counts = {}
    for app in appointments:
        status = app.status.value
        status_counts[status] = status_counts.get(status, 0) + 1
    
    return {
        "coach_id": coach.id,
        "coach_name": coach.name,
        "commission_rate": coach.commission_rate,
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "total_appointments": len(appointments),
        "status_summary": status_counts,
        "schedule": schedule
    }

@app.get("/reports/deduction-reasons")
def get_deduction_reasons(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        next_month = start_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    
    deductions = db.query(Deduction).filter(
        Deduction.created_at >= datetime.combine(start_date, datetime.min.time()),
        Deduction.created_at <= datetime.combine(end_date, datetime.max.time())
    ).all()
    
    reason_stats = {}
    for ded in deductions:
        reason = ded.reason.value
        if reason not in reason_stats:
            reason_stats[reason] = {"count": 0, "sessions": 0, "details": []}
        reason_stats[reason]["count"] += 1
        reason_stats[reason]["sessions"] += ded.sessions
        
        member = db.query(Member).filter(Member.id == ded.member_id).first()
        coach = db.query(Coach).filter(Coach.id == ded.coach_id).first()
        reason_stats[reason]["details"].append({
            "deduction_id": ded.id,
            "member_name": member.name if member else None,
            "coach_name": coach.name if coach else None,
            "sessions": ded.sessions,
            "created_at": ded.created_at.isoformat()
        })
    
    total_sessions = sum(s["sessions"] for s in reason_stats.values())
    
    return {
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "total_deductions": len(deductions),
        "total_sessions_deducted": total_sessions,
        "breakdown": reason_stats
    }

@app.get("/reports/monthly-commission/{coach_id}")
def get_monthly_commission(
    coach_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="教练不存在")
    
    today = date.today()
    if not year:
        year = today.year
    if not month:
        month = today.month
    
    if month == 12:
        next_month_start = date(year + 1, 1, 1)
    else:
        next_month_start = date(year, month + 1, 1)
    
    month_start = date(year, month, 1)
    
    commissions = db.query(Commission).filter(
        Commission.coach_id == coach_id,
        Commission.settlement_date >= month_start,
        Commission.settlement_date < next_month_start
    ).all()
    
    commission_details = []
    total_amount = 0
    total_sessions = 0
    
    for comm in commissions:
        deduction = db.query(Deduction).filter(Deduction.id == comm.deduction_id).first()
        member = db.query(Member).filter(Member.id == deduction.member_id).first() if deduction else None
        
        commission_details.append({
            "commission_id": comm.id,
            "deduction_id": comm.deduction_id,
            "appointment_id": comm.appointment_id,
            "member_name": member.name if member else None,
            "sessions": comm.sessions,
            "per_session_amount": comm.per_session_amount,
            "commission_amount": comm.total_amount,
            "commission_rate": comm.commission_rate,
            "reason": deduction.reason.value if deduction else None,
            "is_settled": comm.is_settled,
            "settlement_date": comm.settlement_date.isoformat()
        })
        
        total_amount += comm.total_amount
        total_sessions += comm.sessions
    
    return {
        "coach_id": coach.id,
        "coach_name": coach.name,
        "commission_rate": coach.commission_rate,
        "year": year,
        "month": month,
        "total_sessions": total_sessions,
        "total_commission": total_amount,
        "details": commission_details
    }

@app.get("/idempotency-check/{request_id}")
def check_idempotency_status(request_id: str, db: Session = Depends(get_db)):
    from services import check_idempotency as check
    exists, log = check(db, request_id, "", "")
    if not exists:
        return {"exists": False, "message": "请求ID未使用"}
    
    return {
        "exists": True,
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "status": log.status,
        "error_message": log.error_message,
        "response_data": json.loads(log.response_data) if log.response_data else None,
        "created_at": log.created_at.isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
