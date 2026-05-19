from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import json

import models
import schemas
import crud
from database import engine, get_db
from parser import LockfileParser
from auditor import HashAuditor

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Lockfile包来源哈希校验后端API", version="0.1.0")

parser = LockfileParser()
auditor = HashAuditor()


@app.post("/api/audits", response_model=schemas.LockfileAudit, status_code=201)
def create_audit(audit: schemas.LockfileAuditCreate, db: Session = Depends(get_db)):
    db_audit, content_hash = crud.create_lockfile_audit(db, audit)

    packages, errors = parser.parse(audit.content, audit.lockfile_type)

    for pkg in packages:
        package_create = schemas.PackageAuditCreate(
            package_name=pkg["package_name"],
            version=pkg["version"],
            registry=pkg["registry"],
            integrity_hash=pkg["integrity_hash"]
        )
        crud.create_package_audit(db, package_create, db_audit.id)

    for error in errors:
        exception_create = schemas.AuditExceptionCreate(
            original_input=f"Parse error for {audit.lockfile_type}",
            conclusion=error,
            resolved=False
        )
        crud.create_audit_exception(db, exception_create, db_audit.id)

    crud.update_lockfile_audit_status(db, db_audit.id, models.AuditStatus.PROCESSING)

    db.refresh(db_audit)
    return db_audit


@app.get("/api/audits", response_model=schemas.LockfileAuditList)
def list_audits(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[models.AuditStatus] = None,
    db: Session = Depends(get_db)
):
    total, items = crud.get_lockfile_audits(db, skip=skip, limit=limit, status=status)
    return {"total": total, "items": items}


@app.get("/api/audits/{audit_id}", response_model=schemas.LockfileAudit)
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    db_audit = crud.get_lockfile_audit(db, audit_id)
    if not db_audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return db_audit


@app.patch("/api/audits/{audit_id}/status", response_model=schemas.LockfileAudit)
def update_audit_status(
    audit_id: int,
    update: schemas.LockfileAuditUpdate,
    db: Session = Depends(get_db)
):
    db_audit = crud.get_lockfile_audit(db, audit_id)
    if not db_audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    if update.status:
        db_audit = crud.update_lockfile_audit_status(db, audit_id, update.status, update.notes)
    return db_audit


@app.post("/api/audits/{audit_id}/verify")
def verify_audit(audit_id: int, db: Session = Depends(get_db)):
    db_audit = crud.get_lockfile_audit(db, audit_id)
    if not db_audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    crud.update_lockfile_audit_status(db, audit_id, models.AuditStatus.PROCESSING)

    packages = crud.get_packages_by_audit(db, audit_id)

    for pkg in packages:
        is_valid, status, result = auditor.verify_hash(
            pkg.package_name,
            pkg.version,
            pkg.integrity_hash,
            pkg.registry
        )

        report_create = schemas.SourceReportCreate(
            registry_url=pkg.registry,
            found=result["found"],
            hash_match=result["hash_match"],
            response_data=result["response_data"],
            error_message=result["error_message"]
        )
        crud.create_source_report(db, report_create, pkg.id)
        crud.update_package_audit_status(db, pkg.id, status)

    conflicts = auditor.check_registry_conflicts([
        {
            "package_name": p.package_name,
            "version": p.version,
            "registry": p.registry,
            "integrity_hash": p.integrity_hash
        }
        for p in packages
    ])

    for conflict in conflicts:
        pkg = next((p for p in packages if p.package_name == conflict["package_name"]), None)
        if pkg:
            crud.update_package_audit_status(db, pkg.id, models.PackageStatus.CONFLICT)

    crud.update_lockfile_audit_status(db, audit_id, models.AuditStatus.COMPLETED)

    db.refresh(db_audit)
    summary = auditor.generate_audit_summary(packages)

    return {
        "audit_id": audit_id,
        "status": "completed",
        "summary": summary,
        "conflicts_found": len(conflicts)
    }


