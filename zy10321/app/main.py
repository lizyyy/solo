from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from app.database import engine, Base, get_db
from app.models import (
    ServiceGroup, FreezeCalendar, ChangeOrder, ExceptionRequest,
    Approver, BlockLog, FreezeStatus, ChangeStatus, ExceptionStatus
)
from app import schemas
from app.services import FreezeCalendarService, ChangeOrderService, ExceptionService, BlockLogService

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="变更冻结日历 API",
    description="集中式变更冻结管理，拦截非法变更，管理例外审批",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": str(exc), "code": "INTERNAL_ERROR", "details": None}
    )


@app.post("/api/v1/service-groups/", response_model=schemas.ServiceGroup, status_code=status.HTTP_201_CREATED)
def create_service_group(group: schemas.ServiceGroupCreate, db: Session = Depends(get_db)):
    existing = db.query(ServiceGroup).filter(ServiceGroup.name == group.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "Service group already exists", "code": "DUPLICATE_GROUP", "details": {"name": group.name}}
        )
    db_group = ServiceGroup(**group.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


@app.get("/api/v1/service-groups/", response_model=List[schemas.ServiceGroup])
def list_service_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ServiceGroup).offset(skip).limit(limit).all()


@app.post("/api/v1/freeze-calendars/", response_model=schemas.FreezeCalendar, status_code=status.HTTP_201_CREATED)
def create_freeze_calendar(freeze: schemas.FreezeCalendarCreate, db: Session = Depends(get_db)):
    if freeze.start_time >= freeze.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Start time must be before end time", "code": "INVALID_TIME_RANGE", "details": None}
        )
    db_freeze = FreezeCalendar(**freeze.model_dump())
    db.add(db_freeze)
    db.commit()
    db.refresh(db_freeze)
    return db_freeze


@app.get("/api/v1/freeze-calendars/", response_model=List[schemas.FreezeCalendar])
def list_freeze_calendars(
    service_group_id: Optional[int] = None,
    status: Optional[FreezeStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(FreezeCalendar)
    if service_group_id:
        query = query.filter(FreezeCalendar.service_group_id == service_group_id)
    if status:
        query = query.filter(FreezeCalendar.status == status)
    return query.offset(skip).limit(limit).all()


@app.get("/api/v1/freeze-calendars/match", response_model=List[schemas.FreezeCalendar])
def match_freezes(service_group_id: int, planned_time: datetime, db: Session = Depends(get_db)):
    return FreezeCalendarService.match_freezes(db, service_group_id, planned_time)


@app.patch("/api/v1/freeze-calendars/{freeze_id}/status", response_model=schemas.FreezeCalendar)
def update_freeze_status(freeze_id: int, new_status: FreezeStatus, db: Session = Depends(get_db)):
    freeze = db.query(FreezeCalendar).filter(FreezeCalendar.id == freeze_id).first()
    if not freeze:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Freeze calendar not found", "code": "NOT_FOUND", "details": {"freeze_id": freeze_id}}
        )
    freeze.status = new_status
    db.commit()
    db.refresh(freeze)
    return freeze


@app.post("/api/v1/approvers/", response_model=schemas.Approver, status_code=status.HTTP_201_CREATED)
def create_approver(approver: schemas.ApproverCreate, db: Session = Depends(get_db)):
    existing = db.query(Approver).filter(Approver.user_id == approver.user_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "Approver already exists", "code": "DUPLICATE_APPROVER", "details": {"user_id": approver.user_id}}
        )
    db_approver = Approver(**approver.model_dump())
    db.add(db_approver)
    db.commit()
    db.refresh(db_approver)
    return db_approver


@app.get("/api/v1/approvers/", response_model=List[schemas.Approver])
def list_approvers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Approver).offset(skip).limit(limit).all()


@app.post("/api/v1/change-orders/", response_model=schemas.ChangeOrder, status_code=status.HTTP_201_CREATED)
def create_change_order(change: schemas.ChangeOrderCreate, db: Session = Depends(get_db)):
    existing_change = db.query(ChangeOrder).filter(ChangeOrder.change_id == change.change_id).first()
    if existing_change:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "Change ID already exists", "code": "DUPLICATE_CHANGE", "details": {"change_id": change.change_id}}
        )
    
    db_change, is_new = ChangeOrderService.create_change(db, change)
    if not is_new:
        return db_change
    
    validation = FreezeCalendarService.validate_change(db, db_change)
    db_change.status = validation.status
    db.commit()
    db.refresh(db_change)
    return db_change


