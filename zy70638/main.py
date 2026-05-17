from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
from datetime import datetime

import database
import schemas
from services import (
    MemberService,
    StationService,
    QueueService,
    AppointmentService,
    ReportService
)
from exceptions import (
    ValidationException,
    InvalidStatusException,
    ManualReviewRequiredException,
    AlreadyProcessedException,
    ResourceNotFoundException,
    DuplicateOperationException
)

database.init_db()
app = FastAPI(title="洗车排队工位分配系统", version="1.0.0")


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/members/", response_model=schemas.Member, tags=["会员管理"])
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    return MemberService.create_member(db, member)


@app.get("/api/members/{member_id}", response_model=schemas.Member, tags=["会员管理"])
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = MemberService.get_member(db, member_id)
    if not member:
        raise ResourceNotFoundException("会员", member_id)
    return member


@app.get("/api/members/", response_model=List[schemas.Member], tags=["会员管理"])
def get_members(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(database.Member).offset(skip).limit(limit).all()


@app.put("/api/members/{member_id}", response_model=schemas.Member, tags=["会员管理"])
def update_member(member_id: int, member_update: schemas.MemberUpdate, db: Session = Depends(get_db)):
    return MemberService.update_member(db, member_id, member_update)


@app.post("/api/stations/", response_model=schemas.Station, tags=["工位管理"])
def create_station(station: schemas.StationCreate, db: Session = Depends(get_db)):
    return StationService.create_station(db, station)


@app.get("/api/stations/{station_id}", response_model=schemas.Station, tags=["工位管理"])
def get_station(station_id: int, db: Session = Depends(get_db)):
    station = StationService.get_station(db, station_id)
    if not station:
        raise ResourceNotFoundException("工位", station_id)
    return station


@app.get("/api/stations/", response_model=List[schemas.Station], tags=["工位管理"])
def get_stations(only_active: bool = True, db: Session = Depends(get_db)):
    return StationService.get_all_stations(db, only_active)


@app.post("/api/appointments/", response_model=schemas.Appointment, tags=["预约管理"])
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    return AppointmentService.create_appointment(db, appointment)


@app.get("/api/appointments/{appointment_id}", response_model=schemas.Appointment, tags=["预约管理"])
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = AppointmentService.get_appointment(db, appointment_id)
    if not appointment:
        raise ResourceNotFoundException("预约", appointment_id)
    return appointment


@app.post("/api/appointments/{appointment_id}/cancel", response_model=schemas.Appointment, tags=["预约管理"])
def cancel_appointment(appointment_id: int, db: Session = Depends(get_db)):
    return AppointmentService.cancel_appointment(db, appointment_id)


@app.post("/api/queues/", response_model=schemas.QueueNumber, tags=["排队管理"])
def create_queue(queue: schemas.QueueNumberCreate, db: Session = Depends(get_db)):
    return QueueService.create_queue_number(db, queue)


@app.get("/api/queues/waiting", response_model=List[schemas.QueueNumber], tags=["排队管理"])
def get_waiting_queues(db: Session = Depends(get_db)):
    return QueueService.get_waiting_queues(db)


@app.get("/api/queues/{queue_id}", response_model=schemas.QueueNumber, tags=["排队管理"])
def get_queue(queue_id: int, db: Session = Depends(get_db)):
    queue = QueueService.get_queue_number(db, queue_id)
    if not queue:
        raise ResourceNotFoundException("排队号", queue_id)
    return queue


@app.post("/api/queues/call", response_model=schemas.QueueNumber, tags=["排队管理"])
def call_next_queue(call_request: schemas.QueueCallRequest, db: Session = Depends(get_db)):
    return QueueService.call_next_queue(db, call_request.station_id, call_request.operator)


@app.post("/api/queues/{queue_id}/start", response_model=schemas.QueueNumber, tags=["排队管理"])
def start_service(queue_id: int, db: Session = Depends(get_db)):
    return QueueService.start_service(db, queue_id)


@app.post("/api/queues/{queue_id}/complete", response_model=schemas.QueueNumber, tags=["排队管理"])
def complete_service(queue_id: int, complete_request: schemas.QueueCompleteRequest = None, db: Session = Depends(get_db)):
    return QueueService.complete_service(db, queue_id)


@app.post("/api/queues/{queue_id}/pass", response_model=schemas.PassedRecord, tags=["排队管理"])
def mark_as_passed(
    queue_id: int,
    reason: str = None,
    notes: str = None,
    operator: str = None,
    db: Session = Depends(get_db)
):
    return QueueService.mark_as_passed(db, queue_id, reason, notes, operator)


@app.get("/api/passed-records/", response_model=List[schemas.PassedRecord], tags=["过号管理"])
def get_passed_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(database.PassedRecord).offset(skip).limit(limit).all()


@app.post("/api/passed-records/{record_id}/requeue", response_model=schemas.QueueNumber, tags=["过号管理"])
def requeue_passed(record_id: int, requeue_request: schemas.RequeueRequest = None, db: Session = Depends(get_db)):
    operator = requeue_request.operator if requeue_request else None
    return QueueService.requeue_passed(db, record_id, operator)


@app.post("/api/reports/daily/{report_date}", response_model=schemas.QueueReport, tags=["报表管理"])
def generate_daily_report(report_date: str, db: Session = Depends(get_db)):
    return ReportService.generate_daily_report(db, report_date)


@app.get("/api/reports/{report_date}", response_model=schemas.QueueReport, tags=["报表管理"])
def get_report(report_date: str, db: Session = Depends(get_db)):
    report = db.query(database.QueueReport).filter(database.QueueReport.report_date == report_date).first()
    if not report:
        raise ResourceNotFoundException("日报表", report_date)
    return report


@app.post("/api/reports/export", tags=["报表管理"])
def export_report(date_range: schemas.DateRangeRequest, db: Session = Depends(get_db)):
    file_name = f"car_wash_report_{date_range.start_date}_to_{date_range.end_date}.xlsx"
    file_path = os.path.join(os.getcwd(), file_name)

    try:
        ReportService.export_to_excel(db, date_range.start_date, date_range.end_date, file_path)
        return FileResponse(file_path, filename=file_name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@app.get("/api/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
