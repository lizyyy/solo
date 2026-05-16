from typing import List, Optional
import json
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import engine, get_db
from models import RequestStatus

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="分支保护例外API", version="1.0.0")


@app.middleware("http")
async def check_expired_windows_middleware(request, call_next):
    db = next(get_db())
    crud.check_expired_windows(db)
    response = await call_next(request)
    return response


@app.post("/repositories/", response_model=schemas.Repository, tags=["Repositories"])
def create_repository(repo: schemas.RepositoryCreate, db: Session = Depends(get_db)):
    db_repo = crud.get_repository_by_name(db, name=repo.name)
    if db_repo:
        raise HTTPException(status_code=400, detail="Repository already exists")
    return crud.create_repository(db=db, repo=repo)


@app.get("/repositories/", response_model=List[schemas.Repository], tags=["Repositories"])
def read_repositories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_repositories(db, skip=skip, limit=limit)


@app.get("/repositories/{repo_id}", response_model=schemas.Repository, tags=["Repositories"])
def read_repository(repo_id: int, db: Session = Depends(get_db)):
    db_repo = crud.get_repository(db, repo_id=repo_id)
    if db_repo is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    return db_repo


@app.post("/branch-rules/", response_model=schemas.BranchRule, tags=["Branch Rules"])
def create_branch_rule(rule: schemas.BranchRuleCreate, db: Session = Depends(get_db)):
    return crud.create_branch_rule(db=db, rule=rule)


@app.get("/repositories/{repo_id}/branch-rules/", response_model=List[schemas.BranchRule], tags=["Branch Rules"])
def read_branch_rules(repo_id: int, db: Session = Depends(get_db)):
    return crud.get_branch_rules_by_repository(db, repo_id=repo_id)


@app.post("/exception-requests/", tags=["Exception Requests"])
def create_exception_request(
    request: schemas.ExceptionRequestCreate,
    db: Session = Depends(get_db),
):
    db_request, is_new = crud.create_exception_request(db=db, request=request)
    status_code = 201 if is_new else 200
    return JSONResponse(
        status_code=status_code,
        content={
            "data": json.loads(schemas.ExceptionRequest.model_validate(db_request).model_dump_json()),
            "is_new": is_new,
            "message": "Request created successfully" if is_new else "Duplicate request detected, returning existing",
        },
    )


@app.get("/exception-requests/", response_model=List[schemas.ExceptionRequest], tags=["Exception Requests"])
def read_exception_requests(
    skip: int = 0,
    limit: int = 100,
    status: Optional[RequestStatus] = None,
    repository_id: Optional[int] = None,
    requester: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return crud.get_exception_requests(
        db,
        skip=skip,
        limit=limit,
        status=status,
        repository_id=repository_id,
        requester=requester,
    )


@app.get("/exception-requests/{request_id}", response_model=schemas.ExceptionRequestDetail, tags=["Exception Requests"])
def read_exception_request(request_id: int, db: Session = Depends(get_db)):
    db_request = crud.get_exception_request(db, request_id=request_id)
    if db_request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return db_request


@app.post("/exception-requests/{request_id}/approve", response_model=schemas.ExceptionRequest, tags=["Exception Requests"])
def approve_request(
    request_id: int,
    transition: schemas.StatusTransitionRequest,
    db: Session = Depends(get_db),
):
    db_request, error = crud.approve_exception_request(
        db,
        request_id=request_id,
        approver=transition.actor,
        comment=transition.comment,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_request


@app.post("/exception-requests/{request_id}/reject", response_model=schemas.ExceptionRequest, tags=["Exception Requests"])
def reject_request(
    request_id: int,
    transition: schemas.StatusTransitionRequest,
    db: Session = Depends(get_db),
):
    db_request, error = crud.reject_exception_request(
        db,
        request_id=request_id,
        rejector=transition.actor,
        comment=transition.comment,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_request


@app.post("/exception-requests/{request_id}/start-window", response_model=schemas.ExceptionRequest, tags=["Exception Requests"])
def start_release_window(
    request_id: int,
    transition: schemas.StatusTransitionRequest,
    db: Session = Depends(get_db),
):
    db_request, error = crud.start_release_window(
        db,
        request_id=request_id,
        actor=transition.actor,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_request


@app.post("/exception-requests/{request_id}/restore", response_model=schemas.ExceptionRequest, tags=["Exception Requests"])
def restore_branch_protection(
    request_id: int,
    restore: schemas.RestoreActionBase,
    db: Session = Depends(get_db),
):
    db_request, error = crud.restore_branch_protection(
        db,
        request_id=request_id,
        restored_by=restore.restored_by,
        is_manual=restore.is_manual,
        comment=restore.comment,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_request


@app.post("/exception-requests/{request_id}/manual-correction", response_model=schemas.ExceptionRequest, tags=["Exception Requests"])
def manual_correction(
    request_id: int,
    correction: schemas.ManualCorrectionRequest,
    db: Session = Depends(get_db),
):
    db_request, error = crud.manual_correction(
        db,
        request_id=request_id,
        actor=correction.actor,
        new_status=correction.new_status,
        reason=correction.reason,
        original_input=correction.original_input,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_request


@app.get("/audit-records/", response_model=List[schemas.AuditRecord], tags=["Audit"])
def read_audit_records(
    request_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return crud.get_audit_records(db, request_id=request_id, skip=skip, limit=limit)


@app.post("/export/audit-report", tags=["Export"])
def export_audit_report(
    filters: Optional[schemas.ExportFilter] = None,
    db: Session = Depends(get_db),
):
    if filters is None:
        filters = schemas.ExportFilter()
    report = crud.export_audit_report(
        db,
        start_date=filters.start_date,
        end_date=filters.end_date,
        repository_id=filters.repository_id,
        status=filters.status,
        requester=filters.requester,
    )
    return {
        "report_generated_at": models.datetime.utcnow().isoformat(),
        "total_requests": len(report),
        "requests": report,
    }


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy", "service": "branch-protection-exception-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