@app.post("/api/audits/{audit_id}/correct")
def manual_correction(
    audit_id: int,
    correction: schemas.ManualCorrection,
    db: Session = Depends(get_db)
):
    db_audit = crud.get_lockfile_audit(db, audit_id)
    if not db_audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    db_package, db_exception = crud.manual_correct_package(db, audit_id, correction)

    if not db_package:
        raise HTTPException(status_code=404, detail="Package not found")

    crud.update_lockfile_audit_status(db, audit_id, models.AuditStatus.NEEDS_REVIEW)
    db.refresh(db_package)
    db.refresh(db_exception)

    return {
        "package": {
            "id": db_package.id,
            "package_name": db_package.package_name,
            "version": db_package.version,
            "registry": db_package.registry,
            "status": db_package.status.value,
            "integrity_hash": db_package.integrity_hash
        },
        "exception": {
            "id": db_exception.id,
            "package_name": db_exception.package_name,
            "handler": db_exception.handler,
            "conclusion": db_exception.conclusion,
            "resolved": db_exception.resolved
        },
        "message": "Manual correction applied successfully"
    }


@app.delete("/api/audits/{audit_id}/close")
def close_audit(audit_id: int, notes: Optional[str] = None, db: Session = Depends(get_db)):
    db_audit = crud.get_lockfile_audit(db, audit_id)
    if not db_audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    db_audit = crud.update_lockfile_audit_status(
        db, audit_id, models.AuditStatus.CLOSED, notes
    )

    return {"message": "Audit closed successfully", "audit": db_audit}


@app.get("/api/audits/{audit_id}/export")
def export_audit(audit_id: int, db: Session = Depends(get_db)):
    db_audit = crud.get_lockfile_audit(db, audit_id)
    if not db_audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    packages = crud.get_packages_by_audit(db, audit_id)
    exceptions = crud.get_exceptions_by_audit(db, audit_id)
    summary = auditor.generate_audit_summary(packages)

    export_data = {
        "audit_id": audit_id,
        "name": db_audit.name,
        "lockfile_type": db_audit.lockfile_type,
        "content_hash": db_audit.content_hash,
        "status": db_audit.status.value,
        "created_at": db_audit.created_at.isoformat(),
        "exported_at": datetime.utcnow().isoformat(),
        "summary": summary,
        "packages": [
            {
                "package_name": p.package_name,
                "version": p.version,
                "registry": p.registry,
                "integrity_hash": p.integrity_hash,
                "status": p.status.value,
                "source_reports": [
                    {
                        "registry_url": r.registry_url,
                        "found": r.found,
                        "hash_match": r.hash_match,
                        "error_message": r.error_message
                    }
                    for r in p.source_reports
                ]
            }
            for p in packages
        ],
        "exceptions": [
            {
                "package_name": e.package_name,
                "original_input": e.original_input,
                "handler": e.handler,
                "conclusion": e.conclusion,
                "resolved": e.resolved,
                "created_at": e.created_at.isoformat()
            }
            for e in exceptions
        ]
    }

    response = JSONResponse(content=export_data)
    response.headers["Content-Disposition"] = f"attachment; filename=audit_{audit_id}.json"
    return response


@app.get("/api/audits/{audit_id}/exceptions", response_model=List[schemas.AuditException])
def list_exceptions(audit_id: int, db: Session = Depends(get_db)):
    db_audit = crud.get_lockfile_audit(db, audit_id)
    if not db_audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return crud.get_exceptions_by_audit(db, audit_id)


@app.patch("/api/exceptions/{exception_id}", response_model=schemas.AuditException)
def update_exception(
    exception_id: int,
    update: schemas.AuditExceptionUpdate,
    db: Session = Depends(get_db)
):
    db_exception = crud.get_audit_exception(db, exception_id)
    if not db_exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return crud.update_audit_exception(db, exception_id, update)


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
