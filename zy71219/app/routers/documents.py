from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Document, LetterOfCredit, Attachment, Discrepancy, LcClause
from app.schemas import (
    Document as DocumentSchema,
    DocumentCreate,
    DocumentUpdate,
    DocumentCompareRequest,
    DocumentCompareResult,
    CompareResultItem,
    VersionRecord,
    ApiResponse,
)
from app.core import VersionManager, DocumentComparer, ClauseParser

router = APIRouter(prefix="/api/documents", tags=["单据管理"])


@router.get("", response_model=ApiResponse)
def get_documents(
    lc_id: Optional[int] = None,
    document_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Document)

    if lc_id:
        query = query.filter(Document.lc_id == lc_id)

    if document_type:
        query = query.filter(Document.document_type == document_type)

    if is_active is not None:
        query = query.filter(Document.is_active == is_active)

    documents = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": query.count(), "items": [DocumentSchema.model_validate(d) for d in documents]}
    )


@router.get("/{document_id}", response_model=ApiResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"单据 {document_id} 不存在")

    return ApiResponse(success=True, message="查询成功", data=DocumentSchema.model_validate(doc))


@router.get("/{document_id}/versions", response_model=ApiResponse)
def get_document_versions(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"单据 {document_id} 不存在")

    all_versions = db.query(Document).filter(
        Document.lc_id == doc.lc_id,
        Document.document_type == doc.document_type,
        Document.document_number == doc.document_number,
    ).order_by(Document.version.desc()).all()

    version_manager = VersionManager(db)
    history = version_manager.get_version_history("DOCUMENT", document_id)

    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "all_versions": [DocumentSchema.model_validate(v) for v in all_versions],
            "change_history": [VersionRecord.model_validate(h) for h in history],
        }
    )


