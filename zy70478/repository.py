from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

import models
import schemas


class EventRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_event_by_id(self, event_id: int) -> Optional[models.Event]:
        return self.db.query(models.Event).filter(models.Event.id == event_id).first()
    
    def get_events_by_batch_id(self, batch_id: str) -> List[models.Event]:
        return self.db.query(models.Event).filter(models.Event.batch_id == batch_id).all()
    
    def get_events_by_risk_level(self, risk_level: str) -> List[models.Event]:
        return self.db.query(models.Event).filter(models.Event.risk_level == risk_level).all()
    
    def get_merged_events(self, parent_event_id: int) -> List[models.Event]:
        return self.db.query(models.Event).filter(
            models.Event.merged_into_event_id == parent_event_id
        ).all()
    
    def get_event_with_merged(self, event_id: int) -> Optional[Dict[str, Any]]:
        event = self.get_event_by_id(event_id)
        if not event:
            return None
        
        merged_events = self.get_merged_events(event.id)
        return {
            "event": event,
            "merged_events": merged_events
        }


class BatchRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_batch_by_id(self, batch_id: str) -> Optional[models.EventBatch]:
        return self.db.query(models.EventBatch).filter(
            models.EventBatch.batch_id == batch_id
        ).first()
    
    def get_batch_by_hash(self, batch_hash: str) -> Optional[models.EventBatch]:
        return self.db.query(models.EventBatch).filter(
            models.EventBatch.batch_hash == batch_hash
        ).first()
    
    def get_all_batches(self, skip: int = 0, limit: int = 100) -> List[models.EventBatch]:
        return self.db.query(models.EventBatch).offset(skip).limit(limit).all()
    
    def get_batch_with_details(self, batch_id: str) -> Optional[Dict[str, Any]]:
        batch = self.get_batch_by_id(batch_id)
        if not batch:
            return None
        
        events = self.db.query(models.Event).filter(
            models.Event.batch_id == batch_id
        ).all()
        
        reports = self.db.query(models.ProcessingReport).filter(
            models.ProcessingReport.batch_id == batch_id
        ).all()
        
        return {
            "batch": batch,
            "events": events,
            "reports": reports
        }


class RuleRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_active_rule(self) -> Optional[models.ConvergenceRule]:
        return self.db.query(models.ConvergenceRule).filter(
            models.ConvergenceRule.is_active == True
        ).first()
    
    def get_rule_by_version(self, version: str) -> Optional[models.ConvergenceRule]:
        return self.db.query(models.ConvergenceRule).filter(
            models.ConvergenceRule.version == version
        ).first()
    
    def get_all_rules(self) -> List[models.ConvergenceRule]:
        return self.db.query(models.ConvergenceRule).all()
    
    def create_rule(self, rule_data: schemas.ConvergenceRuleCreate) -> models.ConvergenceRule:
        existing_active = self.get_active_rule()
        if existing_active and rule_data.is_active:
            existing_active.is_active = False
            self.db.commit()
        
        db_rule = models.ConvergenceRule(
            version=rule_data.version,
            rule_name=rule_data.rule_name,
            description=rule_data.description,
            success_conditions=rule_data.success_conditions,
            failure_conditions=rule_data.failure_conditions,
            risk_weightings=rule_data.risk_weightings,
            is_active=rule_data.is_active
        )
        self.db.add(db_rule)
        self.db.commit()
        self.db.refresh(db_rule)
        
        audit_log = models.AuditLog(
            action="CREATE_RULE",
            entity_type="ConvergenceRule",
            entity_id=rule_data.version,
            new_value=rule_data.model_dump(),
            notes=f"创建新规则版本: {rule_data.version}"
        )
        self.db.add(audit_log)
        self.db.commit()
        
        return db_rule
    
    def update_rule(self, version: str, rule_data: schemas.ConvergenceRuleCreate) -> Optional[models.ConvergenceRule]:
        db_rule = self.get_rule_by_version(version)
        if not db_rule:
            return None
        
        old_value = {
            "version": db_rule.version,
            "rule_name": db_rule.rule_name,
            "description": db_rule.description,
            "success_conditions": db_rule.success_conditions,
            "failure_conditions": db_rule.failure_conditions,
            "risk_weightings": db_rule.risk_weightings,
            "is_active": db_rule.is_active
        }
        
        db_rule.rule_name = rule_data.rule_name
        db_rule.description = rule_data.description
        db_rule.success_conditions = rule_data.success_conditions
        db_rule.failure_conditions = rule_data.failure_conditions
        db_rule.risk_weightings = rule_data.risk_weightings
        
        if rule_data.is_active:
            existing_active = self.get_active_rule()
            if existing_active and existing_active.version != version:
                existing_active.is_active = False
        
        db_rule.is_active = rule_data.is_active
        self.db.commit()
        self.db.refresh(db_rule)
        
        audit_log = models.AuditLog(
            action="UPDATE_RULE",
            entity_type="ConvergenceRule",
            entity_id=version,
            old_value=old_value,
            new_value=rule_data.model_dump(),
            notes=f"更新规则版本: {version}"
        )
        self.db.add(audit_log)
        self.db.commit()
        
        return db_rule


class ReportRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_report_by_id(self, report_id: int) -> Optional[models.ProcessingReport]:
        return self.db.query(models.ProcessingReport).filter(
            models.ProcessingReport.id == report_id
        ).first()
    
    def get_reports_by_batch_id(self, batch_id: str) -> List[models.ProcessingReport]:
        return self.db.query(models.ProcessingReport).filter(
            models.ProcessingReport.batch_id == batch_id
        ).all()


class OutsourcingAcceptanceRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_by_batch_id(self, batch_id: str) -> List[models.OutsourcingAcceptance]:
        return self.db.query(models.OutsourcingAcceptance).filter(
            models.OutsourcingAcceptance.batch_id == batch_id
        ).all()
    
    def get_by_risk_level(self, risk_level: str) -> List[models.OutsourcingAcceptance]:
        return self.db.query(models.OutsourcingAcceptance).filter(
            models.OutsourcingAcceptance.risk_level == risk_level
        ).all()
    
    def get_by_event_id(self, event_id: int) -> Optional[models.OutsourcingAcceptance]:
        return self.db.query(models.OutsourcingAcceptance).filter(
            models.OutsourcingAcceptance.event_id == event_id
        ).first()


class AuditLogRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_all_logs(self, skip: int = 0, limit: int = 100) -> List[models.AuditLog]:
        return self.db.query(models.AuditLog).order_by(
            models.AuditLog.changed_at.desc()
        ).offset(skip).limit(limit).all()
    
    def get_logs_by_entity(self, entity_type: str, entity_id: str) -> List[models.AuditLog]:
        return self.db.query(models.AuditLog).filter(
            and_(
                models.AuditLog.entity_type == entity_type,
                models.AuditLog.entity_id == entity_id
            )
        ).order_by(models.AuditLog.changed_at.desc()).all()
