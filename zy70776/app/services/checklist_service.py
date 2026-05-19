import json
import os
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.checklist import (
    ReleaseChecklist,
    Artifact,
    MigrationScript,
    RollbackStep,
    ChecklistStatus,
)
from app.models.report import CheckReport, CheckReportItem, ReportStatus, MissingLevel
from app.models.audit import AuditLog
from app.schemas.checklist import (
    ReleaseChecklistCreate,
    ReleaseChecklistUpdate,
)


def create_checklist(db: Session, checklist_data: ReleaseChecklistCreate) -> ReleaseChecklist:
    db_checklist = ReleaseChecklist(
        version=checklist_data.version,
        title=checklist_data.title,
        description=checklist_data.description,
        owner=checklist_data.owner,
        raw_input=checklist_data.raw_input,
        status=ChecklistStatus.DRAFT,
    )
    db.add(db_checklist)
    db.flush()

    for artifact in checklist_data.artifacts:
        db_artifact = Artifact(checklist_id=db_checklist.id, **artifact.model_dump())
        db.add(db_artifact)

    for script in checklist_data.migration_scripts:
        db_script = MigrationScript(checklist_id=db_checklist.id, **script.model_dump())
        db.add(db_script)

    for step in checklist_data.rollback_steps:
        db_step = RollbackStep(checklist_id=db_checklist.id, **step.model_dump())
        db.add(db_step)

    db.commit()
    db.refresh(db_checklist)
    return db_checklist


def get_checklist(db: Session, checklist_id: int) -> Optional[ReleaseChecklist]:
    return db.query(ReleaseChecklist).filter(ReleaseChecklist.id == checklist_id).first()


def get_checklists(db: Session, skip: int = 0, limit: int = 100, status: Optional[ChecklistStatus] = None):
    query = db.query(ReleaseChecklist)
    if status:
        query = query.filter(ReleaseChecklist.status == status)
    return query.order_by(ReleaseChecklist.created_at.desc()).offset(skip).limit(limit).all()


def update_checklist_status(
    db: Session,
    checklist_id: int,
    new_status: ChecklistStatus,
    operator: str,
    conclusion: Optional[str] = None,
) -> Optional[ReleaseChecklist]:
    checklist = get_checklist(db, checklist_id)
    if not checklist:
        return None

    original_data = json.dumps({"status": checklist.status.value})
    checklist.status = new_status
    checklist.updated_at = datetime.utcnow()

    audit_log = AuditLog(
        checklist_id=checklist_id,
        action=f"STATUS_CHANGE:{checklist.status.value}",
        operator=operator,
        original_data=original_data,
        conclusion=conclusion or f"Status changed to {new_status.value}",
    )
    db.add(audit_log)
    db.commit()
    db.refresh(checklist)
    return checklist


def update_checklist(
    db: Session,
    checklist_id: int,
    update_data: ReleaseChecklistUpdate,
    operator: str,
) -> Optional[ReleaseChecklist]:
    checklist = get_checklist(db, checklist_id)
    if not checklist:
        return None

    original_data = {
        "title": checklist.title,
        "description": checklist.description,
        "owner": checklist.owner,
    }
    original_json = json.dumps(original_data)

    if update_data.title is not None:
        checklist.title = update_data.title
    if update_data.description is not None:
        checklist.description = update_data.description
    if update_data.owner is not None:
        checklist.owner = update_data.owner

    if update_data.artifacts is not None:
        db.query(Artifact).filter(Artifact.checklist_id == checklist_id).delete()
        for artifact in update_data.artifacts:
            db_artifact = Artifact(checklist_id=checklist_id, **artifact.model_dump())
            db.add(db_artifact)

    if update_data.migration_scripts is not None:
        db.query(MigrationScript).filter(MigrationScript.checklist_id == checklist_id).delete()
        for script in update_data.migration_scripts:
            db_script = MigrationScript(checklist_id=checklist_id, **script.model_dump())
            db.add(db_script)

    if update_data.rollback_steps is not None:
        db.query(RollbackStep).filter(RollbackStep.checklist_id == checklist_id).delete()
        for step in update_data.rollback_steps:
            db_step = RollbackStep(checklist_id=checklist_id, **step.model_dump())
            db.add(db_step)

    checklist.updated_at = datetime.utcnow()

    audit_log = AuditLog(
        checklist_id=checklist_id,
        action="UPDATE",
        operator=operator,
        original_data=original_json,
        conclusion="Checklist updated",
    )
    db.add(audit_log)
    db.commit()
    db.refresh(checklist)
    return checklist


def withdraw_checklist(
    db: Session,
    checklist_id: int,
    operator: str,
    reason: str,
) -> Optional[ReleaseChecklist]:
    return update_checklist_status(
        db,
        checklist_id,
        ChecklistStatus.WITHDRAWN,
        operator,
        reason,
    )


def close_checklist(
    db: Session,
    checklist_id: int,
    operator: str,
    reason: str,
) -> Optional[ReleaseChecklist]:
    return update_checklist_status(
        db,
        checklist_id,
        ChecklistStatus.CLOSED,
        operator,
        reason,
    )
