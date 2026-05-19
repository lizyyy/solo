import uuid
import json
import csv
from io import StringIO
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import init_db, get_db, AccessLog, FilterRule, PurificationReport, AuditLog, FailedImportLog
from core import LogParser, CrawlerDetector, SuspiciousGrouper, AuditManager

init_db()
app = FastAPI(title="访问日志爬虫过滤保留样本API", version="1.0.0")

class LogCreateRequest(BaseModel):
    ip: str
    user_agent: Optional[str] = None
    path: str
    method: Optional[str] = "GET"
    status_code: Optional[int] = 200
    request_time: Optional[datetime] = None
    referer: Optional[str] = None

class LogResponse(BaseModel):
    id: int
    ip: str
    user_agent: Optional[str]
    path: str
    method: str
    status_code: int
    is_crawler: Optional[bool]
    crawler_confidence: float
    status: str
    group_id: Optional[str]

class RuleCreateRequest(BaseModel):
    name: str
    rule_type: str
    pattern: str
    confidence: float = 1.0
    description: Optional[str] = None

class RuleResponse(BaseModel):
    id: int
    name: str
    rule_type: str
    pattern: str
    confidence: float
    is_active: bool

class ReportResponse(BaseModel):
    id: int
    batch_id: str
    total_logs: int
    crawler_count: int
    human_count: int
    pending_count: int
    status: str
    created_by: str

class ManualCorrectionRequest(BaseModel):
    log_ids: List[int]
    is_crawler: bool
    operator: str
    reason: str

class StatusUpdateRequest(BaseModel):
    report_id: int
    status: str
    operator: str
    reason: Optional[str] = None

class BatchOperationResponse(BaseModel):
    success: int
    failed: int
    batch_id: Optional[str] = None
    message: str

class LogCreateResponse(BaseModel):
    id: int
    is_crawler: Optional[bool]
    crawler_confidence: float
    status: str
    message: str

class FailedLogResolutionRequest(BaseModel):
    resolution_status: str
    resolution_note: Optional[str] = None
    resolved_by: str

@app.post("/api/logs", response_model=LogCreateResponse)
def create_single_log(log_request: LogCreateRequest, db: Session = Depends(get_db)):
    try:
        log_data = {
            "ip": log_request.ip,
            "user_agent": log_request.user_agent,
            "path": log_request.path,
            "method": log_request.method,
            "status_code": log_request.status_code,
            "request_time": log_request.request_time or datetime.utcnow(),
            "referer": log_request.referer,
            "raw_log": f"{log_request.ip} - - [{log_request.request_time or datetime.utcnow()}] \"{log_request.method} {log_request.path} HTTP/1.1\" {log_request.status_code}"
        }
        is_crawler, confidence, reasons = CrawlerDetector.detect(db, log_data)
        log = AccessLog(
            ip=log_data["ip"],
            user_agent=log_data.get("user_agent"),
            path=log_data["path"],
            method=log_data.get("method", "GET"),
            status_code=log_data.get("status_code", 200),
            request_time=log_data.get("request_time"),
            referer=log_data.get("referer"),
            raw_log=log_data["raw_log"],
            is_crawler=is_crawler,
            crawler_confidence=confidence,
            crawler_type=",".join(reasons) if reasons else None,
            status="classified" if confidence >= 0.8 else "pending_review"
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        SuspiciousGrouper.assign_groups([log])
        db.commit()
        return LogCreateResponse(
            id=log.id,
            is_crawler=log.is_crawler,
            crawler_confidence=log.crawler_confidence,
            status=log.status,
            message="日志创建成功"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"创建日志失败: {str(e)}")

@app.post("/api/logs/import", response_model=BatchOperationResponse)
async def import_logs(file: UploadFile = File(...), operator: str = "system", db: Session = Depends(get_db)):
    content = await file.read()
    lines = content.decode().splitlines()
    success = 0
    failed = 0
    batch_id = str(uuid.uuid4())[:8]
    for line_num, line in enumerate(lines, 1):
        try:
            log_data = LogParser.parse_nginx_log(line) or LogParser.parse_json_log(line)
            if log_data:
                is_crawler, confidence, reasons = CrawlerDetector.detect(db, log_data)
                log = AccessLog(
                    ip=log_data["ip"],
                    user_agent=log_data.get("user_agent"),
                    path=log_data["path"],
                    method=log_data.get("method", "GET"),
                    status_code=log_data.get("status_code", 200),
                    request_time=log_data.get("request_time", datetime.utcnow()),
                    referer=log_data.get("referer"),
                    response_time=log_data.get("response_time"),
                    raw_log=log_data["raw_log"],
                    is_crawler=is_crawler,
                    crawler_confidence=confidence,
                    crawler_type=",".join(reasons) if reasons else None,
                    status="classified" if confidence >= 0.8 else "pending_review"
                )
                db.add(log)
                success += 1
            else:
                failed_log = FailedImportLog(
                    raw_content=line,
                    error_type="parse_error",
                    error_message="无法解析日志格式，既不是Nginx格式也不是JSON格式",
                    batch_id=batch_id,
                    operator=operator,
                    line_number=line_num
                )
                db.add(failed_log)
                failed += 1
        except Exception as e:
            failed_log = FailedImportLog(
                raw_content=line,
                error_type=type(e).__name__,
                error_message=str(e),
                batch_id=batch_id,
                operator=operator,
                line_number=line_num
            )
            db.add(failed_log)
            failed += 1
    db.commit()
    all_logs = db.query(AccessLog).filter(AccessLog.group_id == None).all()
    SuspiciousGrouper.assign_groups(all_logs)
    db.commit()
    report = PurificationReport(
        batch_id=batch_id,
        total_logs=success,
        crawler_count=db.query(AccessLog).filter(AccessLog.is_crawler == True).count(),
        human_count=db.query(AccessLog).filter(AccessLog.is_crawler == False).count(),
        pending_count=db.query(AccessLog).filter(AccessLog.status == "pending_review").count(),
        status="processing",
        created_by=operator
    )
    db.add(report)
    db.commit()
    return BatchOperationResponse(success=success, failed=failed, batch_id=batch_id, message=f"导入完成，批次ID: {batch_id}")

@app.get("/api/logs", response_model=List[LogResponse])
def list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    is_crawler: Optional[bool] = None,
    min_confidence: Optional[float] = None,
    ip: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AccessLog)
    if status:
        query = query.filter(AccessLog.status == status)
    if is_crawler is not None:
        query = query.filter(AccessLog.is_crawler == is_crawler)
    if min_confidence is not None:
        query = query.filter(AccessLog.crawler_confidence >= min_confidence)
    if ip:
        query = query.filter(AccessLog.ip.like(f"%{ip}%"))
    offset = (page - 1) * page_size
    logs = query.order_by(desc(AccessLog.created_at)).offset(offset).limit(page_size).all()
    return logs

