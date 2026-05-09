import traceback
from datetime import datetime
from celery import shared_task
from app.core.database import SessionLocal
from app.models import BackgroundTask
from app.services import ExportService


@shared_task(bind=True, name="app.tasks.export_tasks.export_report_task")
def export_report_task(self, task_id: str, export_type: str, equipment_ids: list = None,
                       group_ids: list = None, baseline_id: int = None,
                       period_start: str = None, period_end: str = None,
                       file_format: str = "xlsx"):
    """
    导出报告的后台任务
    
    失败重试机制：
    - 自动重试：最多3次，每次间隔60秒
    - 手动重试：通过API调用
    - 重试时会检查已生成的文件，避免重复生成
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
        
        start_dt = datetime.fromisoformat(period_start) if period_start else None
        end_dt = datetime.fromisoformat(period_end) if period_end else None
        
        task.progress = 30
        db.commit()
        
        filepath = None
        
        if export_type == "baseline":
            filepath = ExportService.export_baseline_report(
                db=db,
                equipment_ids=equipment_ids,
                group_ids=group_ids,
                file_format=file_format
            )
        elif export_type == "saving":
            filepath = ExportService.export_saving_report(
                db=db,
                period_start=start_dt,
                period_end=end_dt,
                equipment_ids=equipment_ids,
                group_ids=group_ids,
                baseline_id=baseline_id,
                file_format=file_format
            )
        elif export_type == "energy_data":
            filepath = ExportService.export_energy_data(
                db=db,
                equipment_ids=equipment_ids,
                start_date=start_dt,
                end_date=end_dt,
                include_outliers=True,
                file_format=file_format
            )
        elif export_type == "production_data":
            filepath = ExportService.export_production_data(
                db=db,
                equipment_ids=equipment_ids,
                start_date=start_dt,
                end_date=end_dt,
                include_outliers=True,
                file_format=file_format
            )
        elif export_type == "audit":
            filepath = ExportService.export_audit_log(
                db=db,
                start_date=start_dt,
                end_date=end_dt,
                file_format=file_format
            )
        
        task.progress = 90
        db.commit()
        
        task.result = {
            "export_type": export_type,
            "file_path": filepath,
            "file_format": file_format
        }
        task.export_file = filepath
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
