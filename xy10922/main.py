from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timedelta
import json
import traceback
from database import engine, get_db
import models
import schemas
import crud
from models import RequestStatus

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="园区访客车位 API", description="访客临时车位管理系统")


@app.middleware("http")
async def exception_handling_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        db = next(get_db())
        try:
            body = await request.body()
            body_str = body.decode() if body else ""
            crud.log_exception(db, schemas.ExceptionLogCreate(
                request_path=str(request.url),
                request_method=request.method,
                raw_input=body_str,
                error_message=str(e),
                error_type=type(e).__name__,
                processing_result="PENDING_REVIEW"
            ))
        except:
            pass
        raise


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    db = next(get_db())
    try:
        body = await request.body()
        body_str = body.decode() if body else ""
        crud.log_exception(db, schemas.ExceptionLogCreate(
            request_path=str(request.url),
            request_method=request.method,
            raw_input=body_str,
            error_message=str(exc),
            error_type="ValidationError",
            processing_result="REJECTED"
        ))
    except:
        pass
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "status": "REJECTED",
            "message": "请求参数验证失败",
            "errors": [str(err) for err in exc.errors()]
        }
    )


@app.get("/")
async def root():
    return {"message": "园区访客车位 API 服务已启动", "version": "1.0.0"}


@app.post("/visitors/", response_model=schemas.ApiResponse)
def create_visitor(visitor: schemas.VisitorCreate, db: Session = Depends(get_db)):
    try:
        db_visitor = crud.create_visitor(db, visitor)
        return schemas.ApiResponse(
            success=True,
            status=RequestStatus.APPROVED.value,
            message="访客创建成功",
            data={"visitor": schemas.Visitor.model_validate(db_visitor).model_dump()}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/visitors/", response_model=schemas.ApiResponse)
def read_visitors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    visitors = crud.get_visitors(db, skip=skip, limit=limit)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取访客列表成功",
        data={"visitors": [schemas.Visitor.model_validate(v).model_dump() for v in visitors]}
    )


@app.get("/visitors/{visitor_id}", response_model=schemas.ApiResponse)
def read_visitor(visitor_id: int, db: Session = Depends(get_db)):
    db_visitor = crud.get_visitor(db, visitor_id)
    if db_visitor is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="访客不存在",
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取访客信息成功",
        data={"visitor": schemas.Visitor.model_validate(db_visitor).model_dump()}
    )


@app.post("/parking-spots/", response_model=schemas.ApiResponse)
def create_parking_spot(spot: schemas.ParkingSpotCreate, db: Session = Depends(get_db)):
    db_spot = crud.get_parking_spot_by_number(db, spot_number=spot.spot_number)
    if db_spot:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="车位号已存在",
            data=None
        )
    db_spot = crud.create_parking_spot(db, spot)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="车位创建成功",
        data={"parking_spot": schemas.ParkingSpot.model_validate(db_spot).model_dump()}
    )


@app.get("/parking-spots/", response_model=schemas.ApiResponse)
def read_parking_spots(skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)):
    spots = crud.get_parking_spots(db, skip=skip, limit=limit, status=status)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取车位列表成功",
        data={"parking_spots": [schemas.ParkingSpot.model_validate(s).model_dump() for s in spots]}
    )


@app.get("/parking-spots/{spot_id}", response_model=schemas.ApiResponse)
def read_parking_spot(spot_id: int, db: Session = Depends(get_db)):
    db_spot = crud.get_parking_spot(db, spot_id)
    if db_spot is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="车位不存在",
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取车位信息成功",
        data={"parking_spot": schemas.ParkingSpot.model_validate(db_spot).model_dump()}
    )


@app.put("/parking-spots/{spot_id}", response_model=schemas.ApiResponse)
def update_parking_spot(spot_id: int, spot_update: schemas.ParkingSpotUpdate, db: Session = Depends(get_db)):
    db_spot = crud.update_parking_spot(db, spot_id, spot_update)
    if db_spot is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="车位不存在",
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="车位更新成功",
        data={"parking_spot": schemas.ParkingSpot.model_validate(db_spot).model_dump()}
    )