@app.get("/api/logs/{log_id}")
def get_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(AccessLog).filter(AccessLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    audit_logs = db.query(AuditLog).filter(AuditLog.log_id == log_id).order_by(AuditLog.created_at.desc()).all()
    return {
        "log": log,
        "audit_history": audit_logs
    }

@app.post("/api/logs/manual-correction", response_model=BatchOperationResponse)
def manual_correction(request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    success = 0
    failed = 0
    for log_id in request.log_ids:
        log = db.query(AccessLog).filter(AccessLog.id == log_id).first()
        if log:
            old_status = log.status
            old_is_crawler = log.is_crawler
            log.is_crawler = request.is_crawler
            log.status = "manually_corrected"
            AuditManager.log_action(
                db, "manual_correction", request.operator,
                old_value=f"is_crawler={old_is_crawler}, status={old_status}",
                new_value=f"is_crawler={request.is_crawler}, status=manually_corrected",
                reason=request.reason, log_id=log_id
            )
            success += 1
        else:
            failed += 1
    db.commit()
    return BatchOperationResponse(success=success, failed=failed, message="人工修正完成")

@app.post("/api/logs/withdraw", response_model=BatchOperationResponse)
def withdraw_logs(log_ids: List[int], operator: str, reason: str, db: Session = Depends(get_db)):
    success = 0
    failed = 0
    for log_id in log_ids:
        log = db.query(AccessLog).filter(AccessLog.id == log_id).first()
        if log:
            old_status = log.status
            log.status = "withdrawn"
            AuditManager.log_action(
                db, "withdraw", operator,
                old_value=old_status, new_value="withdrawn",
                reason=reason, log_id=log_id
            )
            success += 1
        else:
            failed += 1
    db.commit()
    return BatchOperationResponse(success=success, failed=failed, message="撤回完成")

@app.get("/api/logs/export/sample")
def export_samples(
    sample_size: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AccessLog)
    if status:
        query = query.filter(AccessLog.status == status)
    logs = query.order_by(func.random()).limit(sample_size).all()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "ip", "user_agent", "path", "method", "status_code", "is_crawler", "confidence", "group_id", "raw_log"])
    for log in logs:
        writer.writerow([log.id, log.ip, log.user_agent, log.path, log.method, log.status_code, log.is_crawler, log.crawler_confidence, log.group_id, log.raw_log])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=log_samples.csv"})

@app.get("/api/logs/export/purified")
def export_purified_logs(
    exclude_crawler: bool = True,
    exclude_withdrawn: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(AccessLog)
    if exclude_crawler:
        query = query.filter(AccessLog.is_crawler == False)
    if exclude_withdrawn:
        query = query.filter(AccessLog.status != "withdrawn")
    logs = query.all()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["ip", "user_agent", "path", "method", "status_code", "request_time"])
    for log in logs:
        writer.writerow([log.ip, log.user_agent, log.path, log.method, log.status_code, log.request_time.isoformat()])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=purified_logs.csv"})

