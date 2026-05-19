from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

from database import engine, get_db, Base
from models import DNSPreviewTask, DNSRecordDiff
from schemas import (
    DNSPreviewTaskCreate, DNSPreviewTask as DNSPreviewTaskSchema,
    StatusTransition, ManualCorrection, TaskClose,
    PreviewReport
)
from crud import (
    create_task, get_task, get_tasks,
    update_task_status, manual_correct_task,
    close_task, rollback_task, get_task_logs, log_operation
)
from core_logic import StatusMachine, TTLRiskEvaluator

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DNS切换预演TTL API", description="DNS切换预演系统，用于TTL风险评估和切换流程管理", version="1.0.0")


@app.post("/api/tasks/", response_model=DNSPreviewTaskSchema, summary="创建DNS切换预演任务")
def create_dns_task(task: DNSPreviewTaskCreate, db: Session = Depends(get_db)):
    return create_task(db, task)


@app.get("/api/tasks/", response_model=List[DNSPreviewTaskSchema], summary="查询任务列表")
def read_tasks(skip: int = 0, limit: int = 100, status: Optional[str] = None, domain: Optional[str] = None, db: Session = Depends(get_db)):
    tasks = get_tasks(db, skip=skip, limit=limit, status=status, domain=domain)
    return tasks


@app.get("/api/tasks/{task_id}", response_model=DNSPreviewTaskSchema, summary="查询单个任务详情")
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@app.post("/api/tasks/{task_id}/status", response_model=DNSPreviewTaskSchema, summary="推进任务状态")
def transition_task_status(task_id: int, transition: StatusTransition, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if not StatusMachine.can_transition(task.status, transition.target_status):
        valid_next = StatusMachine.get_valid_next_statuses(task.status)
        error_detail = f"无效的状态转换: 从 {task.status} 无法转换到 {transition.target_status}。有效状态: {', '.join(valid_next)}"
        log_operation(
            db, task_id, "status_change:failed", transition.operator,
            original_input=f"target_status={transition.target_status}",
            conclusion=error_detail,
            remark=transition.remark
        )
        db.commit()
        raise HTTPException(status_code=400, detail=error_detail)
    
    return update_task_status(db, task_id, transition.target_status, transition.operator, transition.remark)


@app.get("/api/tasks/{task_id}/valid-statuses", summary="获取任务可转换的状态列表")
def get_valid_statuses(task_id: int, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {
        "current_status": task.status,
        "valid_next_statuses": StatusMachine.get_valid_next_statuses(task.status)
    }


@app.post("/api/tasks/{task_id}/correct", response_model=DNSPreviewTaskSchema, summary="人工修正任务")
def correct_task(task_id: int, correction: ManualCorrection, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return manual_correct_task(db, task_id, correction)


@app.post("/api/tasks/{task_id}/close", response_model=DNSPreviewTaskSchema, summary="关闭/撤回任务")
def close_dns_task(task_id: int, close_data: TaskClose, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return close_task(db, task_id, close_data.operator, close_data.reason, close_data.conclusion)


@app.post("/api/tasks/{task_id}/rollback", response_model=DNSPreviewTaskSchema, summary="执行回滚")
def rollback_dns_task(task_id: int, operator: str, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status != "executing":
        error_detail = "只有执行中状态的任务才能回滚"
        log_operation(
            db, task_id, "rollback:failed", operator,
            original_input=f"current_status={task.status}",
            conclusion=error_detail
        )
        db.commit()
        raise HTTPException(status_code=400, detail=error_detail)
    
    return rollback_task(db, task_id, operator)


@app.get("/api/tasks/{task_id}/report", response_model=PreviewReport, summary="获取预演报告")
def get_preview_report(task_id: int, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    high_risk_count = sum(1 for r in task.records if r.ttl_risk)
    
    return PreviewReport(
        task_id=task.id,
        domain=task.domain,
        status=task.status,
        risk_level=task.risk_level,
        risk_reason=task.risk_reason,
        record_diffs=len(task.records),
        high_risk_records=high_risk_count,
        conclusion=task.conclusion,
        created_by=task.created_by,
        created_at=task.created_at
    )


@app.get("/api/tasks/{task_id}/export", summary="导出任务报告CSV")
def export_task_report(task_id: int, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["DNS切换预演报告"])
    writer.writerow(["任务ID", task.id])
    writer.writerow(["域名", task.domain])
    writer.writerow(["记录类型", task.record_type])
    writer.writerow(["旧目标", task.old_target])
    writer.writerow(["新目标", task.new_target])
    writer.writerow(["TTL策略", task.ttl_strategy])
    writer.writerow(["当前状态", task.status])
    writer.writerow(["风险等级", task.risk_level])
    writer.writerow(["风险原因", task.risk_reason])
    writer.writerow(["创建人", task.created_by])
    writer.writerow(["创建时间", task.created_at])
    writer.writerow([])
    
    writer.writerow(["记录详情"])
    writer.writerow(["记录名", "类型", "旧值", "新值", "旧TTL", "新TTL", "差异状态", "TTL风险", "风险原因"])
    for r in task.records:
        writer.writerow([
            r.record_name, r.record_type, r.old_value, r.new_value,
            r.old_ttl, r.new_ttl, r.diff_status, r.ttl_risk, r.ttl_risk_reason
        ])
    writer.writerow([])
    
    writer.writerow(["操作日志"])
    writer.writerow(["时间", "操作人", "操作类型", "结论", "备注"])
    logs = get_task_logs(db, task_id)
    for log in logs:
        writer.writerow([log.created_at, log.operator, log.operation, log.conclusion, log.remark])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=dns_preview_{task_id}.csv"}
    )


@app.get("/api/tasks/{task_id}/logs", summary="获取任务操作日志")
def read_task_logs(task_id: int, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return get_task_logs(db, task_id)


@app.post("/api/ttl/evaluate", summary="批量评估TTL风险")
def evaluate_ttl(records: List[dict], db: Session = Depends(get_db)):
    from schemas import DNSRecordDiffCreate
    record_objs = [DNSRecordDiffCreate(**r) for r in records]
    assessments, overall_risk = TTLRiskEvaluator.evaluate_batch(record_objs)
    return {
        "overall_risk": overall_risk,
        "assessments": assessments
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "dns-preview-api"}
