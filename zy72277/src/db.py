import sqlite3
import json
from typing import List, Dict, Any, Optional
from datetime import datetime


DB_PATH = "data/trajectory.db"


def get_conn(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    conn = get_conn(db_path)
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS trajectory_points (
        point_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        speed REAL,
        heading REAL,
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );

    CREATE TABLE IF NOT EXISTS rangefinder_records (
        record_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        source_batch TEXT NOT NULL,
        import_time TEXT NOT NULL,
        obstacle_name TEXT NOT NULL,
        obstacle_type TEXT NOT NULL,
        distance REAL NOT NULL,
        angle REAL NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        raw_conclusion TEXT NOT NULL,
        confidence REAL NOT NULL,
        imported_by TEXT NOT NULL,
        is_duplicate INTEGER NOT NULL DEFAULT 0,
        duplicate_of TEXT,
        import_hash TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rf_hash ON rangefinder_records(import_hash);
    CREATE INDEX IF NOT EXISTS idx_rf_task ON rangefinder_records(task_id);

    CREATE TABLE IF NOT EXISTS obstacle_remarks (
        remark_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        obstacle_name TEXT NOT NULL,
        obstacle_type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        field_remark TEXT NOT NULL,
        conclusion TEXT NOT NULL,
        submit_time TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'group_chat_supplement',
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_rem_task ON obstacle_remarks(task_id);

    CREATE TABLE IF NOT EXISTS conflicts (
        conflict_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        rangefinder_record_id TEXT NOT NULL,
        remark_id TEXT,
        rangefinder_value TEXT,
        remark_value TEXT,
        description TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        confirm_status TEXT NOT NULL DEFAULT 'pending',
        decided_by TEXT,
        decided_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_conf_task ON conflicts(task_id);

    CREATE TABLE IF NOT EXISTS alias_candidates (
        candidate_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        primary_name TEXT NOT NULL,
        alias_name TEXT NOT NULL,
        similarity REAL NOT NULL,
        distance_meters REAL NOT NULL,
        primary_record_id TEXT NOT NULL,
        alias_record_id TEXT NOT NULL,
        confirm_status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_alias_task ON alias_candidates(task_id);

    CREATE TABLE IF NOT EXISTS annotations (
        annotation_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        obstacle_type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        radius REAL NOT NULL,
        source_records TEXT NOT NULL DEFAULT '[]',
        source_remarks TEXT NOT NULL DEFAULT '[]',
        final_conclusion TEXT NOT NULL,
        has_name_alias_issue INTEGER NOT NULL DEFAULT 0,
        needs_review INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        previous_version TEXT,
        change_reason TEXT,
        calculation_meta TEXT NOT NULL DEFAULT '{}',
        alias_candidate_ids TEXT NOT NULL DEFAULT '[]',
        conflict_ids TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ann_task ON annotations(task_id);

    CREATE TABLE IF NOT EXISTS results (
        result_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        is_latest INTEGER NOT NULL DEFAULT 1,
        creation_time TEXT NOT NULL,
        calculation_meta TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_res_task ON results(task_id);

    CREATE TABLE IF NOT EXISTS operations_log (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        operator TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_log_task ON operations_log(task_id);
    """)
    conn.commit()
    conn.close()


def _now() -> str:
    return datetime.now().isoformat()


def _json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)


def _json_loads(s: str) -> Any:
    return json.loads(s) if s else None


class TaskRepo:
    @staticmethod
    def create(task_id: str) -> None:
        conn = get_conn()
        conn.execute("INSERT OR IGNORE INTO tasks (task_id, created_at, status) VALUES (?,?,?)",
                      (task_id, _now(), "active"))
        conn.commit()
        conn.close()

    @staticmethod
    def get(task_id: str) -> Optional[Dict]:
        conn = get_conn()
        row = conn.execute("SELECT * FROM tasks WHERE task_id=?", (task_id,)).fetchone()
        conn.close()
        return dict(row) if row else None


class TrajectoryPointRepo:
    @staticmethod
    def save_batch(task_id: str, points: List[Dict]) -> None:
        conn = get_conn()
        conn.execute("DELETE FROM trajectory_points WHERE task_id=?", (task_id,))
        for p in points:
            conn.execute(
                "INSERT INTO trajectory_points (point_id,task_id,timestamp,latitude,longitude,altitude,speed,heading) VALUES (?,?,?,?,?,?,?,?)",
                (p.get("point_id", ""), task_id, p["timestamp"], p["latitude"], p["longitude"],
                 p.get("altitude"), p.get("speed"), p.get("heading")))
        conn.commit()
        conn.close()

    @staticmethod
    def list_by_task(task_id: str) -> List[Dict]:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM trajectory_points WHERE task_id=? ORDER BY timestamp", (task_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]


class RangefinderRepo:
    @staticmethod
    def save_batch(task_id: str, records: List[Dict]) -> None:
        conn = get_conn()
        for r in records:
            conn.execute(
                "INSERT OR REPLACE INTO rangefinder_records "
                "(record_id,task_id,source_batch,import_time,obstacle_name,obstacle_type,"
                "distance,angle,latitude,longitude,altitude,raw_conclusion,confidence,"
                "imported_by,is_duplicate,duplicate_of,import_hash) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (r["record_id"], task_id, r["source_batch"], r["import_time"],
                 r["obstacle_name"], r["obstacle_type"], r["distance"], r["angle"],
                 r["latitude"], r["longitude"], r.get("altitude"), r["raw_conclusion"],
                 r["confidence"], r["imported_by"], int(r["is_duplicate"]),
                 r.get("duplicate_of"), r["import_hash"]))
        conn.commit()
        conn.close()

    @staticmethod
    def list_by_task(task_id: str) -> List[Dict]:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM rangefinder_records WHERE task_id=? ORDER BY import_time", (task_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def find_by_hash(task_id: str, import_hash: str) -> Optional[Dict]:
        conn = get_conn()
        row = conn.execute("SELECT * FROM rangefinder_records WHERE task_id=? AND import_hash=? AND is_duplicate=0 LIMIT 1",
                           (task_id, import_hash)).fetchone()
        conn.close()
        return dict(row) if row else None


class RemarkRepo:
    @staticmethod
    def save(task_id: str, remark: Dict) -> None:
        conn = get_conn()
        conn.execute(
            "INSERT OR REPLACE INTO obstacle_remarks "
            "(remark_id,task_id,obstacle_name,obstacle_type,latitude,longitude,altitude,"
            "field_remark,conclusion,submit_time,submitted_by,source) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (remark["remark_id"], task_id, remark["obstacle_name"], remark["obstacle_type"],
             remark["latitude"], remark["longitude"], remark.get("altitude"),
             remark["field_remark"], remark["conclusion"], remark["submit_time"],
             remark["submitted_by"], remark.get("source", "group_chat_supplement")))
        conn.commit()
        conn.close()

    @staticmethod
    def list_by_task(task_id: str) -> List[Dict]:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM obstacle_remarks WHERE task_id=? ORDER BY submit_time", (task_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]


class ConflictRepo:
    @staticmethod
    def save_batch(task_id: str, conflicts: List[Dict]) -> None:
        conn = get_conn()
        for c in conflicts:
            conn.execute(
                "INSERT OR REPLACE INTO conflicts "
                "(conflict_id,task_id,conflict_type,rangefinder_record_id,remark_id,"
                "rangefinder_value,remark_value,description,detected_at,confirm_status,decided_by,decided_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (c["conflict_id"], task_id, c["conflict_type"], c["rangefinder_record_id"],
                 c.get("remark_id"), _json_dumps(c.get("rangefinder_value")),
                 _json_dumps(c.get("remark_value")), c["description"], c["detected_at"],
                 c["confirm_status"], c.get("decided_by"), c.get("decided_at")))
        conn.commit()
        conn.close()

    @staticmethod
    def list_by_task(task_id: str) -> List[Dict]:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM conflicts WHERE task_id=? ORDER BY detected_at", (task_id,)).fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d["rangefinder_value"] = _json_loads(d["rangefinder_value"])
            d["remark_value"] = _json_loads(d["remark_value"])
            result.append(d)
        return result

    @staticmethod
    def update_status(task_id: str, conflict_id: str, status: str, decided_by: str, decided_at: str) -> None:
        conn = get_conn()
        conn.execute(
            "UPDATE conflicts SET confirm_status=?, decided_by=?, decided_at=? WHERE conflict_id=? AND task_id=?",
            (status, decided_by, decided_at, conflict_id, task_id))
        conn.commit()
        conn.close()


class AliasCandidateRepo:
    @staticmethod
    def save_batch(task_id: str, candidates: List[Dict]) -> None:
        conn = get_conn()
        conn.execute("DELETE FROM alias_candidates WHERE task_id=?", (task_id,))
        for ac in candidates:
            conn.execute(
                "INSERT INTO alias_candidates "
                "(candidate_id,task_id,primary_name,alias_name,similarity,distance_meters,"
                "primary_record_id,alias_record_id,confirm_status,reviewed_by,reviewed_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (ac["candidate_id"], task_id, ac["primary_name"], ac["alias_name"],
                 ac["similarity"], ac["distance_meters"], ac["primary_record_id"],
                 ac["alias_record_id"], ac["confirm_status"], ac.get("reviewed_by"),
                 ac.get("reviewed_at")))
        conn.commit()
        conn.close()

    @staticmethod
    def list_by_task(task_id: str) -> List[Dict]:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM alias_candidates WHERE task_id=?", (task_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def update_status(task_id: str, candidate_id: str, status: str, reviewed_by: str, reviewed_at: str) -> None:
        conn = get_conn()
        conn.execute(
            "UPDATE alias_candidates SET confirm_status=?, reviewed_by=?, reviewed_at=? WHERE candidate_id=? AND task_id=?",
            (status, reviewed_by, reviewed_at, candidate_id, task_id))
        conn.commit()
        conn.close()


class AnnotationRepo:
    @staticmethod
    def save_batch(task_id: str, version: int, annotations: List[Dict]) -> None:
        conn = get_conn()
        conn.execute("DELETE FROM annotations WHERE task_id=? AND version=?", (task_id, version))
        for a in annotations:
            conn.execute(
                "INSERT INTO annotations "
                "(annotation_id,task_id,canonical_name,obstacle_type,latitude,longitude,altitude,radius,"
                "source_records,source_remarks,final_conclusion,has_name_alias_issue,needs_review,"
                "version,previous_version,change_reason,calculation_meta,alias_candidate_ids,conflict_ids) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (a["annotation_id"], task_id, a["canonical_name"], a["obstacle_type"],
                 a["latitude"], a["longitude"], a.get("altitude"), a["radius"],
                 _json_dumps(a.get("source_records", [])), _json_dumps(a.get("source_remarks", [])),
                 a["final_conclusion"], int(a["has_name_alias_issue"]), int(a["needs_review"]),
                 a["version"], a.get("previous_version"), a.get("change_reason"),
                 _json_dumps(a.get("calculation_meta", {})),
                 _json_dumps(a.get("alias_candidate_ids", [])),
                 _json_dumps(a.get("conflict_ids", []))))
        conn.commit()
        conn.close()

    @staticmethod
    def list_by_task(task_id: str, version: Optional[int] = None) -> List[Dict]:
        conn = get_conn()
        if version is not None:
            rows = conn.execute("SELECT * FROM annotations WHERE task_id=? AND version=? ORDER BY canonical_name",
                                (task_id, version)).fetchall()
        else:
            rows = conn.execute(
                "SELECT a.* FROM annotations a "
                "JOIN results r ON a.task_id=r.task_id AND a.version=r.version AND r.is_latest=1 "
                "WHERE a.task_id=? ORDER BY a.canonical_name", (task_id,)).fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d["source_records"] = _json_loads(d["source_records"])
            d["source_remarks"] = _json_loads(d["source_remarks"])
            d["calculation_meta"] = _json_loads(d["calculation_meta"])
            d["alias_candidate_ids"] = _json_loads(d["alias_candidate_ids"])
            d["conflict_ids"] = _json_loads(d["conflict_ids"])
            d["has_name_alias_issue"] = bool(d["has_name_alias_issue"])
            d["needs_review"] = bool(d["needs_review"])
            result.append(d)
        return result


class ResultRepo:
    @staticmethod
    def save(task_id: str, result_id: str, version: int, is_latest: int, calculation_meta: Dict) -> None:
        conn = get_conn()
        if is_latest:
            conn.execute("UPDATE results SET is_latest=0 WHERE task_id=?", (task_id,))
        conn.execute(
            "INSERT INTO results (result_id,task_id,version,is_latest,creation_time,calculation_meta) VALUES (?,?,?,?,?,?)",
            (result_id, task_id, version, is_latest, _now(), _json_dumps(calculation_meta)))
        conn.commit()
        conn.close()

    @staticmethod
    def get_latest(task_id: str) -> Optional[Dict]:
        conn = get_conn()
        row = conn.execute("SELECT * FROM results WHERE task_id=? AND is_latest=1", (task_id,)).fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        d["calculation_meta"] = _json_loads(d["calculation_meta"])
        return d

    @staticmethod
    def list_by_task(task_id: str) -> List[Dict]:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM results WHERE task_id=? ORDER BY version", (task_id,)).fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d["calculation_meta"] = _json_loads(d["calculation_meta"])
            result.append(d)
        return result


class LogRepo:
    @staticmethod
    def append(task_id: str, operator: str, action: str, detail: str) -> None:
        conn = get_conn()
        conn.execute("INSERT INTO operations_log (task_id,timestamp,operator,action,detail) VALUES (?,?,?,?,?)",
                      (task_id, _now(), operator, action, detail))
        conn.commit()
        conn.close()

    @staticmethod
    def list_by_task(task_id: str) -> List[Dict]:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM operations_log WHERE task_id=? ORDER BY log_id", (task_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
