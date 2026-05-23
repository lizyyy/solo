import uuid
from datetime import datetime
from typing import List, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app.models.enums import BatchStrategy, WorkOrderStatus, OperationType
from app.models.database import Batch, WorkOrder
from app.schemas import BatchCreate, WorkOrderCreate, BatchImportResponse
from app.services.audit import AuditService


class BatchService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)

    def create_batch(self, batch_data: BatchCreate) -> Batch:
        batch = Batch(
            id=str(uuid.uuid4()),
            batch_no=batch_data.batch_no,
            source=batch_data.source.value if hasattr(batch_data.source, 'value') else batch_data.source,
            strategy=batch_data.strategy.value if hasattr(batch_data.strategy, 'value') else batch_data.strategy,
            created_by=batch_data.created_by,
            remark=batch_data.remark,
            status="created",
        )
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)

        self.audit_service.log(
            operation_type=OperationType.CREATE,
            operator=batch_data.created_by,
            batch_id=batch.id,
            after_data={
                "batch_no": batch.batch_no,
                "source": batch.source,
                "strategy": batch.strategy,
            },
            remark=f"创建批次: {batch.batch_no}",
        )

        return batch

    def get_batch_by_no(self, batch_no: str) -> Batch:
        return self.db.query(Batch).filter(Batch.batch_no == batch_no).first()

    def get_batch_by_id(self, batch_id: str) -> Batch:
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def list_batches(self, skip: int = 0, limit: int = 100, source: str = None):
        query = self.db.query(Batch)
        if source:
            query = query.filter(Batch.source == source)
        return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

    def import_work_orders(
        self,
        batch_id: str,
        work_orders: List[WorkOrderCreate],
        strategy: BatchStrategy,
    ) -> BatchImportResponse:
        batch = self.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f"批次不存在: {batch_id}")

        success_count = 0
        failed_count = 0
        ignored_count = 0
        failed_items = []

        for wo_data in work_orders:
            try:
                existing_wo = self.db.query(WorkOrder).filter(
                    WorkOrder.order_no == wo_data.order_no
                ).first()

                if existing_wo:
                    if strategy == BatchStrategy.IGNORE:
                        ignored_count += 1
                        continue
                    elif strategy == BatchStrategy.OVERWRITE:
                        self._update_work_order(existing_wo, wo_data, batch_id)
                        success_count += 1
                    elif strategy == BatchStrategy.APPEND:
                        new_wo = self._create_work_order(wo_data, batch_id)
                        success_count += 1
                else:
                    new_wo = self._create_work_order(wo_data, batch_id)
                    success_count += 1

            except Exception as e:
                failed_count += 1
                failed_items.append({
                    "order_no": wo_data.order_no,
                    "error": str(e),
                })

        batch.total_count = len(work_orders)
        batch.success_count = success_count
        batch.failed_count = failed_count
        batch.status = "completed"
        batch.updated_at = datetime.utcnow()

        self.db.commit()

        return BatchImportResponse(
            batch_id=batch_id,
            batch_no=batch.batch_no,
            strategy=strategy.value,
            total_count=len(work_orders),
            success_count=success_count,
            failed_count=failed_count,
            ignored_count=ignored_count,
            failed_items=failed_items,
        )

    def _create_work_order(self, wo_data: WorkOrderCreate, batch_id: str) -> WorkOrder:
        wo = WorkOrder(
            id=str(uuid.uuid4()),
            order_no=wo_data.order_no,
            batch_id=batch_id,
            pile_no=wo_data.pile_no,
            area=wo_data.area,
            source=wo_data.source.value if hasattr(wo_data.source, 'value') else wo_data.source,
            alarm_type=wo_data.alarm_type,
            alarm_level=wo_data.alarm_level,
            alarm_time=wo_data.alarm_time,
            alarm_content=wo_data.alarm_content,
            fault_duration=wo_data.fault_duration,
            handler=wo_data.handler,
            status=WorkOrderStatus.PENDING.value,
            extra_data=wo_data.extra_data,
        )
        self.db.add(wo)

        self.audit_service.log(
            operation_type=OperationType.CREATE,
            operator="system",
            work_order_id=wo.id,
            batch_id=batch_id,
            after_data={
                "order_no": wo.order_no,
                "pile_no": wo.pile_no,
                "area": wo.area,
                "source": wo.source,
            },
            remark=f"创建工单: {wo.order_no}",
        )

        return wo

    def _update_work_order(self, wo: WorkOrder, wo_data: WorkOrderCreate, batch_id: str) -> None:
        before_data = {
            "pile_no": wo.pile_no,
            "area": wo.area,
            "alarm_type": wo.alarm_type,
            "alarm_level": wo.alarm_level,
            "alarm_content": wo.alarm_content,
            "fault_duration": wo.fault_duration,
        }

        wo.pile_no = wo_data.pile_no
        wo.area = wo_data.area
        wo.alarm_type = wo_data.alarm_type
        wo.alarm_level = wo_data.alarm_level
        wo.alarm_time = wo_data.alarm_time
        wo.alarm_content = wo_data.alarm_content
        wo.fault_duration = wo_data.fault_duration
        wo.handler = wo_data.handler or wo.handler
        wo.batch_id = batch_id
        wo.updated_at = datetime.utcnow()

        self.audit_service.log(
            operation_type=OperationType.UPDATE,
            operator="system",
            work_order_id=wo.id,
            batch_id=batch_id,
            before_data=before_data,
            after_data={
                "pile_no": wo.pile_no,
                "area": wo.area,
                "alarm_type": wo.alarm_type,
                "alarm_level": wo.alarm_level,
                "alarm_content": wo.alarm_content,
                "fault_duration": wo.fault_duration,
            },
            remark=f"覆盖更新工单: {wo.order_no}",
        )
