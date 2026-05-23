from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import pandas as pd
import os
from app.database import engine, get_db, Base
from app import models, schemas, crud

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="实验室仪器预约 API",
    description="提供实验室高价仪器预约管理功能，包括时段锁定、风险申报、超时处罚、取消释放和报告导出",
    version="1.0.0"
)


def log_business_exception(request: Request, db: Session, exc: Exception, raw_body: dict = None):
    try:
        if raw_body is None:
            raw_body = {}
        raw_input = json.dumps({
            "method": request.method,
            "url": str(request.url),
            "body": raw_body,
            "headers": dict(request.headers)
        }, ensure_ascii=False, default=str)
    except:
        raw_input = str(request.url)
    
    exception_log = schemas.ExceptionLogCreate(
        endpoint=str(request.url.path),
        raw_input=raw_input,
        error_type=type(exc).__name__,
        error_message=str(exc)
    )
    crud.log_exception(db, exception_log)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    db = next(get_db())
    try:
        body = await request.body()
        raw_input = json.dumps({
            "method": request.method,
            "url": str(request.url),
            "body": body.decode() if body else None,
            "headers": dict(request.headers)
        }, ensure_ascii=False)
    except:
        raw_input = str(request.url)
    
    exception_log = schemas.ExceptionLogCreate(
        endpoint=str(request.url.path),
        raw_input=raw_input,
        error_type=type(exc).__name__,
        error_message=str(exc)
    )
    crud.log_exception(db, exception_log)
    raise exc


