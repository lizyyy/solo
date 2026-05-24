from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import database as models
import schemas
from services import (
    DeclarationStatus,
    ErrorCode,
    ErrorType,
    DeclarationStateException,
    check_duplicate_declaration,
    check_battery_conflict,
    check_carrier_rules,
    validate_declaration_materials,
    transition_declaration_status,
    generate_declaration_report,
    attribute_return_reason,
    create_audit_trail,
    STATUS_TRANSITIONS
)

models.init_db()

app = FastAPI(
    title="跨境电池申报 API",
    description="跨境仓发带电商品申报管理系统",
    version="1.0.0"
)


@app.exception_handler(DeclarationStateException)
async def declaration_exception_handler(request, exc: DeclarationStateException):
    return JSONResponse(
        status_code=400,
        content={
            "error_code": exc.error_code,
            "error_type": exc.error_type,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.get("/")
async def root():
    return {"message": "跨境电池申报 API 服务运行中"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/battery-types", response_model=List[schemas.BatteryType])
async def list_battery_types(skip: int = 0, limit: int = 100, db: Session = Depends(models.get_db)):
    battery_types = db.query(models.BatteryType).offset(skip).limit(limit).all()
    return battery_types


@app.post("/battery-types", response_model=schemas.BatteryType)
async def create_battery_type(battery_type: schemas.BatteryTypeCreate, db: Session = Depends(models.get_db)):
    db_battery = models.BatteryType(**battery_type.model_dump())
    db.add(db_battery)
    db.commit()
    db.refresh(db_battery)
    return db_battery


@app.get("/carriers", response_model=List[schemas.Carrier])
async def list_carriers(skip: int = 0, limit: int = 100, db: Session = Depends(models.get_db)):
    carriers = db.query(models.Carrier).offset(skip).limit(limit).all()
    return carriers


@app.post("/carriers", response_model=schemas.Carrier)
async def create_carrier(carrier: schemas.CarrierCreate, db: Session = Depends(models.get_db)):
    db_carrier = models.Carrier(**carrier.model_dump())
    db.add(db_carrier)
    db.commit()
    db.refresh(db_carrier)
    return db_carrier


@app.get("/carriers/{carrier_id}/rules", response_model=List[schemas.CarrierRule])
async def list_carrier_rules(carrier_id: int, db: Session = Depends(models.get_db)):
    rules = db.query(models.CarrierRule).filter(models.CarrierRule.carrier_id == carrier_id).all()
    return rules


@app.post("/carrier-rules", response_model=schemas.CarrierRule)
async def create_carrier_rule(rule: schemas.CarrierRuleCreate, db: Session = Depends(models.get_db)):
    db_rule = models.CarrierRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@app.get("/products", response_model=List[schemas.Product])
async def list_products(skip: int = 0, limit: int = 100, db: Session = Depends(models.get_db)):
    products = db.query(models.Product).offset(skip).limit(limit).all()
    return products


@app.post("/products", response_model=schemas.Product)
async def create_product(product: schemas.ProductCreate, db: Session = Depends(models.get_db)):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.post("/declarations/receive", response_model=schemas.Declaration)
async def receive_declaration(declaration: schemas.DeclarationCreate, db: Session = Depends(models.get_db)):
    existing = check_duplicate_declaration(db, declaration.business_no)
    if existing:
        if existing.status in [DeclarationStatus.PENDING_SUPPLEMENT]:
            raise DeclarationStateException(
                error_code=ErrorCode.DUPLICATE_REQUEST,
                error_type=ErrorType.DUPLICATE_SUBMISSION,
                message=f"业务编号 {declaration.business_no} 已存在，当前状态为待补证",
                details={
                    "business_no": declaration.business_no,
                    "existing_status": existing.status,
                    "action": "supplement_required"
                }
            )
        else:
            raise DeclarationStateException(
                error_code=ErrorCode.DUPLICATE_REQUEST,
                error_type=ErrorType.DUPLICATE_SUBMISSION,
                message=f"业务编号 {declaration.business_no} 已存在，当前状态: {existing.status}",
                details={
                    "business_no": declaration.business_no,
                    "existing_status": existing.status
                }
            )
    items_data = declaration.model_dump(exclude={"items"})
    db_declaration = models.Declaration(**items_data, status=DeclarationStatus.DRAFT)
    for item_data in declaration.items:
        db_item = models.DeclarationItem(**item_data.model_dump())
        db_declaration.items.append(db_item)
    db.add(db_declaration)
    db.commit()
    db.refresh(db_declaration)
    create_audit_trail(
        db=db,
        declaration_id=db_declaration.id,
        action="RECEIVE",
        from_status=None,
        to_status=DeclarationStatus.DRAFT,
        operator=declaration.applicant,
        reason="申报单收件"
    )
    db.commit()
    return db_declaration


@app.get("/declarations/{business_no}/check-duplicate")
async def check_duplicate(business_no: str, db: Session = Depends(models.get_db)):
    existing = check_duplicate_declaration(db, business_no)
    if existing:
        return {
            "is_duplicate": True,
            "existing_status": existing.status,
            "message": f"业务编号 {business_no} 已存在",
            "needs_supplement": existing.status == DeclarationStatus.PENDING_SUPPLEMENT
        }
    return {"is_duplicate": False, "message": "业务编号可用"}


@app.post("/declarations/{declaration_id}/submit")
async def submit_declaration(declaration_id: int, operator: str, db: Session = Depends(models.get_db)):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    missing = validate_declaration_materials(declaration)
    if missing:
        raise DeclarationStateException(
            error_code=ErrorCode.MISSING_REQUIRED,
            error_type=ErrorType.MISSING_MATERIAL,
            message=f"缺少必要材料: {', '.join(missing)}",
            details={"missing_fields": missing}
        )
    battery_conflicts = check_battery_conflict(db, declaration)
    carrier_violations = check_carrier_rules(db, declaration)
    all_issues = battery_conflicts + carrier_violations
    if all_issues:
        raise DeclarationStateException(
            error_code=ErrorCode.NEEDS_REVIEW,
            error_type=ErrorType.REVIEW_REQUIRED,
            message="提交前需要复核",
            details={"issues": all_issues}
        )
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.SUBMITTED,
        operator=operator,
        reason="申报单提交"
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/review")
async def review_declaration(
    declaration_id: int,
    request: schemas.DeclarationReviewRequest,
    db: Session = Depends(models.get_db)
):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.REVIEWING,
        operator=request.reviewer,
        reason=request.review_notes
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/pending-supplement")
async def pending_supplement(
    declaration_id: int,
    operator: str,
    reason: str,
    db: Session = Depends(models.get_db)
):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.PENDING_SUPPLEMENT,
        operator=operator,
        reason=reason
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/process")
async def process_declaration(
    declaration_id: int,
    request: schemas.DeclarationProcessRequest,
    db: Session = Depends(models.get_db)
):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.PROCESSING,
        operator=request.processor,
        reason=request.process_notes
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/review-again")
async def review_again_declaration(
    declaration_id: int,
    operator: str,
    reason: str,
    db: Session = Depends(models.get_db)
):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.REVIEW_AGAIN,
        operator=operator,
        reason=reason
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/approve")
async def approve_declaration(declaration_id: int, operator: str, db: Session = Depends(models.get_db)):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.APPROVED,
        operator=operator,
        reason="申报通过"
    )
    declaration.declaration_no = f"BD{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/reject")
async def reject_declaration(declaration_id: int, operator: str, reason: str, db: Session = Depends(models.get_db)):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.REJECTED,
        operator=operator,
        reason=reason
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/close")
async def close_declaration(
    declaration_id: int,
    request: schemas.DeclarationCloseRequest,
    db: Session = Depends(models.get_db)
):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.CLOSED,
        operator=request.closer,
        reason=request.close_notes
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.post("/declarations/{declaration_id}/return")
async def return_declaration(declaration_id: int, operator: str, reason: str, db: Session = Depends(models.get_db)):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    declaration = transition_declaration_status(
        db=db,
        declaration=declaration,
        new_status=DeclarationStatus.RETURNED,
        operator=operator,
        reason=reason
    )
    db.commit()
    db.refresh(declaration)
    return declaration


@app.get("/declarations", response_model=List[schemas.Declaration])
async def list_declarations(
    status: str = None,
    business_no: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(models.get_db)
):
    query = db.query(models.Declaration)
    if status:
        query = query.filter(models.Declaration.status == status)
    if business_no:
        query = query.filter(models.Declaration.business_no.contains(business_no))
    declarations = query.offset(skip).limit(limit).all()
    return declarations


@app.get("/declarations/{declaration_id}", response_model=schemas.Declaration)
async def get_declaration(declaration_id: int, db: Session = Depends(models.get_db)):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    return declaration


@app.get("/declarations/{declaration_id}/audit-trails", response_model=List[schemas.AuditTrail])
async def get_audit_trails(declaration_id: int, db: Session = Depends(models.get_db)):
    trails = db.query(models.AuditTrail).filter(
        models.AuditTrail.declaration_id == declaration_id
    ).order_by(models.AuditTrail.created_at.desc()).all()
    return trails


@app.post("/return-receipts", response_model=schemas.ReturnReceipt)
async def create_return_receipt(receipt: schemas.ReturnReceiptCreate, db: Session = Depends(models.get_db)):
    db_receipt = models.ReturnReceipt(**receipt.model_dump())
    attributed_to, attribution_notes = attribute_return_reason(
        return_reason=receipt.return_reason,
        reason_code=receipt.return_reason_code
    )
    db_receipt.attributed_to = attributed_to
    db_receipt.attribution_notes = attribution_notes
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)
    declaration = db.query(models.Declaration).get(receipt.declaration_id)
    if declaration and declaration.status not in [DeclarationStatus.RETURNED, DeclarationStatus.CLOSED]:
        try:
            transition_declaration_status(
                db=db,
                declaration=declaration,
                new_status=DeclarationStatus.RETURNED,
                operator="system",
                reason=f"退件回执: {receipt.return_reason}"
            )
        except DeclarationStateException:
            pass
    db.commit()
    return db_receipt


