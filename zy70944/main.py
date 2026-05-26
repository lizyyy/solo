import os
import json
import csv
import io
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from database import engine, Base, get_db, SessionLocal
from models import (
    Owner, RenovationApplication, Inspection,
    DeductionRule, ProcessingRecord, RefundRecord
)
from schemas import (
    OwnerCreate, OwnerResponse,
    RenovationApplicationCreate, RenovationApplicationUpdate, RenovationApplicationResponse,
    InspectionCreate, InspectionUpdate, InspectionResponse,
    DeductionRuleCreate, DeductionRuleResponse,
    ProcessingRecordCreate, ProcessingRecordResponse,
    RefundRecordCreate, RefundRecordUpdate, RefundRecordResponse,
    BatchImportResponse, ExportQuery, ProcessingAction
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="装修申请处理系统",
    description="物业客服装修申请、巡检、扣款规则处理后端服务",
    version="1.0.0"
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_file(file: UploadFile) -> str:
    file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())
    return file_path


def generate_batch_id() -> str:
    return f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"


@app.post("/owners/", response_model=OwnerResponse)
def create_owner(owner: OwnerCreate, db: Session = Depends(get_db)):
    existing = db.query(Owner).filter(Owner.room_number == owner.room_number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"房号 {owner.room_number} 已存在")
    db_owner = Owner(**owner.model_dump())
    db.add(db_owner)
    db.commit()
    db.refresh(db_owner)
    return db_owner


@app.get("/owners/", response_model=List[OwnerResponse])
def list_owners(
    room_number: Optional[str] = None,
    owner_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Owner)
    if room_number:
        query = query.filter(Owner.room_number.contains(room_number))
    if owner_name:
        query = query.filter(Owner.owner_name.contains(owner_name))
    return query.all()


@app.get("/owners/{room_number}", response_model=OwnerResponse)
def get_owner(room_number: str, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.room_number == room_number).first()
    if not owner:
        raise HTTPException(status_code=404, detail=f"房号 {room_number} 不存在")
    return owner


@app.post("/applications/import-csv/", response_model=BatchImportResponse)
async def import_applications_csv(
    file: UploadFile = File(...),
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持 CSV 文件")

    batch_id = batch_id or generate_batch_id()
    file_path = save_file(file)

    success_count = 0
    failed_count = 0
    failed_details = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    room_number = row.get('房号', '').strip()
                    if not room_number:
                        raise ValueError("房号不能为空")

                    owner = db.query(Owner).filter(Owner.room_number == room_number).first()
                    if not owner:
                        owner = Owner(
                            room_number=room_number,
                            owner_name=row.get('业主姓名', row.get('申请人', '未知'))
                        )
                        db.add(owner)
                        db.flush()

                    application = RenovationApplication(
                        batch_id=batch_id,
                        owner_id=owner.id,
                        room_number=room_number,
                        applicant_name=row.get('申请人', row.get('业主姓名', '')),
                        apply_date=row.get('申请日期', ''),
                        renovation_type=row.get('装修类型', ''),
                        contractor=row.get('施工单位', ''),
                        deposit_amount=float(row.get('押金金额', 0) or 0),
                        remark=row.get('备注', ''),
                        source_file=os.path.basename(file_path)
                    )
                    db.add(application)
                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    failed_details.append({"row": row_num, "error": str(e)})

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

    return BatchImportResponse(
        batch_id=batch_id,
        total_count=success_count + failed_count,
        success_count=success_count,
        failed_count=failed_count,
        failed_details=failed_details
    )


@app.post("/applications/", response_model=RenovationApplicationResponse)
def create_application(app: RenovationApplicationCreate, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.room_number == app.room_number).first()
    if not owner:
        owner = Owner(
            room_number=app.room_number,
            owner_name=app.applicant_name or "未知"
        )
        db.add(owner)
        db.flush()

    db_app = RenovationApplication(**app.model_dump(exclude={'owner_id'}), owner_id=owner.id)
    db.add(db_app)
    db.commit()
    db.refresh(db_app)
    return db_app


@app.get("/applications/", response_model=List[RenovationApplicationResponse])
def list_applications(
    room_number: Optional[str] = None,
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RenovationApplication)
    if room_number:
        query = query.filter(RenovationApplication.room_number == room_number)
    if batch_id:
        query = query.filter(RenovationApplication.batch_id == batch_id)
    if status:
        query = query.filter(RenovationApplication.status == status)
    return query.order_by(RenovationApplication.created_at.desc()).all()


@app.get("/applications/{app_id}", response_model=RenovationApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db)):
    app = db.query(RenovationApplication).filter(RenovationApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="申请不存在")
    return app


