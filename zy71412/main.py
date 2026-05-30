from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional
import json

from database import get_db, Material, Collateral, CollateralVersion, Warning, Reassessment
from schemas import (
    MaterialCreate, MaterialResponse,
    CollateralCreate, CollateralResponse,
    CollateralVersionCreate, CollateralVersionResponse,
    CreditContractCreate, CreditContractResponse,
    CreditOccupancyCreate, CreditOccupancyResponse,
    ReassessmentCreate, ReassessmentResponse,
    ReviewRequest, WarningResponse,
    CollateralImportRequest, ContractImportRequest
)
from services import (
    create_material, get_or_create_collateral, add_collateral_version,
    create_credit_contract, create_credit_occupancy,
    create_reassessment, process_reassessment, process_reassessment_task,
    review_reassessment, export_reassessment_data, get_collateral_full_history,
    calculate_collateral_balance, get_latest_active_version, detect_warnings_for_collateral
)

app = FastAPI(
    title="银行授信抵押物复估系统",
    description="抵押物复估管理系统 - 支持材料导入、版本管理、复估计算、异常检测、复核和导出",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "name": "银行授信抵押物复估系统",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.post("/api/materials/upload", response_model=MaterialResponse)
async def upload_material(
    material_type: str = Query(..., description="材料类型: collateral_list/appraisal_report/credit_contract"),
    uploaded_by: str = Query(..., description="上传人"),
    source: Optional[str] = Query(None, description="材料来源"),
    remark: Optional[str] = Query(None, description="备注"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    material = create_material(
        db, material_type, file.filename, content, uploaded_by, source, remark
    )
    db.commit()
    return material


@app.post("/api/materials", response_model=MaterialResponse)
def create_material_record(
    data: MaterialCreate,
    db: Session = Depends(get_db)
):
    content = f"{data.material_type}|{data.file_name}|{data.uploaded_by}".encode()
    material = create_material(
        db, data.material_type, data.file_name, content,
        data.uploaded_by, data.source, data.remark
    )
    db.commit()
    return material


@app.get("/api/materials", response_model=List[MaterialResponse])
def list_materials(
    material_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Material)
    if material_type:
        query = query.filter(Material.material_type == material_type)
    return query.order_by(Material.uploaded_at.desc()).all()


@app.post("/api/collaterals", response_model=CollateralResponse)
def create_collateral(
    data: CollateralCreate,
    db: Session = Depends(get_db)
):
    collateral = get_or_create_collateral(
        db, data.collateral_no, data.name, data.collateral_type,
        data.address, data.owner, data.id_card
    )
    db.commit()
    db.refresh(collateral)
    return collateral


@app.post("/api/collaterals/import", response_model=CollateralVersionResponse)
def import_collateral_with_version(
    data: CollateralImportRequest,
    db: Session = Depends(get_db)
):
    file_name = data.file_name or f"{data.collateral_no}_评估报告.pdf"
    content = f"{data.collateral_no}|{data.appraised_value}|{data.appraisal_date}".encode()
    material = create_material(
        db, "appraisal_report", file_name, content,
        data.uploaded_by, data.source
    )

    collateral = get_or_create_collateral(
        db, data.collateral_no, data.name, data.collateral_type,
        data.address, data.owner, data.id_card
    )

    version = add_collateral_version(
        db, collateral.id, data.appraised_value,
        data.appraisal_date, data.appraisal_expiry_date,
        data.mortgage_rate, material.id,
        data.appraiser, data.appraisal_report_no
    )
    db.commit()
    db.refresh(version)
    return version


@app.post("/api/collaterals/versions", response_model=CollateralVersionResponse)
def add_version(
    data: CollateralVersionCreate,
    db: Session = Depends(get_db)
):
    collateral = db.query(Collateral).filter(Collateral.id == data.collateral_id).first()
    if not collateral:
        raise HTTPException(status_code=404, detail="抵押物不存在")

    version = add_collateral_version(
        db, data.collateral_id, data.appraised_value,
        data.appraisal_date, data.appraisal_expiry_date,
        data.mortgage_rate, data.material_id,
        data.appraiser, data.appraisal_report_no, data.remark
    )
    db.commit()
    db.refresh(version)
    return version


@app.get("/api/collaterals", response_model=List[CollateralResponse])
def list_collaterals(db: Session = Depends(get_db)):
    return db.query(Collateral).order_by(Collateral.created_at.desc()).all()


@app.get("/api/collaterals/{collateral_id}/history")
def get_collateral_history(
    collateral_id: int,
    db: Session = Depends(get_db)
):
    try:
        return get_collateral_full_history(db, collateral_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/collaterals/{collateral_id}/versions", response_model=List[CollateralVersionResponse])
def list_collateral_versions(
    collateral_id: int,
    db: Session = Depends(get_db)
):
    collateral = db.query(Collateral).filter(Collateral.id == collateral_id).first()
    if not collateral:
        raise HTTPException(status_code=404, detail="抵押物不存在")
    return collateral.versions


@app.get("/api/collaterals/{collateral_id}/warnings", response_model=List[WarningResponse])
def list_collateral_warnings(
    collateral_id: int,
    db: Session = Depends(get_db)
):
    warnings = db.query(Warning).filter(Warning.collateral_id == collateral_id).order_by(Warning.created_at.desc()).all()
    result = []
    for w in warnings:
        w_data = WarningResponse.model_validate(w)
        if w.trigger_material:
            w_data.trigger_material = w.trigger_material.file_name
        result.append(w_data)
    return result


@app.post("/api/contracts", response_model=CreditContractResponse)
def create_contract(
    data: CreditContractCreate,
    db: Session = Depends(get_db)
):
    contract = create_credit_contract(
        db, data.contract_no, data.borrower, data.credit_amount,
        data.start_date, data.end_date, data.material_id,
        data.borrower_id_card, data.bank, data.account_manager, data.remark
    )
    db.commit()
    db.refresh(contract)
    return contract


@app.post("/api/contracts/import", response_model=CreditContractResponse)
def import_contract_with_occupancy(
    data: ContractImportRequest,
    db: Session = Depends(get_db)
):
    collateral = db.query(Collateral).filter(Collateral.collateral_no == data.collateral_no).first()
    if not collateral:
        raise HTTPException(status_code=404, detail=f"抵押物 {data.collateral_no} 不存在，请先导入抵押物")

    version = get_latest_active_version(db, collateral.id)
    if not version:
        raise HTTPException(status_code=404, detail=f"抵押物 {data.collateral_no} 没有有效的评估版本")

    file_name = data.file_name or f"{data.contract_no}_授信合同.pdf"
    content = f"{data.contract_no}|{data.credit_amount}|{data.borrower}".encode()
    material = create_material(
        db, "credit_contract", file_name, content,
        data.uploaded_by, data.source
    )

    contract = create_credit_contract(
        db, data.contract_no, data.borrower, data.credit_amount,
        data.start_date, data.end_date, material.id,
        data.borrower_id_card, data.bank, data.account_manager
    )

    create_credit_occupancy(
        db, contract.id, collateral.id, version.id,
        data.occupancy_amount, data.occupancy_date
    )

    db.commit()
    db.refresh(contract)
    return contract


@app.get("/api/contracts", response_model=List[CreditContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    return db.query(CreditContract).order_by(CreditContract.created_at.desc()).all()


@app.post("/api/occupancies", response_model=CreditOccupancyResponse)
def create_occupancy(
    data: CreditOccupancyCreate,
    db: Session = Depends(get_db)
):
    occupancy = create_credit_occupancy(
        db, data.contract_id, data.collateral_id,
        data.collateral_version_id, data.occupancy_amount,
        data.occupancy_date, data.remark
    )
    db.commit()
    db.refresh(occupancy)
    return occupancy


@app.get("/api/collaterals/{collateral_id}/balance")
def get_collateral_balance(
    collateral_id: int,
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    balance = calculate_collateral_balance(db, collateral_id, as_of_date)
    version = get_latest_active_version(db, collateral_id)
    return {
        "collateral_id": collateral_id,
        "as_of_date": as_of_date or date.today(),
        "calculated_balance": balance,
        "latest_appraised_value": version.appraised_value if version else None,
        "current_mortgage_rate": balance / version.appraised_value if version and version.appraised_value > 0 else None
    }


@app.post("/api/reassessments", response_model=ReassessmentResponse)
def create_reassessment_job(
    data: ReassessmentCreate,
    db: Session = Depends(get_db)
):
    for coll_id in data.collateral_ids:
        collateral = db.query(Collateral).filter(Collateral.id == coll_id).first()
        if not collateral:
            raise HTTPException(status_code=404, detail=f"抵押物 {coll_id} 不存在")

    reassessment = create_reassessment(
        db, data.name, data.collateral_ids, data.triggered_by, data.max_rate
    )
    db.commit()
    db.refresh(reassessment)
    return reassessment


@app.get("/api/reassessments", response_model=List[ReassessmentResponse])
def list_reassessments(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Reassessment)
    if status:
        query = query.filter(Reassessment.status == status)
    return query.order_by(Reassessment.created_at.desc()).all()


@app.get("/api/reassessments/{reassessment_id}", response_model=ReassessmentResponse)
def get_reassessment(
    reassessment_id: int,
    db: Session = Depends(get_db)
):
    reassessment = db.query(Reassessment).filter(Reassessment.id == reassessment_id).first()
    if not reassessment:
        raise HTTPException(status_code=404, detail="复估任务不存在")
    return reassessment


@app.post("/api/reassessments/{reassessment_id}/process", response_model=ReassessmentResponse)
def process_reassessment_job(
    reassessment_id: int,
    handler: Optional[str] = Query(None, description="处理人"),
    db: Session = Depends(get_db)
):
    try:
        reassessment = process_reassessment(db, reassessment_id, handler)
        db.commit()
        db.refresh(reassessment)
        return reassessment
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/reassessments/{reassessment_id}/tasks/{task_id}/process")
def process_single_task(
    reassessment_id: int,
    task_id: int,
    handler: Optional[str] = Query(None, description="处理人"),
    db: Session = Depends(get_db)
):
    try:
        task = process_reassessment_task(db, task_id, handler)
        db.commit()
        return {
            "task_id": task.id,
            "status": task.status,
            "current_mortgage_rate": task.current_mortgage_rate,
            "calculated_balance": task.calculated_balance,
            "latest_appraised_value": task.latest_appraised_value
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/reassessments/{reassessment_id}/review", response_model=ReassessmentResponse)
def review_reassessment_job(
    reassessment_id: int,
    data: ReviewRequest,
    db: Session = Depends(get_db)
):
    try:
        reassessment = review_reassessment(
            db, reassessment_id, data.reviewer,
            data.review_opinion, data.approve
        )
        db.commit()
        db.refresh(reassessment)
        return reassessment
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/reassessments/{reassessment_id}/export")
def export_reassessment(
    reassessment_id: int,
    format: str = Query("json", description="导出格式: json"),
    db: Session = Depends(get_db)
):
    try:
        data = export_reassessment_data(db, reassessment_id)
        return JSONResponse(
            content=data,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="reassessment_{data["reassessment_no"]}.json"'
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/reassessments/{reassessment_id}/warnings")
def get_reassessment_warnings(
    reassessment_id: int,
    unresolved_only: bool = Query(True, description="仅显示未解决的预警"),
    db: Session = Depends(get_db)
):
    reassessment = db.query(Reassessment).filter(Reassessment.id == reassessment_id).first()
    if not reassessment:
        raise HTTPException(status_code=404, detail="复估任务不存在")

    query = db.query(Warning).join(Warning.task).filter(
        Warning.task.has(reassessment_id=reassessment_id)
    )
    if unresolved_only:
        query = query.filter(Warning.is_resolved == False)

    warnings = query.order_by(Warning.severity.desc(), Warning.created_at.desc()).all()

    result = []
    for w in warnings:
        w_dict = {
            "id": w.id,
            "warning_type": w.warning_type,
            "severity": w.severity,
            "message": w.message,
            "blocked_at": w.blocked_at,
            "next_action": w.next_action,
            "is_resolved": w.is_resolved,
            "created_at": w.created_at.isoformat(),
            "trigger_material": w.trigger_material.file_name if w.trigger_material else None,
            "trigger_material_id": w.material_id,
            "collateral_id": w.collateral_id,
            "task_id": w.task_id
        }
        result.append(w_dict)

    return {
        "reassessment_no": reassessment.reassessment_no,
        "total_warnings": len(result),
        "error_count": sum(1 for w in result if w["severity"] == "error"),
        "warning_count": sum(1 for w in result if w["severity"] == "warning"),
        "warnings": result
    }


@app.post("/api/warnings/{warning_id}/resolve")
def resolve_warning(
    warning_id: int,
    resolved_by: str = Query(..., description="处理人"),
    db: Session = Depends(get_db)
):
    warning = db.query(Warning).filter(Warning.id == warning_id).first()
    if not warning:
        raise HTTPException(status_code=404, detail="预警不存在")

    warning.is_resolved = True
    warning.resolved_by = resolved_by
    warning.resolved_at = date.today()
    db.commit()

    return {
        "id": warning.id,
        "is_resolved": True,
        "resolved_by": resolved_by,
        "resolved_at": warning.resolved_at.isoformat() if warning.resolved_at else None
    }


@app.get("/api/warnings", response_model=List[WarningResponse])
def list_warnings(
    warning_type: Optional[str] = None,
    severity: Optional[str] = None,
    unresolved_only: bool = Query(False, description="仅显示未解决"),
    db: Session = Depends(get_db)
):
    query = db.query(Warning)
    if warning_type:
        query = query.filter(Warning.warning_type == warning_type)
    if severity:
        query = query.filter(Warning.severity == severity)
    if unresolved_only:
        query = query.filter(Warning.is_resolved == False)

    warnings = query.order_by(Warning.created_at.desc()).all()
    result = []
    for w in warnings:
        w_data = WarningResponse.model_validate(w)
        if w.trigger_material:
            w_data.trigger_material = w.trigger_material.file_name
        result.append(w_data)
    return result


@app.get("/api/detect/{collateral_id}")
def detect_collateral_issues(
    collateral_id: int,
    max_rate: float = Query(0.7, description="最高抵押率"),
    db: Session = Depends(get_db)
):
    collateral = db.query(Collateral).filter(Collateral.id == collateral_id).first()
    if not collateral:
        raise HTTPException(status_code=404, detail="抵押物不存在")

    version = get_latest_active_version(db, collateral_id)
    balance = calculate_collateral_balance(db, collateral_id)

    warnings = detect_warnings_for_collateral(db, collateral_id, max_rate=max_rate)

    return {
        "collateral": {
            "id": collateral.id,
            "collateral_no": collateral.collateral_no,
            "name": collateral.name
        },
        "latest_version": {
            "version_no": version.version_no,
            "appraised_value": version.appraised_value,
            "appraisal_date": version.appraisal_date.isoformat(),
            "appraisal_expiry_date": version.appraisal_expiry_date.isoformat(),
            "mortgage_rate": version.mortgage_rate
        } if version else None,
        "current_balance": balance,
        "current_mortgage_rate": balance / version.appraised_value if version and version.appraised_value > 0 else None,
        "warnings_count": len(warnings),
        "warnings": [
            {
                "type": w.warning_type,
                "severity": w.severity,
                "message": w.message,
                "blocked_at": w.blocked_at,
                "next_action": w.next_action,
                "trigger_material": w.trigger_material.file_name if w.trigger_material else None
            }
            for w in warnings
        ]
    }


@app.get("/api/statistics")
def get_statistics(db: Session = Depends(get_db)):
    return {
        "materials": db.query(Material).count(),
        "collaterals": db.query(Collateral).count(),
        "collateral_versions": db.query(CollateralVersion).count(),
        "reassessments": db.query(Reassessment).count(),
        "warnings": {
            "total": db.query(Warning).count(),
            "unresolved": db.query(Warning).filter(Warning.is_resolved == False).count(),
            "appraisal_expired": db.query(Warning).filter(Warning.warning_type == "appraisal_expired", Warning.is_resolved == False).count(),
            "mortgage_rate_exceed": db.query(Warning).filter(Warning.warning_type == "mortgage_rate_exceed", Warning.is_resolved == False).count(),
            "duplicate_guarantee": db.query(Warning).filter(Warning.warning_type == "duplicate_guarantee", Warning.is_resolved == False).count()
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