@app.post("/parking-spots/lock", response_model=schemas.ApiResponse)
def lock_spot(lock_request: schemas.ParkingSpotLockRequest, db: Session = Depends(get_db)):
    db_spot = crud.lock_parking_spot(db, lock_request.spot_id, lock_request.appointment_id)
    if db_spot is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="车位锁定失败，可能已被占用",
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="车位锁定成功",
        data={"parking_spot": schemas.ParkingSpot.model_validate(db_spot).model_dump()}
    )


@app.post("/parking-spots/{spot_id}/release", response_model=schemas.ApiResponse)
def release_spot(spot_id: int, db: Session = Depends(get_db)):
    db_spot = crud.release_parking_spot(db, spot_id)
    if db_spot is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="车位不存在",
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="车位释放成功",
        data={"parking_spot": schemas.ParkingSpot.model_validate(db_spot).model_dump()}
    )


@app.post("/appointments/", response_model=schemas.ApiResponse)
def create_appointment(appointment: schemas.MeetingAppointmentCreate, db: Session = Depends(get_db)):
    db_visitor = crud.get_visitor(db, appointment.visitor_id)
    if not db_visitor:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="访客不存在",
            data=None
        )

    if appointment.end_time <= appointment.start_time:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="会议结束时间必须晚于开始时间",
            data=None
        )

    if appointment.parking_spot_id:
        db_spot = crud.get_parking_spot(db, appointment.parking_spot_id)
        if not db_spot:
            return schemas.ApiResponse(
                success=False,
                status=RequestStatus.REJECTED.value,
                message="车位不存在",
                data=None
            )
        if db_spot.status != models.ParkingSpotStatus.AVAILABLE.value:
            return schemas.ApiResponse(
                success=False,
                status=RequestStatus.REJECTED.value,
                message=f"所选车位状态为 {db_spot.status}，不可用",
                data=None
            )
    else:
        available_spot = crud.find_available_spot(db)
        if available_spot:
            appointment.parking_spot_id = available_spot.id
        else:
            return schemas.ApiResponse(
                success=False,
                status=RequestStatus.REJECTED.value,
                message="没有可用的临时车位",
                data=None
            )

    db_appointment = crud.create_meeting_appointment(db, appointment)

    if appointment.parking_spot_id:
        db.refresh(db_appointment)
        db_spot = crud.get_parking_spot(db, appointment.parking_spot_id)
        if db_spot and db_spot.status != models.ParkingSpotStatus.LOCKED.value:
            db.delete(db_appointment)
            db.commit()
            return schemas.ApiResponse(
                success=False,
                status=RequestStatus.REJECTED.value,
                message="车位锁定失败，预约已回滚",
                data=None
            )

    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="会议预约创建成功",
        data={"appointment": schemas.MeetingAppointment.model_validate(db_appointment).model_dump()}
    )


@app.get("/appointments/", response_model=schemas.ApiResponse)
def read_appointments(skip: int = 0, limit: int = 100, status: str = None, visitor_id: int = None, db: Session = Depends(get_db)):
    appointments = crud.get_meeting_appointments(db, skip=skip, limit=limit, status=status, visitor_id=visitor_id)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取预约列表成功",
        data={"appointments": [schemas.MeetingAppointment.model_validate(a).model_dump() for a in appointments]}
    )


@app.get("/appointments/{appointment_id}", response_model=schemas.ApiResponse)
def read_appointment(appointment_id: int, db: Session = Depends(get_db)):
    db_appointment = crud.get_meeting_appointment(db, appointment_id)
    if db_appointment is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="预约不存在",
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取预约信息成功",
        data={"appointment": schemas.MeetingAppointment.model_validate(db_appointment).model_dump()}
    )


