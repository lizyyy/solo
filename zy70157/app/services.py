"""核心业务逻辑服务"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import uuid
from sqlalchemy.orm import Session

from app.models import (
    BatchJob, TaskInstance, TaskDependency, RetryRequest, ReentrancyLock,
    ExecutionReport, RetryExecution, ExceptionRecord, TaskStatus,
    RetryRequestStatus, ExceptionType
)
from app.schemas import (
    BatchJobCreate, TaskInstanceCreate, TaskDependencyCreate,
    RetryRequestCreate, SkipRules, ExceptionRecordCreate,
    DependencyCheckResult, WindowCheckResult, ReentrancyCheckResult,
    ValidationResult
)


def generate_id(prefix: str = "") -> str:
    """生成唯一ID"""
    return f"{prefix}{uuid.uuid4().hex[:12]}" if prefix else uuid.uuid4().hex[:12]


class ExceptionService:
    """异常记录服务 - 边界数据不静默吞掉"""
    
    @staticmethod
    def record_exception(
        db: Session,
        exception_type: ExceptionType,
        title: str,
        details: str,
        severity: str = "error",
        task_instance_id: Optional[str] = None,
        retry_request_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> ExceptionRecord:
        """记录异常 - 关键：边界数据进入可查询的异常记录"""
        record = ExceptionRecord(
            id=generate_id("EXC_"),
            exception_type=exception_type.value,
            severity=severity,
            title=title,
            details=details,
            task_instance_id=task_instance_id,
            retry_request_id=retry_request_id,
            context=context
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    
    @staticmethod
    def get_pending_exceptions(db: Session, limit: int = 100) -> List[ExceptionRecord]:
        """获取待处理异常列表"""
        return db.query(ExceptionRecord).filter(
            ExceptionRecord.is_resolved == False
        ).order_by(ExceptionRecord.created_at.desc()).limit(limit).all()


class ReentrancyLockService:
    """重入锁服务 - 防止重入导致状态混乱"""
    
    LOCK_TIMEOUT_SECONDS = 3600  # 1小时超时
    
    @staticmethod
    def generate_lock_key(task_instance_id: str) -> str:
        """生成锁键"""
        return f"task:retry:{task_instance_id}"
    
    @staticmethod
    def _cleanup_expired_locks(db: Session):
        """清理过期锁"""
        now = datetime.utcnow()
        expired_locks = db.query(ReentrancyLock).filter(
            ReentrancyLock.is_released == False,
            ReentrancyLock.expires_at < now
        ).all()
        for lock in expired_locks:
            lock.is_released = True
            lock.released_at = now
        if expired_locks:
            db.commit()
    
    @staticmethod
    def check_lock(
        db: Session,
        task_instance_id: str
    ) -> ReentrancyCheckResult:
        """检查是否可以获取锁"""
        ReentrancyLockService._cleanup_expired_locks(db)
        
        lock_key = ReentrancyLockService.generate_lock_key(task_instance_id)
        existing_lock = db.query(ReentrancyLock).filter(
            ReentrancyLock.lock_key == lock_key,
            ReentrancyLock.is_released == False
        ).first()
        
        if existing_lock:
            return ReentrancyCheckResult(
                can_acquire=False,
                lock_key=lock_key,
                existing_lock={
                    "owner_process": existing_lock.owner_process,
                    "acquired_at": existing_lock.acquired_at,
                    "expires_at": existing_lock.expires_at
                },
                reason=f"锁已被进程 {existing_lock.owner_process} 持有，将在 {existing_lock.expires_at} 过期"
            )
        
        return ReentrancyCheckResult(
            can_acquire=True,
            lock_key=lock_key,
            reason="可以获取锁"
        )
    
    @staticmethod
    def acquire_lock(
        db: Session,
        task_instance_id: str,
        owner_process: str
    ) -> Tuple[bool, Optional[ReentrancyLock], str]:
        """获取锁"""
        check_result = ReentrancyLockService.check_lock(db, task_instance_id)
        
        if not check_result.can_acquire:
            return False, None, check_result.reason
        
        lock_key = check_result.lock_key
        now = datetime.utcnow()
        
        lock = ReentrancyLock(
            lock_key=lock_key,
            task_instance_id=task_instance_id,
            owner_process=owner_process,
            acquired_at=now,
            expires_at=now + timedelta(seconds=ReentrancyLockService.LOCK_TIMEOUT_SECONDS),
            is_released=False
        )
        db.add(lock)
        
        task_instance = db.query(TaskInstance).filter(
            TaskInstance.id == task_instance_id
        ).first()
        if task_instance:
            task_instance.is_locked = True
            task_instance.lock_acquired_at = now
        
        db.commit()
        db.refresh(lock)
        
        return True, lock, "锁获取成功"
    
    @staticmethod
    def release_lock(db: Session, lock_key: str):
        """释放锁"""
        lock = db.query(ReentrancyLock).filter(
            ReentrancyLock.lock_key == lock_key
        ).first()
        
        if lock and not lock.is_released:
            lock.is_released = True
            lock.released_at = datetime.utcnow()
            
            task_instance = db.query(TaskInstance).filter(
                TaskInstance.id == lock.task_instance_id
            ).first()
            if task_instance:
                task_instance.is_locked = False
            
            db.commit()


class DependencyGraphService:
    """依赖图服务 - 管理和校验任务依赖"""
    
    @staticmethod
    def add_dependency(
        db: Session,
        dependency: TaskDependencyCreate
    ) -> TaskDependency:
        """添加依赖关系"""
        db_dep = TaskDependency(
            job_id=dependency.job_id,
            source_task=dependency.source_task,
            target_task=dependency.target_task,
            is_soft_dependency=dependency.is_soft_dependency
        )
        db.add(db_dep)
        db.commit()
        db.refresh(db_dep)
        return db_dep
    
    @staticmethod
    def get_job_dependencies(
        db: Session,
        job_id: str
    ) -> List[TaskDependency]:
        """获取作业的所有依赖"""
        return db.query(TaskDependency).filter(
            TaskDependency.job_id == job_id
        ).all()
    
    @staticmethod
    def get_task_dependencies(
        db: Session,
        job_id: str,
        task_name: str
    ) -> List[TaskDependency]:
        """获取任务的前置依赖"""
        return db.query(TaskDependency).filter(
            TaskDependency.job_id == job_id,
            TaskDependency.target_task == task_name
        ).all()
    
    @staticmethod
    def check_dependencies(
        db: Session,
        task_instance: TaskInstance
    ) -> DependencyCheckResult:
        """检查任务依赖是否满足"""
        dependencies = DependencyGraphService.get_task_dependencies(
            db, task_instance.job_id, task_instance.task_name
        )
        
        pending_deps = []
        failed_deps = []
        skipped_deps = []
        
        for dep in dependencies:
            source_instance = db.query(TaskInstance).filter(
                TaskInstance.job_id == task_instance.job_id,
                TaskInstance.task_name == dep.source_task,
                TaskInstance.business_date == task_instance.business_date
            ).first()
            
            if not source_instance:
                if not dep.is_soft_dependency:
                    pending_deps.append(dep.source_task)
                continue
            
            if source_instance.status == TaskStatus.RUNNING.value:
                pending_deps.append(dep.source_task)
            elif source_instance.status == TaskStatus.FAILED.value:
                if not dep.is_soft_dependency:
                    failed_deps.append(dep.source_task)
            elif source_instance.status == TaskStatus.SKIPPED.value:
                skipped_deps.append(dep.source_task)
        
        is_ready = (
            len(pending_deps) == 0 and 
            len(failed_deps) == 0
        )
        
        return DependencyCheckResult(
            task_name=task_instance.task_name,
            is_ready=is_ready,
            pending_dependencies=pending_deps,
            failed_dependencies=failed_deps,
            skipped_dependencies=skipped_deps
        )
    
    @staticmethod
    def detect_cycle(db: Session, job_id: str) -> bool:
        """检测依赖图是否有环"""
        dependencies = DependencyGraphService.get_job_dependencies(db, job_id)
        
        graph = {}
        for dep in dependencies:
            if dep.source_task not in graph:
                graph[dep.source_task] = []
            if dep.target_task not in graph:
                graph[dep.target_task] = []
            graph[dep.source_task].append(dep.target_task)
        
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {node: WHITE for node in graph}
        
        def dfs(node):
            if color[node] == GRAY:
                return True
            if color[node] == BLACK:
                return False
            
            color[node] = GRAY
            for neighbor in graph.get(node, []):
                if dfs(neighbor):
                    return True
            
            color[node] = BLACK
            return False
        
        for node in graph:
            if dfs(node):
                return True
        
        return False


class RetryWindowService:
    """补跑窗口服务 - 严格校验补跑窗口"""
    
    @staticmethod
    def calculate_window(
        job: BatchJob,
        reference_time: Optional[datetime] = None
    ) -> Tuple[datetime, datetime]:
        """计算补跑窗口"""
        now = reference_time or datetime.utcnow()
        window_start = now - timedelta(hours=job.retry_window_hours)
        window_end = now + timedelta(hours=1)  # 窗口终点为当前时间+1小时
        return window_start, window_end
    
    @staticmethod
    def check_window(
        db: Session,
        task_instance: TaskInstance
    ) -> WindowCheckResult:
        """检查是否在补跑窗口内"""
        job = db.query(BatchJob).filter(
            BatchJob.id == task_instance.job_id
        ).first()
        
        if not job:
            return WindowCheckResult(
                is_within_window=False,
                window_start=datetime.utcnow(),
                window_end=datetime.utcnow(),
                current_time=datetime.utcnow(),
                reason="作业不存在"
            )
        
        window_start, window_end = RetryWindowService.calculate_window(job)
        now = datetime.utcnow()
        
        if task_instance.created_at < window_start:
            return WindowCheckResult(
                is_within_window=False,
                window_start=window_start,
                window_end=window_end,
                current_time=now,
                reason=f"任务创建时间 {task_instance.created_at} 超出补跑窗口开始时间 {window_start}"
            )
        
        if now > window_end:
            return WindowCheckResult(
                is_within_window=False,
                window_start=window_start,
                window_end=window_end,
                current_time=now,
                reason=f"当前时间 {now} 超出补跑窗口结束时间 {window_end}"
            )
        
        return WindowCheckResult(
            is_within_window=True,
            window_start=window_start,
            window_end=window_end,
            current_time=now,
            reason="在补跑窗口内"
        )


class SkipRuleService:
    """跳过规则服务"""
    
    @staticmethod
    def should_skip(
        db: Session,
        task_instance: TaskInstance,
        retry_request: RetryRequest,
        skip_rules: Optional[SkipRules]
    ) -> Tuple[bool, str]:
        """判断是否应该跳过执行"""
        if skip_rules is None:
            return False, "无跳过规则"
        
        if skip_rules.skip_if_already_succeeded:
            if task_instance.status == TaskStatus.SUCCESS.value:
                return True, "任务已成功执行，跳过补跑"
        
        if skip_rules.skip_if_retry_count_exceeded:
            max_allowed = retry_request.target_retry_count
            if task_instance.retry_count >= max_allowed:
                return True, f"重试次数 {task_instance.retry_count} 已超过允许的最大次数 {max_allowed}"
        
        if skip_rules.skip_if_predecessor_failed:
            dep_check = DependencyGraphService.check_dependencies(db, task_instance)
            if len(dep_check.failed_dependencies) > 0:
                return True, f"前置任务失败: {', '.join(dep_check.failed_dependencies)}"
        
        if skip_rules.custom_conditions:
            for key, value in skip_rules.custom_conditions.items():
                if key == "min_retries" and task_instance.retry_count < value:
                    continue
                if key == "status_in" and task_instance.status in value:
                    continue
        
        return False, "不满足跳过条件"


class ExecutionReportService:
    """执行报告服务"""
    
    @staticmethod
    def create_report(
        db: Session,
        task_instance_id: str,
        retry_request_id: Optional[str] = None
    ) -> ExecutionReport:
        """创建执行报告"""
        existing_reports = db.query(ExecutionReport).filter(
            ExecutionReport.task_instance_id == task_instance_id
        ).count()
        
        report = ExecutionReport(
            id=generate_id("RPT_"),
            task_instance_id=task_instance_id,
            retry_request_id=retry_request_id,
            execution_sequence=existing_reports + 1,
            status=TaskStatus.PENDING.value,
            is_skipped=False,
            affected_final_result=True
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report
    
    @staticmethod
    def update_report_status(
        db: Session,
        report_id: str,
        status: TaskStatus,
        skip_reason: Optional[str] = None,
        input_snapshot: Optional[Dict[str, Any]] = None,
        output_snapshot: Optional[Dict[str, Any]] = None,
        error_details: Optional[Dict[str, Any]] = None,
        affected_final_result: bool = True
    ):
        """更新执行报告状态"""
        report = db.query(ExecutionReport).filter(
            ExecutionReport.id == report_id
        ).first()
        
        if not report:
            return
        
        report.status = status.value
        report.affected_final_result = affected_final_result
        
        if status == TaskStatus.RUNNING:
            report.start_time = datetime.utcnow()
        elif status in [TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.SKIPPED]:
            report.end_time = datetime.utcnow()
        
        if skip_reason:
            report.skip_reason = skip_reason
            report.is_skipped = True
        
        if input_snapshot:
            report.input_snapshot = input_snapshot
        if output_snapshot:
            report.output_snapshot = output_snapshot
        if error_details:
            report.error_details = error_details
        
        db.commit()
    
    @staticmethod
    def get_latest_report(
        db: Session,
        task_instance_id: str
    ) -> Optional[ExecutionReport]:
        """获取最新执行报告"""
        return db.query(ExecutionReport).filter(
            ExecutionReport.task_instance_id == task_instance_id
        ).order_by(ExecutionReport.created_at.desc()).first()


class ValidationService:
    """综合校验服务"""
    
    @staticmethod
    def validate_retry_execution(
        db: Session,
        task_instance: TaskInstance,
        retry_request: RetryRequest,
        owner_process: str
    ) -> ValidationResult:
        """校验补跑执行条件"""
        errors = []
        warnings = []
        
        window_check = RetryWindowService.check_window(db, task_instance)
        if not window_check.is_within_window:
            errors.append(f"窗口校验失败: {window_check.reason}")
        
        dependency_check = DependencyGraphService.check_dependencies(db, task_instance)
        if not dependency_check.is_ready:
            if dependency_check.pending_dependencies:
                warnings.append(f"存在待执行的前置任务: {dependency_check.pending_dependencies}")
            if dependency_check.failed_dependencies:
                errors.append(f"存在失败的前置任务: {dependency_check.failed_dependencies}")
        
        reentrancy_check = ReentrancyLockService.check_lock(db, task_instance.id)
        if not reentrancy_check.can_acquire:
            errors.append(f"重入校验失败: {reentrancy_check.reason}")
        
        if task_instance.retry_count >= task_instance.max_retries:
            errors.append(f"重试次数已达上限: {task_instance.retry_count}/{task_instance.max_retries}")
        
        is_valid = len(errors) == 0
        
        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            dependency_check=dependency_check,
            window_check=window_check,
            reentrancy_check=reentrancy_check
        )


class TaskService:
    """任务服务"""
    
    @staticmethod
    def create_job(db: Session, job: BatchJobCreate) -> BatchJob:
        """创建批作业"""
        db_job = BatchJob(
            id=job.id,
            name=job.name,
            description=job.description,
            retry_window_hours=job.retry_window_hours,
            max_retries=job.max_retries,
            is_active=job.is_active
        )
        db.add(db_job)
        db.commit()
        db.refresh(db_job)
        return db_job
    
    @staticmethod
    def create_task_instance(
        db: Session,
        instance: TaskInstanceCreate
    ) -> TaskInstance:
        """创建任务实例"""
        db_instance = TaskInstance(
            id=instance.id,
            job_id=instance.job_id,
            task_name=instance.task_name,
            business_date=instance.business_date,
            status=TaskStatus.PENDING.value,
            retry_count=0,
            max_retries=instance.max_retries,
            input_data=instance.input_data,
            reentrancy_key=instance.reentrancy_key,
            is_locked=False
        )
        db.add(db_instance)
        db.commit()
        db.refresh(db_instance)
        return db_instance
    
    @staticmethod
    def update_task_status(
        db: Session,
        task_instance_id: str,
        status: TaskStatus,
        error_message: Optional[str] = None,
        output_data: Optional[Dict[str, Any]] = None
    ):
        """更新任务状态"""
        instance = db.query(TaskInstance).filter(
            TaskInstance.id == task_instance_id
        ).first()
        
        if not instance:
            return
        
        now = datetime.utcnow()
        
        if status == TaskStatus.RUNNING:
            instance.start_time = now
        elif status in [TaskStatus.SUCCESS, TaskStatus.FAILED]:
            instance.end_time = now
            if instance.start_time:
                duration = (now - instance.start_time).total_seconds() * 1000
                instance.execution_duration_ms = int(duration)
        
        instance.status = status.value
        if status == TaskStatus.FAILED:
            instance.retry_count += 1
        
        if error_message:
            instance.error_message = error_message
        if output_data:
            instance.output_data = output_data
        
        db.commit()


class RetryRequestService:
    """补跑申请服务"""
    
    @staticmethod
    def create_retry_request(
        db: Session,
        request: RetryRequestCreate
    ) -> RetryRequest:
        """创建补跑申请"""
        task_instance = db.query(TaskInstance).filter(
            TaskInstance.id == request.task_instance_id
        ).first()
        
        if not task_instance:
            raise ValueError(f"任务实例不存在: {request.task_instance_id}")
        
        db_request = RetryRequest(
            id=generate_id("RETRY_"),
            task_instance_id=request.task_instance_id,
            requester=request.requester,
            reason=request.reason,
            retry_type=request.retry_type,
            target_retry_count=request.target_retry_count,
            skip_rules=request.skip_rules.model_dump() if request.skip_rules else None,
            status=RetryRequestStatus.PENDING.value
        )
        
        window_start, window_end = RetryWindowService.calculate_window(task_instance.job)
        db_request.window_start = window_start
        db_request.window_end = window_end
        
        window_check = RetryWindowService.check_window(db, task_instance)
        db_request.is_within_window = window_check.is_within_window
        
        db.add(db_request)
        db.commit()
        db.refresh(db_request)
        
        if not window_check.is_within_window:
            ExceptionService.record_exception(
                db=db,
                exception_type=ExceptionType.WINDOW_VIOLATION,
                title="补跑窗口校验失败",
                details=window_check.reason,
                task_instance_id=request.task_instance_id,
                retry_request_id=db_request.id,
                context={
                    "window_start": window_start.isoformat(),
                    "window_end": window_end.isoformat(),
                    "task_created_at": task_instance.created_at.isoformat()
                }
            )
        
        return db_request
    
    @staticmethod
    def approve_request(
        db: Session,
        request_id: str,
        approved_by: str
    ) -> RetryRequest:
        """审批通过补跑申请"""
        request = db.query(RetryRequest).filter(
            RetryRequest.id == request_id
        ).first()
        
        if not request:
            raise ValueError(f"补跑申请不存在: {request_id}")
        
        if request.status != RetryRequestStatus.PENDING.value:
            raise ValueError(f"补跑申请状态异常，当前状态: {request.status}")
        
        request.status = RetryRequestStatus.APPROVED.value
        request.approved_by = approved_by
        request.approved_at = datetime.utcnow()
        
        db.commit()
        db.refresh(request)
        return request
    
    @staticmethod
    def reject_request(
        db: Session,
        request_id: str,
        rejected_by: str,
        reason: str
    ) -> RetryRequest:
        """拒绝补跑申请"""
        request = db.query(RetryRequest).filter(
            RetryRequest.id == request_id
        ).first()
        
        if not request:
            raise ValueError(f"补跑申请不存在: {request_id}")
        
        request.status = RetryRequestStatus.REJECTED.value
        request.approved_by = rejected_by
        request.approved_at = datetime.utcnow()
        
        ExceptionService.record_exception(
            db=db,
            exception_type=ExceptionType.UNKNOWN_ERROR,
            severity="warning",
            title="补跑申请被拒绝",
            details=f"拒绝原因: {reason}",
            task_instance_id=request.task_instance_id,
            retry_request_id=request.id
        )
        
        db.commit()
        db.refresh(request)
        return request


class RetryExecutionService:
    """补跑执行服务"""
    
    @staticmethod
    def execute_retry(
        db: Session,
        request_id: str,
        executor_id: str
    ) -> Dict[str, Any]:
        """执行补跑 - 核心流程"""
        request = db.query(RetryRequest).filter(
            RetryRequest.id == request_id
        ).first()
        
        if not request:
            raise ValueError(f"补跑申请不存在: {request_id}")
        
        if request.status != RetryRequestStatus.APPROVED.value:
            raise ValueError(f"补跑申请未审批通过，当前状态: {request.status}")
        
        task_instance = db.query(TaskInstance).filter(
            TaskInstance.id == request.task_instance_id
        ).first()
        
        if not task_instance:
            raise ValueError(f"任务实例不存在: {request.task_instance_id}")
        
        request.status = RetryRequestStatus.EXECUTING.value
        db.commit()
        
        report = ExecutionReportService.create_report(
            db, task_instance.id, request.id
        )
        
        try:
            validation = ValidationService.validate_retry_execution(
                db, task_instance, request, executor_id
            )
            
            ExecutionReportService.update_report_status(
                db, report.id, TaskStatus.RUNNING,
                input_snapshot={
                    "task_id": task_instance.id,
                    "retry_count": task_instance.retry_count,
                    "validation_errors": validation.errors,
                    "validation_warnings": validation.warnings
                }
            )
            
            if not validation.is_valid:
                error_details = "\n".join(validation.errors)
                
                for error in validation.errors:
                    if "窗口校验失败" in error:
                        exc_type = ExceptionType.WINDOW_VIOLATION
                    elif "重入校验失败" in error:
                        exc_type = ExceptionType.REENTRANCY_VIOLATION
                    elif "前置任务失败" in error:
                        exc_type = ExceptionType.DEPENDENCY_ERROR
                    else:
                        exc_type = ExceptionType.EXECUTION_ERROR
                    
                    ExceptionService.record_exception(
                        db=db,
                        exception_type=exc_type,
                        title="补跑执行校验失败",
                        details=error,
                        task_instance_id=task_instance.id,
                        retry_request_id=request.id,
                        context={
                            "validation_result": {
                                "errors": validation.errors,
                                "warnings": validation.warnings
                            }
                        }
                    )
                
                ExecutionReportService.update_report_status(
                    db, report.id, TaskStatus.FAILED,
                    error_details={"validation_errors": validation.errors},
                    affected_final_result=True
                )
                
                TaskService.update_task_status(
                    db, task_instance.id, TaskStatus.FAILED,
                    error_message=error_details
                )
                
                request.status = RetryRequestStatus.COMPLETED.value
                db.commit()
                
                return {
                    "success": False,
                    "request_id": request.id,
                    "task_instance_id": task_instance.id,
                    "status": "failed",
                    "validation_errors": validation.errors,
                    "report_id": report.id
                }
            
            skip_rules = SkipRules(**request.skip_rules) if request.skip_rules else None
            should_skip, skip_reason = SkipRuleService.should_skip(
                db, task_instance, request, skip_rules
            )
            
            if should_skip:
                ExecutionReportService.update_report_status(
                    db, report.id, TaskStatus.SKIPPED,
                    skip_reason=skip_reason,
                    affected_final_result=False
                )
                
                request.status = RetryRequestStatus.COMPLETED.value
                db.commit()
                
                return {
                    "success": True,
                    "request_id": request.id,
                    "task_instance_id": task_instance.id,
                    "status": "skipped",
                    "skip_reason": skip_reason,
                    "report_id": report.id
                }
            
            lock_acquired, lock, lock_msg = ReentrancyLockService.acquire_lock(
                db, task_instance.id, executor_id
            )
            
            if not lock_acquired:
                ExceptionService.record_exception(
                    db=db,
                    exception_type=ExceptionType.REENTRANCY_VIOLATION,
                    title="无法获取重入锁",
                    details=lock_msg,
                    task_instance_id=task_instance.id,
                    retry_request_id=request.id
                )
                
                ExecutionReportService.update_report_status(
                    db, report.id, TaskStatus.FAILED,
                    error_details={"lock_error": lock_msg},
                    affected_final_result=True
                )
                
                TaskService.update_task_status(
                    db, task_instance.id, TaskStatus.FAILED,
                    error_message=lock_msg
                )
                
                request.status = RetryRequestStatus.COMPLETED.value
                db.commit()
                
                return {
                    "success": False,
                    "request_id": request.id,
                    "task_instance_id": task_instance.id,
                    "status": "failed",
                    "error": lock_msg,
                    "report_id": report.id
                }
            
            try:
                TaskService.update_task_status(
                    db, task_instance.id, TaskStatus.RETRYING
                )
                
                simulated_output = {
                    "retry_executed_at": datetime.utcnow().isoformat(),
                    "previous_retry_count": task_instance.retry_count,
                    "executor": executor_id,
                    "request_id": request.id
                }
                
                TaskService.update_task_status(
                    db, task_instance.id, TaskStatus.SUCCESS,
                    output_data=simulated_output
                )
                
                ExecutionReportService.update_report_status(
                    db, report.id, TaskStatus.SUCCESS,
                    output_snapshot=simulated_output,
                    affected_final_result=True
                )
                
                retry_execution = RetryExecution(
                    id=generate_id("REX_"),
                    retry_request_id=request.id,
                    execution_report_id=report.id,
                    retry_number=task_instance.retry_count,
                    status=TaskStatus.SUCCESS.value,
                    start_time=report.start_time,
                    end_time=report.end_time
                )
                db.add(retry_execution)
                
                request.status = RetryRequestStatus.COMPLETED.value
                db.commit()
                
                return {
                    "success": True,
                    "request_id": request.id,
                    "task_instance_id": task_instance.id,
                    "status": "success",
                    "retry_count": task_instance.retry_count,
                    "output": simulated_output,
                    "report_id": report.id
                }
            
            finally:
                if lock:
                    ReentrancyLockService.release_lock(db, lock.lock_key)
        
        except Exception as e:
            ExceptionService.record_exception(
                db=db,
                exception_type=ExceptionType.EXECUTION_ERROR,
                title="补跑执行异常",
                details=str(e),
                task_instance_id=task_instance.id if task_instance else None,
                retry_request_id=request.id
            )
            
            ExecutionReportService.update_report_status(
                db, report.id, TaskStatus.FAILED,
                error_details={"exception": str(e)},
                affected_final_result=True
            )
            
            if task_instance:
                TaskService.update_task_status(
                    db, task_instance.id, TaskStatus.FAILED,
                    error_message=str(e)
                )
            
            request.status = RetryRequestStatus.COMPLETED.value
            db.commit()
            
            raise
