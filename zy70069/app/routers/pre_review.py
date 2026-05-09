from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.database import get_db
from app.models import (
    Student, PreReview, PreReviewStatus, GraduationRule,
    RuleSnapshot, MissingItem, ReviewAction, RuleCategory,
    BatchTask, BatchSubtask, TaskStatus
)
from app.schemas import (
    GraduationRuleCreate, GraduationRuleResponse,
    PreReviewDetailResponse, PreReviewSummary,
    ManualReviewRequest, PreReviewReportSummary,
    BatchTaskResponse, BatchSubtaskResponse
)
from app.services.pre_review_service import PreReviewEngine

router = APIRouter(prefix="/pre-review", tags=["pre-review"])


@router.post("/rules", response_model=GraduationRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(rule: GraduationRuleCreate, db: Session = Depends(get_db)):
    db_rule = GraduationRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/rules", response_model=List[GraduationRuleResponse])
def list_rules(
    category: Optional[RuleCategory] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(GraduationRule)
    if category:
        query = query.filter(GraduationRule.category == category.value)
    if is_active is not None:
        query = query.filter(GraduationRule.is_active == is_active)
    return query.order_by(GraduationRule.priority.desc()).all()


@router.put("/rules/{rule_id}", response_model=GraduationRuleResponse)
def update_rule(rule_id: int, rule_update: GraduationRuleCreate, db: Session = Depends(get_db)):
    rule = db.query(GraduationRule).filter(GraduationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    update_data = rule_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)
    
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(GraduationRule).filter(GraduationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    rule.is_active = False
    db.commit()
    return None


@router.get("/rule-snapshots")
def list_rule_snapshots(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    snapshots = db.query(RuleSnapshot).order_by(
        RuleSnapshot.created_at.desc()
    ).limit(limit).all()
    
    return [
        {
            "id": s.id,
            "snapshot_hash": s.snapshot_hash[:16] + "...",
            "rules_count": len(s.rules_json),
            "created_at": s.created_at,
            "description": s.description
        }
        for s in snapshots
    ]


@router.post("/calculate/{student_id}", response_model=PreReviewDetailResponse)
def calculate_student_pre_review(
    student_id: int,
    force_recalculate: bool = False,
    operator: str = "api",
    db: Session = Depends(get_db)
):
    engine = PreReviewEngine(db)
    try:
        pre_review, _ = engine.calculate_pre_review(
            student_id=student_id,
            force_recalculate=force_recalculate,
            operator=operator
        )
        return pre_review
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/student/{student_id}", response_model=PreReviewDetailResponse)
def get_student_pre_review(student_id: int, db: Session = Depends(get_db)):
    pre_review = db.query(PreReview).filter(
        PreReview.student_id == student_id
    ).order_by(PreReview.created_at.desc()).first()
    
    if not pre_review:
        raise HTTPException(status_code=404, detail="该学生暂无预审记录")
    
    return pre_review


@router.get("/list", response_model=List[PreReviewSummary])
def list_pre_reviews(
    status: Optional[PreReviewStatus] = None,
    department: Optional[str] = None,
    grade: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    
    query = db.query(
        PreReview,
        Student.name,
        Student.student_id,
        Student.department,
        func.count(MissingItem.id).label('missing_count')
    ).join(Student, PreReview.student_id == Student.id).outerjoin(
        MissingItem, MissingItem.pre_review_id == PreReview.id
    ).group_by(PreReview.id, Student.id)
    
    if status:
        query = query.filter(PreReview.status == status.value)
    if department:
        query = query.filter(Student.department == department)
    if grade:
        query = query.filter(Student.grade == grade)
    
    results = query.offset(skip).limit(limit).all()
    
    return [
        PreReviewSummary(
            id=pr.id,
            student_id=pr.student_id,
            student_name=name,
            student_id_no=student_id,
            department=dept,
            status=pr.status,
            is_eligible=pr.is_eligible,
            missing_count=missing_cnt or 0,
            calculated_at=pr.calculated_at,
            last_updated=pr.updated_at
        )
        for pr, name, student_id, dept, missing_cnt in results
    ]


@router.post("/{pre_review_id}/manual-review", response_model=PreReviewDetailResponse)
def manual_review(
    pre_review_id: int,
    request: ManualReviewRequest,
    db: Session = Depends(get_db)
):
    engine = PreReviewEngine(db)
    try:
        pre_review = engine.manual_review(
            pre_review_id=pre_review_id,
            new_status=request.status.value,
            reason=request.reason,
            operator=request.operator
        )
        return pre_review
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/batch-recalculate")
def batch_recalculate(
    background_tasks: BackgroundTasks,
    student_ids: Optional[List[int]] = None,
    department: Optional[str] = None,
    grade: Optional[int] = None,
    force_recalculate: bool = False,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    from app.database import SessionLocal
    
    query = db.query(Student.id)
    if student_ids:
        query = query.filter(Student.id.in_(student_ids))
    if department:
        query = query.filter(Student.department == department)
    if grade:
        query = query.filter(Student.grade == grade)
    
    target_student_ids = [sid[0] for sid in query.all()]
    total_count = len(target_student_ids)
    
    if total_count == 0:
        raise HTTPException(status_code=400, detail="没有找到匹配的学生")
    
    task_id = str(uuid.uuid4())
    batch_task = BatchTask(
        task_id=task_id,
        task_type="BATCH_PRE_REVIEW",
        status=TaskStatus.PENDING.value,
        parameters_json={
            "student_ids": target_student_ids,
            "force_recalculate": force_recalculate,
            "operator": operator
        },
        total_count=total_count,
        created_by=operator
    )
    db.add(batch_task)
    db.flush()
    
    for student_id in target_student_ids:
        subtask = BatchSubtask(
            batch_task_id=batch_task.id,
            subtask_id=str(uuid.uuid4()),
            target_type="STUDENT",
            target_id=student_id,
            status=TaskStatus.PENDING.value
        )
        db.add(subtask)
    
    db.commit()
    db.refresh(batch_task)
    
    def run_batch_task(task_db_id: int, task_params: dict):
        session = SessionLocal()
        engine = PreReviewEngine(session)
        
        task = session.query(BatchTask).filter(BatchTask.id == task_db_id).first()
        if not task:
            session.close()
            return
        
        try:
            task.status = TaskStatus.RUNNING.value
            task.started_at = datetime.utcnow()
            session.commit()
            
            success_count = 0
            failed_count = 0
            
            for subtask in task.subtasks:
                try:
                    subtask.status = TaskStatus.RUNNING.value
                    subtask.started_at = datetime.utcnow()
                    session.commit()
                    
                    engine.calculate_pre_review(
                        student_id=subtask.target_id,
                        force_recalculate=task_params.get("force_recalculate", False),
                        operator=task_params.get("operator", "system")
                    )
                    
                    subtask.status = TaskStatus.COMPLETED.value
                    subtask.completed_at = datetime.utcnow()
                    success_count += 1
                    
                except Exception as e:
                    subtask.status = TaskStatus.FAILED.value
                    subtask.error_message = str(e)
                    subtask.completed_at = datetime.utcnow()
                    failed_count += 1
                
                task.success_count = success_count
                task.failed_count = failed_count
                session.commit()
            
            task.status = TaskStatus.COMPLETED.value if failed_count == 0 else TaskStatus.FAILED.value
            task.completed_at = datetime.utcnow()
            session.commit()
            
        except Exception as e:
            task.status = TaskStatus.FAILED.value
            task.error_message = str(e)
            task.completed_at = datetime.utcnow()
            session.commit()
        finally:
            session.close()
    
    background_tasks.add_task(
        run_batch_task,
        batch_task.id,
        batch_task.parameters_json
    )
    
    return {
        "batch_task_id": batch_task.task_id,
        "total_count": total_count,
        "message": f"已创建批量预审任务，共 {total_count} 个学生"
    }


@router.get("/batch-tasks", response_model=List[BatchTaskResponse])
def list_batch_tasks(
    status: Optional[TaskStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(BatchTask)
    if status:
        query = query.filter(BatchTask.status == status.value)
    
    return query.order_by(BatchTask.created_at.desc()).limit(limit).all()


@router.get("/batch-tasks/{task_id}")
def get_batch_task_detail(task_id: str, db: Session = Depends(get_db)):
    task = db.query(BatchTask).filter(BatchTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="批量任务不存在")
    
    subtasks = db.query(BatchSubtask).filter(
        BatchSubtask.batch_task_id == task.id
    ).all()
    
    return {
        "task": task,
        "subtasks": subtasks,
        "progress": {
            "total": task.total_count,
            "success": task.success_count,
            "failed": task.failed_count,
            "pending": task.total_count - task.success_count - task.failed_count,
            "percentage": round((task.success_count + task.failed_count) / task.total_count * 100, 2) if task.total_count > 0 else 0
        }
    }


@router.post("/batch-tasks/{task_id}/retry")
def retry_batch_task(task_id: str, operator: str = "system", db: Session = Depends(get_db)):
    from app.database import SessionLocal
    from fastapi import BackgroundTasks
    
    task = db.query(BatchTask).filter(BatchTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="批量任务不存在")
    
    if task.retry_count >= task.max_retries:
        raise HTTPException(status_code=400, detail=f"已达到最大重试次数 ({task.max_retries})")
    
    failed_subtasks = [st for st in task.subtasks if st.status == TaskStatus.FAILED.value]
    if not failed_subtasks:
        raise HTTPException(status_code=400, detail="没有失败的子任务需要重试")
    
    task.retry_count += 1
    task.status = TaskStatus.RETRYING.value
    db.commit()
    
    for subtask in failed_subtasks:
        subtask.retry_count += 1
        subtask.status = TaskStatus.PENDING.value
        subtask.error_message = None
    db.commit()
    
    def run_retry_task(task_db_id: int):
        session = SessionLocal()
        engine = PreReviewEngine(session)
        
        task = session.query(BatchTask).filter(BatchTask.id == task_db_id).first()
        if not task:
            session.close()
            return
        
        try:
            task.status = TaskStatus.RUNNING.value
            session.commit()
            
            for subtask in task.subtasks:
                if subtask.status == TaskStatus.PENDING.value:
                    try:
                        subtask.status = TaskStatus.RUNNING.value
                        subtask.started_at = datetime.utcnow()
                        session.commit()
                        
                        engine.calculate_pre_review(
                            student_id=subtask.target_id,
                            force_recalculate=task.parameters_json.get("force_recalculate", False),
                            operator=operator
                        )
                        
                        subtask.status = TaskStatus.COMPLETED.value
                        subtask.completed_at = datetime.utcnow()
                        task.success_count += 1
                        task.failed_count -= 1
                        
                    except Exception as e:
                        subtask.status = TaskStatus.FAILED.value
                        subtask.error_message = str(e)
                        subtask.completed_at = datetime.utcnow()
                    
                    session.commit()
            
            remaining_failed = sum(1 for st in task.subtasks if st.status == TaskStatus.FAILED.value)
            task.status = TaskStatus.COMPLETED.value if remaining_failed == 0 else TaskStatus.FAILED.value
            task.completed_at = datetime.utcnow()
            session.commit()
            
        except Exception as e:
            task.status = TaskStatus.FAILED.value
            task.error_message = f"重试失败: {str(e)}"
            session.commit()
        finally:
            session.close()
    
    import threading
    threading.Thread(target=run_retry_task, args=(task.id,), daemon=True).start()
    
    return {
        "message": f"正在重试 {len(failed_subtasks)} 个失败的子任务",
        "retry_count": task.retry_count,
        "max_retries": task.max_retries
    }


@router.get("/report/summary", response_model=PreReviewReportSummary)
def get_pre_review_report_summary(db: Session = Depends(get_db)):
    engine = PreReviewEngine(db)
    return engine.generate_report_summary()


@router.get("/report/details")
def get_pre_review_detailed_report(
    status: Optional[PreReviewStatus] = None,
    department: Optional[str] = None,
    grade: Optional[int] = None,
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    
    students_query = db.query(Student)
    if department:
        students_query = students_query.filter(Student.department == department)
    if grade:
        students_query = students_query.filter(Student.grade == grade)
    students = students_query.all()
    
    student_ids = [s.id for s in students]
    
    pre_reviews = db.query(PreReview).filter(
        PreReview.student_id.in_(student_ids)
    ).order_by(PreReview.student_id, PreReview.created_at.desc()).all()
    
    latest_pre_reviews = {}
    for pr in pre_reviews:
        if pr.student_id not in latest_pre_reviews:
            latest_pre_reviews[pr.student_id] = pr
    
    results = []
    for student in students:
        pr = latest_pre_reviews.get(student.id)
        
        result = {
            "student_id": student.student_id,
            "student_name": student.name,
            "department": student.department,
            "major": student.major,
            "grade": student.grade,
            "status": student.status,
            "pre_review_status": pr.status if pr else None,
            "is_eligible": pr.is_eligible if pr else None,
            "calculated_at": pr.calculated_at.isoformat() if pr and pr.calculated_at else None,
        }
        
        if pr:
            missing_items = db.query(MissingItem).filter(
                MissingItem.pre_review_id == pr.id,
                MissingItem.is_resolved == False
            ).all()
            
            result["missing_items"] = [
                {
                    "category": item.rule_category,
                    "error_code": item.error_code,
                    "message": item.message,
                    "current_value": item.current_value,
                    "required_value": item.required_value,
                    "suggestion": item.suggestion
                }
                for item in missing_items
            ]
        else:
            result["missing_items"] = []
        
        if status is None or (pr and pr.status == status.value):
            results.append(result)
    
    return {
        "total": len(results),
        "filter": {
            "status": status.value if status else None,
            "department": department,
            "grade": grade
        },
        "results": results
    }
