from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.core.services import (
    ViolationService, DependencyGraphService,
    BoundaryCheckerService
)
from app.schemas import (
    Violation, ViolationCreate, ViolationStatusUpdate,
    ViolationStatusHistory, DependencyGraph, CircularDependency,
    ViolationReport
)
from app.models import ViolationStatus, ViolationType

router = APIRouter(tags=["violations"])


@router.post("/violations/", response_model=Violation)
def create_violation(violation: ViolationCreate, db: Session = Depends(get_db)):
    return ViolationService.create_violation(db=db, violation=violation)


@router.get("/violations/", response_model=List[Violation])
def list_violations(
    status: Optional[ViolationStatus] = None,
    violation_type: Optional[ViolationType] = None,
    assignee: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return ViolationService.list_violations(
        db=db,
        status=status,
        violation_type=violation_type,
        assignee=assignee,
        skip=skip,
        limit=limit
    )


@router.get("/violations/{violation_id}", response_model=Violation)
def get_violation(violation_id: int, db: Session = Depends(get_db)):
    violation = ViolationService.get_violation(db=db, violation_id=violation_id)
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    return violation


@router.patch("/violations/{violation_id}/status", response_model=Violation)
def update_violation_status(
    violation_id: int,
    update: ViolationStatusUpdate,
    db: Session = Depends(get_db)
):
    violation = ViolationService.update_status(db=db, violation_id=violation_id, update=update)
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    return violation


@router.get("/violations/{violation_id}/history", response_model=List[ViolationStatusHistory])
def get_violation_history(violation_id: int, db: Session = Depends(get_db)):
    return ViolationService.get_status_history(db=db, violation_id=violation_id)


@router.post("/check-boundaries", response_model=List[Violation])
def check_boundaries(db: Session = Depends(get_db)):
    return BoundaryCheckerService.check_boundaries(db=db)


@router.post("/check-layers", response_model=List[Violation])
def check_layer_violations(db: Session = Depends(get_db)):
    return BoundaryCheckerService.check_layer_violations(db=db)


@router.get("/dependency-graph", response_model=DependencyGraph)
def get_dependency_graph(db: Session = Depends(get_db)):
    return DependencyGraphService.build_dependency_graph(db=db)


@router.get("/circular-dependencies", response_model=List[CircularDependency])
def detect_circular_dependencies(db: Session = Depends(get_db)):
    return DependencyGraphService.detect_circular_dependencies(db=db)


@router.get("/report", response_model=ViolationReport)
def get_violation_report(db: Session = Depends(get_db)):
    return ViolationService.generate_report(db=db)


@router.get("/export/json")
def export_report_json(db: Session = Depends(get_db)):
    report = ViolationService.generate_report(db=db)
    return JSONResponse(content=report.model_dump())
