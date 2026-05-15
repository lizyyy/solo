import pytest
import uuid

from app.models.base import (
    BatchStatus,
    InterfaceStatus,
    RestoreRequestStatus,
    ConclusionType,
    BatchPhase,
    ObservationMetric,
)
from app.models.schemas import (
    CreateBatchRequest,
    CreateRestoreRequest,
    CreateConclusionRequest,
)
from app.services.batch_service import BatchService


@pytest.fixture
def batch_service():
    return BatchService()


@pytest.fixture
def valid_batch_request():
    return CreateBatchRequest(
        name="Test Batch",
        description="Test Description",
        phases=[
            BatchPhase(
                phase_number=1,
                interface_ids=["api-1", "api-2"],
                customer_group_ids=["group-1"],
            ),
            BatchPhase(
                phase_number=2,
                interface_ids=["api-3"],
                customer_group_ids=["group-2"],
            ),
        ],
        metrics=[
            ObservationMetric(
                id="metric-1",
                name="Error Rate",
                threshold=100.0,
            )
        ],
        created_by="test-user",
    )


class TestIdempotency:
    def test_create_batch_with_same_idempotency_key_returns_same_batch(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        idempotency_key = str(uuid.uuid4())
        
        batch1 = batch_service.create_batch(valid_batch_request, idempotency_key)
        batch2 = batch_service.create_batch(valid_batch_request, idempotency_key)
        
        assert batch1.id == batch2.id
        assert batch1.name == batch2.name

    def test_create_batch_with_different_idempotency_key_creates_new_batch(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch1 = batch_service.create_batch(valid_batch_request, str(uuid.uuid4()))
        batch2 = batch_service.create_batch(valid_batch_request, str(uuid.uuid4()))
        
        assert batch1.id != batch2.id


class TestInvalidData:
    def test_validate_batch_with_no_phases(
        self,
        batch_service: BatchService,
    ):
        request = CreateBatchRequest(
            name="Invalid Batch",
            phases=[],
            created_by="test-user",
        )
        batch = batch_service.create_batch(request)
        
        with pytest.raises(ValueError, match="Batch must have at least one phase"):
            batch_service.validate_batch(batch.id, "test-user")

    def test_validate_batch_with_phase_missing_interfaces(
        self,
        batch_service: BatchService,
    ):
        request = CreateBatchRequest(
            name="Invalid Batch",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=[],
                    customer_group_ids=["group-1"],
                )
            ],
            created_by="test-user",
        )
        batch = batch_service.create_batch(request)
        
        with pytest.raises(ValueError, match="must have at least one interface"):
            batch_service.validate_batch(batch.id, "test-user")

    def test_validate_batch_with_phase_missing_customer_groups(
        self,
        batch_service: BatchService,
    ):
        request = CreateBatchRequest(
            name="Invalid Batch",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=["api-1"],
                    customer_group_ids=[],
                )
            ],
            created_by="test-user",
        )
        batch = batch_service.create_batch(request)
        
        with pytest.raises(ValueError, match="must have at least one customer group"):
            batch_service.validate_batch(batch.id, "test-user")

    def test_get_nonexistent_batch_returns_none(
        self,
        batch_service: BatchService,
    ):
        batch = batch_service.get_batch("nonexistent-id")
        assert batch is None

    def test_validate_nonexistent_batch_raises_error(
        self,
        batch_service: BatchService,
    ):
        with pytest.raises(ValueError, match="not found"):
            batch_service.validate_batch("nonexistent-id", "test-user")


