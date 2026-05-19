from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import json
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

from database import get_db, init_db, Medicine, Inventory, Prescription, PrescriptionItem, AuditLog, Contraindication
from schemas import (
    MedicineCreate, Medicine as MedicineSchema,
    InventoryCreate, Inventory as InventorySchema,
    PrescriptionCreate, Prescription as PrescriptionSchema,
    PrescriptionItem as PrescriptionItemSchema,
    AuditLogCreate, AuditLog as AuditLogSchema,
    BatchProcessResult, CheckResultItem,
    ContraindicationCreate, Contraindication as ContraindicationSchema,
    ExportRequest
)
from rules_engine import RulesEngine
from security import masker, setup_logging
from config import settings

app = FastAPI(title="宠物医院药房管理系统", version="1.0.0")

logger = setup_logging()


@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("系统启动完成，数据库已初始化")


@app.middleware("http")
async def mask_sensitive_data(request: Request, call_next):
    response = await call_next(request)
    
    if response.headers.get("content-type") == "application/json":
        try:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            data = json.loads(body.decode())
            masked_data = masker.mask_data(data)
            
            return JSONResponse(content=masked_data)
        except Exception:
            pass
    
    return response


@app.post("/api/v1/medicines/", response_model=MedicineSchema, tags=["药品管理"])
def create_medicine(medicine: MedicineCreate, db: Session = Depends(get_db)):
    db_medicine = Medicine(**medicine.model_dump())
    db.add(db_medicine)
    db.commit()
    db.refresh(db_medicine)
    
    audit_log = AuditLog(
        action="CREATE_MEDICINE",
        item_details=f"创建药品: {medicine.name}",
        check_result="passed",
        reason="药品注册成功"
    )
    db.add(audit_log)
    db.commit()
    
    logger.info(f"药品创建成功: {medicine.name}")
    return db_medicine


@app.get("/api/v1/medicines/", response_model=List[MedicineSchema], tags=["药品管理"])
def get_medicines(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    medicines = db.query(Medicine).filter(Medicine.is_active == True).offset(skip).limit(limit).all()
    return medicines


@app.post("/api/v1/inventory/", response_model=InventorySchema, tags=["库存管理"])
def create_inventory(inventory: InventoryCreate, db: Session = Depends(get_db)):
    db_inventory = Inventory(**inventory.model_dump())
    db.add(db_inventory)
    db.commit()
    db.refresh(db_inventory)
    
    logger.info(f"库存添加成功: 批号 {inventory.batch_number}")
    return db_inventory


@app.get("/api/v1/inventory/", response_model=List[InventorySchema], tags=["库存管理"])
def get_inventory(medicine_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Inventory)
    if medicine_id:
        query = query.filter(Inventory.medicine_id == medicine_id)
    return query.offset(skip).limit(limit).all()


@app.post("/api/v1/contraindications/", response_model=ContraindicationSchema, tags=["禁忌管理"])
def create_contraindication(contraindication: ContraindicationCreate, db: Session = Depends(get_db)):
    db_contra = Contraindication(**contraindication.model_dump())
    db.add(db_contra)
    db.commit()
    db.refresh(db_contra)
    logger.info(f"禁忌组合创建成功: 药品 {contraindication.medicine_a_id} & {contraindication.medicine_b_id}")
    return db_contra


@app.post("/api/v1/prescriptions/process", response_model=BatchProcessResult, tags=["处方管理"])
def process_prescription(prescription: PrescriptionCreate, db: Session = Depends(get_db), request: Request = None):
    logger.info(f"开始处理处方: {prescription.prescription_no}")
    logger.info(f"处方详情: {prescription.model_dump()}")
    
    existing = db.query(Prescription).filter(Prescription.prescription_no == prescription.prescription_no).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"处方号 {prescription.prescription_no} 已存在")
    
    db_prescription = Prescription(
        **prescription.model_dump(exclude={"items"}),
        status="processing"
    )
    db.add(db_prescription)
    db.flush()
    
    rules_engine = RulesEngine(db)
    item_results, contra_messages = rules_engine.process_prescription(
        prescription.items,
        prescription.pet_weight_kg
    )
    
    passed_items = [r for r in item_results if r.passed]
    blocked_items = [r for r in item_results if not r.passed]
    
    for idx, item in enumerate(prescription.items):
        result = next((r for r in item_results if r.item_index == idx), None)
        
        db_item = PrescriptionItem(
            prescription_id=db_prescription.id,
            **item.model_dump(),
            check_status=result.check_status if result else "unknown",
            check_reason=result.reason if result else "未执行校验",
            subtotal=(item.unit_price or 0) * item.quantity
        )
        db.add(db_item)
    
    final_status = "approved" if len(blocked_items) == 0 else "review_required"
    db_prescription.status = final_status
    
    total_amount = sum(
        (item.unit_price or 0) * item.quantity
        for item in prescription.items
    )
    db_prescription.total_amount = total_amount
    
    client_ip = request.client.host if request and request.client else None
    audit_log = AuditLog(
        prescription_id=db_prescription.id,
        action="PROCESS_PRESCRIPTION",
        operator_name=prescription.doctor_name,
        item_details=f"处方包含 {len(prescription.items)} 项药品",
        check_result=final_status,
        reason=f"通过: {len(passed_items)} 项, 拦截: {len(blocked_items)} 项{' | ' + ' | '.join(contra_messages) if contra_messages else ''}",
        ip_address=client_ip
    )
    db.add(audit_log)
    
    db.commit()
    db.refresh(db_prescription)
    
    result = BatchProcessResult(
        total=len(item_results),
        success_count=len(passed_items),
        failed_count=len(blocked_items),
        passed_items=passed_items,
        blocked_items=blocked_items,
        prescription_id=db_prescription.id,
        prescription_no=db_prescription.prescription_no
    )
    
    logger.info(f"处方处理完成: {prescription.prescription_no}, 状态: {final_status}")
    return result


