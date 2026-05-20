from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
import json

from app.models import (
    SampleTask, Sample, BrandBatch, TalentSchedule, DepositRecord,
    ErrorDetail, AuditLog, User, TaskStatus, DataCategory, SampleStatus
)
from app.schemas import SampleTaskCreate, CategoryUpdateRequest, StatusUpdateRequest


class TaskClassificationService:
    def __init__(self, db: Session):
        self.db = db
    
    def validate_task(self, task_data: SampleTaskCreate) -> List[Dict[str, Any]]:
        errors = []
        
        if not task_data.task_no:
            errors.append({
                'error_type': 'missing_field',
                'error_field': 'task_no',
                'error_message': '任务编号不能为空',
                'row_number': task_data.row_number
            })
        
        if not task_data.samples or len(task_data.samples) == 0:
            errors.append({
                'error_type': 'missing_field',
                'error_field': 'samples',
                'error_message': '样品列表不能为空',
                'row_number': task_data.row_number
            })
        
        if task_data.task_no:
            existing_task = self.db.query(SampleTask).filter(
                SampleTask.task_no == task_data.task_no
            ).first()
            if existing_task:
                errors.append({
                    'error_type': 'duplicate',
                    'error_field': 'task_no',
                    'error_message': f'任务编号 {task_data.task_no} 已存在',
                    'row_number': task_data.row_number
                })
        
        if task_data.talent_schedule:
            if task_data.talent_schedule.live_date:
                now = datetime.now()
                if task_data.talent_schedule.live_date < now:
                    errors.append({
                        'error_type': 'time_conflict',
                        'error_field': 'live_date',
                        'error_message': '直播日期不能早于当前日期',
                        'row_number': task_data.row_number
                    })
        
        if task_data.samples:
            for idx, sample in enumerate(task_data.samples):
                if not sample.sample_code:
                    errors.append({
                        'error_type': 'missing_field',
                        'error_field': f'samples[{idx}].sample_code',
                        'error_message': f'第{idx+1}个样品编号不能为空',
                        'row_number': task_data.row_number
                    })
                if not sample.sample_name:
                    errors.append({
                        'error_type': 'missing_field',
                        'error_field': f'samples[{idx}].sample_name',
                        'error_message': f'第{idx+1}个样品名称不能为空',
                        'row_number': task_data.row_number
                    })
        
        return errors
    
    def classify_task(self, errors: List[Dict[str, Any]]) -> tuple[DataCategory, str]:
        if not errors:
            return DataCategory.NORMAL, "数据校验通过，分类为正常"
        
        missing_fields = [e for e in errors if e['error_type'] == 'missing_field']
        time_conflicts = [e for e in errors if e['error_type'] == 'time_conflict']
        duplicates = [e for e in errors if e['error_type'] == 'duplicate']
        
        if duplicates:
            reasons = [e['error_message'] for e in duplicates]
            return DataCategory.BLOCKED, f"已拦截：{'; '.join(reasons)}"
        
        if time_conflicts:
            reasons = [e['error_message'] for e in time_conflicts]
            return DataCategory.BLOCKED, f"已拦截：{'; '.join(reasons)}"
        
        if missing_fields:
            reasons = [e['error_message'] for e in missing_fields]
            return DataCategory.NEED_SUPPLEMENT, f"待补充：{'; '.join(reasons)}"
        
        return DataCategory.BLOCKED, "存在未知错误，已拦截"


