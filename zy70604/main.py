from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

from database import get_db, engine
import models
import schemas
import crud

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="私教消课请假冻结代课确认系统API", version="1.0.0")


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )


@app.post("/coaches/", response_model=schemas.Coach, tags=["教练管理"])
def create_coach(coach: schemas.CoachCreate, db: Session = Depends(get_db)):
    return crud.create_coach(db=db, coach=coach)


@app.get("/coaches/{coach_id}", response_model=schemas.Coach, tags=["教练管理"])
def read_coach(coach_id: int, db: Session = Depends(get_db)):
    db_coach = crud.get_coach(db, coach_id=coach_id)
    if db_coach is None:
        raise HTTPException(status_code=404, detail="教练不存在")
    return db_coach


@app.get("/coaches/", response_model=List[schemas.Coach], tags=["教练管理"])
def read_coaches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_coaches(db, skip=skip, limit=limit)


@app.post("/member-cards/", response_model=schemas.MemberCard, tags=["会员卡管理"])
def create_member_card(card: schemas.MemberCardCreate, db: Session = Depends(get_db)):
    return crud.create_member_card(db=db, card=card)


@app.get("/member-cards/{card_id}", response_model=schemas.MemberCard, tags=["会员卡管理"])
def read_member_card(card_id: int, db: Session = Depends(get_db)):
    db_card = crud.get_member_card(db, card_id=card_id)
    if db_card is None:
        raise HTTPException(status_code=404, detail="会员卡不存在")
    return db_card