@app.get("/api/v1/change-orders/", response_model=List[schemas.ChangeOrder])
def list_change_orders(
    service_group_id: Optional[int] = None,
    status: Optional[ChangeStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ChangeOrder)
    if service_group_id:
        query = query.filter(ChangeOrder.service_group_id == service_group_id)
    if status:
        query = query.filter(ChangeOrder.status == status)
    return query.offset(skip).limit(limit).all()


@app.get("/api/v1/change-orders/{change_id}", response_model=schemas.ChangeOrder)
def get_change_order(change_id: int, db: Session = Depends(get_db)):
    change = db.query(ChangeOrder).filter(ChangeOrder.id == change_id).first()
    if not change:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Change order not found", "code": "NOT_FOUND", "details": {"change_id": change_id}}
        )
    return change


@app.post("/api/v1/change-orders/{change_id}/validate", response_model=schemas.ValidationResult)
def validate_change(change_id: int, db: Session = Depends(get_db)):
    change = db.query(ChangeOrder).filter(ChangeOrder.id == change_id).first()
    if not change:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Change order not found", "code": "NOT_FOUND", "details": {"change_id": change_id}}
        )
    return FreezeCalendarService.validate_change(db, change)


@app.post("/api/v1/exception-requests/", response_model=schemas.ExceptionRequest, status_code=status.HTTP_201_CREATED)
def create_exception_request(exception: schemas.ExceptionRequestCreate, db: Session = Depends(get_db)):
    existing = db.query(ExceptionRequest).filter(ExceptionRequest.request_id == exception.request_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "Exception request ID already exists", "code": "DUPLICATE_REQUEST", "details": {"request_id": exception.request_id}}
        )
    
    change = db.query(ChangeOrder).filter(ChangeOrder.id == exception.change_id).first()
    if not change:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Change order not found", "code": "NOT_FOUND", "details": {"change_id": exception.change_id}}
        )
    
    freeze = db.query(FreezeCalendar).filter(FreezeCalendar.id == exception.freeze_id).first()
    if not freeze:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Freeze calendar not found", "code": "NOT_FOUND", "details": {"freeze_id": exception.freeze_id}}
        )
    
    db_exception = ExceptionRequest(**exception.model_dump())
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    return db_exception


@app.get("/api/v1/exception-requests/", response_model=List[schemas.ExceptionRequest])
def list_exception_requests(
    change_id: Optional[int] = None,
    status: Optional[ExceptionStatus] = None,
    is_emergency: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ExceptionRequest)
    if change_id:
        query = query.filter(ExceptionRequest.change_id == change_id)
    if status:
        query = query.filter(ExceptionRequest.status == status)
    if is_emergency is not None:
        query = query.filter(ExceptionRequest.is_emergency == is_emergency)
    return query.offset(skip).limit(limit).all()


@app.patch("/api/v1/exception-requests/{exception_id}/approve", response_model=schemas.ExceptionRequest)
def approve_exception(exception_id: int, approval: schemas.ExceptionApprove, db: Session = Depends(get_db)):
    exception = ExceptionService.approve_exception(db, exception_id, approval.approver, approval.status)
    if not exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Exception request not found", "code": "NOT_FOUND", "details": {"exception_id": exception_id}}
        )
    
    if approval.status == ExceptionStatus.APPROVED:
        change = db.query(ChangeOrder).filter(ChangeOrder.id == exception.change_id).first()
        if change:
            FreezeCalendarService.validate_change(db, change)
    
    return exception


@app.get("/api/v1/block-logs/", response_model=List[schemas.BlockLog])
def list_block_logs(
    change_id: Optional[int] = None,
    service_group_id: Optional[int] = None,
    resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(BlockLog)
    if change_id:
        query = query.filter(BlockLog.change_id == change_id)
    if service_group_id:
        query = query.join(ChangeOrder).filter(ChangeOrder.service_group_id == service_group_id)
    if resolved is not None:
        query = query.filter(BlockLog.resolved == resolved)
    return query.offset(skip).limit(limit).all()


@app.patch("/api/v1/block-logs/{log_id}/resolve", response_model=schemas.BlockLog)
def resolve_block_log(log_id: int, resolved_by: str, db: Session = Depends(get_db)):
    log = BlockLogService.resolve_log(db, log_id, resolved_by)
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Block log not found", "code": "NOT_FOUND", "details": {"log_id": log_id}}
        )
    return log


@app.get("/api/v1/block-logs/export", response_model=List[schemas.BlockLog])
def export_block_logs(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    service_group_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return BlockLogService.export_logs(db, start_time, end_time, service_group_id)
