from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from io import BytesIO
import models, schemas, crud, exporter
from database import engine, get_db
from models import AlarmStatus

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="电梯困人响应 API",
    description="物业电梯困人报警、维保到场、安抚电话全流程管理系统",
    version="1.0.0"
)


@app.get("/")
def read_root():
    return {
        "name": "电梯困人响应 API",
        "version": "1.0.0",
        "docs": "/docs",
        "statuses": [s.value for s in AlarmStatus]
    }


@app.post("/alarms/", response_model=schemas.ElevatorAlarm, summary="创建报警记录")
def create_alarm(alarm: schemas.ElevatorAlarmCreate, db: Session = Depends(get_db)):
    return crud.create_alarm(db=db, alarm=alarm)


@app.get("/alarms/", response_model=schemas.PaginatedResponse, summary="查询报警列表")
def read_alarms(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    status: Optional[str] = Query(None, description="状态过滤"),
    elevator_no: Optional[str] = Query(None, description="电梯编号"),
    is_timeout: Optional[bool] = Query(None, description="是否超时"),
    start_time: Optional[datetime] = Query(None, description="报警开始时间"),
    end_time: Optional[datetime] = Query(None, description="报警结束时间"),
    source: Optional[str] = Query(None, description="报警来源"),
    maintenance_person: Optional[str] = Query(None, description="维保人员"),
    has_merged: Optional[bool] = Query(None, description="是否有合并记录"),
    has_resubmit: Optional[bool] = Query(None, description="是否有重新提交"),
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    alarms, total = crud.get_alarms(
        db, skip=skip, limit=page_size, status=status,
        elevator_no=elevator_no, is_timeout=is_timeout,
        start_time=start_time, end_time=end_time,
        source=source, maintenance_person=maintenance_person,
        has_merged=has_merged, has_resubmit=has_resubmit
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": alarms
    }


@app.get("/alarms/{alarm_id}", response_model=schemas.ElevatorAlarm, summary="获取单条报警详情")
def read_alarm(alarm_id: int, db: Session = Depends(get_db)):
    alarm = crud.get_alarm(db, alarm_id=alarm_id)
    if alarm is None:
        raise HTTPException(status_code=404, detail="报警记录不存在")
    return alarm


@app.put("/alarms/{alarm_id}", response_model=schemas.ElevatorAlarm, summary="修改报警信息（留痕）")
def update_alarm(
    alarm_id: int,
    update_data: schemas.ElevatorAlarmUpdate,
    operator: str = Query(..., description="操作人"),
    change_reason: str = Query(..., description="修改原因"),
    db: Session = Depends(get_db)
):
    try:
        return crud.update_alarm(db, alarm_id, update_data, operator, change_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/dispatch", response_model=schemas.ElevatorAlarm, summary="派单")
def dispatch_alarm(
    alarm_id: int,
    data: schemas.DispatchMaintenance,
    db: Session = Depends(get_db)
):
    try:
        return crud.dispatch_maintenance(db, alarm_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/arrive", response_model=schemas.ElevatorAlarm, summary="到场确认")
def arrive_alarm(
    alarm_id: int,
    data: schemas.ArriveOnSite,
    db: Session = Depends(get_db)
):
    try:
        return crud.arrive_on_site(db, alarm_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/resolve", response_model=schemas.ElevatorAlarm, summary="解决故障并提交审核")
def resolve_alarm(
    alarm_id: int,
    data: schemas.ResolveAlarm,
    db: Session = Depends(get_db)
):
    try:
        return crud.resolve_alarm(db, alarm_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/review", response_model=schemas.ElevatorAlarm, summary="审核（通过/驳回）")
def review_alarm(
    alarm_id: int,
    data: schemas.ReviewAlarm,
    db: Session = Depends(get_db)
):
    try:
        return crud.review_alarm(db, alarm_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/resubmit", response_model=schemas.ElevatorAlarm, summary="被驳回后重新提交")
def resubmit_alarm(
    alarm_id: int,
    data: schemas.ResubmitAlarm,
    db: Session = Depends(get_db)
):
    try:
        return crud.resubmit_alarm(db, alarm_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/cancel", response_model=schemas.ElevatorAlarm, summary="撤回/取消报警")
def cancel_alarm(
    alarm_id: int,
    operator: str = Query(..., description="操作人"),
    reason: str = Query(..., description="取消原因"),
    db: Session = Depends(get_db)
):
    try:
        return crud.cancel_alarm(db, alarm_id, operator, reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/merge", response_model=schemas.ElevatorAlarm, summary="合并重复报警")
def merge_alarm(
    alarm_id: int,
    data: schemas.MergeAlarm,
    db: Session = Depends(get_db)
):
    try:
        return crud.merge_alarm(db, alarm_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/alarms/{alarm_id}/calls", response_model=schemas.CallRecord, summary="添加通话记录")
def add_call(
    alarm_id: int,
    call: schemas.CallRecordCreate,
    db: Session = Depends(get_db)
):
    alarm = crud.get_alarm(db, alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="报警记录不存在")
    return crud.add_call_record(db, alarm_id, call)


@app.get("/alarms/{alarm_id}/calls", response_model=list[schemas.CallRecord], summary="获取通话记录列表")
def get_calls(alarm_id: int, db: Session = Depends(get_db)):
    alarm = crud.get_alarm(db, alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="报警记录不存在")
    return alarm.call_records


@app.get("/alarms/{alarm_id}/status-history", response_model=list[schemas.StatusHistory], summary="获取状态流转历史")
def get_status_history(alarm_id: int, db: Session = Depends(get_db)):
    alarm = crud.get_alarm(db, alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="报警记录不存在")
    return alarm.status_histories


@app.get("/alarms/{alarm_id}/audit-logs", response_model=list[schemas.AuditLog], summary="获取修改日志")
def get_audit_logs(alarm_id: int, db: Session = Depends(get_db)):
    alarm = crud.get_alarm(db, alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="报警记录不存在")
    return alarm.audit_logs


@app.get("/export/alarms", summary="导出报警列表Excel")
def export_alarms(
    status: Optional[str] = Query(None, description="状态过滤"),
    elevator_no: Optional[str] = Query(None, description="电梯编号"),
    is_timeout: Optional[bool] = Query(None, description="是否超时"),
    start_time: Optional[datetime] = Query(None, description="报警开始时间"),
    end_time: Optional[datetime] = Query(None, description="报警结束时间"),
    source: Optional[str] = Query(None, description="报警来源"),
    maintenance_person: Optional[str] = Query(None, description="维保人员"),
    has_merged: Optional[bool] = Query(None, description="是否有合并记录"),
    has_resubmit: Optional[bool] = Query(None, description="是否有重新提交"),
    db: Session = Depends(get_db)
):
    wb = exporter.export_to_excel(
        db, status=status, elevator_no=elevator_no,
        is_timeout=is_timeout, start_time=start_time,
        end_time=end_time, source=source,
        maintenance_person=maintenance_person,
        has_merged=has_merged, has_resubmit=has_resubmit
    )
    
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"elevator_alarms_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/export/alarms/{alarm_id}", summary="导出单条报警详情Excel")
def export_single_alarm(alarm_id: int, db: Session = Depends(get_db)):
    try:
        wb = exporter.export_single_to_excel(db, alarm_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"alarm_detail_{alarm_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
