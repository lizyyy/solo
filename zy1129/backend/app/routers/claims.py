from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date, datetime

from app.database import get_db
from app.models import Claim, ClaimStatusTimeline, ClaimDocument
from app.schemas import (
    ClaimCreate, ClaimUpdate, ClaimResponse, 
    ClaimStatusTimelineResponse,
    ClaimDocumentCreate, ClaimDocumentUpdate, ClaimDocumentResponse
)

router = APIRouter()


@router.get("/", response_model=List[ClaimResponse])
async def list_claims(
    incident_id: Optional[int] = Query(None),
    policy_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Claim).options(
        selectinload(Claim.policy),
        selectinload(Claim.coverage),
        selectinload(Claim.status_timeline),
        selectinload(Claim.documents)
    ).order_by(Claim.created_at.desc())
    
    conditions = []
    if incident_id is not None:
        conditions.append(Claim.incident_id == incident_id)
    if policy_id is not None:
        conditions.append(Claim.policy_id == policy_id)
    if status:
        conditions.append(Claim.status == status)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    result = await db.execute(query)
    claims = result.scalars().all()
    return claims


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Claim).options(
            selectinload(Claim.policy),
            selectinload(Claim.coverage),
            selectinload(Claim.status_timeline),
            selectinload(Claim.documents)
        ).where(Claim.id == claim_id)
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.post("/", response_model=ClaimResponse, status_code=201)
async def create_claim(claim: ClaimCreate, db: AsyncSession = Depends(get_db)):
    db_claim = Claim(**claim.model_dump())
    db.add(db_claim)
    await db.commit()
    await db.refresh(db_claim)
    
    timeline = ClaimStatusTimeline(
        claim_id=db_claim.id,
        status=db_claim.status,
        description="创建理赔申请",
        operator="system"
    )
    db.add(timeline)
    await db.commit()
    
    return db_claim


@router.put("/{claim_id}", response_model=ClaimResponse)
async def update_claim(
    claim_id: int, 
    claim: ClaimUpdate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    db_claim = result.scalar_one_or_none()
    if not db_claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    old_status = db_claim.status
    update_data = claim.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_claim, key, value)
    
    if "status" in update_data and update_data["status"] != old_status:
        timeline = ClaimStatusTimeline(
            claim_id=db_claim.id,
            status=update_data["status"],
            description=f"状态变更: {old_status} -> {update_data['status']}",
            operator="user"
        )
        db.add(timeline)
    
    await db.commit()
    await db.refresh(db_claim)
    return db_claim


@router.delete("/{claim_id}", status_code=204)
async def delete_claim(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    await db.delete(claim)
    await db.commit()


@router.get("/{claim_id}/timeline", response_model=List[ClaimStatusTimelineResponse])
async def get_claim_timeline(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClaimStatusTimeline)
        .where(ClaimStatusTimeline.claim_id == claim_id)
        .order_by(ClaimStatusTimeline.changed_at)
    )
    timeline = result.scalars().all()
    return timeline


@router.post("/{claim_id}/documents", response_model=ClaimDocumentResponse, status_code=201)
async def add_claim_document(
    claim_id: int, 
    document: ClaimDocumentCreate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    doc_data = document.model_dump()
    doc_data["claim_id"] = claim_id
    db_document = ClaimDocument(**doc_data)
    db.add(db_document)
    await db.commit()
    await db.refresh(db_document)
    return db_document


@router.get("/{claim_id}/documents", response_model=List[ClaimDocumentResponse])
async def get_claim_documents(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ClaimDocument).where(ClaimDocument.claim_id == claim_id)
    )
    documents = result.scalars().all()
    return documents


@router.put("/documents/{document_id}", response_model=ClaimDocumentResponse)
async def update_claim_document(
    document_id: int, 
    document: ClaimDocumentUpdate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ClaimDocument).where(ClaimDocument.id == document_id))
    db_document = result.scalar_one_or_none()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = document.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_document, key, value)
    
    await db.commit()
    await db.refresh(db_document)
    return db_document


@router.delete("/documents/{document_id}", status_code=204)
async def delete_claim_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ClaimDocument).where(ClaimDocument.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.delete(document)
    await db.commit()
