import asyncio
import json
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.models import (
    WarmupTask, TaskExecution, ExecutionItem, ExecutionHistory
)
from app.schemas.schemas import (
    WarmupTaskCreate, WarmupTaskUpdate, ExecutionStartRequest,
    WarmupReport, ExecutionHistoryResponse
)
from app.services.cache_service import cache_service
from app.services.data_source import data_source_factory
from app.services.orchestrator import orchestrator, WarmupOrchestrator
from app.services.version_service import version_service


def _run_async_in_thread(coro):
    def _run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(coro)
        finally:
            loop.close()
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return thread


class TaskService:
    @staticmethod
    def create_task(db: Session, task_data: WarmupTaskCreate) -> WarmupTask:
        task = WarmupTask(
            task_name=task_data.task_name,
            description=task_data.description,
            data_source_type=task_data.data_source_type,
            data_source_config=task_data.data_source_config,
            cache_key_pattern=task_data.cache_key_pattern,
            version_strategy=task_data.version_strategy,
            default_concurrency=task_data.default_concurrency,
            default_qps_limit=task_data.default_qps_limit,
            ttl_seconds=task_data.ttl_seconds
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def update_task(db: Session, task_id: int, task_data: WarmupTaskUpdate) -> Optional[WarmupTask]:
        task = db.query(WarmupTask).get(task_id)
        if not task:
            return None
        
        if task_data.description is not None:
            task.description = task_data.description
        if task_data.data_source_config is not None:
            task.data_source_config = task_data.data_source_config
        if task_data.cache_key_pattern is not None:
            task.cache_key_pattern = task_data.cache_key_pattern
        if task_data.default_concurrency is not None:
            task.default_concurrency = task_data.default_concurrency
        if task_data.default_qps_limit is not None:
            task.default_qps_limit = task_data.default_qps_limit
        if task_data.ttl_seconds is not None:
            task.ttl_seconds = task_data.ttl_seconds
        
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_task(db: Session, task_id: int) -> Optional[WarmupTask]:
        return db.query(WarmupTask).get(task_id)

    @staticmethod
    def list_tasks(db: Session, page: int = 1, page_size: int = 20) -> tuple[List[WarmupTask], int]:
        offset = (page - 1) * page_size
        total = db.query(WarmupTask).count()
        tasks = db.query(WarmupTask).order_by(
            WarmupTask.id.desc()
        ).offset(offset).limit(page_size).all()
        return tasks, total

    @staticmethod
    def delete_task(db: Session, task_id: int) -> bool:
        task = db.query(WarmupTask).get(task_id)
        if not task:
            return False
        db.delete(task)
        db.commit()
        return True

    @classmethod
    def start_execution(
        cls,
        db: Session,
        task_id: int,
        request: ExecutionStartRequest,
        operator: Optional[str] = None
    ) -> TaskExecution:
        task = db.query(WarmupTask).get(task_id)
        if not task:
            raise ValueError("任务不存在")
        
        running_execution = db.query(TaskExecution).filter(
            TaskExecution.task_id == task_id,
            TaskExecution.status == "running"
        ).first()
        
        if running_execution:
            raise ValueError("该任务已有正在执行的预热")
        
        try:
            version, checksum, data_count = version_service.create_or_get_version(
                db, task, request.force_version
            )
        except ValueError as e:
            raise ValueError(str(e))
        
        concurrency = request.concurrency or task.default_concurrency
        qps_limit = request.qps_limit or task.default_qps_limit
        
        execution = TaskExecution(
            task_id=task_id,
            version=version,
            status="pending",
            concurrency=concurrency,
            qps_limit=qps_limit,
            total_items=data_count
        )
        db.add(execution)
        db.commit()
        db.refresh(execution)
        
        history = ExecutionHistory(
            execution_id=execution.id,
            action_type="create",
            action_details=f"创建执行记录: 版本={version}, 数据条数={data_count}, 校验和前缀={checksum[:12]}",
            operator=operator
        )
        db.add(history)
        db.commit()
        
        _run_async_in_thread(
            orchestrator.execute_warmup(task.id, execution.id, concurrency, qps_limit, version)
        )
        
        return execution

    @staticmethod
    def get_execution(db: Session, execution_id: int) -> Optional[TaskExecution]:
        return db.query(TaskExecution).get(execution_id)

    @staticmethod
    def list_executions(
        db: Session,
        task_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[List[TaskExecution], int]:
        query = db.query(TaskExecution)
        if task_id:
            query = query.filter(TaskExecution.task_id == task_id)
        
        total = query.count()
        executions = query.order_by(
            TaskExecution.id.desc()
        ).offset((page - 1) * page_size).limit(page_size).all()
        return executions, total

    @classmethod
    def get_warmup_report(cls, db: Session, execution_id: int) -> Optional[WarmupReport]:
        execution = db.query(TaskExecution).get(execution_id)
        if not execution:
            return None
        
        task = execution.task
        
        duration = None
        if execution.started_at and execution.completed_at:
            duration = (execution.completed_at - execution.started_at).total_seconds()
        
        failed_items = []
        mismatch_items = []
        
        items = db.query(ExecutionItem).filter(
            ExecutionItem.execution_id == execution_id
        ).all()
        
        for item in items:
            item_dict = {
                "id": item.id,
                "cache_key": item.cache_key,
                "status": item.status,
                "error_message": item.error_message,
                "retry_count": item.retry_count
            }
            
            if item.status == "failed":
                failed_items.append(item_dict)
            
            if item.hit_expected is not None and item.hit_actual is not None:
                if item.hit_expected != item.hit_actual:
                    mismatch_items.append({
                        **item_dict,
                        "hit_expected": item.hit_expected,
                        "hit_actual": item.hit_actual
                    })
        
        history_records = db.query(ExecutionHistory).filter(
            ExecutionHistory.execution_id == execution_id
        ).order_by(ExecutionHistory.id.asc()).all()
        
        history_responses = [
            ExecutionHistoryResponse.model_validate(h)
            for h in history_records
        ]
        
        return WarmupReport(
            execution_id=execution.id,
            task_name=task.task_name if task else "Unknown",
            version=execution.version,
            status=execution.status,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            duration_seconds=duration,
            total_items=execution.total_items,
            success_count=execution.success_count,
            failed_count=execution.failed_count,
            skipped_count=execution.skipped_count,
            hit_rate=execution.hit_rate,
            hit_mismatch_count=len(mismatch_items),
            concurrency=execution.concurrency,
            qps_limit=execution.qps_limit,
            failed_items=failed_items[:100],
            mismatch_items=mismatch_items[:100],
            history=history_responses
        )

    @classmethod
    async def patch_failed_items(
        cls,
        db: Session,
        execution_id: int,
        cache_keys: List[str],
        operator: Optional[str] = None
    ) -> int:
        execution = db.query(TaskExecution).get(execution_id)
        if not execution:
            raise ValueError("执行记录不存在")
        
        task = execution.task
        if not task:
            raise ValueError("关联任务不存在")
        
        items_to_patch = db.query(ExecutionItem).filter(
            ExecutionItem.execution_id == execution_id,
            ExecutionItem.cache_key.in_(cache_keys),
            ExecutionItem.status != "success"
        ).all()
        
        if not items_to_patch:
            return 0
        
        WarmupOrchestrator._record_history(
            db, execution_id,
            "patch_start",
            f"开始补录 {len(items_to_patch)} 个失败项: {', '.join(cache_keys[:10])}",
            operator
        )
        
        data_source = data_source_factory.get(task.data_source_type)
        all_data = data_source.fetch_data(task.data_source_config)
        data_map = {
            WarmupOrchestrator._generate_cache_key(task.cache_key_pattern, item): item
            for item in all_data
        }
        
        from app.services.orchestrator import RateLimiter
        rate_limiter = RateLimiter(task.default_qps_limit)
        
        success_count = 0
        for db_item in items_to_patch:
            item = data_map.get(db_item.cache_key)
            if not item:
                db_item.error_message = "补录时数据源中已不存在该数据"
                db.commit()
                continue
            
            cache_key, success, error, new_hash, hit_actual = \
                await WarmupOrchestrator._warmup_single_item(
                    item, task, execution.version, rate_limiter
                )
            
            db_item.status = "success" if success else "failed"
            db_item.new_value_hash = new_hash
            db_item.hit_actual = hit_actual
            db_item.error_message = error
            db_item.retry_count += 1
            db.commit()
            
            if success:
                success_count += 1
        
        all_items = db.query(ExecutionItem).filter(
            ExecutionItem.execution_id == execution_id
        ).all()
        
        execution.success_count = sum(1 for i in all_items if i.status == "success")
        execution.failed_count = sum(1 for i in all_items if i.status == "failed")
        
        if execution.failed_count == 0:
            execution.status = "success"
        elif execution.success_count > 0:
            execution.status = "partial"
        db.commit()
        
        WarmupOrchestrator._record_history(
            db, execution_id,
            "patch_complete",
            f"补录完成: 成功 {success_count} 个, 总失败数 {execution.failed_count}",
            operator
        )
        
        return success_count

    @classmethod
    def rollback_execution(
        cls,
        db: Session,
        execution_id: int,
        target_execution_id: Optional[int] = None,
        operator: Optional[str] = None
    ) -> int:
        execution = db.query(TaskExecution).get(execution_id)
        if not execution:
            raise ValueError("执行记录不存在")
        
        if execution.status == "running":
            raise ValueError("正在执行中的任务无法撤回")
        
        items = db.query(ExecutionItem).filter(
            ExecutionItem.execution_id == execution_id
        ).all()
        
        if not items:
            return 0
        
        WarmupOrchestrator._record_history(
            db, execution_id,
            "rollback_start",
            f"开始撤回: 目标执行ID={target_execution_id or '删除本次预热数据'}",
            operator
        )
        
        target_history: Dict[str, str] = {}
        if target_execution_id:
            target_execution = db.query(TaskExecution).get(target_execution_id)
            if not target_execution:
                raise ValueError("目标执行记录不存在")
            
            target_items = db.query(ExecutionItem).filter(
                ExecutionItem.execution_id == target_execution_id
            ).all()
            
            target_history = {
                item.cache_key: item.old_value_hash
                for item in target_items
                if item.old_value_hash
            }
        
        rollback_count = 0
        for item in items:
            if item.status == "success":
                if target_execution_id and item.cache_key in target_history:
                    old_hash = cache_service.get_hash(item.cache_key)
                    if old_hash == item.new_value_hash:
                        cache_service.delete(item.cache_key)
                        rollback_count += 1
                else:
                    current_hash = cache_service.get_hash(item.cache_key)
                    if current_hash == item.new_value_hash:
                        cache_service.delete(item.cache_key)
                        rollback_count += 1
        
        execution.status = "rolled_back"
        db.commit()
        
        WarmupOrchestrator._record_history(
            db, execution_id,
            "rollback_complete",
            f"撤回完成: 共处理 {rollback_count} 个缓存键",
            operator
        )
        
        return rollback_count

    @staticmethod
    def get_execution_items(
        db: Session,
        execution_id: int,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> tuple[List[ExecutionItem], int]:
        query = db.query(ExecutionItem).filter(
            ExecutionItem.execution_id == execution_id
        )
        
        if status:
            query = query.filter(ExecutionItem.status == status)
        
        total = query.count()
        items = query.order_by(ExecutionItem.id.asc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return items, total


task_service = TaskService()
