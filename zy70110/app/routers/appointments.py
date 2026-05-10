from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, AppointmentStatus
from app.schemas import (
    AppointmentCreate, AppointmentResponse, AppointmentDetailResponse,
    CheckInRequest, InspectionResultRequest, SkipRequest, SkipRecordResponse,
    LoadingReceiptCreate, LoadingReceiptResponse, ConfirmReceiptRequest,
    ColdStorageBayResponse, InspectionQueueResponse
)
from app.services import (
    create_appointment, check_in_vehicle, process_inspection_result,
    skip_current_appointment, reassign_skipped_appointment,
    start_loading, create_loading_receipt, get_appointment_with_details
)

router = APIRouter(prefix="/appointments", tags=["预约管理"])


@router.post("", response_model=AppointmentResponse)
def create_new_appointment(
    appointment_data: AppointmentCreate,
    db: Session = Depends(get_db)
):
    appointment, lock_error = create_appointment(db, appointment_data)
    return appointment


@router.get("", response_model=List[AppointmentResponse])
def list_appointments(
    status: Optional[AppointmentStatus] = Query(None, description="按状态筛选"),
    scheduled_date: Optional[date] = Query(None, description="按预约日期筛选"),
    db: Session = Depends(get_db)
):
    query = db.query(Appointment)
    if status:
        query = query.filter(Appointment.status == status)
    if scheduled_date:
        query = query.filter(Appointment.scheduled_date == scheduled_date)
    return query.order_by(Appointment.created_at.desc()).all()


@router.get("/{appointment_id}", response_model=AppointmentDetailResponse)
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    details = get_appointment_with_details(db, appointment_id)
    
    response_data = AppointmentResponse.model_validate(details["appointment"]).model_dump()
    response_data["storage_bay"] = ColdStorageBayResponse.model_validate(details["storage_bay"]) if details["storage_bay"] else None
    response_data["queue_position"] = details["queue_position"]
    response_data["expected_wait_minutes"] = details["expected_wait_minutes"]
    
    return AppointmentDetailResponse(**response_data)


@router.post("/check-in", response_model=AppointmentResponse)
def vehicle_check_in(request: CheckInRequest, db: Session = Depends(get_db)):
    return check_in_vehicle(db, request.appointment_no)


@router.post("/{appointment_id}/inspection-result", response_model=InspectionQueueResponse)
def submit_inspection_result(
    appointment_id: int,
    result_request: InspectionResultRequest,
    db: Session = Depends(get_db)
):
    queue_record = process_inspection_result(db, appointment_id, result_request)
    return InspectionQueueResponse(
        id=queue_record.id,
        appointment_id=queue_record.appointment_id,
        inspection_window_id=queue_record.inspection_window_id,
        window_code=queue_record.inspection_window.window_code,
        queue_number=queue_record.queue_number,
        queue_date=queue_record.queue_date,
        status=queue_record.status,
        checked_in_time=queue_record.checked_in_time,
        inspection_start_time=queue_record.inspection_start_time,
        inspection_end_time=queue_record.inspection_end_time,
        expected_wait_minutes=queue_record.expected_wait_minutes,
        actual_wait_minutes=queue_record.actual_wait_minutes,
        inspector_name=queue_record.inspector_name,
        inspection_notes=queue_record.inspection_notes
    )


@router.post("/{appointment_id}/skip", response_model=SkipRecordResponse)
def skip_appointment(
    appointment_id: int,
    skip_request: SkipRequest,
    db: Session = Depends(get_db)
):
    return skip_current_appointment(db, appointment_id, skip_request)


@router.post("/skip-records/{skip_record_id}/reassign", response_model=InspectionQueueResponse)
def reassign_skipped(skip_record_id: int, db: Session = Depends(get_db)):
    queue_record = reassign_skipped_appointment(db, skip_record_id)
    return InspectionQueueResponse(
        id=queue_record.id,
        appointment_id=queue_record.appointment_id,
        inspection_window_id=queue_record.inspection_window_id,
        window_code=queue_record.inspection_window.window_code,
        queue_number=queue_record.queue_number,
        queue_date=queue_record.queue_date,
        status=queue_record.status,
        checked_in_time=queue_record.checked_in_time,
        inspection_start_time=queue_record.inspection_start_time,
        inspection_end_time=queue_record.inspection_end_time,
        expected_wait_minutes=queue_record.expected_wait_minutes,
        actual_wait_minutes=queue_record.actual_wait_minutes,
        inspector_name=queue_record.inspector_name,
        inspection_notes=queue_record.inspection_notes
    )


@router.post("/{appointment_id}/start-loading", response_model=AppointmentResponse)
def begin_loading(appointment_id: int, db: Session = Depends(get_db)):
    return start_loading(db, appointment_id)


@router.post("/{appointment_id}/loading-receipt", response_model=LoadingReceiptResponse)
def submit_loading_receipt(
    appointment_id: int,
    receipt_data: LoadingReceiptCreate,
    db: Session = Depends(get_db)
):
    receipt = create_loading_receipt(db, appointment_id, receipt_data)
    return LoadingReceiptResponse(
        id=receipt.id,
        appointment_id=receipt.appointment_id,
        receipt_no=receipt.receipt_no,
        storage_bay_id=receipt.storage_bay_id,
        bay_code=receipt.appointment.storage_bay.bay_code if receipt.appointment and receipt.appointment.storage_bay else "",
        loading_start_time=receipt.loading_start_time,
        loading_end_time=receipt.loading_end_time,
        actual_quantity=receipt.actual_quantity,
        actual_volume=receipt.actual_volume,
        temperature_reading=receipt.temperature_reading,
        handler_name=receipt.handler_name,
        acceptance_status=receipt.acceptance_status,
        discrepancy_notes=receipt.discrepancy_notes,
        customer_confirmation=receipt.customer_confirmation,
        confirmed_by=receipt.confirmed_by,
        confirmed_at=receipt.confirmed_at,
        created_at=receipt.created_at
    )


@router.post("/{appointment_id}/confirm-receipt", response_model=LoadingReceiptResponse)
def confirm_loading_receipt(
    appointment_id: int,
    confirm_request: ConfirmReceiptRequest,
    db: Session = Depends(get_db)
):
    from datetime import datetime
    from app.models import LoadingReceipt
    
    receipt = db.query(LoadingReceipt).filter(
        LoadingReceipt.appointment_id == appointment_id
    ).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="装卸回执不存在")
    
    receipt.customer_confirmation = True
    receipt.confirmed_by = confirm_request.confirmed_by
    receipt.confirmed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(receipt)
    
    return LoadingReceiptResponse(
        id=receipt.id,
        appointment_id=receipt.appointment_id,
        receipt_no=receipt.receipt_no,
        storage_bay_id=receipt.storage_bay_id,
        bay_code=receipt.appointment.storage_bay.bay_code if receipt.appointment and receipt.appointment.storage_bay else "",
        loading_start_time=receipt.loading_start_time,
        loading_end_time=receipt.loading_end_time,
        actual_quantity=receipt.actual_quantity,
        actual_volume=receipt.actual_volume,
        temperature_reading=receipt.temperature_reading,
        handler_name=receipt.handler_name,
        acceptance_status=receipt.acceptance_status,
        discrepancy_notes=receipt.discrepancy_notes,
        customer_confirmation=receipt.customer_confirmation,
        confirmed_by=receipt.confirmed_by,
        confirmed_at=receipt.confirmed_at,
        created_at=receipt.created_at
    )
