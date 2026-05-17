from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import schemas, crud, models

router = APIRouter()


@router.post("/records", response_model=schemas.CompensationRecord)
def create_record(record: schemas.CompensationRecordCreate, db: Session = Depends(get_db)):
    db_record, is_new = crud.create_compensation_record(db, record)
    if not is_new:
        raise HTTPException(
            status_code=409,
            detail=f"该支付流水已存在补偿记录: {db_record.record_no}"
        )
    return db_record


@router.get("/records", response_model=List[schemas.CompensationRecord])
def list_records(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    handler_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    records = crud.get_compensation_records(db, skip=skip, limit=limit, status=status,
                                            user_id=user_id, handler_id=handler_id)
    return records


@router.get("/records/{record_no}", response_model=schemas.CompensationRecordDetail)
def get_record(record_no: str, db: Session = Depends(get_db)):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")
    return db_record


@router.put("/records/{record_no}/status", response_model=schemas.CompensationRecord)
def update_status(
    record_no: str,
    new_status: str,
    handler_id: str,
    reason: Optional[str] = None,
    conclusion: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")

    updated_record, error = crud.update_compensation_status(
        db, db_record.id, new_status, handler_id, reason, conclusion
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return updated_record


@router.put("/records/{record_no}/correct", response_model=schemas.CompensationRecord)
def manual_correct(
    record_no: str,
    handler_id: str,
    update_data: schemas.CompensationRecordUpdate,
    db: Session = Depends(get_db)
):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")

    updated_record, error = crud.manual_correct_record(db, db_record.id, update_data, handler_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return updated_record


@router.put("/records/{record_no}/withdraw", response_model=schemas.CompensationRecord)
def withdraw_record(
    record_no: str,
    handler_id: str,
    reason: str,
    db: Session = Depends(get_db)
):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")

    updated_record, error = crud.withdraw_record(db, db_record.id, handler_id, reason)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return updated_record


@router.put("/records/{record_no}/close", response_model=schemas.CompensationRecord)
def close_record(
    record_no: str,
    handler_id: str,
    reason: str,
    db: Session = Depends(get_db)
):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")

    updated_record, error = crud.close_record(db, db_record.id, handler_id, reason)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return updated_record


@router.post("/records/{record_no}/match-order")
def match_order(
    record_no: str,
    handler_id: str,
    db: Session = Depends(get_db)
):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")

    order = crud.match_transaction_to_order(db, db_record.transaction_id)
    if order is None:
        raise HTTPException(status_code=404, detail="支付流水不存在")

    updated_record, error = crud.update_compensation_status(
        db, db_record.id, "ORDER_CREATED", handler_id,
        reason=f"订单补建成功: {order.order_no}"
    )
    if error:
        raise HTTPException(status_code=400, detail=error)

    return {"record": updated_record, "order": order}


@router.post("/records/{record_no}/report", response_model=schemas.CompensationReport)
def export_report(
    record_no: str,
    exported_by: str,
    db: Session = Depends(get_db)
):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")

    report, error = crud.create_compensation_report(db, db_record.id, exported_by)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return report


@router.get("/reports", response_model=List[schemas.CompensationReport])
def list_reports(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_reports(db, skip=skip, limit=limit)


@router.get("/reports/{report_no}", response_model=schemas.CompensationReport)
def get_report(report_no: str, db: Session = Depends(get_db)):
    report = crud.get_report_by_no(db, report_no)
    if report is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@router.get("/records/{record_no}/logs", response_model=List[schemas.OperationLog])
def get_operation_logs(record_no: str, db: Session = Depends(get_db)):
    db_record = crud.get_compensation_record_by_no(db, record_no)
    if db_record is None:
        raise HTTPException(status_code=404, detail="补偿记录不存在")
    return crud.get_operation_logs_by_record(db, db_record.id)
