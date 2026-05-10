import asyncio
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.models import (
    WarmupTask, TaskExecution, ExecutionItem, 
    ExecutionHistory, DataVersion
)
from app.services.cache_service import cache_service
from app.services.data_source import data_source_factory
from app.services.version_service import version_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RateLimiter:
    def __init__(self, qps_limit: int):
        self.qps_limit = qps_limit
        self._lock = asyncio.Lock()
        self._requests: List[float] = []

    async def acquire(self):
        async with self._lock:
            now = datetime.utcnow().timestamp()
            self._requests = [t for t in self._requests if now - t < 1.0]
            if len(self._requests) >= self.qps_limit:
                wait_time = 1.0 - (now - self._requests[0])
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
                    now = datetime.utcnow().timestamp()
            self._requests.append(now)


class WarmupOrchestrator:
    _running_tasks: Dict[int, asyncio.Task] = {}

    @staticmethod
    def _generate_cache_key(pattern: str, item: Dict[str, Any]) -> str:
        return pattern.format(**item)

    @classmethod
    async def _warmup_single_item(
        cls,
        item: Dict[str, Any],
        task: WarmupTask,
        version: str,
        rate_limiter: RateLimiter
    ) -> Tuple[str, bool, Optional[str], str, bool]:
        await rate_limiter.acquire()
        
        cache_key = cls._generate_cache_key(task.cache_key_pattern, item)
        cache_value = item.get("value", item)
        
        old_hash = cache_service.get_hash(cache_key)
        hit_expected = old_hash is not None
        
        try:
            new_hash = cache_service.set(cache_key, cache_value, task.ttl_seconds)
            hit_actual = cache_service.exists(cache_key)
            
            logger.info(f"预热完成: key={cache_key}, version={version}")
            return cache_key, True, None, new_hash, hit_actual
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"预热失败: key={cache_key}, error={error_msg}")
            return cache_key, False, error_msg, old_hash or "", hit_expected

    @classmethod
    def _record_history(
        cls,
        db: Session,
        execution_id: int,
        action_type: str,
        details: str,
        operator: Optional[str] = None
    ):
        history = ExecutionHistory(
            execution_id=execution_id,
            action_type=action_type,
            action_details=details,
            operator=operator
        )
        db.add(history)
        db.commit()

    @classmethod
    async def execute_warmup(
        cls,
        task_id: int,
        execution_id: int,
        concurrency: int,
        qps_limit: int,
        version: str
    ):
        db = SessionLocal()
        try:
            task = db.query(WarmupTask).get(task_id)
            if not task:
                return
            
            execution = db.query(TaskExecution).get(execution_id)
            if not execution:
                return
            
            execution.status = "running"
            execution.started_at = datetime.utcnow()
            db.commit()
            
            cls._record_history(
                db, execution_id,
                "start",
                f"任务开始执行: 并发={concurrency}, QPS限制={qps_limit}, 版本={version}"
            )
            
            data_source = data_source_factory.get(task.data_source_type)
            data = data_source.fetch_data(task.data_source_config)
            
            execution.total_items = len(data)
            db.commit()
            
            for item in data:
                cache_key = cls._generate_cache_key(task.cache_key_pattern, item)
                old_hash = cache_service.get_hash(cache_key)
                existing = db.query(ExecutionItem).filter(
                    ExecutionItem.execution_id == execution_id,
                    ExecutionItem.cache_key == cache_key
                ).first()
                
                if not existing:
                    db_item = ExecutionItem(
                        execution_id=execution_id,
                        cache_key=cache_key,
                        data_version=version,
                        old_value_hash=old_hash,
                        hit_expected=(old_hash is not None)
                    )
                    db.add(db_item)
            db.commit()
            
            semaphore = asyncio.Semaphore(concurrency)
            rate_limiter = RateLimiter(qps_limit)
            
            async def process_item(item: Dict[str, Any]):
                async with semaphore:
                    cache_key, success, error, new_hash, hit_actual = \
                        await cls._warmup_single_item(item, task, version, rate_limiter)
                    
                    db_item = db.query(ExecutionItem).filter(
                        ExecutionItem.execution_id == execution_id,
                        ExecutionItem.cache_key == cache_key
                    ).first()
                    
                    if db_item:
                        db_item.status = "success" if success else "failed"
                        db_item.new_value_hash = new_hash
                        db_item.hit_actual = hit_actual
                        db_item.error_message = error
                        db.commit()
                    
                    return success, error
            
            tasks = [process_item(item) for item in data]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            success_count = sum(1 for r in results if isinstance(r, tuple) and r[0])
            failed_count = sum(1 for r in results if isinstance(r, tuple) and not r[0])
            
            items = db.query(ExecutionItem).filter(
                ExecutionItem.execution_id == execution_id
            ).all()
            
            hit_count = sum(1 for i in items if i.hit_actual)
            total_check = len([i for i in items if i.hit_expected is not None])
            hit_rate = hit_count / total_check if total_check > 0 else 0.0
            
            execution.status = "success" if failed_count == 0 else "partial"
            if failed_count > 0 and success_count == 0:
                execution.status = "failed"
            
            execution.completed_at = datetime.utcnow()
            execution.success_count = success_count
            execution.failed_count = failed_count
            execution.hit_rate = hit_rate
            db.commit()
            
            cls._record_history(
                db, execution_id,
                "complete",
                f"任务执行完成: 成功={success_count}, 失败={failed_count}, 命中率={hit_rate:.2%}"
            )
            
            logger.info(
                f"预热任务完成: task_id={task.id}, execution_id={execution_id}, "
                f"success={success_count}, failed={failed_count}"
            )
            
        except Exception as e:
            logger.exception(f"预热任务异常: execution_id={execution_id}")
            try:
                execution = db.query(TaskExecution).get(execution_id)
                if execution:
                    execution.status = "failed"
                    execution.error_message = str(e)
                    db.commit()
                cls._record_history(db, execution_id, "error", f"执行异常: {str(e)}")
            except:
                pass
        finally:
            db.close()
            if execution_id in cls._running_tasks:
                del cls._running_tasks[execution_id]

    @classmethod
    async def retry_failed_items(
        cls,
        execution_id: int,
        operator: Optional[str] = None
    ):
        db = SessionLocal()
        try:
            execution = db.query(TaskExecution).get(execution_id)
            if not execution:
                raise ValueError("执行记录不存在")
            
            task = execution.task
            if not task:
                raise ValueError("关联任务不存在")
            
            failed_items = db.query(ExecutionItem).filter(
                ExecutionItem.execution_id == execution_id,
                ExecutionItem.status == "failed"
            ).all()
            
            if not failed_items:
                return 0
            
            cls._record_history(
                db, execution_id,
                "retry_start",
                f"开始重试失败项: 共 {len(failed_items)} 个",
                operator
            )
            
            data_source = data_source_factory.get(task.data_source_type)
            all_data = data_source.fetch_data(task.data_source_config)
            data_map = {
                cls._generate_cache_key(task.cache_key_pattern, item): item
                for item in all_data
            }
            
            rate_limiter = RateLimiter(task.default_qps_limit)
            
            retry_count = 0
            for db_item in failed_items:
                item = data_map.get(db_item.cache_key)
                if not item:
                    db_item.error_message = "数据源中已不存在该数据"
                    db.commit()
                    continue
                
                cache_key, success, error, new_hash, hit_actual = \
                    await cls._warmup_single_item(item, task, execution.version, rate_limiter)
                
                db_item.status = "success" if success else "failed"
                db_item.new_value_hash = new_hash
                db_item.hit_actual = hit_actual
                db_item.error_message = error
                db_item.retry_count += 1
                db.commit()
                
                if success:
                    retry_count += 1
            
            execution = db.query(TaskExecution).get(execution_id)
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
            
            cls._record_history(
                db, execution_id,
                "retry_complete",
                f"重试完成: 成功 {retry_count} 个, 剩余失败 {execution.failed_count} 个",
                operator
            )
            
            return retry_count
            
        finally:
            db.close()


orchestrator = WarmupOrchestrator()