@app.post("/inspections/import-json/", response_model=BatchImportResponse)
async def import_inspections_json(
    file: UploadFile = File(...),
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="只支持 JSON 文件")

    batch_id = batch_id or generate_batch_id()
    file_path = save_file(file)

    success_count = 0
    failed_count = 0
    failed_details = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        items = data if isinstance(data, list) else data.get('inspections', data.get('records', [data]))

        for idx, item in enumerate(items):
            try:
                room_number = item.get('room_number', item.get('房号', '')).strip()
                if not room_number:
                    raise ValueError("房号不能为空")

                owner = db.query(Owner).filter(Owner.room_number == room_number).first()
                if not owner:
                    owner = Owner(
                        room_number=room_number,
                        owner_name=item.get('owner_name', item.get('业主', '未知'))
                    )
                    db.add(owner)
                    db.flush()

                application = db.query(RenovationApplication).filter(
                    RenovationApplication.room_number == room_number
                ).order_by(RenovationApplication.created_at.desc()).first()

                inspection = Inspection(
                    batch_id=batch_id,
                    owner_id=owner.id,
                    application_id=application.id if application else None,
                    room_number=room_number,
                    inspector=item.get('inspector', item.get('巡检人', '')),
                    inspect_date=item.get('inspect_date', item.get('巡检日期', '')),
                    inspect_result=item.get('inspect_result', item.get('巡检结果', '')),
                    violations=json.dumps(item.get('violations', item.get('违规内容', '')), ensure_ascii=False) if isinstance(item.get('violations'), list) else str(item.get('violations', item.get('违规内容', ''))),
                    rectification_required=item.get('rectification_required', item.get('需整改', False)),
                    remark=item.get('remark', item.get('备注', '')),
                    source_file=os.path.basename(file_path)
                )
                db.add(inspection)
                success_count += 1
            except Exception as e:
                failed_count += 1
                failed_details.append({"index": idx, "error": str(e)})

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

    return BatchImportResponse(
        batch_id=batch_id,
        total_count=success_count + failed_count,
        success_count=success_count,
        failed_count=failed_count,
        failed_details=failed_details
    )


@app.post("/inspections/", response_model=InspectionResponse)
def create_inspection(inspection: InspectionCreate, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.room_number == inspection.room_number).first()
    if not owner:
        owner = Owner(
            room_number=inspection.room_number,
            owner_name="未知"
        )
        db.add(owner)
        db.flush()

    db_inspection = Inspection(**inspection.model_dump(exclude={'owner_id', 'application_id'}), owner_id=owner.id)
    db.add(db_inspection)
    db.commit()
    db.refresh(db_inspection)
    return db_inspection


@app.get("/inspections/", response_model=List[InspectionResponse])
def list_inspections(
    room_number: Optional[str] = None,
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Inspection)
    if room_number:
        query = query.filter(Inspection.room_number == room_number)
    if batch_id:
        query = query.filter(Inspection.batch_id == batch_id)
    if status:
        query = query.filter(Inspection.status == status)
    return query.order_by(Inspection.created_at.desc()).all()


@app.get("/inspections/{inspection_id}", response_model=InspectionResponse)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    return inspection


