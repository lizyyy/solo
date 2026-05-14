from sqlalchemy.orm import Session
from app.models.migration import MigrationScript, AffectedTable, ExecutionWindow, RollbackScript, MigrationStatus
from app.schemas.migration import MigrationScriptCreate, MigrationScriptUpdate
from datetime import datetime

def get_migration(db: Session, migration_id: int):
    return db.query(MigrationScript).filter(MigrationScript.id == migration_id).first()

def get_migrations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(MigrationScript).order_by(MigrationScript.created_at.desc()).offset(skip).limit(limit).all()

def create_migration(db: Session, migration: MigrationScriptCreate):
    db_migration = MigrationScript(
        name=migration.name,
        description=migration.description,
        script_content=migration.script_content,
        database_type=migration.database_type,
        created_by=migration.created_by,
        status=MigrationStatus.DRAFT,
    )
    db.add(db_migration)
    db.flush()
    
    for table in migration.affected_tables:
        db_table = AffectedTable(migration_id=db_migration.id, **table.model_dump())
        db.add(db_table)
    
    for window in migration.execution_windows:
        db_window = ExecutionWindow(migration_id=db_migration.id, **window.model_dump())
        db.add(db_window)
    
    for rb in migration.rollback_scripts:
        db_rb = RollbackScript(migration_id=db_migration.id, **rb.model_dump())
        db.add(db_rb)
    
    db.commit()
    db.refresh(db_migration)
    return db_migration

def update_migration(db: Session, migration_id: int, migration: MigrationScriptUpdate):
    db_migration = get_migration(db, migration_id)
    if db_migration:
        update_data = migration.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_migration, key, value)
        db_migration.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_migration)
    return db_migration

def delete_migration(db: Session, migration_id: int):
    db_migration = get_migration(db, migration_id)
    if db_migration:
        db.delete(db_migration)
        db.commit()
    return db_migration

def recalculate_affected_tables(db: Session, migration_id: int):
    db_migration = get_migration(db, migration_id)
    if not db_migration:
        return None
    
    script_content = db_migration.script_content.upper()
    
    for table in db_migration.affected_tables:
        table_name = table.table_name.upper()
        if f"TABLE {table_name}" in script_content or f" {table_name} " in script_content:
            if "ALTER" in script_content:
                table.operation_type = "ALTER"
            elif "DROP" in script_content:
                table.operation_type = "DROP"
            elif "CREATE" in script_content:
                table.operation_type = "CREATE"
            elif "UPDATE" in script_content:
                table.operation_type = "UPDATE"
            elif "DELETE" in script_content:
                table.operation_type = "DELETE"
    
    db.commit()
    db.refresh(db_migration)
    return db_migration

def add_affected_table(db: Session, migration_id: int, table_data: dict):
    db_table = AffectedTable(migration_id=migration_id, **table_data)
    db.add(db_table)
    db.commit()
    db.refresh(db_table)
    return db_table

def add_rollback_script(db: Session, migration_id: int, rollback_data: dict):
    max_version = db.query(RollbackScript).filter(RollbackScript.migration_id == migration_id).count()
    db_rb = RollbackScript(
        migration_id=migration_id,
        version=max_version + 1,
        **rollback_data
    )
    db.add(db_rb)
    db.commit()
    db.refresh(db_rb)
    return db_rb