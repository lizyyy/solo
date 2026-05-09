import traceback
from datetime import datetime
from celery import shared_task
from app.core.database import SessionLocal
from app.models import BackgroundTask, EnergySaving
from app.services import SavingService


@shared_task(bind=True, name="app.tasks.saving_tasks.calculate_saving_task")
def calculate_saving_task(self, task_id: str, equipment_id: int = None, group_id: int = None,
                          baseline_id: int = None, period_start: str = None, period_end: str = None,
                          created_by: str = None):
    """
    计算节能收益的后台任务
    
    失败重试机制：
    - 自动重试：最多3次，每次间隔60秒
    - 手动重试：通过API调用，可强制重试
    - 重试时会保留已完成的计算记录，不会重复计算已成功的部分
    """
    db = SessionLocal()
    
    try:
        task = db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        task.status = "running"
        task.started_at = datetime.utcnow()
        task.progress = 10
        db.commit()
        
        start_dt = datetime.fromisoformat(period_start)
        end_dt = datetime.fromisoformat(period_end)
        
        task.progress = 30
        db.commit()
        
        if equipment_id:
            saving = SavingService.create_saving_record(
                db=db,
                equipment_id=equipment_id,
                baseline_id=baseline_id,
                period_start=start_dt,
                period_end=end_dt,
                created_by=created_by
            )
            
            task.result = {
                "saving_id": saving.id,
                "equipment_id": equipment_id,
                "saving_energy": saving.saving_energy,
                "saving_rate": saving.saving_rate,
                "actual_energy": saving.actual_energy,
                "baseline_energy": saving.baseline_energy
            }
        
        elif group_id:
            saving_result = SavingService.calculate_group_saving(
                db=db,
                group_id=group_id,
                baseline_id=baseline_id,
                period_start=start_dt,
                period_end=end_dt
            )
            
            task.result = {
                "group_id": group_id,
                "saving_energy": saving_result["saving_energy"],
                "saving_rate": saving_result["saving_rate"],
                "equipment_count": saving_result["equipment_count"],
                "actual_energy": saving_result["actual_energy"],
                "baseline_energy": saving_result["baseline_energy"]
            }
        
        task.progress = 100
        task.status = "completed"
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


@shared_task(bind=True, name="app.tasks.saving_tasks.batch_calculate_saving_task")
def batch_calculate_saving_task(self, task_id: str, equipment_ids: list = None, group_ids: list = None,
                                  baseline_id: int = None, period_start: str = None, period_end: str = None,
                                  created_by: str = None):
    """
    批量计算节能收益的后台任务
    
    部分失败处理：
    - 某些设备计算失败不会影响其他设备
    - 可以单独重试失败的设备
    - 任务结果中详细记录每个设备的执行状态
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
        
        start_dt = datetime.fromisoformat(period_start)
        end_dt = datetime.fromisoformat(period_end)
        
        results = []
        total = len(equipment_ids or []) + len(group_ids or [])
        completed = 0
        
        if equipment_ids:
            for equipment_id in equipment_ids:
                try:
                    saving = SavingService.create_saving_record(
                        db=db,
                        equipment_id=equipment_id,
                        baseline_id=baseline_id,
                        period_start=start_dt,
                        period_end=end_dt,
                        created_by=created_by
                    )
                    results.append({
                        "type": "equipment",
                        "id": equipment_id,
                        "success": True,
                        "saving_id": saving.id,
                        "saving_energy": saving.saving_energy,
                        "saving_rate": saving.saving_rate
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
                    saving_result = SavingService.calculate_group_saving(
                        db=db,
                        group_id=group_id,
                        baseline_id=baseline_id,
                        period_start=start_dt,
                        period_end=end_dt
                    )
                    results.append({
                        "type": "group",
                        "id": group_id,
                        "success": True,
                        "saving_energy": saving_result["saving_energy"],
                        "saving_rate": saving_result["saving_rate"],
                        "equipment_count": saving_result["equipment_count"]
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
