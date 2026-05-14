from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas, services, export_service
from .database import get_db

router = APIRouter(prefix="/api", tags=["approval-simulator"])

@router.post("/simulations", response_model=schemas.SimulationResult)
def create_simulation(simulation: schemas.SimulationResultCreate, db: Session = Depends(get_db)):
    return services.SimulationService.create_simulation(db, simulation)

@router.get("/simulations", response_model=List[schemas.SimulationResult])
def list_simulations(
    application_no: str = None,
    rule_version: str = None,
    simulation_status: str = None,
    published: bool = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    filter_params = schemas.SimulationFilter(
        application_no=application_no,
        rule_version=rule_version,
        simulation_status=simulation_status,
        published=published
    )
    return services.SimulationService.list_simulations(db, filter_params, skip, limit)

@router.get("/simulations/{simulation_id}", response_model=schemas.SimulationDetailResponse)
def get_simulation_detail(simulation_id: int, db: Session = Depends(get_db)):
    detail = services.SimulationService.get_simulation_detail(db, simulation_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return detail

@router.post("/simulations/{simulation_id}/confirm-skip", response_model=schemas.SimulationResult)
def confirm_skip_reason(simulation_id: int, request: schemas.SkipConfirmRequest, db: Session = Depends(get_db)):
    simulation = services.SimulationService.confirm_skip_reason(db, simulation_id, request.confirmed_by)
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return simulation

@router.post("/simulations/{simulation_id}/publish", response_model=schemas.SimulationResult)
def publish_simulation(simulation_id: int, db: Session = Depends(get_db)):
    simulation = services.SimulationService.publish_simulation(db, simulation_id, "system")
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return simulation

@router.get("/simulations/{simulation_id}/export")
def export_simulation(simulation_id: int, db: Session = Depends(get_db)):
    excel_file = export_service.ExportService.export_simulation_to_excel(db, simulation_id)
    if not excel_file:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=simulation_result_{simulation_id}.xlsx"}
    )

@router.post("/applications", response_model=schemas.Application)
def create_application(application: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    db_application = models.Application(**application.dict())
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    return db_application

@router.get("/applications", response_model=List[schemas.Application])
def list_applications(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Application).offset(skip).limit(limit).all()

@router.post("/rule-versions", response_model=schemas.RuleVersion)
def create_rule_version(rule_version: schemas.RuleVersionCreate, db: Session = Depends(get_db)):
    db_rule = models.RuleVersion(**rule_version.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.get("/rule-versions", response_model=List[schemas.RuleVersion])
def list_rule_versions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.RuleVersion).offset(skip).limit(limit).all()

@router.post("/hit-conditions", response_model=schemas.HitCondition)
def create_hit_condition(hit_condition: schemas.HitConditionCreate, db: Session = Depends(get_db)):
    db_condition = models.HitCondition(**hit_condition.dict())
    db.add(db_condition)
    db.commit()
    db.refresh(db_condition)
    return db_condition

@router.get("/rule-versions/{rule_version_id}/hit-conditions", response_model=List[schemas.HitCondition])
def list_hit_conditions(rule_version_id: int, db: Session = Depends(get_db)):
    return db.query(models.HitCondition).filter(models.HitCondition.rule_version_id == rule_version_id).all()

@router.post("/approvers", response_model=schemas.Approver)
def create_approver(approver: schemas.ApproverCreate, db: Session = Depends(get_db)):
    db_approver = models.Approver(**approver.dict())
    db.add(db_approver)
    db.commit()
    db.refresh(db_approver)
    return db_approver

@router.get("/approvers", response_model=List[schemas.Approver])
def list_approvers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Approver).offset(skip).limit(limit).all()

@router.post("/skip-reasons", response_model=schemas.SkipReason)
def create_skip_reason(skip_reason: schemas.SkipReasonCreate, db: Session = Depends(get_db)):
    db_skip = models.SkipReason(**skip_reason.dict())
    db.add(db_skip)
    db.commit()
    db.refresh(db_skip)
    return db_skip

@router.get("/skip-reasons", response_model=List[schemas.SkipReason])
def list_skip_reasons(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.SkipReason).offset(skip).limit(limit).all()