@app.post("/deduction-rules/import-json/")
async def import_deduction_rules(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="只支持 JSON 文件")

    file_path = save_file(file)
    count = 0

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        items = data if isinstance(data, list) else data.get('rules', data.get('records', [data]))

        for item in items:
            rule_code = item.get('rule_code', item.get('规则编号', '')).strip()
            if not rule_code:
                continue

            existing = db.query(DeductionRule).filter(DeductionRule.rule_code == rule_code).first()
            if existing:
                continue

            rule = DeductionRule(
                rule_code=rule_code,
                rule_name=item.get('rule_name', item.get('规则名称', '')),
                violation_type=item.get('violation_type', item.get('违规类型', '')),
                deduction_amount=float(item.get('deduction_amount', item.get('扣款金额', 0))),
                description=item.get('description', item.get('描述', ''))
            )
            db.add(rule)
            count += 1

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

    return {"imported_count": count}


@app.post("/deduction-rules/", response_model=DeductionRuleResponse)
def create_deduction_rule(rule: DeductionRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(DeductionRule).filter(DeductionRule.rule_code == rule.rule_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"规则编号 {rule.rule_code} 已存在")
    db_rule = DeductionRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@app.get("/deduction-rules/", response_model=List[DeductionRuleResponse])
def list_deduction_rules(
    violation_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DeductionRule)
    if violation_type:
        query = query.filter(DeductionRule.violation_type == violation_type)
    if is_active is not None:
        query = query.filter(DeductionRule.is_active == is_active)
    return query.all()


@app.post("/applications/{app_id}/process/")
def process_application(
    app_id: int,
    action: ProcessingAction,
    db: Session = Depends(get_db)
):
    application = db.query(RenovationApplication).filter(RenovationApplication.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请不存在")

    previous_status = application.status
    new_status = action.action_type

    valid_actions = ["approved", "rejected", "returned", "completed", "pending"]
    status_map = {
        "approved": "approved",
        "rejected": "rejected",
        "returned": "returned_for_revision",
        "completed": "completed",
        "pending": "pending",
        "release": "approved",
        "freeze": "frozen",
        "unfreeze": "unfrozen"
    }

    if action.action_type not in valid_actions and action.action_type not in status_map:
        raise HTTPException(status_code=400, detail=f"无效的操作类型: {action.action_type}")

    final_status = status_map.get(action.action_type, action.action_type)

    application.status = final_status
    application.remark = action.remark or application.remark

    record = ProcessingRecord(
        application_id=app_id,
        room_number=application.room_number,
        action_type=action.action_type,
        previous_status=previous_status,
        new_status=final_status,
        reason=action.reason,
        processor=action.processor,
        remark=action.remark
    )
    db.add(record)

    if action.action_type == "freeze":
        owner = db.query(Owner).filter(Owner.id == application.owner_id).first()
        if owner:
            owner.deposit_frozen = True
            record.new_status = "frozen"

    if action.action_type == "unfreeze":
        owner = db.query(Owner).filter(Owner.id == application.owner_id).first()
        if owner:
            owner.deposit_frozen = False
            record.new_status = "unfrozen"

    db.commit()

    return {
        "message": "处理成功",
        "application_id": app_id,
        "previous_status": previous_status,
        "new_status": final_status,
        "processor": action.processor,
        "processing_time": record.processing_time
    }


@app.post("/inspections/{inspection_id}/process/")
def process_inspection(
    inspection_id: int,
    action: ProcessingAction,
    db: Session = Depends(get_db)
):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")

    previous_status = inspection.status
    new_status = action.action_type

    valid_actions = ["pending", "reviewing", "rectified", "passed", "failed"]
    if action.action_type not in valid_actions:
        raise HTTPException(status_code=400, detail=f"无效的操作类型: {action.action_type}")

    inspection.status = action.action_type
    inspection.remark = action.remark or inspection.remark

    record = ProcessingRecord(
        inspection_id=inspection_id,
        room_number=inspection.room_number,
        action_type=action.action_type,
        previous_status=previous_status,
        new_status=action.action_type,
        reason=action.reason,
        processor=action.processor,
        remark=action.remark
    )
    db.add(record)
    db.commit()

    return {
        "message": "处理成功",
        "inspection_id": inspection_id,
        "previous_status": previous_status,
        "new_status": action.action_type,
        "processor": action.processor,
        "processing_time": record.processing_time
    }


@app.post("/refunds/", response_model=RefundRecordResponse)
def create_refund(refund: RefundRecordCreate, db: Session = Depends(get_db)):
    existing = db.query(RefundRecord).filter(RefundRecord.refund_code == refund.refund_code).first()
    if existing:
        existing.is_duplicate = True
        existing.remark = (existing.remark or "") + f"\n重复退款检测: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        db.commit()
        db.refresh(existing)
        return existing

    db_refund = RefundRecord(**refund.model_dump())
    db.add(db_refund)
    db.commit()
    db.refresh(db_refund)
    return db_refund


@app.put("/refunds/{refund_id}/approve/")
def approve_refund(
    refund_id: int,
    approver: str = Query(...),
    db: Session = Depends(get_db)
):
    refund = db.query(RefundRecord).filter(RefundRecord.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="退款记录不存在")

    if refund.is_duplicate:
        raise HTTPException(status_code=400, detail="检测到重复退款，无法审批通过，请先核实")

    refund.approval_status = "approved"
    refund.approver = approver
    refund.approval_time = datetime.now()
    db.commit()

    return {
        "message": "退款审批通过",
        "refund_id": refund_id,
        "approver": approver,
        "approval_time": refund.approval_time
    }


@app.put("/refunds/{refund_id}/reject/")
def reject_refund(
    refund_id: int,
    approver: str = Query(...),
    reason: str = Query(...),
    db: Session = Depends(get_db)
):
    refund = db.query(RefundRecord).filter(RefundRecord.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="退款记录不存在")

    refund.approval_status = "rejected"
    refund.approver = approver
    refund.approval_time = datetime.now()
    refund.remark = (refund.remark or "") + f"\n驳回原因: {reason}"
    db.commit()

    return {
        "message": "退款已驳回",
        "refund_id": refund_id,
        "approver": approver,
        "reason": reason
    }


@app.get("/refunds/", response_model=List[RefundRecordResponse])
def list_refunds(
    room_number: Optional[str] = None,
    refund_code: Optional[str] = None,
    approval_status: Optional[str] = None,
    related_batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RefundRecord)
    if room_number:
        query = query.filter(RefundRecord.room_number == room_number)
    if refund_code:
        query = query.filter(RefundRecord.refund_code == refund_code)
    if approval_status:
        query = query.filter(RefundRecord.approval_status == approval_status)
    if related_batch_id:
        query = query.filter(RefundRecord.related_batch_id == related_batch_id)
    return query.order_by(RefundRecord.created_at.desc()).all()


@app.get("/processing-records/", response_model=List[ProcessingRecordResponse])
def list_processing_records(
    room_number: Optional[str] = None,
    action_type: Optional[str] = None,
    processor: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ProcessingRecord)
    if room_number:
        query = query.filter(ProcessingRecord.room_number == room_number)
    if action_type:
        query = query.filter(ProcessingRecord.action_type == action_type)
    if processor:
        query = query.filter(ProcessingRecord.processor == processor)
    return query.order_by(ProcessingRecord.processing_time.desc()).all()


@app.get("/applications/{app_id}/history/")
def get_application_history(app_id: int, db: Session = Depends(get_db)):
    application = db.query(RenovationApplication).filter(RenovationApplication.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="申请不存在")

    records = db.query(ProcessingRecord).filter(
        ProcessingRecord.application_id == app_id
    ).order_by(ProcessingRecord.processing_time.asc()).all()

    return {
        "application": RenovationApplicationResponse.model_validate(application),
        "processing_history": [ProcessingRecordResponse.model_validate(r) for r in records],
        "summary": {
            "total_actions": len(records),
            "status_transitions": [
                {"from": r.previous_status, "to": r.new_status, "at": r.processing_time}
                for r in records
            ]
        }
    }


@app.get("/inspections/{inspection_id}/history/")
def get_inspection_history(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")

    records = db.query(ProcessingRecord).filter(
        ProcessingRecord.inspection_id == inspection_id
    ).order_by(ProcessingRecord.processing_time.asc()).all()

    return {
        "inspection": InspectionResponse.model_validate(inspection),
        "processing_history": [ProcessingRecordResponse.model_validate(r) for r in records],
        "summary": {
            "total_actions": len(records),
            "status_transitions": [
                {"from": r.previous_status, "to": r.new_status, "at": r.processing_time}
                for r in records
            ]
        }
    }


@app.get("/export/applications/")
def export_applications(
    room_number: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(RenovationApplication)
    if room_number:
        query = query.filter(RenovationApplication.room_number == room_number)
    if batch_id:
        query = query.filter(RenovationApplication.batch_id == batch_id)
    if status:
        query = query.filter(RenovationApplication.status == status)

    applications = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'ID', '批次号', '房号', '申请人', '申请日期', '装修类型',
        '施工单位', '押金金额', '状态', '备注', '导入文件', '创建时间'
    ])

    for app in applications:
        writer.writerow([
            app.id, app.batch_id, app.room_number, app.applicant_name,
            app.apply_date, app.renovation_type, app.contractor,
            app.deposit_amount, app.status, app.remark,
            app.source_file, app.created_at.strftime('%Y-%m-%d %H:%M:%S')
        ])

    output.seek(0)
    filename = f"applications_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/export/inspections/")
def export_inspections(
    room_number: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Inspection)
    if room_number:
        query = query.filter(Inspection.room_number == room_number)
    if batch_id:
        query = query.filter(Inspection.batch_id == batch_id)
    if status:
        query = query.filter(Inspection.status == status)

    inspections = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'ID', '批次号', '房号', '巡检人', '巡检日期', '巡检结果',
        '违规内容', '需整改', '状态', '备注', '导入文件', '创建时间'
    ])

    for ins in inspections:
        writer.writerow([
            ins.id, ins.batch_id, ins.room_number, ins.inspector,
            ins.inspect_date, ins.inspect_result, ins.violations,
            ins.rectification_required, ins.status, ins.remark,
            ins.source_file, ins.created_at.strftime('%Y-%m-%d %H:%M:%S')
        ])

    output.seek(0)
    filename = f"inspections_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/export/processing-records/")
