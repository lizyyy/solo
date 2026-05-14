from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime
from . import models, schemas

class IdempotentService:
    @staticmethod
    def check_idempotent(db: Session, idempotent_key: str) -> Optional[models.SimulationResult]:
        return db.query(models.SimulationResult).filter(
            models.SimulationResult.idempotent_key == idempotent_key
        ).first()

class ApproverService:
    @staticmethod
    def validate_approvers(db: Session, approver_ids: List[int]) -> List[schemas.ApproverError]:
        errors = []
        for approver_id in approver_ids:
            approver = db.query(models.Approver).filter(models.Approver.id == approver_id).first()
            if not approver:
                errors.append(schemas.ApproverError(
                    approver_id=approver_id,
                    approver_name=f"未知审批人-{approver_id}",
                    error_type="not_found",
                    error_message=f"审批人ID {approver_id} 不存在"
                ))
            elif not approver.is_active:
                errors.append(schemas.ApproverError(
                    approver_id=approver_id,
                    approver_name=approver.name,
                    error_type="inactive",
                    error_message=f"审批人 {approver.name} 已离职/停用"
                ))
        return errors

class SimulationService:
    @staticmethod
    def create_simulation(db: Session, simulation: schemas.SimulationResultCreate) -> models.SimulationResult:
        existing = IdempotentService.check_idempotent(db, simulation.idempotent_key)
        if existing:
            return existing

        approver_errors = ApproverService.validate_approvers(db, simulation.approver_ids)
        
        db_simulation = models.SimulationResult(
            **simulation.dict(exclude={"approver_errors"}),
            approver_errors=[error.dict() for error in approver_errors]
        )
        
        if approver_errors:
            db_simulation.simulation_status = "warning"
        
        db.add(db_simulation)
        db.commit()
        db.refresh(db_simulation)
        return db_simulation

    @staticmethod
    def get_simulation(db: Session, simulation_id: int) -> Optional[models.SimulationResult]:
        return db.query(models.SimulationResult).filter(models.SimulationResult.id == simulation_id).first()

    @staticmethod
    def list_simulations(db: Session, filter_params: schemas.SimulationFilter, skip: int = 0, limit: int = 100):
        query = db.query(models.SimulationResult)
        
        if filter_params.application_no:
            query = query.join(models.Application).filter(
                models.Application.application_no.contains(filter_params.application_no)
            )
        
        if filter_params.rule_version:
            query = query.join(models.RuleVersion).filter(
                models.RuleVersion.version.contains(filter_params.rule_version)
            )
        
        if filter_params.simulation_status:
            query = query.filter(models.SimulationResult.simulation_status == filter_params.simulation_status)
        
        if filter_params.published is not None:
            query = query.filter(models.SimulationResult.published == filter_params.published)
        
        if filter_params.start_date:
            query = query.filter(models.SimulationResult.created_at >= filter_params.start_date)
        
        if filter_params.end_date:
            query = query.filter(models.SimulationResult.created_at <= filter_params.end_date)
        
        return query.order_by(models.SimulationResult.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def confirm_skip_reason(db: Session, simulation_id: int, confirmed_by: str) -> Optional[models.SimulationResult]:
        simulation = db.query(models.SimulationResult).filter(models.SimulationResult.id == simulation_id).first()
        if simulation:
            simulation.skip_manual_confirmed = True
            simulation.skip_confirmed_by = confirmed_by
            simulation.skip_confirmed_at = datetime.now()
            db.commit()
            db.refresh(simulation)
        return simulation

    @staticmethod
    def publish_simulation(db: Session, simulation_id: int, published_by: str) -> Optional[models.SimulationResult]:
        simulation = db.query(models.SimulationResult).filter(models.SimulationResult.id == simulation_id).first()
        if simulation:
            simulation.published = True
            simulation.published_at = datetime.now()
            simulation.published_by = published_by
            db.commit()
            db.refresh(simulation)
        return simulation

    @staticmethod
    def get_simulation_detail(db: Session, simulation_id: int):
        simulation = SimulationService.get_simulation(db, simulation_id)
        if not simulation:
            return None
        
        application = db.query(models.Application).filter(models.Application.id == simulation.application_id).first()
        rule_version = db.query(models.RuleVersion).filter(models.RuleVersion.id == simulation.rule_version_id).first()
        
        hit_conditions = db.query(models.HitCondition).filter(
            models.HitCondition.id.in_(simulation.hit_condition_ids)
        ).all() if simulation.hit_condition_ids else []
        
        approvers = db.query(models.Approver).filter(
            models.Approver.id.in_(simulation.approver_ids)
        ).all() if simulation.approver_ids else []
        
        skip_reason = db.query(models.SkipReason).filter(
            models.SkipReason.id == simulation.skip_reason_id
        ).first() if simulation.skip_reason_id else None
        
        return {
            "simulation": simulation,
            "application": application,
            "rule_version": rule_version,
            "hit_conditions": hit_conditions,
            "approvers": approvers,
            "skip_reason": skip_reason
        }
