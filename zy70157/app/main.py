"""FastAPI 应用入口"""
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import engine, Base, get_db
from app.models import (
    BatchJob, TaskInstance, TaskDependency, RetryRequest, ExecutionReport,
    ExceptionRecord, TaskStatus, RetryRequestStatus
)
from app.schemas import (
    BatchJobCreate, BatchJobResponse,
    TaskInstanceCreate, TaskInstanceResponse,
    TaskDependencyCreate, TaskDependencyResponse,
    RetryRequestCreate, RetryRequestResponse,
    RetryRequestApprove, RetryRequestReject,
    ExecutionReportResponse, ExceptionRecordResponse,
    DependencyCheckResult, WindowCheckResult, ReentrancyCheckResult,
    ValidationResult, TaskExecutionRequest
)
from app.services import (
    TaskService, DependencyGraphService, RetryRequestService,
    RetryExecutionService, ExceptionService, ValidationService,
    RetryWindowService, ReentrancyLockService, ExecutionReportService
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="批任务补偿窗口 API",
    description="批任务失败后的补跑窗口、依赖和重入条件严格校验的后端流程",
    version="1.0.0"
)


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "batch-retry-api"}


@app.post("/api/jobs", response_model=BatchJobResponse)
def create_job(job: BatchJobCreate, db: Session = Depends(get_db)):
    """创建批作业"""
    try:
        return TaskService.create_job(db, job)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/jobs/{job_id}", response_model=BatchJobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    """获取批作业详情"""
    job = db.query(BatchJob).filter(BatchJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"作业不存在: {job_id}")
    return job


@app.post("/api/dependencies", response_model=TaskDependencyResponse)
def add_dependency(dependency: TaskDependencyCreate, db: Session = Depends(get_db)):
    """添加任务依赖关系"""
    job = db.query(BatchJob).filter(BatchJob.id == dependency.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"作业不存在: {dependency.job_id}")
    
    if DependencyGraphService.detect_cycle(db, dependency.job_id):
        raise HTTPException(status_code=400, detail="依赖图存在循环，无法添加")
    
    return DependencyGraphService.add_dependency(db, dependency)


@app.get("/api/dependencies/{job_id}", response_model=List[TaskDependencyResponse])
def get_job_dependencies(job_id: str, db: Session = Depends(get_db)):
    """获取作业的所有依赖关系"""
    return DependencyGraphService.get_job_dependencies(db, job_id)


@app.post("/api/task-instances", response_model=TaskInstanceResponse)
def create_task_instance(instance: TaskInstanceCreate, db: Session = Depends(get_db)):
    """创建任务实例"""
    job = db.query(BatchJob).filter(BatchJob.id == instance.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"作业不存在: {instance.job_id}")
    
    return TaskService.create_task_instance(db, instance)


@app.get("/api/task-instances/{instance_id}", response_model=TaskInstanceResponse)
def get_task_instance(instance_id: str, db: Session = Depends(get_db)):
    """获取任务实例详情"""
    instance = db.query(TaskInstance).filter(TaskInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"任务实例不存在: {instance_id}")
    return instance


@app.post("/api/task-instances/{instance_id}/fail")
def mark_task_failed(
    instance_id: str,
    error_message: Optional[str] = "模拟失败",
    db: Session = Depends(get_db)
):
    """标记任务失败（用于测试）"""
    instance = db.query(TaskInstance).filter(TaskInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"任务实例不存在: {instance_id}")
    
    TaskService.update_task_status(db, instance_id, TaskStatus.FAILED, error_message)
    db.refresh(instance)
    return {"status": "failed", "instance_id": instance_id, "retry_count": instance.retry_count}


@app.get("/api/task-instances/{instance_id}/check-dependencies", response_model=DependencyCheckResult)
def check_task_dependencies(instance_id: str, db: Session = Depends(get_db)):
    """检查任务依赖"""
    instance = db.query(TaskInstance).filter(TaskInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"任务实例不存在: {instance_id}")
    
    return DependencyGraphService.check_dependencies(db, instance)


@app.get("/api/task-instances/{instance_id}/check-window", response_model=WindowCheckResult)
def check_task_window(instance_id: str, db: Session = Depends(get_db)):
    """检查补跑窗口"""
    instance = db.query(TaskInstance).filter(TaskInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"任务实例不存在: {instance_id}")
    
    return RetryWindowService.check_window(db, instance)


@app.get("/api/task-instances/{instance_id}/check-reentrancy", response_model=ReentrancyCheckResult)
def check_task_reentrancy(instance_id: str, db: Session = Depends(get_db)):
    """检查重入锁"""
    instance = db.query(TaskInstance).filter(TaskInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"任务实例不存在: {instance_id}")
    
    return ReentrancyLockService.check_lock(db, instance_id)


@app.post("/api/retry-requests", response_model=RetryRequestResponse)
def create_retry_request(request: RetryRequestCreate, db: Session = Depends(get_db)):
    """创建补跑申请"""
    try:
        return RetryRequestService.create_retry_request(db, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/retry-requests/{request_id}", response_model=RetryRequestResponse)
def get_retry_request(request_id: str, db: Session = Depends(get_db)):
    """获取补跑申请详情"""
    request = db.query(RetryRequest).filter(RetryRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail=f"补跑申请不存在: {request_id}")
    return request


@app.post("/api/retry-requests/{request_id}/approve", response_model=RetryRequestResponse)
def approve_retry_request(
    request_id: str,
    approve_data: RetryRequestApprove,
    db: Session = Depends(get_db)
):
    """审批通过补跑申请"""
    try:
        return RetryRequestService.approve_request(db, request_id, approve_data.approved_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/retry-requests/{request_id}/reject", response_model=RetryRequestResponse)
def reject_retry_request(
    request_id: str,
    reject_data: RetryRequestReject,
    db: Session = Depends(get_db)
):
    """拒绝补跑申请"""
    try:
        return RetryRequestService.reject_request(
            db, request_id, reject_data.rejected_by, reject_data.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/retry-requests/{request_id}/validate", response_model=ValidationResult)
def validate_retry_request(request_id: str, db: Session = Depends(get_db)):
    """校验补跑执行条件（不执行）"""
    request = db.query(RetryRequest).filter(RetryRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail=f"补跑申请不存在: {request_id}")
    
    task_instance = db.query(TaskInstance).filter(
        TaskInstance.id == request.task_instance_id
    ).first()
    if not task_instance:
        raise HTTPException(status_code=404, detail=f"任务实例不存在")
    
    return ValidationService.validate_retry_execution(
        db, task_instance, request, "validation_only"
    )


@app.post("/api/retry-requests/{request_id}/execute")
def execute_retry_request(
    request_id: str,
    execution_data: TaskExecutionRequest,
    db: Session = Depends(get_db)
):
    """执行补跑"""
    try:
        return RetryExecutionService.execute_retry(
            db, request_id, execution_data.executor_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/task-instances/{instance_id}/reports", response_model=List[ExecutionReportResponse])
def get_task_reports(instance_id: str, db: Session = Depends(get_db)):
    """获取任务的所有执行报告"""
    instance = db.query(TaskInstance).filter(TaskInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail=f"任务实例不存在: {instance_id}")
    
    return db.query(ExecutionReport).filter(
        ExecutionReport.task_instance_id == instance_id
    ).order_by(ExecutionReport.created_at.desc()).all()


@app.get("/api/exceptions", response_model=List[ExceptionRecordResponse])
def get_pending_exceptions(
    resolved: Optional[bool] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取异常记录列表"""
    query = db.query(ExceptionRecord)
    
    if resolved is not None:
        query = query.filter(ExceptionRecord.is_resolved == resolved)
    
    return query.order_by(ExceptionRecord.created_at.desc()).limit(limit).all()


@app.post("/api/exceptions/{exception_id}/resolve")
def resolve_exception(
    exception_id: str,
    resolved_by: str,
    resolution_notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """标记异常为已解决"""
    record = db.query(ExceptionRecord).filter(
        ExceptionRecord.id == exception_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail=f"异常记录不存在: {exception_id}")
    
    record.is_resolved = True
    record.resolved_by = resolved_by
    record.resolution_notes = resolution_notes
    record.resolved_at = __import__('datetime').datetime.utcnow()
    
    db.commit()
    db.refresh(record)
    
    return {"status": "resolved", "exception_id": exception_id}


@app.get("/api/jobs/{job_id}/instances", response_model=List[TaskInstanceResponse])
def get_job_instances(
    job_id: str,
    status: Optional[str] = None,
    business_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取作业的任务实例列表"""
    query = db.query(TaskInstance).filter(TaskInstance.job_id == job_id)
    
    if status:
        query = query.filter(TaskInstance.status == status)
    if business_date:
        query = query.filter(TaskInstance.business_date == business_date)
    
    return query.order_by(TaskInstance.created_at.desc()).all()
