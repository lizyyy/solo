import json
import os
import csv
import shutil
from pathlib import Path
from typing import Dict, List, TypeVar, Type, Optional, Any, Callable
from datetime import datetime

from .models import (
    Student,
    Course,
    AttendanceRecord,
    MakeupApplication,
    AuditLog,
    ImportSession,
    generate_id,
    now_str,
)

T = TypeVar("T")


class DataStore:
    def __init__(self, base_dir: str = "."):
        self.base_path = Path(base_dir).absolute()
        self.data_dir = self.base_path / ".signin"
        self.input_dir = self.data_dir / "input"
        self.output_dir = self.data_dir / "output"
        self.ensure_dirs()

    def ensure_dirs(self):
        for d in [self.data_dir, self.input_dir, self.output_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def is_initialized(self) -> bool:
        return self.data_dir.exists()

    def _read_json(self, path: Path, default: Any) -> Any:
        if not path.exists():
            return default
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_json(self, path: Path, data: Any) -> None:
        tmp_path = path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)

    @property
    def _db_path(self) -> Path:
        return self.data_dir / "db.json"

    @property
    def _meta_path(self) -> Path:
        return self.data_dir / "meta.json"

    def _load_db(self) -> Dict[str, List[Dict[str, Any]]]:
        default = {
            "students": [],
            "courses": [],
            "attendance_records": [],
            "makeup_applications": [],
            "audit_logs": [],
            "import_sessions": [],
        }
        return self._read_json(self._db_path, default)

    def _save_db(self, db: Dict[str, List[Dict[str, Any]]]) -> None:
        self._write_json(self._db_path, db)

    def get_meta(self) -> Dict[str, Any]:
        return self._read_json(self._meta_path, {"initialized": False, "version": "1.0"})

    def set_meta(self, meta: Dict[str, Any]) -> None:
        self._write_json(self._meta_path, meta)

    def initialize(self) -> bool:
        if self.is_initialized():
            return False
        self.ensure_dirs()
        meta = self.get_meta()
        meta["initialized"] = True
        meta["initialized_at"] = now_str()
        self.set_meta(meta)
        self._save_db(self._load_db())
        return True

    def get_all(self, key: str, cls: Type[T]) -> List[T]:
        db = self._load_db()
        items = db.get(key, [])
        return [cls.from_dict(item) for item in items]

    def get_by_id(self, key: str, entity_id: str, cls: Type[T]) -> Optional[T]:
        for item in self.get_all(key, cls):
            if hasattr(item, "id") and item.id == entity_id:
                return item
        return None

    def add(self, key: str, entity: Any) -> None:
        db = self._load_db()
        if key not in db:
            db[key] = []
        db[key].append(entity.to_dict())
        self._save_db(db)

    def update(self, key: str, entity: Any, id_getter: Callable[[Any], str]) -> bool:
        db = self._load_db()
        items = db.get(key, [])
        entity_id = id_getter(entity)
        for i, item in enumerate(items):
            if item.get("id") == entity_id:
                items[i] = entity.to_dict()
                self._save_db(db)
                return True
        return False

    def delete(self, key: str, entity_id: str) -> bool:
        db = self._load_db()
        items = db.get(key, [])
        for i, item in enumerate(items):
            if item.get("id") == entity_id:
                del items[i]
                self._save_db(db)
                return True
        return False

    def add_audit_log(self, action: str, entity_type: str, entity_id: str,
                      before: Optional[Dict] = None, after: Optional[Dict] = None,
                      operator: str = "system", reason: str = "", detail: str = "") -> AuditLog:
        log = AuditLog(
            id=generate_id("audit", entity_type, entity_id),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
            operator=operator,
            timestamp=now_str(),
            reason=reason,
            detail=detail,
        )
        self.add("audit_logs", log)
        return log

    def get_students(self) -> List[Student]:
        return self.get_all("students", Student)

    def get_student(self, sid: str) -> Optional[Student]:
        return self.get_by_id("students", sid, Student)

    def get_student_by_phone(self, phone: str) -> List[Student]:
        return [s for s in self.get_students() if s.phone == phone]

    def get_student_by_name(self, name: str) -> List[Student]:
        return [s for s in self.get_students() if s.name == name]

    def add_student(self, s: Student) -> None:
        self.add("students", s)

    def update_student(self, s: Student) -> bool:
        return self.update("students", s, lambda x: x.id)

    def get_courses(self) -> List[Course]:
        return self.get_all("courses", Course)

    def get_course(self, cid: str) -> Optional[Course]:
        return self.get_by_id("courses", cid, Course)

    def get_course_by_name(self, name: str) -> Optional[Course]:
        for c in self.get_courses():
            if c.name == name:
                return c
        return None

    def add_course(self, c: Course) -> None:
        self.add("courses", c)

    def get_attendance_records(self) -> List[AttendanceRecord]:
        return self.get_all("attendance_records", AttendanceRecord)

    def get_attendance_for_course(self, course_id: str) -> List[AttendanceRecord]:
        return [r for r in self.get_attendance_records() if r.course_id == course_id]

    def get_attendance_for_student(self, student_id: str) -> List[AttendanceRecord]:
        return [r for r in self.get_attendance_records() if r.student_id == student_id]

    def add_attendance(self, r: AttendanceRecord) -> None:
        self.add("attendance_records", r)

    def update_attendance(self, r: AttendanceRecord) -> bool:
        return self.update("attendance_records", r, lambda x: x.id)

    def get_makeup_applications(self) -> List[MakeupApplication]:
        return self.get_all("makeup_applications", MakeupApplication)

    def get_makeup_for_course(self, course_id: str) -> List[MakeupApplication]:
        return [m for m in self.get_makeup_applications() if m.course_id == course_id]

    def add_makeup(self, m: MakeupApplication) -> None:
        self.add("makeup_applications", m)

    def update_makeup(self, m: MakeupApplication) -> bool:
        return self.update("makeup_applications", m, lambda x: x.id)

    def get_audit_logs(self, entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[AuditLog]:
        logs = self.get_all("audit_logs", AuditLog)
        if entity_type:
            logs = [l for l in logs if l.entity_type == entity_type]
        if entity_id:
            logs = [l for l in logs if l.entity_id == entity_id]
        return logs

    def add_import_session(self, session: ImportSession) -> None:
        self.add("import_sessions", session)

    def get_import_sessions(self) -> List[ImportSession]:
        return self.get_all("import_sessions", ImportSession)

    def get_import_session(self, import_id: str) -> Optional[ImportSession]:
        for s in self.get_import_sessions():
            if s.id == import_id or import_id in s.import_ids:
                return s
        return None