class TaskService:
    def __init__(self, db: Session):
        self.db = db
        self.classification_service = TaskClassificationService(db)
    
    def create_task(self, task_data: SampleTaskCreate) -> SampleTask:
        errors = self.classification_service.validate_task(task_data)
        category, category_reason = self.classification_service.classify_task(errors)
        
        if category == DataCategory.BLOCKED:
            status = TaskStatus.FAILED
        elif category == DataCategory.NEED_SUPPLEMENT:
            status = TaskStatus.MANUAL_CONFIRM
        else:
            status = TaskStatus.PROCESSING
        
        has_duplicate = any(e['error_type'] == 'duplicate' for e in errors)
        task_no_to_save = None if has_duplicate else task_data.task_no
        
        task = SampleTask(
            task_no=task_no_to_save,
            batch_no=task_data.batch_no,
            status=status,
            category=category,
            category_reason=category_reason,
            raw_data=json.dumps(task_data.raw_data, ensure_ascii=False),
            source_file=task_data.source_file,
            row_number=task_data.row_number,
            submitted_by=task_data.submitted_by,
            processed_at=datetime.now()
        )
        self.db.add(task)
        self.db.flush()
        
        if task_data.brand_batch:
            brand_batch = self._create_or_get_brand_batch(task_data.brand_batch)
            task.brand_batch_id = brand_batch.id
        
        if task_data.talent_schedule:
            talent_schedule = self._create_or_get_talent_schedule(task_data.talent_schedule)
            task.talent_schedule_id = talent_schedule.id
        
        if task_data.samples:
            for sample_item in task_data.samples:
                sample = Sample(
                    task_id=task.id,
                    sample_code=sample_item.sample_code,
                    sample_name=sample_item.sample_name,
                    quantity=sample_item.quantity,
                    unit=sample_item.unit
                )
                self.db.add(sample)
        
        if task_data.deposit:
            deposit = DepositRecord(
                task_id=task.id,
                amount=task_data.deposit.amount,
                currency=task_data.deposit.currency,
                deduction_reason=task_data.deposit.deduction_reason
            )
            self.db.add(deposit)
        
        for error in errors:
            error_detail = ErrorDetail(
                task_id=task.id,
                error_type=error['error_type'],
                error_field=error.get('error_field'),
                error_message=error['error_message'],
                source_ref=task_data.source_file,
                row_number=error.get('row_number')
            )
            self.db.add(error_detail)
        
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def _create_or_get_brand_batch(self, batch_data):
        batch = self.db.query(BrandBatch).filter(
            BrandBatch.batch_no == batch_data.batch_no
        ).first()
        if batch:
            return batch
        
        batch = BrandBatch(
            batch_no=batch_data.batch_no,
            brand_name=batch_data.brand_name,
            product_line=batch_data.product_line,
            batch_date=batch_data.batch_date
        )
        self.db.add(batch)
        self.db.flush()
        return batch
    
    def _create_or_get_talent_schedule(self, schedule_data):
        schedule = self.db.query(TalentSchedule).filter(
            TalentSchedule.schedule_no == schedule_data.schedule_no
        ).first()
        if schedule:
            return schedule
        
        schedule = TalentSchedule(
            schedule_no=schedule_data.schedule_no,
            talent_name=schedule_data.talent_name,
            talent_id=schedule_data.talent_id,
            live_date=schedule_data.live_date,
            platform=schedule_data.platform,
            room_id=schedule_data.room_id
        )
        self.db.add(schedule)
        self.db.flush()
        return schedule
    
    def update_category(self, task_id: int, update_data: CategoryUpdateRequest) -> SampleTask:
        task = self.db.query(SampleTask).filter(SampleTask.id == task_id).first()
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        old_category = task.category
        old_reason = task.category_reason
        
        task.category = update_data.category
        task.category_reason = update_data.category_reason
        
        self._create_audit_log(
            task_id=task_id,
            operator_id=update_data.operator_id,
            action="update_category",
            field_changed="category",
            old_value=str(old_category) if old_category else None,
            new_value=str(update_data.category),
            reason=update_data.reason
        )
        
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def update_status(self, task_id: int, update_data: StatusUpdateRequest) -> SampleTask:
        task = self.db.query(SampleTask).filter(SampleTask.id == task_id).first()
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        old_status = task.status
        
        task.status = update_data.status
        
        self._create_audit_log(
            task_id=task_id,
            operator_id=update_data.operator_id,
            action="update_status",
            field_changed="status",
            old_value=str(old_status),
            new_value=str(update_data.status),
            reason=update_data.reason
        )
        
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def _create_audit_log(self, task_id: int, operator_id: int, action: str,
                          field_changed: str, old_value: Optional[str],
                          new_value: Optional[str], reason: str):
        audit_log = AuditLog(
            task_id=task_id,
            operator_id=operator_id,
            action=action,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
        self.db.add(audit_log)
    
    def get_task_audit_logs(self, task_id: int) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.task_id == task_id
        ).order_by(AuditLog.operated_at.desc()).all()
    
    def update_damage_photo(self, sample_id: int, has_damage_photo: bool,
                            damage_photo_url: Optional[str], operator_id: int, reason: str) -> Sample:
        sample = self.db.query(Sample).filter(Sample.id == sample_id).first()
        if not sample:
            raise ValueError(f"样品 {sample_id} 不存在")
        
        old_has_photo = sample.has_damage_photo
        old_photo_url = sample.damage_photo_url
        
        sample.has_damage_photo = has_damage_photo
        sample.damage_photo_url = damage_photo_url
        
        self._create_audit_log(
            task_id=sample.task_id,
            operator_id=operator_id,
            action="update_damage_photo",
            field_changed="has_damage_photo",
            old_value=str(old_has_photo),
            new_value=str(has_damage_photo),
            reason=reason
        )
        
        self.db.commit()
        self.db.refresh(sample)
        return sample
    
    def can_settle(self, task_id: int) -> tuple[bool, str]:
        samples = self.db.query(Sample).filter(Sample.task_id == task_id).all()
        
        for sample in samples:
            if not sample.has_damage_photo:
                return False, f"样品 {sample.sample_code} 缺失破损照片，无法结清"
        
        return True, "所有样品校验通过，可以结清"
    
    def settle_task(self, task_id: int, operator_id: int, remark: Optional[str] = None) -> SampleTask:
        can_settle, message = self.can_settle(task_id)
        if not can_settle:
            raise ValueError(message)
        
        task = self.db.query(SampleTask).filter(SampleTask.id == task_id).first()
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        samples = self.db.query(Sample).filter(Sample.task_id == task_id).all()
        for sample in samples:
            sample.status = SampleStatus.SETTLED
            sample.settled_at = datetime.now()
        
        deposits = self.db.query(DepositRecord).filter(DepositRecord.task_id == task_id).all()
        for deposit in deposits:
            deposit.is_settled = True
            deposit.settled_at = datetime.now()
        
        self._create_audit_log(
            task_id=task_id,
            operator_id=operator_id,
            action="settle_task",
            field_changed="status",
            old_value=str(task.status),
            new_value="settled",
            reason=f"结清任务：{remark if remark else '无备注'}"
        )
        
        task.status = TaskStatus.EXPORTED
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def query_tasks(self, status: Optional[TaskStatus] = None,
                    category: Optional[DataCategory] = None,
                    task_no: Optional[str] = None,
                    batch_no: Optional[str] = None,
                    submitted_by: Optional[str] = None,
                    start_date: Optional[datetime] = None,
                    end_date: Optional[datetime] = None) -> List[SampleTask]:
        query = self.db.query(SampleTask)
        
        if status:
            query = query.filter(SampleTask.status == status)
        if category:
            query = query.filter(SampleTask.category == category)
        if task_no:
            query = query.filter(SampleTask.task_no.contains(task_no))
        if batch_no:
            query = query.filter(SampleTask.batch_no.contains(batch_no))
        if submitted_by:
            query = query.filter(SampleTask.submitted_by.contains(submitted_by))
        if start_date:
            query = query.filter(SampleTask.submitted_at >= start_date)
        if end_date:
            query = query.filter(SampleTask.submitted_at <= end_date)
        
        return query.order_by(SampleTask.submitted_at.desc()).all()
