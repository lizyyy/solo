import uuid
from datetime import datetime
from typing import Dict, List, Optional
from models import (
    TenantMigration, MigrationPhase, MigrationStatus, PhaseRecord,
    RollbackPoint, ExceptionRecord, ValidationResult, MigrationSummary
)


class MigrationGuardrailService:
    def __init__(self):
        self._migrations: Dict[str, TenantMigration] = {}
        self._tenant_active_migrations: Dict[str, str] = {}

    PHASE_ORDER = [
        MigrationPhase.INITIALIZED,
        MigrationPhase.PRE_CHECK,
        MigrationPhase.DATA_BACKUP,
        MigrationPhase.DATA_EXPORT,
        MigrationPhase.DATA_IMPORT,
        MigrationPhase.DATA_VALIDATION,
        MigrationPhase.SWITCH_TRAFFIC,
        MigrationPhase.POST_CLEANUP,
        MigrationPhase.COMPLETED
    ]

    def _get_next_phase(self, current_phase: MigrationPhase) -> Optional[MigrationPhase]:
        try:
            idx = self.PHASE_ORDER.index(current_phase)
            if idx + 1 < len(self.PHASE_ORDER):
                return self.PHASE_ORDER[idx + 1]
            return None
        except ValueError:
            return None

    def create_migration(
        self, tenant_id: str, source_region: str, target_region: str,
        created_by: Optional[str] = None, remarks: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> TenantMigration:
        if tenant_id in self._tenant_active_migrations:
            existing_id = self._tenant_active_migrations[tenant_id]
            existing = self._migrations[existing_id]
            if existing.is_active and existing.current_phase != MigrationPhase.COMPLETED:
                raise ValueError(
                    f"Tenant {tenant_id} already has an active migration: {existing_id}"
                )

        migration_id = f"mig-{uuid.uuid4().hex[:12]}"
        migration = TenantMigration(
            migration_id=migration_id,
            tenant_id=tenant_id,
            source_region=source_region,
            target_region=target_region,
            created_by=created_by,
            remarks=remarks,
            metadata=metadata or {}
        )

        initial_phase = PhaseRecord(
            phase=MigrationPhase.INITIALIZED,
            status=MigrationStatus.SUCCESS,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            operator=created_by
        )
        migration.phase_history.append(initial_phase)

        self._migrations[migration_id] = migration
        self._tenant_active_migrations[tenant_id] = migration_id
        return migration

    def get_migration(self, migration_id: str) -> Optional[TenantMigration]:
        return self._migrations.get(migration_id)

    def list_migrations(
        self, tenant_id: Optional[str] = None,
        phase: Optional[MigrationPhase] = None,
        active_only: bool = False
    ) -> List[TenantMigration]:
        result = list(self._migrations.values())
        if tenant_id:
            result = [m for m in result if m.tenant_id == tenant_id]
        if phase:
            result = [m for m in result if m.current_phase == phase]
        if active_only:
            result = [m for m in result if m.is_active]
        return sorted(result, key=lambda m: m.created_at, reverse=True)

    def advance_phase(
        self, migration_id: str, operator: Optional[str] = None,
        force: bool = False, validation_results: Optional[List[ValidationResult]] = None
    ) -> TenantMigration:
        migration = self._require_migration(migration_id)

        if migration.current_phase == MigrationPhase.COMPLETED:
            raise ValueError("Migration is already completed")

        if migration.current_phase == MigrationPhase.FAILED and not force:
            raise ValueError("Migration is in FAILED state, use force to override")

        current_phase_record = self._get_current_phase_record(migration)

        if current_phase_record and current_phase_record.status == MigrationStatus.IN_PROGRESS:
            if not force:
                raise ValueError(
                    f"Phase {migration.current_phase} is already in progress, "
                    "use force to override"
                )

        if current_phase_record and current_phase_record.status == MigrationStatus.SUCCESS:
            unresolved = [e for e in current_phase_record.exceptions if not e.resolved]
            if unresolved and not force:
                raise ValueError(
                    f"Phase has {len(unresolved)} unresolved exceptions, "
                    "resolve them or use force"
                )

        if not force:
            if current_phase_record and current_phase_record.status != MigrationStatus.SUCCESS:
                if validation_results:
                    all_passed = all(v.status == MigrationStatus.SUCCESS for v in validation_results)
                    if not all_passed:
                        raise ValueError("Not all validation results passed")
                else:
                    raise ValueError(
                        f"Current phase {migration.current_phase} is not marked as successful"
                    )

        next_phase = self._get_next_phase(migration.current_phase)
        if not next_phase:
            raise ValueError("No next phase available")

        if current_phase_record:
            current_phase_record.completed_at = datetime.now()
            if validation_results:
                current_phase_record.validation_results.extend(validation_results)

        new_phase_record = PhaseRecord(
            phase=next_phase,
            status=MigrationStatus.IN_PROGRESS,
            started_at=datetime.now(),
            operator=operator
        )
        migration.phase_history.append(new_phase_record)
        migration.current_phase = next_phase
        migration.updated_at = datetime.now()

        return migration

    def complete_phase(
        self, migration_id: str, status: MigrationStatus,
        validation_results: Optional[List[ValidationResult]] = None,
        operator: Optional[str] = None
    ) -> TenantMigration:
        migration = self._require_migration(migration_id)
        phase_record = self._get_current_phase_record(migration)

        if not phase_record:
            raise ValueError("No phase record found")

        if phase_record.status != MigrationStatus.IN_PROGRESS:
            if phase_record.status == MigrationStatus.SUCCESS:
                raise ValueError(f"Phase {phase_record.phase} is already completed successfully")
            raise ValueError(f"Phase {phase_record.phase} is not in progress")

        phase_record.status = status
        phase_record.completed_at = datetime.now()
        phase_record.operator = operator or phase_record.operator

        if validation_results:
            phase_record.validation_results.extend(validation_results)

        if status == MigrationStatus.FAILED:
            migration.current_phase = MigrationPhase.FAILED

        migration.updated_at = datetime.now()
        return migration

    def report_exception(
        self, migration_id: str, error_type: str, error_message: str,
        raw_input: Optional[Dict] = None, processing_context: Optional[Dict] = None,
        operator: Optional[str] = None
    ) -> TenantMigration:
        migration = self._require_migration(migration_id)
        phase_record = self._get_current_phase_record(migration)

        exception_id = f"exc-{uuid.uuid4().hex[:8]}"
        exception = ExceptionRecord(
            exception_id=exception_id,
            phase=migration.current_phase,
            error_type=error_type,
            error_message=error_message,
            raw_input=raw_input,
            processing_context=processing_context,
            timestamp=datetime.now(),
            resolved=False
        )

        phase_record.exceptions.append(exception)
        phase_record.status = MigrationStatus.FAILED
        migration.current_phase = MigrationPhase.FAILED
        migration.updated_at = datetime.now()

        return migration

    def resolve_exception(
        self, migration_id: str, exception_id: str, resolution: str, operator: str
    ) -> TenantMigration:
        migration = self._require_migration(migration_id)

        for phase_record in migration.phase_history:
            for exception in phase_record.exceptions:
                if exception.exception_id == exception_id:
                    exception.resolved = True
                    exception.resolution = resolution
                    exception.resolved_by = operator
                    exception.resolved_at = datetime.now()
                    migration.updated_at = datetime.now()
                    return migration

        raise ValueError(f"Exception {exception_id} not found")

    def manual_correction(
        self, migration_id: str, resolution: str, operator: str,
        target_phase: Optional[MigrationPhase] = None,
        new_status: Optional[MigrationStatus] = None
    ) -> TenantMigration:
        migration = self._require_migration(migration_id)

        migration.metadata.setdefault("manual_corrections", []).append({
            "resolution": resolution,
            "operator": operator,
            "timestamp": datetime.now().isoformat(),
            "previous_phase": migration.current_phase.value,
            "target_phase": target_phase.value if target_phase else None,
            "new_status": new_status.value if new_status else None
        })

        if target_phase:
            migration.current_phase = target_phase
            existing_record = next(
                (p for p in migration.phase_history if p.phase == target_phase),
                None
            )
            if not existing_record:
                new_record = PhaseRecord(
                    phase=target_phase,
                    status=new_status or MigrationStatus.PENDING,
                    started_at=datetime.now(),
                    operator=operator
                )
                migration.phase_history.append(new_record)
            elif new_status:
                existing_record.status = new_status

        migration.updated_at = datetime.now()
        return migration

    def create_rollback_point(
        self, migration_id: str, description: str,
        backup_location: Optional[str] = None, metadata: Optional[Dict] = None
    ) -> RollbackPoint:
        migration = self._require_migration(migration_id)

        rollback_id = f"rb-{uuid.uuid4().hex[:10]}"
        rollback_point = RollbackPoint(
            rollback_id=rollback_id,
            phase=migration.current_phase,
            description=description,
            backup_location=backup_location,
            created_at=datetime.now(),
            metadata=metadata or {}
        )

        migration.rollback_points.append(rollback_point)
        migration.updated_at = datetime.now()
        return rollback_point

    def get_migration_summary(self, migration_id: str) -> MigrationSummary:
        migration = self._require_migration(migration_id)

        total_phases = len(self.PHASE_ORDER)
        completed_phases = len([
            p for p in migration.phase_history
            if p.status == MigrationStatus.SUCCESS
        ])
        failed_phases = len([
            p for p in migration.phase_history
            if p.status == MigrationStatus.FAILED
        ])

        all_exceptions = []
        for phase in migration.phase_history:
            all_exceptions.extend(phase.exceptions)

        unresolved = len([e for e in all_exceptions if not e.resolved])

        if migration.current_phase == MigrationPhase.COMPLETED:
            overall = MigrationStatus.SUCCESS
        elif migration.current_phase == MigrationPhase.FAILED:
            overall = MigrationStatus.FAILED
        else:
            current_record = self._get_current_phase_record(migration)
            overall = current_record.status if current_record else MigrationStatus.PENDING

        return MigrationSummary(
            migration_id=migration.migration_id,
            tenant_id=migration.tenant_id,
            source_region=migration.source_region,
            target_region=migration.target_region,
            current_phase=migration.current_phase,
            overall_status=overall,
            created_at=migration.created_at,
            updated_at=migration.updated_at,
            total_phases=total_phases,
            completed_phases=completed_phases,
            failed_phases=failed_phases,
            exception_count=len(all_exceptions),
            unresolved_exceptions=unresolved
        )

    def export_migration_report(self, migration_id: str) -> Dict:
        migration = self._require_migration(migration_id)
        summary = self.get_migration_summary(migration_id)

        report = {
            "summary": summary.dict(),
            "phase_details": [],
            "rollback_points": [rb.dict() for rb in migration.rollback_points],
            "manual_corrections": migration.metadata.get("manual_corrections", []),
            "all_exceptions": []
        }

        for phase in migration.phase_history:
            phase_dict = phase.dict()
            phase_dict["duration_seconds"] = None
            if phase.started_at and phase.completed_at:
                duration = (phase.completed_at - phase.started_at).total_seconds()
                phase_dict["duration_seconds"] = round(duration, 2)
            report["phase_details"].append(phase_dict)

            for exc in phase.exceptions:
                exc_dict = exc.dict()
                exc_dict["phase"] = phase.phase.value
                report["all_exceptions"].append(exc_dict)

        return report

    def _require_migration(self, migration_id: str) -> TenantMigration:
        migration = self.get_migration(migration_id)
        if not migration:
            raise ValueError(f"Migration {migration_id} not found")
        return migration

    def _get_current_phase_record(self, migration: TenantMigration) -> Optional[PhaseRecord]:
        if migration.current_phase in [MigrationPhase.FAILED, MigrationPhase.ROLLBACK]:
            if migration.phase_history:
                return migration.phase_history[-1]
        for phase_record in reversed(migration.phase_history):
            if phase_record.phase == migration.current_phase:
                return phase_record
        return None
