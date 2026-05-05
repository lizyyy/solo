from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Project, LoadTestBatch, OptimizationAction
from app.schemas import (
    OptimizationAction as OptimizationActionSchema,
    OptimizationActionCreate,
    OptimizationActionUpdate,
    OptimizationActionList,
    OptimizationActionDetail,
    StatusTransitionRequest,
    ActionStatistics,
    OptimizationStatusEnum,
)

router = APIRouter(prefix="/optimization-actions", tags=["Optimization Actions"])


@router.post("/", response_model=OptimizationActionSchema, status_code=201)
def create_optimization_action(
    action: OptimizationActionCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == action.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if action.related_batch_id:
        batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.id == action.related_batch_id
        ).first()
        if not batch:
            raise HTTPException(status_code=404, detail="关联的压测批次不存在")
    
    if action.verification_batch_id:
        verify_batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.id == action.verification_batch_id
        ).first()
        if not verify_batch:
            raise HTTPException(status_code=404, detail="验证批次不存在")
    
    db_action = OptimizationAction(
        project_id=action.project_id,
        related_batch_id=action.related_batch_id,
        title=action.title,
        description=action.description,
        action_type=action.action_type.value,
        priority=action.priority.value,
        status=action.status.value,
        assigned_to=action.assigned_to,
        proposed_solution=action.proposed_solution,
        expected_improvement=action.expected_improvement,
        root_cause_analysis=action.root_cause_analysis,
        implemented_at=action.implemented_at,
        verified_at=action.verified_at,
        verification_batch_id=action.verification_batch_id,
        actual_improvement=action.actual_improvement,
        notes=action.notes,
        attachments=action.attachments,
    )
    db.add(db_action)
    db.commit()
    db.refresh(db_action)
    return db_action


@router.get("/", response_model=OptimizationActionList)
def list_optimization_actions(
    project_id: Optional[int] = Query(None, ge=1),
    related_batch_id: Optional[int] = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    action_type: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(OptimizationAction)
    
    if project_id:
        query = query.filter(OptimizationAction.project_id == project_id)
    
    if related_batch_id:
        query = query.filter(OptimizationAction.related_batch_id == related_batch_id)
    
    if status:
        query = query.filter(OptimizationAction.status == status)
    
    if priority:
        query = query.filter(OptimizationAction.priority == priority)
    
    if action_type:
        query = query.filter(OptimizationAction.action_type == action_type)
    
    if assigned_to:
        query = query.filter(OptimizationAction.assigned_to == assigned_to)
    
    total = query.count()
    actions = query.order_by(
        OptimizationAction.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return OptimizationActionList(
        total=total,
        items=actions,
        page=skip // limit + 1,
        page_size=limit,
    )


@router.get("/{action_id}", response_model=OptimizationActionDetail)
def get_optimization_action(action_id: int, db: Session = Depends(get_db)):
    action = db.query(OptimizationAction).filter(
        OptimizationAction.id == action_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="调优动作不存在")
    
    related_batch_info = None
    if action.related_batch_id:
        related_batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.id == action.related_batch_id
        ).first()
        if related_batch:
            related_batch_info = {
                "id": related_batch.id,
                "name": related_batch.name,
                "batch_number": related_batch.batch_number,
                "test_type": related_batch.test_type,
            }
    
    verification_batch_info = None
    if action.verification_batch_id:
        verify_batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.id == action.verification_batch_id
        ).first()
        if verify_batch:
            verification_batch_info = {
                "id": verify_batch.id,
                "name": verify_batch.name,
                "batch_number": verify_batch.batch_number,
                "test_type": verify_batch.test_type,
                "qps": verify_batch.qps,
            }
    
    return OptimizationActionDetail(
        id=action.id,
        project_id=action.project_id,
        related_batch_id=action.related_batch_id,
        title=action.title,
        description=action.description,
        action_type=action.action_type,
        priority=action.priority,
        status=action.status,
        assigned_to=action.assigned_to,
        proposed_solution=action.proposed_solution,
        expected_improvement=action.expected_improvement,
        root_cause_analysis=action.root_cause_analysis,
        implemented_at=action.implemented_at,
        verified_at=action.verified_at,
        verification_batch_id=action.verification_batch_id,
        actual_improvement=action.actual_improvement,
        notes=action.notes,
        attachments=action.attachments,
        created_at=action.created_at,
        updated_at=action.updated_at,
        related_batch_info=related_batch_info,
        verification_batch_info=verification_batch_info,
    )


