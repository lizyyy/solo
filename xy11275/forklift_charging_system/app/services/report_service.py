from sqlalchemy.orm import Session
from app.models import ChargingTask, OperationLog
from datetime import datetime
import pandas as pd
from io import BytesIO


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def export_tasks_report(
        self,
        requested_by: str = None,
        status: str = None,
        shift: str = None,
        start_time: datetime = None,
        end_time: datetime = None
    ) -> BytesIO:
        query = self.db.query(ChargingTask)
        
        if requested_by:
            query = query.filter(ChargingTask.requested_by == requested_by)
        if status:
            query = query.filter(ChargingTask.status == status)
        if shift:
            query = query.filter(ChargingTask.shift == shift)
        if start_time:
            query = query.filter(ChargingTask.created_at >= start_time)
        if end_time:
            query = query.filter(ChargingTask.created_at <= end_time)
        
        tasks = query.order_by(ChargingTask.created_at.desc()).all()
        
        data = []
        for task in tasks:
            data.append({
                "任务ID": task.id,
                "叉车ID": task.forklift_id,
                "充电桩ID": task.charging_pile_id,
                "班次": task.shift,
                "负责人": task.requested_by,
                "状态": task.status,
                "规则检查结果": task.reason,
                "创建时间": task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else "",
                "更新时间": task.updated_at.strftime("%Y-%m-%d %H:%M:%S") if task.updated_at else ""
            })
        
        df = pd.DataFrame(data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='充电任务报告', index=False)
        
        output.seek(0)
        return output

    def export_logs_report(
        self,
        operator: str = None,
        status: str = None,
        operation_type: str = None,
        start_time: datetime = None,
        end_time: datetime = None
    ) -> BytesIO:
        query = self.db.query(OperationLog)
        
        if operator:
            query = query.filter(OperationLog.operator == operator)
        if status:
            query = query.filter(OperationLog.status == status)
        if operation_type:
            query = query.filter(OperationLog.operation_type == operation_type)
        if start_time:
            query = query.filter(OperationLog.created_at >= start_time)
        if end_time:
            query = query.filter(OperationLog.created_at <= end_time)
        
        logs = query.order_by(OperationLog.created_at.desc()).all()
        
        data = []
        for log in logs:
            data.append({
                "日志ID": log.id,
                "操作类型": log.operation_type,
                "操作人": log.operator,
                "目标ID": log.target_id,
                "目标类型": log.target_type,
                "状态": log.status,
                "原因": log.reason,
                "详情": log.details,
                "创建时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else ""
            })
        
        df = pd.DataFrame(data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='操作日志报告', index=False)
        
        output.seek(0)
        return output
