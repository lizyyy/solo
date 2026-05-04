from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal

from app.database import get_db
from app.services import ClaimAnalysisService, ClaimEngine
from app.schemas.claim_calculation import ClaimAnalysisResponse

router = APIRouter()


@router.post("/incident/{incident_id}", response_model=ClaimAnalysisResponse)
async def analyze_incident(
    incident_id: int,
    estimated_loss: Optional[Decimal] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    try:
        service = ClaimAnalysisService(db)
        result = await service.analyze_and_save(incident_id, estimated_loss)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/incident/{incident_id}", response_model=ClaimAnalysisResponse)
async def get_analysis(
    incident_id: int,
    estimated_loss: Optional[Decimal] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    try:
        engine = ClaimEngine(db)
        result = await engine.analyze_incident(incident_id, estimated_loss)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
