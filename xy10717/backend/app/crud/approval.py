from sqlalchemy.orm import Session
from app.models.approval import ApprovalChain, ApprovalStep, ApprovalStatus, ApprovalChainStatus
from app.models.migration import MigrationScript, MigrationStatus
from datetime import datetime
import json

def get_approval_chain(db: Session, chain_id: int):
    return db.query(ApprovalChain).filter(ApprovalChain.id == chain_id).first()

def get_approval_chain_by_migration(db: Session, migration_id: int):
    return db.query(ApprovalChain).filter(ApprovalChain.migration_id == migration_id).first()

def create_approval_chain(db: Session, migration_id: int, steps_data: list):
    chain = ApprovalChain(migration_id=migration_id, status=ApprovalChainStatus.NOT_STARTED)
    db.add(chain)
    db.flush()
    
    for step in steps_data:
        db_step = ApprovalStep(chain_id=chain.id, **step.model_dump())
        db.add(db_step)
    
    db.commit()
    db.refresh(chain)
    return chain

def start_approval_chain(db: Session, chain_id: int):
    chain = get_approval_chain(db, chain_id)
    if chain and chain.status == ApprovalChainStatus.NOT_STARTED:
        chain.status = ApprovalChainStatus.IN_PROGRESS
        chain.current_step_index = 0
        chain.started_at = datetime.utcnow()
        db.commit()
        db.refresh(chain)
        
        migration = db.query(MigrationScript).filter(MigrationScript.id == chain.migration_id).first()
        if migration:
            migration.status = MigrationStatus.PENDING_APPROVAL
            db.commit()
    return chain

def approve_step(db: Session, step_id: int, approver: str, comment: str = None):
    step = db.query(ApprovalStep).filter(ApprovalStep.id == step_id).first()
    if not step or step.status != ApprovalStatus.PENDING:
        return None
    
    if step.rules:
        try:
            rules = json.loads(step.rules)
            if "required_role" in rules and rules["required_role"] != approver:
                step.status = ApprovalStatus.REJECTED
                step.comment = f"规则校验失败: 需要 {rules['required_role']} 角色"
                db.commit()
                
                chain = get_approval_chain(db, step.chain_id)
                chain.status = ApprovalChainStatus.REJECTED
                chain.completed_at = datetime.utcnow()
                db.commit()
                
                migration = db.query(MigrationScript).filter(MigrationScript.id == chain.migration_id).first()
                if migration:
                    migration.status = MigrationStatus.REJECTED
                    db.commit()
                
                return step
        except:
            pass
    
    step.status = ApprovalStatus.APPROVED
    step.approver = approver
    step.comment = comment
    step.approved_at = datetime.utcnow()
    db.commit()
    
    chain = get_approval_chain(db, step.chain_id)
    
    next_step = None
    for s in chain.steps:
        if s.step_order > step.step_order and s.status == ApprovalStatus.PENDING:
            if next_step is None or s.step_order < next_step.step_order:
                next_step = s
    
    if next_step:
        chain.current_step_index = chain.steps.index(next_step)
    else:
        chain.status = ApprovalChainStatus.APPROVED
        chain.completed_at = datetime.utcnow()
        
        migration = db.query(MigrationScript).filter(MigrationScript.id == chain.migration_id).first()
        if migration:
            migration.status = MigrationStatus.APPROVED
        db.commit()
    
    db.refresh(step)
    return step

def reject_step(db: Session, step_id: int, approver: str, comment: str = None):
    step = db.query(ApprovalStep).filter(ApprovalStep.id == step_id).first()
    if not step or step.status != ApprovalStatus.PENDING:
        return None
    
    step.status = ApprovalStatus.REJECTED
    step.approver = approver
    step.comment = comment
    step.approved_at = datetime.utcnow()
    db.commit()
    
    chain = get_approval_chain(db, step.chain_id)
    chain.status = ApprovalChainStatus.REJECTED
    chain.completed_at = datetime.utcnow()
    db.commit()
    
    migration = db.query(MigrationScript).filter(MigrationScript.id == chain.migration_id).first()
    if migration:
        migration.status = MigrationStatus.REJECTED
    db.commit()
    
    db.refresh(step)
    return step