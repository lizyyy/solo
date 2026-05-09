import pytest

from carbon_accounting.models import (
    EmissionSource,
    TransactionStatus,
)
from carbon_accounting.service import (
    CarbonAccountingService,
    EnterpriseNotFoundError,
    InsufficientQuotaError,
    InvalidTransactionError,
    DuplicateImportError,
    CarbonAccountingError,
)


class TestCarbonAccountingService:
    @pytest.fixture
    def service(self):
        return CarbonAccountingService()

    @pytest.fixture
    def enterprise_a(self, service):
        return service.register_enterprise("企业A", 2024, "ent-a-001")

    @pytest.fixture
    def enterprise_b(self, service):
        return service.register_enterprise("企业B", 2024, "ent-b-001")


class TestNormalFlow(TestCarbonAccountingService):
    def test_emission_import_and_versioning(self, service, enterprise_a):
        batch = service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[
                (EmissionSource.SCOPE1, 100.0),
                (EmissionSource.SCOPE2, 50.0),
            ],
            batch_id="batch-001",
        )

        assert batch.status == "completed"
        assert service.get_total_emission(enterprise_a.id) == 150.0

        emissions = service.store.get_active_emissions(enterprise_a.id)
        assert len(emissions) == 2
        for e in emissions:
            assert e.version == 1

    def test_quota_allocation_and_balance(self, service, enterprise_a):
        service.allocate_quota(enterprise_a.id, "2024-Q1", 500.0)
        service.allocate_quota(enterprise_a.id, "2024-Q2", 300.0)

        assert service.get_total_quota(enterprise_a.id) == 800.0
        assert service.get_available_quota(enterprise_a.id) == 800.0

    def test_transaction_flow(self, service, enterprise_a, enterprise_b):
        service.allocate_quota(enterprise_a.id, "2024-Q1", 500.0)

        transaction = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=100.0,
            price=50.0,
        )

        assert transaction.status == TransactionStatus.PENDING
        assert transaction.total_value == 5000.0

        frozen = service.freeze_transaction(transaction.id)
        assert frozen.status == TransactionStatus.FROZEN
        assert service.get_frozen_quota(enterprise_a.id) == 100.0
        assert service.get_available_quota(enterprise_a.id) == 400.0

        completed = service.complete_transaction(transaction.id)
        assert completed.status == TransactionStatus.COMPLETED
        assert service.get_total_quota(enterprise_a.id) == 400.0
        assert service.get_total_quota(enterprise_b.id) == 100.0

    def test_compliance_status_calculation(self, service, enterprise_a):
        service.allocate_quota(enterprise_a.id, "2024", 1000.0)
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 500.0)],
        )

        status = service.calculate_compliance_status(enterprise_a.id)
        assert status.total_emission == 500.0
        assert status.total_quota == 1000.0
        assert status.deficit == 0.0
        assert status.is_compliant is True
        assert status.warning_level == "normal"


class TestIdempotentOperations(TestCarbonAccountingService):
    def test_duplicate_emission_import_with_same_batch_id(self, service, enterprise_a):
        batch_id = "batch-001"

        batch1 = service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 100.0)],
            batch_id=batch_id,
        )

        batch2 = service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 100.0)],
            batch_id=batch_id,
        )

        assert batch1.id == batch2.id
        assert service.get_total_emission(enterprise_a.id) == 100.0

        emissions = service.store.get_active_emissions(enterprise_a.id)
        assert len(emissions) == 1

    def test_repeated_compliance_calculation_consistent(self, service, enterprise_a):
        service.allocate_quota(enterprise_a.id, "2024", 1000.0)
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 600.0)],
        )

        for _ in range(5):
            status = service.calculate_compliance_status(enterprise_a.id)
            assert status.total_emission == 600.0
            assert status.total_quota == 1000.0
            assert status.is_compliant is True

    def test_transaction_cancel_and_recreate(self, service, enterprise_a, enterprise_b):
        service.allocate_quota(enterprise_a.id, "2024-Q1", 500.0)

        transaction1 = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=100.0,
            price=50.0,
        )
        service.freeze_transaction(transaction1.id)

        service.cancel_transaction(transaction1.id)
        assert service.get_frozen_quota(enterprise_a.id) == 0.0
        assert service.get_available_quota(enterprise_a.id) == 500.0

        transaction2 = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=100.0,
            price=50.0,
        )
        service.freeze_transaction(transaction2.id)
        assert service.get_frozen_quota(enterprise_a.id) == 100.0


class TestEmissionCorrection(TestCarbonAccountingService):
    def test_emission_correction_creates_new_version(self, service, enterprise_a):
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 100.0)],
            batch_id="batch-v1",
        )

        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 150.0)],
            batch_id="batch-v2",
        )

        assert service.get_total_emission(enterprise_a.id) == 150.0

        all_versions = service.store.get_emission_versions(
            enterprise_a.id, "2024-01", EmissionSource.SCOPE1
        )
        assert len(all_versions) == 2

        active = [e for e in all_versions if e.is_active]
        assert len(active) == 1
        assert active[0].version == 2
        assert active[0].amount == 150.0

    def test_cross_month_correction(self, service, enterprise_a):
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 100.0)],
            batch_id="batch-jan",
        )
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-02",
            emissions_data=[(EmissionSource.SCOPE1, 200.0)],
            batch_id="batch-feb",
        )

        assert service.get_total_emission(enterprise_a.id) == 300.0

        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 120.0)],
            batch_id="batch-jan-corrected",
        )

        assert service.get_total_emission(enterprise_a.id) == 320.0

    def test_revision_history_tracking(self, service, enterprise_a):
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 100.0)],
            batch_id="batch-v1",
        )

        revisions = service.get_revision_history(enterprise_a.id)
        assert len(revisions) == 0

        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024-01",
            emissions_data=[(EmissionSource.SCOPE1, 150.0)],
            batch_id="batch-v2",
        )

        revisions = service.get_revision_history(enterprise_a.id)
        assert len(revisions) == 1
        assert revisions[0].change_type == "emission_correction"
        assert revisions[0].previous_version == 1
        assert revisions[0].version == 2