@app.put("/appointments/{appointment_id}", response_model=schemas.ApiResponse)
def update_appointment(appointment_id: int, appointment_update: schemas.MeetingAppointmentUpdate, db: Session = Depends(get_db)):
    db_appointment = crud.get_meeting_appointment(db, appointment_id)
    if db_appointment is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="预约不存在",
            data=None
        )

    original_status = db_appointment.status

    db_appointment = crud.update_meeting_appointment(db, appointment_id, appointment_update)

    if appointment_update.status == models.MeetingStatus.CANCELLED.value and original_status != models.MeetingStatus.CANCELLED.value:
        if db_appointment.parking_spot_id:
            crud.release_parking_spot(db, db_appointment.parking_spot_id)

        for pass_code in db_appointment.pass_codes:
            pass_code.status = models.PassCodeStatus.CANCELLED.value
        db.commit()
        db.refresh(db_appointment)

        return schemas.ApiResponse(
            success=True,
            status=RequestStatus.APPROVED.value,
            message="预约已取消，车位已释放，放行码已失效",
            data={"appointment": schemas.MeetingAppointment.model_validate(db_appointment).model_dump()}
        )

    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="预约更新成功",
        data={"appointment": schemas.MeetingAppointment.model_validate(db_appointment).model_dump()}
    )


@app.post("/appointments/{appointment_id}/cancel", response_model=schemas.ApiResponse)
def cancel_appointment(appointment_id: int, cancel_record: schemas.CancelRecordCreate, db: Session = Depends(get_db)):
    cancel_record.appointment_id = appointment_id
    db_appointment = crud.cancel_meeting_appointment(db, appointment_id, cancel_record)
    if db_appointment is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="预约不存在",
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="会议取消成功，车位已释放",
        data={"appointment": schemas.MeetingAppointment.model_validate(db_appointment).model_dump()}
    )


@app.post("/appointments/{appointment_id}/pass-code", response_model=schemas.ApiResponse)
def generate_pass_code(appointment_id: int, db: Session = Depends(get_db)):
    db_pass_code, message = crud.generate_pass_code(db, appointment_id)
    if db_pass_code is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message=message,
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message=message,
        data={"pass_code": schemas.PassCode.model_validate(db_pass_code).model_dump()}
    )


@app.post("/pass-codes/verify", response_model=schemas.ApiResponse)
def verify_pass_code(verify_request: schemas.PassCodeVerifyRequest, db: Session = Depends(get_db)):
    db_pass_code, message = crud.verify_pass_code(db, verify_request.code, verify_request.verified_by)
    if db_pass_code is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message=message,
            data=None
        )
    if db_pass_code.status != models.PassCodeStatus.USED.value:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message=message,
            data={"pass_code": schemas.PassCode.model_validate(db_pass_code).model_dump()}
        )
    appointment = db_pass_code.appointment
    if appointment and appointment.status == models.MeetingStatus.CANCELLED.value:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message=message,
            data={"pass_code": schemas.PassCode.model_validate(db_pass_code).model_dump()}
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message=message,
        data={"pass_code": schemas.PassCode.model_validate(db_pass_code).model_dump()}
    )


@app.get("/cancel-records/", response_model=schemas.ApiResponse)
def read_cancel_records(skip: int = 0, limit: int = 100, appointment_id: int = None, db: Session = Depends(get_db)):
    records = crud.get_cancel_records(db, skip=skip, limit=limit, appointment_id=appointment_id)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取取消记录成功",
        data={"cancel_records": [schemas.CancelRecord.model_validate(r).model_dump() for r in records]}
    )


@app.post("/reports/generate", response_model=schemas.ApiResponse)
def generate_report(generated_by: str = None, db: Session = Depends(get_db)):
    db_report = crud.generate_occupancy_report(db, generated_by=generated_by)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="占用报告生成成功",
        data={"report": schemas.OccupancyReport.model_validate(db_report).model_dump()}
    )


@app.get("/reports/", response_model=schemas.ApiResponse)
def read_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    reports = crud.get_occupancy_reports(db, skip=skip, limit=limit)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取报告列表成功",
        data={"reports": [schemas.OccupancyReport.model_validate(r).model_dump() for r in reports]}
    )