def export_processing_records(
    room_number: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    processor: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ProcessingRecord)
    if room_number:
        query = query.filter(ProcessingRecord.room_number == room_number)
    if action_type:
        query = query.filter(ProcessingRecord.action_type == action_type)
    if processor:
        query = query.filter(ProcessingRecord.processor == processor)

    records = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'ID', '房号', '操作类型', '原状态', '新状态',
        '原因', '处理人', '处理时间', '备注'
    ])

    for rec in records:
        writer.writerow([
            rec.id, rec.room_number, rec.action_type,
            rec.previous_status, rec.new_status, rec.reason,
            rec.processor, rec.processing_time.strftime('%Y-%m-%d %H:%M:%S'),
            rec.remark
        ])

    output.seek(0)
    filename = f"processing_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/query/by-room/{room_number}")
def query_by_room(room_number: str, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.room_number == room_number).first()
    if not owner:
        raise HTTPException(status_code=404, detail=f"房号 {room_number} 不存在")

    applications = db.query(RenovationApplication).filter(
        RenovationApplication.room_number == room_number
    ).order_by(RenovationApplication.created_at.desc()).all()

    inspections = db.query(Inspection).filter(
        Inspection.room_number == room_number
    ).order_by(Inspection.created_at.desc()).all()

    processing_records = db.query(ProcessingRecord).filter(
        ProcessingRecord.room_number == room_number
    ).order_by(ProcessingRecord.processing_time.desc()).all()

    refunds = db.query(RefundRecord).filter(
        RefundRecord.room_number == room_number
    ).order_by(RefundRecord.created_at.desc()).all()

    return {
        "owner": OwnerResponse.model_validate(owner),
        "applications": [RenovationApplicationResponse.model_validate(a) for a in applications],
        "inspections": [InspectionResponse.model_validate(i) for i in inspections],
        "processing_records": [ProcessingRecordResponse.model_validate(p) for p in processing_records],
        "refunds": [RefundRecordResponse.model_validate(r) for r in refunds],
        "explanation": f"业主 {owner.owner_name}（房号：{room_number}）共 {len(applications)} 条装修申请，{len(inspections)} 次巡检，{len(processing_records)} 条处理记录，{len(refunds)} 条退款记录。押金状态：{'已冻结' if owner.deposit_frozen else '正常'}"
    }