@router.put("/{action_id}", response_model=OptimizationActionSchema)
def update_optimization_action(
    action_id: int,
    action_update: OptimizationActionUpdate,
    db: Session = Depends(get_db),
):
    action = db.query(OptimizationAction).filter(
        OptimizationAction.id == action_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="调优动作不存在")
    
    update_data = action_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if hasattr(action, key):
            if key in ['action_type', 'priority', 'status'] and value:
                setattr(action, key, value.value)
            else:
                setattr(action, key, value)
    
    db.commit()
    db.refresh(action)
    return action


@router.delete("/{action_id}", status_code=204)
def delete_optimization_action(action_id: int, db: Session = Depends(get_db)):
    action = db.query(OptimizationAction).filter(
        OptimizationAction.id == action_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="调优动作不存在")
    
    db.delete(action)
    db.commit()


@router.post("/{action_id}/transition-status")
def transition_action_status(
    action_id: int,
    request: StatusTransitionRequest,
    db: Session = Depends(get_db),
):
    action = db.query(OptimizationAction).filter(
        OptimizationAction.id == action_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="调优动作不存在")
    
    current_status = action.status
    new_status = request.new_status.value
    
    valid_transitions = {
        "pending": ["in_progress", "rejected"],
        "in_progress": ["pending", "implemented", "rejected"],
        "implemented": ["in_progress", "verified", "rejected"],
        "verified": ["implemented"],
        "rejected": ["pending"],
    }
    
    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"无效的状态转换: {current_status} -> {new_status}"
        )
    
    action.status = new_status
    
    if request.implemented_at:
        action.implemented_at = request.implemented_at
    elif new_status == "implemented" and not action.implemented_at:
        action.implemented_at = datetime.utcnow()
    
    if request.verified_at:
        action.verified_at = request.verified_at
    elif new_status == "verified" and not action.verified_at:
        action.verified_at = datetime.utcnow()
    
    if request.verification_batch_id:
        verify_batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.id == request.verification_batch_id
        ).first()
        if not verify_batch:
            raise HTTPException(status_code=404, detail="验证批次不存在")
        action.verification_batch_id = request.verification_batch_id
    
    if request.actual_improvement:
        action.actual_improvement = request.actual_improvement
    
    if request.notes:
        if action.notes:
            action.notes = action.notes + "\n\n" + request.notes
        else:
            action.notes = request.notes
    
    db.commit()
    db.refresh(action)
    
    return {
        "success": True,
        "action_id": action.id,
        "old_status": current_status,
        "new_status": new_status,
    }


@router.get("/project/{project_id}/statistics", response_model=ActionStatistics)
def get_action_statistics(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    actions = db.query(OptimizationAction).filter(
        OptimizationAction.project_id == project_id
    ).all()
    
    total_actions = len(actions)
    
    by_status: Dict[str, int] = {
        "pending": 0,
        "in_progress": 0,
        "implemented": 0,
        "verified": 0,
        "rejected": 0,
    }
    
    by_type: Dict[str, int] = {}
    by_priority: Dict[str, int] = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
    }
    
    for action in actions:
        by_status[action.status] = by_status.get(action.status, 0) + 1
        
        if action.action_type:
            by_type[action.action_type] = by_type.get(action.action_type, 0) + 1
        
        if action.priority:
            by_priority[action.priority] = by_priority.get(action.priority, 0) + 1
    
    overdue_count = 0
    resolution_days = []
    for action in actions:
        if action.created_at and action.updated_at:
            if action.status not in ["verified", "rejected"]:
                days_open = (action.updated_at - action.created_at).days
                if days_open > 14:
                    overdue_count += 1
        
        if action.status in ["verified", "implemented"] and action.created_at:
            end_date = action.verified_at if action.verified_at else action.updated_at
            if end_date:
                days = (end_date - action.created_at).days
                if days > 0:
                    resolution_days.append(days)
    
    avg_resolution_days = None
    if resolution_days:
        avg_resolution_days = sum(resolution_days) / len(resolution_days)
    
    return ActionStatistics(
        project_id=project_id,
        total_actions=total_actions,
        by_status=by_status,
        by_type=by_type,
        by_priority=by_priority,
        overdue_count=overdue_count,
        avg_resolution_days=avg_resolution_days,
    )
