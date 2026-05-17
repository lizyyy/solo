from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import json
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

from database import engine, get_db, Base
from models import (
    Resource, Reservation, Waitlist, WaitlistNotification, WaitlistReport,
    OperationLog, ReservationStatus, WaitlistStatus
)
from schemas import (
    ResourceCreate, Resource as ResourceSchema,
    ReservationCreate, ReservationCancel, Reservation as ReservationSchema,
    WaitlistCreate, WaitlistConfirm, WaitlistManualUpdate, Waitlist as WaitlistSchema,
    WaitlistQuery, ReservationQuery, ReportGenerate,
    WaitlistReport as ReportSchema, OperationLog as LogSchema,
    WaitlistNotification as WaitlistNotificationSchema,
    SuccessResponse, ErrorResponse
)
import services

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="预约资源候补API",
    description="培训教室和实验设备预约候补管理系统",
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
    db = next(get_db())
    if not db.query(Resource).first():
        sample_resources = [
            Resource(
                resource_code="ROOM-A101",
                resource_name="A101培训教室",
                resource_type="classroom",
                capacity=30,
                location="教学楼A栋1层",
                description="多媒体教室，配有投影仪和音响"
            ),
            Resource(
                resource_code="LAB-B201",
                resource_name="B201物理实验室",
                resource_type="lab",
                capacity=20,
                location="实验楼B栋2层",
                description="配有实验台和基础设备"
            ),
            Resource(
                resource_code="EQUIP-C001",
                resource_name="3D打印机-001",
                resource_type="equipment",
                capacity=1,
                location="创客空间C区",
                description="工业级3D打印机"
            )
        ]
        db.add_all(sample_resources)
        db.commit()


@app.get("/")
def root():
    return {"message": "预约资源候补API", "version": "1.0.0"}


@app.post("/api/resources/", response_model=ResourceSchema, status_code=201)
def create_resource(resource: ResourceCreate, db: Session = Depends(get_db)):
    existing = services.get_resource_by_code(db, resource.resource_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Resource {resource.resource_code} already exists")

    db_resource = Resource(**resource.dict())
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource


@app.get("/api/resources/", response_model=List[ResourceSchema])
def list_resources(
    resource_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Resource)
    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)
    return query.offset(skip).limit(limit).all()


@app.post("/api/reservations/", response_model=ReservationSchema, status_code=201)
def create_reservation(reservation: ReservationCreate, db: Session = Depends(get_db)):
    result, error = services.create_reservation(db, reservation)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@app.get("/api/reservations/", response_model=List[ReservationSchema])
def list_reservations(query: ReservationQuery = Depends(), db: Session = Depends(get_db)):
    q = db.query(Reservation)
    if query.resource_code:
        resource = services.get_resource_by_code(db, query.resource_code)
        if resource:
            q = q.filter(Reservation.resource_id == resource.id)
    if query.booker_id:
        q = q.filter(Reservation.booker_id == query.booker_id)
    if query.status:
        q = q.filter(Reservation.status == query.status)
    if query.start_date:
        q = q.filter(Reservation.start_time >= query.start_date)
    if query.end_date:
        q = q.filter(Reservation.end_time <= query.end_date)
    return q.order_by(Reservation.created_at.desc()).all()


