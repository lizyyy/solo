from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime
import json

from models import (
    TenantMigration, MigrationPhase, MigrationStatus,
    CreateMigrationRequest, AdvancePhaseRequest,
    ReportExceptionRequest, ManualCorrectionRequest,
    MigrationSummary, ValidationResult, RollbackPoint
)
from service import MigrationGuardrailService

app = FastAPI(title="租户数据迁移护栏API", version="1.0.0")
service = MigrationGuardrailService()


@app.post("/api/migrations", response_model=TenantMigration, status_code=201)
def create_migration(request: CreateMigrationRequest):
    try:
        return service.create_migration(
            tenant_id=request.tenant_id,
            source_region=request.source_region,
            target_region=request.target_region,
            created_by=request.created_by,
            remarks=request.remarks,
            metadata=request.metadata
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/migrations", response_model=List[TenantMigration])
def list_migrations(
    tenant_id: Optional[str] = None,
    phase: Optional[MigrationPhase] = None,
    active_only: bool = Query(False, description="Only show active migrations")
):
    return service.list_migrations(
        tenant_id=tenant_id,
        phase=phase,
        active_only=active_only
    )


@app.get("/api/migrations/{migration_id}", response_model=TenantMigration)
def get_migration(migration_id: str):
    migration = service.get_migration(migration_id)
    if not migration:
        raise HTTPException(status_code=404, detail="Migration not found")
    return migration


@app.post("/api/migrations/{migration_id}/advance", response_model=TenantMigration)
def advance_phase(migration_id: str, request: AdvancePhaseRequest):
    try:
        return service.advance_phase(
            migration_id=migration_id,
            operator=request.operator,
            force=request.force,
            validation_results=request.validation_results
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/migrations/{migration_id}/complete", response_model=TenantMigration)
def complete_phase(
    migration_id: str,
    status: MigrationStatus,
    operator: Optional[str] = None,
    validation_results: Optional[List[ValidationResult]] = None
):
    try:
        return service.complete_phase(
            migration_id=migration_id,
            status=status,
            validation_results=validation_results,
            operator=operator
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/migrations/{migration_id}/exceptions", response_model=TenantMigration)
def report_exception(migration_id: str, request: ReportExceptionRequest):
    try:
        return service.report_exception(
            migration_id=migration_id,
            error_type=request.error_type,
            error_message=request.error_message,
            raw_input=request.raw_input,
            processing_context=request.processing_context,
            operator=request.operator
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/migrations/{migration_id}/exceptions/{exception_id}/resolve", response_model=TenantMigration)
def resolve_exception(migration_id: str, exception_id: str, resolution: str, operator: str):
    try:
        return service.resolve_exception(
            migration_id=migration_id,
            exception_id=exception_id,
            resolution=resolution,
            operator=operator
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/migrations/{migration_id}/manual-correction", response_model=TenantMigration)
def manual_correction(migration_id: str, request: ManualCorrectionRequest):
    try:
        return service.manual_correction(
            migration_id=migration_id,
            resolution=request.resolution,
            operator=request.operator,
            target_phase=request.target_phase,
            new_status=request.new_status
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/migrations/{migration_id}/rollback-points", response_model=RollbackPoint)
def create_rollback_point(
    migration_id: str,
    description: str,
    backup_location: Optional[str] = None
):
    try:
        return service.create_rollback_point(
            migration_id=migration_id,
            description=description,
            backup_location=backup_location
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/migrations/{migration_id}/summary", response_model=MigrationSummary)
def get_migration_summary(migration_id: str):
    try:
        return service.get_migration_summary(migration_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/migrations/{migration_id}/export")
def export_migration_report(migration_id: str):
    try:
        report = service.export_migration_report(migration_id)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"migration_report_{migration_id}_{timestamp}.json"

        return JSONResponse(
            content=report,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/json"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "migration-guardrail-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
