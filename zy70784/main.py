from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from io import BytesIO
from openpyxl import Workbook

from database import get_db, init_db, Task, RiskFragment, EraseRule, OperationLog
from schemas import (
    TaskCreate, TaskResponse, TaskDetailResponse, TaskListResponse,
    AutoProcessRequest, ManualReviewRequest, WithdrawRequest,
    EraseRuleCreate, EraseRuleResponse
)
from eraser import SQLEraser

app = FastAPI(title="SQL参数擦除风险片段复检后端API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()
    db = next(get_db())
    if db.query(EraseRule).count() == 0:
        default_rules = [
            EraseRule(
                rule_name="手机号",
                pattern=r"^1[3-9]\d{9}$",
                replacement="[手机号]",
                risk_level="high"
            ),
            EraseRule(
                rule_name="中文姓名",
                pattern=r"^[\u4e00-\u9fa5]{2,4}$",
                replacement="[姓名]",
                risk_level="high"
            ),
            EraseRule(
                rule_name="身份证号",
                pattern=r"^\d{17}[\dXx]$",
                replacement="[身份证号]",
                risk_level="high"
            ),
            EraseRule(
                rule_name="邮箱",
                pattern=r"^[\w.-]+@[\w.-]+\.\w+$",
                replacement="[邮箱]",
                risk_level="medium"
            ),
            EraseRule(
                rule_name="银行卡号",
                pattern=r"^\d{16,19}$",
                replacement="[银行卡号]",
                risk_level="high"
            )
        ]
        db.add_all(default_rules)
        db.commit()
    db.close()


def get_eraser(db: Session):
    rules = db.query(EraseRule).filter(EraseRule.is_enabled == True).all()
    rule_dicts = [
        {
            "id": r.id,
            "rule_name": r.rule_name,
            "pattern": r.pattern,
            "replacement": r.replacement,
            "risk_level": r.risk_level,
            "is_enabled": r.is_enabled
        }
        for r in rules
    ]
    return SQLEraser(rule_dicts)


def log_operation(db: Session, task_id: int, operation_type: str, operator: str,
                  from_status: Optional[str] = None, to_status: Optional[str] = None,
                  comments: Optional[str] = None, original_data: Optional[dict] = None,
                  modified_data: Optional[dict] = None):
    log = OperationLog(
        task_id=task_id,
        operation_type=operation_type,
        operator=operator,
        from_status=from_status,
        to_status=to_status,
        comments=comments,
        original_data=original_data,
        modified_data=modified_data
    )
    db.add(log)
    db.commit()


@app.post("/api/v1/tasks", response_model=TaskResponse)
def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        sql_content=task_data.sql_content,
        params=task_data.params,
        status="pending",
        created_by=task_data.created_by
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    log_operation(
        db, task.id, "create", task_data.created_by,
        to_status="pending", original_data=task_data.model_dump()
    )
    
    return task


@app.get("/api/v1/tasks", response_model=TaskListResponse)
def list_tasks(
    status: Optional[str] = None,
    created_by: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    
    if status:
        query = query.filter(Task.status == status)
    if created_by:
        query = query.filter(Task.created_by == created_by)
    
    total = query.count()
    items = query.order_by(Task.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()
    
    return TaskListResponse(total=total, page=page, page_size=page_size, items=items)


@app.get("/api/v1/tasks/{task_id}", response_model=TaskDetailResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    risk_fragments = [
        {
            "id": f.id,
            "original_value": f.original_value,
            "replaced_value": f.replaced_value,
            "rule_name": f.rule.rule_name if f.rule else None,
            "risk_level": f.risk_level,
            "is_verified": f.is_verified,
            "position": [f.position_start, f.position_end]
        }
        for f in task.risk_fragments
    ]
    
    operation_logs = [
        {
            "id": log.id,
            "operation_type": log.operation_type,
            "operator": log.operator,
            "from_status": log.from_status,
            "to_status": log.to_status,
            "comments": log.comments,
            "created_at": log.created_at
        }
        for log in task.operation_logs
    ]
    
    return TaskDetailResponse(
        id=task.id,
        sql_content=task.sql_content,
        params=task.params,
        processed_sql=task.processed_sql,
        status=task.status,
        created_by=task.created_by,
        created_at=task.created_at,
        updated_at=task.updated_at,
        risk_fragments=risk_fragments,
        operation_logs=operation_logs
    )


@app.post("/api/v1/tasks/{task_id}/auto-process", response_model=TaskDetailResponse)
def auto_process_task(task_id: int, req: AutoProcessRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status not in ["pending"]:
        raise HTTPException(status_code=400, detail=f"任务状态{task.status}不允许自动处理")
    
    from_status = task.status
    task.status = "processing"
    
    eraser = get_eraser(db)
    risk_matches = eraser.find_risk_fragments(task.sql_content, task.params)
    
    db.query(RiskFragment).filter(RiskFragment.task_id == task_id).delete()
    
    for match in risk_matches:
        fragment = RiskFragment(
            task_id=task.id,
            original_value=match.original_value,
            replaced_value=match.replaced_value,
            rule_id=match.rule_id,
            position_start=match.position_start,
            position_end=match.position_end,
            risk_level=match.risk_level,
            is_verified=False
        )
        db.add(fragment)
    
    task.processed_sql = eraser.apply_erasure(task.sql_content, risk_matches)
    
    db.commit()
    db.refresh(task)
    
    log_operation(
        db, task.id, "auto_process", req.processor,
        from_status=from_status, to_status="processing",
        original_data={"sql_content": task.sql_content},
        modified_data={"processed_sql": task.processed_sql, "risk_count": len(risk_matches)}
    )
    
    return get_task(task_id, db)


@app.post("/api/v1/tasks/{task_id}/manual-review", response_model=TaskDetailResponse)
def manual_review_task(task_id: int, req: ManualReviewRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status not in ["processing", "reviewed"]:
        raise HTTPException(status_code=400, detail=f"任务状态{task.status}不允许人工复核")
    
    from_status = task.status
    original_processed = task.processed_sql
    
    task.processed_sql = req.processed_sql
    
    if req.conclusion == "approved":
        task.status = "reviewed"
        for fragment in task.risk_fragments:
            fragment.is_verified = True
    elif req.conclusion == "rejected":
        task.status = "processing"
    
    db.commit()
    db.refresh(task)
    
    log_operation(
        db, task.id, "manual_review", req.reviewer,
        from_status=from_status, to_status=task.status,
        comments=req.comments,
        original_data={"processed_sql": original_processed},
        modified_data={"processed_sql": req.processed_sql, "conclusion": req.conclusion}
    )
    
    return get_task(task_id, db)


@app.post("/api/v1/tasks/{task_id}/complete", response_model=TaskDetailResponse)
def complete_task(task_id: int, operator: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status not in ["reviewed"]:
        raise HTTPException(status_code=400, detail=f"任务状态{task.status}不允许完成")
    
    from_status = task.status
    task.status = "completed"
    db.commit()
    db.refresh(task)
    
    log_operation(
        db, task.id, "complete", operator,
        from_status=from_status, to_status="completed"
    )
    
    return get_task(task_id, db)


@app.post("/api/v1/tasks/{task_id}/withdraw", response_model=TaskDetailResponse)
def withdraw_task(task_id: int, req: WithdrawRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status == "completed":
        raise HTTPException(status_code=400, detail="已完成任务不可撤回")
    
    if task.status == "withdrawn":
        raise HTTPException(status_code=400, detail="任务已撤回")
    
    from_status = task.status
    task.status = "withdrawn"
    db.commit()
    db.refresh(task)
    
    log_operation(
        db, task.id, "withdraw", req.operator,
        from_status=from_status, to_status="withdrawn",
        comments=req.reason
    )
    
    return get_task(task_id, db)


@app.get("/api/v1/tasks/{task_id}/export")
def export_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    wb = Workbook()
    ws = wb.active
    ws.title = "擦除报告"
    
    ws.append(["SQL参数擦除风险片段复检报告"])
    ws.append(["任务ID", task.id])
    ws.append(["状态", task.status])
    ws.append(["创建人", task.created_by])
    ws.append(["创建时间", task.created_at.strftime("%Y-%m-%d %H:%M:%S")])
    ws.append([])
    
    ws.append(["原始SQL"])
    ws.append([task.sql_content])
    ws.append([])
    
    ws.append(["处理后SQL"])
    ws.append([task.processed_sql or ""])
    ws.append([])
    
    ws.append(["风险片段明细"])
    ws.append(["原始值", "替换值", "规则名称", "风险等级", "是否验证"])
    for f in task.risk_fragments:
        ws.append([
            f.original_value,
            f.replaced_value or "",
            f.rule.rule_name if f.rule else "",
            f.risk_level,
            "是" if f.is_verified else "否"
        ])
    ws.append([])
    
    ws.append(["操作日志"])
    ws.append(["时间", "操作类型", "操作人", "原状态", "新状态", "备注"])
    for log in task.operation_logs:
        ws.append([
            log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            log.operation_type,
            log.operator,
            log.from_status or "",
            log.to_status or "",
            log.comments or ""
        ])
    
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=task_{task_id}_report.xlsx"}
    )


@app.get("/api/v1/rules", response_model=List[EraseRuleResponse])
def list_rules(db: Session = Depends(get_db)):
    return db.query(EraseRule).order_by(EraseRule.id).all()


@app.post("/api/v1/rules", response_model=EraseRuleResponse)
def create_rule(rule_data: EraseRuleCreate, db: Session = Depends(get_db)):
    rule = EraseRule(**rule_data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@app.put("/api/v1/rules/{rule_id}/toggle")
def toggle_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(EraseRule).filter(EraseRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    rule.is_enabled = not rule.is_enabled
    db.commit()
    return {"id": rule_id, "is_enabled": rule.is_enabled}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