@app.post("/api/v1/prescriptions/retry/{prescription_id}", response_model=BatchProcessResult, tags=["处方管理"])
def retry_prescription(prescription_id: int, db: Session = Depends(get_db), request: Request = None):
    db_prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not db_prescription:
        raise HTTPException(status_code=404, detail="处方不存在")
    
    logger.info(f"重试处方: {db_prescription.prescription_no}")
    
    items = db.query(PrescriptionItem).filter(PrescriptionItem.prescription_id == prescription_id).all()
    
    from schemas import PrescriptionItemCreate
    items_for_retry = []
    for item in items:
        if item.check_status == "blocked":
            items_for_retry.append(PrescriptionItemCreate(
                medicine_name=item.medicine_name,
                medicine_id=item.medicine_id,
                batch_number=item.batch_number,
                dosage=item.dosage,
                dosage_unit=item.dosage_unit,
                frequency=item.frequency,
                duration_days=item.duration_days,
                quantity=item.quantity,
                unit_price=item.unit_price
            ))
    
    if not items_for_retry:
        raise HTTPException(status_code=400, detail="没有需要重试的被拦截项目")
    
    rules_engine = RulesEngine(db)
    item_results, contra_messages = rules_engine.process_prescription(
        items_for_retry,
        db_prescription.pet_weight_kg
    )
    
    passed_items = [r for r in item_results if r.passed]
    blocked_items = [r for r in item_results if not r.passed]
    
    for idx, original_item in enumerate(items):
        if original_item.check_status == "blocked":
            result_idx = next(
                (i for i, retry_item in enumerate(items_for_retry)
                 if retry_item.medicine_name == original_item.medicine_name),
                None
            )
            if result_idx is not None and result_idx < len(item_results):
                result = item_results[result_idx]
                original_item.check_status = result.check_status
                original_item.check_reason = result.reason
    
    all_blocked = db.query(PrescriptionItem).filter(
        PrescriptionItem.prescription_id == prescription_id,
        PrescriptionItem.check_status == "blocked"
    ).count()
    
    final_status = "approved" if all_blocked == 0 else "review_required"
    db_prescription.status = final_status
    db_prescription.updated_at = datetime.utcnow()
    
    client_ip = request.client.host if request and request.client else None
    audit_log = AuditLog(
        prescription_id=prescription_id,
        action="RETRY_PRESCRIPTION",
        operator_name=db_prescription.doctor_name,
        item_details=f"重试 {len(items_for_retry)} 项被拦截药品",
        check_result=final_status,
        reason=f"重试后通过: {len(passed_items)} 项, 仍拦截: {len(blocked_items)} 项",
        ip_address=client_ip
    )
    db.add(audit_log)
    
    db.commit()
    db.refresh(db_prescription)
    
    result = BatchProcessResult(
        total=len(item_results),
        success_count=len(passed_items),
        failed_count=len(blocked_items),
        passed_items=passed_items,
        blocked_items=blocked_items,
        prescription_id=db_prescription.id,
        prescription_no=db_prescription.prescription_no
    )
    
    logger.info(f"处方重试完成: {db_prescription.prescription_no}, 状态: {final_status}")
    return result


