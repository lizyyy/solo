from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import pandas as pd
from io import BytesIO
from .models import Task, Timeline, ArchiveRecord, CleanupRecord, TaskStatus
from .schemas import ExportRequest


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_tasks_for_export(self, request: ExportRequest) -> List[Task]:
        query = self.db.query(Task)
        
        if request.task_numbers:
            query = query.filter(Task.task_number.in_(request.task_numbers))
        
        if request.start_date:
            query = query.filter(Task.created_at >= request.start_date)
        
        if request.end_date:
            query = query.filter(Task.created_at <= request.end_date)
        
        return query.order_by(Task.created_at.desc()).all()

    def export_to_excel(self, request: ExportRequest) -> BytesIO:
        tasks = self._get_tasks_for_export(request)
        
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            task_data = []
            for task in tasks:
                task_data.append({
                    '任务ID': task.id,
                    '任务编号': task.task_number,
                    '任务名称': task.task_name or '',
                    '任务描述': task.description or '',
                    '当前状态': task.status,
                    '归档策略': task.archive_strategy,
                    '访问权限': task.access_level,
                    '所有者': task.owner,
                    '输出文件路径': task.output_file_path or '',
                    '输出文件名': task.output_file_name or '',
                    '文件大小(字节)': task.output_file_size or 0,
                    '文件哈希': task.output_file_hash or '',
                    '归档位置': task.archive_location or '',
                    '过期时间': task.expire_at.strftime('%Y-%m-%d %H:%M:%S') if task.expire_at else '',
                    '创建时间': task.created_at.strftime('%Y-%m-%d %H:%M:%S') if task.created_at else '',
                    '更新时间': task.updated_at.strftime('%Y-%m-%d %H:%M:%S') if task.updated_at else ''
                })
            
            df_tasks = pd.DataFrame(task_data)
            df_tasks.to_excel(writer, sheet_name='任务概览', index=False)
            
            if request.include_timelines:
                timeline_data = []
                for task in tasks:
                    for timeline in task.timelines:
                        timeline_data.append({
                            '任务编号': task.task_number,
                            '动作类型': timeline.action,
                            '状态变更前': timeline.status_before or '',
                            '状态变更后': timeline.status_after or '',
                            '操作人': timeline.operator or '',
                            '描述': timeline.description or '',
                            '详细信息': str(timeline.details) if timeline.details else '',
                            '时间戳': timeline.timestamp.strftime('%Y-%m-%d %H:%M:%S') if timeline.timestamp else ''
                        })
                
                df_timelines = pd.DataFrame(timeline_data)
                df_timelines.to_excel(writer, sheet_name='时间线记录', index=False)
            
            if request.include_archive_records:
                archive_data = []
                for task in tasks:
                    for record in task.archive_records:
                        archive_data.append({
                            '任务编号': task.task_number,
                            '源位置': record.source_location or '',
                            '目标位置': record.target_location or '',
                            '归档大小(字节)': record.archive_size or 0,
                            '操作人': record.operator or '',
                            '是否成功': '是' if record.is_successful else '否',
                            '错误信息': record.error_message or '',
                            '归档时间': record.created_at.strftime('%Y-%m-%d %H:%M:%S') if record.created_at else ''
                        })
                
                df_archive = pd.DataFrame(archive_data)
                df_archive.to_excel(writer, sheet_name='归档记录', index=False)
            
            if request.include_cleanup_records:
                cleanup_data = []
                for task in tasks:
                    for record in task.cleanup_records:
                        cleanup_data.append({
                            '任务编号': task.task_number,
                            '清理位置': record.cleaned_location or '',
                            '清理原因': record.cleanup_reason or '',
                            '操作人': record.operator or '',
                            '是否成功': '是' if record.is_successful else '否',
                            '错误信息': record.error_message or '',
                            '清理时间': record.created_at.strftime('%Y-%m-%d %H:%M:%S') if record.created_at else ''
                        })
                
                df_cleanup = pd.DataFrame(cleanup_data)
                df_cleanup.to_excel(writer, sheet_name='清理记录', index=False)
            
            summary_data = [{
                '导出时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                '任务总数': len(tasks),
                '已创建': len([t for t in tasks if t.status == TaskStatus.CREATED]),
                '已登记': len([t for t in tasks if t.status == TaskStatus.REGISTERED]),
                '已归档': len([t for t in tasks if t.status == TaskStatus.ARCHIVED]),
                '已过期': len([t for t in tasks if t.status == TaskStatus.EXPIRED]),
                '已清理': len([t for t in tasks if t.status == TaskStatus.CLEANED]),
                '已撤销': len([t for t in tasks if t.status == TaskStatus.REVOKED])
            }]
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name='统计汇总', index=False)
        
        output.seek(0)
        return output
