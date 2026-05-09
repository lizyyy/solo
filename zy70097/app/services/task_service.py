import uuid
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import BackgroundTask
from app.core.config import settings
from app.tasks.baseline_tasks import calculate_baseline_task, batch_calculate_baseline_task
from app.tasks.saving_tasks import calculate_saving_task, batch_calculate_saving_task
from app.tasks.export_tasks import export_report_task


class TaskService:
    """后台任务管理服务"""
    
    @staticmethod
    def generate_task_id() -> str:
        """生成唯一任务ID"""
        return f"task_{uuid.uuid4().hex[:16]}"
    
    @classmethod
    def create_task(cls, db: Session, task_type: str, parameters: Dict[str, Any],
                    created_by: Optional[str] = None,
                    max_retries: Optional[int] = None) -> BackgroundTask:
        """
        创建后台任务记录
        
        Args:
            db: 数据库会话
            task_type: 任务类型
            parameters: 任务参数
            created_by: 创建人
            max_retries: 最大重试次数
            
        Returns:
            创建的任务记录
        """
        task_id = cls.generate_task_id()
        
        task = BackgroundTask(
            task_id=task_id,
            task_type=task_type,
            status="pending",
            progress=0,
            retry_count=0,
            max_retries=max_retries or settings.MAX_RETRY_ATTEMPTS,
            parameters=parameters,
            created_by=created_by
        )
        
        db.add(task)
        db.commit()
        db.refresh(task)
        
        return task
    
    @classmethod
    def submit_baseline_calculation(cls, db: Session, equipment_id: Optional[int] = None,
                                    group_id: Optional[int] = None,
                                    start_date: datetime = None,
                                    end_date: datetime = None,
                                    version_name: str = None,
                                    created_by: Optional[str] = None) -> BackgroundTask:
        """
        提交基线计算任务
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            group_id: 分组ID
            start_date: 开始日期
            end_date: 结束日期
            version_name: 版本名称
            created_by: 创建人
            
        Returns:
            提交的任务记录
        """
        parameters = {
            "equipment_id": equipment_id,
            "group_id": group_id,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "version_name": version_name
        }
        
        task = cls.create_task(db, "baseline_calculation", parameters, created_by)
        
        calculate_baseline_task.delay(
            task_id=task.task_id,
            equipment_id=equipment_id,
            group_id=group_id,
            start_date=parameters["start_date"],
            end_date=parameters["end_date"],
            version_name=version_name,
            created_by=created_by
        )
        
        return task
    
    @classmethod
    def submit_batch_baseline_calculation(cls, db: Session, equipment_ids: Optional[list] = None,
                                          group_ids: Optional[list] = None,
                                          start_date: datetime = None,
                                          end_date: datetime = None,
                                          version_name: str = None,
                                          created_by: Optional[str] = None) -> BackgroundTask:
        """
        提交批量基线计算任务
        """
        parameters = {
            "equipment_ids": equipment_ids,
            "group_ids": group_ids,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "version_name": version_name
        }
        
        task = cls.create_task(db, "baseline_calculation", parameters, created_by)
        
        batch_calculate_baseline_task.delay(
            task_id=task.task_id,
            equipment_ids=equipment_ids,
            group_ids=group_ids,
            start_date=parameters["start_date"],
            end_date=parameters["end_date"],
            version_name=version_name,
            created_by=created_by
        )
        
        return task
    
    @classmethod
    def submit_saving_calculation(cls, db: Session, equipment_id: Optional[int] = None,
                                  group_id: Optional[int] = None,
                                  baseline_id: Optional[int] = None,
                                  period_start: datetime = None,
                                  period_end: datetime = None,
                                  created_by: Optional[str] = None) -> BackgroundTask:
        """
        提交节能收益计算任务
        """
        parameters = {
            "equipment_id": equipment_id,
            "group_id": group_id,
            "baseline_id": baseline_id,
            "period_start": period_start.isoformat() if period_start else None,
            "period_end": period_end.isoformat() if period_end else None
        }
        
        task = cls.create_task(db, "saving_calculation", parameters, created_by)
        
        calculate_saving_task.delay(
            task_id=task.task_id,
            equipment_id=equipment_id,
            group_id=group_id,
            baseline_id=baseline_id,
            period_start=parameters["period_start"],
            period_end=parameters["period_end"],
            created_by=created_by
        )
        
        return task
    
    @classmethod
    def submit_batch_saving_calculation(cls, db: Session, equipment_ids: Optional[list] = None,
                                        group_ids: Optional[list] = None,
                                        baseline_id: Optional[int] = None,
                                        period_start: datetime = None,
                                        period_end: datetime = None,
                                        created_by: Optional[str] = None) -> BackgroundTask:
        """
        提交批量节能收益计算任务
        """
        parameters = {
            "equipment_ids": equipment_ids,
            "group_ids": group_ids,
            "baseline_id": baseline_id,
            "period_start": period_start.isoformat() if period_start else None,
            "period_end": period_end.isoformat() if period_end else None
        }
        
        task = cls.create_task(db, "saving_calculation", parameters, created_by)
        
        batch_calculate_saving_task.delay(
            task_id=task.task_id,
            equipment_ids=equipment_ids,
            group_ids=group_ids,
            baseline_id=baseline_id,
            period_start=parameters["period_start"],
            period_end=parameters["period_end"],
            created_by=created_by
        )
        
        return task
    
    @classmethod
    def submit_export_task(cls, db: Session, export_type: str,
                          equipment_ids: Optional[list] = None,
                          group_ids: Optional[list] = None,
                          baseline_id: Optional[int] = None,
                          period_start: Optional[datetime] = None,
                          period_end: Optional[datetime] = None,
                          file_format: str = "xlsx",
                          created_by: Optional[str] = None) -> BackgroundTask:
        """
        提交导出任务
        """
        parameters = {
            "export_type": export_type,
            "equipment_ids": equipment_ids,
            "group_ids": group_ids,
            "baseline_id": baseline_id,
            "period_start": period_start.isoformat() if period_start else None,
            "period_end": period_end.isoformat() if period_end else None,
            "file_format": file_format
        }
        
        task = cls.create_task(db, "export", parameters, created_by)
        
        export_report_task.delay(
            task_id=task.task_id,
            export_type=export_type,
            equipment_ids=equipment_ids,
            group_ids=group_ids,
            baseline_id=baseline_id,
            period_start=parameters["period_start"],
            period_end=parameters["period_end"],
            file_format=file_format
        )
        
        return task
    
    @classmethod
    def get_task_status(cls, db: Session, task_id: str) -> Optional[BackgroundTask]:
        """
        获取任务状态
        """
        return db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
    
    @classmethod
    def retry_task(cls, db: Session, task_id: str, force: bool = False) -> bool:
        """
        重试失败的任务
        
        Args:
            db: 数据库会话
            task_id: 任务ID
            force: 是否强制重试（即使已达到最大重试次数）
            
        Returns:
            是否成功提交重试
        """
        task = db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        if task.status == "completed":
            raise ValueError(f"任务 {task_id} 已完成，无需重试")
        
        if task.status == "running":
            raise ValueError(f"任务 {task_id} 正在执行中，无法重试")
        
        if not force and task.retry_count >= task.max_retries:
            raise ValueError(
                f"任务 {task_id} 已达到最大重试次数 ({task.max_retries}次)，"
                f"如需继续重试请使用 force=true 参数"
            )
        
        task.retry_count += 1 if not force else 0
        task.status = "pending"
        task.progress = 0
        task.error_message = None
        task.error_traceback = None
        task.next_retry_at = None
        db.commit()
        
        params = task.parameters or {}
        
        if task.task_type == "baseline_calculation":
            if params.get("equipment_ids") or params.get("group_ids"):
                batch_calculate_baseline_task.delay(
                    task_id=task.task_id,
                    equipment_ids=params.get("equipment_ids"),
                    group_ids=params.get("group_ids"),
                    start_date=params.get("start_date"),
                    end_date=params.get("end_date"),
                    version_name=params.get("version_name"),
                    created_by=task.created_by
                )
            else:
                calculate_baseline_task.delay(
                    task_id=task.task_id,
                    equipment_id=params.get("equipment_id"),
                    group_id=params.get("group_id"),
                    start_date=params.get("start_date"),
                    end_date=params.get("end_date"),
                    version_name=params.get("version_name"),
                    created_by=task.created_by
                )
        
        elif task.task_type == "saving_calculation":
            if params.get("equipment_ids") or params.get("group_ids"):
                batch_calculate_saving_task.delay(
                    task_id=task.task_id,
                    equipment_ids=params.get("equipment_ids"),
                    group_ids=params.get("group_ids"),
                    baseline_id=params.get("baseline_id"),
                    period_start=params.get("period_start"),
                    period_end=params.get("period_end"),
                    created_by=task.created_by
                )
            else:
                calculate_saving_task.delay(
                    task_id=task.task_id,
                    equipment_id=params.get("equipment_id"),
                    group_id=params.get("group_id"),
                    baseline_id=params.get("baseline_id"),
                    period_start=params.get("period_start"),
                    period_end=params.get("period_end"),
                    created_by=task.created_by
                )
        
        elif task.task_type == "export":
            export_report_task.delay(
                task_id=task.task_id,
                export_type=params.get("export_type"),
                equipment_ids=params.get("equipment_ids"),
                group_ids=params.get("group_ids"),
                baseline_id=params.get("baseline_id"),
                period_start=params.get("period_start"),
                period_end=params.get("period_end"),
                file_format=params.get("file_format", "xlsx")
            )
        
        return True
