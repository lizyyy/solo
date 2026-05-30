from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from app import models, schemas
from app.database import get_db, init_db
from app.repositories import (
    RoomRepository, EquipmentRepository, BandRepository,
    BookingRequestRepository, ScheduleRepository, ConflictRecordRepository,
    ExamWeekRepository, BatchReportRepository
)
from app.scheduler import IntegerProgrammingScheduler
from app.report_generator import ReportGenerator
from app.exceptions import (
    ResourceNotFoundException, InvalidBookingException,
    BatchProcessingException
)

app = FastAPI(
    title="音乐学院排练室预约整数规划系统",
    description="基于整数规划的排练室智能排期系统，支持设备冲突检测、考试周约束和批次报告生成",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {
        "name": "排练室预约整数规划系统",
        "version": "1.0.0",
        "status": "running"
    }


@app.post("/rooms/", response_model=schemas.Room, status_code=status.HTTP_201_CREATED)
def create_room(room: schemas.RoomCreate, db: Session = Depends(get_db)):
    repo = RoomRepository(db)
    return repo.create(room)


@app.get("/rooms/", response_model=List[schemas.Room])
def get_rooms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    repo = RoomRepository(db)
    return repo.get_all(skip=skip, limit=limit)


@app.get("/rooms/{room_id}", response_model=schemas.Room)
def get_room(room_id: int, db: Session = Depends(get_db)):
    repo = RoomRepository(db)
    room = repo.get_by_id(room_id)
    if not room:
        raise ResourceNotFoundException("房间", room_id)
    return room


@app.post("/equipment/", response_model=schemas.Equipment, status_code=status.HTTP_201_CREATED)
def create_equipment(equipment: schemas.EquipmentCreate, db: Session = Depends(get_db)):
    repo = EquipmentRepository(db)
    return repo.create(equipment)


@app.get("/equipment/", response_model=List[schemas.Equipment])
def get_equipment(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    repo = EquipmentRepository(db)
    return repo.get_all(skip=skip, limit=limit)


@app.post("/bands/", response_model=schemas.Band, status_code=status.HTTP_201_CREATED)
def create_band(band: schemas.BandCreate, db: Session = Depends(get_db)):
    repo = BandRepository(db)
    return repo.create(band)


@app.get("/bands/", response_model=List[schemas.Band])
def get_bands(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    repo = BandRepository(db)
    return repo.get_all(skip=skip, limit=limit)


@app.post("/bookings/", response_model=schemas.BookingRequest, status_code=status.HTTP_201_CREATED)
def create_booking(booking: schemas.BookingRequestCreate, db: Session = Depends(get_db)):
    band_repo = BandRepository(db)
    band = band_repo.get_by_id(booking.band_id)
    if not band:
        raise ResourceNotFoundException("乐队", booking.band_id)

    if booking.participant_count > band.member_count * 2:
        raise InvalidBookingException("参与人数超过乐队合理范围")

    repo = BookingRequestRepository(db)
    return repo.create(booking)


@app.get("/bookings/", response_model=List[schemas.BookingRequest])
def get_bookings(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    repo = BookingRequestRepository(db)
    return repo.get_all(skip=skip, limit=limit, status=status)


@app.get("/bookings/{booking_id}", response_model=schemas.BookingRequest)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    repo = BookingRequestRepository(db)
    booking = repo.get_by_id(booking_id)
    if not booking:
        raise ResourceNotFoundException("预约申请", booking_id)
    return booking


@app.put("/bookings/{booking_id}/review", response_model=schemas.BookingRequest)
def review_booking(booking_id: int, review: schemas.BookingReviewRequest, db: Session = Depends(get_db)):
    repo = BookingRequestRepository(db)
    booking = repo.update_status(
        booking_id=booking_id,
        status=review.status,
        review_notes=review.review_notes,
        reviewed_by=review.reviewed_by
    )
    if not booking:
        raise ResourceNotFoundException("预约申请", booking_id)
    return booking


@app.post("/exam-weeks/", response_model=schemas.ExamWeek, status_code=status.HTTP_201_CREATED)
def create_exam_week(exam_week: schemas.ExamWeekCreate, db: Session = Depends(get_db)):
    repo = ExamWeekRepository(db)
    return repo.create(exam_week)


@app.get("/exam-weeks/", response_model=List[schemas.ExamWeek])
def get_exam_weeks(db: Session = Depends(get_db)):
    repo = ExamWeekRepository(db)
    return repo.get_active()


@app.post("/scheduling/run", response_model=schemas.SchedulingResult)
def run_scheduling(request: schemas.SchedulingRequest, db: Session = Depends(get_db)):
    if not request.booking_ids:
        raise InvalidBookingException("预约申请列表不能为空")

    batch_repo = BatchReportRepository(db)
    batch_id = batch_repo.generate_batch_id()

    booking_repo = BookingRequestRepository(db)
    for booking_id in request.booking_ids:
        booking = booking_repo.get_by_id(booking_id)
        if not booking:
            raise ResourceNotFoundException("预约申请", booking_id)
        booking_repo.update_batch_id(booking_id, batch_id)

    scheduler = IntegerProgrammingScheduler(db)

    try:
        schedules_data, conflicts_data, summary = scheduler.schedule_batch(
            booking_ids=request.booking_ids,
            batch_id=batch_id,
            scheduled_date=request.scheduled_date
        )
    except Exception as e:
        raise BatchProcessingException(str(e), batch_id)

    schedule_repo = ScheduleRepository(db)
    schedules = []
    for s_data in schedules_data:
        schedule = schedule_repo.create(schemas.ScheduleCreate(**s_data))
        schedules.append(schedule)

    conflict_repo = ConflictRecordRepository(db)
    conflicts = []
    for c_data in conflicts_data:
        conflict = conflict_repo.create(schemas.ConflictRecordCreate(**c_data))
        conflicts.append(conflict)

    booking_repo = BookingRequestRepository(db)
    for s in schedules:
        booking_repo.update_status(s.booking_id, "scheduled")
    for c in conflicts:
        booking_repo.update_status(c.booking_id, "conflict")

    room_repo = RoomRepository(db)
    rooms = room_repo.get_all()
    bookings = [booking_repo.get_by_id(bid) for bid in request.booking_ids]
    bookings = [b for b in bookings if b is not None]

    report_generator = ReportGenerator()
    report_path = report_generator.generate_batch_report(
        batch_id=batch_id,
        batch_name=request.batch_name,
        schedules=schedules_data,
        conflicts=conflicts_data,
        algorithm_summary=summary,
        bookings=bookings,
        rooms=rooms
    )

    batch_repo.create(
        report=schemas.BatchReportCreate(
            batch_name=request.batch_name,
            scheduled_date=request.scheduled_date,
            created_by=request.created_by
        ),
        batch_id=batch_id,
        total_requests=len(request.booking_ids),
        scheduled_count=len(schedules),
        conflict_count=len(conflicts),
        rejected_count=0,
        algorithm_summary=summary,
        file_path=report_path
    )

    return schemas.SchedulingResult(
        batch_id=batch_id,
        batch_name=request.batch_name,
        total_requests=len(request.booking_ids),
        scheduled_count=len(schedules),
        conflict_count=len(conflicts),
        rejected_count=0,
        schedules=schedules,
        conflicts=conflicts,
        algorithm_summary=summary,
        report_file=os.path.basename(report_path)
    )


@app.get("/schedules/", response_model=List[schemas.Schedule])
def get_schedules(batch_id: Optional[str] = None, booking_id: Optional[int] = None,
                   db: Session = Depends(get_db)):
    repo = ScheduleRepository(db)
    if batch_id:
        return repo.get_by_batch(batch_id)
    if booking_id:
        return repo.get_by_booking(booking_id)
    return []


@app.get("/conflicts/", response_model=List[schemas.ConflictRecord])
def get_conflicts(batch_id: Optional[str] = None, booking_id: Optional[int] = None,
                   db: Session = Depends(get_db)):
    repo = ConflictRecordRepository(db)
    if batch_id:
        return repo.get_by_batch(batch_id)
    if booking_id:
        return repo.get_by_booking(booking_id)
    return []


@app.put("/conflicts/{conflict_id}/resolve", response_model=schemas.ConflictRecord)
def resolve_conflict(conflict_id: int, resolution: schemas.ConflictResolutionRequest,
                      db: Session = Depends(get_db)):
    repo = ConflictRecordRepository(db)
    conflict = repo.resolve(conflict_id, resolution.resolution_note)
    if not conflict:
        raise ResourceNotFoundException("冲突记录", conflict_id)
    return conflict


@app.get("/batches/", response_model=List[schemas.BatchReport])
def get_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    repo = BatchReportRepository(db)
    return repo.get_all(skip=skip, limit=limit)


@app.get("/batches/{batch_id}", response_model=schemas.BatchReport)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    repo = BatchReportRepository(db)
    report = repo.get_by_batch_id(batch_id)
    if not report:
        raise ResourceNotFoundException("批次报告", batch_id)
    return report


@app.get("/reports/{filename}")
def download_report(filename: str):
    report_path = os.path.join("reports", filename)
    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="报告文件不存在")
    return FileResponse(report_path, filename=filename)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
