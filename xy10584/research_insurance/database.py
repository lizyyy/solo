import sqlite3
import json
from contextlib import contextmanager
from typing import Optional, List, Dict, Any
from datetime import datetime

from .config import get_db_path, ensure_dirs
from .models import (
    Student, StudentStatus, Insurance, Authorization, Vehicle,
    Withdrawal, AuditLog, CheckReport, CheckResult
)


def _get_now() -> str:
    return datetime.now().isoformat(timespec='seconds')


SCHEMA = '''
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    id_card TEXT NOT NULL,
    school TEXT,
    class_name TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(id_card)
);

CREATE TABLE IF NOT EXISTS insurances (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_id_card TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    insurance_company TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'valid',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(policy_number)
);

CREATE TABLE IF NOT EXISTS authorizations (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    student_id_card TEXT NOT NULL,
    guardian_name TEXT NOT NULL,
    guardian_id_card TEXT,
    relation TEXT,
    signature_status INTEGER NOT NULL DEFAULT 0,
    emergency_contact TEXT,
    emergency_phone TEXT,
    medical_allergy TEXT,
    special_needs TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(student_id_card)
);

CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    plate_number TEXT NOT NULL UNIQUE,
    driver_name TEXT,
    driver_phone TEXT,
    capacity INTEGER NOT NULL DEFAULT 0,
    route TEXT,
    student_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_id_card TEXT NOT NULL,
    reason TEXT NOT NULL,
    withdrawal_date TEXT NOT NULL,
    operator TEXT NOT NULL,
    refund_status TEXT NOT NULL DEFAULT 'pending',
    insurance_voided INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    operator TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    reason TEXT
);

CREATE TABLE IF NOT EXISTS check_reports (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_id_card TEXT NOT NULL,
    result TEXT NOT NULL,
    issues_json TEXT NOT NULL DEFAULT '[]',
    warnings_json TEXT NOT NULL DEFAULT '[]',
    ok_items_json TEXT NOT NULL DEFAULT '[]',
    check_time TEXT NOT NULL,
    is_withdrawn INTEGER NOT NULL DEFAULT 0,
    UNIQUE(student_id, check_time)
);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_id_card ON students(id_card);
CREATE INDEX IF NOT EXISTS idx_insurances_student_id_card ON insurances(student_id_card);
CREATE INDEX IF NOT EXISTS idx_authorizations_student_id_card ON authorizations(student_id_card);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_check_reports_student ON check_reports(student_id);
'''


@contextmanager
def get_conn():
    ensure_dirs()
    conn = sqlite3.connect(str(get_db_path()), check_same_thread=False, timeout=30.0)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA synchronous=NORMAL')
    conn.execute('PRAGMA busy_timeout=30000')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        cur = conn.cursor()
        cur.execute("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)", 
                    ('initialized_at', _get_now()))


def _dict_to_json(d: Optional[Dict]) -> Optional[str]:
    if d is None:
        return None
    return json.dumps(d, ensure_ascii=False)


def _json_to_dict(s: Optional[str]) -> Optional[Dict]:
    if s is None:
        return None
    try:
        return json.loads(s)
    except:
        return None


