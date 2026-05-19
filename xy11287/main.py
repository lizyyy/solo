from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import pandas as pd
from io import BytesIO

from database import get_db, engine, Base
from models import PrescriptionStatusEnum, ExceptionTypeEnum, RoleEnum
from schemas import (
    DrugCreate, Drug, InventoryBatchCreate, InventoryBatch,
    ContraindicationCreate, Contraindication, PrescriptionCreate,
    PrescriptionResponse, PrescriptionReviewRequest,
    DispenseRequest, PrescriptionQueryParams, AuditLogQueryParams,
    AuditLog, ReportRow
)
import crud

Base.metadata.create_all(bind=engine)

app = FastAPI(title="宠物医院药房管理系统", version="1.0.0")


@app.post("/drugs/", response_model=Drug, tags=["药品管理"])
def create_drug(drug: DrugCreate, db: Session = Depends(get_db)):
    return crud.create_drug(db=db, drug=drug)


@app.get("/drugs/", response_model=List[Drug], tags=["药品管理"])
def read_drugs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_drugs(db=db, skip=skip, limit=limit)


@app.get("/drugs/{drug_id}", response_model=Drug, tags=["药品管理"])
def read_drug(drug_id: int, db: Session = Depends(get_db)):
    db_drug = crud.get_drug(db=db, drug_id=drug_id)
    if db_drug is None:
        raise HTTPException(status_code=404, detail="药品不存在")
    return db_drug


@app.post("/inventory/batches/", response_model=InventoryBatch, tags=["库存管理"])
def create_inventory_batch(batch: InventoryBatchCreate, db: Session = Depends(get_db)):
    return crud.create_inventory_batch(db=db, batch=batch)


@app.get("/inventory/batches/", response_model=List[InventoryBatch], tags=["库存管理"])
def read_inventory_batches(drug_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_inventory_batches(db=db, drug_id=drug_id)


@app.post("/contraindications/", response_model=Contraindication, tags=["禁忌管理"])
def create_contraindication(contraindication: ContraindicationCreate, db: Session = Depends(get_db)):
    return crud.create_contraindication(db=db, contraindication=contraindication)


@app.post("/prescriptions/", tags=["处方管理"])
def create_prescription(prescription: PrescriptionCreate, idempotency_key: str = Query(...), db: Session = Depends(get_db)):
    cached = crud.check_idempotency(db, idempotency_key, "create_prescription")
    if cached:
        return cached

    result = crud.create_prescription(db=db, prescription=prescription)
    crud.save_idempotency_response(db, idempotency_key, "create_prescription", result)
    return result


@app.get("/prescriptions/{prescription_id}", tags=["处方管理"])
def read_prescription(prescription_id: int, db: Session = Depends(get_db)):
    result = crud.get_prescription_with_validations(db=db, prescription_id=prescription_id)
    if result is None:
        raise HTTPException(status_code=404, detail="处方不存在")
    return result


@app.post("/prescriptions/review", tags=["处方审核"])
def review_prescription(request: PrescriptionReviewRequest, idempotency_key: str = Query(...), db: Session = Depends(get_db)):
    cached = crud.check_idempotency(db, idempotency_key, "review_prescription")
    if cached:
        return cached

    result = crud.review_prescription(db=db, request=request)
    if result is None:
        raise HTTPException(status_code=404, detail="处方不存在")
    crud.save_idempotency_response(db, idempotency_key, "review_prescription", result)
    return result


@app.post("/prescriptions/dispense", tags=["发药管理"])
def dispense_prescription(request: DispenseRequest, idempotency_key: str = Query(...), db: Session = Depends(get_db)):
    cached = crud.check_idempotency(db, idempotency_key, "dispense_prescription")
    if cached:
        return cached

    try:
        result = crud.dispense_prescription(db=db, request=request)
        if result is None:
            raise HTTPException(status_code=404, detail="处方不存在")
        crud.save_idempotency_response(db, idempotency_key, "dispense_prescription", result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/prescriptions/trace/{prescription_id}", tags=["追溯查询"])
def get_prescription_trace(prescription_id: int, db: Session = Depends(get_db)):
    result = crud.get_prescription_trace(db=db, prescription_id=prescription_id)
    if result is None:
        raise HTTPException(status_code=404, detail="处方不存在")
    return result


@app.get("/prescriptions/query/", tags=["追溯查询"])
def query_prescriptions(
    doctor: Optional[str] = None,
    status: Optional[PrescriptionStatusEnum] = None,
    exception_type: Optional[ExceptionTypeEnum] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    params = PrescriptionQueryParams(
        doctor=doctor,
        status=status,
        exception_type=exception_type,
        start_date=start_date,
        end_date=end_date,
        operator=operator
    )
    return crud.query_prescriptions(db=db, params=params)


@app.get("/audit-logs/", response_model=List[AuditLog], tags=["审计日志"])
def get_audit_logs(
    prescription_id: Optional[int] = None,
    operator: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    params = AuditLogQueryParams(
        prescription_id=prescription_id,
        operator=operator,
        action=action,
        start_date=start_date,
        end_date=end_date
    )
    return crud.get_audit_logs(db=db, params=params)


@app.get("/reports/export", tags=["报表导出"])
def export_report(
    doctor: Optional[str] = None,
    status: Optional[PrescriptionStatusEnum] = None,
    exception_type: Optional[ExceptionTypeEnum] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    params = PrescriptionQueryParams(
        doctor=doctor,
        status=status,
        exception_type=exception_type,
        start_date=start_date,
        end_date=end_date,
        operator=operator
    )
    prescriptions = crud.query_prescriptions(db=db, params=params)

    report_data = []
    for prescription in prescriptions:
        for item in prescription.items:
            validations = [v for v in item.validations]
            validation = validations[0] if validations else None
            audit_log = prescription.audit_logs[0] if prescription.audit_logs else None

            report_data.append({
                "处方编号": prescription.prescription_no,
                "患者姓名": prescription.patient_name,
                "物种": prescription.species,
                "体重": prescription.weight,
                "医生": prescription.doctor,
                "状态": prescription.status.value,
                "药品名称": item.drug_name,
                "处方剂量": item.prescribed_dose,
                "剂量单位": item.dose_unit,
                "批号": item.batch_number or "",
                "异常类型": validation.exception_type.value if validation else "",
                "异常信息": validation.message if validation else "",
                "是否拦截": validation.is_blocking if validation else False,
                "操作人": audit_log.operator if audit_log else "",
                "操作时间": audit_log.created_at if audit_log else None,
                "创建时间": prescription.created_at
            })

    df = pd.DataFrame(report_data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='处方报表')
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=prescription_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
    )


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
