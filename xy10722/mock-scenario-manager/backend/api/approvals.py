from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Approval, Timeline, Scenario
from schemas import ApprovalCreate, ApprovalResponse

router = APIRouter()

@router.get("/scenario/{scenario_id}", response_model=List[ApprovalResponse])
def get_approvals_by_scenario(scenario_id: int, db: Session = Depends(get_db)):
    approvals = db.query(Approval).filter(Approval.scenario_id == scenario_id).all()
    return approvals

@router.post("/", response_model=ApprovalResponse)
def create_approval(approval: ApprovalCreate, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == approval.scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    db_approval = Approval(**approval.model_dump())
    db.add(db_approval)
    db.commit()
    db.refresh(db_approval)
    
    timeline = Timeline(
        scenario_id=approval.scenario_id,
        action=f"approval_{approval.action}",
        actor=approval.approver,
        details={
            "action": approval.action,
            "comment": approval.comment,
            "approval_id": db_approval.id
        }
    )
    db.add(timeline)
    db.commit()
    
    return db_approval

@router.post("/{scenario_id}/submit_for_review")
def submit_for_review(scenario_id: int, approver: str = "admin", comment: str = "", db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    scenario.status = "pending_review"
    db.commit()
    
    approval = Approval(
        scenario_id=scenario_id,
        approver=approver,
        action="submit_review",
        comment=comment,
        old_params=None,
        new_params=scenario.scenario_params,
        old_response=None,
        new_response=scenario.response_template
    )
    db.add(approval)
    db.commit()
    
    timeline = Timeline(
        scenario_id=scenario_id,
        action="submitted_for_review",
        actor=approver,
        details={"comment": comment}
    )
    db.add(timeline)
    db.commit()
    
    return {"message": "Scenario submitted for review", "status": "pending_review"}

@router.post("/{scenario_id}/approve")
def approve_scenario(scenario_id: int, approver: str = "admin", comment: str = "", db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    scenario.status = "active"
    db.commit()
    
    approval = Approval(
        scenario_id=scenario_id,
        approver=approver,
        action="approve",
        comment=comment
    )
    db.add(approval)
    db.commit()
    
    timeline = Timeline(
        scenario_id=scenario_id,
        action="approved",
        actor=approver,
        details={"comment": comment}
    )
    db.add(timeline)
    db.commit()
    
    return {"message": "Scenario approved", "status": "active"}

@router.post("/{scenario_id}/reject")
def reject_scenario(scenario_id: int, approver: str = "admin", comment: str = "", db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    scenario.status = "rejected"
    db.commit()
    
    approval = Approval(
        scenario_id=scenario_id,
        approver=approver,
        action="reject",
        comment=comment
    )
    db.add(approval)
    db.commit()
    
    timeline = Timeline(
        scenario_id=scenario_id,
        action="rejected",
        actor=approver,
        details={"comment": comment}
    )
    db.add(timeline)
    db.commit()
    
    return {"message": "Scenario rejected", "status": "rejected"}

@router.post("/{scenario_id}/block")
def block_scenario(scenario_id: int, approver: str = "admin", comment: str = "", db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    scenario.status = "blocked"
    db.commit()
    
    approval = Approval(
        scenario_id=scenario_id,
        approver=approver,
        action="block",
        comment=comment
    )
    db.add(approval)
    db.commit()
    
    timeline = Timeline(
        scenario_id=scenario_id,
        action="blocked",
        actor=approver,
        details={"comment": comment}
    )
    db.add(timeline)
    db.commit()
    
    return {"message": "Scenario blocked", "status": "blocked"}

@router.post("/{scenario_id}/compensate")
def compensate_scenario(scenario_id: int, approver: str = "admin", comment: str = "", db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    scenario.status = "compensated"
    db.commit()
    
    approval = Approval(
        scenario_id=scenario_id,
        approver=approver,
        action="compensate",
        comment=comment
    )
    db.add(approval)
    db.commit()
    
    timeline = Timeline(
        scenario_id=scenario_id,
        action="compensated",
        actor=approver,
        details={"comment": comment}
    )
    db.add(timeline)
    db.commit()
    
    return {"message": "Scenario compensated", "status": "compensated"}

@router.post("/{scenario_id}/retry")
def retry_scenario(scenario_id: int, approver: str = "admin", comment: str = "", db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    scenario.status = "active"
    db.commit()
    
    approval = Approval(
        scenario_id=scenario_id,
        approver=approver,
        action="retry",
        comment=comment
    )
    db.add(approval)
    db.commit()
    
    timeline = Timeline(
        scenario_id=scenario_id,
        action="retried",
        actor=approver,
        details={"comment": comment}
    )
    db.add(timeline)
    db.commit()
    
    return {"message": "Scenario marked for retry", "status": "active"}