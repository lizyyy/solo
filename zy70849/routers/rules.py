from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import AuditRule
from schemas import AuditRuleCreate

router = APIRouter()

@router.get("/")
async def get_rules(db: Session = Depends(get_db)):
    rules = db.query(AuditRule).all()
    return {"rules": rules}

@router.post("/")
async def create_rule(rule: AuditRuleCreate, db: Session = Depends(get_db)):
    existing_rule = db.query(AuditRule).filter(AuditRule.rule_code == rule.rule_code).first()
    if existing_rule:
        raise HTTPException(status_code=400, detail="规则编码已存在")
    
    db_rule = AuditRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.post("/init-default")
async def init_default_rules(db: Session = Depends(get_db)):
    default_rules = [
        {
            "rule_code": "INVOICE_001",
            "rule_name": "缺失发票",
            "rule_type": "material",
            "condition": "False",
            "severity": "high",
            "suggestion": "缺少医疗费用发票，请上传正规医疗发票原件"
        },
        {
            "rule_code": "INVOICE_002",
            "rule_name": "发票金额不匹配",
            "rule_type": "material",
            "condition": "material_type in ['发票', 'invoice'] and amount <= 0",
            "severity": "medium",
            "suggestion": "发票金额为空或为0，请确认发票金额填写正确"
        },
        {
            "rule_code": "AMOUNT_001",
            "rule_name": "金额超限",
            "rule_type": "batch",
            "condition": "total_amount > coverage_amount",
            "severity": "high",
            "suggestion": "理赔金额超过保单保额，超出部分不予赔付"
        },
        {
            "rule_code": "AMOUNT_002",
            "rule_name": "单张发票金额过高",
            "rule_type": "material",
            "condition": "amount > 10000",
            "severity": "medium",
            "suggestion": "单张发票金额超过1万元，需要复核发票真实性"
        },
        {
            "rule_code": "DUPLICATE_001",
            "rule_name": "重复报案",
            "rule_type": "batch",
            "condition": "False",
            "severity": "high",
            "suggestion": "该保单已有报案记录，请勿重复报案"
        },
        {
            "rule_code": "MATERIAL_001",
            "rule_name": "缺失诊断证明",
            "rule_type": "material",
            "condition": "False",
            "severity": "medium",
            "suggestion": "缺少医院诊断证明，请补充上传"
        },
        {
            "rule_code": "MATERIAL_002",
            "rule_name": "缺失费用清单",
            "rule_type": "material",
            "condition": "False",
            "severity": "medium",
            "suggestion": "缺少医疗费用明细清单，请补充上传"
        }
    ]
    
    created_count = 0
    for rule_data in default_rules:
        existing = db.query(AuditRule).filter(AuditRule.rule_code == rule_data["rule_code"]).first()
        if not existing:
            db_rule = AuditRule(**rule_data, is_active=True)
            db.add(db_rule)
            created_count += 1
    
    db.commit()
    return {"message": f"成功初始化 {created_count} 条默认规则"}