@app.get("/query/by-batch/{batch_id}")
def query_by_batch(batch_id: str, db: Session = Depends(get_db)):
    applications = db.query(RenovationApplication).filter(
        RenovationApplication.batch_id == batch_id
    ).order_by(RenovationApplication.created_at.desc()).all()

    inspections = db.query(Inspection).filter(
        Inspection.batch_id == batch_id
    ).order_by(Inspection.created_at.desc()).all()

    refunds = db.query(RefundRecord).filter(
        RefundRecord.related_batch_id == batch_id
    ).order_by(RefundRecord.created_at.desc()).all()

    if not applications and not inspections:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")

    return {
        "batch_id": batch_id,
        "applications_count": len(applications),
        "inspections_count": len(inspections),
        "refunds_count": len(refunds),
        "applications": [RenovationApplicationResponse.model_validate(a) for a in applications],
        "inspections": [InspectionResponse.model_validate(i) for i in inspections],
        "refunds": [RefundRecordResponse.model_validate(r) for r in refunds]
    }


@app.get("/query/refund/{refund_code}")
def query_refund(refund_code: str, db: Session = Depends(get_db)):
    refund = db.query(RefundRecord).filter(RefundRecord.refund_code == refund_code).first()
    if not refund:
        raise HTTPException(status_code=404, detail=f"退款单号 {refund_code} 不存在")

    related_apps = db.query(RenovationApplication).filter(
        RenovationApplication.room_number == refund.room_number
    ).order_by(RenovationApplication.created_at.desc()).all()

    related_records = db.query(ProcessingRecord).filter(
        ProcessingRecord.room_number == refund.room_number
    ).order_by(ProcessingRecord.processing_time.desc()).all()

    return {
        "refund": RefundRecordResponse.model_validate(refund),
        "related_applications": [RenovationApplicationResponse.model_validate(a) for a in related_apps],
        "related_processing_records": [ProcessingRecordResponse.model_validate(p) for p in related_records],
        "duplicate_warning": "⚠️ 检测到重复退款，请核实！" if refund.is_duplicate else None
    }


