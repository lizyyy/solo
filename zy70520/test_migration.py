import pytest
from models import MigrationPhase, MigrationStatus, ValidationResult
from service import MigrationGuardrailService


@pytest.fixture
def service():
    return MigrationGuardrailService()


class TestMigrationCreation:
    def test_create_migration_success(self, service):
        migration = service.create_migration(
            tenant_id="T001",
            source_region="beijing",
            target_region="shanghai",
            created_by="admin"
        )

        assert migration.migration_id.startswith("mig-")
        assert migration.tenant_id == "T001"
        assert migration.source_region == "beijing"
        assert migration.target_region == "shanghai"
        assert migration.current_phase == MigrationPhase.INITIALIZED
        assert len(migration.phase_history) == 1
        assert migration.phase_history[0].status == MigrationStatus.SUCCESS

    def test_create_duplicate_active_migration_fails(self, service):
        service.create_migration("T001", "beijing", "shanghai")

        with pytest.raises(ValueError, match="already has an active migration"):
            service.create_migration("T001", "beijing", "guangzhou")

    def test_get_migration(self, service):
        created = service.create_migration("T001", "beijing", "shanghai")
        fetched = service.get_migration(created.migration_id)

        assert fetched is not None
        assert fetched.migration_id == created.migration_id
        assert fetched.tenant_id == "T001"

    def test_list_migrations(self, service):
        service.create_migration("T001", "beijing", "shanghai")
        service.create_migration("T002", "beijing", "guangzhou")

        all_migrations = service.list_migrations()
        assert len(all_migrations) == 2

        tenant_migrations = service.list_migrations(tenant_id="T001")
        assert len(tenant_migrations) == 1
        assert tenant_migrations[0].tenant_id == "T001"


