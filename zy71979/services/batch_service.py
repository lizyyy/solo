import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import BatchTask, ReviewSample, ChangeHistory
import schemas
from services.change_service import ChangeHistoryService


class BatchService:
    @staticmethod
    def generate_idempotency_key(task_name: str, params: Dict[str, Any]) -> str:
        data = {
            "task_name": task_name,
            "params": params,
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    @staticmethod
    def get_or_create_task(
        db: Session,
        task_data: schemas.BatchTaskCreate,
    ) -> BatchTask:
        existing = db.query(BatchTask).filter(
            BatchTask.idempotency_key == task_data.idempotency_key
        ).first()

        if existing:
            return existing

        task = BatchTask(
            idempotency_key=task_data.idempotency_key,
            task_name=task_data.task_name,
            params=task_data.params,
            operator=task_data.operator,
            status="pending",
            total_count=0,
            success_count=0,
            failed_count=0,
        )
        db.add(task)
        db.flush()
        return task

    @staticmethod
    def get_task_status(db: Session, idempotency_key: str) -> Optional[BatchTask]:
        return db.query(BatchTask).filter(
            BatchTask.idempotency_key == idempotency_key
        ).first()

    @staticmethod
    def execute_batch_update(
        db: Session,
        idempotency_key: str,
        sample_ids: List[int],
        update_data: Dict[str, Any],
        operator: str = None,
        remark: str = None,
    ) -> BatchTask:
        task = db.query(BatchTask).filter(
            BatchTask.idempotency_key == idempotency_key
        ).first()

        if not task:
            raise ValueError(f"Task {idempotency_key} not found")

        if task.status == "completed":
            return task

        if task.status == "in_progress":
            return task

        task.status = "in_progress"
        task.started_at = datetime.now()
        task.total_count = len(sample_ids)
        db.flush()

        success_count = 0
        failed_count = 0
        failed_ids = []

        for sample_id in sample_ids:
            try:
                sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()
                if not sample:
                    failed_count += 1
                    failed_ids.append(sample_id)
                    continue

                for field_name, new_value in update_data.items():
                    if hasattr(sample, field_name):
                        old_value = getattr(sample, field_name)
                        if old_value != new_value:
                            setattr(sample, field_name, new_value)
                            ChangeHistoryService.log_change(
                                db=db,
                                sample_id=sample_id,
                                field_name=field_name,
                                old_value=old_value,
                                new_value=new_value,
                                operator=operator,
                                remark=remark,
                                change_source="BATCH_PROCESS",
                            )

                success_count += 1
            except Exception as e:
                failed_count += 1
                failed_ids.append({"id": sample_id, "error": str(e)})

        task.status = "completed"
        task.success_count = success_count
        task.failed_count = failed_count
        task.completed_at = datetime.now()
        task.result = {
            "failed_ids": failed_ids,
            "updated_fields": list(update_data.keys()),
        }
        db.flush()

        return task

    @staticmethod
    def batch_update_samples(
        db: Session,
        sample_ids: List[int],
        update_data: Dict[str, Any],
        operator: str = None,
        remark: str = None,
    ) -> BatchTask:
        task_name = "batch_update_samples"
        params = {
            "sample_ids": sorted(sample_ids),
            "update_data": update_data,
            "operator": operator,
        }
        idempotency_key = BatchService.generate_idempotency_key(task_name, params)

        task_data = schemas.BatchTaskCreate(
            idempotency_key=idempotency_key,
            task_name=task_name,
            params=params,
            operator=operator,
        )

        task = BatchService.get_or_create_task(db, task_data)

        if task.status != "completed":
            task = BatchService.execute_batch_update(
                db=db,
                idempotency_key=idempotency_key,
                sample_ids=sample_ids,
                update_data=update_data,
                operator=operator,
                remark=remark,
            )

        db.commit()
        return task

    @staticmethod
    def batch_review(
        db: Session,
        sample_ids: List[int],
        review_status: str,
        is_anomaly: bool,
        anomaly_type: str = None,
        conclusion: str = None,
        reviewer: str = None,
    ) -> BatchTask:
        update_data = {
            "review_status": review_status,
            "is_anomaly": is_anomaly,
        }
        if anomaly_type:
            update_data["anomaly_type"] = anomaly_type
        if conclusion:
            update_data["conclusion"] = conclusion
        if reviewer:
            update_data["reviewer"] = reviewer

        return BatchService.batch_update_samples(
            db=db,
            sample_ids=sample_ids,
            update_data=update_data,
            operator=reviewer,
            remark="批量复判",
        )

    @staticmethod
    def batch_mark_anomaly(
        db: Session,
        sample_ids: List[int],
        anomaly_type: str,
        conclusion: str = None,
        reviewer: str = None,
    ) -> BatchTask:
        return BatchService.batch_review(
            db=db,
            sample_ids=sample_ids,
            review_status="completed",
            is_anomaly=True,
            anomaly_type=anomaly_type,
            conclusion=conclusion or "批量标记为异常",
            reviewer=reviewer,
        )

    @staticmethod
    def batch_mark_normal(
        db: Session,
        sample_ids: List[int],
        conclusion: str = None,
        reviewer: str = None,
    ) -> BatchTask:
        return BatchService.batch_review(
            db=db,
            sample_ids=sample_ids,
            review_status="completed",
            is_anomaly=False,
            anomaly_type=None,
            conclusion=conclusion or "批量标记为正常",
            reviewer=reviewer,
        )

    @staticmethod
    def get_recent_tasks(db: Session, limit: int = 10, operator: str = None) -> List[BatchTask]:
        query = db.query(BatchTask)
        if operator:
            query = query.filter(BatchTask.operator == operator)
        return query.order_by(desc(BatchTask.created_at)).limit(limit).all()

    @staticmethod
    def verify_idempotency(
        db: Session,
        task_name: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        key = BatchService.generate_idempotency_key(task_name, params)
        task = BatchService.get_task_status(db, key)

        return {
            "idempotency_key": key,
            "task_exists": task is not None,
            "task_status": task.status if task else None,
            "task_id": task.id if task else None,
            "is_completed": task.status == "completed" if task else False,
            "result": task.result if task else None,
        }
