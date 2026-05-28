from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LetterOfCredit, Document, Discrepancy, LcClause
from app.schemas import (
    LetterOfCredit as LCSchema,
    LetterOfCreditCreate as LCCreate,
    LetterOfCreditUpdate as LCUpdate,
    LetterOfCreditSummary as LCSummary,
    StatusTransitionRequest,
    ApiResponse,
)
from app.core import VersionManager, ClauseParser, DocumentComparer

router = APIRouter(prefix="/api/letters-of-credit", tags=["信用证管理"])


@router.get("", response_model=ApiResponse)
def get_letters_of_credit(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(LetterOfCredit)

    if status:
        query = query.filter(LetterOfCredit.status == status)

    if search:
        query = query.filter(
            (LetterOfCredit.lc_number.contains(search)) |
            (LetterOfCredit.applicant.contains(search)) |
            (LetterOfCredit.beneficiary.contains(search))
        )

    lcs = query.order_by(LetterOfCredit.created_at.desc()).offset(skip).limit(limit).all()

    summaries = []
    for lc in lcs:
        discrepancy_count = db.query(Discrepancy).filter(Discrepancy.lc_id == lc.id).count()
        open_discrepancy_count = db.query(Discrepancy).filter(
            Discrepancy.lc_id == lc.id,
            Discrepancy.status == "OPEN"
        ).count()

        summary = LCSummary(
            id=lc.id,
            lc_number=lc.lc_number,
            issuing_bank=lc.issuing_bank,
            applicant=lc.applicant,
            amount=lc.amount,
            currency=lc.currency,
            status=lc.status,
            latest_shipment_date=lc.latest_shipment_date,
            expiry_date=lc.expiry_date,
            discrepancy_count=discrepancy_count,
            open_discrepancy_count=open_discrepancy_count,
            created_at=lc.created_at,
        )
        summaries.append(summary)

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": query.count(), "items": summaries}
    )


@router.get("/{lc_id}", response_model=ApiResponse)
def get_letter_of_credit(lc_id: int, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    return ApiResponse(success=True, message="查询成功", data=LCSchema.model_validate(lc))


@router.post("", response_model=ApiResponse)
def create_letter_of_credit(lc_data: LCCreate, db: Session = Depends(get_db)):
    existing = db.query(LetterOfCredit).filter(LetterOfCredit.lc_number == lc_data.lc_number).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"信用证编号 {lc_data.lc_number} 已存在，请使用其他编号或更新现有信用证"
        )

    lc = LetterOfCredit(
        lc_number=lc_data.lc_number,
        issuing_bank=lc_data.issuing_bank,
        applicant=lc_data.applicant,
        beneficiary=lc_data.beneficiary,
        currency=lc_data.currency,
        amount=lc_data.amount,
        latest_shipment_date=lc_data.latest_shipment_date,
        expiry_date=lc_data.expiry_date,
        clauses_text=lc_data.clauses_text,
        status=lc_data.status,
        remarks=lc_data.remarks,
    )

    db.add(lc)
    db.flush()

    if lc_data.clauses:
        for clause_data in lc_data.clauses:
            clause = LcClause(
                lc_id=lc.id,
                clause_number=clause_data.clause_number,
                clause_type=clause_data.clause_type,
                content=clause_data.content,
                parsed_fields=clause_data.parsed_fields,
                remarks=clause_data.remarks,
            )
            db.add(clause)

    if lc_data.clauses_text:
        parser = ClauseParser()
        parsed_clauses = parser.parse(lc_data.clauses_text)
        for pc in parsed_clauses:
            existing_clause = db.query(LcClause).filter(
                LcClause.lc_id == lc.id,
                LcClause.clause_number == pc.clause_number
            ).first()
            if not existing_clause:
                clause = LcClause(
                    lc_id=lc.id,
                    clause_number=pc.clause_number,
                    clause_type=pc.clause_type,
                    content=pc.content,
                    parsed_fields=pc.parsed_fields,
                )
                db.add(clause)

    db.commit()
    db.refresh(lc)

    return ApiResponse(
        success=True,
        message=f"信用证 {lc.lc_number} 创建成功",
        data=LCSchema.model_validate(lc)
    )


