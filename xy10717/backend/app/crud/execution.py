from sqlalchemy.orm import Session
from app.models.execution import ExecutionLog, ExecutionType, ExecutionStatus
from app.models.migration import MigrationScript, MigrationStatus
from datetime import datetime, timedelta

def create_execution_log(db: Session, migration_id: int, execution_type: ExecutionType, executed_by: str = None, script_content: str = None):
    log = ExecutionLog(
        migration_id=migration_id,
        execution_type=execution_type,
        status=ExecutionStatus.PENDING,
        executed_by=executed_by,
        script_content=script_content,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def start_execution(db: Session, log_id: int):
    log = db.query(ExecutionLog).filter(ExecutionLog.id == log_id).first()
    if log:
        log.status = ExecutionStatus.RUNNING
        log.started_at = datetime.utcnow()
        db.commit()
        db.refresh(log)
        
        migration = db.query(MigrationScript).filter(MigrationScript.id == log.migration_id).first()
        if migration:
            migration.status = MigrationStatus.EXECUTING
            db.commit()
    return log

def complete_execution(db: Session, log_id: int, success: bool, output: str = None, error_message: str = None, affected_rows: int = None):
    log = db.query(ExecutionLog).filter(ExecutionLog.id == log_id).first()
    if not log:
        return None
    
    log.status = ExecutionStatus.SUCCESS if success else ExecutionStatus.FAILED
    log.completed_at = datetime.utcnow()
    log.output = output
    log.error_message = error_message
    log.affected_rows = affected_rows
    if log.started_at:
        duration = (log.completed_at - log.started_at).total_seconds()
        log.duration_seconds = int(duration)
    
    db.commit()
    db.refresh(log)
    
    migration = db.query(MigrationScript).filter(MigrationScript.id == log.migration_id).first()
    if migration:
        if success:
            migration.status = MigrationStatus.SUCCESS
            migration.executed_at = log.completed_at
        else:
            migration.status = MigrationStatus.FAILED
        db.commit()
    
    return log

def get_execution_logs(db: Session, migration_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(ExecutionLog).order_by(ExecutionLog.started_at.desc())
    if migration_id:
        query = query.filter(ExecutionLog.migration_id == migration_id)
    return query.offset(skip).limit(limit).all()

def get_execution_log(db: Session, log_id: int):
    return db.query(ExecutionLog).filter(ExecutionLog.id == log_id).first()

def replay_execution(db: Session, log_id: int, executed_by: str = None):
    original_log = get_execution_log(db, log_id)
    if not original_log:
        return None
    
    new_log = ExecutionLog(
        migration_id=original_log.migration_id,
        execution_type=ExecutionType.REPLAY,
        status=ExecutionStatus.PENDING,
        executed_by=executed_by,
        script_content=original_log.script_content,
        parent_log_id=log_id,
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

def manual_fix(db: Session, migration_id: int, script_content: str, executed_by: str = None):
    log = ExecutionLog(
        migration_id=migration_id,
        execution_type=ExecutionType.MANUAL_FIX,
        status=ExecutionStatus.PENDING,
        executed_by=executed_by,
        script_content=script_content,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log