@router.post("", response_model=ApiResponse)
def create_document(doc_data: DocumentCreate, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == doc_data.lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {doc_data.lc_id} 不存在")

    version_manager = VersionManager(db)

    duplicate = version_manager.check_duplicate_document(
        lc_id=doc_data.lc_id,
        document_type=doc_data.document_type,
        document_number=doc_data.document_number,
    )

    if duplicate:
        return ApiResponse(
            success=False,
            message=f"该信用证下已存在相同编号的{doc_data.document_type}单据: {doc_data.document_number}",
            errors=[
                f"单据编号 {doc_data.document_number} 已存在于信用证 {lc.lc_number}",
                f"现有单据ID: {duplicate.id}, 版本: v{duplicate.version}",
                "如需上传新版本，请使用更新接口或先作废现有单据"
            ],
            data={
                "existing_document_id": duplicate.id,
                "existing_version": duplicate.version,
                "action_required": "请使用 PUT /api/documents/{id} 更新，或设置 is_active=false 后再创建"
            }
        )

    doc = Document(
        lc_id=doc_data.lc_id,
        document_type=doc_data.document_type,
        document_number=doc_data.document_number,
        version=1,
        is_active=True,
        content=doc_data.content,
        raw_text=doc_data.raw_text,
        remarks=doc_data.remarks,
        submitted_by=doc_data.submitted_by,
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    return ApiResponse(
        success=True,
        message=f"{doc_data.document_type} 单据创建成功，版本 v1",
        data=DocumentSchema.model_validate(doc)
    )


@router.post("/force-create", response_model=ApiResponse)
def force_create_document(
    doc_data: DocumentCreate,
    change_reason: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == doc_data.lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {doc_data.lc_id} 不存在")

    version_manager = VersionManager(db)

    old_docs = version_manager.deactivate_old_versions(
        lc_id=doc_data.lc_id,
        document_type=doc_data.document_type,
        document_number=doc_data.document_number,
    )

    max_version = max([d.version for d in old_docs]) if old_docs else 0

    doc = Document(
        lc_id=doc_data.lc_id,
        document_type=doc_data.document_type,
        document_number=doc_data.document_number,
        version=max_version + 1,
        is_active=True,
        content=doc_data.content,
        raw_text=doc_data.raw_text,
        remarks=doc_data.remarks,
        submitted_by=doc_data.submitted_by,
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    return ApiResponse(
        success=True,
        message=f"已作废 {len(old_docs)} 个旧版本，创建新版本 v{doc.version}",
        data={
            "new_document": DocumentSchema.model_validate(doc),
            "deactivated_versions": [{"id": d.id, "version": d.version} for d in old_docs],
        }
    )


@router.put("/{document_id}", response_model=ApiResponse)
def update_document(
    document_id: int,
    doc_data: DocumentUpdate,
    change_reason: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"单据 {document_id} 不存在")

    if not doc.is_active:
        return ApiResponse(
            success=False,
            message="该单据版本已作废，不能直接更新",
            errors=[f"单据 {document_id} (v{doc.version}) 已被标记为不活动"],
            data={
                "action_required": "请使用 POST /api/documents/force-create 创建新版本",
                "current_version": doc.version,
                "current_status": "inactive"
            }
        )

    version_manager = VersionManager(db)
    new_doc = version_manager.create_new_version(
        doc=doc,
        update_data=doc_data,
        change_reason=change_reason,
        operator=operator,
    )

    db.commit()
    db.refresh(new_doc)
    db.refresh(doc)

    return ApiResponse(
        success=True,
        message=f"已创建新版本 v{new_doc.version}，旧版本 v{doc.version} 已标记为不活动",
        data={
            "new_version": DocumentSchema.model_validate(new_doc),
            "old_version": DocumentSchema.model_validate(doc),
        }
    )


@router.post("/compare", response_model=ApiResponse)
def compare_document(request: DocumentCompareRequest, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == request.lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {request.lc_id} 不存在")

    if request.document_id:
        document = db.query(Document).filter(Document.id == request.document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail=f"单据 {request.document_id} 不存在")
    elif request.document_type:
        document = db.query(Document).filter(
            Document.lc_id == request.lc_id,
            Document.document_type == request.document_type,
            Document.is_active == True
        ).first()
        if not document:
            raise HTTPException(status_code=404, detail=f"信用证下没有有效的 {request.document_type} 单据")
    else:
        raise HTTPException(status_code=400, detail="请提供 document_id 或 document_type")

    clauses = db.query(LcClause).filter(LcClause.lc_id == request.lc_id).all()

    lc_data = {
        "latest_shipment_date": lc.latest_shipment_date,
        "expiry_date": lc.expiry_date,
        "amount": lc.amount,
        "currency": lc.currency,
        "beneficiary": lc.beneficiary,
        "applicant": lc.applicant,
    }

    goods_clause = next((c for c in clauses if c.clause_type == "goods_description"), None)
    if goods_clause:
        lc_data["goods_description"] = goods_clause.content

    comparer = DocumentComparer()
    doc_data = {
        "id": document.id,
        "document_type": document.document_type,
        "document_number": document.document_number,
        "content": document.content,
    }

    results = comparer.compare_document_with_lc(lc_data, doc_data, [c.__dict__ for c in clauses])

    matched_count = sum(1 for r in results if r.match)
    discrepancy_count = sum(1 for r in results if not r.match)

    created_ids = []
    for result in results:
        if not result.match:
            disc = Discrepancy(
                lc_id=request.lc_id,
                document_id=document.id,
                discrepancy_type=result.discrepancy_type,
                severity=result.severity,
                status="OPEN",
                description=result.description,
                reason=result.reason,
                impact_scope=result.impact_scope,
                next_action=result.next_action,
                clause_ref=result.field_name,
                document_ref=f"{document.document_type}/{document.document_number}",
            )
            db.add(disc)
            db.flush()
            created_ids.append(disc.id)

    db.commit()

    compare_result = DocumentCompareResult(
        lc_id=request.lc_id,
        document_id=document.id,
        document_type=document.document_type,
        document_number=document.document_number,
        total_checks=len(results),
        matched_count=matched_count,
        discrepancy_count=discrepancy_count,
        results=results,
        discrepancies_created=created_ids,
    )

    return ApiResponse(
        success=True,
        message=f"比对完成：{matched_count} 项匹配，{discrepancy_count} 项不符",
        data=compare_result
    )


@router.post("/{document_id}/deactivate", response_model=ApiResponse)
def deactivate_document(
    document_id: int,
    reason: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"单据 {document_id} 不存在")

    if not doc.is_active:
        return ApiResponse(success=True, message=f"单据 {document_id} 已经是不活动状态")

    doc.is_active = False

    version_manager = VersionManager(db)
    version_manager.record_discrepancy_change(
        discrepancy=Discrepancy(id=document_id),
        old_data={"is_active": True},
        new_data={"is_active": False},
        action="DEACTIVATE",
        change_reason=reason or "手动标记为不活动",
        operator=operator,
    )

    db.commit()
    db.refresh(doc)

    return ApiResponse(
        success=True,
        message=f"单据 {doc.document_number} v{doc.version} 已标记为不活动",
        data=DocumentSchema.model_validate(doc)
    )


@router.post("/{document_id}/attach", response_model=ApiResponse)
async def attach_file(
    document_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    uploaded_by: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"单据 {document_id} 不存在")

    import os
    import uuid

    os.makedirs("uploads", exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
    file_path = f"uploads/{uuid.uuid4()}{file_ext}"

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    attachment = Attachment(
        related_type="DOCUMENT",
        related_id=document_id,
        file_name=file.filename or "unnamed",
        file_path=file_path,
        file_type=file.content_type,
        description=description,
        uploaded_by=uploaded_by,
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return ApiResponse(
        success=True,
        message=f"附件 {file.filename} 已上传",
        data={"attachment_id": attachment.id, "file_path": file_path}
    )
