import sqlite3
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Type, TypeVar
from contextlib import contextmanager

from .models import (
    Dormitory, RepairPerson, Material, RepairOrder, MaterialUsage,
    AuditLog, ImportRecord, RepairStatus, ResponsibilityType, FollowUpResult
)

T = TypeVar('T')

DB_FILE_NAME = "dorm_repair.db"


class DatabaseManager:
    def __init__(self, base_path: Path):
        self.db_path = base_path / DB_FILE_NAME
        self.base_path = base_path
        self._conn: Optional[sqlite3.Connection] = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path), detect_types=sqlite3.PARSE_DECLTYPES)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def close(self):
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    @contextmanager
    def transaction(self):
        try:
            yield self.conn
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

    def exists(self) -> bool:
        return self.db_path.exists()

    def initialize(self):
        if self.exists():
            raise RuntimeError("数据库已存在，使用 --force 覆盖")
        
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        self._create_tables()

    def _create_tables(self):
        cursor = self.conn.cursor()
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS dormitories (
            dorm_id TEXT PRIMARY KEY,
            building TEXT NOT NULL,
            room_number TEXT NOT NULL,
            floor INTEGER NOT NULL,
            capacity INTEGER NOT NULL,
            students TEXT,
            counselor TEXT,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS repair_persons (
            staff_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            skills TEXT,
            work_area TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS materials (
            material_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            unit_price REAL NOT NULL DEFAULT 0,
            current_stock REAL NOT NULL DEFAULT 0,
            min_stock REAL NOT NULL DEFAULT 0,
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS repair_orders (
            order_id TEXT PRIMARY KEY,
            dorm_id TEXT NOT NULL,
            submit_time TIMESTAMP NOT NULL,
            reporter TEXT NOT NULL,
            reporter_phone TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT,
            status TEXT NOT NULL DEFAULT 'submitted',
            assigned_to TEXT,
            responsibility TEXT NOT NULL DEFAULT 'undetermined',
            start_time TIMESTAMP,
            complete_time TIMESTAMP,
            follow_up_time TIMESTAMP,
            follow_up_result TEXT NOT NULL DEFAULT 'not_attempted',
            follow_up_remarks TEXT,
            close_time TIMESTAMP,
            student_fee REAL NOT NULL DEFAULT 0,
            is_repeat INTEGER NOT NULL DEFAULT 0,
            original_order_id TEXT,
            materials TEXT DEFAULT '[]',
            repairs TEXT DEFAULT '[]',
            history TEXT DEFAULT '[]',
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dorm_id) REFERENCES dormitories(dorm_id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS material_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            material_id TEXT NOT NULL,
            material_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            total_cost REAL NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            operator TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES repair_orders(order_id),
            FOREIGN KEY (material_id) REFERENCES materials(material_id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id TEXT PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            operator TEXT NOT NULL,
            before TEXT,
            after TEXT,
            reason TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_records (
            import_id TEXT PRIMARY KEY,
            import_time TIMESTAMP NOT NULL,
            file_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            total_count INTEGER NOT NULL,
            success_count INTEGER NOT NULL,
            failed_count INTEGER NOT NULL,
            errors TEXT DEFAULT '[]',
            operator TEXT NOT NULL
        )
        ''')

        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_repair_orders_dorm ON repair_orders(dorm_id)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_repair_orders_submit_time ON repair_orders(submit_time)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_dormitories_building ON dormitories(building)
        ''')

        self.conn.commit()

    def _to_json(self, obj: Any) -> str:
        def default(o):
            if isinstance(o, (datetime,)):
                return o.isoformat()
            if hasattr(o, 'value'):
                return o.value
            return str(o)
        return json.dumps(obj, default=default)

    def _from_json(self, s: str) -> Any:
        if s is None:
            return []
        return json.loads(s)

    def save_dormitory(self, dorm: Dormitory, operator: str = "system"):
        cursor = self.conn.cursor()
        cursor.execute('''
        INSERT OR REPLACE INTO dormitories 
        (dorm_id, building, room_number, floor, capacity, students, counselor, remarks, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            dorm.dorm_id, dorm.building, dorm.room_number, dorm.floor, dorm.capacity,
            self._to_json(dorm.students), dorm.counselor, dorm.remarks
        ))

    def save_repair_person(self, person: RepairPerson, operator: str = "system"):
        cursor = self.conn.cursor()
        cursor.execute('''
        INSERT OR REPLACE INTO repair_persons 
        (staff_id, name, phone, skills, work_area, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            person.staff_id, person.name, person.phone,
            self._to_json(person.skills), self._to_json(person.work_area)
        ))

    def save_material(self, material: Material, operator: str = "system"):
        cursor = self.conn.cursor()
        cursor.execute('''
        INSERT OR REPLACE INTO materials 
        (material_id, name, unit, unit_price, current_stock, min_stock, category, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            material.material_id, material.name, material.unit, material.unit_price,
            material.current_stock, material.min_stock, material.category
        ))

    def _row_to_dormitory(self, row: sqlite3.Row) -> Dormitory:
        return Dormitory(
            dorm_id=row['dorm_id'],
            building=row['building'],
            room_number=row['room_number'],
            floor=row['floor'],
            capacity=row['capacity'],
            students=self._from_json(row['students'] or '[]'),
            counselor=row['counselor'],
            remarks=row['remarks']
        )

    def _row_to_repair_person(self, row: sqlite3.Row) -> RepairPerson:
        return RepairPerson(
            staff_id=row['staff_id'],
            name=row['name'],
            phone=row['phone'],
            skills=self._from_json(row['skills'] or '[]'),
            work_area=self._from_json(row['work_area'] or '[]')
        )

    def _row_to_material(self, row: sqlite3.Row) -> Material:
        return Material(
            material_id=row['material_id'],
            name=row['name'],
            unit=row['unit'],
            unit_price=row['unit_price'],
            current_stock=row['current_stock'],
            min_stock=row['min_stock'],
            category=row['category']
        )

    def _row_to_repair_order(self, row: sqlite3.Row) -> RepairOrder:
        return RepairOrder(
            order_id=row['order_id'],
            dorm_id=row['dorm_id'],
            submit_time=row['submit_time'],
            reporter=row['reporter'],
            reporter_phone=row['reporter_phone'],
            description=row['description'],
            category=row['category'],
            status=RepairStatus(row['status']),
            assigned_to=row['assigned_to'],
            responsibility=ResponsibilityType(row['responsibility']),
            start_time=row['start_time'],
            complete_time=row['complete_time'],
            follow_up_time=row['follow_up_time'],
            follow_up_result=FollowUpResult(row['follow_up_result']),
            follow_up_remarks=row['follow_up_remarks'],
            close_time=row['close_time'],
            student_fee=row['student_fee'],
            is_repeat=bool(row['is_repeat']),
            original_order_id=row['original_order_id'],
            materials=self._from_json(row['materials'] or '[]'),
            repairs=self._from_json(row['repairs'] or '[]'),
            history=self._from_json(row['history'] or '[]'),
            remarks=row['remarks']
        )

    def get_dormitory(self, dorm_id: str) -> Optional[Dormitory]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM dormitories WHERE dorm_id = ?', (dorm_id,))
        row = cursor.fetchone()
        return self._row_to_dormitory(row) if row else None

    def get_dormitories_by_building(self, building: str) -> List[Dormitory]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM dormitories WHERE building = ? ORDER BY room_number', (building,))
        return [self._row_to_dormitory(row) for row in cursor.fetchall()]

    def list_dormitories(self) -> List[Dormitory]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM dormitories ORDER BY building, room_number')
        return [self._row_to_dormitory(row) for row in cursor.fetchall()]

    def list_buildings(self) -> List[str]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT DISTINCT building FROM dormitories ORDER BY building')
        return [row['building'] for row in cursor.fetchall()]

    def get_repair_person(self, staff_id: str) -> Optional[RepairPerson]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM repair_persons WHERE staff_id = ?', (staff_id,))
        row = cursor.fetchone()
        return self._row_to_repair_person(row) if row else None

    def list_repair_persons(self) -> List[RepairPerson]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM repair_persons')
        return [self._row_to_repair_person(row) for row in cursor.fetchall()]

    def get_material(self, material_id: str) -> Optional[Material]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM materials WHERE material_id = ?', (material_id,))
        row = cursor.fetchone()
        return self._row_to_material(row) if row else None

    def get_material_by_name(self, name: str) -> Optional[Material]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM materials WHERE name = ?', (name,))
        row = cursor.fetchone()
        return self._row_to_material(row) if row else None

    def list_materials(self) -> List[Material]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM materials ORDER BY name')
        return [self._row_to_material(row) for row in cursor.fetchall()]

    def save_repair_order(self, order: RepairOrder, operator: str = "system", reason: Optional[str] = None):
        cursor = self.conn.cursor()
        
        cursor.execute('SELECT * FROM repair_orders WHERE order_id = ?', (order.order_id,))
        existing = cursor.fetchone()
        before = None
        if existing:
            before = dict(existing)
            del before['created_at']
            del before['updated_at']
            before['materials'] = self._from_json(before.get('materials', '[]') or '[]')
            before['history'] = self._from_json(before.get('history', '[]') or '[]')
            before['repairs'] = self._from_json(before.get('repairs', '[]') or '[]')

        cursor.execute('''
        INSERT OR REPLACE INTO repair_orders 
        (order_id, dorm_id, submit_time, reporter, reporter_phone, description, category,
         status, assigned_to, responsibility, start_time, complete_time, follow_up_time,
         follow_up_result, follow_up_remarks, close_time, student_fee, is_repeat, 
         original_order_id, materials, repairs, history, remarks, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            order.order_id, order.dorm_id, order.submit_time, order.reporter, order.reporter_phone,
            order.description, order.category, order.status.value, order.assigned_to,
            order.responsibility.value, order.start_time, order.complete_time, order.follow_up_time,
            order.follow_up_result.value, order.follow_up_remarks, order.close_time, order.student_fee,
            int(order.is_repeat), order.original_order_id,
            self._to_json(order.materials), self._to_json(order.repairs), self._to_json(order.history),
            order.remarks
        ))

        after = {
            'order_id': order.order_id,
            'dorm_id': order.dorm_id,
            'status': order.status.value,
            'responsibility': order.responsibility.value,
            'follow_up_result': order.follow_up_result.value,
            'student_fee': order.student_fee,
            'materials': order.materials
        }

        self.log_audit(
            action=('UPDATE' if existing else 'CREATE') + '_REPAIR_ORDER',
            target_type='repair_order',
            target_id=order.order_id,
            operator=operator,
            before=before,
            after=after,
            reason=reason
        )

    def get_repair_order(self, order_id: str) -> Optional[RepairOrder]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM repair_orders WHERE order_id = ?', (order_id,))
        row = cursor.fetchone()
        return self._row_to_repair_order(row) if row else None

    def list_repair_orders(
        self,
        status: Optional[RepairStatus] = None,
        dorm_id: Optional[str] = None,
        building: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[RepairOrder]:
        query = '''
        SELECT ro.* FROM repair_orders ro
        LEFT JOIN dormitories d ON ro.dorm_id = d.dorm_id
        WHERE 1=1
        '''
        params = []
        
        if status:
            query += ' AND ro.status = ?'
            params.append(status.value)
        if dorm_id:
            query += ' AND ro.dorm_id = ?'
            params.append(dorm_id)
        if building:
            query += ' AND d.building = ?'
            params.append(building)
        if start_date:
            query += ' AND ro.submit_time >= ?'
            params.append(start_date)
        if end_date:
            query += ' AND ro.submit_time <= ?'
            params.append(end_date)
        
        query += ' ORDER BY ro.submit_time DESC'
        
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return [self._row_to_repair_order(row) for row in cursor.fetchall()]

    def get_orders_for_dorm_in_period(
        self,
        dorm_id: str,
        start_time: datetime,
        category: Optional[str] = None
    ) -> List[RepairOrder]:
        query = '''
        SELECT * FROM repair_orders 
        WHERE dorm_id = ? AND submit_time >= ? AND submit_time < ?
        '''
        params = [dorm_id, start_time, datetime.now()]
        
        if category:
            query += ' AND category = ?'
            params.append(category)
        
        query += ' ORDER BY submit_time DESC'
        
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return [self._row_to_repair_order(row) for row in cursor.fetchall()]

    def save_material_usage(self, usage: MaterialUsage):
        cursor = self.conn.cursor()
        cursor.execute('''
        INSERT INTO material_usage 
        (order_id, material_id, material_name, quantity, unit_price, total_cost, timestamp, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            usage.order_id, usage.material_id, usage.material_name,
            usage.quantity, usage.unit_price, usage.total_cost,
            usage.timestamp, usage.operator
        ))

    def list_material_usage(self, order_id: Optional[str] = None) -> List[MaterialUsage]:
        query = 'SELECT * FROM material_usage WHERE 1=1'
        params = []
        
        if order_id:
            query += ' AND order_id = ?'
            params.append(order_id)
        
        query += ' ORDER BY timestamp DESC'
        
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        result = []
        for row in cursor.fetchall():
            result.append(MaterialUsage(
                order_id=row['order_id'],
                material_id=row['material_id'],
                material_name=row['material_name'],
                quantity=row['quantity'],
                unit_price=row['unit_price'],
                total_cost=row['total_cost'],
                timestamp=row['timestamp'],
                operator=row['operator']
            ))
        return result

    def log_audit(
        self,
        action: str,
        target_type: str,
        target_id: str,
        operator: str,
        before: Optional[Dict[str, Any]] = None,
        after: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None
    ):
        cursor = self.conn.cursor()
        log_id = str(uuid.uuid4())
        cursor.execute('''
        INSERT INTO audit_logs 
        (log_id, timestamp, action, target_type, target_id, operator, before, after, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            log_id, datetime.now(), action, target_type, target_id, operator,
            self._to_json(before) if before else None,
            self._to_json(after) if after else None,
            reason
        ))

    def get_audit_logs(self, target_id: Optional[str] = None, target_type: Optional[str] = None) -> List[AuditLog]:
        query = 'SELECT * FROM audit_logs WHERE 1=1'
        params = []
        
        if target_id:
            query += ' AND target_id = ?'
            params.append(target_id)
        if target_type:
            query += ' AND target_type = ?'
            params.append(target_type)
        
        query += ' ORDER BY timestamp DESC'
        
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        result = []
        for row in cursor.fetchall():
            result.append(AuditLog(
                log_id=row['log_id'],
                timestamp=row['timestamp'],
                action=row['action'],
                target_type=row['target_type'],
                target_id=row['target_id'],
                operator=row['operator'],
                before=self._from_json(row['before']) if row['before'] else None,
                after=self._from_json(row['after']) if row['after'] else None,
                reason=row['reason']
            ))
        return result

    def save_import_record(self, record: ImportRecord):
        cursor = self.conn.cursor()
        cursor.execute('''
        INSERT INTO import_records 
        (import_id, import_time, file_type, file_name, total_count, success_count, failed_count, errors, operator)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.import_id, record.import_time, record.file_type, record.file_name,
            record.total_count, record.success_count, record.failed_count,
            self._to_json(record.errors), record.operator
        ))

    def list_import_records(self) -> List[ImportRecord]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM import_records ORDER BY import_time DESC')
        result = []
        for row in cursor.fetchall():
            result.append(ImportRecord(
                import_id=row['import_id'],
                import_time=row['import_time'],
                file_type=row['file_type'],
                file_name=row['file_name'],
                total_count=row['total_count'],
                success_count=row['success_count'],
                failed_count=row['failed_count'],
                operator=row['operator'],
                errors=self._from_json(row['errors'])
            ))
        return result

    def commit(self):
        self.conn.commit()
