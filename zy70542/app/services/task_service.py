from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import hashlib
import json

from app.models.task import StreamTask, TaskShard, FailureRecord, ResumeReport
from app.schemas.task import (
    TaskCreate, ShardProgressUpdate, FailureRecordCreate, ManualFixRequest, TaskResumeRequest
)


class TaskService:
    @staticmethod
    def create_task(db: Session, task_data: TaskCreate) -> StreamTask:
        existing_task = db.query(StreamTask).filter(StreamTask.id == task_data.task_id).first()
        if existing_task:
            raise ValueError(f"Task {task_data.task_id} already exists")

        task = StreamTask(
            id=task_data.task_id,
            task_name=task_data.task_name,
            total_shards=task_data.total_shards,
            target_watermark=task_data.target_watermark,
            task_metadata=task_data.task_metadata or {}
        )
        db.add(task)

        for shard_no in range(task_data.total_shards):
            shard = TaskShard(
                id=f"{task_data.task_id}_shard_{shard_no}",
                task_id=task_data.task_id,
                shard_no=shard_no
            )
            db.add(shard)

        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_task(db: Session, task_id: str) -> Optional[StreamTask]:
        return db.query(StreamTask).filter(StreamTask.id == task_id).first()

    @staticmethod
    def get_task_shards(db: Session, task_id: str) -> List[TaskShard]:
        return db.query(TaskShard).filter(TaskShard.task_id == task_id).order_by(TaskShard.shard_no).all()

    @staticmethod
    def get_task_failures(db: Session, task_id: str, shard_no: Optional[int] = None) -> List[FailureRecord]:
        query = db.query(FailureRecord).filter(FailureRecord.task_id == task_id)
        if shard_no is not None:
            query = query.filter(FailureRecord.shard_no == shard_no)
        return query.order_by(desc(FailureRecord.created_at)).all()

    @staticmethod
    def get_resume_reports(db: Session, task_id: str) -> List[ResumeReport]:
        return db.query(ResumeReport).filter(ResumeReport.task_id == task_id).order_by(desc(ResumeReport.resume_no)).all()

    @staticmethod
    def start_task(db: Session, task_id: str) -> StreamTask:
        task = TaskService.get_task(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task.status not in ["pending", "paused", "failed"]:
            raise ValueError(f"Task {task_id} is not in startable state: {task.status}")

        task.status = "running"
        if not task.started_at:
            task.started_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def update_shard_progress(db: Session, task_id: str, shard_update: ShardProgressUpdate) -> TaskShard:
        task = TaskService.get_task(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        shard = db.query(TaskShard).filter(
            TaskShard.task_id == task_id,
            TaskShard.shard_no == shard_update.shard_no
        ).first()

        if not shard:
            raise ValueError(f"Shard {shard_update.shard_no} not found for task {task_id}")

        if shard_update.current_offset < shard.current_offset:
            raise ValueError(f"Cannot rollback offset: current={shard.current_offset}, new={shard_update.current_offset}")

        if shard_update.checksum:
            existing_progress = f"{shard.task_id}:{shard.shard_no}:{shard.current_offset}:{shard.processed_count}"
            expected_checksum = hashlib.md5(existing_progress.encode()).hexdigest()
            if shard.checksum and shard.checksum != expected_checksum:
                raise ValueError(f"Checksum mismatch: possible duplicate or tampered request")

        shard.current_offset = shard_update.current_offset
        shard.processed_count = shard_update.processed_count
        shard.success_count = shard_update.success_count
        shard.failed_count = shard_update.failed_count
        shard.status = "running"

        new_progress = f"{shard.task_id}:{shard.shard_no}:{shard.current_offset}:{shard.processed_count}"
        shard.checksum = hashlib.md5(new_progress.encode()).hexdigest()

        db.commit()
        db.refresh(shard)
        return shard

    @staticmethod
    def update_watermark(db: Session, task_id: str, watermark: int) -> StreamTask:
        task = TaskService.get_task(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        if watermark < task.current_watermark:
            raise ValueError(f"Cannot rollback watermark: current={task.current_watermark}, new={watermark}")

        task.current_watermark = watermark

        if task.target_watermark > 0 and watermark >= task.target_watermark:
            task.status = "completed"
            task.finished_at = datetime.utcnow()

        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def record_failure(db: Session, task_id: str, failure_data: FailureRecordCreate) -> FailureRecord:
        task = TaskService.get_task(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        existing = db.query(FailureRecord).filter(
            FailureRecord.task_id == task_id,
            FailureRecord.shard_no == failure_data.shard_no,
            FailureRecord.offset == failure_data.offset
        ).first()

        if existing:
            return existing

        failure = FailureRecord(
            task_id=task_id,
            shard_no=failure_data.shard_no,
            offset=failure_data.offset,
            raw_input=failure_data.raw_input,
            process_context=failure_data.process_context,
            error_message=failure_data.error_message,
            error_stack=failure_data.error_stack
        )
        db.add(failure)
        db.commit()
        db.refresh(failure)
        return failure

    @staticmethod
    def manual_fix(db: Session, task_id: str, fix_data: ManualFixRequest) -> FailureRecord:
        failure = db.query(FailureRecord).filter(
            FailureRecord.id == fix_data.failure_id,
            FailureRecord.task_id == task_id
        ).first()

        if not failure:
            raise ValueError(f"Failure record {fix_data.failure_id} not found for task {task_id}")

        failure.is_manually_fixed = True
        failure.fix_note = fix_data.fix_note
        failure.final_status = fix_data.final_status
        failure.fixed_at = datetime.utcnow()

        db.commit()
        db.refresh(failure)
        return failure

    @staticmethod
    def resume_task(db: Session, task_id: str, resume_data: TaskResumeRequest) -> ResumeReport:
        task = TaskService.get_task(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        last_report = db.query(ResumeReport).filter(
            ResumeReport.task_id == task_id
        ).order_by(desc(ResumeReport.resume_no)).first()

        resume_no = last_report.resume_no + 1 if last_report else 1

        shards = TaskService.get_task_shards(db, task_id)
        already_synced = []
        for shard in shards:
            if shard.status == "completed" and shard.current_offset > 0:
                already_synced.append({
                    "shard_no": shard.shard_no,
                    "offset": shard.current_offset,
                    "count": shard.processed_count
                })

        report = ResumeReport(
            task_id=task_id,
            resume_no=resume_no,
            start_watermark=task.current_watermark,
            end_watermark=task.current_watermark,
            already_synced=already_synced,
            resume_reason=resume_data.resume_reason
        )
        db.add(report)

        for shard in shards:
            if shard.status not in ["completed"]:
                shard.status = "running"

        task.status = "running"
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def complete_shard(db: Session, task_id: str, shard_no: int) -> TaskShard:
        shard = db.query(TaskShard).filter(
            TaskShard.task_id == task_id,
            TaskShard.shard_no == shard_no
        ).first()

        if not shard:
            raise ValueError(f"Shard {shard_no} not found")

        shard.status = "completed"
        shard.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(shard)

        shards = TaskService.get_task_shards(db, task_id)
        all_completed = all(s.status == "completed" for s in shards)
        if all_completed:
            task = TaskService.get_task(db, task_id)
            task.status = "completed"
            task.finished_at = datetime.utcnow()
            db.commit()

        return shard

    @staticmethod
    def export_task_data(db: Session, task_id: str) -> dict:
        task = TaskService.get_task(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        shards = TaskService.get_task_shards(db, task_id)
        failures = TaskService.get_task_failures(db, task_id)
        reports = TaskService.get_resume_reports(db, task_id)

        return {
            "task": {
                "id": task.id,
                "name": task.task_name,
                "status": task.status,
                "current_watermark": task.current_watermark,
                "target_watermark": task.target_watermark,
                "total_shards": task.total_shards
            },
            "shards": [
                {
                    "shard_no": s.shard_no,
                    "status": s.status,
                    "current_offset": s.current_offset,
                    "processed": s.processed_count,
                    "success": s.success_count,
                    "failed": s.failed_count
                }
                for s in shards
            ],
            "failures": [
                {
                    "id": f.id,
                    "shard_no": f.shard_no,
                    "offset": f.offset,
                    "error": f.error_message,
                    "manually_fixed": f.is_manually_fixed
                }
                for f in failures
            ],
            "resume_reports": [
                {
                    "resume_no": r.resume_no,
                    "start_watermark": r.start_watermark,
                    "already_synced": r.already_synced
                }
                for r in reports
            ],
            "summary": {
                "total_processed": sum(s.processed_count for s in shards),
                "total_success": sum(s.success_count for s in shards),
                "total_failed": sum(s.failed_count for s in shards),
                "failure_count": len(failures),
                "resume_count": len(reports)
            }
        }
