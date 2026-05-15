from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import get_db
from models import Report, Batch, ReplayResult, GatewayErrorExtract, RuleVersion
from schemas import ReportCreate, Report as ReportSchema

router = APIRouter(prefix="/reports", tags=["报告生成"])

def _generate_next_steps(batch: Batch, results: List[ReplayResult]) -> List[Dict[str, Any]]:
    next_steps = []
    
    if batch.blocked_count > 0:
        blocked_for_approval = [r for r in results if r.approval_opinion_missing]
        if blocked_for_approval:
            next_steps.append({
                "priority": "high",
                "action": "补充审批意见",
                "description": f"发现 {len(blocked_for_approval)} 条记录因缺少审批意见被拦截，请联系责任团队补充审批意见后重新重放",
                "affected_count": len(blocked_for_approval)
            })
    
    other_blocked = [r for r in results if r.status == "blocked" and not r.approval_opinion_missing]
    if other_blocked:
        block_codes = {}
        for r in other_blocked:
            if r.block_code:
                block_codes[r.block_code] = block_codes.get(r.block_code, 0) + 1
        
        for code, count in block_codes.items():
            next_steps.append({
                "priority": "medium",
                "action": f"处理拦截代码 {code}",
                "description": f"有 {count} 条记录因规则 '{code}' 被拦截，请核查数据质量或调整校验规则",
                "affected_count": count
            })
    
    if batch.execution_time_ms and batch.execution_time_ms > 30000:
        next_steps.append({
            "priority": "low",
            "action": "性能优化",
            "description": f"批次执行时间过长({batch.execution_time_ms/1000:.1f}秒)，建议优化重放引擎或分批处理",
            "affected_count": batch.total_count
        })
    
    if not next_steps:
        next_steps.append({
            "priority": "low",
            "action": "完成归档",
            "description": "批次处理完成，所有记录均通过校验，建议完成数据归档",
            "affected_count": batch.success_count
        })
    
    return next_steps

def _generate_before_summary(extracts: List[GatewayErrorExtract]) -> Dict[str, Any]:
    total = len(extracts)
    error_codes = {}
    approval_opinion_count = 0
    trace_id_count = 0
    
    for e in extracts:
        if e.error_code:
            error_codes[e.error_code] = error_codes.get(e.error_code, 0) + 1
        if e.approval_opinion and e.approval_opinion not in ["", "null"]:
            approval_opinion_count += 1
        if e.trace_id:
            trace_id_count += 1
    
    return {
        "total_count": total,
        "error_code_distribution": error_codes,
        "has_approval_opinion": approval_opinion_count,
        "approval_opinion_missing": total - approval_opinion_count,
        "has_trace_id": trace_id_count,
        "trace_id_missing": total - trace_id_count
    }

def _generate_after_summary(results: List[ReplayResult]) -> Dict[str, Any]:
    total = len(results)
    success = len([r for r in results if r.status == "success"])
    blocked = len([r for r in results if r.status == "blocked"])
    approved = len([r for r in results if r.status == "approved"])
    rejected = len([r for r in results if r.status == "rejected"])
    approval_opinion_missing = len([r for r in results if r.approval_opinion_missing])
    
    matched_rules = {}
    for r in results:
        for rule in r.matched_rules or []:
            matched_rules[rule] = matched_rules.get(rule, 0) + 1
    
    return {
        "total_count": total,
        "success_count": success,
        "blocked_count": blocked,
        "approved_count": approved,
        "rejected_count": rejected,
        "approval_opinion_missing": approval_opinion_missing,
        "matched_rules_distribution": matched_rules
    }

@router.post("/", response_model=ReportSchema)
def generate_report(
    report_data: ReportCreate,
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == report_data.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    results = db.query(ReplayResult).filter(ReplayResult.batch_id == report_data.batch_id).all()
    extracts = db.query(GatewayErrorExtract).filter(GatewayErrorExtract.batch_id == report_data.batch_id).all()
    
    before_summary = _generate_before_summary(extracts)
    after_summary = _generate_after_summary(results)
    next_steps = _generate_next_steps(batch, results)
    
    content = {
        "batch_info": {
            "batch_number": batch.batch_number,
            "status": batch.status,
            "created_by": batch.created_by,
            "started_at": batch.started_at.isoformat() if batch.started_at else None,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None
        },
        "comparison": {
            "before": before_summary,
            "after": after_summary
        },
        "performance": {
            "execution_time_ms": batch.execution_time_ms,
            "avg_time_per_record_ms": batch.execution_time_ms / len(results) if results and batch.execution_time_ms else 0
        },
        "blocked_details": []
    }
    
    for r in results:
        if r.status == "blocked":
            extract = db.query(GatewayErrorExtract).filter(GatewayErrorExtract.id == r.error_extract_id).first()
            content["blocked_details"].append({
                "trace_id": extract.trace_id if extract else None,
                "error_code": extract.error_code if extract else None,
                "block_code": r.block_code,
                "block_reason": r.block_reason,
                "approval_opinion_missing": r.approval_opinion_missing,
                "matched_rules": r.matched_rules
            })
    
    report = Report(
        batch_id=report_data.batch_id,
        report_type=report_data.report_type,
        content=content,
        before_summary=before_summary,
        after_summary=after_summary,
        execution_time_ms=batch.execution_time_ms or 0,
        next_steps=next_steps,
        generated_by="system"
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return report

@router.get("/", response_model=List[ReportSchema])
def list_reports(
    batch_id: int = None,
    report_type: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Report)
    
    if batch_id:
        query = query.filter(Report.batch_id == batch_id)
    if report_type:
        query = query.filter(Report.report_type == report_type)
    
    return query.order_by(Report.generated_at.desc()).offset(skip).limit(limit).all()

@router.get("/{report_id}", response_model=ReportSchema)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report

@router.get("/{report_id}/comparison")
def get_report_comparison(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    return {
        "before_processing": report.before_summary,
        "after_processing": report.after_summary,
        "execution_time_ms": report.execution_time_ms
    }

@router.get("/{report_id}/next-steps")
def get_report_next_steps(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    return {
        "next_steps": report.next_steps
    }

@router.get("/{report_id}/rule-version")
def get_report_rule_version(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    batch = db.query(Batch).filter(Batch.id == report.batch_id).first()
    if not batch or not batch.rule_version_id:
        return {
            "using_default_rules": True,
            "rule_version": None,
            "note": "该批次使用默认规则进行处理"
        }
    
    rule_version = db.query(RuleVersion).filter(RuleVersion.id == batch.rule_version_id).first()
    
    return {
        "using_default_rules": False,
        "rule_version": {
            "id": rule_version.id,
            "version": rule_version.version,
            "rule_name": rule_version.rule_name,
            "description": rule_version.description,
            "effective_from": rule_version.effective_from,
            "effective_to": rule_version.effective_to,
            "is_active": rule_version.is_active
        },
        "rules_applied": rule_version.rules if rule_version else None
    }
