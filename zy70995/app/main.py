from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import init_db, get_db
from .models import (
    User, Submission, Task, Classification, ChangeLog, FieldChange, ExportReport,
    CATEGORY_NORMAL, CATEGORY_PENDING, CATEGORY_INTERCEPTED
)
from .schemas import (
    SubsidySubmission, SubmissionResponse, TaskResponse,
    ReviewRequest, ChangeLogResponse, FieldTraceResponse, ExportReportResponse
)
from .services import (
    classify_submission, log_category_change, log_state_change, log_field_changes
)

init_db()

app = FastAPI(title="学校食堂留餐补贴 API")


@app.get("/")
def root():
    return {"service": "食堂留餐补贴处理服务", "version": "1.0"}


@app.post("/api/submissions", response_model=SubmissionResponse, status_code=201)
def submit_submission(payload: SubsidySubmission, db: Session = Depends(get_db)):
    """接收学校食堂留餐补贴材料，创建任务并开始处理"""
    existing = db.query(Submission).filter(Submission.batch_no == payload.batch_no).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"批次号 {payload.batch_no} 已存在")

    default_user = db.query(User).filter(User.username == "system").first()
    if not default_user:
        default_user = User(username="system", role="system")
        db.add(default_user)
        db.commit()
        db.refresh(default_user)

    submission = Submission(
        batch_no=payload.batch_no,
        submitted_by=default_user.id,
        student_name=payload.student_name,
        student_id=payload.student_id,
        class_name=payload.class_name,
        meal_days=payload.meal_days,
        subsidy_amount=payload.subsidy_amount,
        raw_payload=payload.dict(),
    )
    db.add(submission)
    db.flush()

    task = Task(submission_id=submission.id, state="processing")
    db.add(task)
    db.flush()

    try:
        category, reason, follow_up = classify_submission(db, submission, task)
        classification = Classification(
            task_id=task.id,
            category=category,
            reason=reason,
            follow_up_action=follow_up,
        )
        db.add(classification)

        if category == CATEGORY_NORMAL:
            task.state = "success"
        elif category == CATEGORY_PENDING:
            task.state = "review_pending"
        elif category == CATEGORY_INTERCEPTED:
            task.state = "review_pending"

    except Exception as e:
        task.state = "failed"
        task.error_message = str(e)

    db.commit()
    db.refresh(task)

    return SubmissionResponse(
        submission_id=submission.id,
        task_id=task.id,
        batch_no=payload.batch_no,
        state=task.state,
        message=f"已提交，分类结果：{category}",
    )


@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """查询任务状态和分类结果"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    result = TaskResponse(
        task_id=task.id,
        submission_id=task.submission_id,
        state=task.state,
        classification=None,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )

    if task.classification:
        result.classification = {
            "category": task.classification.category,
            "reason": task.classification.reason,
            "follow_up_action": task.classification.follow_up_action,
        }

    return result


@app.post("/api/tasks/{task_id}/review", response_model=TaskResponse)
def review_task(task_id: int, req: ReviewRequest, db: Session = Depends(get_db)):
    """人工审核：修改结论、状态或字段，同时记录审计日志"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    submission = task.submission
    actor = db.query(User).filter(User.id == req.actor_id).first()
    if not actor:
        actor = User(id=req.actor_id, username=f"user_{req.actor_id}", role="staff")
        db.add(actor)
        db.flush()

    if req.new_category and task.classification:
        old = task.classification.category
        if old != req.new_category:
            log_category_change(
                db, task, submission, req.actor_id, req.reason, old, req.new_category
            )
            task.classification.category = req.new_category

    if req.new_state and task.state != req.new_state:
        log_state_change(
            db, task, submission, req.actor_id, req.reason, task.state, req.new_state
        )
        task.state = req.new_state

    if req.field_updates:
        log_field_changes(db, submission, task, req.actor_id, req.reason, req.field_updates)
        for k, v in req.field_updates.items():
            if hasattr(submission, k):
                setattr(submission, k, v)

    db.commit()
    db.refresh(task)

    return get_task(task_id, db)


@app.get("/api/tasks/{task_id}/audit", response_model=list[ChangeLogResponse])
def get_audit_log(task_id: int, db: Session = Depends(get_db)):
    """查询审计日志：谁改过结论、为什么改、改动前是什么"""
    logs = (
        db.query(ChangeLog)
        .filter(ChangeLog.task_id == task_id)
        .order_by(ChangeLog.created_at.desc())
        .all()
    )
    return [
        ChangeLogResponse(
            id=log.id,
            task_id=log.task_id,
            actor_id=log.actor_id,
            change_type=log.change_type,
            reason=log.reason,
            before_value=log.before_value,
            after_value=log.after_value,
            created_at=log.created_at,
        )
        for log in logs
    ]


@app.get("/api/submissions/{submission_id}/trace/{field_name}", response_model=FieldTraceResponse)
def trace_field(submission_id: int, field_name: str, db: Session = Depends(get_db)):
    """字段级追溯：从原始输入追到当前值"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="提交记录不存在")

    TRACKED = ["student_name", "student_id", "class_name", "meal_days", "subsidy_amount"]
    if field_name not in TRACKED:
        raise HTTPException(status_code=400, detail=f"仅追踪字段：{TRACKED}")

    raw_value = submission.raw_payload.get(field_name)
    current_value = getattr(submission, field_name)

    changes = (
        db.query(FieldChange)
        .filter(FieldChange.submission_id == submission_id, FieldChange.field_name == field_name)
        .order_by(FieldChange.created_at)
        .all()
    )

    history = []
    for c in changes:
        history.append({
            "change_log_id": c.change_log_id,
            "before": c.before_value,
            "after": c.after_value,
            "at": c.created_at,
        })

    return FieldTraceResponse(
        field_name=field_name,
        original_value=raw_value,
        current_value=current_value,
        change_history=history,
    )


@app.post("/api/tasks/{task_id}/export", response_model=ExportReportResponse, status_code=201)
def export_report(task_id: int, actor_id: int, db: Session = Depends(get_db)):
    """导出最终报告，生成溯源快照"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    submission = task.submission
    classification = task.classification

    report_payload = {
        "submission": {
            "batch_no": submission.batch_no,
            "student_name": submission.student_name,
            "student_id": submission.student_id,
            "class_name": submission.class_name,
            "meal_days": submission.meal_days,
            "subsidy_amount": submission.subsidy_amount,
        },
        "task": {"state": task.state},
        "classification": {
            "category": classification.category if classification else None,
            "reason": classification.reason if classification else None,
            "follow_up_action": classification.follow_up_action if classification else None,
        },
        "trace": {
            "raw_payload": submission.raw_payload,
            "audit_logs_count": db.query(ChangeLog).filter(ChangeLog.task_id == task_id).count(),
        },
    }

    report = ExportReport(
        submission_id=submission.id,
        task_id=task.id,
        report_payload=report_payload,
        exported_by=actor_id,
    )
    db.add(report)

    old_state = task.state
    if old_state != "exported":
        log_state_change(db, task, submission, actor_id, "导出最终报告", old_state, "exported")
        task.state = "exported"

    db.commit()
    db.refresh(report)

    return ExportReportResponse(
        report_id=report.id,
        submission_id=report.submission_id,
        report_payload=report.report_payload,
        exported_by=report.exported_by,
        exported_at=report.exported_at,
    )
