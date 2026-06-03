import sqlite3
import json
import os
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "db", "gauge_inspection.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS point_cloud_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_no TEXT UNIQUE NOT NULL,
        import_time TEXT NOT NULL,
        imported_by TEXT DEFAULT 'system',
        raw_data TEXT NOT NULL,
        status TEXT DEFAULT 'pending_review',
        remark TEXT
    );

    CREATE TABLE IF NOT EXISTS safety_radius_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_no TEXT UNIQUE NOT NULL,
        import_time TEXT NOT NULL,
        imported_by TEXT DEFAULT 'ajing',
        raw_data TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        remark TEXT
    );

    CREATE TABLE IF NOT EXISTS coordinate_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_cloud_log_id INTEGER,
        safety_radius_table_id INTEGER,
        item_identifier TEXT NOT NULL,
        original_coord_x TEXT NOT NULL,
        original_coord_y TEXT NOT NULL,
        original_coord_z TEXT,
        coord_type_detected TEXT NOT NULL,
        is_mixed INTEGER DEFAULT 0,
        detected_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending_inspection',
        reserved_for_inspection INTEGER DEFAULT 1,
        FOREIGN KEY (point_cloud_log_id) REFERENCES point_cloud_logs(id),
        FOREIGN KEY (safety_radius_table_id) REFERENCES safety_radius_tables(id)
    );

    CREATE TABLE IF NOT EXISTS site_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coordinate_issue_id INTEGER NOT NULL,
        why_kept TEXT NOT NULL,
        missing_materials TEXT,
        next_action TEXT NOT NULL,
        contact_person TEXT NOT NULL,
        generated_time TEXT NOT NULL,
        last_updated_time TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (coordinate_issue_id) REFERENCES coordinate_issues(id)
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        step_name TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        started_time TEXT,
        completed_time TEXT,
        operator TEXT,
        remark TEXT
    );

    INSERT OR IGNORE INTO workflow_steps (step_name, step_order, status) VALUES
    ('点云抽稀日志第一次导入', 1, 'pending'),
    ('展陈设计师阿景补看安全半径表', 2, 'pending'),
    ('给现场班组看的说明更新', 3, 'pending');
    """)
    conn.commit()
    conn.close()

@dataclass
class PointCloudItem:
    identifier: str
    x: str
    y: str
    z: Optional[str] = None
    radius: Optional[str] = None
    remark: Optional[str] = None

@dataclass
class PointCloudLog:
    id: Optional[int] = None
    log_no: str = ""
    import_time: str = ""
    imported_by: str = "system"
    raw_data: str = ""
    status: str = "pending_review"
    remark: Optional[str] = None
    items: List[PointCloudItem] = field(default_factory=list)

    @classmethod
    def create(cls, log_no: str, items: List[Dict[str, Any]], imported_by: str = "system") -> "PointCloudLog":
        raw_data = json.dumps(items, ensure_ascii=False)
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO point_cloud_logs (log_no, import_time, imported_by, raw_data, status) VALUES (?, ?, ?, ?, ?)",
            (log_no, now, imported_by, raw_data, "pending_review")
        )
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return cls(
            id=log_id,
            log_no=log_no,
            import_time=now,
            imported_by=imported_by,
            raw_data=raw_data,
            status="pending_review",
            items=[PointCloudItem(**item) for item in items]
        )

    @classmethod
    def get_by_id(cls, log_id: int) -> Optional["PointCloudLog"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM point_cloud_logs WHERE id = ?", (log_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        data = dict(row)
        items = json.loads(data["raw_data"])
        return cls(
            id=data["id"],
            log_no=data["log_no"],
            import_time=data["import_time"],
            imported_by=data["imported_by"],
            raw_data=data["raw_data"],
            status=data["status"],
            remark=data["remark"],
            items=[PointCloudItem(**item) for item in items]
        )

    @classmethod
    def get_latest(cls) -> Optional["PointCloudLog"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM point_cloud_logs ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        data = dict(row)
        items = json.loads(data["raw_data"])
        return cls(
            id=data["id"],
            log_no=data["log_no"],
            import_time=data["import_time"],
            imported_by=data["imported_by"],
            raw_data=data["raw_data"],
            status=data["status"],
            remark=data["remark"],
            items=[PointCloudItem(**item) for item in items]
        )

@dataclass
class SafetyRadiusItem:
    identifier: str
    x: str
    y: str
    z: Optional[str] = None
    safety_radius: str = ""
    remark: Optional[str] = None

@dataclass
class SafetyRadiusTable:
    id: Optional[int] = None
    table_no: str = ""
    import_time: str = ""
    imported_by: str = "ajing"
    raw_data: str = ""
    status: str = "pending"
    remark: Optional[str] = None
    items: List[SafetyRadiusItem] = field(default_factory=list)

    @classmethod
    def create(cls, table_no: str, items: List[Dict[str, Any]], imported_by: str = "ajing") -> "SafetyRadiusTable":
        raw_data = json.dumps(items, ensure_ascii=False)
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO safety_radius_tables (table_no, import_time, imported_by, raw_data, status) VALUES (?, ?, ?, ?, ?)",
            (table_no, now, imported_by, raw_data, "reviewed_by_ajing")
        )
        table_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return cls(
            id=table_id,
            table_no=table_no,
            import_time=now,
            imported_by=imported_by,
            raw_data=raw_data,
            status="reviewed_by_ajing",
            items=[SafetyRadiusItem(**item) for item in items]
        )

    @classmethod
    def get_by_id(cls, table_id: int) -> Optional["SafetyRadiusTable"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM safety_radius_tables WHERE id = ?", (table_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        data = dict(row)
        items = json.loads(data["raw_data"])
        return cls(
            id=data["id"],
            table_no=data["table_no"],
            import_time=data["import_time"],
            imported_by=data["imported_by"],
            raw_data=data["raw_data"],
            status=data["status"],
            remark=data["remark"],
            items=[SafetyRadiusItem(**item) for item in items]
        )

    @classmethod
    def get_latest(cls) -> Optional["SafetyRadiusTable"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM safety_radius_tables ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        data = dict(row)
        items = json.loads(data["raw_data"])
        return cls(
            id=data["id"],
            table_no=data["table_no"],
            import_time=data["import_time"],
            imported_by=data["imported_by"],
            raw_data=data["raw_data"],
            status=data["status"],
            remark=data["remark"],
            items=[SafetyRadiusItem(**item) for item in items]
        )

@dataclass
class CoordinateIssue:
    id: Optional[int] = None
    point_cloud_log_id: Optional[int] = None
    safety_radius_table_id: Optional[int] = None
    item_identifier: str = ""
    original_coord_x: str = ""
    original_coord_y: str = ""
    original_coord_z: Optional[str] = None
    coord_type_detected: str = ""
    is_mixed: bool = False
    detected_time: str = ""
    status: str = "pending_inspection"
    reserved_for_inspection: bool = True

    @classmethod
    def create(cls, **kwargs) -> "CoordinateIssue":
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO coordinate_issues 
               (point_cloud_log_id, safety_radius_table_id, item_identifier, 
                original_coord_x, original_coord_y, original_coord_z, 
                coord_type_detected, is_mixed, detected_time, status, reserved_for_inspection)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                kwargs.get("point_cloud_log_id"),
                kwargs.get("safety_radius_table_id"),
                kwargs["item_identifier"],
                kwargs["original_coord_x"],
                kwargs["original_coord_y"],
                kwargs.get("original_coord_z"),
                kwargs["coord_type_detected"],
                1 if kwargs.get("is_mixed", False) else 0,
                now,
                kwargs.get("status", "pending_inspection"),
                1 if kwargs.get("reserved_for_inspection", True) else 0
            )
        )
        issue_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return cls(
            id=issue_id,
            detected_time=now,
            **{k: v for k, v in kwargs.items() if k != "detected_time"}
        )

    @classmethod
    def get_by_point_cloud_log_id(cls, log_id: int) -> List["CoordinateIssue"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM coordinate_issues WHERE point_cloud_log_id = ?", (log_id,))
        rows = cursor.fetchall()
        conn.close()
        return [
            cls(
                id=row["id"],
                point_cloud_log_id=row["point_cloud_log_id"],
                safety_radius_table_id=row["safety_radius_table_id"],
                item_identifier=row["item_identifier"],
                original_coord_x=row["original_coord_x"],
                original_coord_y=row["original_coord_y"],
                original_coord_z=row["original_coord_z"],
                coord_type_detected=row["coord_type_detected"],
                is_mixed=bool(row["is_mixed"]),
                detected_time=row["detected_time"],
                status=row["status"],
                reserved_for_inspection=bool(row["reserved_for_inspection"])
            )
            for row in rows
        ]

    @classmethod
    def get_all(cls) -> List["CoordinateIssue"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM coordinate_issues ORDER BY id DESC")
        rows = cursor.fetchall()
        conn.close()
        return [
            cls(
                id=row["id"],
                point_cloud_log_id=row["point_cloud_log_id"],
                safety_radius_table_id=row["safety_radius_table_id"],
                item_identifier=row["item_identifier"],
                original_coord_x=row["original_coord_x"],
                original_coord_y=row["original_coord_y"],
                original_coord_z=row["original_coord_z"],
                coord_type_detected=row["coord_type_detected"],
                is_mixed=bool(row["is_mixed"]),
                detected_time=row["detected_time"],
                status=row["status"],
                reserved_for_inspection=bool(row["reserved_for_inspection"])
            )
            for row in rows
        ]

    @classmethod
    def get_by_id(cls, issue_id: int) -> Optional["CoordinateIssue"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM coordinate_issues WHERE id = ?", (issue_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return cls(
            id=row["id"],
            point_cloud_log_id=row["point_cloud_log_id"],
            safety_radius_table_id=row["safety_radius_table_id"],
            item_identifier=row["item_identifier"],
            original_coord_x=row["original_coord_x"],
            original_coord_y=row["original_coord_y"],
            original_coord_z=row["original_coord_z"],
            coord_type_detected=row["coord_type_detected"],
            is_mixed=bool(row["is_mixed"]),
            detected_time=row["detected_time"],
            status=row["status"],
            reserved_for_inspection=bool(row["reserved_for_inspection"])
        )

    def update_status(self, new_status: str, safety_radius_table_id: Optional[int] = None) -> None:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if safety_radius_table_id:
            cursor.execute(
                "UPDATE coordinate_issues SET status = ?, safety_radius_table_id = ? WHERE id = ?",
                (new_status, safety_radius_table_id, self.id)
            )
        else:
            cursor.execute(
                "UPDATE coordinate_issues SET status = ? WHERE id = ?",
                (new_status, self.id)
            )
        conn.commit()
        conn.close()
        self.status = new_status
        if safety_radius_table_id:
            self.safety_radius_table_id = safety_radius_table_id

@dataclass
class SiteNote:
    id: Optional[int] = None
    coordinate_issue_id: int = 0
    why_kept: str = ""
    missing_materials: Optional[str] = None
    next_action: str = ""
    contact_person: str = ""
    generated_time: str = ""
    last_updated_time: str = ""
    version: int = 1

    @classmethod
    def create(cls, issue_id: int, why_kept: str, next_action: str, contact_person: str,
               missing_materials: Optional[str] = None) -> "SiteNote":
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO site_notes 
               (coordinate_issue_id, why_kept, missing_materials, next_action, 
                contact_person, generated_time, last_updated_time, version)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)""",
            (issue_id, why_kept, missing_materials, next_action, contact_person, now, now)
        )
        note_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return cls(
            id=note_id,
            coordinate_issue_id=issue_id,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_action=next_action,
            contact_person=contact_person,
            generated_time=now,
            last_updated_time=now,
            version=1
        )

    @classmethod
    def get_by_issue_id(cls, issue_id: int) -> Optional["SiteNote"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM site_notes WHERE coordinate_issue_id = ? ORDER BY version DESC LIMIT 1", (issue_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return cls(**dict(row))

    def update(self, why_kept: Optional[str] = None, missing_materials: Optional[str] = None,
               next_action: Optional[str] = None, contact_person: Optional[str] = None) -> "SiteNote":
        now = datetime.now().isoformat()
        new_version = self.version + 1
        updates = []
        params = []
        if why_kept is not None:
            updates.append("why_kept = ?")
            params.append(why_kept)
            self.why_kept = why_kept
        if missing_materials is not None:
            updates.append("missing_materials = ?")
            params.append(missing_materials)
            self.missing_materials = missing_materials
        if next_action is not None:
            updates.append("next_action = ?")
            params.append(next_action)
            self.next_action = next_action
        if contact_person is not None:
            updates.append("contact_person = ?")
            params.append(contact_person)
            self.contact_person = contact_person
        updates.append("last_updated_time = ?")
        params.append(now)
        updates.append("version = ?")
        params.append(new_version)
        params.append(self.id)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE site_notes SET {', '.join(updates)} WHERE id = ?",
            tuple(params)
        )
        conn.commit()
        conn.close()
        self.last_updated_time = now
        self.version = new_version
        return self

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class WorkflowStep:
    id: Optional[int] = None
    step_name: str = ""
    step_order: int = 0
    status: str = "pending"
    started_time: Optional[str] = None
    completed_time: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None

    @classmethod
    def get_all(cls) -> List["WorkflowStep"]:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workflow_steps ORDER BY step_order")
        rows = cursor.fetchall()
        conn.close()
        return [cls(**dict(row)) for row in rows]

    @classmethod
    def start_step(cls, step_order: int, operator: str) -> None:
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE workflow_steps SET status = 'in_progress', started_time = ?, operator = ? WHERE step_order = ?",
            (now, operator, step_order)
        )
        conn.commit()
        conn.close()

    @classmethod
    def complete_step(cls, step_order: int, remark: Optional[str] = None) -> None:
        now = datetime.now().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if remark:
            cursor.execute(
                "UPDATE workflow_steps SET status = 'completed', completed_time = ?, remark = ? WHERE step_order = ?",
                (now, remark, step_order)
            )
        else:
            cursor.execute(
                "UPDATE workflow_steps SET status = 'completed', completed_time = ? WHERE step_order = ?",
                (now, step_order)
            )
        conn.commit()
        conn.close()

    @classmethod
    def reset_all(cls) -> None:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE workflow_steps SET status = 'pending', started_time = NULL, completed_time = NULL, operator = NULL, remark = NULL"
        )
        conn.commit()
        conn.close()