@app.post("/groups/", response_model=schemas.ResearchGroup, tags=["课题组"])
def create_group(request: Request, group: schemas.ResearchGroupCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_research_group(db, group)
    except ValueError as e:
        log_business_exception(request, db, e, group.model_dump())
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/groups/", response_model=list[schemas.ResearchGroup], tags=["课题组"])
def read_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_research_groups(db, skip=skip, limit=limit)


@app.get("/groups/{group_id}", response_model=schemas.ResearchGroup, tags=["课题组"])
def read_group(group_id: int, db: Session = Depends(get_db)):
    db_group = crud.get_research_group(db, group_id)
    if db_group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return db_group


@app.post("/instruments/", response_model=schemas.Instrument, tags=["仪器"])
def create_instrument(request: Request, instrument: schemas.InstrumentCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_instrument(db, instrument)
    except ValueError as e:
        log_business_exception(request, db, e, instrument.model_dump())
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/instruments/", response_model=list[schemas.Instrument], tags=["仪器"])
def read_instruments(skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)):
    return crud.get_instruments(db, skip=skip, limit=limit, status=status)


@app.get("/instruments/{instrument_id}", response_model=schemas.Instrument, tags=["仪器"])
def read_instrument(instrument_id: int, db: Session = Depends(get_db)):
    db_instrument = crud.get_instrument(db, instrument_id)
    if db_instrument is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return db_instrument


@app.post("/reservations/", response_model=schemas.Reservation, tags=["预约"])
def create_reservation(request: Request, reservation: schemas.ReservationCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_reservation(db, reservation)
    except ValueError as e:
        log_business_exception(request, db, e, reservation.model_dump())
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/reservations/", response_model=list[schemas.Reservation], tags=["预约"])
def read_reservations(
    skip: int = 0, 
    limit: int = 100, 
    instrument_id: int = None, 
    group_id: int = None, 
    status: str = None,
    db: Session = Depends(get_db)
):
    return crud.get_reservations(db, skip=skip, limit=limit, instrument_id=instrument_id, group_id=group_id, status=status)


@app.get("/reservations/{reservation_id}", response_model=schemas.Reservation, tags=["预约"])
def read_reservation(reservation_id: int, db: Session = Depends(get_db)):
    db_reservation = crud.get_reservation(db, reservation_id)
    if db_reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return db_reservation


@app.put("/reservations/{reservation_id}/status", response_model=schemas.Reservation, tags=["预约"])
def update_reservation_status(request: Request, reservation_id: int, new_status: str, db: Session = Depends(get_db)):
    try:
        return crud.update_reservation_status(db, reservation_id, new_status)
    except ValueError as e:
        log_business_exception(request, db, e, {"reservation_id": reservation_id, "new_status": new_status})
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/sample-risks/", response_model=schemas.SampleRisk, tags=["样本风险"])
def create_sample_risk(request: Request, risk: schemas.SampleRiskCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_sample_risk(db, risk)
    except ValueError as e:
        log_business_exception(request, db, e, risk.model_dump())
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/sample-risks/{risk_id}/approve", response_model=schemas.SampleRisk, tags=["样本风险"])
def approve_sample_risk(request: Request, risk_id: int, approval: schemas.SampleRiskApprove, db: Session = Depends(get_db)):
    try:
        return crud.approve_sample_risk(db, risk_id, approval)
    except ValueError as e:
        log_business_exception(request, db, e, {"risk_id": risk_id, **approval.model_dump()})
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/sample-risks/", response_model=list[schemas.SampleRisk], tags=["样本风险"])
def read_sample_risks(skip: int = 0, limit: int = 100, reservation_id: int = None, db: Session = Depends(get_db)):
    return crud.get_sample_risks(db, skip=skip, limit=limit, reservation_id=reservation_id)


@app.post("/cancellations/", response_model=schemas.CancellationRecord, tags=["取消记录"])
def cancel_reservation(request: Request, cancellation: schemas.CancellationRecordCreate, db: Session = Depends(get_db)):
    try:
        return crud.cancel_reservation(db, cancellation)
    except ValueError as e:
        log_business_exception(request, db, e, cancellation.model_dump())
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/cancellations/", response_model=list[schemas.CancellationRecord], tags=["取消记录"])
def read_cancellations(skip: int = 0, limit: int = 100, reservation_id: int = None, db: Session = Depends(get_db)):
    return crud.get_cancellation_records(db, skip=skip, limit=limit, reservation_id=reservation_id)


@app.post("/usage-reports/", response_model=schemas.UsageReport, tags=["使用报告"])
def create_usage_report(request: Request, report: schemas.UsageReportCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_usage_report(db, report)
    except ValueError as e:
        log_business_exception(request, db, e, report.model_dump())
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/usage-reports/", response_model=list[schemas.UsageReport], tags=["使用报告"])
def read_usage_reports(
    skip: int = 0, 
    limit: int = 100, 
    instrument_id: int = None, 
    group_id: int = None,
    db: Session = Depends(get_db)
):
    return crud.get_usage_reports(db, skip=skip, limit=limit, instrument_id=instrument_id, group_id=group_id)


@app.post("/exceptions/", response_model=schemas.ExceptionLog, tags=["异常处理"])
def create_exception_log(exception_log: schemas.ExceptionLogCreate, db: Session = Depends(get_db)):
    return crud.log_exception(db, exception_log)


@app.put("/exceptions/{exception_id}/handle", response_model=schemas.ExceptionLog, tags=["异常处理"])
def handle_exception_endpoint(request: Request, exception_id: int, handling: schemas.ExceptionLogHandle, db: Session = Depends(get_db)):
    try:
        return crud.handle_exception(db, exception_id, handling)
    except ValueError as e:
        log_business_exception(request, db, e, {"exception_id": exception_id, **handling.model_dump()})
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/exceptions/", response_model=list[schemas.ExceptionLog], tags=["异常处理"])
def read_exceptions(skip: int = 0, limit: int = 100, resolved: bool = None, db: Session = Depends(get_db)):
    return crud.get_exception_logs(db, skip=skip, limit=limit, resolved=resolved)


@app.post("/manual-corrections/", response_model=schemas.Reservation, tags=["人工修正"])
def apply_manual_correction(request: Request, correction: schemas.ManualCorrection, db: Session = Depends(get_db)):
    try:
        return crud.apply_manual_correction(db, correction)
    except ValueError as e:
        log_business_exception(request, db, e, correction.model_dump())
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/export/", tags=["导出"])
def export_data(params: schemas.ExportParams, db: Session = Depends(get_db)):
    reports = crud.get_usage_reports(db, instrument_id=params.instrument_id, group_id=params.group_id)
    
    if params.start_date:
        reports = [r for r in reports if r.submitted_at >= params.start_date]
    if params.end_date:
        reports = [r for r in reports if r.submitted_at <= params.end_date]
    
    data = []
    for r in reports:
        data.append({
            "报告ID": r.id,
            "预约ID": r.reservation_id,
            "仪器ID": r.instrument_id,
            "课题组ID": r.group_id,
            "实际开始时间": r.actual_start_time,
            "实际结束时间": r.actual_end_time,
            "实际使用时长(小时)": r.actual_duration_hours,
            "超时时长(小时)": r.exceeded_hours,
            "超时罚款": r.overtime_penalty,
            "总费用": r.total_cost,
            "发现问题": r.issues_found,
            "样本污染": r.sample_contamination,
            "提交人": r.submitted_by,
            "提交时间": r.submitted_at
        })
    
    df = pd.DataFrame(data)
    filename = f"usage_report_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    if params.export_format == "csv":
        filename += ".csv"
        df.to_csv(filename, index=False, encoding="utf-8-sig")
    else:
        filename += ".xlsx"
        df.to_excel(filename, index=False)
    
    return FileResponse(
        path=filename,
        filename=filename,
        media_type="application/octet-stream"
    )


@app.get("/", tags=["根"])
def root():
    return {
        "message": "实验室仪器预约 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }
