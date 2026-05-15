import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from app.models.base import (
    BatchStatus,
    InterfaceStatus,
    RestoreRequestStatus,
    ConclusionType,
    ShutdownBatch,
    BatchPhase,
    ObservationMetric,
    RestoreRequest,
    DecommissionConclusion,
)
from app.models.schemas import (
    CreateBatchRequest,
    UpdateBatchRequest,
    CreateRestoreRequest,
    CreateConclusionRequest,
    BatchHistoryItem,
)


VALID_TRANSITIONS: Dict[BatchStatus, List[BatchStatus]] = {
    BatchStatus.DRAFT: [BatchStatus.VALIDATED, BatchStatus.CANCELLED],
    BatchStatus.VALIDATED: [BatchStatus.IN_PROGRESS, BatchStatus.CANCELLED, BatchStatus.DRAFT],
    BatchStatus.IN_PROGRESS: [BatchStatus.OBSERVING, BatchStatus.CANCELLED],
    BatchStatus.OBSERVING: [BatchStatus.IN_PROGRESS, BatchStatus.PARTIAL_RESTORED, BatchStatus.COMPLETED, BatchStatus.CANCELLED],
    BatchStatus.PARTIAL_RESTORED: [BatchStatus.OBSERVING, BatchStatus.COMPLETED, BatchStatus.CANCELLED],
    BatchStatus.COMPLETED: [],
    BatchStatus.CANCELLED: [],
}


