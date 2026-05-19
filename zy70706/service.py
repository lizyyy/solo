from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import PipelineTask, WriteSummary, ResumeCommand
from schemas import PipelineTaskCreate, PipelineTaskUpdate, WriteSummaryCreate, ResumeCommandCreate, TaskStatus
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Set
import json


VALID_STATE_TRANSITIONS: Dict[str, Set[str]] = {
    TaskStatus.PENDING: {TaskStatus.RUNNING, TaskStatus.SKIPPED},
    TaskStatus.RUNNING: {TaskStatus.SUCCESS, TaskStatus.FAILED},
    TaskStatus.FAILED: {TaskStatus.PENDING, TaskStatus.SKIPPED},
    TaskStatus.SKIPPED: set(),
    TaskStatus.SUCCESS: set(),
}


class PipelineService:
    def __init__(self, db: Session):
        self.db = db

    def check_shard_overlap(self, pipeline_name: str, shard_start: int, shard_end: int) -> Optional[PipelineTask]:
        existing = self.db.query(PipelineTask).filter(
            and_(
                PipelineTask.pipeline_name == pipeline_name,
                PipelineTask.status.in_([TaskStatus.SUCCESS, TaskStatus.RUNNING, TaskStatus.PENDING]),
                or_(
                    and_(
                        PipelineTask.shard_start <= shard_start,
                        PipelineTask.shard_end >= shard_start
                    ),
                    and_(
                        PipelineTask.shard_start <= shard_end,
                        PipelineTask.shard_end >= shard_end
                    ),
                    and_(
                        PipelineTask.shard_start >= shard_start,
                        PipelineTask.shard_end <= shard_end
                    )
                )
            )
        ).first()
        return existing

    def is_valid_state_transition(self, current_status: str, new_status: str) -> bool:
        if new_status not in VALID_STATE_TRANSITIONS:
            return False
        return new_status in VALID_STATE_TRANSITIONS.get(current_status, set())

    def create_task(self, task_create: PipelineTaskCreate) -> Tuple[Optional[PipelineTask], Optional[str]]:
        overlap = self.check_shard_overlap(
            task_create.pipeline_name,
            task_create.shard_start,
            task_create.shard_end
        )
        if overlap:
            return None, f"Shard overlap with existing task #{overlap.id}"

        task = PipelineTask(
            pipeline_name=task_create.pipeline_name,
            shard_start=task_create.shard_start,
            shard_end=task_create.shard_end,
            watermark=task_create.watermark,
            status=TaskStatus.PENDING,
            max_retry=task_create.max_retry
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task, None

    def get_task(self, task_id: int) -> Optional[PipelineTask]:
        return self.db.query(PipelineTask).filter(PipelineTask.id == task_id).first()

    def update_task_status(self, task_id: int, update: PipelineTaskUpdate) -> Tuple[Optional[PipelineTask], Optional[str]]:
        task = self.get_task(task_id)
        if not task:
            return None, "Task not found"

        if task.status == TaskStatus.SUCCESS:
            return None, "Task already completed successfully"

        if task.status == TaskStatus.SKIPPED:
            return None, "Cannot modify skipped task"

        if task.need_manual_review and not update.review_comment:
            return None, "Need manual review comment"

        if update.status:
            if not self.is_valid_state_transition(task.status, update.status):
                return None, f"Invalid state transition from {task.status} to {update.status}"
            
            task.status = update.status
            if update.status == TaskStatus.SUCCESS:
                task.completed_at = datetime.utcnow()
            elif update.status == TaskStatus.FAILED:
                task.retry_count += 1
                if task.retry_count >= task.max_retry:
                    task.need_manual_review = True

        if update.watermark is not None:
            if update.watermark < task.watermark:
                return None, "Watermark cannot go backward"
            task.watermark = update.watermark

        if update.fail_reason is not None:
            task.fail_reason = update.fail_reason

        if update.need_manual_review is not None:
            task.need_manual_review = update.need_manual_review

        if update.review_comment is not None:
            task.review_comment = update.review_comment

        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)
        return task, None

    def get_pending_tasks(self, pipeline_name: str, min_watermark: int = 0) -> List[PipelineTask]:
        query = self.db.query(PipelineTask).filter(
            and_(
                PipelineTask.pipeline_name == pipeline_name,
                PipelineTask.watermark >= min_watermark,
                PipelineTask.status.in_([TaskStatus.PENDING, TaskStatus.FAILED])
            )
        ).order_by(PipelineTask.shard_start)
        return query.all()

    def execute_resume_command(self, cmd_create: ResumeCommandCreate) -> Tuple[List[PipelineTask], Optional[str]]:
        cmd = ResumeCommand(
            pipeline_name=cmd_create.pipeline_name,
            target_watermark=cmd_create.target_watermark,
            force=cmd_create.force,
            skip_shards=cmd_create.skip_shards,
            created_by=cmd_create.created_by
        )
        self.db.add(cmd)

        skip_list = []
        if cmd_create.skip_shards:
            try:
                skip_list = json.loads(cmd_create.skip_shards)
            except:
                skip_list = []

        tasks = self.db.query(PipelineTask).filter(
            and_(
                PipelineTask.pipeline_name == cmd_create.pipeline_name,
                PipelineTask.watermark <= cmd_create.target_watermark,
                PipelineTask.status.in_([TaskStatus.PENDING, TaskStatus.FAILED]),
                PipelineTask.need_manual_review == False
            )
        ).all()

        result_tasks = []
        for task in tasks:
            if [task.shard_start, task.shard_end] in skip_list:
                task.status = TaskStatus.SKIPPED
                task.updated_at = datetime.utcnow()
            else:
                if task.status == TaskStatus.FAILED and task.retry_count >= task.max_retry and not cmd_create.force:
                    continue
                task.status = TaskStatus.PENDING
                task.updated_at = datetime.utcnow()
            result_tasks.append(task)

        cmd.command_status = "executed"
        cmd.executed_at = datetime.utcnow()
        self.db.commit()
        return result_tasks, None

    def create_write_summary(self, summary_create: WriteSummaryCreate) -> WriteSummary:
        duration = 0
        if summary_create.start_time and summary_create.end_time:
            duration = (summary_create.end_time - summary_create.start_time).total_seconds()

        summary = WriteSummary(
            task_id=summary_create.task_id,
            pipeline_name=summary_create.pipeline_name,
            shard_start=summary_create.shard_start,
            shard_end=summary_create.shard_end,
            write_count=summary_create.write_count,
            update_count=summary_create.update_count,
            skip_count=summary_create.skip_count,
            error_count=summary_create.error_count,
            data_size_bytes=summary_create.data_size_bytes,
            start_time=summary_create.start_time,
            end_time=summary_create.end_time,
            duration_seconds=duration
        )
        self.db.add(summary)
        self.db.commit()
        self.db.refresh(summary)
        return summary

    def get_write_summaries(self, pipeline_name: str, start_date: Optional[datetime] = None,
                           end_date: Optional[datetime] = None) -> List[WriteSummary]:
        query = self.db.query(WriteSummary).filter(WriteSummary.pipeline_name == pipeline_name)
        if start_date:
            query = query.filter(WriteSummary.created_at >= start_date)
        if end_date:
            query = query.filter(WriteSummary.created_at <= end_date)
        return query.order_by(WriteSummary.created_at.desc()).all()

    def export_summaries_to_csv(self, pipeline_name: str, start_date: Optional[datetime] = None,
                                end_date: Optional[datetime] = None) -> Tuple[str, dict]:
        summaries = self.get_write_summaries(pipeline_name, start_date, end_date)
        if not summaries:
            return "", {}

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"write_summary_{pipeline_name}_{timestamp}.csv"

        headers = "id,task_id,pipeline_name,shard_start,shard_end,write_count,update_count," \
                  "skip_count,error_count,data_size_bytes,duration_seconds,created_at"

        totals = {
            "total_writes": 0,
            "total_updates": 0,
            "total_skips": 0,
            "total_errors": 0
        }

        lines = [headers]
        for s in summaries:
            totals["total_writes"] += s.write_count
            totals["total_updates"] += s.update_count
            totals["total_skips"] += s.skip_count
            totals["total_errors"] += s.error_count
            line = (f"{s.id},{s.task_id},{s.pipeline_name},{s.shard_start},{s.shard_end},"
                   f"{s.write_count},{s.update_count},{s.skip_count},{s.error_count},"
                   f"{s.data_size_bytes},{s.duration_seconds},{s.created_at.isoformat()}")
            lines.append(line)

        content = "\n".join(lines)

        for s in summaries:
            s.export_status = "exported"
            s.exported_at = datetime.utcnow()
        self.db.commit()

        return filename, {
            "content": content,
            "export_count": len(summaries),
            **totals
        }
