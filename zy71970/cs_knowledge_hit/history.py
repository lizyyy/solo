from __future__ import annotations
import json
import os
import sqlite3
from datetime import datetime
from typing import Optional

from .models import HitResult, HitType, ReviewStatus, ReviewSession
from .errors import get_error


class HistoryStore:
    def __init__(self, db_path: str = "output/history.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()

    def _init_db(self):
        try:
            conn = self._get_conn()
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS hit_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    knowledge_id TEXT,
                    hit_type TEXT NOT NULL,
                    confidence REAL,
                    status TEXT NOT NULL,
                    reviewer_note TEXT DEFAULT '',
                    reviewed_by TEXT DEFAULT '',
                    reviewed_at TEXT,
                    matched_keywords TEXT DEFAULT '[]',
                    detail TEXT DEFAULT '',
                    override_history TEXT DEFAULT '[]',
                    session_id TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(conversation_id, session_id)
                );

                CREATE TABLE IF NOT EXISTS review_sessions (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    operator TEXT NOT NULL,
                    total_count INTEGER DEFAULT 0,
                    reviewed_count INTEGER DEFAULT 0,
                    pending_count INTEGER DEFAULT 0,
                    notes TEXT DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_hit_conv ON hit_results(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_hit_session ON hit_results(session_id);
                CREATE INDEX IF NOT EXISTS idx_session_created ON review_sessions(created_at);
            """)
            conn.commit()
            conn.close()
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower():
                raise RuntimeError(get_error("DB_LOCKED"))
            raise RuntimeError(get_error("DB_CORRUPT"))

    def _get_conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path, timeout=10)

    def save_session(self, session: ReviewSession):
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO review_sessions
                   (id, created_at, operator, total_count, reviewed_count, pending_count, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (session.id, session.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                 session.operator, session.total_count, session.reviewed_count,
                 session.pending_count, session.notes),
            )
            conn.commit()
        finally:
            conn.close()

    def save_hits(self, hits: list, session_id: str):
        conn = self._get_conn()
        try:
            for h in hits:
                conn.execute(
                    """INSERT OR REPLACE INTO hit_results
                       (conversation_id, knowledge_id, hit_type, confidence, status,
                        reviewer_note, reviewed_by, reviewed_at, matched_keywords,
                        detail, override_history, session_id, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (h.conversation_id, h.knowledge_id, h.hit_type.value,
                     h.confidence, h.status.value, h.reviewer_note,
                     h.reviewed_by,
                     h.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if h.reviewed_at else "",
                     json.dumps(h.matched_keywords, ensure_ascii=False),
                     h.detail,
                     json.dumps(h.override_history, ensure_ascii=False),
                     session_id,
                     datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                )
            conn.commit()
        finally:
            conn.close()

    def load_session(self, session_id: str) -> Optional[ReviewSession]:
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM review_sessions WHERE id = ?", (session_id,)
            ).fetchone()
            if not row:
                return None
            return ReviewSession(
                id=row[0],
                created_at=datetime.strptime(row[1], "%Y-%m-%d %H:%M:%S"),
                operator=row[2],
                total_count=row[3],
                reviewed_count=row[4],
                pending_count=row[5],
                notes=row[6],
            )
        finally:
            conn.close()

    def load_hits_by_session(self, session_id: str) -> list:
        conn = self._get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM hit_results WHERE session_id = ?", (session_id,)
            ).fetchall()
            return [self._row_to_hit(r) for r in rows]
        finally:
            conn.close()

    def load_latest_overrides(self) -> dict:
        conn = self._get_conn()
        try:
            rows = conn.execute(
                """SELECT conversation_id, hit_type, knowledge_id, reviewed_by, reviewed_at, override_history
                   FROM hit_results
                   WHERE status = 'overridden'
                   ORDER BY reviewed_at DESC"""
            ).fetchall()
            overrides = {}
            for r in rows:
                conv_id = r[0]
                if conv_id not in overrides:
                    overrides[conv_id] = {
                        "hit_type": r[1],
                        "knowledge_id": r[2],
                        "reviewer": r[3],
                        "time": r[4],
                        "override_history": json.loads(r[5]) if r[5] else [],
                    }
            return overrides
        finally:
            conn.close()

    def list_sessions(self, limit: int = 50) -> list:
        conn = self._get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM review_sessions ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            sessions = []
            for r in rows:
                sessions.append(ReviewSession(
                    id=r[0],
                    created_at=datetime.strptime(r[1], "%Y-%m-%d %H:%M:%S"),
                    operator=r[2],
                    total_count=r[3],
                    reviewed_count=r[4],
                    pending_count=r[5],
                    notes=r[6],
                ))
            return sessions
        finally:
            conn.close()

    def load_hits_for_export(self, session_id: Optional[str] = None) -> list:
        conn = self._get_conn()
        try:
            if session_id:
                rows = conn.execute(
                    "SELECT * FROM hit_results WHERE session_id = ? ORDER BY created_at",
                    (session_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM hit_results ORDER BY created_at DESC LIMIT 1000"
                ).fetchall()
            return [self._row_to_hit(r) for r in rows]
        finally:
            conn.close()

    def _row_to_hit(self, row) -> HitResult:
        return HitResult(
            conversation_id=row[1],
            knowledge_id=row[2],
            hit_type=HitType(row[3]),
            confidence=row[4],
            status=ReviewStatus(row[5]),
            reviewer_note=row[6] or "",
            reviewed_by=row[7] or "",
            reviewed_at=datetime.strptime(row[8], "%Y-%m-%d %H:%M:%S") if row[8] else None,
            matched_keywords=json.loads(row[9]) if row[9] else [],
            detail=row[10] or "",
            override_history=json.loads(row[11]) if row[11] else [],
        )

    def get_stats(self) -> dict:
        conn = self._get_conn()
        try:
            total = conn.execute("SELECT COUNT(*) FROM hit_results").fetchone()[0]
            by_type = {}
            for ht in HitType:
                count = conn.execute(
                    "SELECT COUNT(*) FROM hit_results WHERE hit_type = ?",
                    (ht.value,),
                ).fetchone()[0]
                by_type[ht.value] = count

            by_status = {}
            for st in ReviewStatus:
                count = conn.execute(
                    "SELECT COUNT(*) FROM hit_results WHERE status = ?",
                    (st.value,),
                ).fetchone()[0]
                by_status[st.value] = count

            session_count = conn.execute("SELECT COUNT(*) FROM review_sessions").fetchone()[0]
            return {
                "total_hits": total,
                "by_type": by_type,
                "by_status": by_status,
                "total_sessions": session_count,
            }
        finally:
            conn.close()
