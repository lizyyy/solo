from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Optional
import io
import csv

from database import get_db, init_db
import schemas
import services
import database as models

app = FastAPI(
    title="养老机构药盒发放 API",
    description="养老机构药盒发放管理系统 - 医嘱版本管理、停药拦截、签收审计、争议处理、批量上传、报告导出",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {"message": "养老机构药盒发放 API 服务已启动", "version": "1.0.0"}


@app.get("/elders", response_model=List[schemas.Elder], tags=["老人管理"])
def list_elders(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Elder)
    if is_active is not None:
        query = query.filter(models.Elder.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@app.post("/elders", response_model=schemas.Elder, tags=["老人管理"])
def create_elder(elder: schemas.ElderCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Elder).filter(models.Elder.id_card == elder.id_card).first()
    if existing:
        raise HTTPException(status_code=400, detail="身份证号已存在")
    
    db_elder = models.Elder(**elder.dict())
    db.add(db_elder)
    db.commit()
    db.refresh(db_elder)
    return db_elder


@app.get("/elders/{elder_id}", response_model=schemas.Elder, tags=["老人管理"])
def get_elder(elder_id: int, db: Session = Depends(get_db)):
    elder = db.query(models.Elder).filter(models.Elder.id == elder_id).first()
    if not elder:
        raise HTTPException(status_code=404, detail="老人不存在")
    return elder


@app.put("/elders/{elder_id}", response_model=schemas.Elder, tags=["老人管理"])
def update_elder(elder_id: int, elder: schemas.ElderUpdate, db: Session = Depends(get_db)):
    db_elder = db.query(models.Elder).filter(models.Elder.id == elder_id).first()
    if not db_elder:
        raise HTTPException(status_code=404, detail="老人不存在")
    
    for key, value in elder.dict(exclude_unset=True).items():
        setattr(db_elder, key, value)
    db.commit()
    db.refresh(db_elder)
    return db_elder


@app.post("/prescriptions", response_model=schemas.Prescription, tags=["医嘱管理"])
def create_prescription(prescription: schemas.PrescriptionCreate, db: Session = Depends(get_db)):
    try:
        return services.PrescriptionService.create_prescription(db, prescription)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/prescriptions/elder/{elder_id}/active", response_model=Optional[schemas.Prescription], tags=["医嘱管理"])
def get_active_prescription(elder_id: int, db: Session = Depends(get_db)):
    return services.PrescriptionService.get_active_prescription(db, elder_id)


@app.get("/prescriptions/elder/{elder_id}/versions", response_model=List[schemas.Prescription], tags=["医嘱管理"])
def get_prescription_versions(elder_id: int, db: Session = Depends(get_db)):
    return services.PrescriptionService.get_prescription_versions(db, elder_id)


@app.get("/prescriptions/{prescription_id}", response_model=schemas.Prescription, tags=["医嘱管理"])
def get_prescription(prescription_id: int, db: Session = Depends(get_db)):
    prescription = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="医嘱不存在")
    return prescription


@app.post("/stop-requests", response_model=schemas.StopRequest, tags=["停药管理"])
def create_stop_request(stop_request: schemas.StopRequestCreate, db: Session = Depends(get_db)):
    try:
        return services.StopRequestService.create_stop_request(db, stop_request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/stop-requests/{stop_id}/approve", response_model=schemas.StopRequest, tags=["停药管理"])
def approve_stop_request(
    stop_id: int,
    update: schemas.StopRequestUpdate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return services.StopRequestService.approve_stop_request(db, stop_id, update, operator)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put("/stop-requests/{stop_id}/withdraw", response_model=schemas.StopRequest, tags=["停药管理"])
def withdraw_stop_request(
    stop_id: int,
    operator: str = Query(..., description="操作人"),
    reason: str = Query(..., description="撤回原因"),
    db: Session = Depends(get_db)
):
    try:
        return services.StopRequestService.withdraw_stop_request(db, stop_id, operator, reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/stop-requests/check-interception", tags=["停药管理"])
def check_stop_interception(
    check: schemas.StopInterceptionCheck,
    db: Session = Depends(get_db)
):
    intercepted, stop_request = services.StopRequestService.check_stop_interception(
        db, check.elder_id, check.distribution_date, check.prescription_id
    )
    return {
        "intercepted": intercepted,
        "stop_request": schemas.StopRequest.from_orm(stop_request) if stop_request else None
    }


@app.get("/stop-requests", response_model=List[schemas.StopRequest], tags=["停药管理"])
def list_stop_requests(
    status: Optional[schemas.StopStatus] = None,
    prescription_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.StopRequest)
    if status:
        query = query.filter(models.StopRequest.status == status.value)
    if prescription_id:
        query = query.filter(models.StopRequest.prescription_id == prescription_id)
    return query.order_by(models.StopRequest.created_at.desc()).all()


@app.post("/medicine-boxes", response_model=schemas.MedicineBox, tags=["药盒管理"])
def create_medicine_box(box: schemas.MedicineBoxCreate, db: Session = Depends(get_db)):
    try:
        return services.MedicineBoxService.create_medicine_box(db, box)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/medicine-boxes/{box_id}/status", response_model=schemas.MedicineBox, tags=["药盒管理"])
def transition_status(
    box_id: int,
    new_status: schemas.DistributionStatus,
    operator: str = Query(..., description="操作人"),
    remark: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        return services.MedicineBoxService.transition_status(db, box_id, new_status, operator, remark)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/medicine-boxes/{box_id}/sign", response_model=schemas.MedicineBox, tags=["药盒管理"])
def sign_medicine_box(
    box_id: int,
    signature: schemas.SignatureCreate,
    db: Session = Depends(get_db)
):
    try:
        return services.MedicineBoxService.sign_box(db, box_id, signature)
    except ValueError as e:
        error_msg = str(e)
        if "不存在" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)


@app.put("/medicine-boxes/{box_id}/manual-override", response_model=schemas.MedicineBox, tags=["药盒管理"])
def manual_override(
    box_id: int,
    new_status: schemas.DistributionStatus,
    operator: str = Query(..., description="操作人"),
    reason: str = Query(..., description="改判原因"),
    db: Session = Depends(get_db)
):
    db_box = db.query(models.MedicineBox).filter(models.MedicineBox.id == box_id).first()
    if not db_box:
        raise HTTPException(status_code=404, detail="药盒不存在")
    
    before_data = {
        "status": db_box.status,
        "signed_by": db_box.signed_by,
        "signed_at": str(db_box.signed_at) if db_box.signed_at else None
    }
    after_data = {
        "status": new_status.value,
        "operator": operator,
        "reason": reason
    }
    
    try:
        return services.MedicineBoxService.manual_override(
            db, box_id, new_status, operator, reason, before_data, after_data
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/medicine-boxes", response_model=List[schemas.MedicineBox], tags=["药盒管理"])
def list_medicine_boxes(
    batch_no: Optional[str] = None,
    elder_id: Optional[int] = None,
    status: Optional[schemas.DistributionStatus] = None,
    distribution_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.MedicineBox)
    if batch_no:
        query = query.filter(models.MedicineBox.batch_no == batch_no)
    if elder_id:
        query = query.filter(models.MedicineBox.elder_id == elder_id)
    if status:
        query = query.filter(models.MedicineBox.status == status.value)
    if distribution_date:
        query = query.filter(models.MedicineBox.distribution_date == distribution_date)
    return query.order_by(models.MedicineBox.created_at.desc()).all()


@app.get("/medicine-boxes/{box_id}", response_model=schemas.MedicineBox, tags=["药盒管理"])
def get_medicine_box(box_id: int, db: Session = Depends(get_db)):
    box = db.query(models.MedicineBox).filter(models.MedicineBox.id == box_id).first()
    if not box:
        raise HTTPException(status_code=404, detail="药盒不存在")
    return box


@app.post("/disputes", response_model=schemas.Dispute, tags=["争议处理"])
def create_dispute(dispute: schemas.DisputeCreate, db: Session = Depends(get_db)):
    try:
        return services.DisputeService.create_dispute(db, dispute)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/disputes/{dispute_id}/handle", response_model=schemas.Dispute, tags=["争议处理"])
def handle_dispute(dispute_id: int, handle: schemas.DisputeHandle, db: Session = Depends(get_db)):
    try:
        return services.DisputeService.handle_dispute(db, dispute_id, handle)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/disputes", response_model=List[schemas.Dispute], tags=["争议处理"])
def list_disputes(
    status: Optional[schemas.DisputeStatus] = None,
    medicine_box_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Dispute)
    if status:
        query = query.filter(models.Dispute.status == status.value)
    if medicine_box_id:
        query = query.filter(models.Dispute.medicine_box_id == medicine_box_id)
    return query.order_by(models.Dispute.created_at.desc()).all()


@app.post("/batch-uploads", response_model=schemas.BatchUpload, tags=["批量管理"])
def create_batch_upload(upload: schemas.BatchUploadCreate, db: Session = Depends(get_db)):
    try:
        return services.BatchUploadService.create_batch_upload(db, upload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/batch-uploads/{batch_no}/withdraw", response_model=schemas.BatchUpload, tags=["批量管理"])
def withdraw_batch(batch_no: str, withdraw: schemas.BatchUploadWithdraw, db: Session = Depends(get_db)):
    try:
        return services.BatchUploadService.withdraw_batch(db, batch_no, withdraw)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/batch-uploads/{old_batch_no}/resubmit", response_model=schemas.BatchUpload, tags=["批量管理"])
def resubmit_batch(
    old_batch_no: str,
    new_batch_no: str = Query(..., description="新批次号"),
    operator: str = Query(..., description="操作人"),
    remark: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        return services.BatchUploadService.resubmit_batch(db, old_batch_no, new_batch_no, operator, remark)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/batch-uploads", response_model=List[schemas.BatchUpload], tags=["批量管理"])
def list_batch_uploads(
    upload_type: Optional[str] = None,
    is_withdrawn: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.BatchUpload)
    if upload_type:
        query = query.filter(models.BatchUpload.upload_type == upload_type)
    if is_withdrawn is not None:
        query = query.filter(models.BatchUpload.is_withdrawn == is_withdrawn)
    return query.order_by(models.BatchUpload.created_at.desc()).all()


@app.get("/reports/distribution", response_model=List[schemas.MedicineBox], tags=["报告统计"])
def get_distribution_report(
    start_date: date,
    end_date: date,
    elder_id: Optional[int] = None,
    status: Optional[schemas.DistributionStatus] = None,
    batch_no: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = schemas.DistributionReportQuery(
        start_date=start_date,
        end_date=end_date,
        elder_id=elder_id,
        status=status,
        batch_no=batch_no
    )
    return services.ReportService.get_distribution_report(db, query)


@app.get("/reports/distribution/stats", response_model=schemas.DistributionStats, tags=["报告统计"])
def get_distribution_stats(
    start_date: date,
    end_date: date,
    elder_id: Optional[int] = None,
    batch_no: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = schemas.DistributionReportQuery(
        start_date=start_date,
        end_date=end_date,
        elder_id=elder_id,
        batch_no=batch_no
    )
    return services.ReportService.get_distribution_stats(db, query)


@app.get("/reports/distribution/export", tags=["报告统计"])
def export_distribution_report(
    start_date: date,
    end_date: date,
    elder_id: Optional[int] = None,
    status: Optional[schemas.DistributionStatus] = None,
    batch_no: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = schemas.DistributionReportQuery(
        start_date=start_date,
        end_date=end_date,
        elder_id=elder_id,
        status=status,
        batch_no=batch_no
    )
    boxes = services.ReportService.get_distribution_report(db, query)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "批次号", "箱号", "老人ID", "发放日期", "时段",
        "状态", "配药人", "配药时间", "签收人", "签收时间",
        "是否补录", "来源", "备注"
    ])
    
    for box in boxes:
        signature = db.query(models.Signature).filter(
            models.Signature.medicine_box_id == box.id
        ).first()
        
        writer.writerow([
            box.id,
            box.batch_no,
            box.box_no or "",
            box.elder_id,
            str(box.distribution_date),
            box.time_slot or "",
            box.status,
            box.prepared_by or "",
            str(box.prepared_at) if box.prepared_at else "",
            box.signed_by or "",
            str(box.signed_at) if box.signed_at else "",
            "是" if (signature and signature.is_backfilled) else "否",
            box.source or "",
            box.remark or ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=distribution_report_{start_date}_{end_date}.csv"
        }
    )


@app.get("/operation-logs", response_model=List[schemas.OperationLog], tags=["操作日志"])
def get_operation_logs(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    resource_type: Optional[str] = None,
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    return services.ReportService.get_operation_logs(
        db, start_date, end_date, resource_type, batch_no, operator, limit
    )


@app.get("/signatures", response_model=List[schemas.Signature], tags=["签收审计"])
def list_signatures(
    medicine_box_id: Optional[int] = None,
    is_backfilled: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Signature)
    if medicine_box_id:
        query = query.filter(models.Signature.medicine_box_id == medicine_box_id)
    if is_backfilled is not None:
        query = query.filter(models.Signature.is_backfilled == is_backfilled)
    return query.order_by(models.Signature.created_at.desc()).all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