class TestWarningAndDeficit(TestCarbonAccountingService):
    def test_normal_status_when_sufficient_quota(self, service, enterprise_a):
        service.allocate_quota(enterprise_a.id, "2024", 1000.0)
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024",
            emissions_data=[(EmissionSource.SCOPE1, 500.0)],
        )

        status = service.calculate_compliance_status(enterprise_a.id)
        assert status.warning_level == "normal"
        assert status.deficit == 0.0

    def test_warning_status(self, service, enterprise_a):
        service.allocate_quota(enterprise_a.id, "2024", 1000.0)
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024",
            emissions_data=[(EmissionSource.SCOPE1, 950.0)],
        )

        status = service.calculate_compliance_status(enterprise_a.id)
        assert status.warning_level == "warning"
        assert status.deficit == 0.0
        assert status.is_compliant is True

    def test_critical_status_with_deficit(self, service, enterprise_a):
        service.allocate_quota(enterprise_a.id, "2024", 1000.0)
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024",
            emissions_data=[(EmissionSource.SCOPE1, 1300.0)],
        )

        status = service.calculate_compliance_status(enterprise_a.id)
        assert status.warning_level == "critical"
        assert status.deficit == 300.0
        assert status.is_compliant is False

    def test_frozen_quota_affects_available(self, service, enterprise_a, enterprise_b):
        service.allocate_quota(enterprise_a.id, "2024", 1000.0)
        service.import_emissions(
            enterprise_id=enterprise_a.id,
            period="2024",
            emissions_data=[(EmissionSource.SCOPE1, 900.0)],
        )

        transaction = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=200.0,
            price=50.0,
        )
        service.freeze_transaction(transaction.id)

        status = service.calculate_compliance_status(enterprise_a.id)
        assert status.available_quota == 800.0
        assert status.deficit == 100.0
        assert status.is_compliant is False


class TestExceptionHandling(TestCarbonAccountingService):
    def test_enterprise_not_found(self, service):
        with pytest.raises(EnterpriseNotFoundError):
            service.import_emissions(
                enterprise_id="non-existent",
                period="2024-01",
                emissions_data=[(EmissionSource.SCOPE1, 100.0)],
            )

    def test_negative_emission_amount(self, service, enterprise_a):
        with pytest.raises(CarbonAccountingError, match="不能为负数"):
            service.import_emissions(
                enterprise_id=enterprise_a.id,
                period="2024-01",
                emissions_data=[(EmissionSource.SCOPE1, -50.0)],
            )

    def test_negative_quota_allocation(self, service, enterprise_a):
        with pytest.raises(CarbonAccountingError, match="不能为负数"):
            service.allocate_quota(enterprise_a.id, "2024", -100.0)

    def test_insufficient_quota_for_freeze(self, service, enterprise_a, enterprise_b):
        service.allocate_quota(enterprise_a.id, "2024", 100.0)

        transaction = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=200.0,
            price=50.0,
        )

        with pytest.raises(InsufficientQuotaError):
            service.freeze_transaction(transaction.id)

    def test_invalid_transaction_amount(self, service, enterprise_a, enterprise_b):
        with pytest.raises(InvalidTransactionError, match="必须大于0"):
            service.create_transaction(
                enterprise_id=enterprise_a.id,
                counterparty_id=enterprise_b.id,
                amount=0.0,
                price=50.0,
            )

    def test_negative_transaction_price(self, service, enterprise_a, enterprise_b):
        with pytest.raises(InvalidTransactionError, match="不能为负数"):
            service.create_transaction(
                enterprise_id=enterprise_a.id,
                counterparty_id=enterprise_b.id,
                amount=100.0,
                price=-50.0,
            )

    def test_complete_unfrozen_transaction(self, service, enterprise_a, enterprise_b):
        service.allocate_quota(enterprise_a.id, "2024", 100.0)

        transaction = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=50.0,
            price=50.0,
        )

        with pytest.raises(InvalidTransactionError, match="只能完成已冻结"):
            service.complete_transaction(transaction.id)

    def test_freeze_already_frozen_transaction(self, service, enterprise_a, enterprise_b):
        service.allocate_quota(enterprise_a.id, "2024", 100.0)

        transaction = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=50.0,
            price=50.0,
        )
        service.freeze_transaction(transaction.id)

        with pytest.raises(InvalidTransactionError, match="只能冻结待处理"):
            service.freeze_transaction(transaction.id)

    def test_cancel_completed_transaction(self, service, enterprise_a, enterprise_b):
        service.allocate_quota(enterprise_a.id, "2024", 100.0)

        transaction = service.create_transaction(
            enterprise_id=enterprise_a.id,
            counterparty_id=enterprise_b.id,
            amount=50.0,
            price=50.0,
        )
        service.freeze_transaction(transaction.id)
        service.complete_transaction(transaction.id)

        with pytest.raises(InvalidTransactionError, match="只能取消待处理或已冻结"):
            service.cancel_transaction(transaction.id)