@app.get("/stats/")
def get_stats(db: Session = Depends(get_db)):
    return {
        "total_owners": db.query(Owner).count(),
        "total_applications": db.query(RenovationApplication).count(),
        "applications_by_status": {
            "pending": db.query(RenovationApplication).filter(RenovationApplication.status == "pending").count(),
            "approved": db.query(RenovationApplication).filter(RenovationApplication.status == "approved").count(),
            "rejected": db.query(RenovationApplication).filter(RenovationApplication.status == "rejected").count(),
            "returned_for_revision": db.query(RenovationApplication).filter(RenovationApplication.status == "returned_for_revision").count(),
            "completed": db.query(RenovationApplication).filter(RenovationApplication.status == "completed").count()
        },
        "total_inspections": db.query(Inspection).count(),
        "inspections_by_status": {
            "pending": db.query(Inspection).filter(Inspection.status == "pending").count(),
            "passed": db.query(Inspection).filter(Inspection.status == "passed").count(),
            "failed": db.query(Inspection).filter(Inspection.status == "failed").count(),
            "rectified": db.query(Inspection).filter(Inspection.status == "rectified").count()
        },
        "total_refunds": db.query(RefundRecord).count(),
        "refunds_by_status": {
            "pending": db.query(RefundRecord).filter(RefundRecord.approval_status == "pending").count(),
            "approved": db.query(RefundRecord).filter(RefundRecord.approval_status == "approved").count(),
            "rejected": db.query(RefundRecord).filter(RefundRecord.approval_status == "rejected").count()
        },
        "duplicate_refunds": db.query(RefundRecord).filter(RefundRecord.is_duplicate == True).count(),
        "frozen_deposits": db.query(Owner).filter(Owner.deposit_frozen == True).count(),
        "total_processing_records": db.query(ProcessingRecord).count()
    }