@app.post("/api/rules", response_model=RuleResponse)
def create_rule(rule: RuleCreateRequest, db: Session = Depends(get_db)):
    db_rule = FilterRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.get("/api/rules", response_model=List[RuleResponse])
def list_rules(db: Session = Depends(get_db)):
    return db.query(FilterRule).all()

@app.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(FilterRule).filter(FilterRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    db.delete(rule)
    db.commit()
    return {"message": "规则已删除"}

@app.get("/api/reports", response_model=List[ReportResponse])
def list_reports(db: Session = Depends(get_db)):
    return db.query(PurificationReport).order_by(desc(PurificationReport.created_at)).all()

@app.get("/api/reports/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(PurificationReport).filter(PurificationReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report

@app.post("/api/reports/{report_id}/advance-status")
def advance_report_status(report_id: int, request: StatusUpdateRequest, db: Session = Depends(get_db)):
    report = db.query(PurificationReport).filter(PurificationReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    valid_transitions = {
        "processing": ["reviewing", "closed"],
        "reviewing": ["completed", "closed", "processing"],
        "completed": ["closed"]
    }
    if request.status not in valid_transitions.get(report.status, []):
        raise HTTPException(status_code=400, detail=f"无法从 {report.status} 转换到 {request.status}")
    old_status = report.status
    report.status = request.status
    AuditManager.log_action(
        db, "status_change", request.operator,
        old_value=old_status, new_value=request.status,
        reason=request.reason, report_id=report_id
    )
    db.commit()
    return {"message": "状态已更新", "old_status": old_status, "new_status": request.status}

@app.post("/api/reports/{report_id}/close")
def close_report(report_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    report = db.query(PurificationReport).filter(PurificationReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    old_status = report.status
    report.status = "closed"
    AuditManager.log_action(
        db, "close_report", operator,
        old_value=old_status, new_value="closed",
        reason=reason, report_id=report_id
    )
    db.commit()
    return {"message": "报告已关闭"}

@app.get("/api/statistics/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_logs = db.query(AccessLog).count()
    crawler_logs = db.query(AccessLog).filter(AccessLog.is_crawler == True).count()
    human_logs = db.query(AccessLog).filter(AccessLog.is_crawler == False).count()
    pending_logs = db.query(AccessLog).filter(AccessLog.status == "pending_review").count()
    top_crawler_ips = db.query(
        AccessLog.ip, func.count(AccessLog.id).label("count")
    ).filter(AccessLog.is_crawler == True).group_by(AccessLog.ip).order_by(desc("count")).limit(10).all()
    top_crawler_ua = db.query(
        AccessLog.user_agent, func.count(AccessLog.id).label("count")
    ).filter(AccessLog.is_crawler == True).group_by(AccessLog.user_agent).order_by(desc("count")).limit(10).all()
    return {
        "total_logs": total_logs,
        "crawler_logs": crawler_logs,
        "human_logs": human_logs,
        "pending_logs": pending_logs,
        "crawler_ratio": crawler_logs / total_logs if total_logs > 0 else 0,
        "top_crawler_ips": [{"ip": ip, "count": count} for ip, count in top_crawler_ips],
        "top_crawler_user_agents": [{"user_agent": ua, "count": count} for ua, count in top_crawler_ua]
    }

@app.get("/api/failed-logs")
def list_failed_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    batch_id: Optional[str] = None,
    resolution_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FailedImportLog)
    if batch_id:
        query = query.filter(FailedImportLog.batch_id == batch_id)
    if resolution_status:
        query = query.filter(FailedImportLog.resolution_status == resolution_status)
    offset = (page - 1) * page_size
    logs = query.order_by(desc(FailedImportLog.created_at)).offset(offset).limit(page_size).all()
    return logs

@app.get("/api/failed-logs/{log_id}")
def get_failed_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(FailedImportLog).filter(FailedImportLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="失败日志不存在")
    return log

@app.put("/api/failed-logs/{log_id}/resolve")
def resolve_failed_log(log_id: int, request: FailedLogResolutionRequest, db: Session = Depends(get_db)):
    log = db.query(FailedImportLog).filter(FailedImportLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="失败日志不存在")
    log.resolution_status = request.resolution_status
    log.resolution_note = request.resolution_note
    log.resolved_by = request.resolved_by
    log.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "处理完成", "id": log_id, "status": request.resolution_status}

@app.get("/api/audit-logs")
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    offset = (page - 1) * page_size
    logs = db.query(AuditLog).order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size).all()
    return logs

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