@app.post("/reports/export", response_model=schemas.ApiResponse)
def export_report(export_request: schemas.ExportReportRequest, db: Session = Depends(get_db)):
    reports = crud.get_occupancy_reports(
        db, start_date=export_request.start_date, end_date=export_request.end_date
    )
    report_data = [schemas.OccupancyReport.model_validate(r).model_dump() for r in reports]

    export_data = {
        "export_time": datetime.now().isoformat(),
        "report_type": export_request.report_type,
        "date_range": {
            "start": export_request.start_date.isoformat(),
            "end": export_request.end_date.isoformat()
        },
        "total_records": len(report_data),
        "reports": report_data
    }

    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="报告导出成功",
        data=export_data
    )


@app.post("/manual-correction", response_model=schemas.ApiResponse)
def manual_correction(correction: schemas.ManualCorrectionRequest, db: Session = Depends(get_db)):
    db_appointment, message = crud.manual_correction(db, correction)
    if db_appointment is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message=message,
            data=None
        )
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.PENDING_REVIEW.value,
        message=message,
        data={"appointment": schemas.MeetingAppointment.model_validate(db_appointment).model_dump()}
    )


@app.get("/exception-logs/", response_model=schemas.ApiResponse)
def read_exception_logs(skip: int = 0, limit: int = 100, processed: bool = None, db: Session = Depends(get_db)):
    logs = crud.get_exception_logs(db, skip=skip, limit=limit, processed=processed)
    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取异常日志成功",
        data={"exception_logs": [schemas.ExceptionLog.model_validate(l).model_dump() for l in logs]}
    )


@app.put("/exception-logs/{log_id}", response_model=schemas.ApiResponse)
def update_exception_log(log_id: int, log_update: schemas.ExceptionLogUpdate, db: Session = Depends(get_db)):
    db_log = crud.update_exception_log(db, log_id, log_update)
    if db_log is None:
        return schemas.ApiResponse(
            success=False,
            status=RequestStatus.REJECTED.value,
            message="异常日志不存在",
            data=None
        )
    status = db_log.processing_result or RequestStatus.PENDING_REVIEW.value
    return schemas.ApiResponse(
        success=True,
        status=status,
        message="异常日志处理完成",
        data={"exception_log": schemas.ExceptionLog.model_validate(db_log).model_dump()}
    )


@app.get("/status/overview", response_model=schemas.ApiResponse)
def get_status_overview(db: Session = Depends(get_db)):
    total_spots = db.query(models.ParkingSpot).count()
    available_spots = db.query(models.ParkingSpot).filter(
        models.ParkingSpot.status == models.ParkingSpotStatus.AVAILABLE.value
    ).count()
    locked_spots = db.query(models.ParkingSpot).filter(
        models.ParkingSpot.status == models.ParkingSpotStatus.LOCKED.value
    ).count()
    occupied_spots = db.query(models.ParkingSpot).filter(
        models.ParkingSpot.status == models.ParkingSpotStatus.OCCUPIED.value
    ).count()

    scheduled_appointments = db.query(models.MeetingAppointment).filter(
        models.MeetingAppointment.status == models.MeetingStatus.SCHEDULED.value
    ).count()
    cancelled_appointments = db.query(models.MeetingAppointment).filter(
        models.MeetingAppointment.status == models.MeetingStatus.CANCELLED.value
    ).count()
    pending_review_appointments = db.query(models.MeetingAppointment).filter(
        models.MeetingAppointment.request_status == models.RequestStatus.PENDING_REVIEW.value
    ).count()

    pending_exceptions = db.query(models.ExceptionLog).filter(
        or_(
            models.ExceptionLog.processing_result.is_(None),
            models.ExceptionLog.processing_result == models.RequestStatus.PENDING_REVIEW.value
        )
    ).count()

    return schemas.ApiResponse(
        success=True,
        status=RequestStatus.APPROVED.value,
        message="获取状态概览成功",
        data={
            "parking": {
                "total": total_spots,
                "available": available_spots,
                "locked": locked_spots,
                "occupied": occupied_spots
            },
            "appointments": {
                "scheduled": scheduled_appointments,
                "cancelled": cancelled_appointments,
                "pending_review": pending_review_appointments
            },
            "exceptions": {
                "pending_review": pending_exceptions
            }
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
