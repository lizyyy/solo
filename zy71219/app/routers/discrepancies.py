from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Discrepancy, LetterOfCredit, Document, LcClause
from app.schemas import (
    Discrepancy as DiscrepancySchema,
    DiscrepancyCreate,
    DiscrepancyUpdate,
    StatusTransitionRequest,
    VersionRecord,
    ApiResponse,
)
from app.core import VersionManager, DISCREPANCY_CATEGORIES

router = APIRouter(prefix="/api/discrepancies", tags=["不符点管理"])


@router.get("/categories", response_model=ApiResponse)
def get_discrepancy_categories():
    categories = []
    for code, info in DISCREPANCY_CATEGORIES.items():
        categories.append({
            "code": code,
            "name": info["name"],
            "severity": info["severity"],
            "impact": info["impact"],
            "next_action": info["next_action"],
        })

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": len(categories), "categories": categories}
    )


@router.get("", response_model=ApiResponse)
def get_discrepancies(
    lc_id: Optional[int] = None,
    document_id: Optional[int] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    discrepancy_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Discrepancy)

    if lc_id:
        query = query.filter(Discrepancy.lc_id == lc_id)

    if document_id:
        query = query.filter(Discrepancy.document_id == document_id)

    if status:
        query = query.filter(Discrepancy.status == status)

    if severity:
        query = query.filter(Discrepancy.severity == severity)

    if discrepancy_type:
        query = query.filter(Discrepancy.discrepancy_type == discrepancy_type)

    discrepancies = query.order_by(Discrepancy.created_at.desc()).offset(skip).limit(limit).all()

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": query.count(), "items": [DiscrepancySchema.model_validate(d) for d in discrepancies]}
    )


@router.get("/{discrepancy_id}", response_model=ApiResponse)
def get_discrepancy(discrepancy_id: int, db: Session = Depends(get_db)):
    disc = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail=f"不符点 {discrepancy_id} 不存在")

    return ApiResponse(success=True, message="查询成功", data=DiscrepancySchema.model_validate(disc))


@router.get("/{discrepancy_id}/history", response_model=ApiResponse)
def get_discrepancy_history(discrepancy_id: int, db: Session = Depends(get_db)):
    disc = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail=f"不符点 {discrepancy_id} 不存在")

    version_manager = VersionManager(db)
    history = version_manager.get_version_history("DISCREPANCY", discrepancy_id)

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"history": [VersionRecord.model_validate(h) for h in history]}
    )


@router.post("", response_model=ApiResponse)
def create_discrepancy(disc_data: DiscrepancyCreate, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == disc_data.lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {disc_data.lc_id} 不存在")

    if disc_data.document_id:
        doc = db.query(Document).filter(Document.id == disc_data.document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail=f"单据 {disc_data.document_id} 不存在")

    if disc_data.clause_id:
        clause = db.query(LcClause).filter(LcClause.id == disc_data.clause_id).first()
        if not clause:
            raise HTTPException(status_code=404, detail=f"条款 {disc_data.clause_id} 不存在")

    disc = Discrepancy(
        lc_id=disc_data.lc_id,
        document_id=disc_data.document_id,
        clause_id=disc_data.clause_id,
        discrepancy_type=disc_data.discrepancy_type,
        severity=disc_data.severity,
        status=disc_data.status,
        description=disc_data.description,
        reason=disc_data.reason,
        impact_scope=disc_data.impact_scope,
        next_action=disc_data.next_action,
        clause_ref=disc_data.clause_ref,
        document_ref=disc_data.document_ref,
        correction_note=disc_data.correction_note,
        corrected_by=disc_data.corrected_by,
    )

    db.add(disc)
    db.commit()
    db.refresh(disc)

    return ApiResponse(
        success=True,
        message="不符点创建成功",
        data=DiscrepancySchema.model_validate(disc)
    )


@router.put("/{discrepancy_id}", response_model=ApiResponse)
def update_discrepancy(
    discrepancy_id: int,
    disc_data: DiscrepancyUpdate,
    change_reason: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    disc = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail=f"不符点 {discrepancy_id} 不存在")

    old_data = {
        "status": disc.status,
        "severity": disc.severity,
        "reason": disc.reason,
        "impact_scope": disc.impact_scope,
        "next_action": disc.next_action,
        "correction_note": disc.correction_note,
    }

    update_data = disc_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(disc, key):
            setattr(disc, key, value)

    if "status" in update_data and update_data["status"] in ["RESOLVED", "CLOSED"]:
        disc.corrected_at = datetime.utcnow()

    version_manager = VersionManager(db)
    version_manager.record_discrepancy_change(
        discrepancy=disc,
        old_data=old_data,
        new_data=update_data,
        action="UPDATE",
        change_reason=change_reason,
        operator=operator,
    )

    db.commit()
    db.refresh(disc)

    return ApiResponse(
        success=True,
        message="不符点更新成功",
        data=DiscrepancySchema.model_validate(disc)
    )


@router.post("/{discrepancy_id}/resolve", response_model=ApiResponse)
def resolve_discrepancy(
    discrepancy_id: int,
    request: StatusTransitionRequest,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    disc = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail=f"不符点 {discrepancy_id} 不存在")

    if disc.status == "RESOLVED":
        return ApiResponse(success=True, message="该不符点已解决", data=DiscrepancySchema.model_validate(disc))

    old_status = disc.status
    old_data = {"status": old_status, "correction_note": disc.correction_note}

    disc.status = request.new_status if request.new_status else "RESOLVED"
    disc.correction_note = request.remarks
    disc.corrected_by = operator
    disc.corrected_at = datetime.utcnow()

    new_data = {"status": disc.status, "correction_note": disc.correction_note}

    version_manager = VersionManager(db)
    version_manager.record_discrepancy_change(
        discrepancy=disc,
        old_data=old_data,
        new_data=new_data,
        action="CORRECTION",
        change_reason=request.remarks,
        operator=operator,
    )

    db.commit()
    db.refresh(disc)

    return ApiResponse(
        success=True,
        message=f"不符点状态已从 {old_status} 变更为 {disc.status}",
        data=DiscrepancySchema.model_validate(disc)
    )


@router.post("/{discrepancy_id}/accept", response_model=ApiResponse)
def accept_discrepancy(
    discrepancy_id: int,
    remarks: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    disc = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail=f"不符点 {discrepancy_id} 不存在")

    old_status = disc.status
    old_data = {"status": old_status, "correction_note": disc.correction_note}

    disc.status = "ACCEPTED"
    disc.correction_note = remarks
    disc.corrected_by = operator
    disc.corrected_at = datetime.utcnow()

    new_data = {"status": "ACCEPTED", "correction_note": remarks}

    version_manager = VersionManager(db)
    version_manager.record_discrepancy_change(
        discrepancy=disc,
        old_data=old_data,
        new_data=new_data,
        action="ACCEPT",
        change_reason=remarks,
        operator=operator,
    )

    db.commit()
    db.refresh(disc)

    return ApiResponse(
        success=True,
        message=f"不符点已标记为接受（申请人接受不符点）",
        data=DiscrepancySchema.model_validate(disc)
    )


@router.delete("/{discrepancy_id}", response_model=ApiResponse)
def delete_discrepancy(discrepancy_id: int, db: Session = Depends(get_db)):
    disc = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
    if not disc:
        raise HTTPException(status_code=404, detail=f"不符点 {discrepancy_id} 不存在")

    db.delete(disc)
    db.commit()

    return ApiResponse(success=True, message="不符点已删除")
