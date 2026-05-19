from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
import json
import os
import uuid
from typing import Optional

from database import get_db, init_db, ImageProvenance
from schemas import (
    ImageProvenanceCreate,
    ImageProvenanceUpdate,
    ImageProvenanceResponse,
    ExceptionRequest,
    ExceptionApproval,
    PaginatedResponse,
    ErrorResponse,
)

app = FastAPI(
    title="镜像来源证明签名核对API",
    description="用于管理和验证容器镜像来源证明的后端服务",
    version="1.0.0",
)


@app.on_event("startup")
async def startup_event():
    init_db()
    os.makedirs("bundles", exist_ok=True)


class ProvenanceException(HTTPException):
    def __init__(self, status_code: int, error_code: str, message: str, details: dict = None):
        self.error_code = error_code
        self.details = details
        super().__init__(status_code=status_code, detail=message)


@app.exception_handler(ProvenanceException)
async def provenance_exception_handler(request, exc: ProvenanceException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.detail,
            "details": exc.details,
        },
    )


@app.post(
    "/api/v1/provenance",
    response_model=ImageProvenanceResponse,
    responses={
        400: {"model": ErrorResponse, "description": "字段缺失或格式错误"},
        409: {"model": ErrorResponse, "description": "重复提交"},
    },
)
async def create_provenance(
    provenance_data: ImageProvenanceCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(ImageProvenance).filter(
        and_(
            ImageProvenance.image_tag == provenance_data.image_tag,
            ImageProvenance.commit_hash == provenance_data.commit_hash,
            ImageProvenance.pipeline_id == provenance_data.pipeline_id,
        )
    ).first()
    
    if existing:
        raise ProvenanceException(
            status_code=409,
            error_code="DUPLICATE_SUBMISSION",
            message="该镜像来源记录已存在",
            details={"image_tag": provenance_data.image_tag, "id": existing.id},
        )

    db_provenance = ImageProvenance(
        **provenance_data.dict(exclude_unset=True),
        status="pending",
    )
    
    if provenance_data.signature:
        db_provenance.status = "signature_received"
    
    db.add(db_provenance)
    db.commit()
    db.refresh(db_provenance)
    return db_provenance


@app.get("/api/v1/provenance", response_model=PaginatedResponse)
async def list_provenance(
    image_tag: Optional[str] = Query(None, description="按镜像标签筛选"),
    pipeline_id: Optional[str] = Query(None, description="按流水线ID筛选"),
    commit_hash: Optional[str] = Query(None, description="按提交哈希筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    signature_verified: Optional[bool] = Query(None, description="按签名验证状态筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(ImageProvenance)
    
    if image_tag:
        query = query.filter(ImageProvenance.image_tag.contains(image_tag))
    if pipeline_id:
        query = query.filter(ImageProvenance.pipeline_id == pipeline_id)
    if commit_hash:
        query = query.filter(ImageProvenance.commit_hash == commit_hash)
    if status:
        query = query.filter(ImageProvenance.status == status)
    if signature_verified is not None:
        query = query.filter(ImageProvenance.signature_verified == signature_verified)
    
    total = query.count()
    items = query.order_by(ImageProvenance.created_at.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@app.get(
    "/api/v1/provenance/{provenance_id}",
    response_model=ImageProvenanceResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_provenance(provenance_id: int, db: Session = Depends(get_db)):
    provenance = db.query(ImageProvenance).filter(ImageProvenance.id == provenance_id).first()
    if not provenance:
        raise ProvenanceException(
            status_code=404,
            error_code="NOT_FOUND",
            message="镜像来源记录不存在",
        )
    return provenance


@app.put(
    "/api/v1/provenance/{provenance_id}/verify",
    response_model=ImageProvenanceResponse,
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse, "description": "状态不允许或需要人工复核"},
    },
)
async def verify_signature(provenance_id: int, db: Session = Depends(get_db)):
    provenance = db.query(ImageProvenance).filter(ImageProvenance.id == provenance_id).first()
    if not provenance:
        raise ProvenanceException(
            status_code=404,
            error_code="NOT_FOUND",
            message="镜像来源记录不存在",
        )
    
    if provenance.status in ["verified", "exception_approved"]:
        raise ProvenanceException(
            status_code=400,
            error_code="INVALID_STATUS",
            message="当前状态不允许重复验证",
            details={"current_status": provenance.status},
        )
    
    if not provenance.signature:
        raise ProvenanceException(
            status_code=400,
            error_code="SIGNATURE_MISSING",
            message="需要人工复核：该记录缺少签名信息",
            details={"requires_manual_review": True},
        )
    
    if not provenance.signer:
        raise ProvenanceException(
            status_code=400,
            error_code="SIGNER_MISSING",
            message="需要人工复核：签名者信息缺失",
            details={"requires_manual_review": True},
        )
    
    provenance.signature_verified = True
    provenance.verification_time = datetime.utcnow()
    provenance.status = "verified"
    db.commit()
    db.refresh(provenance)
    return provenance


@app.post(
    "/api/v1/provenance/{provenance_id}/exception",
    response_model=ImageProvenanceResponse,
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse, "description": "状态不允许"},
    },
)
async def request_exception(
    provenance_id: int,
    request: ExceptionRequest,
    db: Session = Depends(get_db),
):
    provenance = db.query(ImageProvenance).filter(ImageProvenance.id == provenance_id).first()
    if not provenance:
        raise ProvenanceException(
            status_code=404,
            error_code="NOT_FOUND",
            message="镜像来源记录不存在",
        )
    
    if provenance.exception_requested:
        raise ProvenanceException(
            status_code=400,
            error_code="ALREADY_REQUESTED",
            message="例外申请已提交，请勿重复申请",
        )
    
    provenance.exception_requested = True
    provenance.exception_reason = request.reason
    provenance.status = "exception_pending"
    db.commit()
    db.refresh(provenance)
    return provenance


@app.post(
    "/api/v1/provenance/{provenance_id}/exception/approve",
    response_model=ImageProvenanceResponse,
    responses={
        404: {"model": ErrorResponse},
        400: {"model": ErrorResponse, "description": "状态不允许"},
    },
)
async def approve_exception(
    provenance_id: int,
    approval: ExceptionApproval,
    db: Session = Depends(get_db),
):
    provenance = db.query(ImageProvenance).filter(ImageProvenance.id == provenance_id).first()
    if not provenance:
        raise ProvenanceException(
            status_code=404,
            error_code="NOT_FOUND",
            message="镜像来源记录不存在",
        )
    
    if not provenance.exception_requested:
        raise ProvenanceException(
            status_code=400,
            error_code="NO_EXCEPTION_REQUEST",
            message="该记录未提交例外申请",
        )
    
    if provenance.exception_approver:
        raise ProvenanceException(
            status_code=400,
            error_code="ALREADY_PROCESSED",
            message="例外申请已处理过",
        )
    
    provenance.exception_approved = approval.approved
    provenance.exception_approver = approval.approver
    provenance.exception_time = datetime.utcnow()
    
    if approval.approved:
        provenance.status = "exception_approved"
    else:
        provenance.status = "exception_rejected"
    
    db.commit()
    db.refresh(provenance)
    return provenance


@app.get(
    "/api/v1/provenance/{provenance_id}/bundle",
    responses={
        200: {"content": {"application/json": {}}},
        404: {"model": ErrorResponse},
    },
)
async def export_provenance_bundle(provenance_id: int, db: Session = Depends(get_db)):
    provenance = db.query(ImageProvenance).filter(ImageProvenance.id == provenance_id).first()
    if not provenance:
        raise ProvenanceException(
            status_code=404,
            error_code="NOT_FOUND",
            message="镜像来源记录不存在",
        )
    
    os.makedirs("bundles", exist_ok=True)
    
    bundle = {
        "bundle_id": str(uuid.uuid4()),
        "generated_at": datetime.utcnow().isoformat(),
        "image": {
            "tag": provenance.image_tag,
            "digest": provenance.image_digest,
        },
        "pipeline": {
            "id": provenance.pipeline_id,
            "name": provenance.pipeline_name,
            "url": provenance.pipeline_url,
        },
        "source_code": {
            "commit_hash": provenance.commit_hash,
            "branch": provenance.commit_branch,
            "message": provenance.commit_message,
            "author": provenance.commit_author,
            "url": provenance.commit_url,
        },
        "signature": {
            "signer": provenance.signer,
            "signature": provenance.signature,
            "algorithm": provenance.signature_algorithm,
            "verified": provenance.signature_verified,
            "verified_at": provenance.verification_time.isoformat() if provenance.verification_time else None,
        },
        "exception": {
            "requested": provenance.exception_requested,
            "approved": provenance.exception_approved,
            "approver": provenance.exception_approver,
            "reason": provenance.exception_reason,
            "approved_at": provenance.exception_time.isoformat() if provenance.exception_time else None,
        },
        "status": provenance.status,
    }
    
    bundle_path = f"bundles/provenance_{provenance_id}_{bundle['bundle_id'][:8]}.json"
    with open(bundle_path, "w") as f:
        json.dump(bundle, f, indent=2, ensure_ascii=False)
    
    provenance.provenance_bundle_path = bundle_path
    db.commit()
    
    return Response(
        content=json.dumps(bundle, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=provenance_bundle_{provenance_id}.json"
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
