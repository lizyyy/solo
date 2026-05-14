from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.execution import ExecutionLogResponse
from app.models.execution import ExecutionType
from app.crud import execution as execution_crud
from app.crud import migration as migration_crud

router = APIRouter(prefix="/execution", tags=["执行日志"])

@router.get("/logs", response_model=List[ExecutionLogResponse])
def read_execution_logs(migration_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return execution_crud.get_execution_logs(db, migration_id=migration_id, skip=skip, limit=limit)

@router.get("/logs/{log_id}", response_model=ExecutionLogResponse)
def read_execution_log(log_id: int, db: Session = Depends(get_db)):
    log = execution_crud.get_execution_log(db, log_id=log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="执行日志不存在")
    return log

@router.post("/{migration_id}/start", response_model=ExecutionLogResponse)
def start_execution(migration_id: int, executed_by: str = None, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    log = execution_crud.create_execution_log(
        db,
        migration_id=migration_id,
        execution_type=ExecutionType.MIGRATION,
        executed_by=executed_by,
        script_content=migration.script_content
    )
    return execution_crud.start_execution(db, log_id=log.id)

@router.post("/logs/{log_id}/complete", response_model=ExecutionLogResponse)
def complete_execution(log_id: int, success: bool, output: str = None, error_message: str = None, affected_rows: int = None, db: Session = Depends(get_db)):
    log = execution_crud.complete_execution(
        db,
        log_id=log_id,
        success=success,
        output=output,
        error_message=error_message,
        affected_rows=affected_rows
    )
    if log is None:
        raise HTTPException(status_code=404, detail="执行日志不存在")
    return log

@router.post("/logs/{log_id}/replay", response_model=ExecutionLogResponse)
def replay_execution(log_id: int, executed_by: str = None, db: Session = Depends(get_db)):
    log = execution_crud.replay_execution(db, log_id=log_id, executed_by=executed_by)
    if log is None:
        raise HTTPException(status_code=404, detail="原始执行日志不存在")
    return execution_crud.start_execution(db, log_id=log.id)

@router.post("/{migration_id}/manual-fix", response_model=ExecutionLogResponse)
def manual_fix(migration_id: int, script_content: str, executed_by: str = None, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    log = execution_crud.manual_fix(
        db,
        migration_id=migration_id,
        script_content=script_content,
        executed_by=executed_by
    )
    return execution_crud.start_execution(db, log_id=log.id)