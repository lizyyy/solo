from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    ChangeDiff,
    ChangeOrder,
    ChangeOrderEntry,
    LedgerEntry,
    Repository,
    RepoStatus,
    TagAction,
    VersionTag,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS repository (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    current_tag TEXT,
    git_branch TEXT,
    git_head_short TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    error_detail TEXT
);

CREATE TABLE IF NOT EXISTS version_tag (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    tag_message TEXT NOT NULL DEFAULT '',
    change_order_id TEXT,
    operator TEXT NOT NULL DEFAULT '',
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    superseded_by TEXT,
    FOREIGN KEY (repo_id) REFERENCES repository(id)
);

CREATE TABLE IF NOT EXISTS change_order (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    entries TEXT NOT NULL DEFAULT '[]',
    content_hash TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    operator TEXT NOT NULL DEFAULT '',
    uploaded_at TEXT NOT NULL,
    superseded INTEGER NOT NULL DEFAULT 0,
    superseded_by_version INTEGER
);

CREATE TABLE IF NOT EXISTS change_diff (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    old_version INTEGER NOT NULL,
    new_version INTEGER NOT NULL,
    old_hash TEXT NOT NULL DEFAULT '',
    new_hash TEXT NOT NULL DEFAULT '',
    added_entries TEXT NOT NULL DEFAULT '[]',
    removed_entries TEXT NOT NULL DEFAULT '[]',
    modified_entries TEXT NOT NULL DEFAULT '[]',
    detected_at TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_by TEXT
);

