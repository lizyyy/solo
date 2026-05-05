import sqlite3
import json
import uuid
from datetime import datetime, date
from typing import Optional, List, Dict, Any, TypeVar, Type
from contextlib import contextmanager
from .models import (
    FilmRoll, Scanner, MaintenanceRecord, TemperatureHumidityLog,
    Reservation, Note, CheckResult, HandoverForm,
    CheckStatus, BlockReason
)
from .exceptions import DatabaseError, ValidationError


T = TypeVar('T')


class Database:
    """数据库操作类"""
    
    def __init__(self, db_path: str = 'archive.db'):
        self.db_path = db_path
        self._init_db()
    
    @contextmanager
    def get_connection(self):
        """获取数据库连接的上下文管理器"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        except Exception as e:
            conn.rollback()
            raise DatabaseError(f"Database operation failed: {e}") from e
        finally:
            conn.commit()
            conn.close()
    
    def _init_db(self):
        """初始化数据库表结构"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 胶片卷表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS film_rolls (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    format TEXT,
                    scanner_requirements TEXT,
                    location TEXT,
                    condition TEXT,
                    metadata TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            ''')
            
            # 扫描仪表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scanners (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    model TEXT NOT NULL,
                    supported_formats TEXT,
                    location TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            ''')
            
            # 维护记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS maintenance_records (
                    id TEXT PRIMARY KEY,
                    scanner_id TEXT NOT NULL,
                    maintenance_date TEXT NOT NULL,
                    next_maintenance_date TEXT,
                    technician TEXT,
                    description TEXT,
                    status TEXT NOT NULL DEFAULT 'completed',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (scanner_id) REFERENCES scanners(id)
                )
            ''')
            
            # 温湿度日志表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS temp_humidity_logs (
                    id TEXT PRIMARY KEY,
                    location TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    temperature REAL NOT NULL,
                    humidity REAL NOT NULL,
                    recorded_by TEXT,
                    notes TEXT,
                    created_at TEXT NOT NULL
                )
            ''')
            
            # 预约单表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS reservations (
                    id TEXT PRIMARY KEY,
                    film_roll_id TEXT NOT NULL,
                    reader_name TEXT NOT NULL,
                    reader_contact TEXT,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    purpose TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (film_roll_id) REFERENCES film_rolls(id)
                )
            ''')
            
            # 备注表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    related_type TEXT NOT NULL,
                    related_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_by TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            ''')
            
            # 检查结果表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS check_results (
                    id TEXT PRIMARY KEY,
                    film_roll_id TEXT NOT NULL,
                    check_time TEXT NOT NULL,
                    status TEXT NOT NULL,
                    block_reasons TEXT,
                    details TEXT,
                    notes TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (film_roll_id) REFERENCES film_rolls(id)
                )
            ''')
            
            # 交接单表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS handover_forms (
                    id TEXT PRIMARY KEY,
                    film_roll_id TEXT NOT NULL,
                    film_roll_title TEXT NOT NULL,
                    reader_name TEXT NOT NULL,
                    check_result_id TEXT,
                    handover_time TEXT NOT NULL,
                    expected_return_time TEXT,
                    notes TEXT,
                    created_by TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (film_roll_id) REFERENCES film_rolls(id),
                    FOREIGN KEY (check_result_id) REFERENCES check_results(id)
                )
            ''')
            
            # 创建索引
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_film_rolls_title ON film_rolls(title)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_reservations_film_roll ON reservations(film_roll_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(start_time, end_time)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_temp_humidity_logs_time ON temp_humidity_logs(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_check_results_time ON check_results(check_time)')
    
    # ==================== 时间转换辅助方法 ====================
    
    def _datetime_to_str(self, dt: datetime) -> str:
        return dt.isoformat()
    
    def _str_to_datetime(self, s: str) -> datetime:
        return datetime.fromisoformat(s)
    
    def _date_to_str(self, d: date) -> str:
        return d.isoformat()
    
    def _str_to_date(self, s: str) -> date:
        return date.fromisoformat(s)
    
    def _json_dumps(self, obj: Any) -> str:
        return json.dumps(obj, ensure_ascii=False)
    
    def _json_loads(self, s: str) -> Any:
        return json.loads(s) if s else None
    
    # ==================== 胶片卷操作 ====================
    
    def insert_film_roll(self, film_roll: FilmRoll) -> str:
        """插入胶片卷"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO film_rolls 
                (id, title, description, format, scanner_requirements, location, condition, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                film_roll.id,
                film_roll.title,
                film_roll.description,
                film_roll.format,
                film_roll.scanner_requirements,
                film_roll.location,
                film_roll.condition,
                self._json_dumps(film_roll.metadata),
                self._datetime_to_str(film_roll.created_at),
                self._datetime_to_str(film_roll.updated_at)
            ))
            return film_roll.id
    
    def get_film_roll(self, film_roll_id: str) -> Optional[FilmRoll]:
        """根据ID获取胶片卷"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM film_rolls WHERE id = ?', (film_roll_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_film_roll(row)
            return None
    
    def get_all_film_rolls(self) -> List[FilmRoll]:
        """获取所有胶片卷"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM film_rolls ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_film_roll(row) for row in rows]
    
    def _row_to_film_roll(self, row: sqlite3.Row) -> FilmRoll:
        return FilmRoll(
            id=row['id'],
            title=row['title'],
            description=row['description'],
            format=row['format'],
            scanner_requirements=row['scanner_requirements'],
            location=row['location'],
            condition=row['condition'],
            metadata=self._json_loads(row['metadata']) or {},
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ==================== 扫描仪操作 ====================
    
    def insert_scanner(self, scanner: Scanner) -> str:
        """插入扫描仪"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO scanners 
                (id, name, model, supported_formats, location, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                scanner.id,
                scanner.name,
                scanner.model,
                self._json_dumps(scanner.supported_formats),
                scanner.location,
                scanner.status,
                self._datetime_to_str(scanner.created_at),
                self._datetime_to_str(scanner.updated_at)
            ))
            return scanner.id
    
    def get_scanner(self, scanner_id: str) -> Optional[Scanner]:
        """根据ID获取扫描仪"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM scanners WHERE id = ?', (scanner_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_scanner(row)
            return None
    
    def get_all_scanners(self) -> List[Scanner]:
        """获取所有扫描仪"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM scanners ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_scanner(row) for row in rows]
    
    def _row_to_scanner(self, row: sqlite3.Row) -> Scanner:
        return Scanner(
            id=row['id'],
            name=row['name'],
            model=row['model'],
            supported_formats=self._json_loads(row['supported_formats']) or [],
            location=row['location'],
            status=row['status'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ==================== 维护记录操作 ====================
    
    def insert_maintenance_record(self, record: MaintenanceRecord) -> str:
        """插入维护记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO maintenance_records 
                (id, scanner_id, maintenance_date, next_maintenance_date, technician, description, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.id,
                record.scanner_id,
                self._date_to_str(record.maintenance_date),
                self._date_to_str(record.next_maintenance_date) if record.next_maintenance_date else None,
                record.technician,
                record.description,
                record.status,
                self._datetime_to_str(record.created_at)
            ))
            return record.id
    
    def get_maintenance_records_by_scanner(self, scanner_id: str) -> List[MaintenanceRecord]:
        """根据扫描仪ID获取维护记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM maintenance_records 
                WHERE scanner_id = ? 
                ORDER BY maintenance_date DESC
            ''', (scanner_id,))
            rows = cursor.fetchall()
            return [self._row_to_maintenance_record(row) for row in rows]
    
    def _row_to_maintenance_record(self, row: sqlite3.Row) -> MaintenanceRecord:
        return MaintenanceRecord(
            id=row['id'],
            scanner_id=row['scanner_id'],
            maintenance_date=self._str_to_date(row['maintenance_date']),
            next_maintenance_date=self._str_to_date(row['next_maintenance_date']) if row['next_maintenance_date'] else None,
            technician=row['technician'],
            description=row['description'],
            status=row['status'],
            created_at=self._str_to_datetime(row['created_at'])
        )
    
    # ==================== 温湿度日志操作 ====================
    
    def insert_temp_humidity_log(self, log: TemperatureHumidityLog) -> str:
        """插入温湿度日志"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO temp_humidity_logs 
                (id, location, timestamp, temperature, humidity, recorded_by, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                log.id,
                log.location,
                self._datetime_to_str(log.timestamp),
                log.temperature,
                log.humidity,
                log.recorded_by,
                log.notes,
                self._datetime_to_str(log.created_at)
            ))
            return log.id
    
    def get_temp_humidity_logs(self, location: Optional[str] = None, 
                                 start_time: Optional[datetime] = None,
                                 end_time: Optional[datetime] = None) -> List[TemperatureHumidityLog]:
        """获取温湿度日志，支持按位置和时间范围过滤"""
        query = 'SELECT * FROM temp_humidity_logs WHERE 1=1'
        params = []
        
        if location:
            query += ' AND location = ?'
            params.append(location)
        
        if start_time:
            query += ' AND timestamp >= ?'
            params.append(self._datetime_to_str(start_time))
        
        if end_time:
            query += ' AND timestamp <= ?'
            params.append(self._datetime_to_str(end_time))
        
        query += ' ORDER BY timestamp DESC'
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_temp_humidity_log(row) for row in rows]
    
    def _row_to_temp_humidity_log(self, row: sqlite3.Row) -> TemperatureHumidityLog:
        return TemperatureHumidityLog(
            id=row['id'],
            location=row['location'],
            timestamp=self._str_to_datetime(row['timestamp']),
            temperature=row['temperature'],
            humidity=row['humidity'],
            recorded_by=row['recorded_by'],
            notes=row['notes'],
            created_at=self._str_to_datetime(row['created_at'])
        )
    
    # ==================== 预约单操作 ====================
    
    def insert_reservation(self, reservation: Reservation) -> str:
        """插入预约单"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO reservations 
                (id, film_roll_id, reader_name, reader_contact, start_time, end_time, purpose, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                reservation.id,
                reservation.film_roll_id,
                reservation.reader_name,
                reservation.reader_contact,
                self._datetime_to_str(reservation.start_time),
                self._datetime_to_str(reservation.end_time),
                reservation.purpose,
                reservation.status,
                self._datetime_to_str(reservation.created_at),
                self._datetime_to_str(reservation.updated_at)
            ))
            return reservation.id
    
    def get_reservations_by_film_roll(self, film_roll_id: str) -> List[Reservation]:
        """根据胶片卷ID获取预约单"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM reservations 
                WHERE film_roll_id = ? AND status = 'active'
                ORDER BY start_time
            ''', (film_roll_id,))
            rows = cursor.fetchall()
            return [self._row_to_reservation(row) for row in rows]
    
    def get_reservations_by_time(self, start_time: datetime, end_time: datetime) -> List[Reservation]:
        """获取指定时间范围内的预约单"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM reservations 
                WHERE status = 'active'
                AND start_time < ? AND end_time > ?
                ORDER BY start_time
            ''', (self._datetime_to_str(end_time), self._datetime_to_str(start_time)))
            rows = cursor.fetchall()
            return [self._row_to_reservation(row) for row in rows]
    
    def _row_to_reservation(self, row: sqlite3.Row) -> Reservation:
        return Reservation(
            id=row['id'],
            film_roll_id=row['film_roll_id'],
            reader_name=row['reader_name'],
            reader_contact=row['reader_contact'],
            start_time=self._str_to_datetime(row['start_time']),
            end_time=self._str_to_datetime(row['end_time']),
            purpose=row['purpose'],
            status=row['status'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ==================== 备注操作 ====================
    
    def insert_note(self, note: Note) -> str:
        """插入备注"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO notes 
                (id, related_type, related_id, content, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                note.id,
                note.related_type,
                note.related_id,
                note.content,
                note.created_by,
                self._datetime_to_str(note.created_at),
                self._datetime_to_str(note.updated_at)
            ))
            return note.id
    
    def get_notes_by_related(self, related_type: str, related_id: str) -> List[Note]:
        """根据关联类型和ID获取备注"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM notes 
                WHERE related_type = ? AND related_id = ?
                ORDER BY created_at DESC
            ''', (related_type, related_id))
            rows = cursor.fetchall()
            return [self._row_to_note(row) for row in rows]
    
    def _row_to_note(self, row: sqlite3.Row) -> Note:
        return Note(
            id=row['id'],
            related_type=row['related_type'],
            related_id=row['related_id'],
            content=row['content'],
            created_by=row['created_by'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ==================== 检查结果操作 ====================
    
    def insert_check_result(self, result: CheckResult) -> str:
        """插入检查结果"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO check_results 
                (id, film_roll_id, check_time, status, block_reasons, details, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                result.id,
                result.film_roll_id,
                self._datetime_to_str(result.check_time),
                result.status.value,
                self._json_dumps([r.value for r in result.block_reasons]),
                self._json_dumps(result.details),
                self._json_dumps(result.notes),
                self._datetime_to_str(result.created_at)
            ))
            return result.id
    
    def get_latest_check_result(self, film_roll_id: str) -> Optional[CheckResult]:
        """获取胶片卷的最新检查结果"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM check_results 
                WHERE film_roll_id = ?
                ORDER BY check_time DESC
                LIMIT 1
            ''', (film_roll_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_check_result(row)
            return None
    
    def _row_to_check_result(self, row: sqlite3.Row) -> CheckResult:
        block_reasons = self._json_loads(row['block_reasons']) or []
        return CheckResult(
            id=row['id'],
            film_roll_id=row['film_roll_id'],
            check_time=self._str_to_datetime(row['check_time']),
            status=CheckStatus(row['status']),
            block_reasons=[BlockReason(r) for r in block_reasons],
            details=self._json_loads(row['details']) or {},
            notes=self._json_loads(row['notes']) or [],
            created_at=self._str_to_datetime(row['created_at'])
        )
    
    # ==================== 交接单操作 ====================
    
    def insert_handover_form(self, form: HandoverForm) -> str:
        """插入交接单"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO handover_forms 
                (id, film_roll_id, film_roll_title, reader_name, check_result_id, 
                 handover_time, expected_return_time, notes, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                form.id,
                form.film_roll_id,
                form.film_roll_title,
                form.reader_name,
                form.check_result.id if form.check_result else None,
                self._datetime_to_str(form.handover_time),
                self._datetime_to_str(form.expected_return_time) if form.expected_return_time else None,
                form.notes,
                form.created_by,
                self._datetime_to_str(form.created_at)
            ))
            return form.id
    
    def get_handover_forms(self, film_roll_id: Optional[str] = None,
                            start_time: Optional[datetime] = None) -> List[HandoverForm]:
        """获取交接单"""
        query = '''
            SELECT h.*, c.* as check_result_data
            FROM handover_forms h
            LEFT JOIN check_results c ON h.check_result_id = c.id
            WHERE 1=1
        '''
        params = []
        
        if film_roll_id:
            query += ' AND h.film_roll_id = ?'
            params.append(film_roll_id)
        
        if start_time:
            query += ' AND h.handover_time >= ?'
            params.append(self._datetime_to_str(start_time))
        
        query += ' ORDER BY h.handover_time DESC'
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            # 简化处理，实际需要解析check_result_data
            return []  # 暂时返回空列表，完整实现需要处理关联查询
