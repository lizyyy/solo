from datetime import datetime
from typing import List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import (
    ImportBatch, ImportItem, WriteDetail, RollbackPlan, RollbackItem,
    RollbackReport, BatchStatus
)
from app.schemas.schemas import RollbackPlanRequest


class RollbackService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_rollback_plan(self, batch_id: int, request: RollbackPlanRequest) -> RollbackPlan:
        batch_result = await self.db.execute(
            select(ImportBatch)
            .options(selectinload(ImportBatch.items).selectinload(ImportItem.write_details))
            .where(ImportBatch.id == batch_id)
        )
        batch = batch_result.scalar_one_or_none()
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        existing_plan_result = await self.db.execute(
            select(RollbackPlan).where(RollbackPlan.batch_id == batch_id)
        )
        existing_plan = existing_plan_result.scalar_one_or_none()
        if existing_plan:
            return existing_plan

        all_write_details = []
        for item in batch.items:
            all_write_details.extend(item.write_details)

        all_write_details.sort(key=lambda x: x.written_at, reverse=True)

        plan = RollbackPlan(
            batch_id=batch_id,
            reason=request.reason,
            strategy=request.strategy,
            total_operations=len(all_write_details),
            status="pending"
        )
        self.db.add(plan)
        await self.db.flush()

        for idx, detail in enumerate(all_write_details):
            rollback_item = RollbackItem(
                plan_id=plan.id,
                write_detail_id=detail.id,
                order=idx,
                status="pending"
            )
            self.db.add(rollback_item)

        batch.status = BatchStatus.ROLLBACK_PLANNED
        await self.db.commit()
        await self.db.refresh(plan)
        return plan

    async def execute_rollback(self, plan_id: int) -> RollbackPlan:
        plan_result = await self.db.execute(
            select(RollbackPlan)
            .options(
                selectinload(RollbackPlan.items).selectinload(RollbackItem.write_detail),
                selectinload(RollbackPlan.batch)
            )
            .where(RollbackPlan.id == plan_id)
        )
        plan = plan_result.scalar_one_or_none()
        if not plan:
            raise ValueError(f"Rollback plan {plan_id} not found")

        if plan.status in ["completed", "failed"]:
            return plan

        plan.status = "running"
        plan.batch.status = BatchStatus.ROLLING_BACK
        await self.db.flush()

        sorted_items = sorted(plan.items, key=lambda x: x.order)
        completed = 0
        failed = 0

        for rollback_item in sorted_items:
            try:
                await self._execute_rollback_item(rollback_item)
                rollback_item.status = "success"
                rollback_item.executed_at = datetime.utcnow()
                completed += 1
            except Exception as e:
                rollback_item.status = "failed"
                rollback_item.error_message = str(e)
                rollback_item.executed_at = datetime.utcnow()
                failed += 1

            plan.completed_operations = completed
            plan.failed_operations = failed
            await self.db.flush()

        if failed == 0:
            plan.status = "completed"
            plan.batch.status = BatchStatus.ROLLED_BACK
        else:
            plan.status = "partially_failed"

        await self._generate_report(plan)
        await self.db.commit()
        await self.db.refresh(plan)
        return plan

    async def _execute_rollback_item(self, rollback_item: RollbackItem):
        detail = rollback_item.write_detail
        detail.rollback_status = "executed"
        detail.rollback_at = datetime.utcnow()
        await self.db.flush()

    async def _generate_report(self, plan: RollbackPlan):
        summary = {
            "total": plan.total_operations,
            "completed": plan.completed_operations,
            "failed": plan.failed_operations,
            "batch_no": plan.batch.batch_no,
            "reason": plan.reason
        }

        details = []
        for item in plan.items:
            details.append({
                "order": item.order,
                "table_name": item.write_detail.table_name,
                "record_id": item.write_detail.record_id,
                "operation_type": item.write_detail.operation_type,
                "status": item.status,
                "error_message": item.error_message
            })

        report = RollbackReport(
            plan_id=plan.id,
            started_at=plan.planned_at,
            completed_at=datetime.utcnow(),
            status=plan.status,
            summary=summary,
            details=details
        )
        self.db.add(report)

    async def get_plan_by_id(self, plan_id: int) -> RollbackPlan:
        result = await self.db.execute(
            select(RollbackPlan)
            .options(
                selectinload(RollbackPlan.items),
                selectinload(RollbackPlan.report)
            )
            .where(RollbackPlan.id == plan_id)
        )
        return result.scalar_one_or_none()

    async def get_plan_by_batch_id(self, batch_id: int) -> RollbackPlan:
        result = await self.db.execute(
            select(RollbackPlan)
            .options(
                selectinload(RollbackPlan.items),
                selectinload(RollbackPlan.report)
            )
            .where(RollbackPlan.batch_id == batch_id)
        )
        return result.scalar_one_or_none()