CREATE TABLE IF NOT EXISTS ledger (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    repo_id TEXT,
    tag_id TEXT,
    change_order_id TEXT,
    diff_id TEXT,
    operator TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repo_path ON repository(path);
CREATE INDEX IF NOT EXISTS idx_tag_repo ON version_tag(repo_id);
CREATE INDEX IF NOT EXISTS idx_tag_confirmed ON version_tag(confirmed);
CREATE INDEX IF NOT EXISTS idx_co_order_id ON change_order(order_id);
CREATE INDEX IF NOT EXISTS idx_diff_order_id ON change_diff(order_id);
CREATE INDEX IF NOT EXISTS idx_diff_ack ON change_diff(acknowledged);
CREATE INDEX IF NOT EXISTS idx_ledger_ts ON ledger(timestamp);
CREATE INDEX IF NOT EXISTS idx_ledger_action ON ledger(action);
"""


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _now_iso() -> str:
    return datetime.now().isoformat()


class Store:
    def __init__(self, db_path: str | Path = "multi_repo_tag.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[sqlite3.Connection] = None
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def _init_db(self):
        conn = self._get_conn()
        conn.executescript(_SCHEMA)
        conn.commit()

    def close(self):
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def _row_to_repo(self, row: sqlite3.Row) -> Repository:
        return Repository(
            id=row["id"],
            path=row["path"],
            name=row["name"],
            status=RepoStatus(row["status"]),
            current_tag=row["current_tag"],
            git_branch=row["git_branch"],
            git_head_short=row["git_head_short"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            error_detail=row["error_detail"],
        )

    def _row_to_tag(self, row: sqlite3.Row) -> VersionTag:
        return VersionTag(
            id=row["id"],
            repo_id=row["repo_id"],
            tag_name=row["tag_name"],
            tag_message=row["tag_message"],
            change_order_id=row["change_order_id"],
            operator=row["operator"],
            confirmed=bool(row["confirmed"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            superseded_by=row["superseded_by"],
        )

    def _row_to_change_order(self, row: sqlite3.Row) -> ChangeOrder:
        entries = [ChangeOrderEntry(**e) for e in json.loads(row["entries"])]
        return ChangeOrder(
            id=row["id"],
            order_id=row["order_id"],
            entries=entries,
            content_hash=row["content_hash"],
            version=row["version"],
            operator=row["operator"],
            uploaded_at=datetime.fromisoformat(row["uploaded_at"]),
            superseded=bool(row["superseded"]),
            superseded_by_version=row["superseded_by_version"],
        )

    def _row_to_diff(self, row: sqlite3.Row) -> ChangeDiff:
        added = [ChangeOrderEntry(**e) for e in json.loads(row["added_entries"])]
        removed = [ChangeOrderEntry(**e) for e in json.loads(row["removed_entries"])]
        modified_raw = json.loads(row["modified_entries"])
        modified = [(ChangeOrderEntry(**m["old"]), ChangeOrderEntry(**m["new"])) for m in modified_raw]
        return ChangeDiff(
            id=row["id"],
            order_id=row["order_id"],
            old_version=row["old_version"],
            new_version=row["new_version"],
            old_hash=row["old_hash"],
            new_hash=row["new_hash"],
            added_entries=added,
            removed_entries=removed,
            modified_entries=modified,
            detected_at=datetime.fromisoformat(row["detected_at"]),
            acknowledged=bool(row["acknowledged"]),
            acknowledged_by=row["acknowledged_by"],
        )

    def _row_to_ledger(self, row: sqlite3.Row) -> LedgerEntry:
        return LedgerEntry(
            id=row["id"],
            action=TagAction(row["action"]),
            repo_id=row["repo_id"],
            tag_id=row["tag_id"],
            change_order_id=row["change_order_id"],
            diff_id=row["diff_id"],
            operator=row["operator"],
            detail=row["detail"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
        )

    def upsert_repo(self, repo: Repository) -> Repository:
        conn = self._get_conn()
        now = _now_iso()
        existing = conn.execute("SELECT id FROM repository WHERE path = ?", (repo.path,)).fetchone()
        if existing:
            conn.execute(
                """UPDATE repository SET name=?, status=?, current_tag=?, git_branch=?,
                   git_head_short=?, updated_at=?, error_detail=?
                   WHERE path=?""",
                (
                    repo.name,
                    repo.status.value,
                    repo.current_tag,
                    repo.git_branch,
                    repo.git_head_short,
                    now,
                    repo.error_detail,
                    repo.path,
                ),
            )
            repo.updated_at = datetime.fromisoformat(now)
            repo.id = existing["id"]
        else:
            if not repo.id:
                repo.id = _new_id()
            conn.execute(
                """INSERT INTO repository (id, path, name, status, current_tag, git_branch,
                   git_head_short, created_at, updated_at, error_detail)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    repo.id,
                    repo.path,
                    repo.name,
                    repo.status.value,
                    repo.current_tag,
                    repo.git_branch,
                    repo.git_head_short,
                    now,
                    now,
                    repo.error_detail,
                ),
            )
            repo.created_at = datetime.fromisoformat(now)
            repo.updated_at = datetime.fromisoformat(now)
        conn.commit()
        return repo

    def get_repo(self, repo_id: str) -> Optional[Repository]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM repository WHERE id = ?", (repo_id,)).fetchone()
        return self._row_to_repo(row) if row else None

    def get_repo_by_path(self, path: str) -> Optional[Repository]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM repository WHERE path = ?", (path,)).fetchone()
        return self._row_to_repo(row) if row else None

    def list_repos(self, status: Optional[RepoStatus] = None) -> list[Repository]:
        conn = self._get_conn()
        if status:
            rows = conn.execute("SELECT * FROM repository WHERE status = ? ORDER BY updated_at DESC", (status.value,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM repository ORDER BY updated_at DESC").fetchall()
        return [self._row_to_repo(r) for r in rows]

    def insert_tag(self, tag: VersionTag) -> VersionTag:
        conn = self._get_conn()
        now = _now_iso()
        if not tag.id:
            tag.id = _new_id()
        conn.execute(
            """INSERT INTO version_tag (id, repo_id, tag_name, tag_message, change_order_id,
               operator, confirmed, created_at, superseded_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                tag.id,
                tag.repo_id,
                tag.tag_name,
                tag.tag_message,
                tag.change_order_id,
                tag.operator,
                int(tag.confirmed),
                now,
                tag.superseded_by,
            ),
        )
        tag.created_at = datetime.fromisoformat(now)
        conn.commit()
        return tag

    def get_tag(self, tag_id: str) -> Optional[VersionTag]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM version_tag WHERE id = ?", (tag_id,)).fetchone()
        return self._row_to_tag(row) if row else None

    def get_tags_for_repo(self, repo_id: str, include_superseded: bool = False) -> list[VersionTag]:
        conn = self._get_conn()
        if include_superseded:
            rows = conn.execute("SELECT * FROM version_tag WHERE repo_id = ? ORDER BY created_at DESC", (repo_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM version_tag WHERE repo_id = ? AND superseded_by IS NULL ORDER BY created_at DESC", (repo_id,)).fetchall()
        return [self._row_to_tag(r) for r in rows]

    def confirm_tag(self, tag_id: str) -> Optional[VersionTag]:
        conn = self._get_conn()
        conn.execute("UPDATE version_tag SET confirmed = 1 WHERE id = ?", (tag_id,))
        conn.commit()
        return self.get_tag(tag_id)

    def supersede_tag(self, old_tag_id: str, new_tag_id: str):
        conn = self._get_conn()
        conn.execute("UPDATE version_tag SET superseded_by = ? WHERE id = ?", (new_tag_id, old_tag_id))
        conn.commit()

    def update_repo_tag(self, repo_id: str, tag_name: Optional[str], status: RepoStatus):
        conn = self._get_conn()
        now = _now_iso()
        conn.execute("UPDATE repository SET current_tag = ?, status = ?, updated_at = ? WHERE id = ?", (tag_name, status.value, now, repo_id))
        conn.commit()

    def get_latest_change_order(self, order_id: str) -> Optional[ChangeOrder]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM change_order WHERE order_id = ? ORDER BY version DESC LIMIT 1", (order_id,)).fetchone()
        return self._row_to_change_order(row) if row else None

    def get_all_versions_of_order(self, order_id: str) -> list[ChangeOrder]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM change_order WHERE order_id = ? ORDER BY version ASC", (order_id,)).fetchall()
        return [self._row_to_change_order(r) for r in rows]

    def insert_change_order(self, co: ChangeOrder) -> ChangeOrder:
        conn = self._get_conn()
        now = _now_iso()
        if not co.id:
            co.id = _new_id()
        conn.execute(
            """INSERT INTO change_order (id, order_id, entries, content_hash, version,
               operator, uploaded_at, superseded, superseded_by_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                co.id,
                co.order_id,
                json.dumps([e.model_dump() for e in co.entries]),
                co.content_hash,
                co.version,
                co.operator,
                now,
                int(co.superseded),
                co.superseded_by_version,
            ),
        )
        co.uploaded_at = datetime.fromisoformat(now)
        conn.commit()
        return co

    def mark_order_superseded(self, order_id: str, new_version: int):
        conn = self._get_conn()
        conn.execute("UPDATE change_order SET superseded = 1, superseded_by_version = ? WHERE order_id = ? AND superseded = 0", (new_version, order_id))
        conn.commit()

    def insert_diff(self, diff: ChangeDiff) -> ChangeDiff:
        conn = self._get_conn()
        now = _now_iso()
        if not diff.id:
            diff.id = _new_id()
        conn.execute(
            """INSERT INTO change_diff (id, order_id, old_version, new_version, old_hash,
               new_hash, added_entries, removed_entries, modified_entries, detected_at,
               acknowledged, acknowledged_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                diff.id,
                diff.order_id,
                diff.old_version,
                diff.new_version,
                diff.old_hash,
                diff.new_hash,
                json.dumps([e.model_dump() for e in diff.added_entries]),
                json.dumps([e.model_dump() for e in diff.removed_entries]),
                json.dumps([{"old": o.model_dump(), "new": n.model_dump()} for o, n in diff.modified_entries]),
                now,
                int(diff.acknowledged),
                diff.acknowledged_by,
            ),
        )
        diff.detected_at = datetime.fromisoformat(now)
        conn.commit()
        return diff

    def get_diff(self, diff_id: str) -> Optional[ChangeDiff]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM change_diff WHERE id = ?", (diff_id,)).fetchone()
        return self._row_to_diff(row) if row else None

    def get_diffs_for_order(self, order_id: str) -> list[ChangeDiff]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM change_diff WHERE order_id = ? ORDER BY detected_at DESC", (order_id,)).fetchall()
        return [self._row_to_diff(r) for r in rows]

    def get_unacknowledged_diffs(self) -> list[ChangeDiff]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM change_diff WHERE acknowledged = 0 ORDER BY detected_at DESC").fetchall()
        return [self._row_to_diff(r) for r in rows]

    def acknowledge_diff(self, diff_id: str, operator: str):
        conn = self._get_conn()
        conn.execute("UPDATE change_diff SET acknowledged = 1, acknowledged_by = ? WHERE id = ?", (operator, diff_id))
        conn.commit()

    def insert_ledger(self, entry: LedgerEntry) -> LedgerEntry:
        conn = self._get_conn()
        now = _now_iso()
        if not entry.id:
            entry.id = _new_id()
        conn.execute(
            """INSERT INTO ledger (id, action, repo_id, tag_id, change_order_id, diff_id,
               operator, detail, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                entry.id,
                entry.action.value,
                entry.repo_id,
                entry.tag_id,
                entry.change_order_id,
                entry.diff_id,
                entry.operator,
                entry.detail,
                now,
            ),
        )
        entry.timestamp = datetime.fromisoformat(now)
        conn.commit()
        return entry

    def query_ledger(
        self,
        action: Optional[TagAction] = None,
        repo_id: Optional[str] = None,
        operator: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: int = 200,
    ) -> list[LedgerEntry]:
        conn = self._get_conn()
        conditions = []
        params: list = []
        if action:
            conditions.append("action = ?")
            params.append(action.value)
        if repo_id:
            conditions.append("repo_id = ?")
            params.append(repo_id)
        if operator:
            conditions.append("operator = ?")
            params.append(operator)
        if since:
            conditions.append("timestamp >= ?")
            params.append(since.isoformat())
        if until:
            conditions.append("timestamp <= ?")
            params.append(until.isoformat())
        where = " AND ".join(conditions) if conditions else "1=1"
        sql = f"SELECT * FROM ledger WHERE {where} ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(sql, params).fetchall()
        return [self._row_to_ledger(r) for r in rows]

    def get_all_tags(self, confirmed_only: bool = False) -> list[VersionTag]:
        conn = self._get_conn()
        if confirmed_only:
            rows = conn.execute("SELECT * FROM version_tag WHERE confirmed = 1 AND superseded_by IS NULL ORDER BY created_at DESC").fetchall()
        else:
            rows = conn.execute("SELECT * FROM version_tag WHERE superseded_by IS NULL ORDER BY created_at DESC").fetchall()
        return [self._row_to_tag(r) for r in rows]

    def get_change_order(self, co_id: str) -> Optional[ChangeOrder]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM change_order WHERE id = ?", (co_id,)).fetchone()
        return self._row_to_change_order(row) if row else None