class TestStateTransitions:
    def test_draft_to_validated(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        assert batch.status == BatchStatus.DRAFT
        
        batch = batch_service.validate_batch(batch.id, "test-user")
        assert batch.status == BatchStatus.VALIDATED

    def test_validated_to_in_progress(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "test-user")
        batch = batch_service.start_batch(batch.id, "test-user")
        
        assert batch.status == BatchStatus.IN_PROGRESS
        assert batch.current_phase == 1

    def test_in_progress_to_observing(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "test-user")
        batch = batch_service.start_batch(batch.id, "test-user")
        batch = batch_service.start_observation(batch.id, "test-user")
        
        assert batch.status == BatchStatus.OBSERVING

    def test_observing_to_partial_restored_via_restore_request(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "test-user")
        batch = batch_service.start_batch(batch.id, "test-user")
        batch = batch_service.start_observation(batch.id, "test-user")
        
        restore_request = CreateRestoreRequest(
            interface_ids=["api-1"],
            reason="Emergency restore",
            requester="test-user",
        )
        restore = batch_service.create_restore_request(batch.id, restore_request)
        restore = batch_service.approve_restore_request(batch.id, restore.id, "approver")
        
        batch = batch_service.get_batch(batch.id)
        assert batch.status == BatchStatus.PARTIAL_RESTORED

    def test_observing_to_completed(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "test-user")
        batch = batch_service.start_batch(batch.id, "test-user")
        batch = batch_service.start_observation(batch.id, "test-user")
        
        conclusion_request = CreateConclusionRequest(
            conclusion_type=ConclusionType.SUCCESS,
            summary="All good",
            archived_by="test-user",
        )
        batch = batch_service.complete_batch(batch.id, conclusion_request)
        
        assert batch.status == BatchStatus.COMPLETED
        assert batch.conclusion is not None

    def test_cannot_validate_already_validated_batch(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "test-user")
        
        with pytest.raises(ValueError, match="Cannot validate batch in validated state"):
            batch_service.validate_batch(batch.id, "test-user")

    def test_cannot_start_batch_in_draft_state(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        
        with pytest.raises(ValueError, match="Cannot start batch in draft state"):
            batch_service.start_batch(batch.id, "test-user")

    def test_cannot_complete_batch_in_draft_state(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        
        conclusion_request = CreateConclusionRequest(
            conclusion_type=ConclusionType.SUCCESS,
            summary="All good",
            archived_by="test-user",
        )
        
        with pytest.raises(ValueError, match="Cannot complete batch in draft state"):
            batch_service.complete_batch(batch.id, conclusion_request)

    def test_cancel_batch_from_any_state_except_completed_or_cancelled(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.cancel_batch(batch.id, "test-user")
        
        assert batch.status == BatchStatus.CANCELLED

    def test_cannot_cancel_completed_batch(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "test-user")
        batch = batch_service.start_batch(batch.id, "test-user")
        batch = batch_service.start_observation(batch.id, "test-user")
        
        conclusion_request = CreateConclusionRequest(
            conclusion_type=ConclusionType.SUCCESS,
            summary="All good",
            archived_by="test-user",
        )
        batch = batch_service.complete_batch(batch.id, conclusion_request)
        
        with pytest.raises(ValueError, match="Cannot cancel batch in completed state"):
            batch_service.cancel_batch(batch.id, "test-user")


class TestBatchLifecycle:
    def test_full_batch_lifecycle(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        assert batch.status == BatchStatus.DRAFT

        batch = batch_service.validate_batch(batch.id, "validator")
        assert batch.status == BatchStatus.VALIDATED

        batch = batch_service.start_batch(batch.id, "operator")
        assert batch.status == BatchStatus.IN_PROGRESS
        assert batch.current_phase == 1
        assert batch.phases[0].status == InterfaceStatus.SUSPENDED

        batch = batch_service.start_observation(batch.id, "operator")
        assert batch.status == BatchStatus.OBSERVING
        assert batch.phases[0].completed_at is not None

        batch = batch_service.update_metric(batch.id, "metric-1", 50.0)
        assert batch.metrics[0].current_value == 50.0
        assert batch.metrics[0].is_alert is False

        batch = batch_service.update_metric(batch.id, "metric-1", 150.0)
        assert batch.metrics[0].is_alert is True

        conclusion_request = CreateConclusionRequest(
            conclusion_type=ConclusionType.PARTIAL_SUCCESS,
            summary="Partial success with some alerts",
            archived_by="manager",
        )
        batch = batch_service.complete_batch(batch.id, conclusion_request)
        
        assert batch.status == BatchStatus.COMPLETED
        assert batch.conclusion.conclusion_type == ConclusionType.PARTIAL_SUCCESS

    def test_batch_history_is_recorded(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "validator")
        batch = batch_service.cancel_batch(batch.id, "canceller")
        
        history = batch_service.get_history(batch.id)
        
        assert len(history) >= 3
        assert any(h.action == "CREATED" for h in history)
        assert any(h.action == "VALIDATED" for h in history)
        assert any(h.action == "CANCELLED" for h in history)

    def test_list_batches_with_status_filter(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch1 = batch_service.create_batch(valid_batch_request)
        batch2 = batch_service.create_batch(valid_batch_request)
        batch_service.validate_batch(batch2.id, "test-user")
        
        drafts, _ = batch_service.list_batches(status=BatchStatus.DRAFT)
        assert len(drafts) == 1
        assert drafts[0].id == batch1.id
        
        validated, _ = batch_service.list_batches(status=BatchStatus.VALIDATED)
        assert len(validated) == 1
        assert validated[0].id == batch2.id

    def test_multi_phase_execution(
        self,
        batch_service: BatchService,
        valid_batch_request: CreateBatchRequest,
    ):
        batch = batch_service.create_batch(valid_batch_request)
        batch = batch_service.validate_batch(batch.id, "test-user")
        
        batch = batch_service.start_batch(batch.id, "test-user")
        assert batch.current_phase == 1
        assert batch.phases[0].status == InterfaceStatus.SUSPENDED
        
        batch = batch_service.start_observation(batch.id, "test-user")
        
        batch = batch_service.start_batch(batch.id, "test-user")
        assert batch.current_phase == 2
        assert batch.phases[1].status == InterfaceStatus.SUSPENDED