@app.get("/member-cards/", response_model=List[schemas.MemberCard], tags=["会员卡管理"])
def read_member_cards(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_member_cards(db, skip=skip, limit=limit)


@app.post("/course-packages/", response_model=schemas.CoursePackage, tags=["课程包管理"])
def create_course_package(package: schemas.CoursePackageCreate, db: Session = Depends(get_db)):
    return crud.create_course_package(db=db, package=package)


@app.get("/course-packages/{package_id}", response_model=schemas.CoursePackage, tags=["课程包管理"])
def read_course_package(package_id: int, db: Session = Depends(get_db)):
    db_package = crud.get_course_package(db, package_id=package_id)
    if db_package is None:
        raise HTTPException(status_code=404, detail="课程包不存在")
    return db_package


@app.get("/course-packages/", response_model=List[schemas.CoursePackage], tags=["课程包管理"])
def read_course_packages(member_card_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_course_packages(db, member_card_id=member_card_id, skip=skip, limit=limit)


@app.post("/bookings/", response_model=schemas.Booking, tags=["预约管理"])
def create_booking(booking: schemas.BookingCreate, db: Session = Depends(get_db)):
    return crud.create_booking(db=db, booking=booking)


@app.get("/bookings/{booking_id}", response_model=schemas.Booking, tags=["预约管理"])
def read_booking(booking_id: int, db: Session = Depends(get_db)):
    db_booking = crud.get_booking(db, booking_id=booking_id)
    if db_booking is None:
        raise HTTPException(status_code=404, detail="预约不存在")
    return db_booking


@app.get("/bookings/", response_model=List[schemas.Booking], tags=["预约管理"])
def read_bookings(member_card_id: Optional[int] = None, coach_id: Optional[int] = None,
                  status: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_bookings(db, member_card_id=member_card_id, coach_id=coach_id,
                            status=status, skip=skip, limit=limit)


@app.post("/bookings/{booking_id}/confirm", response_model=schemas.Booking, tags=["预约管理"])
def confirm_booking(booking_id: int, handler: str, db: Session = Depends(get_db)):
    return crud.confirm_booking(db, booking_id=booking_id, handler=handler)


@app.post("/bookings/{booking_id}/consume", response_model=schemas.Booking, tags=["消课管理"])
def consume_booking(booking_id: int, consumed_by: str, notes: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.consume_booking(db, booking_id=booking_id, consumed_by=consumed_by, notes=notes)


@app.post("/bookings/{booking_id}/cancel", response_model=schemas.Booking, tags=["预约管理"])
def cancel_booking(booking_id: int, handler: str, reason: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.cancel_booking(db, booking_id=booking_id, handler=handler, reason=reason)


@app.post("/leaves/", response_model=schemas.LeaveApplication, tags=["请假管理"])
def apply_leave(leave: schemas.LeaveApplicationCreate, handler: str, db: Session = Depends(get_db)):
    return crud.apply_leave(db, leave=leave, handler=handler)


@app.get("/leaves/{leave_id}", response_model=schemas.LeaveApplication, tags=["请假管理"])
def read_leave(leave_id: int, db: Session = Depends(get_db)):
    db_leave = crud.get_leave_application(db, leave_id=leave_id)
    if db_leave is None:
        raise HTTPException(status_code=404, detail="请假申请不存在")
    return db_leave


@app.post("/leaves/{leave_id}/approve", response_model=schemas.LeaveApplication, tags=["请假管理"])
def approve_leave(leave_id: int, handler: str, db: Session = Depends(get_db)):
    return crud.approve_leave(db, leave_id=leave_id, handler=handler)


@app.post("/leaves/{leave_id}/reject", response_model=schemas.LeaveApplication, tags=["请假管理"])
def reject_leave(leave_id: int, handler: str, rejection_reason: str, db: Session = Depends(get_db)):
    return crud.reject_leave(db, leave_id=leave_id, handler=handler, rejection_reason=rejection_reason)


@app.post("/substitutes/", response_model=schemas.SubstituteRecord, tags=["代课管理"])
def request_substitute(substitute: schemas.SubstituteRecordCreate, handler: str, db: Session = Depends(get_db)):
    return crud.request_substitute(db, substitute=substitute, handler=handler)


@app.get("/substitutes/{substitute_id}", response_model=schemas.SubstituteRecord, tags=["代课管理"])
def read_substitute(substitute_id: int, db: Session = Depends(get_db)):
    db_substitute = crud.get_substitute_record(db, substitute_id=substitute_id)
    if db_substitute is None:
        raise HTTPException(status_code=404, detail="代课记录不存在")
    return db_substitute


@app.post("/substitutes/{substitute_id}/confirm", response_model=schemas.SubstituteRecord, tags=["代课管理"])
def confirm_substitute(substitute_id: int, handler: str, db: Session = Depends(get_db)):
    return crud.confirm_substitute(db, substitute_id=substitute_id, handler=handler)


@app.post("/substitutes/{substitute_id}/reject", response_model=schemas.SubstituteRecord, tags=["代课管理"])
def reject_substitute(substitute_id: int, handler: str, rejection_reason: str, db: Session = Depends(get_db)):
    return crud.reject_substitute(db, substitute_id=substitute_id, handler=handler, rejection_reason=rejection_reason)


@app.post("/makeups/", response_model=schemas.Booking, tags=["补课管理"])
def schedule_makeup(original_booking_id: int, new_booking: schemas.BookingCreate, db: Session = Depends(get_db)):
    return crud.schedule_makeup(db, original_booking_id=original_booking_id, new_booking=new_booking)


@app.post("/consumptions/{consumption_id}/rollback", tags=["消课管理"])
def rollback_consumption(consumption_id: int, reason: str, handler: str, db: Session = Depends(get_db)):
    return crud.rollback_consumption(db, consumption_id=consumption_id, reason=reason, handler=handler)


@app.post("/manual-correction", tags=["系统管理"])
def manual_correction(request: schemas.ManualCorrectionRequest, db: Session = Depends(get_db)):
    return crud.manual_correction(db, request=request)


@app.get("/consumptions/", tags=["消课管理"])
def read_consumptions(member_card_id: Optional[int] = None, course_package_id: Optional[int] = None,
                      coach_id: Optional[int] = None, start_date: Optional[datetime] = None,
                      end_date: Optional[datetime] = None, skip: int = 0, limit: int = 100,
                      db: Session = Depends(get_db)):
    return crud.get_consumption_records(db, member_card_id=member_card_id, course_package_id=course_package_id,
                                       coach_id=coach_id, start_date=start_date, end_date=end_date,
                                       skip=skip, limit=limit)


@app.get("/operation-logs/", tags=["系统管理"])
def read_operation_logs(operation_type: Optional[str] = None, target_type: Optional[str] = None,
                        target_id: Optional[int] = None, skip: int = 0, limit: int = 100,
                        db: Session = Depends(get_db)):
    return crud.get_operation_logs(db, operation_type=operation_type, target_type=target_type,
                                  target_id=target_id, skip=skip, limit=limit)


@app.post("/report/", tags=["报表管理"])
def generate_report(query: schemas.ReportQuery, db: Session = Depends(get_db)):
    return crud.generate_report(db, query=query)


@app.post("/report/export", tags=["报表管理"])
def export_report(query: schemas.ReportQuery, db: Session = Depends(get_db)):
    report = crud.generate_report(db, query=query)
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["序号", "会员姓名", "教练姓名", "课程包名称", "预约日期", "消课时间", "课时数", "消课人", "备注"])
    
    for idx, record in enumerate(report["data"], 1):
        writer.writerow([
            idx,
            record["member_name"],
            record["coach_name"],
            record["package_name"],
            record["booking_date"].strftime("%Y-%m-%d") if record["booking_date"] else "",
            record["consumed_at"].strftime("%Y-%m-%d %H:%M:%S") if record["consumed_at"] else "",
            record["hours"],
            record["consumed_by"] or "",
            record["notes"] or ""
        ])
    
    output.seek(0)
    
    filename = f"消课报表_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
