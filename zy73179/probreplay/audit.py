from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from .models import AuditEntry, SimParams, Material, StanceChange, SortInstability


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_entry(
    operator: str,
    input_dir: str,
    output_dir: str,
    params: SimParams,
    adjusted_param: Optional[str],
    materials: List[Material],
    stance_changes: List[StanceChange],
    sort_instabilities: List[SortInstability],
    summary: Dict[str, Any],
) -> AuditEntry:
    return AuditEntry(
        run_id=uuid.uuid4().hex[:12],
        at=_now(),
        operator=operator,
        input_dir=input_dir,
        output_dir=output_dir,
        params=params.to_dict(),
        adjusted_param=adjusted_param,
        material_ids=[m.id for m in materials],
        stance_changes=[s.to_dict() for s in stance_changes],
        sort_instabilities=[s.to_dict() for s in sort_instabilities],
        summary=summary,
    )


def append_audit(output_dir: str, entry: AuditEntry) -> str:
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, "audit_trail.jsonl")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
    return path


def read_audit(output_dir: str) -> List[Dict[str, Any]]:
    path = os.path.join(output_dir, "audit_trail.jsonl")
    if not os.path.isfile(path):
        return []
    entries: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries


def trace_stance_changes(
    entries: List[Dict[str, Any]],
    author: Optional[str] = None,
    material_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    found: List[Dict[str, Any]] = []
    for e in entries:
        for sc in e.get("stance_changes", []):
            if author and sc.get("author") != author:
                continue
            if material_id and sc.get("material_id") != material_id:
                continue
            found.append(
                {
                    "run_id": e.get("run_id"),
                    "at": e.get("at"),
                    "operator": e.get("operator"),
                    "material_id": sc.get("material_id"),
                    "title": sc.get("title"),
                    "author": sc.get("author"),
                    "from_stance": sc.get("from_stance"),
                    "to_stance": sc.get("to_stance"),
                    "reason": sc.get("reason"),
                    "changed_at": sc.get("at"),
                }
            )
    return found
