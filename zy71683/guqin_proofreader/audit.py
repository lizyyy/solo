from __future__ import annotations
import json
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy.orm import Session
from models import AuditLog


def log_audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    version_id: Optional[int] = None,
    operator: Optional[str] = None,
    before: Optional[Dict] = None,
    after: Optional[Dict] = None,
    note: Optional[str] = None,
):
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        version_id=version_id,
        operator=operator,
        before_json=json.dumps(before, ensure_ascii=False, default=str) if before else None,
        after_json=json.dumps(after, ensure_ascii=False, default=str) if after else None,
        note=note,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.flush()
    return entry
