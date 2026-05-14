from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.migration import (
    MigrationScriptCreate,
    MigrationScriptUpdate,
    MigrationScriptResponse,
    AffectedTableCreate,
    AffectedTableResponse,
    RollbackScriptCreate,
    RollbackScriptResponse,
)
from app.crud import migration as migration_crud

router = APIRouter(prefix="/migration", tags=["迁移脚本"])

@router.get("/", response_model=List[MigrationScriptResponse])
def read_migrations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    migrations = migration_crud.get_migrations(db, skip=skip, limit=limit)
    return migrations

@router.get("/{migration_id}", response_model=MigrationScriptResponse)
def read_migration(migration_id: int, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    return migration

@router.post("/", response_model=MigrationScriptResponse)
def create_migration(migration: MigrationScriptCreate, db: Session = Depends(get_db)):
    return migration_crud.create_migration(db=db, migration=migration)

@router.put("/{migration_id}", response_model=MigrationScriptResponse)
def update_migration(migration_id: int, migration: MigrationScriptUpdate, db: Session = Depends(get_db)):
    db_migration = migration_crud.get_migration(db, migration_id=migration_id)
    if db_migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    return migration_crud.update_migration(db=db, migration_id=migration_id, migration=migration)

@router.delete("/{migration_id}")
def delete_migration(migration_id: int, db: Session = Depends(get_db)):
    db_migration = migration_crud.get_migration(db, migration_id=migration_id)
    if db_migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    migration_crud.delete_migration(db=db, migration_id=migration_id)
    return {"message": "删除成功"}

@router.post("/{migration_id}/recalculate-tables", response_model=MigrationScriptResponse)
def recalculate_affected_tables(migration_id: int, db: Session = Depends(get_db)):
    migration = migration_crud.recalculate_affected_tables(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    return migration

@router.post("/{migration_id}/affected-tables", response_model=AffectedTableResponse)
def add_affected_table(migration_id: int, table_data: AffectedTableCreate, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    return migration_crud.add_affected_table(db, migration_id=migration_id, table_data=table_data.model_dump())

@router.post("/{migration_id}/rollback-scripts", response_model=RollbackScriptResponse)
def add_rollback_script(migration_id: int, rollback_data: RollbackScriptCreate, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    return migration_crud.add_rollback_script(db, migration_id=migration_id, rollback_data=rollback_data.model_dump())