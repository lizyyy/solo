from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models import Incident
from app.schemas import IncidentCreate, IncidentUpdate, IncidentResponse

router = APIRouter()


@router.get("/", response_model=List[IncidentResponse])
async def list_incidents(
    member_id: Optional[int] = Query(None),
    incident_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Incident).options(selectinload(Incident.member)).order_by(Incident.incident_date.desc())
    
    conditions = []
    if member_id is not None:
        conditions.append(Incident.affected_member_id == member_id)
    if incident_type:
        conditions.append(Incident.incident_type == incident_type)
    if status:
        conditions.append(Incident.status == status)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    result = await db.execute(query)
    incidents = result.scalars().all()
    return incidents


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident).options(selectinload(Incident.member)).where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("/", response_model=IncidentResponse, status_code=201)
async def create_incident(incident: IncidentCreate, db: AsyncSession = Depends(get_db)):
    db_incident = Incident(**incident.model_dump())
    db.add(db_incident)
    await db.commit()
    await db.refresh(db_incident)
    return db_incident


@router.put("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int, 
    incident: IncidentUpdate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    db_incident = result.scalar_one_or_none()
    if not db_incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    update_data = incident.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_incident, key, value)
    
    await db.commit()
    await db.refresh(db_incident)
    return db_incident


@router.delete("/{incident_id}", status_code=204)
async def delete_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    await db.delete(incident)
    await db.commit()
