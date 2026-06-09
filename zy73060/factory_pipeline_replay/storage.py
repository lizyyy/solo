"""本地 JSON 存储层
所有数据保存在 data/ 目录下，无需外部数据库，便于现场拷贝和离线使用。
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from .models import (
    ReplaySession, ReplayLine, HandoverRecord, RejudgeHistory,
    Remark, LineStatus, WorkOrderConclusion, to_dict
)

DATA_DIR = Path(__file__).parent / "data"
SESSIONS_FILE = DATA_DIR / "sessions.json"
HANDOVER_FILE = DATA_DIR / "handover_records.json"
REJUDGE_FILE = DATA_DIR / "rejudge_histories.json"


def _ensure_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for f in (SESSIONS_FILE, HANDOVER_FILE, REJUDGE_FILE):
        if not f.exists():
            f.write_text("[]", encoding="utf-8")


def _read_json(path: Path) -> List[Dict[str, Any]]:
    _ensure_files()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _write_json(path: Path, data: List[Dict[str, Any]]) -> None:
    _ensure_files()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------- ReplaySession ----------

def save_session(session: ReplaySession) -> None:
    records = _read_json(SESSIONS_FILE)
    # 若已存在同 session_id 则覆盖
    for i, s in enumerate(records):
        if s.get("session_id") == session.session_id:
            records[i] = to_dict(session)
            break
    else:
        records.append(to_dict(session))
    _write_json(SESSIONS_FILE, records)


def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    for s in _read_json(SESSIONS_FILE):
        if s.get("session_id") == session_id:
            return s
    return None


def list_sessions() -> List[Dict[str, Any]]:
    return _read_json(SESSIONS_FILE)


def find_session_by_date(date: str) -> Optional[Dict[str, Any]]:
    """按日期找最近的一次回放会话"""
    for s in reversed(_read_json(SESSIONS_FILE)):
        if s.get("started_at", "").startswith(date):
            return s
    return None


# ---------- HandoverRecord ----------

def save_handover(record: HandoverRecord) -> None:
    records = _read_json(HANDOVER_FILE)
    for i, h in enumerate(records):
        if h.get("handover_id") == record.handover_id:
            records[i] = to_dict(record)
            break
    else:
        records.append(to_dict(record))
    _write_json(HANDOVER_FILE, records)


def list_handovers(date: Optional[str] = None) -> List[Dict[str, Any]]:
    all_ = _read_json(HANDOVER_FILE)
    if date:
        return [h for h in all_ if h.get("date") == date]
    return all_


def find_handover_for_line(session_id: str, line_no: int) -> Optional[Dict[str, Any]]:
    """找某条回放行关联的交接记录"""
    for h in _read_json(HANDOVER_FILE):
        if line_no in h.get("changed_line_nos", []):
            return h
    return None


# ---------- RejudgeHistory ----------

def save_rejudge(history: RejudgeHistory) -> None:
    records = _read_json(REJUDGE_FILE)
    for i, r in enumerate(records):
        if r.get("history_id") == history.history_id:
            records[i] = to_dict(history)
            break
    else:
        records.append(to_dict(history))
    _write_json(REJUDGE_FILE, records)


def list_rejudges(work_order_id: Optional[str] = None, line_no: Optional[int] = None) -> List[Dict[str, Any]]:
    all_ = _read_json(REJUDGE_FILE)
    if work_order_id:
        all_ = [r for r in all_ if r.get("work_order_id") == work_order_id]
    if line_no is not None:
        all_ = [r for r in all_ if r.get("line_no") == line_no]
    return all_
