import json
import os
import re
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
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
    ArtifactCreate,
    MigrationScriptCreate,
    RollbackStepCreate,
)


VALID_STATUS_TRANSITIONS = {
    ChecklistStatus.DRAFT: [ChecklistStatus.PENDING_REVIEW, ChecklistStatus.WITHDRAWN, ChecklistStatus.CLOSED],
    ChecklistStatus.PENDING_REVIEW: [ChecklistStatus.REVIEWING, ChecklistStatus.DRAFT, ChecklistStatus.WITHDRAWN, ChecklistStatus.CLOSED],
    ChecklistStatus.REVIEWING: [ChecklistStatus.APPROVED, ChecklistStatus.REJECTED, ChecklistStatus.PENDING_REVIEW, ChecklistStatus.WITHDRAWN, ChecklistStatus.CLOSED],
    ChecklistStatus.APPROVED: [ChecklistStatus.CLOSED, ChecklistStatus.WITHDRAWN],
    ChecklistStatus.REJECTED: [ChecklistStatus.DRAFT, ChecklistStatus.CLOSED, ChecklistStatus.WITHDRAWN],
    ChecklistStatus.WITHDRAWN: [ChecklistStatus.DRAFT, ChecklistStatus.CLOSED],
    ChecklistStatus.CLOSED: [],
}


def validate_status_transition(current_status: ChecklistStatus, new_status: ChecklistStatus) -> bool:
    return new_status in VALID_STATUS_TRANSITIONS.get(current_status, [])


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


class InvalidStatusTransitionError(ValueError):
    pass


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

    if not validate_status_transition(checklist.status, new_status):
        raise InvalidStatusTransitionError(
            f"Invalid status transition from {checklist.status.value} to {new_status.value}"
        )

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


def parse_checklist_text(raw_text: str) -> Dict[str, Any]:
    artifacts = []
    migration_scripts = []
    rollback_steps = []
    
    lines = raw_text.split('\n')
    current_section = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        line_lower = line.lower()
        
        section_changed = False
        is_numbered_step = bool(re.match(r'^\d+[\.\-]', line))
        is_likely_title = (
            line.startswith('#') or 
            line.startswith('=') or 
            (len(line) < 50 and not ('.jar' in line_lower or '.war' in line_lower or '.sql' in line_lower) and not is_numbered_step)
        )
        if is_likely_title:
            if any(kw in line_lower for kw in ['制品', 'artifact', '部署包']):
                current_section = 'artifacts'
                section_changed = True
            elif any(kw in line_lower for kw in ['迁移', 'migration', '数据库']) and not is_numbered_step:
                current_section = 'migration'
                section_changed = True
            elif any(kw in line_lower for kw in ['回滚', 'rollback', '应急']):
                current_section = 'rollback'
                section_changed = True
        
        if section_changed:
            continue
        
        if current_section == 'artifacts':
            artifact_match = re.search(r'([\w\-\.\/]+\.(jar|war|zip|tar\.gz|exe))', line, re.IGNORECASE)
            if artifact_match:
                path = artifact_match.group(1)
                name = os.path.basename(path)
                version_match = re.search(r'v?\d+\.\d+\.?\d*', path, re.IGNORECASE)
                version = version_match.group(0) if version_match else None
                artifacts.append(ArtifactCreate(name=name, path=path, version=version))
            else:
                path_match = re.search(r'[\w\-\.\/]+', line)
                if path_match:
                    path = path_match.group(0)
                    name = os.path.basename(path) or line[:30]
                    artifacts.append(ArtifactCreate(name=name, path=path))
        
        elif current_section == 'migration':
            script_match = re.search(r'([\w\-\.\/]+\.sql)', line, re.IGNORECASE)
            rollback_avail = '回滚' in line or 'rollback' in line_lower
            if script_match:
                path = script_match.group(1)
                name = os.path.basename(path)
                migration_scripts.append(MigrationScriptCreate(
                    name=name,
                    path=path,
                    description=line,
                    rollback_available=rollback_avail
                ))
            else:
                path_match = re.search(r'[\w\-\.\/]+', line)
                if path_match:
                    path = path_match.group(0)
                    name = os.path.basename(path) or line[:30]
                    migration_scripts.append(MigrationScriptCreate(
                        name=name,
                        path=path,
                        description=line,
                        rollback_available=rollback_avail
                    ))
        
        elif current_section == 'rollback':
            step_order_match = re.match(r'^[\d\-\.]+', line)
            step_order = len(rollback_steps) + 1
            if step_order_match:
                try:
                    step_text = step_order_match.group(0).replace('-', '').replace('.', '')
                    if step_text.isdigit():
                        step_order = int(step_text)
                except ValueError:
                    pass
            owner_match = re.search(r'负责人[:：]\s*(\w+)', line)
            owner = owner_match.group(1) if owner_match else None
            desc = re.sub(r'^[\d\-\.]+\s*', '', line)
            if desc:
                rollback_steps.append(RollbackStepCreate(
                    step_order=step_order,
                    description=desc,
                    owner=owner
                ))
    
    return {
        'artifacts': artifacts,
        'migration_scripts': migration_scripts,
        'rollback_steps': rollback_steps
    }


def apply_parsed_checklist(
    db: Session,
    checklist_id: int,
    parsed_data: Dict[str, Any],
    operator: str
) -> Optional[ReleaseChecklist]:
    checklist = get_checklist(db, checklist_id)
    if not checklist:
        return None
    
    db.query(Artifact).filter(Artifact.checklist_id == checklist_id).delete()
    for artifact in parsed_data['artifacts']:
        db_artifact = Artifact(checklist_id=checklist_id, **artifact.model_dump())
        db.add(db_artifact)
    
    db.query(MigrationScript).filter(MigrationScript.checklist_id == checklist_id).delete()
    for script in parsed_data['migration_scripts']:
        db_script = MigrationScript(checklist_id=checklist_id, **script.model_dump())
        db.add(db_script)
    
    db.query(RollbackStep).filter(RollbackStep.checklist_id == checklist_id).delete()
    for step in parsed_data['rollback_steps']:
        db_step = RollbackStep(checklist_id=checklist_id, **step.model_dump())
        db.add(db_step)
    
    checklist.updated_at = datetime.utcnow()
    
    audit_log = AuditLog(
        checklist_id=checklist_id,
        action="PARSE_APPLY",
        operator=operator,
        original_data=f"Parsed {len(parsed_data['artifacts'])} artifacts, {len(parsed_data['migration_scripts'])} migrations, {len(parsed_data['rollback_steps'])} rollback steps",
        conclusion="Checklist parsed and applied successfully"
    )
    db.add(audit_log)
    db.commit()
    db.refresh(checklist)
    return checklist
