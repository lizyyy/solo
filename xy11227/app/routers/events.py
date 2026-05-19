import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Device, DeviceEvent, IdempotentRecord, EventStatus, EventType
from app.schemas import DeviceEventCreate, DeviceEventResponse, EventBatchImportRequest, BatchResult
from app.utils import generate_request_key, generate_response_hash, is_abnormal_event, classify_issue_type, mask_sensitive_data
from app.auth import get_current_active_user

router = APIRouter(prefix="/events", tags=["设备事件"])


@router.post("/", response_model=DeviceEventResponse, summary="上报单条设备事件")
async def report_event(
    request: Request,
    event_data: DeviceEventCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    request_key = generate_request_key("/api/v1/events/", event_data.model_dump())
    
    existing_idempotent = db.query(IdempotentRecord).filter(IdempotentRecord.request_key == request_key).first()
    if existing_idempotent:
        event = db.query(DeviceEvent).filter(DeviceEvent.event_id == event_data.event_id).first()
        return event
    
    device = db.query(Device).filter(Device.device_code == event_data.device_code).first()
    if not device:
        device = Device(
            device_code=event_data.device_code,
            device_name=f"设备-{event_data.device_code}",
            is_active=True
        )
        db.add(device)
        db.flush()
    
    is_abnormal = is_abnormal_event(event_data.event_type.value, event_data.error_code)
    status = EventStatus.ABNORMAL if is_abnormal else EventStatus.NORMAL
    
    raw_data_str = json.dumps(event_data.raw_data, ensure_ascii=False) if event_data.raw_data else None
    
    event = DeviceEvent(
        event_id=event_data.event_id,
        device_id=device.id,
        event_type=event_data.event_type,
        event_time=event_data.event_time,
        status=status,
        cabin_number=event_data.cabin_number,
        battery_code=event_data.battery_code,
        user_phone=event_data.user_phone,
        error_code=event_data.error_code,
        error_message=event_data.error_message,
        raw_data=raw_data_str
    )
    
    db.add(event)
    db.commit()
    db.refresh(event)
    
    idempotent_record = IdempotentRecord(
        request_key=request_key,
        endpoint="/api/v1/events/",
        response_hash=generate_response_hash({"id": event.id})
    )
    db.add(idempotent_record)
    db.commit()
    
    return event


@router.post("/batch", response_model=BatchResult, summary="批量上报设备事件")
async def batch_report_events(
    request: Request,
    batch_data: EventBatchImportRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    success_ids = []
    failed_ids = []
    failed_details = []
    
    for event_data in batch_data.events:
        try:
            request_key = generate_request_key("/api/v1/events/batch", event_data.model_dump())
            
            existing_idempotent = db.query(IdempotentRecord).filter(IdempotentRecord.request_key == request_key).first()
            if existing_idempotent:
                event = db.query(DeviceEvent).filter(DeviceEvent.event_id == event_data.event_id).first()
                if event:
                    success_ids.append(event.id)
                    continue
            
            device = db.query(Device).filter(Device.device_code == event_data.device_code).first()
            if not device:
                device = Device(
                    device_code=event_data.device_code,
                    device_name=f"设备-{event_data.device_code}",
                    is_active=True
                )
                db.add(device)
                db.flush()
            
            is_abnormal = is_abnormal_event(event_data.event_type.value, event_data.error_code)
            status = EventStatus.ABNORMAL if is_abnormal else EventStatus.NORMAL
            
            raw_data_str = json.dumps(event_data.raw_data, ensure_ascii=False) if event_data.raw_data else None
            
            event = DeviceEvent(
                event_id=event_data.event_id,
                device_id=device.id,
                event_type=event_data.event_type,
                event_time=event_data.event_time,
                status=status,
                cabin_number=event_data.cabin_number,
                battery_code=event_data.battery_code,
                user_phone=event_data.user_phone,
                error_code=event_data.error_code,
                error_message=event_data.error_message,
                raw_data=raw_data_str
            )
            
            db.add(event)
            db.flush()
            
            idempotent_record = IdempotentRecord(
                request_key=request_key,
                endpoint="/api/v1/events/batch",
                response_hash=generate_response_hash({"event_id": event.event_id})
            )
            db.add(idempotent_record)
            db.flush()
            
            success_ids.append(event.id)
            
        except Exception as e:
            db.rollback()
            failed_ids.append(event_data.event_id)
            failed_details.append({
                "event_id": event_data.event_id,
                "error": str(e)
            })
            continue
    
    db.commit()
    
    return BatchResult(
        success=success_ids,
        failed=failed_ids,
        failed_details=failed_details
    )


@router.get("/abnormal", response_model=List[DeviceEventResponse], summary="获取异常事件列表")
async def get_abnormal_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    events = db.query(DeviceEvent).filter(DeviceEvent.status == EventStatus.ABNORMAL).offset(skip).limit(limit).all()
    return mask_sensitive_data(events)


@router.get("/normal", response_model=List[DeviceEventResponse], summary="获取正常事件列表")
async def get_normal_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    events = db.query(DeviceEvent).filter(DeviceEvent.status == EventStatus.NORMAL).offset(skip).limit(limit).all()
    return events


@router.get("/{event_id}", response_model=DeviceEventResponse, summary="获取事件详情")
async def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    event = db.query(DeviceEvent).filter(DeviceEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return mask_sensitive_data(event)