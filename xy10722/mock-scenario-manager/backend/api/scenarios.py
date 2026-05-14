from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
import json
from database import get_db
from models import Scenario, Timeline
from schemas import (
    ScenarioCreate,
    ScenarioUpdate,
    ScenarioResponse,
    ScenarioDetailResponse,
    ShareTokenResponse,
)

router = APIRouter()

@router.get("/", response_model=List[ScenarioResponse])
def get_scenarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    scenarios = db.query(Scenario).offset(skip).limit(limit).all()
    return scenarios

@router.get("/{scenario_id}", response_model=ScenarioDetailResponse)
def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario

@router.get("/share/{share_token}", response_model=ScenarioDetailResponse)
def get_scenario_by_share_token(share_token: str, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.share_token == share_token).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario

@router.post("/", response_model=ScenarioResponse)
def create_scenario(scenario: ScenarioCreate, db: Session = Depends(get_db)):
    db_scenario = Scenario(**scenario.model_dump())
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    
    timeline = Timeline(
        scenario_id=db_scenario.id,
        action="created",
        actor="system",
        details={"scenario_data": scenario.model_dump()}
    )
    db.add(timeline)
    db.commit()
    
    return db_scenario

@router.put("/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(scenario_id: int, scenario_update: ScenarioUpdate, db: Session = Depends(get_db)):
    db_scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    old_data = {
        "scenario_params": db_scenario.scenario_params,
        "response_template": db_scenario.response_template,
        "delay_ms": db_scenario.delay_ms,
    }
    
    for field, value in scenario_update.model_dump(exclude_unset=True).items():
        setattr(db_scenario, field, value)
    
    db.commit()
    db.refresh(db_scenario)
    
    new_data = {
        "scenario_params": db_scenario.scenario_params,
        "response_template": db_scenario.response_template,
        "delay_ms": db_scenario.delay_ms,
    }
    
    timeline = Timeline(
        scenario_id=db_scenario.id,
        action="updated",
        actor="system",
        details={"old": old_data, "new": new_data}
    )
    db.add(timeline)
    db.commit()
    
    return db_scenario

@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    db_scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    timeline = Timeline(
        scenario_id=db_scenario.id,
        action="deleted",
        actor="system",
        details={"scenario_name": db_scenario.name}
    )
    db.add(timeline)
    
    db.delete(db_scenario)
    db.commit()
    
    return {"message": "Scenario deleted successfully"}

@router.post("/{scenario_id}/share", response_model=ShareTokenResponse)
def generate_share_token(scenario_id: int, db: Session = Depends(get_db)):
    db_scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    if not db_scenario.share_token:
        db_scenario.share_token = str(uuid.uuid4())[:12]
        db.commit()
        db.refresh(db_scenario)
        
        timeline = Timeline(
            scenario_id=db_scenario.id,
            action="share_token_generated",
            actor="system",
            details={"share_token": db_scenario.share_token}
        )
        db.add(timeline)
        db.commit()
    
    return {
        "share_token": db_scenario.share_token,
        "share_url": f"/share/{db_scenario.share_token}"
    }

@router.get("/{scenario_id}/export")
def export_scenario(scenario_id: int, db: Session = Depends(get_db)):
    db_scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    export_data = {
        "scenario": {
            "id": db_scenario.id,
            "name": db_scenario.name,
            "description": db_scenario.description,
            "path": db_scenario.path,
            "method": db_scenario.method,
            "status": db_scenario.status,
            "delay_ms": db_scenario.delay_ms,
            "response_template": db_scenario.response_template,
            "scenario_params": db_scenario.scenario_params,
            "created_at": db_scenario.created_at.isoformat(),
            "updated_at": db_scenario.updated_at.isoformat(),
        },
        "approvals": [
            {
                "id": a.id,
                "approver": a.approver,
                "action": a.action,
                "comment": a.comment,
                "created_at": a.created_at.isoformat(),
            }
            for a in db_scenario.approvals
        ],
        "timeline": [
            {
                "id": t.id,
                "action": t.action,
                "actor": t.actor,
                "details": t.details,
                "created_at": t.created_at.isoformat(),
            }
            for t in db_scenario.timeline
        ],
    }
    
    return export_data