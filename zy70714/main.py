from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from database import engine, get_db, Base
import models
import schemas
import crud

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="隐私导出同意范围约束交付记录后端API",
    description="管理个人数据导出流程：同意版本校验、范围约束、审批推进、打包幂等、交付记录",
    version="1.0.0"
)


@app.exception_handler(crud.BusinessError)
async def business_error_handler(request, exc: crud.BusinessError):
    status_code_map = {
        "USER_EXISTS": status.HTTP_409_CONFLICT,
        "REQUEST_EXISTS": status.HTTP_409_CONFLICT,
        "SCOPE_EXISTS": status.HTTP_409_CONFLICT,
        "USER_NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "REQUEST_NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "TASK_NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "INVALID_CONSENT": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "INVALID_SCOPES": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "INVALID_STATUS_TRANSITION": status.HTTP_400_BAD_REQUEST,
        "APPROVAL_ALREADY_PROCESSED": status.HTTP_409_CONFLICT,
        "PACKAGE_ALREADY_COMPLETED": status.HTTP_409_CONFLICT,
        "DELIVERY_ALREADY_RECORDED": status.HTTP_409_CONFLICT,
        "INVALID_STATUS_FOR_PACKAGING": status.HTTP_400_BAD_REQUEST,
        "INVALID_STATUS_FOR_DELIVERY": status.HTTP_400_BAD_REQUEST,
        "NEEDS_REVIEW": status.HTTP_400_BAD_REQUEST,
    }
    
    return JSONResponse(
        status_code=status_code_map.get(exc.error_code, status.HTTP_400_BAD_REQUEST),
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.post("/user-subjects/", response_model=schemas.UserSubjectResponse, status_code=status.HTTP_201_CREATED)
def create_user_subject(user: schemas.UserSubjectCreate, db: Session = Depends(get_db)):
    return crud.create_user_subject(db=db, user=user)


@app.get("/user-subjects/{user_id}", response_model=schemas.UserSubjectResponse)
def get_user_subject(user_id: str, db: Session = Depends(get_db)):
    user = crud.get_user_subject(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/consent-versions/", response_model=schemas.ConsentVersionResponse, status_code=status.HTTP_201_CREATED)
def create_consent_version(consent: schemas.ConsentVersionCreate, db: Session = Depends(get_db)):
    return crud.create_consent_version(db=db, consent=consent)


@app.post("/export-scopes/", response_model=schemas.ExportScopeResponse, status_code=status.HTTP_201_CREATED)
def create_export_scope(scope: schemas.ExportScopeCreate, db: Session = Depends(get_db)):
    return crud.create_export_scope(db=db, scope=scope)


@app.get("/export-scopes/", response_model=List[schemas.ExportScopeResponse])
def list_export_scopes(db: Session = Depends(get_db)):
    from sqlalchemy.orm import Session
    return db.query(models.ExportScope).all()


@app.post("/export-requests/", response_model=schemas.ExportRequestResponse, status_code=status.HTTP_201_CREATED)
def create_export_request(request: schemas.ExportRequestCreate, db: Session = Depends(get_db)):
    return crud.create_export_request(db=db, request=request)


@app.get("/export-requests/{request_id}", response_model=schemas.ExportRequestResponse)
def get_export_request(request_id: str, db: Session = Depends(get_db)):
    request = crud.get_export_request(db, request_id=request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Export request not found")
    return request


@app.get("/export-requests/", response_model=List[schemas.ExportRequestResponse])
def list_export_requests(
    status: models.ExportRequestStatus = None,
    user_subject_id: int = None,
    db: Session = Depends(get_db)
):
    filters = schemas.ExportRequestFilter(
        status=status,
        user_subject_id=user_subject_id
    )
    return crud.list_export_requests(db, filters=filters)


@app.patch("/export-requests/{request_id}/status", response_model=schemas.ExportRequestResponse)
def update_request_status(
    request_id: str,
    status_update: schemas.ExportRequestUpdate,
    db: Session = Depends(get_db)
):
    if not status_update.status:
        raise HTTPException(status_code=400, detail="Status is required")
    return crud.update_export_request_status(
        db=db,
        request_id=request_id,
        new_status=status_update.status,
        legal_notes=status_update.legal_notes
    )


@app.post("/approvals/", response_model=schemas.ApprovalResponse, status_code=status.HTTP_201_CREATED)
def create_approval(approval: schemas.ApprovalCreate, db: Session = Depends(get_db)):
    return crud.create_approval(db=db, approval=approval)


@app.post("/package-tasks/", response_model=schemas.PackageTaskResponse, status_code=status.HTTP_201_CREATED)
def create_package_task(task: schemas.PackageTaskCreate, db: Session = Depends(get_db)):
    return crud.create_or_get_package_task(db=db, task=task)


@app.patch("/package-tasks/{task_id}", response_model=schemas.PackageTaskResponse)
def update_package_task(
    task_id: str,
    update: schemas.PackageTaskUpdate,
    db: Session = Depends(get_db)
):
    return crud.update_package_task(db=db, task_id=task_id, update=update)


@app.post("/delivery-records/", response_model=schemas.DeliveryRecordResponse, status_code=status.HTTP_201_CREATED)
def create_delivery_record(delivery: schemas.DeliveryRecordCreate, db: Session = Depends(get_db)):
    return crud.create_delivery_record(db=db, delivery=delivery)


@app.get("/delivery-records/", response_model=List[schemas.DeliveryRecordResponse])
def list_delivery_records(request_id: str = None, db: Session = Depends(get_db)):
    return crud.get_delivery_records(db=db, request_id=request_id)


@app.get("/export-requests/{request_id}/export-audit")
def export_audit_trail(request_id: str, db: Session = Depends(get_db)):
    request = crud.get_export_request(db, request_id=request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Export request not found")
    
    scopes = db.query(models.ExportScope).join(models.ExportRequestScope).filter(
        models.ExportRequestScope.export_request_id == request.id
    ).all()
    
    approvals = db.query(models.Approval).filter(
        models.Approval.export_request_id == request.id
    ).all()
    
    package_task = db.query(models.PackageTask).filter(
        models.PackageTask.export_request_id == request.id
    ).first()
    
    delivery = db.query(models.DeliveryRecord).filter(
        models.DeliveryRecord.export_request_id == request.id
    ).first()
    
    return {
        "request": {
            "request_id": request.request_id,
            "status": request.status,
            "requested_at": request.requested_at,
            "requester_notes": request.requester_notes,
            "legal_notes": request.legal_notes
        },
        "user_subject": {
            "user_id": request.user_subject.user_id,
            "name": request.user_subject.name,
            "email": request.user_subject.email
        },
        "consent_version": {
            "version": request.consent_version.version,
            "consent_type": request.consent_version.consent_type,
            "agreed_at": request.consent_version.agreed_at
        },
        "export_scopes": [
            {"code": s.code, "name": s.name, "data_categories": s.data_categories}
            for s in scopes
        ],
        "approvals": [
            {
                "node_type": a.node_type,
                "approver_name": a.approver_name,
                "approved": a.approved,
                "approved_at": a.approved_at,
                "notes": a.notes
            }
            for a in approvals
        ],
        "package_task": {
            "task_id": package_task.task_id,
            "status": package_task.status,
            "package_url": package_task.package_url,
            "package_checksum": package_task.package_checksum,
            "started_at": package_task.started_at,
            "completed_at": package_task.completed_at
        } if package_task else None,
        "delivery_record": {
            "delivered_to": delivery.delivered_to,
            "delivery_method": delivery.delivery_method,
            "delivered_at": delivery.delivered_at,
            "tracking_number": delivery.tracking_number,
            "confirmed_receipt": delivery.confirmed_receipt
        } if delivery else None
    }
