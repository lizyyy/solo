from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional
import uuid
import json
import pandas as pd
import os

from models import (
    get_db, Part, Engineer, Batch, PartIssuance, OldPartReturn, Claim, AuditLog
)

app = FastAPI(title="家电售后仓管理系统", version="1.0.0")

def generate_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"

def log_audit(db: Session, operation_type: str, reference_no: str, operator: str,
              status: str, reason: str, details: dict = None):
    audit_log = AuditLog(
        operation_type=operation_type,
        reference_no=reference_no,
        operator=operator,
        status=status,
        reason=reason,
        details=json.dumps(details, ensure_ascii=False) if details else None
    )
    db.add(audit_log)
    db.commit()

from pydantic import BaseModel

class PartCreate(BaseModel):
    part_code: str
    name: str
    model: Optional[str] = None
    quantity: int = 0
    unit_price: float = 0.0
    location: Optional[str] = None

class EngineerCreate(BaseModel):
    employee_id: str
    name: str
    phone: Optional[str] = None
    department: Optional[str] = None

class BatchCreate(BaseModel):
    batch_no: str
    part_id: int
    quantity: int
    supplier: Optional[str] = None

class PartIssuanceCreate(BaseModel):
    engineer_id: int
    part_id: int
    batch_id: int
    quantity: int
    service_order_no: str
    customer_name: str
    customer_phone: Optional[str] = None
    appliance_model: Optional[str] = None
    fault_description: Optional[str] = None
    issued_by: str
    old_part_expected: bool = True

class OldPartReturnCreate(BaseModel):
    issuance_id: int
    engineer_id: int
    part_id: int
    quantity: int
    condition: Optional[str] = None
    defect_description: Optional[str] = None
    received_by: str
    storage_location: Optional[str] = None

class ClaimCreate(BaseModel):
    return_id: int
    quantity: int
    claim_amount: float
    vendor: str
    claim_reason: str
    submitted_by: str

class RuleCheckResult(BaseModel):
    passed: bool
    rule_name: str
    reason: str
    details: Optional[dict] = None

@app.get("/")
def root():
    return {"message": "家电售后仓管理系统 API", "version": "1.0.0"}

@app.post("/parts/", tags=["基础数据"])
def create_part(part: PartCreate, db: Session = Depends(get_db)):
    db_part = Part(**part.dict())
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part

@app.get("/parts/", tags=["基础数据"])
def list_parts(db: Session = Depends(get_db)):
    return db.query(Part).all()

@app.post("/engineers/", tags=["基础数据"])
def create_engineer(engineer: EngineerCreate, db: Session = Depends(get_db)):
    db_engineer = Engineer(**engineer.dict())
    db.add(db_engineer)
    db.commit()
    db.refresh(db_engineer)
    return db_engineer

@app.get("/engineers/", tags=["基础数据"])
def list_engineers(db: Session = Depends(get_db)):
    return db.query(Engineer).all()

