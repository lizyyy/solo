import uuid
from datetime import datetime
from typing import List, Optional

from .models import NoteEntry
from .db import Database


def add_note(
    db: Database,
    entity_type: str,
    entity_id: str,
    content: str,
    author: str = "system",
) -> NoteEntry:
    note = NoteEntry(
        note_id=f"NOTE_{uuid.uuid4().hex[:12]}",
        entity_type=entity_type,
        entity_id=entity_id,
        content=content,
        created_at=datetime.now().isoformat(),
        author=author,
    )
    db.add_note(note)
    return note


def get_notes(
    db: Database,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> List[NoteEntry]:
    return db.get_notes(entity_type=entity_type, entity_id=entity_id)


def extract_notes_from_data(data: dict, entity_type: str, entity_id: str) -> List[str]:
    notes = []
    if "notes" in data and data["notes"]:
        notes.append(data["notes"])
    if "备注" in data and data["备注"]:
        notes.append(data["备注"])
    if "remark" in data and data["remark"]:
        notes.append(data["remark"])
    return notes