class BatchService:
    def __init__(self):
        self._batches: Dict[str, ShutdownBatch] = {}
        self._history: Dict[str, List[BatchHistoryItem]] = defaultdict(list)
        self._idempotency_keys: Dict[str, str] = {}

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _record_history(
        self,
        batch_id: str,
        action: str,
        performed_by: str,
        status_from: Optional[BatchStatus] = None,
        status_to: Optional[BatchStatus] = None,
        details: Optional[Dict] = None,
    ):
        item = BatchHistoryItem(
            timestamp=datetime.now(),
            action=action,
            status_from=status_from,
            status_to=status_to,
            performed_by=performed_by,
            details=details,
        )
        self._history[batch_id].append(item)

    def _check_idempotency(self, idempotency_key: str) -> Tuple[bool, Optional[str]]:
        if idempotency_key in self._idempotency_keys:
            return True, self._idempotency_keys[idempotency_key]
        return False, None

    def _register_idempotency(self, idempotency_key: str, batch_id: str):
        self._idempotency_keys[idempotency_key] = batch_id

    def create_batch(
        self,
        request: CreateBatchRequest,
        idempotency_key: Optional[str] = None,
    ) -> ShutdownBatch:
        if idempotency_key:
            exists, existing_batch_id = self._check_idempotency(idempotency_key)
            if exists:
                return self._batches[existing_batch_id]

        batch_id = self._generate_id()
        batch = ShutdownBatch(
            id=batch_id,
            name=request.name,
            description=request.description,
            phases=request.phases,
            metrics=request.metrics or [],
            created_by=request.created_by,
            scheduled_at=request.scheduled_at,
        )

        self._batches[batch_id] = batch
        self._record_history(
            batch_id=batch_id,
            action="CREATED",
            performed_by=request.created_by,
            details={"name": request.name},
        )

        if idempotency_key:
            self._register_idempotency(idempotency_key, batch_id)

        return batch

    def get_batch(self, batch_id: str) -> Optional[ShutdownBatch]:
        return self._batches.get(batch_id)

    def list_batches(
        self,
        status: Optional[BatchStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[ShutdownBatch], int]:
        batches = list(self._batches.values())
        if status:
            batches = [b for b in batches if b.status == status]
        
        batches.sort(key=lambda b: b.created_at, reverse=True)
        total = len(batches)
        
        start = (page - 1) * page_size
        end = start + page_size
        return batches[start:end], total

    def validate_batch(self, batch_id: str, validated_by: str) -> ShutdownBatch:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        if batch.status != BatchStatus.DRAFT:
            raise ValueError(f"Cannot validate batch in {batch.status} state")

        if not batch.phases:
            raise ValueError("Batch must have at least one phase")

        for phase in batch.phases:
            if not phase.interface_ids:
                raise ValueError(f"Phase {phase.phase_number} must have at least one interface")
            if not phase.customer_group_ids:
                raise ValueError(f"Phase {phase.phase_number} must have at least one customer group")

        old_status = batch.status
        batch.status = BatchStatus.VALIDATED
        batch.updated_at = datetime.now()

        self._record_history(
            batch_id=batch_id,
            action="VALIDATED",
            performed_by=validated_by,
            status_from=old_status,
            status_to=batch.status,
        )

        return batch

    def start_batch(self, batch_id: str, started_by: str) -> ShutdownBatch:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        if batch.status not in [BatchStatus.VALIDATED, BatchStatus.OBSERVING]:
            raise ValueError(f"Cannot start batch in {batch.status} state")

        if batch.current_phase >= len(batch.phases):
            raise ValueError("All phases have been completed")

        old_status = batch.status
        batch.status = BatchStatus.IN_PROGRESS
        batch.current_phase += 1
        
        current_phase = batch.phases[batch.current_phase - 1]
        current_phase.status = InterfaceStatus.SUSPENDED
        current_phase.started_at = datetime.now()
        
        batch.updated_at = datetime.now()

        self._record_history(
            batch_id=batch_id,
            action="PHASE_STARTED",
            performed_by=started_by,
            status_from=old_status,
            status_to=batch.status,
            details={"phase": batch.current_phase},
        )

        return batch

    def start_observation(self, batch_id: str, started_by: str) -> ShutdownBatch:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        if batch.status != BatchStatus.IN_PROGRESS:
            raise ValueError(f"Cannot start observation in {batch.status} state")

        current_phase = batch.phases[batch.current_phase - 1]
        current_phase.completed_at = datetime.now()

        old_status = batch.status
        batch.status = BatchStatus.OBSERVING
        batch.updated_at = datetime.now()

        self._record_history(
            batch_id=batch_id,
            action="OBSERVATION_STARTED",
            performed_by=started_by,
            status_from=old_status,
            status_to=batch.status,
            details={"phase": batch.current_phase},
        )

        return batch

    def update_metric(
        self,
        batch_id: str,
        metric_id: str,
        current_value: float,
        measured_at: Optional[datetime] = None,
    ) -> ShutdownBatch:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        metric = next((m for m in batch.metrics if m.id == metric_id), None)
        if not metric:
            raise ValueError(f"Metric {metric_id} not found")

        metric.current_value = current_value
        metric.measured_at = measured_at or datetime.now()
        metric.is_alert = current_value > metric.threshold

        batch.updated_at = datetime.now()

        if metric.is_alert and batch.status == BatchStatus.OBSERVING:
            self._record_history(
                batch_id=batch_id,
                action="METRIC_ALERT",
                performed_by="system",
                details={"metric": metric_id, "value": current_value, "threshold": metric.threshold},
            )

        return batch

    def create_restore_request(
        self,
        batch_id: str,
        request: CreateRestoreRequest,
    ) -> RestoreRequest:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        if batch.status not in [BatchStatus.OBSERVING, BatchStatus.PARTIAL_RESTORED]:
            raise ValueError(f"Cannot create restore request in {batch.status} state")

        restore_request = RestoreRequest(
            id=self._generate_id(),
            batch_id=batch_id,
            interface_ids=request.interface_ids,
            customer_group_ids=request.customer_group_ids,
            reason=request.reason,
            requester=request.requester,
        )

        batch.restore_requests.append(restore_request)
        batch.updated_at = datetime.now()

        self._record_history(
            batch_id=batch_id,
            action="RESTORE_REQUEST_CREATED",
            performed_by=request.requester,
            details={"restore_request_id": restore_request.id},
        )

        return restore_request

    def approve_restore_request(
        self,
        batch_id: str,
        restore_request_id: str,
        approver: str,
    ) -> RestoreRequest:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        restore_request = next(
            (r for r in batch.restore_requests if r.id == restore_request_id),
            None,
        )
        if not restore_request:
            raise ValueError(f"Restore request {restore_request_id} not found")

        if restore_request.status != RestoreRequestStatus.PENDING:
            raise ValueError(f"Restore request is in {restore_request.status} state")

        restore_request.status = RestoreRequestStatus.APPROVED
        restore_request.approver = approver
        restore_request.approved_at = datetime.now()

        for phase in batch.phases:
            for interface_id in restore_request.interface_ids:
                if interface_id in phase.interface_ids:
                    phase.status = InterfaceStatus.RESTORED

        restore_request.status = RestoreRequestStatus.EXECUTED
        restore_request.executed_at = datetime.now()

        old_status = batch.status
        batch.status = BatchStatus.PARTIAL_RESTORED
        batch.updated_at = datetime.now()

        self._record_history(
            batch_id=batch_id,
            action="RESTORE_REQUEST_EXECUTED",
            performed_by=approver,
            status_from=old_status,
            status_to=batch.status,
            details={"restore_request_id": restore_request_id},
        )

        return restore_request

    def complete_batch(
        self,
        batch_id: str,
        conclusion_request: CreateConclusionRequest,
    ) -> ShutdownBatch:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        if batch.status not in [BatchStatus.OBSERVING, BatchStatus.PARTIAL_RESTORED]:
            raise ValueError(f"Cannot complete batch in {batch.status} state")

        for phase in batch.phases:
            if phase.status == InterfaceStatus.SUSPENDED:
                phase.status = InterfaceStatus.DECOMMISSIONED

        conclusion = DecommissionConclusion(
            id=self._generate_id(),
            batch_id=batch_id,
            conclusion_type=conclusion_request.conclusion_type,
            summary=conclusion_request.summary,
            final_metrics=batch.metrics.copy(),
            affected_interfaces=[
                iid for phase in batch.phases for iid in phase.interface_ids
            ],
            archived_by=conclusion_request.archived_by,
            notes=conclusion_request.notes,
        )

        old_status = batch.status
        batch.conclusion = conclusion
        batch.status = BatchStatus.COMPLETED
        batch.updated_at = datetime.now()

        self._record_history(
            batch_id=batch_id,
            action="COMPLETED",
            performed_by=conclusion_request.archived_by,
            status_from=old_status,
            status_to=batch.status,
            details={"conclusion_type": conclusion_request.conclusion_type},
        )

        return batch

    def cancel_batch(self, batch_id: str, cancelled_by: str) -> ShutdownBatch:
        batch = self.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        if batch.status in [BatchStatus.COMPLETED, BatchStatus.CANCELLED]:
            raise ValueError(f"Cannot cancel batch in {batch.status} state")

        old_status = batch.status
        batch.status = BatchStatus.CANCELLED
        batch.updated_at = datetime.now()

        self._record_history(
            batch_id=batch_id,
            action="CANCELLED",
            performed_by=cancelled_by,
            status_from=old_status,
            status_to=batch.status,
        )

        return batch

    def get_history(self, batch_id: str) -> List[BatchHistoryItem]:
        if batch_id not in self._batches:
            raise ValueError(f"Batch {batch_id} not found")
        return self._history.get(batch_id, [])
