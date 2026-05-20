from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import json
from io import StringIO
from database import get_db
from models import ClaimSubmission, ClaimMaterial, AuditResult, PolicyInfo, AuditRule
from schemas import ClaimSubmissionCreate, MaterialItem, ResultStatus, ClaimAuditResponse, AuditResultResponse
from rule_engine import rule_engine

router = APIRouter()

@router.post("/upload-csv")
async def upload_materials_csv(
    batch_no: str,
    policy_no: str,
    claimant_name: str,
    total_amount: float,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    existing = db.query(ClaimSubmission).filter(ClaimSubmission.batch_no == batch_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="该批次已提交，请勿重复上报")
    
    content = await file.read()
    df = pd.read_csv(StringIO(content.decode('utf-8')))
    
    materials = []
    for _, row in df.iterrows():
        materials.append(MaterialItem(
            material_type=str(row.get('material_type', row.get('材料类型', ''))),
            file_name=str(row.get('file_name', row.get('文件名', ''))),
            amount=float(row.get('amount', row.get('金额', 0))),
            is_valid=True
        ))
    
    return await process_claim_submission(
        ClaimSubmissionCreate(
            batch_no=batch_no,
            policy_no=policy_no,
            claimant_name=claimant_name,
            total_amount=total_amount,
            materials=materials
        ),
        db
    )

@router.post("/upload-policy")
async def upload_policy_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    policy_data = json.loads(content.decode('utf-8'))
    
    existing = db.query(PolicyInfo).filter(PolicyInfo.policy_no == policy_data["policy_no"]).first()
    if existing:
        for key, value in policy_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    
    db_policy = PolicyInfo(**policy_data)
    db.add(db_policy)
    db.commit()
    db.refresh(db_policy)
    return db_policy

@router.post("/audit", response_model=ClaimAuditResponse)
async def process_claim_submission(submission: ClaimSubmissionCreate, db: Session = Depends(get_db)):
    existing = db.query(ClaimSubmission).filter(ClaimSubmission.batch_no == submission.batch_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="该批次已提交，请勿重复上报")
    
    policy = db.query(PolicyInfo).filter(PolicyInfo.policy_no == submission.policy_no).first()
    if not policy:
        raise HTTPException(status_code=404, detail="保单信息不存在，请先上传保单JSON")
    
    submission_count = db.query(ClaimSubmission).filter(
        ClaimSubmission.policy_no == submission.policy_no
    ).count()
    
    policy_dict = {
        "policy_no": policy.policy_no,
        "policy_holder": policy.policy_holder,
        "coverage_amount": policy.coverage_amount,
        "effective_date": policy.effective_date,
        "expiry_date": policy.expiry_date,
        "product_name": policy.product_name
    }
    
    submission_dict = {
        "batch_no": submission.batch_no,
        "total_amount": submission.total_amount,
        "submission_count": submission_count
    }
    
    rules = db.query(AuditRule).all()
    rule_engine.load_rules(rules)
    
    audit_results = rule_engine.execute(submission.materials, policy_dict, submission_dict)
    
    material_types = [m.material_type for m in submission.materials]
    
    if not any(t in ['发票', 'invoice'] for t in material_types):
        invoice_rule = db.query(AuditRule).filter(AuditRule.rule_code == "INVOICE_001").first()
        if invoice_rule:
            audit_results.append({
                "material_type": None,
                "file_name": None,
                "rule_code": invoice_rule.rule_code,
                "rule_name": invoice_rule.rule_name,
                "result_status": ResultStatus.FAILED if invoice_rule.severity == "high" else ResultStatus.PENDING,
                "suggestion": invoice_rule.suggestion,
                "source_rule": f"{invoice_rule.rule_code}-{invoice_rule.rule_name}",
                "original_fields": {"batch_no": submission.batch_no}
            })
    
    if not any(t in ['诊断证明', 'diagnosis'] for t in material_types):
        diag_rule = db.query(AuditRule).filter(AuditRule.rule_code == "MATERIAL_001").first()
        if diag_rule:
            audit_results.append({
                "material_type": None,
                "file_name": None,
                "rule_code": diag_rule.rule_code,
                "rule_name": diag_rule.rule_name,
                "result_status": ResultStatus.FAILED if diag_rule.severity == "high" else ResultStatus.PENDING,
                "suggestion": diag_rule.suggestion,
                "source_rule": f"{diag_rule.rule_code}-{diag_rule.rule_name}",
                "original_fields": {"batch_no": submission.batch_no}
            })
    
    if not any(t in ['费用清单', 'bill_list'] for t in material_types):
        bill_rule = db.query(AuditRule).filter(AuditRule.rule_code == "MATERIAL_002").first()
        if bill_rule:
            audit_results.append({
                "material_type": None,
                "file_name": None,
                "rule_code": bill_rule.rule_code,
                "rule_name": bill_rule.rule_name,
                "result_status": ResultStatus.FAILED if bill_rule.severity == "high" else ResultStatus.PENDING,
                "suggestion": bill_rule.suggestion,
                "source_rule": f"{bill_rule.rule_code}-{bill_rule.rule_name}",
                "original_fields": {"batch_no": submission.batch_no}
            })
    
    if submission_count > 0:
        has_duplicate_rule = any(r["rule_code"] == "DUPLICATE_001" for r in audit_results)
        if not has_duplicate_rule:
            duplicate_rule = db.query(AuditRule).filter(AuditRule.rule_code == "DUPLICATE_001").first()
            if duplicate_rule:
                audit_results.append({
                    "material_type": None,
                    "file_name": None,
                    "rule_code": duplicate_rule.rule_code,
                    "rule_name": duplicate_rule.rule_name,
                    "result_status": ResultStatus.FAILED,
                    "suggestion": duplicate_rule.suggestion,
                    "source_rule": f"{duplicate_rule.rule_code}-{duplicate_rule.rule_name}",
                    "original_fields": {
                        "batch_no": submission.batch_no,
                        "policy_no": submission.policy_no
                    }
                })
    
    db_submission = ClaimSubmission(
        batch_no=submission.batch_no,
        policy_no=submission.policy_no,
        claimant_name=submission.claimant_name,
        total_amount=submission.total_amount,
        status="audited"
    )
    db.add(db_submission)
    db.flush()
    
    for material in submission.materials:
        db_material = ClaimMaterial(
            submission_id=db_submission.id,
            material_type=material.material_type,
            file_name=material.file_name,
            amount=material.amount,
            is_valid=material.is_valid
        )
        db.add(db_material)
    
    db.flush()
    
    normal_items = []
    pending_items = []
    failed_items = []
    
    for idx, result in enumerate(audit_results):
        db_result = AuditResult(
            submission_id=db_submission.id,
            material_id=None,
            rule_code=result["rule_code"],
            result_type=result.get("rule_name", ""),
            result_status=result["result_status"],
            suggestion=result["suggestion"],
            source_rule=result["source_rule"]
        )
        db.add(db_result)
        db.flush()
        
        response_item = AuditResultResponse(
            id=db_result.id,
            material_type=result["material_type"],
            file_name=result["file_name"],
            rule_code=result["rule_code"],
            result_status=result["result_status"],
            suggestion=result["suggestion"],
            source_rule=result["source_rule"],
            audit_time=db_result.audit_time,
            original_fields=result.get("original_fields", {})
        )
        
        if result["result_status"] == ResultStatus.NORMAL:
            normal_items.append(response_item)
        elif result["result_status"] == ResultStatus.PENDING:
            pending_items.append(response_item)
        else:
            failed_items.append(response_item)
    
    db.commit()
    
    return ClaimAuditResponse(
        batch_no=submission.batch_no,
        policy_no=submission.policy_no,
        normal_items=normal_items,
        pending_items=pending_items,
        failed_items=failed_items
    )