class TestPhaseAdvancement:
    def test_advance_phase_success(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id, operator="operator1")
        assert migration.current_phase == MigrationPhase.PRE_CHECK

        current_phase_record = service._get_current_phase_record(migration)
        assert current_phase_record.status == MigrationStatus.IN_PROGRESS
        assert current_phase_record.operator == "operator1"

    def test_advance_already_in_progress_fails(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        service.advance_phase(migration_id)

        with pytest.raises(ValueError, match="already in progress"):
            service.advance_phase(migration_id)

    def test_advance_already_in_progress_force_works(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        service.advance_phase(migration_id)
        migration = service.advance_phase(migration_id, force=True)

        assert migration.current_phase == MigrationPhase.DATA_BACKUP

    def test_advance_completed_migration_fails(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration.current_phase = MigrationPhase.COMPLETED

        with pytest.raises(ValueError, match="already completed"):
            service.advance_phase(migration_id)


class TestPhaseCompletion:
    def test_complete_phase_success(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id)
        assert migration.current_phase == MigrationPhase.PRE_CHECK

        migration = service.complete_phase(
            migration_id,
            status=MigrationStatus.SUCCESS,
            operator="operator1"
        )

        phase_record = service._get_current_phase_record(migration)
        assert phase_record.status == MigrationStatus.SUCCESS
        assert phase_record.completed_at is not None

    def test_complete_phase_already_completed_fails(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id)
        service.complete_phase(migration_id, status=MigrationStatus.SUCCESS)

        with pytest.raises(ValueError, match="already completed successfully"):
            service.complete_phase(migration_id, status=MigrationStatus.SUCCESS)

    def test_complete_phase_with_validation_results(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id)

        validation = [ValidationResult(
            check_name="connectivity_check",
            status=MigrationStatus.SUCCESS,
            message="Database connection successful"
        )]

        migration = service.complete_phase(
            migration_id,
            status=MigrationStatus.SUCCESS,
            validation_results=validation
        )

        phase_record = service._get_current_phase_record(migration)
        assert len(phase_record.validation_results) == 1
        assert phase_record.validation_results[0].check_name == "connectivity_check"


class TestExceptionHandling:
    def test_report_exception(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id)

        migration = service.report_exception(
            migration_id,
            error_type="DatabaseError",
            error_message="Connection timeout",
            raw_input={"host": "db01", "port": 5432},
            processing_context={"timeout": 30},
            operator="operator1"
        )

        assert migration.current_phase == MigrationPhase.FAILED
        phase_record = service._get_current_phase_record(migration)
        assert len(phase_record.exceptions) == 1

        exception = phase_record.exceptions[0]
        assert exception.error_type == "DatabaseError"
        assert exception.error_message == "Connection timeout"
        assert exception.raw_input == {"host": "db01", "port": 5432}
        assert exception.processing_context == {"timeout": 30}
        assert exception.resolved is False

    def test_resolve_exception(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id)
        migration = service.report_exception(
            migration_id,
            error_type="DatabaseError",
            error_message="Connection timeout"
        )

        exception_id = migration.phase_history[-1].exceptions[0].exception_id

        migration = service.resolve_exception(
            migration_id,
            exception_id=exception_id,
            resolution="Fixed network configuration",
            operator="admin"
        )

        exception = migration.phase_history[-1].exceptions[0]
        assert exception.resolved is True
        assert exception.resolution == "Fixed network configuration"
        assert exception.resolved_by == "admin"
        assert exception.resolved_at is not None


class TestManualCorrection:
    def test_manual_correction_jump_to_phase(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.manual_correction(
            migration_id,
            resolution="Skip pre-check due to emergency",
            operator="admin",
            target_phase=MigrationPhase.DATA_BACKUP,
            new_status=MigrationStatus.IN_PROGRESS
        )

        assert migration.current_phase == MigrationPhase.DATA_BACKUP
        assert "manual_corrections" in migration.metadata
        assert len(migration.metadata["manual_corrections"]) == 1


class TestRollbackPoint:
    def test_create_rollback_point(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id)

        rollback_point = service.create_rollback_point(
            migration_id,
            description="Before data export",
            backup_location="s3://backup/snapshot123"
        )

        assert rollback_point.rollback_id.startswith("rb-")
        assert rollback_point.phase == MigrationPhase.PRE_CHECK
        assert rollback_point.description == "Before data export"
        assert rollback_point.backup_location == "s3://backup/snapshot123"

        migration = service.get_migration(migration_id)
        assert len(migration.rollback_points) == 1


class TestSummaryAndReport:
    def test_get_migration_summary(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        summary = service.get_migration_summary(migration_id)

        assert summary.migration_id == migration_id
        assert summary.tenant_id == "T001"
        assert summary.current_phase == MigrationPhase.INITIALIZED
        assert summary.total_phases == 9
        assert summary.completed_phases == 1
        assert summary.exception_count == 0

    def test_export_migration_report(self, service):
        migration = service.create_migration("T001", "beijing", "shanghai")
        migration_id = migration.migration_id

        migration = service.advance_phase(migration_id)
        migration = service.report_exception(
            migration_id,
            error_type="TestError",
            error_message="Test exception"
        )

        report = service.export_migration_report(migration_id)

        assert "summary" in report
        assert "phase_details" in report
        assert "all_exceptions" in report
        assert "rollback_points" in report
        assert len(report["all_exceptions"]) == 1
        assert report["all_exceptions"][0]["error_type"] == "TestError"


class TestFullMigrationFlow:
    def test_full_migration_success_flow(self, service):
        migration = service.create_migration(
            tenant_id="T001",
            source_region="beijing",
            target_region="shanghai",
            created_by="operator1"
        )
        migration_id = migration.migration_id

        phases = [
            MigrationPhase.PRE_CHECK,
            MigrationPhase.DATA_BACKUP,
            MigrationPhase.DATA_EXPORT,
            MigrationPhase.DATA_IMPORT,
            MigrationPhase.DATA_VALIDATION,
            MigrationPhase.SWITCH_TRAFFIC,
            MigrationPhase.POST_CLEANUP,
            MigrationPhase.COMPLETED
        ]

        for expected_phase in phases:
            current_phase = migration.current_phase
            migration = service.advance_phase(migration_id, operator="operator1")
            assert migration.current_phase == expected_phase

            if expected_phase != MigrationPhase.COMPLETED:
                migration = service.complete_phase(
                    migration_id,
                    status=MigrationStatus.SUCCESS,
                    operator="operator1"
                )

        assert migration.current_phase == MigrationPhase.COMPLETED

        summary = service.get_migration_summary(migration_id)
        assert summary.overall_status == MigrationStatus.SUCCESS
        assert summary.completed_phases == len(phases)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
