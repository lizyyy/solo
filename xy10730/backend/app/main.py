from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import io
import pandas as pd
from .database import engine, Base, get_db
from . import models, schemas, services

Base.metadata.create_all(bind=engine)

app = FastAPI(title="内部服务健康巡检 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "内部服务健康巡检系统", "version": "1.0.0"}


@app.get("/api/services", response_model=list[schemas.ServiceResponse])
def get_services(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.ServiceCRUD.get_services(db, skip=skip, limit=limit)


@app.get("/api/services/{service_id}", response_model=schemas.ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = services.ServiceCRUD.get_service(db, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")
    return service


@app.post("/api/services", response_model=schemas.ServiceResponse)
def create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Service).filter(
        models.Service.name == service.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="服务名称已存在")
    return services.ServiceCRUD.create_service(db, service)


@app.put("/api/services/{service_id}", response_model=schemas.ServiceResponse)
def update_service(
    service_id: int,
    service_data: schemas.ServiceUpdate,
    db: Session = Depends(get_db)
):
    service = services.ServiceCRUD.update_service(db, service_id, service_data)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")
    return service


@app.post("/api/health-check", response_model=schemas.HealthRecordResponse)
def create_health_check(
    check_request: schemas.HealthCheckRequest,
    db: Session = Depends(get_db)
):
    service = services.ServiceCRUD.get_service(db, check_request.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="服务不存在")

    record = services.HealthRecordService.create_health_record(db, check_request)
    return record


@app.get("/api/health-records")
def get_health_records(
    service_id: Optional[int] = None,
    health_status: Optional[models.HealthStatus] = None,
    check_status: Optional[models.CheckStatus] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    reviewed: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    filters = schemas.FilterParams(
        service_id=service_id,
        health_status=health_status,
        check_status=check_status,
        start_time=start_time,
        end_time=end_time,
        reviewed=reviewed,
        page=page,
        page_size=page_size
    )

    records, total = services.HealthRecordService.get_records(db, filters)

    return {
        "code": 0,
        "message": "success",
        "data": {
            "records": records,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    }


@app.get("/api/health-records/{record_id}", response_model=schemas.HealthRecordResponse)
def get_health_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.HealthRecord).filter(
        models.HealthRecord.id == record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.post("/api/health-records/{record_id}/review", response_model=schemas.HealthRecordResponse)
def review_health_record(
    record_id: int,
    review_data: schemas.HealthRecordReview,
    db: Session = Depends(get_db)
):
    record = services.HealthRecordService.review_record(db, record_id, review_data)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.post("/api/health-records/{record_id}/confirm-recovery", response_model=schemas.HealthRecordResponse)
def confirm_recovery(
    record_id: int,
    confirm_data: schemas.HealthRecordConfirmRecovery,
    db: Session = Depends(get_db)
):
    record = services.HealthRecordService.confirm_recovery(db, record_id, confirm_data)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.get("/api/health-records/export")
def export_health_records(
    service_id: Optional[int] = None,
    health_status: Optional[models.HealthStatus] = None,
    check_status: Optional[models.CheckStatus] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    reviewed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    filters = schemas.FilterParams(
        service_id=service_id,
        health_status=health_status,
        check_status=check_status,
        start_time=start_time,
        end_time=end_time,
        reviewed=reviewed,
        page=1,
        page_size=10000
    )

    records, _ = services.HealthRecordService.get_records(db, filters)

    data = []
    for record in records:
        data.append({
            "ID": record.id,
            "服务名称": record.service.name,
            "检查时间": record.check_time.strftime("%Y-%m-%d %H:%M:%S"),
            "健康状态": record.health_status.value,
            "检查状态": record.check_status.value,
            "故障等级": record.fault_level or "",
            "是否已复核": "是" if record.reviewed else "否",
            "复核人": record.reviewed_by or "",
            "复核时间": record.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if record.reviewed_at else "",
            "是否已恢复确认": "是" if record.recovery_confirmed else "否",
            "错误详情": record.error_details or ""
        })

    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="健康巡检记录")
    
    output.seek(0)

    filename = f"健康巡检记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/duty-reports", response_model=schemas.DutyReportResponse)
def create_duty_report(
    report: schemas.DutyReportCreate,
    db: Session = Depends(get_db)
):
    return services.DutyReportCRUD.create_report(db, report)


@app.get("/api/duty-reports", response_model=list[schemas.DutyReportResponse])
def get_duty_reports(
    record_id: Optional[int] = None,
    handle_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.DutyReport)
    if record_id:
        query = query.filter(models.DutyReport.record_id == record_id)
    if handle_status:
        query = query.filter(models.DutyReport.handle_status == handle_status)
    return query.order_by(models.DutyReport.report_time.desc()).offset(skip).limit(limit).all()


@app.post("/api/duty-reports/{report_id}/handle", response_model=schemas.DutyReportResponse)
def handle_duty_report(
    report_id: int,
    handle_data: schemas.DutyReportHandle,
    db: Session = Depends(get_db)
):
    report = services.DutyReportCRUD.handle_report(db, report_id, handle_data)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@app.get("/api/statistics")
def get_statistics(db: Session = Depends(get_db)):
    total_services = db.query(models.Service).count()
    
    from sqlalchemy import func

    status_stats = db.query(
        models.HealthRecord.health_status,
        func.count(models.HealthRecord.id)
    ).group_by(models.HealthRecord.health_status).all()

    check_status_stats = db.query(
        models.HealthRecord.check_status,
        func.count(models.HealthRecord.id)
    ).group_by(models.HealthRecord.check_status).all()

    pending_review = db.query(models.HealthRecord).filter(
        models.HealthRecord.check_status == models.CheckStatus.PENDING_REVIEW
    ).count()

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total_services": total_services,
            "health_status_stats": {s.value: c for s, c in status_stats},
            "check_status_stats": {s.value: c for s, c in check_status_stats},
            "pending_review_count": pending_review
        }
    }
