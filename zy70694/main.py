from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import ValidationError
from database import get_db, engine
import models
import schemas
from services import (
    BusinessError,
    create_booking_service, checkin_service, checkout_service,
    late_release_service, create_renewal_service,
    approve_renewal_service, reject_renewal_service,
    generate_usage_report
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="琴房时段迟到释放延时计费后端API",
    description="管理琴房预约、迟到释放、延时计费等功能",
    version="1.0.0"
)


@app.exception_handler(BusinessError)
async def business_error_handler(request, exc: BusinessError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.exception_handler(ValidationError)
async def validation_error_handler(request, exc: ValidationError):
    errors = exc.errors()
    missing_fields = [e["loc"][-1] for e in errors if e["type"] == "value_error.missing"]
    if missing_fields:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error_code": "MISSING_FIELDS",
                "message": "缺少必填字段",
                "details": {"missing_fields": missing_fields}
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "参数验证失败",
            "details": {"errors": str(exc)}
        }
    )


@app.post("/rooms/", response_model=schemas.PianoRoomResponse, tags=["琴房管理"])
def create_room(room_data: schemas.PianoRoomCreate, db: Session = Depends(get_db)):
    existing = db.query(models.PianoRoom).filter(models.PianoRoom.name == room_data.name).first()
    if existing:
        raise BusinessError("ROOM_NAME_EXISTS", "琴房名称已存在")
    room = models.PianoRoom(**room_data.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@app.get("/rooms/", response_model=List[schemas.PianoRoomResponse], tags=["琴房管理"])
def list_rooms(status: schemas.RoomStatus = None, db: Session = Depends(get_db)):
    query = db.query(models.PianoRoom)
    if status:
        query = query.filter(models.PianoRoom.status == status)
    return query.all()


@app.get("/rooms/{room_id}", response_model=schemas.PianoRoomResponse, tags=["琴房管理"])
def get_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(models.PianoRoom).filter(models.PianoRoom.id == room_id).first()
    if not room:
        raise BusinessError("ROOM_NOT_FOUND", "琴房不存在")
    return room


@app.put("/rooms/{room_id}", response_model=schemas.PianoRoomResponse, tags=["琴房管理"])
def update_room(room_id: int, room_data: schemas.PianoRoomUpdate, db: Session = Depends(get_db)):
    room = db.query(models.PianoRoom).filter(models.PianoRoom.id == room_id).first()
    if not room:
        raise BusinessError("ROOM_NOT_FOUND", "琴房不存在")
    
    update_data = room_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(room, key, value)
    
    db.commit()
    db.refresh(room)
    return room


@app.post("/users/", response_model=schemas.UserResponse, tags=["用户管理"])
def create_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.phone == user_data.phone).first()
    if existing:
        raise BusinessError("PHONE_EXISTS", "手机号已注册")
    user = models.User(**user_data.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/users/", response_model=List[schemas.UserResponse], tags=["用户管理"])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()


@app.post("/bookings/", response_model=schemas.BookingResponse, tags=["预约管理"])
def create_booking(booking_data: schemas.BookingCreate, db: Session = Depends(get_db)):
    return create_booking_service(db, booking_data)


@app.get("/bookings/", response_model=List[schemas.BookingResponse], tags=["预约管理"])
def list_bookings(
    status: schemas.BookingStatus = None,
    room_id: int = None,
    user_id: int = None,
    booking_date: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Booking)
    if status:
        query = query.filter(models.Booking.status == status)
    if room_id:
        query = query.filter(models.Booking.room_id == room_id)
    if user_id:
        query = query.filter(models.Booking.user_id == user_id)
    if booking_date:
        query = query.filter(models.Booking.booking_date == booking_date)
    return query.all()


@app.get("/bookings/{booking_id}", response_model=schemas.BookingResponse, tags=["预约管理"])
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise BusinessError("BOOKING_NOT_FOUND", "预约不存在")
    return booking


@app.post("/bookings/checkin", tags=["预约管理"])
def checkin(request: schemas.CheckInRequest, db: Session = Depends(get_db)):
    booking, late_record = checkin_service(db, request.booking_id)
    result = {
        "booking_id": booking.id,
        "status": booking.status,
        "check_in_time": booking.check_in_time.isoformat() if booking.check_in_time else None
    }
    if late_record:
        result["late_record"] = {
            "id": late_record.id,
            "late_minutes": late_record.late_minutes,
            "is_released": late_record.is_released
        }
    return result


@app.post("/bookings/checkout", response_model=schemas.BookingResponse, tags=["预约管理"])
def checkout(request: schemas.CheckOutRequest, db: Session = Depends(get_db)):
    return checkout_service(db, request.booking_id)


@app.post("/bookings/late-release", response_model=schemas.LateRecordResponse, tags=["预约管理"])
def late_release(request: schemas.LateReleaseRequest, db: Session = Depends(get_db)):
    return late_release_service(db, request.booking_id, request.late_minutes)


@app.get("/late-records/", response_model=List[schemas.LateRecordResponse], tags=["迟到记录"])
def list_late_records(
    is_released: bool = None,
    user_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.LateRecord)
    if is_released is not None:
        query = query.filter(models.LateRecord.is_released == is_released)
    if user_id:
        query = query.filter(models.LateRecord.user_id == user_id)
    return query.all()


@app.post("/renewals/", response_model=schemas.RenewalApplicationResponse, tags=["续费申请"])
def create_renewal(renewal_data: schemas.RenewalApplicationCreate, db: Session = Depends(get_db)):
    return create_renewal_service(db, renewal_data)


@app.get("/renewals/", response_model=List[schemas.RenewalApplicationResponse], tags=["续费申请"])
def list_renewals(
    status: schemas.RenewalStatus = None,
    booking_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RenewalApplication)
    if status:
        query = query.filter(models.RenewalApplication.status == status)
    if booking_id:
        query = query.filter(models.RenewalApplication.booking_id == booking_id)
    return query.all()


@app.post("/renewals/{renewal_id}/approve", response_model=schemas.RenewalApplicationResponse, tags=["续费申请"])
def approve_renewal(renewal_id: int, update_data: schemas.RenewalApplicationUpdate, db: Session = Depends(get_db)):
    return approve_renewal_service(db, renewal_id, update_data.remarks)


@app.post("/renewals/{renewal_id}/reject", response_model=schemas.RenewalApplicationResponse, tags=["续费申请"])
def reject_renewal(renewal_id: int, update_data: schemas.RenewalApplicationUpdate, db: Session = Depends(get_db)):
    return reject_renewal_service(db, renewal_id, update_data.remarks)


@app.post("/reports/usage", response_model=schemas.UsageReportResponse, tags=["使用报告"])
def get_usage_report(report_request: schemas.UsageReportRequest, db: Session = Depends(get_db)):
    return generate_usage_report(db, report_request.start_date, report_request.end_date, report_request.room_id)


@app.get("/reports/usage/export", tags=["使用报告"])
def export_usage_report(start_date: str, end_date: str, room_id: int = None, db: Session = Depends(get_db)):
    report = generate_usage_report(db, start_date, end_date, room_id)
    csv_lines = [
        "预约ID,琴房,用户,预约日期,开始时间,结束时间,实际开始,实际结束,时长(小时),金额(元),状态,是否迟到,迟到分钟,是否续费,续费时长"
    ]
    for item in report.details:
        csv_lines.append(
            f"{item.booking_id},{item.room_name},{item.user_name},{item.booking_date},"
            f"{item.start_time},{item.end_time},{item.actual_start or ''},{item.actual_end or ''},"
            f"{item.duration},{item.total_amount},{item.status},"
            f"{item.is_late},{item.late_minutes},{item.has_renewal},{item.renewal_hours}"
        )
    csv_content = "\n".join(csv_lines)
    return {
        "filename": f"usage_report_{start_date}_to_{end_date}.csv",
        "content_type": "text/csv; charset=utf-8",
        "content": csv_content,
        "summary": {
            "report_period": report.report_period,
            "total_bookings": report.total_bookings,
            "total_revenue": report.total_revenue,
            "late_checkins_count": report.late_checkins_count,
            "renewal_count": report.renewal_count,
            "released_bookings_count": report.released_bookings_count
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
