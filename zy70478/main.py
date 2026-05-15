from typing import List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
from models import SessionLocal, init_db
from event_converger import EventConverger
from repository import (
    EventRepository,
    BatchRepository,
    RuleRepository,
    ReportRepository,
    OutsourcingAcceptanceRepository,
    AuditLogRepository
)

app = FastAPI(title="事件收敛器后端服务", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/batches/submit", response_model=schemas.BatchSubmitResponse, summary="提交事件批次进行收敛处理")
async def submit_batch(
    batch_data: schemas.BatchCreate,
    db: Session = Depends(get_db)
):
    converger = EventConverger(db)
    result = converger.process_batch(batch_data)
    
    if result["is_duplicate"]:
        batch_repo = BatchRepository(db)
        batch_details = batch_repo.get_batch_with_details(result["existing_batch"].batch_id)
        
        return schemas.BatchSubmitResponse(
            batch_id=result["existing_batch"].batch_id,
            status="duplicate",
            message="该批次内容已存在，复用旧结果",
            is_duplicate=True,
            existing_result=schemas.BatchDetailResponse(
                **{k: v for k, v in batch_details["batch"].__dict__.items() if not k.startswith("_")},
                events=[schemas.EventResponse.model_validate(e) for e in batch_details["events"]],
                reports=[schemas.ProcessingReportResponse.model_validate(r) for r in batch_details["reports"]]
            ),
            conflict_details=result["conflict_details"]
        )
    
    return schemas.BatchSubmitResponse(
        batch_id=result["batch"].batch_id,
        status="completed",
        message="批次处理完成",
        is_duplicate=False
    )


@app.get("/api/batches", response_model=List[schemas.BatchResponse], summary="获取所有批次列表")
async def get_batches(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    batch_repo = BatchRepository(db)
    batches = batch_repo.get_all_batches(skip, limit)
    return [schemas.BatchResponse.model_validate(b) for b in batches]


@app.get("/api/batches/{batch_id}", response_model=schemas.BatchDetailResponse, summary="获取批次详情")
async def get_batch_detail(
    batch_id: str,
    db: Session = Depends(get_db)
):
    batch_repo = BatchRepository(db)
    batch_details = batch_repo.get_batch_with_details(batch_id)
    
    if not batch_details:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    return schemas.BatchDetailResponse(
        **{k: v for k, v in batch_details["batch"].__dict__.items() if not k.startswith("_")},
        events=[schemas.EventResponse.model_validate(e) for e in batch_details["events"]],
        reports=[schemas.ProcessingReportResponse.model_validate(r) for r in batch_details["reports"]]
    )


@app.get("/api/events/{event_id}", response_model=schemas.EventDetailResponse, summary="获取事件详情（含被合并的原始事件）")
async def get_event_detail(
    event_id: int,
    db: Session = Depends(get_db)
):
    event_repo = EventRepository(db)
    event_data = event_repo.get_event_with_merged(event_id)
    
    if not event_data:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    event_dict = {k: v for k, v in event_data["event"].__dict__.items() if not k.startswith("_")}
    return schemas.EventDetailResponse(
        **event_dict,
        merged_events=[schemas.EventResponse.model_validate(e) for e in event_data["merged_events"]]
    )


@app.get("/api/events/risk/{risk_level}", response_model=schemas.RiskLevelQueryResponse, summary="按风险等级查询事件")
async def get_events_by_risk_level(
    risk_level: str,
    db: Session = Depends(get_db)
):
    if risk_level not in ["high", "medium", "low"]:
        raise HTTPException(status_code=400, detail="无效的风险等级，必须是 high/medium/low 之一")
    
    event_repo = EventRepository(db)
    events = event_repo.get_events_by_risk_level(risk_level)
    
    return schemas.RiskLevelQueryResponse(
        risk_level=risk_level,
        total_count=len(events),
        events=[schemas.EventResponse.model_validate(e) for e in events]
    )


@app.get("/api/rules", response_model=List[schemas.ConvergenceRuleResponse], summary="获取所有收敛规则版本")
async def get_all_rules(db: Session = Depends(get_db)):
    rule_repo = RuleRepository(db)
    rules = rule_repo.get_all_rules()
    return [schemas.ConvergenceRuleResponse.model_validate(r) for r in rules]


@app.get("/api/rules/active", response_model=schemas.ConvergenceRuleResponse, summary="获取当前活跃的收敛规则")
async def get_active_rule(db: Session = Depends(get_db)):
    rule_repo = RuleRepository(db)
    rule = rule_repo.get_active_rule()
    if not rule:
        raise HTTPException(status_code=404, detail="没有活跃的规则")
    return schemas.ConvergenceRuleResponse.model_validate(rule)


@app.post("/api/rules", response_model=schemas.ConvergenceRuleResponse, summary="创建新的收敛规则版本")
async def create_rule(
    rule_data: schemas.ConvergenceRuleCreate,
    db: Session = Depends(get_db)
):
    rule_repo = RuleRepository(db)
    existing = rule_repo.get_rule_by_version(rule_data.version)
    if existing:
        raise HTTPException(status_code=400, detail="该版本号已存在")
    
    new_rule = rule_repo.create_rule(rule_data)
    return schemas.ConvergenceRuleResponse.model_validate(new_rule)


@app.put("/api/rules/{version}", response_model=schemas.ConvergenceRuleResponse, summary="更新指定版本的收敛规则")
async def update_rule(
    version: str,
    rule_data: schemas.ConvergenceRuleCreate,
    db: Session = Depends(get_db)
):
    rule_repo = RuleRepository(db)
    updated_rule = rule_repo.update_rule(version, rule_data)
    if not updated_rule:
        raise HTTPException(status_code=404, detail="规则版本不存在")
    return schemas.ConvergenceRuleResponse.model_validate(updated_rule)


@app.get("/api/batches/{batch_id}/report", response_model=List[schemas.ProcessingReportResponse], summary="获取批次处理报告")
async def get_batch_reports(
    batch_id: str,
    db: Session = Depends(get_db)
):
    report_repo = ReportRepository(db)
    reports = report_repo.get_reports_by_batch_id(batch_id)
    return [schemas.ProcessingReportResponse.model_validate(r) for r in reports]


@app.get("/api/batches/{batch_id}/export", response_model=schemas.ExportResultResponse, summary="导出批次处理结果")
async def export_batch_result(
    batch_id: str,
    db: Session = Depends(get_db)
):
    batch_repo = BatchRepository(db)
    batch_details = batch_repo.get_batch_with_details(batch_id)
    
    if not batch_details:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    outsourcing_repo = OutsourcingAcceptanceRepository(db)
    acceptance_records = outsourcing_repo.get_by_batch_id(batch_id)
    
    export_data = {
        "batch_info": {
            "batch_id": batch_details["batch"].batch_id,
            "source": batch_details["batch"].source,
            "rule_version": batch_details["batch"].rule_version,
            "processed_at": batch_details["batch"].processing_completed_at.isoformat() if batch_details["batch"].processing_completed_at else None
        },
        "events": [
            {
                "event_id": e.event_id,
                "original_data": e.original_data,
                "raw_status": e.raw_status,
                "final_status": e.final_status,
                "risk_level": e.risk_level,
                "risk_score": e.risk_score,
                "is_merged": e.is_merged,
                "corrections": e.corrections
            }
            for e in batch_details["events"]
        ],
        "outsourcing_acceptances": [
            {
                "event_id": a.event_id,
                "original_value": a.original_value,
                "corrected_value": a.corrected_value,
                "correction_reason": a.correction_reason,
                "risk_level": a.risk_level
            }
            for a in acceptance_records
        ],
        "reports": [
            {
                "before_summary": r.before_summary,
                "after_summary": r.after_summary,
                "comparison_details": r.comparison_details,
                "next_steps": r.next_steps,
                "summary_stats": r.summary_stats
            }
            for r in batch_details["reports"]
        ]
    }
    
    return schemas.ExportResultResponse(
        batch_id=batch_id,
        export_type="full",
        data=export_data
    )


@app.get("/api/outsourcing/risk/{risk_level}", response_model=List[schemas.OutsourcingAcceptanceResponse], summary="按风险等级查询外包验收记录")
async def get_outsourcing_by_risk(
    risk_level: str,
    db: Session = Depends(get_db)
):
    if risk_level not in ["high", "medium", "low"]:
        raise HTTPException(status_code=400, detail="无效的风险等级")
    
    outsourcing_repo = OutsourcingAcceptanceRepository(db)
    records = outsourcing_repo.get_by_risk_level(risk_level)
    return [schemas.OutsourcingAcceptanceResponse.model_validate(r) for r in records]


@app.get("/api/audit-logs", response_model=List[schemas.AuditLogResponse], summary="获取审计日志")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    audit_repo = AuditLogRepository(db)
    logs = audit_repo.get_all_logs(skip, limit)
    return [schemas.AuditLogResponse.model_validate(l) for l in logs]


@app.get("/api/audit-logs/rules/{version}", response_model=List[schemas.AuditLogResponse], summary="获取指定规则版本的变更历史")
async def get_rule_audit_logs(
    version: str,
    db: Session = Depends(get_db)
):
    audit_repo = AuditLogRepository(db)
    logs = audit_repo.get_logs_by_entity("ConvergenceRule", version)
    return [schemas.AuditLogResponse.model_validate(l) for l in logs]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