@app.post("/api/reservations/{reservation_id}/cancel", response_model=SuccessResponse)
def cancel_reservation(
    reservation_id: int,
    cancel_data: ReservationCancel,
    db: Session = Depends(get_db)
):
    result, error = services.cancel_reservation(db, reservation_id, cancel_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return SuccessResponse(message="Reservation cancelled successfully", data={"reservation_id": reservation_id})


@app.post("/api/waitlist/", response_model=WaitlistSchema, status_code=201)
def add_to_waitlist(waitlist: WaitlistCreate, db: Session = Depends(get_db)):
    result, error = services.add_to_waitlist(db, waitlist)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@app.get("/api/waitlist/", response_model=List[WaitlistSchema])
def list_waitlist(query: WaitlistQuery = Depends(), db: Session = Depends(get_db)):
    q = db.query(Waitlist)
    if query.resource_code:
        resource = services.get_resource_by_code(db, query.resource_code)
        if resource:
            q = q.filter(Waitlist.resource_id == resource.id)
    if query.user_id:
        q = q.filter(Waitlist.user_id == query.user_id)
    if query.status:
        q = q.filter(Waitlist.status == query.status)
    if query.start_date:
        q = q.filter(Waitlist.created_at >= query.start_date)
    if query.end_date:
        q = q.filter(Waitlist.created_at <= query.end_date)
    return q.order_by(Waitlist.queue_position.asc(), Waitlist.created_at.desc()).all()


@app.get("/api/waitlist/{waitlist_id}", response_model=WaitlistSchema)
def get_waitlist(waitlist_id: int, db: Session = Depends(get_db)):
    waitlist = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not waitlist:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    return waitlist


@app.post("/api/waitlist/{waitlist_id}/confirm", response_model=SuccessResponse)
def confirm_waitlist_slot(
    waitlist_id: int,
    confirm_data: WaitlistConfirm,
    db: Session = Depends(get_db)
):
    result, error = services.confirm_waitlist_slot(db, waitlist_id, confirm_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return SuccessResponse(
        message="Waitlist confirmation processed",
        data={"waitlist_id": waitlist_id, "confirmed": confirm_data.confirm}
    )


@app.post("/api/waitlist/{waitlist_id}/manual-update", response_model=WaitlistSchema)
def manual_update_waitlist(
    waitlist_id: int,
    update_data: WaitlistManualUpdate,
    db: Session = Depends(get_db)
):
    result, error = services.manual_update_waitlist(db, waitlist_id, update_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@app.get("/api/waitlist/{waitlist_id}/notifications", response_model=List[WaitlistNotificationSchema])
def get_waitlist_notifications(waitlist_id: int, db: Session = Depends(get_db)):
    return db.query(WaitlistNotification).filter(
        WaitlistNotification.waitlist_id == waitlist_id
    ).order_by(WaitlistNotification.sent_at.desc()).all()


@app.post("/api/reports/generate", response_model=ReportSchema)
def generate_report(report_data: ReportGenerate, db: Session = Depends(get_db)):
    result, error = services.generate_report(db, report_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@app.get("/api/reports/", response_model=List[ReportSchema])
def list_reports(
    report_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(WaitlistReport)
    if report_type:
        query = query.filter(WaitlistReport.report_type == report_type)
    return query.order_by(WaitlistReport.generated_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/reports/{report_id}/export")
def export_report(report_id: int, format: str = "csv", db: Session = Depends(get_db)):
    report = db.query(WaitlistReport).filter(WaitlistReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    waitlists = db.query(Waitlist).filter(
        Waitlist.created_at >= report.period_start,
        Waitlist.created_at <= report.period_end
    ).all()

    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "候补编号", "用户ID", "用户名", "状态", "优先级",
            "排队位置", "创建时间", "通知时间", "确认时间", "过期时间"
        ])
        for w in waitlists:
            writer.writerow([
                w.waitlist_no, w.user_id, w.user_name, w.status, w.priority,
                w.queue_position, w.created_at, w.notified_at, w.confirmed_at, w.expired_at
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=report_{report.report_no}.csv"}
        )
    elif format == "json":
        data = {
            "report_no": report.report_no,
            "period": {"start": report.period_start.isoformat(), "end": report.period_end.isoformat()},
            "summary": {
                "total": report.total_waitlist_count,
                "notified": report.notified_count,
                "confirmed": report.confirmed_count,
                "expired": report.expired_count,
                "cancelled": report.cancelled_count,
                "avg_wait_minutes": report.avg_wait_time_minutes
            },
            "waitlists": [
                {
                    "waitlist_no": w.waitlist_no,
                    "user_id": w.user_id,
                    "user_name": w.user_name,
                    "status": w.status,
                    "priority": w.priority,
                    "queue_position": w.queue_position
                }
                for w in waitlists
            ]
        }
        return data
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")


@app.get("/api/operation-logs/", response_model=List[LogSchema])
def list_operation_logs(
    operation_type: Optional[str] = None,
    target_type: Optional[str] = None,
    operator: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(OperationLog)
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    if target_type:
        query = query.filter(OperationLog.target_type == target_type)
    if operator:
        query = query.filter(OperationLog.operator == operator)
    return query.order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()


@app.post("/api/maintenance/check-expired")
def check_expired(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(services.check_expired_waitlists, db)
    return SuccessResponse(message="Expiration check triggered")


@app.get("/api/stats/summary")
def get_stats_summary(db: Session = Depends(get_db)):
    total_reservations = db.query(Reservation).count()
    cancelled_reservations = db.query(Reservation).filter(
        Reservation.status == ReservationStatus.CANCELLED
    ).count()
    total_waitlist = db.query(Waitlist).count()
    waiting = db.query(Waitlist).filter(Waitlist.status == WaitlistStatus.WAITING).count()
    confirmed = db.query(Waitlist).filter(Waitlist.status == WaitlistStatus.CONFIRMED).count()

    return {
        "reservations": {
            "total": total_reservations,
            "cancelled": cancelled_reservations,
            "cancellation_rate": round(cancelled_reservations / total_reservations * 100, 2) if total_reservations > 0 else 0
        },
        "waitlist": {
            "total": total_waitlist,
            "waiting": waiting,
            "confirmed": confirmed,
            "conversion_rate": round(confirmed / total_waitlist * 100, 2) if total_waitlist > 0 else 0
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
