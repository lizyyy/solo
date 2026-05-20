from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
import csv
from io import StringIO

from app.models import (
    SampleTask, Sample, BrandBatch, TalentSchedule, DepositRecord,
    ErrorDetail, AuditLog, TaskStatus, DataCategory, SampleStatus
)


class ExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_task_report(self, task_id: int) -> Dict[str, Any]:
        task = self.db.query(SampleTask).filter(SampleTask.id == task_id).first()
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        samples = self.db.query(Sample).filter(Sample.task_id == task_id).all()
        errors = self.db.query(ErrorDetail).filter(ErrorDetail.task_id == task_id).all()
        audit_logs = self.db.query(AuditLog).filter(AuditLog.task_id == task_id).all()
        deposits = self.db.query(DepositRecord).filter(DepositRecord.task_id == task_id).all()
        
        brand_batch = None
        if task.brand_batch_id:
            brand_batch = self.db.query(BrandBatch).filter(
                BrandBatch.id == task.brand_batch_id
            ).first()
        
        talent_schedule = None
        if task.talent_schedule_id:
            talent_schedule = self.db.query(TalentSchedule).filter(
                TalentSchedule.id == task.talent_schedule_id
            ).first()
        
        report = {
            "report_generated_at": datetime.now().isoformat(),
            "task": {
                "id": task.id,
                "task_no": task.task_no,
                "batch_no": task.batch_no,
                "status": task.status.value if task.status else None,
                "category": task.category.value if task.category else None,
                "category_reason": task.category_reason,
                "submitted_by": task.submitted_by,
                "submitted_at": task.submitted_at.isoformat() if task.submitted_at else None,
                "processed_at": task.processed_at.isoformat() if task.processed_at else None,
                "source_file": task.source_file,
                "row_number": task.row_number,
            },
            "raw_data": json.loads(task.raw_data) if task.raw_data else None,
            "brand_batch": {
                "batch_no": brand_batch.batch_no,
                "brand_name": brand_batch.brand_name,
                "product_line": brand_batch.product_line,
                "batch_date": brand_batch.batch_date.isoformat() if brand_batch and brand_batch.batch_date else None,
            } if brand_batch else None,
            "talent_schedule": {
                "schedule_no": talent_schedule.schedule_no,
                "talent_name": talent_schedule.talent_name,
                "talent_id": talent_schedule.talent_id,
                "live_date": talent_schedule.live_date.isoformat() if talent_schedule and talent_schedule.live_date else None,
                "platform": talent_schedule.platform,
                "room_id": talent_schedule.room_id,
            } if talent_schedule else None,
            "samples": [
                {
                    "id": s.id,
                    "sample_code": s.sample_code,
                    "sample_name": s.sample_name,
                    "quantity": s.quantity,
                    "unit": s.unit,
                    "status": s.status.value if s.status else None,
                    "has_damage_photo": s.has_damage_photo,
                    "damage_photo_url": s.damage_photo_url,
                    "shipped_at": s.shipped_at.isoformat() if s.shipped_at else None,
                    "received_at": s.received_at.isoformat() if s.received_at else None,
                    "returned_at": s.returned_at.isoformat() if s.returned_at else None,
                    "settled_at": s.settled_at.isoformat() if s.settled_at else None,
                    "remark": s.remark,
                }
                for s in samples
            ],
            "deposits": [
                {
                    "id": d.id,
                    "amount": d.amount,
                    "currency": d.currency,
                    "deduction_reason": d.deduction_reason,
                    "deducted_at": d.deducted_at.isoformat() if d.deducted_at else None,
                    "deducted_by": d.deducted_by,
                    "is_settled": d.is_settled,
                    "settled_at": d.settled_at.isoformat() if d.settled_at else None,
                }
                for d in deposits
            ],
            "errors": [
                {
                    "id": e.id,
                    "error_type": e.error_type,
                    "error_field": e.error_field,
                    "error_message": e.error_message,
                    "source_ref": e.source_ref,
                    "row_number": e.row_number,
                    "column_ref": e.column_ref,
                }
                for e in errors
            ],
            "audit_logs": [
                {
                    "id": log.id,
                    "operator_id": log.operator_id,
                    "operator_name": log.operator.username if log.operator else None,
                    "action": log.action,
                    "field_changed": log.field_changed,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "reason": log.reason,
                    "operated_at": log.operated_at.isoformat() if log.operated_at else None,
                }
                for log in audit_logs
            ],
            "traceability": self._build_traceability(task, samples, brand_batch, talent_schedule)
        }
        
        return report
    
    def _build_traceability(self, task: SampleTask, samples: List[Sample],
                            brand_batch: Optional[BrandBatch],
                            talent_schedule: Optional[TalentSchedule]) -> Dict[str, Any]:
        return {
            "key_fields_tracking": {
                "task_no": {
                    "original": task.task_no,
                    "final": task.task_no,
                    "source": "raw_data.task_no"
                },
                "brand_batch": {
                    "original": brand_batch.batch_no if brand_batch else None,
                    "final": brand_batch.batch_no if brand_batch else None,
                    "source": "brand_batch.batch_no"
                },
                "talent": {
                    "original": talent_schedule.talent_name if talent_schedule else None,
                    "final": talent_schedule.talent_name if talent_schedule else None,
                    "source": "talent_schedule.talent_name"
                },
                "live_date": {
                    "original": talent_schedule.live_date.isoformat() if talent_schedule and talent_schedule.live_date else None,
                    "final": talent_schedule.live_date.isoformat() if talent_schedule and talent_schedule.live_date else None,
                    "source": "talent_schedule.live_date"
                }
            },
            "source_location": {
                "file": task.source_file,
                "row": task.row_number,
            },
            "processing_path": {
                "initial_category": task.category.value if task.category else None,
                "current_status": task.status.value if task.status else None,
                "has_errors": len(samples) > 0
            }
        }
    
    def export_tasks_to_json(self, task_ids: List[int]) -> str:
        reports = []
        for task_id in task_ids:
            try:
                report = self.generate_task_report(task_id)
                reports.append(report)
            except ValueError:
                continue
        return json.dumps(reports, ensure_ascii=False, indent=2)
    
    def export_tasks_to_csv(self, task_ids: List[int]) -> str:
        output = StringIO()
        fieldnames = [
            '任务ID', '任务编号', '批次号', '状态', '分类', '分类原因',
            '提交人', '提交时间', '品牌名称', '达人名称', '直播日期',
            '样品数量', '押金金额', '是否结清', '来源文件', '行号'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for task_id in task_ids:
            task = self.db.query(SampleTask).filter(SampleTask.id == task_id).first()
            if not task:
                continue
            
            brand_batch = None
            if task.brand_batch_id:
                brand_batch = self.db.query(BrandBatch).filter(
                    BrandBatch.id == task.brand_batch_id
                ).first()
            
            talent_schedule = None
            if task.talent_schedule_id:
                talent_schedule = self.db.query(TalentSchedule).filter(
                    TalentSchedule.id == task.talent_schedule_id
                ).first()
            
            samples = self.db.query(Sample).filter(Sample.task_id == task_id).all()
            deposits = self.db.query(DepositRecord).filter(DepositRecord.task_id == task_id).all()
            
            total_deposit = sum(d.amount for d in deposits)
            is_settled = all(d.is_settled for d in deposits) if deposits else False
            
            writer.writerow({
                '任务ID': task.id,
                '任务编号': task.task_no,
                '批次号': task.batch_no,
                '状态': task.status.value if task.status else '',
                '分类': task.category.value if task.category else '',
                '分类原因': task.category_reason or '',
                '提交人': task.submitted_by or '',
                '提交时间': task.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if task.submitted_at else '',
                '品牌名称': brand_batch.brand_name if brand_batch else '',
                '达人名称': talent_schedule.talent_name if talent_schedule else '',
                '直播日期': talent_schedule.live_date.strftime('%Y-%m-%d') if talent_schedule and talent_schedule.live_date else '',
                '样品数量': len(samples),
                '押金金额': total_deposit,
                '是否结清': '是' if is_settled else '否',
                '来源文件': task.source_file or '',
                '行号': task.row_number or ''
            })
        
        return output.getvalue()
    
    def export_all_tasks(self, status: Optional[TaskStatus] = None,
                         category: Optional[DataCategory] = None) -> Dict[str, Any]:
        query = self.db.query(SampleTask)
        if status:
            query = query.filter(SampleTask.status == status)
        if category:
            query = query.filter(SampleTask.category == category)
        
        tasks = query.all()
        task_ids = [t.id for t in tasks]
        
        return {
            "total_count": len(tasks),
            "task_ids": task_ids,
            "export_format": ["json", "csv"],
            "generated_at": datetime.now().isoformat()
        }