def _row_to_student(row) -> Student:
    return Student(
        id=row['id'],
        name=row['name'],
        id_card=row['id_card'],
        school=row['school'],
        class_name=row['class_name'],
        guardian_name=row['guardian_name'],
        guardian_phone=row['guardian_phone'],
        status=StudentStatus(row['status']),
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


def _row_to_insurance(row) -> Insurance:
    return Insurance(
        id=row['id'],
        student_name=row['student_name'],
        student_id_card=row['student_id_card'],
        policy_number=row['policy_number'],
        insurance_company=row['insurance_company'],
        start_date=row['start_date'],
        end_date=row['end_date'],
        amount=row['amount'],
        status=row['status'],
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


def _row_to_authorization(row) -> Authorization:
    return Authorization(
        id=row['id'],
        student_name=row['student_name'],
        student_id_card=row['student_id_card'],
        guardian_name=row['guardian_name'],
        guardian_id_card=row['guardian_id_card'],
        relation=row['relation'],
        signature_status=bool(row['signature_status']),
        emergency_contact=row['emergency_contact'],
        emergency_phone=row['emergency_phone'],
        medical_allergy=row['medical_allergy'],
        special_needs=row['special_needs'],
        created_at=row['created_at'],
    )


def _row_to_vehicle(row) -> Vehicle:
    return Vehicle(
        id=row['id'],
        plate_number=row['plate_number'],
        driver_name=row['driver_name'],
        driver_phone=row['driver_phone'],
        capacity=row['capacity'],
        route=row['route'],
        student_ids=_json_to_dict(row['student_ids_json']) or [],
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


def _row_to_withdrawal(row) -> Withdrawal:
    return Withdrawal(
        id=row['id'],
        student_id=row['student_id'],
        student_name=row['student_name'],
        student_id_card=row['student_id_card'],
        reason=row['reason'],
        withdrawal_date=row['withdrawal_date'],
        operator=row['operator'],
        refund_status=row['refund_status'],
        insurance_voided=bool(row['insurance_voided']),
        created_at=row['created_at'],
    )


def _row_to_audit_log(row) -> AuditLog:
    return AuditLog(
        id=row['id'],
        operation=row['operation'],
        entity_type=row['entity_type'],
        entity_id=row['entity_id'],
        before=_json_to_dict(row['before_json']),
        after=_json_to_dict(row['after_json']),
        operator=row['operator'],
        timestamp=row['timestamp'],
        reason=row['reason'] or '',
    )


def _row_to_check_report(row) -> CheckReport:
    return CheckReport(
        student_id=row['student_id'],
        student_name=row['student_name'],
        student_id_card=row['student_id_card'],
        result=CheckResult(row['result']),
        issues=_json_to_dict(row['issues_json']) or [],
        warnings=_json_to_dict(row['warnings_json']) or [],
        ok_items=_json_to_dict(row['ok_items_json']) or [],
        check_time=row['check_time'],
        is_withdrawn=bool(row['is_withdrawn']),
    )


def _make_audit_log(operation: str, entity_type: str, entity_id: str,
                    before: Optional[Dict], after: Optional[Dict],
                    operator: str, reason: str = '') -> Dict:
    return {
        'id': f'audit_{int(datetime.now().timestamp() * 1000000)}',
        'operation': operation,
        'entity_type': entity_type,
        'entity_id': entity_id,
        'before_json': _dict_to_json(before),
        'after_json': _dict_to_json(after),
        'operator': operator,
        'timestamp': _get_now(),
        'reason': reason or '',
    }


def _insert_audit(conn, log_data: Dict):
    conn.execute('''
        INSERT INTO audit_logs (id, operation, entity_type, entity_id,
            before_json, after_json, operator, timestamp, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (log_data['id'], log_data['operation'], log_data['entity_type'],
          log_data['entity_id'], log_data['before_json'], log_data['after_json'],
          log_data['operator'], log_data['timestamp'], log_data['reason']))


class StudentRepo:
    @staticmethod
    def add(student: Student, operator: str = 'system', reason: str = '') -> bool:
        now = _get_now()
        student.created_at = now
        student.updated_at = now
        try:
            with get_conn() as conn:
                conn.execute('''
                    INSERT INTO students (id, name, id_card, school, class_name, 
                        guardian_name, guardian_phone, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (student.id, student.name, student.id_card, student.school,
                      student.class_name, student.guardian_name, student.guardian_phone,
                      student.status.value, student.created_at, student.updated_at))
                log = _make_audit_log('create', 'student', student.id,
                                      None, _student_to_dict(student), operator, reason)
                _insert_audit(conn, log)
            return True
        except sqlite3.IntegrityError:
            return False

    @staticmethod
    def get_by_id(sid: str) -> Optional[Student]:
        with get_conn() as conn:
            row = conn.execute('SELECT * FROM students WHERE id = ?', (sid,)).fetchone()
            return _row_to_student(row) if row else None

    @staticmethod
    def get_by_id_card(id_card: str) -> Optional[Student]:
        with get_conn() as conn:
            row = conn.execute('SELECT * FROM students WHERE id_card = ?', (id_card,)).fetchone()
            return _row_to_student(row) if row else None

    @staticmethod
    def get_all() -> List[Student]:
        with get_conn() as conn:
            rows = conn.execute('SELECT * FROM students ORDER BY created_at').fetchall()
            return [_row_to_student(r) for r in rows]

    @staticmethod
    def update(student: Student, operator: str, reason: str = '') -> bool:
        old = StudentRepo.get_by_id(student.id)
        if not old:
            return False
        old_dict = _student_to_dict(old)
        student.updated_at = _get_now()
        with get_conn() as conn:
            conn.execute('''
                UPDATE students SET name=?, id_card=?, school=?, class_name=?,
                    guardian_name=?, guardian_phone=?, status=?, updated_at=?
                WHERE id=?
            ''', (student.name, student.id_card, student.school, student.class_name,
                  student.guardian_name, student.guardian_phone, student.status.value,
                  student.updated_at, student.id))
            log = _make_audit_log('update', 'student', student.id,
                                  old_dict, _student_to_dict(student), operator, reason)
            _insert_audit(conn, log)
        return True

    @staticmethod
    def get_duplicates() -> List[Dict]:
        with get_conn() as conn:
            rows = conn.execute('''
                SELECT id_card, COUNT(*) as cnt, GROUP_CONCAT(name) as names, 
                       GROUP_CONCAT(id) as ids
                FROM students 
                GROUP BY id_card 
                HAVING COUNT(*) > 1
            ''').fetchall()
            return [dict(r) for r in rows]


def _student_to_dict(s: Student) -> Dict:
    return {
        'id': s.id, 'name': s.name, 'id_card': s.id_card,
        'school': s.school, 'class_name': s.class_name,
        'guardian_name': s.guardian_name, 'guardian_phone': s.guardian_phone,
        'status': s.status.value,
    }


class InsuranceRepo:
    @staticmethod
    def add(insurance: Insurance, operator: str = 'system', reason: str = '') -> bool:
        now = _get_now()
        insurance.created_at = now
        insurance.updated_at = now
        try:
            with get_conn() as conn:
                conn.execute('''
                    INSERT INTO insurances (id, student_name, student_id_card, policy_number,
                        insurance_company, start_date, end_date, amount, status, 
                        created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (insurance.id, insurance.student_name, insurance.student_id_card,
                      insurance.policy_number, insurance.insurance_company,
                      insurance.start_date, insurance.end_date, insurance.amount,
                      insurance.status, insurance.created_at, insurance.updated_at))
                log = _make_audit_log('create', 'insurance', insurance.id,
                                      None, _insurance_to_dict(insurance), operator, reason)
                _insert_audit(conn, log)
            return True
        except sqlite3.IntegrityError:
            return False

    @staticmethod
    def get_by_student_id_card(id_card: str) -> Optional[Insurance]:
        with get_conn() as conn:
            row = conn.execute('''
                SELECT * FROM insurances 
                WHERE student_id_card = ? 
                ORDER BY created_at DESC
            ''', (id_card,)).fetchone()
            return _row_to_insurance(row) if row else None

    @staticmethod
    def get_by_policy(policy_number: str) -> Optional[Insurance]:
        with get_conn() as conn:
            row = conn.execute('SELECT * FROM insurances WHERE policy_number = ?',
                               (policy_number,)).fetchone()
            return _row_to_insurance(row) if row else None

    @staticmethod
    def get_all() -> List[Insurance]:
        with get_conn() as conn:
            rows = conn.execute('SELECT * FROM insurances ORDER BY created_at').fetchall()
            return [_row_to_insurance(r) for r in rows]

    @staticmethod
    def void_for_student(id_card: str, operator: str, reason: str = '退团保险作废') -> bool:
        with get_conn() as conn:
            rows = conn.execute('SELECT * FROM insurances WHERE student_id_card = ?',
                                (id_card,)).fetchall()
            for row in rows:
                ins = _row_to_insurance(row)
                old_dict = _insurance_to_dict(ins)
                ins.status = 'voided'
                ins.updated_at = _get_now()
                conn.execute('UPDATE insurances SET status=?, updated_at=? WHERE id=?',
                             (ins.status, ins.updated_at, ins.id))
                log = _make_audit_log('void', 'insurance', ins.id,
                                      old_dict, _insurance_to_dict(ins), operator, reason)
                _insert_audit(conn, log)
            return len(rows) > 0


def _insurance_to_dict(i: Insurance) -> Dict:
    return {
        'id': i.id, 'student_name': i.student_name, 'student_id_card': i.student_id_card,
        'policy_number': i.policy_number, 'insurance_company': i.insurance_company,
        'start_date': i.start_date, 'end_date': i.end_date, 'amount': i.amount,
        'status': i.status,
    }


class AuthorizationRepo:
    @staticmethod
    def add(auth: Authorization, operator: str = 'system', reason: str = '') -> bool:
        auth.created_at = _get_now()
        try:
            with get_conn() as conn:
                conn.execute('''
                    INSERT INTO authorizations (id, student_name, student_id_card, 
                        guardian_name, guardian_id_card, relation, signature_status,
                        emergency_contact, emergency_phone, medical_allergy, 
                        special_needs, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (auth.id, auth.student_name, auth.student_id_card,
                      auth.guardian_name, auth.guardian_id_card, auth.relation,
                      1 if auth.signature_status else 0, auth.emergency_contact,
                      auth.emergency_phone, auth.medical_allergy, auth.special_needs,
                      auth.created_at))
                log = _make_audit_log('create', 'authorization', auth.id,
                                      None, _auth_to_dict(auth), operator, reason)
                _insert_audit(conn, log)
            return True
        except sqlite3.IntegrityError:
            return False

    @staticmethod
    def get_by_student_id_card(id_card: str) -> Optional[Authorization]:
        with get_conn() as conn:
            row = conn.execute('SELECT * FROM authorizations WHERE student_id_card = ?',
                               (id_card,)).fetchone()
            return _row_to_authorization(row) if row else None

    @staticmethod
    def get_all() -> List[Authorization]:
        with get_conn() as conn:
            rows = conn.execute('SELECT * FROM authorizations ORDER BY created_at').fetchall()
            return [_row_to_authorization(r) for r in rows]


def _auth_to_dict(a: Authorization) -> Dict:
    return {
        'id': a.id, 'student_name': a.student_name, 'student_id_card': a.student_id_card,
        'guardian_name': a.guardian_name, 'guardian_id_card': a.guardian_id_card,
        'relation': a.relation, 'signature_status': a.signature_status,
        'emergency_contact': a.emergency_contact, 'emergency_phone': a.emergency_phone,
        'medical_allergy': a.medical_allergy, 'special_needs': a.special_needs,
    }


class VehicleRepo:
    @staticmethod
    def add(vehicle: Vehicle, operator: str = 'system', reason: str = '') -> bool:
        now = _get_now()
        vehicle.created_at = now
        vehicle.updated_at = now
        try:
            with get_conn() as conn:
                conn.execute('''
                    INSERT INTO vehicles (id, plate_number, driver_name, driver_phone,
                        capacity, route, student_ids_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (vehicle.id, vehicle.plate_number, vehicle.driver_name,
                      vehicle.driver_phone, vehicle.capacity, vehicle.route,
                      json.dumps(vehicle.student_ids), vehicle.created_at, vehicle.updated_at))
                log = _make_audit_log('create', 'vehicle', vehicle.id,
                                      None, _vehicle_to_dict(vehicle), operator, reason)
                _insert_audit(conn, log)
            return True
        except sqlite3.IntegrityError:
            return False

    @staticmethod
    def get_all() -> List[Vehicle]:
        with get_conn() as conn:
            rows = conn.execute('SELECT * FROM vehicles ORDER BY created_at').fetchall()
            return [_row_to_vehicle(r) for r in rows]

    @staticmethod
    def get_by_student(sid: str) -> Optional[Vehicle]:
        vehicles = VehicleRepo.get_all()
        for v in vehicles:
            if sid in v.student_ids:
                return v
        return None


def _vehicle_to_dict(v: Vehicle) -> Dict:
    return {
        'id': v.id, 'plate_number': v.plate_number, 'driver_name': v.driver_name,
        'driver_phone': v.driver_phone, 'capacity': v.capacity, 'route': v.route,
        'student_ids': v.student_ids,
    }


class WithdrawalRepo:
    @staticmethod
    def add(w: Withdrawal, operator: str, reason: str = '') -> bool:
        w.created_at = _get_now()
        with get_conn() as conn:
            conn.execute('''
                INSERT INTO withdrawals (id, student_id, student_name, student_id_card,
                    reason, withdrawal_date, operator, refund_status, insurance_voided,
                    created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (w.id, w.student_id, w.student_name, w.student_id_card, w.reason,
                  w.withdrawal_date, w.operator, w.refund_status,
                  1 if w.insurance_voided else 0, w.created_at))
            log = _make_audit_log('create', 'withdrawal', w.id,
                                  None, _withdrawal_to_dict(w), operator, reason)
            _insert_audit(conn, log)
        return True

    @staticmethod
    def get_by_student_id(sid: str) -> Optional[Withdrawal]:
        with get_conn() as conn:
            row = conn.execute('''
                SELECT * FROM withdrawals WHERE student_id = ? 
                ORDER BY created_at DESC
            ''', (sid,)).fetchone()
            return _row_to_withdrawal(row) if row else None

    @staticmethod
    def get_all() -> List[Withdrawal]:
        with get_conn() as conn:
            rows = conn.execute('SELECT * FROM withdrawals ORDER BY created_at').fetchall()
            return [_row_to_withdrawal(r) for r in rows]


def _withdrawal_to_dict(w: Withdrawal) -> Dict:
    return {
        'id': w.id, 'student_id': w.student_id, 'student_name': w.student_name,
        'student_id_card': w.student_id_card, 'reason': w.reason,
        'withdrawal_date': w.withdrawal_date, 'operator': w.operator,
        'refund_status': w.refund_status, 'insurance_voided': w.insurance_voided,
    }


class AuditRepo:
    @staticmethod
    def log(operation: str, entity_type: str, entity_id: str,
            before: Optional[Dict], after: Optional[Dict],
            operator: str, reason: str = ''):
        log_data = _make_audit_log(operation, entity_type, entity_id, before, after, operator, reason)
        with get_conn() as conn:
            _insert_audit(conn, log_data)

    @staticmethod
    def get_by_entity(entity_type: str, entity_id: str) -> List[AuditLog]:
        with get_conn() as conn:
            rows = conn.execute('''
                SELECT * FROM audit_logs 
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY timestamp DESC
            ''', (entity_type, entity_id)).fetchall()
            return [_row_to_audit_log(r) for r in rows]

    @staticmethod
    def get_all(limit: int = 100) -> List[AuditLog]:
        with get_conn() as conn:
            rows = conn.execute('''
                SELECT * FROM audit_logs 
                ORDER BY timestamp DESC 
                LIMIT ?
            ''', (limit,)).fetchall()
            return [_row_to_audit_log(r) for r in rows]


class CheckReportRepo:
    @staticmethod
    def save(report: CheckReport):
        rid = f'report_{report.student_id}_{report.check_time}'
        with get_conn() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO check_reports (id, student_id, student_name,
                    student_id_card, result, issues_json, warnings_json, 
                    ok_items_json, check_time, is_withdrawn)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (rid, report.student_id, report.student_name, report.student_id_card,
                  report.result.value, json.dumps(report.issues, ensure_ascii=False),
                  json.dumps(report.warnings, ensure_ascii=False),
                  json.dumps(report.ok_items, ensure_ascii=False),
                  report.check_time, 1 if report.is_withdrawn else 0))

    @staticmethod
    def get_latest(student_id: str) -> Optional[CheckReport]:
        with get_conn() as conn:
            row = conn.execute('''
                SELECT * FROM check_reports WHERE student_id = ?
                ORDER BY check_time DESC
            ''', (student_id,)).fetchone()
            return _row_to_check_report(row) if row else None

    @staticmethod
    def get_by_check_time(check_time: str) -> List[CheckReport]:
        with get_conn() as conn:
            rows = conn.execute('''
                SELECT * FROM check_reports WHERE check_time = ?
                ORDER BY student_name
            ''', (check_time,)).fetchall()
            return [_row_to_check_report(r) for r in rows]

    @staticmethod
    def get_all_check_times() -> List[str]:
        with get_conn() as conn:
            rows = conn.execute('''
                SELECT DISTINCT check_time FROM check_reports 
                ORDER BY check_time DESC
            ''').fetchall()
            return [r['check_time'] for r in rows]


def clear_all():
    with get_conn() as conn:
        for table in ['check_reports', 'withdrawals', 'vehicles', 
                      'authorizations', 'insurances', 'students', 
                      'audit_logs']:
            conn.execute(f'DELETE FROM {table}')