@app.get("/api/v1/prescriptions/", response_model=List[PrescriptionSchema], tags=["处方管理"])
def get_prescriptions(
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Prescription)
    
    if status:
        query = query.filter(Prescription.status == status)
    if start_date:
        query = query.filter(Prescription.created_at >= start_date)
    if end_date:
        query = query.filter(Prescription.created_at <= end_date)
    
    return query.order_by(Prescription.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/v1/prescriptions/{prescription_id}", response_model=PrescriptionSchema, tags=["处方管理"])
def get_prescription(prescription_id: int, db: Session = Depends(get_db)):
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="处方不存在")
    return prescription


@app.get("/api/v1/audit-logs/", response_model=List[AuditLogSchema], tags=["审计日志"])
def get_audit_logs(
    prescription_id: Optional[int] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    
    if prescription_id:
        query = query.filter(AuditLog.prescription_id == prescription_id)
    if action:
        query = query.filter(AuditLog.action == action)
    
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


@app.post("/api/v1/export/prescriptions", tags=["数据导出"])
def export_prescriptions(export_request: ExportRequest, db: Session = Depends(get_db)):
    query = db.query(Prescription)
    
    if export_request.prescription_ids:
        query = query.filter(Prescription.id.in_(export_request.prescription_ids))
    if export_request.start_date:
        query = query.filter(Prescription.created_at >= export_request.start_date)
    if export_request.end_date:
        query = query.filter(Prescription.created_at <= export_request.end_date)
    
    if not export_request.include_blocked:
        query = query.filter(Prescription.status == "approved")
    
    prescriptions = query.all()
    
    def generate_csv():
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "处方号", "医生", "宠物名称", "宠物体重(kg)",
            "主人姓名", "诊断", "状态", "总金额",
            "药品名称", "批号", "剂量", "单位", "数量",
            "校验状态", "校验原因", "创建时间"
        ])
        
        for presc in prescriptions:
            for item in presc.items:
                writer.writerow([
                    presc.prescription_no,
                    presc.doctor_name,
                    presc.pet_name,
                    presc.pet_weight_kg,
                    masker.mask_field("owner_name", presc.owner_name) if presc.owner_name else "",
                    presc.diagnosis,
                    presc.status,
                    presc.total_amount,
                    item.medicine_name,
                    item.batch_number or "",
                    item.dosage,
                    item.dosage_unit,
                    item.quantity,
                    item.check_status,
                    item.check_reason or "",
                    presc.created_at.strftime("%Y-%m-%d %H:%M:%S")
                ])
        
        output.seek(0)
        return output.getvalue()
    
    csv_content = generate_csv()
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=prescriptions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@app.get("/api/v1/dashboard/stats", tags=["统计"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_prescriptions = db.query(Prescription).count()
    approved_prescriptions = db.query(Prescription).filter(Prescription.status == "approved").count()
    review_required = db.query(Prescription).filter(Prescription.status == "review_required").count()
    
    today = datetime.utcnow().date()
    today_prescriptions = db.query(Prescription).filter(
        Prescription.created_at >= datetime(today.year, today.month, today.day)
    ).count()
    
    total_medicines = db.query(Medicine).filter(Medicine.is_active == True).count()
    
    low_inventory = db.query(Inventory).filter(Inventory.quantity < 10).count()
    
    expiring_soon = db.query(Inventory).filter(
        Inventory.expiry_date <= datetime.utcnow() + timedelta(days=30)
    ).count()
    
    return {
        "prescriptions": {
            "total": total_prescriptions,
            "approved": approved_prescriptions,
            "review_required": review_required,
            "today": today_prescriptions
        },
        "medicines": {
            "total_active": total_medicines
        },
        "inventory": {
            "low_stock": low_inventory,
            "expiring_soon": expiring_soon
        }
    }


@app.get("/", tags=["系统"])
def root():
    return {
        "name": "宠物医院药房管理系统",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "features": [
            "剂量上下限自动校验",
            "批号过期校验",
            "药品禁忌组合校验",
            "库存数量校验",
            "敏感字段自动脱敏",
            "批量处理与重试机制",
            "完整审计留痕",
            "数据导出功能"
        ]
    }