@app.post("/batches/", tags=["基础数据"])
def create_batch(batch: BatchCreate, db: Session = Depends(get_db)):
    db_batch = Batch(**batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch

@app.get("/batches/", tags=["基础数据"])
def list_batches(db: Session = Depends(get_db)):
    return db.query(Batch).all()

def check_old_part_returned(db: Session, issuance_id: int) -> RuleCheckResult:
    issuance = db.query(PartIssuance).filter(PartIssuance.id == issuance_id).first()
    if not issuance:
        return RuleCheckResult(passed=False, rule_name="旧件返还校验", reason="领件记录不存在")
    if issuance.old_part_expected and not issuance.old_part_returned:
        return RuleCheckResult(
            passed=False,
            rule_name="旧件返还校验",
            reason="旧件未返还，无法提交索赔",
            details={"issuance_no": issuance.issuance_no, "service_order_no": issuance.service_order_no}
        )
    return RuleCheckResult(
        passed=True,
        rule_name="旧件返还校验",
        reason="旧件已返还或无需返还",
        details={"issuance_no": issuance.issuance_no}
    )

def check_duplicate_claim(db: Session, return_id: int) -> RuleCheckResult:
    existing_claim = db.query(Claim).filter(
        and_(Claim.return_id == return_id, Claim.status != "rejected")
    ).first()
    if existing_claim:
        return_rule = db.query(OldPartReturn).filter(OldPartReturn.id == return_id).first()
        return RuleCheckResult(
            passed=False,
            rule_name="重复索赔校验",
            reason="该旧件已提交过索赔申请",
            details={"existing_claim_no": existing_claim.claim_no, "return_no": return_rule.return_no if return_rule else None}
        )
    return RuleCheckResult(
        passed=True,
        rule_name="重复索赔校验",
        reason="无重复索赔记录"
    )

def check_batch_tracking(db: Session, issuance_id: int) -> RuleCheckResult:
    issuance = db.query(PartIssuance).filter(PartIssuance.id == issuance_id).first()
    if not issuance or not issuance.batch_id:
        return RuleCheckResult(passed=False, rule_name="批次追踪校验", reason="未关联批次信息")
    batch = db.query(Batch).filter(Batch.id == issuance.batch_id).first()
    if batch and batch.expire_date and batch.expire_date < datetime.now():
        return RuleCheckResult(
            passed=False,
            rule_name="批次追踪校验",
            reason="该批次零件已过质保期",
            details={"batch_no": batch.batch_no, "expire_date": batch.expire_date.strftime("%Y-%m-%d")}
        )
    return RuleCheckResult(
        passed=True,
        rule_name="批次追踪校验",
        reason="批次信息有效",
        details={"batch_no": batch.batch_no if batch else None}
    )

@app.post("/issuances/", tags=["领件管理"])
def create_issuance(issuance: PartIssuanceCreate, db: Session = Depends(get_db)):
    part = db.query(Part).filter(Part.id == issuance.part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="零件不存在")
    if part.quantity < issuance.quantity:
        log_audit(db, "领件申请", "", issuance.issued_by, "rejected",
                  f"库存不足，当前库存：{part.quantity}，申请数量：{issuance.quantity}")
        raise HTTPException(status_code=400, detail=f"库存不足，当前库存：{part.quantity}")
    
    issuance_no = generate_no("ISS")
    db_issuance = PartIssuance(
        issuance_no=issuance_no,
        **issuance.dict()
    )
    part.quantity -= issuance.quantity
    db.add(db_issuance)
    db.commit()
    db.refresh(db_issuance)
    
    log_audit(db, "领件申请", issuance_no, issuance.issued_by, "approved",
              "领件成功", {"part_name": part.name, "quantity": issuance.quantity})
    
    return db_issuance

@app.get("/issuances/", tags=["领件管理"])
def list_issuances(db: Session = Depends(get_db)):
    return db.query(PartIssuance).all()

@app.post("/returns/", tags=["旧件返还"])
def create_return(return_data: OldPartReturnCreate, db: Session = Depends(get_db)):
    issuance = db.query(PartIssuance).filter(PartIssuance.id == return_data.issuance_id).first()
    if not issuance:
        raise HTTPException(status_code=404, detail="领件记录不存在")
    if issuance.old_part_returned:
        raise HTTPException(status_code=400, detail="该领件已返还过旧件")
    
    return_no = generate_no("RET")
    db_return = OldPartReturn(
        return_no=return_no,
        **return_data.dict()
    )
    issuance.old_part_returned = True
    issuance.old_part_returned_at = datetime.utcnow()
    issuance.status = "returned"
    
    db.add(db_return)
    db.commit()
    db.refresh(db_return)
    
    log_audit(db, "旧件返还", return_no, return_data.received_by, "approved",
              "旧件返还成功", {"issuance_no": issuance.issuance_no, "quantity": return_data.quantity})
    
    return db_return

@app.get("/returns/", tags=["旧件返还"])
def list_returns(db: Session = Depends(get_db)):
    return db.query(OldPartReturn).all()

@app.post("/claims/", tags=["索赔管理"])
def create_claim(claim: ClaimCreate, db: Session = Depends(get_db)):
    return_record = db.query(OldPartReturn).filter(OldPartReturn.id == claim.return_id).first()
    if not return_record:
        raise HTTPException(status_code=404, detail="返还记录不存在")
    
    issuance_id = return_record.issuance_id
    rules_results = []
    
    rule1 = check_old_part_returned(db, issuance_id)
    rules_results.append(rule1)
    
    rule2 = check_duplicate_claim(db, claim.return_id)
    rules_results.append(rule2)
    
    rule3 = check_batch_tracking(db, issuance_id)
    rules_results.append(rule3)
    
    all_passed = all(r.passed for r in rules_results)
    
    if not all_passed:
        failed_reasons = [f"{r.rule_name}: {r.reason}" for r in rules_results if not r.passed]
        log_audit(db, "索赔申请", "", claim.submitted_by, "blocked",
                  "; ".join(failed_reasons), {"rules_check": [r.dict() for r in rules_results]})
        return {
            "status": "blocked",
            "reason": "; ".join(failed_reasons),
            "details": [r.dict() for r in rules_results]
        }
    
    claim_no = generate_no("CLA")
    db_claim = Claim(
        claim_no=claim_no,
        issuance_id=issuance_id,
        part_id=return_record.part_id,
        batch_id=return_record.issuance.batch_id if return_record.issuance else None,
        **claim.dict()
    )
    db.add(db_claim)
    db.commit()
    db.refresh(db_claim)
    
    log_audit(db, "索赔申请", claim_no, claim.submitted_by, "approved",
              "索赔申请提交成功", {"claim_amount": claim.claim_amount, "vendor": claim.vendor})
    
    return {
        "status": "approved",
        "claim": db_claim,
        "rules_check": [r.dict() for r in rules_results]
    }

@app.get("/claims/", tags=["索赔管理"])
def list_claims(db: Session = Depends(get_db)):
    return db.query(Claim).all()

@app.get("/audit-logs/", tags=["审计日志"])
def list_audit_logs(
    operation_type: Optional[str] = None,
    status: Optional[str] = None,
    operator: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    
    if operation_type:
        query = query.filter(AuditLog.operation_type == operation_type)
    if status:
        query = query.filter(AuditLog.status == status)
    if operator:
        query = query.filter(AuditLog.operator.like(f"%{operator}%"))
    if start_date:
        query = query.filter(AuditLog.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(AuditLog.created_at <= datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
    
    logs = query.order_by(AuditLog.created_at.desc()).all()
    return {
        "total": len(logs),
        "data": logs
    }

@app.get("/reports/claims-summary", tags=["报表导出"])
def claims_summary(
    status: Optional[str] = None,
    submitted_by: Optional[str] = None,
    vendor: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Claim)
    
    if status:
        query = query.filter(Claim.status == status)
    if submitted_by:
        query = query.filter(Claim.submitted_by.like(f"%{submitted_by}%"))
    if vendor:
        query = query.filter(Claim.vendor.like(f"%{vendor}%"))
    if start_date:
        query = query.filter(Claim.submitted_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(Claim.submitted_at <= datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
    
    claims = query.order_by(Claim.submitted_at.desc()).all()
    
    total_amount = sum(c.claim_amount for c in claims)
    paid_amount = sum(c.paid_amount or 0 for c in claims if c.status == "paid")
    
    return {
        "summary": {
            "total_count": len(claims),
            "total_amount": total_amount,
            "paid_amount": paid_amount,
            "pending_amount": total_amount - paid_amount
        },
        "data": claims
    }

@app.get("/reports/export", tags=["报表导出"])
def export_report(
    report_type: str = Query("claims", description="报表类型: claims 或 audit"),
    status: Optional[str] = None,
    operator: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{report_type}_report_{timestamp}.xlsx"
    filepath = os.path.join(os.getcwd(), filename)
    
    if report_type == "claims":
        result = claims_summary(status, operator, None, start_date, end_date, db)
        claims_data = result["data"]
        
        df_data = []
        for claim in claims_data:
            df_data.append({
                "索赔单号": claim.claim_no,
                "零件名称": claim.part.name if claim.part else "",
                "数量": claim.quantity,
                "索赔金额": claim.claim_amount,
                "厂商": claim.vendor,
                "提交人": claim.submitted_by,
                "提交时间": claim.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if claim.submitted_at else "",
                "状态": claim.status,
                "审批时间": claim.approved_at.strftime("%Y-%m-%d %H:%M:%S") if claim.approved_at else "",
                "已赔付金额": claim.paid_amount or 0
            })
        
        df = pd.DataFrame(df_data)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='索赔明细', index=False)
            
            summary_df = pd.DataFrame([{
                "总单数": result["summary"]["total_count"],
                "总索赔金额": result["summary"]["total_amount"],
                "已赔付金额": result["summary"]["paid_amount"],
                "待赔付金额": result["summary"]["pending_amount"]
            }])
            summary_df.to_excel(writer, sheet_name='汇总', index=False)
    
    elif report_type == "audit":
        result = list_audit_logs(None, status, operator, start_date, end_date, db)
        audit_data = result["data"]
        
        df_data = []
        for log in audit_data:
            df_data.append({
                "操作类型": log.operation_type,
                "关联单号": log.reference_no,
                "操作人": log.operator,
                "状态": log.status,
                "原因": log.reason,
                "操作时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else ""
            })
        
        df = pd.DataFrame(df_data)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='审计日志', index=False)
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