@app.post("/return-receipts/{receipt_id}/attribute")
async def attribute_return_receipt(
    receipt_id: int,
    attribution: schemas.ReturnReceiptAttribute,
    db: Session = Depends(models.get_db)
):
    receipt = db.query(models.ReturnReceipt).get(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="退件回执不存在")
    receipt.attributed_to = attribution.attributed_to
    receipt.attribution_notes = attribution.attribution_notes
    db.commit()
    db.refresh(receipt)
    return receipt


@app.post("/return-receipts/{receipt_id}/resolve")
async def resolve_return_receipt(receipt_id: int, resolved_by: str, db: Session = Depends(models.get_db)):
    receipt = db.query(models.ReturnReceipt).get(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="退件回执不存在")
    receipt.is_resolved = True
    receipt.resolved_by = resolved_by
    receipt.resolved_time = datetime.utcnow()
    db.commit()
    db.refresh(receipt)
    return receipt


@app.get("/declarations/{declaration_id}/reports", response_model=List[schemas.DeclarationReport])
async def list_reports(declaration_id: int, db: Session = Depends(models.get_db)):
    reports = db.query(models.DeclarationReport).filter(
        models.DeclarationReport.declaration_id == declaration_id
    ).order_by(models.DeclarationReport.generated_at.desc()).all()
    return reports


@app.post("/declarations/{declaration_id}/reports/generate", response_model=schemas.DeclarationReport)
async def create_report(
    declaration_id: int,
    report_type: str,
    generated_by: str,
    db: Session = Depends(models.get_db)
):
    report = generate_declaration_report(
        db=db,
        declaration_id=declaration_id,
        report_type=report_type,
        generated_by=generated_by
    )
    db.commit()
    db.refresh(report)
    return report


@app.get("/declarations/{declaration_id}/validate")
async def validate_declaration(declaration_id: int, db: Session = Depends(models.get_db)):
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="申报单不存在")
    missing = validate_declaration_materials(declaration)
    battery_conflicts = check_battery_conflict(db, declaration)
    carrier_violations = check_carrier_rules(db, declaration)
    return {
        "declaration_id": declaration_id,
        "business_no": declaration.business_no,
        "status": declaration.status,
        "validation": {
            "is_valid": len(missing) == 0 and len(battery_conflicts) == 0 and len(carrier_violations) == 0,
            "missing_materials": missing,
            "battery_conflicts": battery_conflicts,
            "carrier_violations": carrier_violations
        }
    }


@app.get("/status-transitions")
async def get_status_transitions():
    return STATUS_TRANSITIONS


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
