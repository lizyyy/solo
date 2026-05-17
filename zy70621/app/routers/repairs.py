from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app import crud, schemas, models
from app.database import get_db
from app.models import RepairStatus

router = APIRouter(
    prefix="/repairs",
    tags=["repairs"],
)


@router.post("/", response_model=schemas.RepairOrder)
def create_repair_order(order: schemas.RepairOrderCreate, db: Session = Depends(get_db)):
    return crud.create_repair_order(db=db, order=order)


@router.get("/", response_model=List[schemas.RepairOrder])
def read_repair_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[RepairStatus] = None,
    is_overdue: Optional[bool] = None,
    is_outsourced: Optional[bool] = None,
    building_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    orders = crud.get_repair_orders(
        db, skip=skip, limit=limit,
        status=status, is_overdue=is_overdue,
        is_outsourced=is_outsourced, building_id=building_id
    )
    return orders


@router.get("/overdue", response_model=List[schemas.RepairOrder])
def read_overdue_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_overdue_orders(db, skip=skip, limit=limit)


@router.get("/outsourced", response_model=List[schemas.RepairOrder])
def read_outsourced_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_outsourced_orders(db, skip=skip, limit=limit)


@router.get("/duplicate-reminders", response_model=List[schemas.RepairOrder])
def read_orders_with_duplicate_reminders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_orders_with_duplicate_reminders(db, skip=skip, limit=limit)


@router.get("/{order_id}", response_model=schemas.RepairOrder)
def read_repair_order(order_id: int, db: Session = Depends(get_db)):
    db_order = crud.get_repair_order(db, order_id=order_id)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.get("/no/{order_no}", response_model=schemas.RepairOrder)
def read_repair_order_by_no(order_no: str, db: Session = Depends(get_db)):
    db_order = crud.get_repair_order_by_no(db, order_no=order_no)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.patch("/{order_id}/status", response_model=schemas.RepairOrder)
def update_order_status(
    order_id: int,
    status_update: schemas.StatusUpdate,
    db: Session = Depends(get_db)
):
    db_order = crud.update_repair_order_status(db, order_id=order_id, status_update=status_update)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.put("/{order_id}", response_model=schemas.RepairOrder)
def update_repair_order(
    order_id: int,
    order_update: schemas.RepairOrderUpdate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    db_order = crud.update_repair_order(db, order_id=order_id, order_update=order_update, operator=operator)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.post("/{order_id}/reminders", response_model=schemas.ReminderRecord)
def add_reminder(
    order_id: int,
    reminder: schemas.ReminderCreate,
    db: Session = Depends(get_db)
):
    db_reminder = crud.add_reminder(db, order_id=order_id, reminder=reminder)
    if db_reminder is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_reminder


@router.post("/{order_id}/outsourcing", response_model=schemas.OutsourcingRecord)
def create_outsourcing(
    order_id: int,
    outsourcing: schemas.OutsourcingCreate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    db_outsourcing = crud.create_outsourcing(db, order_id=order_id, outsourcing=outsourcing, operator=operator)
    if db_outsourcing is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_outsourcing


@router.get("/{order_id}/outsourcing", response_model=List[schemas.OutsourcingRecord])
def read_outsourcing_records(order_id: int, db: Session = Depends(get_db)):
    return crud.get_outsourcing_records(db, order_id=order_id)


@router.post("/{order_id}/completion-proof", response_model=schemas.CompletionProof)
def add_completion_proof(
    order_id: int,
    proof: schemas.CompletionProofUpload,
    db: Session = Depends(get_db)
):
    db_proof = crud.add_completion_proof(db, order_id=order_id, proof=proof)
    if db_proof is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_proof


@router.patch("/completion-proof/{proof_id}/verify", response_model=schemas.CompletionProof)
def verify_completion_proof(
    proof_id: int,
    verified_by: str = Query(..., description="审核人"),
    db: Session = Depends(get_db)
):
    db_proof = crud.verify_completion_proof(db, proof_id=proof_id, verified_by=verified_by)
    if db_proof is None:
        raise HTTPException(status_code=404, detail="Completion proof not found")
    return db_proof


@router.post("/{order_id}/merge", response_model=schemas.RepairOrder)
def merge_order(
    order_id: int,
    merge_data: schemas.OrderMerge,
    db: Session = Depends(get_db)
):
    db_order = crud.merge_duplicate_order(
        db, source_order_id=order_id,
        target_order_id=merge_data.target_order_id,
        operator=merge_data.operator,
        reason=merge_data.reason
    )
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.post("/{order_id}/manual-correction", response_model=schemas.RepairOrder)
def manual_correction(
    order_id: int,
    correction: schemas.ManualCorrection,
    db: Session = Depends(get_db)
):
    db_order = crud.manual_correction(db, order_id=order_id, correction=correction)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.post("/{order_id}/close", response_model=schemas.RepairOrder)
def close_order(
    order_id: int,
    operator: str = Query(..., description="操作人"),
    reason: Optional[str] = Query(None, description="关闭原因"),
    db: Session = Depends(get_db)
):
    db_order = crud.close_order(db, order_id=order_id, operator=operator, reason=reason)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.post("/{order_id}/cancel", response_model=schemas.RepairOrder)
def cancel_order(
    order_id: int,
    operator: str = Query(..., description="操作人"),
    reason: Optional[str] = Query(None, description="取消原因"),
    db: Session = Depends(get_db)
):
    db_order = crud.cancel_order(db, order_id=order_id, operator=operator, reason=reason)
    if db_order is None:
        raise HTTPException(status_code=404, detail="Repair order not found")
    return db_order


@router.get("/{order_id}/audit-logs", response_model=List[schemas.AuditLog])
def read_audit_logs(order_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_audit_logs(db, order_id=order_id, skip=skip, limit=limit)
