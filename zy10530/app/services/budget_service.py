from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models import TaskBatch, FailureReason, RerunBudget, RejectionRecord, RerunSummary
from app.schemas import (
    TaskBatchCreate, TaskBatchUpdate, FailureReasonCreate,
    RerunBudgetCreate, RerunRequest, RerunResponse,
    BudgetStatusUpdate, ManualCorrection, RerunSummaryUpdate
)


class BudgetService:
    def __init__(self, db: Session):
        self.db = db

    def create_batch(self, batch_data: TaskBatchCreate) -> TaskBatch:
        existing = self.db.query(TaskBatch).filter(
            TaskBatch.batch_id == batch_data.batch_id
        ).first()
        if existing:
            return existing

        batch = TaskBatch(**batch_data.model_dump())
        batch.status = "pending"
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def get_batch(self, batch_id: str) -> Optional[TaskBatch]:
        return self.db.query(TaskBatch).filter(
            TaskBatch.batch_id == batch_id
        ).first()

    def update_batch(self, batch_id: str, update_data: TaskBatchUpdate) -> Optional[TaskBatch]:
        batch = self.get_batch(batch_id)
        if not batch:
            return None

        for field, value in update_data.model_dump(exclude_unset=True).items():
            setattr(batch, field, value)

        batch.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def add_failure_reason(
        self, batch_id: str, reason_data: FailureReasonCreate
    ) -> FailureReason:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        existing = self.db.query(FailureReason).filter(
            FailureReason.batch_id == batch.id,
            FailureReason.reason_code == reason_data.reason_code
        ).first()

        if existing:
            existing.count += reason_data.count
            existing.last_failed_at = datetime.utcnow()
            if reason_data.task_ids:
                existing.task_ids = list(
                    set(existing.task_ids + reason_data.task_ids)
                )
            self.db.commit()
            self.db.refresh(existing)
            return existing

        reason = FailureReason(
            batch_id=batch.id,
            **reason_data.model_dump()
        )
        self.db.add(reason)

        batch.failed_count += reason_data.count
        self.db.commit()
        self.db.refresh(reason)
        return reason

    def create_budget(
        self, batch_id: str, budget_data: RerunBudgetCreate
    ) -> RerunBudget:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        existing = self.db.query(RerunBudget).filter(
            RerunBudget.batch_id == batch.id,
            RerunBudget.reason_code == budget_data.reason_code
        ).first()

        if existing:
            return existing

        budget = RerunBudget(
            batch_id=batch.id,
            **budget_data.model_dump()
        )
        self.db.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def get_or_create_budget(
        self, batch_id: str, reason_code: str
    ) -> RerunBudget:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        budget = self.db.query(RerunBudget).filter(
            RerunBudget.batch_id == batch.id,
            RerunBudget.reason_code == reason_code
        ).first()

        if not budget:
            budget = RerunBudget(
                batch_id=batch.id,
                reason_code=reason_code,
                budget_window_hours=24,
                max_reruns=3
            )
            self.db.add(budget)
            self.db.commit()
            self.db.refresh(budget)

        return budget

    def check_rerun_budget(
        self, batch_id: str, reason_code: str
    ) -> Dict[str, Any]:
        batch = self.get_batch(batch_id)
        if not batch:
            return {
                "approved": False,
                "reason": f"Batch {batch_id} not found",
                "remaining_budget": 0
            }

        budget = self.db.query(RerunBudget).filter(
            RerunBudget.batch_id == batch.id,
            RerunBudget.reason_code == reason_code,
            RerunBudget.is_active == True
        ).first()

        if not budget:
            return {
                "approved": True,
                "reason": "No budget constraints found - first time request",
                "remaining_budget": 3,
                "needs_budget_creation": True
            }

        now = datetime.utcnow()
        if now > budget.window_end:
            budget.used_reruns = 0
            budget.window_start = now
            budget.window_end = now + timedelta(hours=budget.budget_window_hours)
            self.db.commit()

        remaining = budget.max_reruns - budget.used_reruns

        if remaining <= 0:
            return {
                "approved": False,
                "reason": f"Rerun budget exhausted. Used {budget.used_reruns}/{budget.max_reruns} in window ending {budget.window_end}",
                "remaining_budget": 0
            }

        return {
            "approved": True,
            "reason": f"Budget available: {remaining}/{budget.max_reruns} reruns remaining",
            "remaining_budget": remaining
        }

    def request_rerun(self, request: RerunRequest) -> RerunResponse:
        batch = self.get_batch(request.batch_id)
        if not batch:
            return RerunResponse(
                approved=False,
                message=f"Batch {request.batch_id} not found",
                rejection_reason="batch_not_found"
            )

        budget_check = self.check_rerun_budget(request.batch_id, request.reason_code)

        if budget_check.get("needs_budget_creation"):
            budget = self.get_or_create_budget(request.batch_id, request.reason_code)
        else:
            budget = self.db.query(RerunBudget).filter(
                RerunBudget.batch_id == batch.id,
                RerunBudget.reason_code == request.reason_code
            ).first()

        if not budget_check["approved"]:
            rejection = RejectionRecord(
                batch_id=batch.id,
                reason_code=request.reason_code,
                rejection_reason=budget_check["reason"],
                original_request=request.model_dump(),
                processing_context={
                    "budget_check": budget_check,
                    "budget": {
                        "max_reruns": budget.max_reruns if budget else None,
                        "used_reruns": budget.used_reruns if budget else None,
                        "window_end": budget.window_end.isoformat() if budget and budget.window_end else None
                    } if budget else None
                },
                rejected_by=request.requested_by
            )
            self.db.add(rejection)
            self.db.commit()

            return RerunResponse(
                approved=False,
                message=budget_check["reason"],
                rejection_reason="budget_exhausted",
                remaining_budget=0
            )

        existing_in_progress = self.db.query(RerunSummary).filter(
            RerunSummary.batch_id == batch.id,
            RerunSummary.reason_code == request.reason_code,
            RerunSummary.status.in_(["initiated", "in_progress"])
        ).first()

        if existing_in_progress:
            return RerunResponse(
                approved=False,
                message=f"Rerun already in progress for batch {request.batch_id}, reason {request.reason_code}",
                rejection_reason="rerun_in_progress",
                remaining_budget=budget_check["remaining_budget"]
            )

        rerun_number = budget.used_reruns + 1

        summary = RerunSummary(
            batch_id=batch.id,
            reason_code=request.reason_code,
            rerun_number=rerun_number,
            status="initiated",
            tasks_submitted=len(request.task_ids) if request.task_ids else 0,
            result_metadata={
                "requested_by": request.requested_by,
                "task_ids": request.task_ids
            }
        )
        self.db.add(summary)

        budget.used_reruns = rerun_number
        self.db.commit()
        self.db.refresh(summary)

        batch.status = "rerunning"
        batch.updated_at = datetime.utcnow()
        self.db.commit()

        return RerunResponse(
            approved=True,
            message=f"Rerun approved. This is rerun #{rerun_number}",
            summary_id=summary.id,
            remaining_budget=budget.max_reruns - rerun_number
        )

    def update_rerun_status(self, update: BudgetStatusUpdate) -> Optional[RerunSummary]:
        summary = self.db.query(RerunSummary).filter(
            RerunSummary.id == update.summary_id
        ).first()

        if not summary:
            return None

        if summary.status == update.status:
            return summary

        for field, value in update.model_dump(exclude_unset=True, exclude={"summary_id"}).items():
            setattr(summary, field, value)

        if update.status in ["completed", "failed"] and not summary.completed_at:
            summary.completed_at = datetime.utcnow()

            if summary.batch:
                all_reruns = self.db.query(RerunSummary).filter(
                    RerunSummary.batch_id == summary.batch_id
                ).all()

                if all(r.status in ["completed", "failed"] for r in all_reruns):
                    summary.batch.status = "completed"
                    summary.batch.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(summary)
        return summary

    def apply_manual_correction(self, correction: ManualCorrection) -> Dict[str, Any]:
        batch = self.get_batch(correction.batch_id)
        if not batch:
            raise ValueError(f"Batch {correction.batch_id} not found")

        result = {
            "batch_id": correction.batch_id,
            "corrected_by": correction.corrected_by,
            "adjustment_type": correction.adjustment_type,
            "timestamp": datetime.utcnow().isoformat()
        }

        if correction.adjustment_type == "reset_budget":
            budgets = self.db.query(RerunBudget).filter(
                RerunBudget.batch_id == batch.id
            )
            if correction.reason_code:
                budgets = budgets.filter(RerunBudget.reason_code == correction.reason_code)

            for budget in budgets.all():
                budget.used_reruns = 0
                budget.window_start = datetime.utcnow()
                budget.window_end = datetime.utcnow() + timedelta(hours=budget.budget_window_hours)

            result["message"] = "Budget reset successfully"

        elif correction.adjustment_type == "increase_budget":
            budgets = self.db.query(RerunBudget).filter(
                RerunBudget.batch_id == batch.id
            )
            if correction.reason_code:
                budgets = budgets.filter(RerunBudget.reason_code == correction.reason_code)

            for budget in budgets.all():
                budget.max_reruns += int(correction.adjustment_value)

            result["message"] = f"Budget increased by {correction.adjustment_value}"

        elif correction.adjustment_type == "set_batch_status":
            batch.status = str(correction.adjustment_value)
            result["message"] = f"Batch status set to {correction.adjustment_value}"

        elif correction.adjustment_type == "force_approve_rerun":
            budget = self.db.query(RerunBudget).filter(
                RerunBudget.batch_id == batch.id,
                RerunBudget.reason_code == correction.reason_code
            ).first()

            if budget:
                budget.used_reruns = max(0, budget.used_reruns - 1)
                result["message"] = "Forced rerun approval - budget rolled back"
            else:
                result["message"] = "No budget found to adjust"

        else:
            raise ValueError(f"Unknown adjustment type: {correction.adjustment_type}")

        batch.updated_at = datetime.utcnow()
        self.db.commit()
        result["comment"] = correction.comment

        return result

    def get_batch_details(self, batch_id: str) -> Optional[Dict[str, Any]]:
        batch = self.get_batch(batch_id)
        if not batch:
            return None

        return {
            "batch": batch,
            "failure_reasons": batch.failure_reasons,
            "rerun_budgets": batch.rerun_budgets,
            "rejection_records": batch.rejection_records,
            "rerun_summaries": batch.rerun_summaries
        }

    def list_batches(
        self, skip: int = 0, limit: int = 100, status: Optional[str] = None
    ) -> List[TaskBatch]:
        query = self.db.query(TaskBatch)
        if status:
            query = query.filter(TaskBatch.status == status)
        return query.order_by(TaskBatch.created_at.desc()).offset(skip).limit(limit).all()

    def export_data(
        self,
        batch_ids: Optional[List[str]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        reason_codes: Optional[List[str]] = None,
        status: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        query = self.db.query(TaskBatch)

        if batch_ids:
            query = query.filter(TaskBatch.batch_id.in_(batch_ids))
        if start_date:
            query = query.filter(TaskBatch.created_at >= start_date)
        if end_date:
            query = query.filter(TaskBatch.created_at <= end_date)
        if status:
            query = query.filter(TaskBatch.status == status)

        batches = query.all()
        batch_ids_int = [b.id for b in batches]

        failure_reasons_query = self.db.query(FailureReason).filter(
            FailureReason.batch_id.in_(batch_ids_int)
        )
        if reason_codes:
            failure_reasons_query = failure_reasons_query.filter(
                FailureReason.reason_code.in_(reason_codes)
            )
        failure_reasons = failure_reasons_query.all()

        budgets_query = self.db.query(RerunBudget).filter(
            RerunBudget.batch_id.in_(batch_ids_int)
        )
        if reason_codes:
            budgets_query = budgets_query.filter(
                RerunBudget.reason_code.in_(reason_codes)
            )
        budgets = budgets_query.all()

        summaries_query = self.db.query(RerunSummary).filter(
            RerunSummary.batch_id.in_(batch_ids_int)
        )
        if reason_codes:
            summaries_query = summaries_query.filter(
                RerunSummary.reason_code.in_(reason_codes)
            )
        summaries = summaries_query.all()

        rejections = self.db.query(RejectionRecord).filter(
            RejectionRecord.batch_id.in_(batch_ids_int)
        ).all()

        def to_dict(obj):
            result = {}
            for column in obj.__table__.columns:
                value = getattr(obj, column.name)
                if isinstance(value, datetime):
                    result[column.name] = value.isoformat()
                else:
                    result[column.name] = value
            return result

        return {
            "batches": [to_dict(b) for b in batches],
            "failure_reasons": [to_dict(r) for r in failure_reasons],
            "rerun_budgets": [to_dict(b) for b in budgets],
            "rerun_summaries": [to_dict(s) for s in summaries],
            "rejection_records": [to_dict(r) for r in rejections]
        }
