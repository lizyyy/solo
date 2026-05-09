from __future__ import annotations

import traceback
import uuid
from datetime import datetime, date, timedelta
from typing import Dict, Optional, List, Any, Callable
import time

from task_compensation.models import (
    Task, TaskResult, TaskStatus, FailureSample, 
    CompensationStep, CompensationPlan
)
from task_compensation.core.idempotency_checker import IdempotencyChecker
from task_compensation.core.execution_recorder import ExecutionRecorder


class TaskExecutionError(Exception):
    pass


class TaskTimeoutError(TaskExecutionError):
    pass


class TaskExecutor:
    def __init__(
        self,
        execution_recorder: Optional[ExecutionRecorder] = None,
        idempotency_checker: Optional[IdempotencyChecker] = None,
        enable_idempotency: bool = True
    ):
        self.execution_recorder = execution_recorder
        self.idempotency_checker = idempotency_checker
        self.enable_idempotency = enable_idempotency
    
    def execute_task(
        self,
        task: Task,
        execution_date: date,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TaskResult:
        start_time = datetime.now()
        idempotency_hash = None
        execution_record_id = None
        
        if self.enable_idempotency and self.idempotency_checker:
            try:
                existing_record = self.idempotency_checker.check(
                    task_id=task.task_id,
                    execution_date=execution_date,
                    task=task
                )
                
                if existing_record and existing_record.status == TaskStatus.SUCCESS:
                    return TaskResult(
                        task_id=task.task_id,
                        status=TaskStatus.SKIPPED,
                        start_time=start_time,
                        end_time=datetime.now(),
                        duration=0,
                        output={"message": "任务已幂等检查跳过", "idempotency_hash": existing_record.idempotency_hash},
                        retry_count=0
                    )
                
                idempotency_record = self.idempotency_checker.register_execution(task, execution_date)
                idempotency_hash = idempotency_record.idempotency_hash
            except RuntimeError as e:
                return TaskResult(
                    task_id=task.task_id,
                    status=TaskStatus.SKIPPED,
                    start_time=start_time,
                    end_time=datetime.now(),
                    duration=0,
                    output={"message": str(e)},
                    retry_count=0
                )
        
        if self.execution_recorder:
            record = self.execution_recorder.create_record(
                task=task,
                execution_date=execution_date,
                metadata=metadata
            )
            execution_record_id = record.execution_id
            self.execution_recorder.update_start_time(execution_record_id)
        
        retry_count = 0
        last_error: Optional[Exception] = None
        last_traceback: Optional[str] = None
        
        while retry_count <= task.retries:
            try:
                result = self._execute_with_timeout(task, execution_date, metadata, task.timeout)
                
                if idempotency_hash and self.idempotency_checker:
                    self.idempotency_checker.mark_success(
                        idempotency_hash=idempotency_hash,
                        execution_record_id=execution_record_id,
                        output=result.output
                    )
                
                if execution_record_id and self.execution_recorder:
                    self.execution_recorder.update_completion(
                        execution_id=execution_record_id,
                        result=result,
                        idempotency_hash=idempotency_hash
                    )
                
                return result
                
            except TaskTimeoutError as e:
                last_error = e
                last_traceback = traceback.format_exc()
                if idempotency_hash and self.idempotency_checker:
                    self.idempotency_checker.mark_timeout(
                        idempotency_hash=idempotency_hash,
                        execution_record_id=execution_record_id
                    )
                retry_count += 1
                if retry_count <= task.retries:
                    time.sleep(1)
                
            except Exception as e:
                last_error = e
                last_traceback = traceback.format_exc()
                retry_count += 1
                if retry_count <= task.retries:
                    time.sleep(1)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        error_result = TaskResult(
            task_id=task.task_id,
            status=TaskStatus.TIMEOUT if isinstance(last_error, TaskTimeoutError) else TaskStatus.FAILED,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            output={},
            error_message=str(last_error) if last_error else "未知错误",
            error_traceback=last_traceback,
            retry_count=retry_count
        )
        
        if idempotency_hash and self.idempotency_checker:
            self.idempotency_checker.mark_failed(
                idempotency_hash=idempotency_hash,
                execution_record_id=execution_record_id,
                error_output={"error": error_result.error_message, "retry_count": retry_count}
            )
        
        if execution_record_id and self.execution_recorder:
            self.execution_recorder.update_completion(
                execution_id=execution_record_id,
                result=error_result,
                idempotency_hash=idempotency_hash
            )
        
        return error_result
    
    def _execute_with_timeout(
        self,
        task: Task,
        execution_date: date,
        metadata: Optional[Dict[str, Any]],
        timeout: int
    ) -> TaskResult:
        if not task.handler:
            raise TaskExecutionError(f"任务 {task.task_id} 没有设置处理函数")
        
        start_time = datetime.now()
        
        try:
            context = {
                "task_id": task.task_id,
                "task_name": task.task_name,
                "execution_date": execution_date,
                "metadata": metadata or {},
                "task_metadata": task.metadata
            }
            
            output = task.handler(context)
            
            if isinstance(output, dict):
                result_output = output
            elif output is None:
                result_output = {}
            else:
                result_output = {"result": output}
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.SUCCESS,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                output=result_output,
                retry_count=0
            )
            
        except TaskExecutionError:
            raise
        except Exception as e:
            raise TaskExecutionError(f"任务执行失败: {str(e)}") from e
    
    def create_failure_sample(
        self,
        task: Task,
        execution_date: date,
        result: TaskResult
    ) -> FailureSample:
        return FailureSample(
            sample_id=str(uuid.uuid4()),
            task_id=task.task_id,
            execution_date=execution_date,
            error_message=result.error_message or "",
            error_traceback=result.error_traceback,
            input_data={
                "task_metadata": task.metadata,
                "execution_date": execution_date.isoformat()
            }
        )
