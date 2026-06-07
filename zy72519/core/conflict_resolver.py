from datetime import datetime
from typing import Dict, List
import logging

from models import (
    WorkOrder,
    ConflictSample,
    ConflictStatus,
    ConflictType,
    HistoryRecord,
    OperationType,
    WorkOrderStatus,
)
from utils import generate_id, save_json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConflictResolver:
    def __init__(self):
        self.history: List[HistoryRecord] = []

    def list_conflicts_for_confirmation(
        self,
        conflicts: Dict[str, ConflictSample],
    ) -> List[ConflictSample]:
        pending = [c for c in conflicts.values() if c.status == ConflictStatus.PENDING_CONFIRM]
        logger.info(f"Found {len(pending)} conflicts pending confirmation")
        return pending

    def list_conflicts_for_product_review(
        self,
        conflicts: Dict[str, ConflictSample],
    ) -> List[ConflictSample]:
        need_review = [c for c in conflicts.values() if c.status == ConflictStatus.NEED_PRODUCT_REVIEW]
        logger.info(f"Found {len(need_review)} conflicts needing product review")
        return need_review

    def format_conflict_evidence(self, conflict: ConflictSample, work_order: WorkOrder) -> dict:
        return {
            "conflict_id": conflict.id,
            "work_order_id": conflict.work_order_id,
            "work_order_title": work_order.title,
            "conflict_type": conflict.conflict_type.value,
            "current_status": conflict.status.value,
            "detect_time": conflict.detect_time.isoformat(),
            "evidence": [
                {
                    "type": e.type,
                    "description": e.description,
                    "source": e.source,
                    "details": e.details,
                }
                for e in conflict.evidence
            ],
            "action_required": "请周姐确认或驳回此冲突",
        }

    def confirm_conflict(
        self,
        conflict: ConflictSample,
        work_orders: Dict[str, WorkOrder],
        operator: str = "周姐",
        notes: str = "",
    ) -> ConflictSample:
        if conflict.status not in (ConflictStatus.PENDING_CONFIRM, ConflictStatus.DETECTED):
            raise ValueError(f"Conflict {conflict.id} is not in confirmable state")

        old_state = conflict.to_dict()
        conflict.status = ConflictStatus.CONFIRMED
        conflict.handler = operator
        conflict.handle_time = datetime.now()
        conflict.handle_notes = notes

        work_order = work_orders.get(conflict.work_order_id)
        if work_order:
            wo_old_state = work_order.to_dict()
            work_order.status = WorkOrderStatus.CONFLICT
            work_order.reviewer = operator
            work_order.review_time = datetime.now()
            work_order.review_notes = f"冲突已确认: {conflict.conflict_type.value}"

            self.history.append(HistoryRecord(
                id=generate_id("HIS"),
                operation_type=OperationType.CONFIRM_CONFLICT,
                operator=operator,
                operate_time=datetime.now(),
                target_id=work_order.id,
                target_type="work_order",
                before_state=wo_old_state,
                after_state=work_order.to_dict(),
                notes=f"关联冲突 {conflict.id}: {notes}",
            ))

        self.history.append(HistoryRecord(
            id=generate_id("HIS"),
            operation_type=OperationType.CONFIRM_CONFLICT,
            operator=operator,
            operate_time=datetime.now(),
            target_id=conflict.id,
            target_type="conflict_sample",
            before_state=old_state,
            after_state=conflict.to_dict(),
            notes=notes,
        ))

        logger.info(f"Conflict {conflict.id} confirmed by {operator}")
        return conflict

    def reject_conflict(
        self,
        conflict: ConflictSample,
        work_orders: Dict[str, WorkOrder],
        operator: str = "周姐",
        notes: str = "",
    ) -> ConflictSample:
        if conflict.status not in (ConflictStatus.PENDING_CONFIRM, ConflictStatus.DETECTED):
            raise ValueError(f"Conflict {conflict.id} is not in rejectable state")

        old_state = conflict.to_dict()
        conflict.status = ConflictStatus.REJECTED
        conflict.handler = operator
        conflict.handle_time = datetime.now()
        conflict.handle_notes = notes

        self.history.append(HistoryRecord(
            id=generate_id("HIS"),
            operation_type=OperationType.REJECT_CONFLICT,
            operator=operator,
            operate_time=datetime.now(),
            target_id=conflict.id,
            target_type="conflict_sample",
            before_state=old_state,
            after_state=conflict.to_dict(),
            notes=notes,
        ))

        logger.info(f"Conflict {conflict.id} rejected by {operator}")
        return conflict

    def resolve_conflict(
        self,
        conflict: ConflictSample,
        work_orders: Dict[str, WorkOrder],
        resolution: str,
        operator: str = "周姐",
    ) -> ConflictSample:
        old_state = conflict.to_dict()
        conflict.status = ConflictStatus.RESOLVED
        conflict.resolution = resolution
        conflict.handle_time = datetime.now()
        conflict.handler = operator

        work_order = work_orders.get(conflict.work_order_id)
        if work_order:
            wo_old_state = work_order.to_dict()
            work_order.status = WorkOrderStatus.RESOLVED
            work_order.review_notes = f"冲突已解决: {resolution}"

            self.history.append(HistoryRecord(
                id=generate_id("HIS"),
                operation_type=OperationType.RESOLVE_CONFLICT,
                operator=operator,
                operate_time=datetime.now(),
                target_id=work_order.id,
                target_type="work_order",
                before_state=wo_old_state,
                after_state=work_order.to_dict(),
                notes=f"解决冲突 {conflict.id}",
            ))

        self.history.append(HistoryRecord(
            id=generate_id("HIS"),
            operation_type=OperationType.RESOLVE_CONFLICT,
            operator=operator,
            operate_time=datetime.now(),
            target_id=conflict.id,
            target_type="conflict_sample",
            before_state=old_state,
            after_state=conflict.to_dict(),
            notes=resolution,
        ))

        logger.info(f"Conflict {conflict.id} resolved by {operator}")
        return conflict

    def save_conflicts_report(self, conflicts: Dict[str, ConflictSample], output_path: str):
        report = []
        for conflict in conflicts.values():
            report.append(conflict.to_dict())
        save_json(report, output_path)