@router.put("/{lc_id}", response_model=ApiResponse)
def update_letter_of_credit(lc_id: int, lc_data: LCUpdate, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    old_status = lc.status
    update_data = lc_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(lc, key):
            setattr(lc, key, value)

    if lc_data.status and lc_data.status != old_status:
        version_manager = VersionManager(db)
        version_manager.record_status_change(
            lc_id=lc_id,
            old_status=old_status,
            new_status=lc_data.status,
            remarks=lc_data.remarks,
            operator="system",
        )

    db.commit()
    db.refresh(lc)

    return ApiResponse(
        success=True,
        message=f"信用证 {lc.lc_number} 更新成功",
        data=LCSchema.model_validate(lc)
    )


@router.post("/{lc_id}/transition", response_model=ApiResponse)
def transition_status(lc_id: int, request: StatusTransitionRequest, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    valid_transitions = {
        "DRAFT": ["CHECKING"],
        "CHECKING": ["DISCREPANCY_FOUND", "READY_FOR_SUBMISSION"],
        "DISCREPANCY_FOUND": ["RESOLVING", "ACCEPTED"],
        "RESOLVING": ["CHECKING", "READY_FOR_SUBMISSION"],
        "READY_FOR_SUBMISSION": ["SUBMITTED"],
        "SUBMITTED": [],
    }

    if lc.status not in valid_transitions:
        raise HTTPException(status_code=400, detail=f"当前状态 {lc.status} 不支持状态转移")

    if request.new_status not in valid_transitions[lc.status]:
        raise HTTPException(
            status_code=400,
            detail=f"不支持从 {lc.status} 转移到 {request.new_status}。有效目标状态: {valid_transitions[lc.status]}"
        )

    old_status = lc.status
    lc.status = request.new_status

    version_manager = VersionManager(db)
    version_manager.record_status_change(
        lc_id=lc_id,
        old_status=old_status,
        new_status=request.new_status,
        remarks=request.remarks,
        operator=request.operator,
    )

    db.commit()
    db.refresh(lc)

    return ApiResponse(
        success=True,
        message=f"状态已从 {old_status} 变更为 {request.new_status}",
        data={"lc_id": lc_id, "old_status": old_status, "new_status": request.new_status}
    )


@router.post("/{lc_id}/check", response_model=ApiResponse)
def run_compliance_check(lc_id: int, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    documents = db.query(Document).filter(
        Document.lc_id == lc_id,
        Document.is_active == True
    ).all()

    if not documents:
        return ApiResponse(
            success=True,
            message="没有可检查的单据，请先上传单据",
            data={"discrepancies_found": 0, "documents_checked": 0}
        )

    clauses = db.query(LcClause).filter(LcClause.lc_id == lc_id).all()

    lc_data = {
        "id": lc.id,
        "lc_number": lc.lc_number,
        "latest_shipment_date": lc.latest_shipment_date,
        "expiry_date": lc.expiry_date,
        "amount": lc.amount,
        "currency": lc.currency,
        "beneficiary": lc.beneficiary,
        "applicant": lc.applicant,
        "goods_description": lc.clauses_text,
    }

    goods_clause = next((c for c in clauses if c.clause_type == "goods_description"), None)
    if goods_clause:
        lc_data["goods_description"] = goods_clause.content

    incoterms_clause = next((c for c in clauses if c.clause_type == "incoterms"), None)
    if incoterms_clause:
        lc_data["incoterms"] = incoterms_clause.content

    port_loading_clause = next((c for c in clauses if c.clause_type == "port_of_loading"), None)
    if port_loading_clause:
        lc_data["port_of_loading"] = port_loading_clause.content

    port_dest_clause = next((c for c in clauses if c.clause_type == "port_of_destination"), None)
    if port_dest_clause:
        lc_data["port_of_destination"] = port_dest_clause.content

    comparer = DocumentComparer()
    version_manager = VersionManager(db)

    doc_ids = [d.id for d in documents]
    created_discrepancies = []

    docs_data = []
    for doc in documents:
        doc_data = {
            "id": doc.id,
            "document_type": doc.document_type,
            "document_number": doc.document_number,
            "content": doc.content,
            "is_active": doc.is_active,
            "version": doc.version,
        }
        docs_data.append(doc_data)

    version_conflicts = comparer.check_version_conflict(docs_data)
    for conflict in version_conflicts:
        disc = Discrepancy(
            lc_id=lc_id,
            discrepancy_type=conflict.discrepancy_type,
            severity=conflict.severity,
            status="OPEN",
            description=conflict.description,
            reason=conflict.reason,
            impact_scope=conflict.impact_scope,
            next_action=conflict.next_action,
        )
        db.add(disc)
        db.flush()
        created_discrepancies.append(disc.id)

    for doc in documents:
        doc_data = {
            "id": doc.id,
            "document_type": doc.document_type,
            "document_number": doc.document_number,
            "content": doc.content,
        }

        lc_results = comparer.compare_document_with_lc(lc_data, doc_data, [c.__dict__ for c in clauses])

        for result in lc_results:
            if not result.match:
                existing = db.query(Discrepancy).filter(
                    Discrepancy.lc_id == lc_id,
                    Discrepancy.document_id == doc.id,
                    Discrepancy.discrepancy_type == result.discrepancy_type,
                    Discrepancy.status == "OPEN"
                ).first()

                if not existing:
                    disc = Discrepancy(
                        lc_id=lc_id,
                        document_id=doc.id,
                        discrepancy_type=result.discrepancy_type,
                        severity=result.severity,
                        status="OPEN",
                        description=result.description,
                        reason=result.reason,
                        impact_scope=result.impact_scope,
                        next_action=result.next_action,
                        clause_ref=result.field_name,
                        document_ref=f"{doc.document_type}/{doc.document_number}",
                    )
                    db.add(disc)
                    db.flush()
                    created_discrepancies.append(disc.id)

    cross_doc_results = comparer.compare_documents(docs_data)
    for result in cross_doc_results:
        if not result.match:
            existing = db.query(Discrepancy).filter(
                Discrepancy.lc_id == lc_id,
                Discrepancy.discrepancy_type == result.discrepancy_type,
                Discrepancy.status == "OPEN"
            ).first()

            if not existing:
                disc = Discrepancy(
                    lc_id=lc_id,
                    discrepancy_type=result.discrepancy_type,
                    severity=result.severity,
                    status="OPEN",
                    description=result.description,
                    reason=result.reason,
                    impact_scope=result.impact_scope,
                    next_action=result.next_action,
                    clause_ref=result.field_name,
                )
                db.add(disc)
                db.flush()
                created_discrepancies.append(disc.id)

    lc.status = "DISCREPANCY_FOUND" if created_discrepancies else "READY_FOR_SUBMISSION"

    db.commit()

    total_discrepancies = db.query(Discrepancy).filter(
        Discrepancy.lc_id == lc_id,
        Discrepancy.status == "OPEN"
    ).count()

    return ApiResponse(
        success=True,
        message=f"检查完成，发现 {len(created_discrepancies)} 个新不符点，当前共有 {total_discrepancies} 个待处理不符点",
        data={
            "lc_id": lc_id,
            "lc_status": lc.status,
            "documents_checked": len(documents),
            "new_discrepancies": len(created_discrepancies),
            "total_open_discrepancies": total_discrepancies,
            "created_discrepancy_ids": created_discrepancies,
        }
    )


@router.delete("/{lc_id}", response_model=ApiResponse)
def delete_letter_of_credit(lc_id: int, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    db.delete(lc)
    db.commit()

    return ApiResponse(success=True, message=f"信用证 {lc.lc_number} 已删除")
