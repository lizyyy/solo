import os
from datetime import datetime
from typing import List, Optional, Dict, Any
import pandas as pd
from sqlalchemy.orm import Session
from app.models import Task, TaskStatus, ExceptionType, Escort, Patient, AuditLog
from app.config import EXPORT_DIR


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        os.makedirs(EXPORT_DIR, exist_ok=True)

    def _get_task_data_for_export(
        self,
        status: Optional[TaskStatus] = None,
        escort_id: Optional[int] = None,
        priority: Optional[str] = None,
        has_exception: Optional[bool] = None,
        exception_type: Optional[ExceptionType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        query = self.db.query(Task).join(Patient).join(Escort, isouter=True)

        if status:
            query = query.filter(Task.status == status)
        if escort_id:
            query = query.filter(Task.assigned_escort_id == escort_id)
        if priority:
            query = query.filter(Task.priority == priority)
        if has_exception is not None:
            query = query.filter(Task.has_exception == has_exception)
        if exception_type:
            query = query.filter(Task.exception_type == exception_type)
        if start_date:
            query = query.filter(Task.created_at >= start_date)
        if end_date:
            query = query.filter(Task.created_at <= end_date)

        tasks = query.order_by(Task.created_at.desc()).all()

        data = []
        for task in tasks:
            data.append({
                "任务ID": task.id,
                "请求ID": task.request_id,
                "患者姓名": task.patient.name if task.patient else "",
                "病历号": task.patient.medical_record_no if task.patient else "",
                "科室": task.patient.department if task.patient else "",
                "床号": task.patient.bed_no if task.patient else "",
                "陪检员": task.assigned_escort.name if task.assigned_escort else "",
                "状态": task.status,
                "优先级": task.priority,
                "服务类型": task.service_type or "",
                "起始位置": task.from_location or "",
                "目标位置": task.to_location or "",
                "排队位置": task.queue_position or "",
                "创建时间": task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else "",
                "派单时间": task.assigned_at.strftime("%Y-%m-%d %H:%M:%S") if task.assigned_at else "",
                "接单时间": task.accepted_at.strftime("%Y-%m-%d %H:%M:%S") if task.accepted_at else "",
                "完成时间": task.completed_at.strftime("%Y-%m-%d %H:%M:%S") if task.completed_at else "",
                "等待时长(分钟)": task.wait_duration or 0,
                "服务时长(分钟)": task.service_duration or 0,
                "总时长(分钟)": task.total_duration or 0,
                "是否异常": "是" if task.has_exception else "否",
                "异常类型": task.exception_type or "",
                "异常说明": task.exception_note or "",
                "操作人角色": task.operator_role or "",
                "操作人姓名": task.operator_name or "",
            })

        return data

    def export_tasks_to_excel(
        self,
        status: Optional[TaskStatus] = None,
        escort_id: Optional[int] = None,
        priority: Optional[str] = None,
        has_exception: Optional[bool] = None,
        exception_type: Optional[ExceptionType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        filename: Optional[str] = None,
    ) -> str:
        data = self._get_task_data_for_export(
            status=status,
            escort_id=escort_id,
            priority=priority,
            has_exception=has_exception,
            exception_type=exception_type,
            start_date=start_date,
            end_date=end_date,
        )

        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"tasks_export_{timestamp}.xlsx"

        filepath = os.path.join(EXPORT_DIR, filename)

        df = pd.DataFrame(data)
        df.to_excel(filepath, index=False, engine="openpyxl")

        return filepath

    def export_tasks_to_csv(
        self,
        status: Optional[TaskStatus] = None,
        escort_id: Optional[int] = None,
        priority: Optional[str] = None,
        has_exception: Optional[bool] = None,
        exception_type: Optional[ExceptionType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        filename: Optional[str] = None,
    ) -> str:
        data = self._get_task_data_for_export(
            status=status,
            escort_id=escort_id,
            priority=priority,
            has_exception=has_exception,
            exception_type=exception_type,
            start_date=start_date,
            end_date=end_date,
        )

        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"tasks_export_{timestamp}.csv"

        filepath = os.path.join(EXPORT_DIR, filename)

        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False, encoding="utf-8-sig")

        return filepath

    def get_export_filepath(self, filename: str) -> Optional[str]:
        filepath = os.path.join(EXPORT_DIR, filename)
        if os.path.exists(filepath):
            return filepath
        return None

    def list_export_files(self) -> List[Dict[str, Any]]:
        files = []
        for filename in os.listdir(EXPORT_DIR):
            filepath = os.path.join(EXPORT_DIR, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                files.append({
                    "filename": filename,
                    "size_bytes": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M:%S"),
                })
        return sorted(files, key=lambda x: x["created_at"], reverse=True)
