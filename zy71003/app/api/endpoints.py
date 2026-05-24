from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from .. import schemas, services, models

router = APIRouter(prefix="/api/v1", tags=["battery-thermal"])


@router.post("/temperature/check", response_model=dict)
def check_temperature(request: schemas.TemperatureWindowRequest, db: Session = Depends(get_db)):
    result = services.process_temperature_window(db, request)
    if "error_code" in result and result["error_code"] in ["INVALID_STATUS", "MISSING_DATA"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    return result


@router.post("/recheck", response_model=dict)
def recheck_battery(request: schemas.RecheckRequest, db: Session = Depends(get_db)):
    result = services.process_recheck(db, request)
    if "error_code" in result and result["error_code"] == "INVALID_STATUS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    return result


@router.post("/disposal-report", response_model=schemas.DisposalReport)
def create_report(report: schemas.DisposalReportCreate, db: Session = Depends(get_db)):
    if services.check_idempotent(db, report.business_no, "create_report"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "DUPLICATE_REQUEST",
                "message": "该业务流水号已生成报告"
            }
        )
    return services.create_disposal_report(db, report)


@router.get("/disposal-report/{report_no}/export")
def export_report(report_no: str, db: Session = Depends(get_db)):
    csv_content = services.export_disposal_report(db, report_no)
    if not csv_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "MISSING_DATA", "message": "报告不存在"}
        )
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{report_no}.csv"}
    )


@router.get("/slots/{slot_number}", response_model=schemas.Slot)
def get_slot(slot_number: str, db: Session = Depends(get_db)):
    slot = services.get_slot_status(db, slot_number)
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "MISSING_DATA", "message": "格口不存在"}
        )
    return slot


@router.put("/slots/{slot_number}/status", response_model=schemas.Slot)
def update_slot(slot_number: str, update: schemas.SlotUpdate, db: Session = Depends(get_db)):
    if not update.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "MISSING_DATA", "message": "缺少状态参数"}
        )
    slot = services.update_slot_status(db, slot_number, update.status)
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_STATUS", "message": "状态变更不允许"}
        )
    return slot


@router.get("/operation-logs", response_model=List[schemas.OperationLog])
def get_logs(business_no: Optional[str] = None, slot_number: Optional[str] = None,
             limit: int = 100, db: Session = Depends(get_db)):
    return services.get_operation_logs(db, business_no, slot_number, limit)


@router.post("/slots", response_model=schemas.Slot)
def create_slot(slot: schemas.SlotCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Slot).filter(models.Slot.slot_number == slot.slot_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "DUPLICATE_REQUEST", "message": "格口已存在"}
        )
    db_slot = models.Slot(**slot.model_dump())
    db.add(db_slot)
    db.commit()
    db.refresh(db_slot)
    return db_slot


@router.get("/slots", response_model=List[schemas.Slot])
def list_slots(db: Session = Depends(get_db)):
    return db.query(models.Slot).all()


@router.post("/batch/submit", response_model=dict)
def submit_batch(request: dict, db: Session = Depends(get_db)):
    result = services.submit_batch(db, request)
    if "error_code" in result and result["error_code"] == "DUPLICATE_REQUEST":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=result
        )
    return result


@router.get("/anomalies", response_model=dict)
def get_anomalies(
    status: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    return services.get_anomaly_list(db, status, start_time, end_time, limit, offset)


@router.get("/anomalies/{anomaly_id}", response_model=dict)
def get_anomaly_detail(anomaly_id: int, db: Session = Depends(get_db)):
    result = services.get_anomaly_detail(db, anomaly_id)
    if "error_code" in result and result["error_code"] == "MISSING_DATA":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.post("/anomalies/correct", response_model=dict)
def correct_material(request: dict, db: Session = Depends(get_db)):
    result = services.correct_material(db, request)
    if "error_code" in result and result["error_code"] == "MISSING_DATA":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.post("/anomalies/confirm", response_model=dict)
def confirm_conclusion(request: dict, db: Session = Depends(get_db)):
    result = services.confirm_conclusion(db, request)
    if "error_code" in result and result["error_code"] == "MISSING_DATA":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result
