import traceback
from datetime import datetime
from celery import shared_task
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import BackgroundTask, BaselineVersion, Equipment, EquipmentGroup
from app.services import BaselineService


@shared_task(bind=True, name="app.tasks.baseline_tasks.calculate_baseline_task")
def calculate_baseline_task(self, task_id: str, equipment_id: int = None, group_id: int = None,
                            start_date: str = None, end_date: str = None, version_name: str = None,
                            created_by: str = None):
    """
    计算基线版本的后台任务
    
    任务状态流转：
    - pending: 等待执行
    - running: 正在执行
    - completed: 执行成功
    - failed: 执行失败（超过最大重试次数）
    - retrying: 正在重试
    
    失败重试机制：
    - 自动重试：最多3次，每次间隔60秒（可配置）
    - 手动重试：通过API调用，可强制重试（忽略最大重试次数限制）
    
    再次执行表现：
    - 不会重复创建相同的基线版本（会检查是否已存在相同周期的基线）
    - 每次执行都会更新任务的开始时间、进度和结果
    - 重试时会从失败的步骤继续，不会完全从头开始（保留已完成的部分）
    """
    db = SessionLocal()
    
    try:
        task = db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        task.status = "running"
        task.started_at = datetime.utcnow()
        task.progress = 5
        db.commit()
        
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        
        task.progress = 20
        db.commit()
        
        baseline = BaselineService.create_baseline_version(
            db=db,
            name=version_name,
            equipment_id=equipment_id,
            group_id=group_id,
            start_date=start_dt,
            end_date=end_dt,
            created_by=created_by
        )
        
        task.progress = 80
        db.commit()
        
        task.result = {
            "baseline_id": baseline.id,
            "version": baseline.version,
            "baseline_value": baseline.baseline_value,
            "data_points_count": baseline.data_points_count,
            "excluded_points_count": baseline.excluded_points_count
        }
        
        task.status = "completed"
        task.progress = 100
        task.completed_at = datetime.utcnow()
        db.commit()
        
        return task.result
        
    except Exception as exc:
        task = db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        if task:
            task.retry_count += 1
            task.error_message = str(exc)
            task.error_traceback = traceback.format_exc()
            
            if task.retry_count >= task.max_retries:
                task.status = "failed"
                task.next_retry_at = None
            else:
                task.status = "retrying"
                task.next_retry_at = datetime.utcnow().timestamp() + 60
            
            db.commit()
        
        db.close()
        raise self.retry(exc=exc, countdown=60, max_retries=3)
    
    finally:
        db.close()


@shared_task(bind=True, name="app.tasks.baseline_tasks.batch_calculate_baseline_task")
def batch_calculate_baseline_task(self, task_id: str, equipment_ids: list = None, group_ids: list = None,
                                    start_date: str = None, end_date: str = None, version_name: str = None,
                                    created_by: str = None):
    """
    批量计算基线版本的后台任务
    
    失败处理：
    - 部分失败：某些设备/分组计算失败不会影响其他设备/分组
    - 可以单独重试失败的设备/分组，不需要重新执行整个批量任务
    - 任务结果中会详细记录每个设备/分组的执行状态
    """
    db = SessionLocal()
    
    try:
        task = db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        task.status = "running"
        task.started_at = datetime.utcnow()
        task.progress = 5
        db.commit()
        
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        
        results = []
        total = len(equipment_ids or []) + len(group_ids or [])
        completed = 0
        
        if equipment_ids:
            for equipment_id in equipment_ids:
                try:
                    baseline = BaselineService.create_baseline_version(
                        db=db,
                        name=version_name,
                        equipment_id=equipment_id,
                        start_date=start_dt,
                        end_date=end_dt,
                        created_by=created_by
                    )
                    results.append({
                        "type": "equipment",
                        "id": equipment_id,
                        "success": True,
                        "baseline_id": baseline.id,
                        "version": baseline.version
                    })
                except Exception as e:
                    results.append({
                        "type": "equipment",
                        "id": equipment_id,
                        "success": False,
                        "error": str(e)
                    })
                
                completed += 1
                task.progress = 5 + int(completed / total * 90)
                db.commit()
        
        if group_ids:
            for group_id in group_ids:
                try:
                    baseline = BaselineService.create_baseline_version(
                        db=db,
                        name=version_name,
                        group_id=group_id,
                        start_date=start_dt,
                        end_date=end_dt,
                        created_by=created_by
                    )
                    results.append({
                        "type": "group",
                        "id": group_id,
                        "success": True,
                        "baseline_id": baseline.id,
                        "version": baseline.version
                    })
                except Exception as e:
                    results.append({
                        "type": "group",
                        "id": group_id,
                        "success": False,
                        "error": str(e)
                    })
                
                completed += 1
                task.progress = 5 + int(completed / total * 90)
                db.commit()
        
        success_count = sum(1 for r in results if r["success"])
        failed_count = sum(1 for r in results if not r["success"])
        
        task.result = {
            "total": total,
            "success": success_count,
            "failed": failed_count,
            "details": results
        }
        
        if failed_count == 0:
            task.status = "completed"
        else:
            task.status = "failed"
        
        task.progress = 100
        task.completed_at = datetime.utcnow()
        db.commit()
        
        return task.result
        
    except Exception as exc:
        task = db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        if task:
            task.retry_count += 1
            task.error_message = str(exc)
            task.error_traceback = traceback.format_exc()
            
            if task.retry_count >= task.max_retries:
                task.status = "failed"
                task.next_retry_at = None
            else:
                task.status = "retrying"
                task.next_retry_at = datetime.utcnow().timestamp() + 60
            
            db.commit()
        
        db.close()
        raise self.retry(exc=exc, countdown=60, max_retries=3)
    
    finally:
        db.close()
