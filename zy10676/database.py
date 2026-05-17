import sqlite3
from datetime import datetime
from typing import List, Optional, Dict, Any
from models import RiskControlRelease, ReleaseStatus, OperationHistory, ImportBadRecord
import json


class Database:
    def __init__(self, db_path: str = "risk_control.db"):
        self.db_path = db_path
        self.init_database()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_database(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS risk_control_release (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mobile TEXT NOT NULL,
                scene TEXT NOT NULL,
                business_object TEXT NOT NULL,
                risk_reason TEXT NOT NULL,
                status TEXT NOT NULL,
                release_start_time TIMESTAMP,
                release_end_time TIMESTAMP,
                applicant TEXT NOT NULL,
                approver TEXT,
                apply_time TIMESTAMP NOT NULL,
                approve_time TIMESTAMP,
                remark TEXT DEFAULT '',
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                version INTEGER DEFAULT 1
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS operation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                release_id INTEGER NOT NULL,
                operation_type TEXT NOT NULL,
                old_status TEXT,
                new_status TEXT,
                operator TEXT NOT NULL,
                operation_time TIMESTAMP NOT NULL,
                remark TEXT DEFAULT '',
                old_data TEXT,
                new_data TEXT,
                FOREIGN KEY (release_id) REFERENCES risk_control_release (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS import_bad_record (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no TEXT NOT NULL,
                row_number INTEGER NOT NULL,
                original_data TEXT NOT NULL,
                error_message TEXT NOT NULL,
                import_time TIMESTAMP NOT NULL,
                processed BOOLEAN DEFAULT 0
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_release_mobile ON risk_control_release(mobile)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_release_status ON risk_control_release(status)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_release_scene ON risk_control_release(scene)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_history_release_id ON operation_history(release_id)
        ''')
        
        conn.commit()
        conn.close()

    def _row_to_release(self, row) -> RiskControlRelease:
        return RiskControlRelease(
            id=row['id'],
            mobile=row['mobile'],
            scene=row['scene'],
            business_object=row['business_object'],
            risk_reason=row['risk_reason'],
            status=ReleaseStatus(row['status']),
            release_start_time=datetime.fromisoformat(row['release_start_time']) if row['release_start_time'] else None,
            release_end_time=datetime.fromisoformat(row['release_end_time']) if row['release_end_time'] else None,
            applicant=row['applicant'],
            approver=row['approver'],
            apply_time=datetime.fromisoformat(row['apply_time']),
            approve_time=datetime.fromisoformat(row['approve_time']) if row['approve_time'] else None,
            remark=row['remark'],
            created_at=datetime.fromisoformat(row['created_at']),
            updated_at=datetime.fromisoformat(row['updated_at']),
            version=row['version']
        )

    def create_release(self, mobile: str, scene: str, business_object: str,
                      risk_reason: str, applicant: str, remark: str = "") -> RiskControlRelease:
        now = datetime.now()
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO risk_control_release 
            (mobile, scene, business_object, risk_reason, status, applicant, apply_time, remark, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (mobile, scene, business_object, risk_reason, ReleaseStatus.BLOCKING.value, 
              applicant, now.isoformat(), remark, now.isoformat(), now.isoformat()))
        
        release_id = cursor.lastrowid
        conn.commit()
        
        self._add_history(release_id, "创建", None, ReleaseStatus.BLOCKING.value, applicant, "创建风控拦截记录", {}, {}, conn)
        
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        conn.close()
        
        return self._row_to_release(row)

    def _add_history(self, release_id: int, operation_type: str, old_status: Optional[str], 
                     new_status: Optional[str], operator: str, remark: str,
                     old_data: Dict = {}, new_data: Dict = {}, conn = None):
        now = datetime.now()
        should_close = conn is None
        if conn is None:
            conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO operation_history 
            (release_id, operation_type, old_status, new_status, operator, operation_time, remark, old_data, new_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (release_id, operation_type, old_status, new_status, operator, now.isoformat(), remark,
              json.dumps(old_data, ensure_ascii=False), json.dumps(new_data, ensure_ascii=False)))
        
        if should_close:
            conn.commit()
            conn.close()

    def apply_release(self, release_id: int, operator: str, release_start_time: datetime,
                     release_end_time: datetime, remark: str = "") -> Optional[RiskControlRelease]:
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
        
        old_status = row['status']
        old_data = {
            'status': old_status,
            'release_start_time': row['release_start_time'],
            'release_end_time': row['release_end_time']
        }
        
        cursor.execute('''
            UPDATE risk_control_release 
            SET status = ?, release_start_time = ?, release_end_time = ?, 
                updated_at = ?, version = version + 1
            WHERE id = ?
        ''', (ReleaseStatus.APPLYING.value, release_start_time.isoformat(), 
              release_end_time.isoformat(), datetime.now().isoformat(), release_id))
        
        new_data = {
            'status': ReleaseStatus.APPLYING.value,
            'release_start_time': release_start_time.isoformat(),
            'release_end_time': release_end_time.isoformat()
        }
        
        self._add_history(release_id, "申请放行", old_status, ReleaseStatus.APPLYING.value,
                         operator, remark, old_data, new_data, conn)
        
        conn.commit()
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        conn.close()
        
        return self._row_to_release(row)

    def approve_release(self, release_id: int, approver: str, remark: str = "") -> Optional[RiskControlRelease]:
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
        
        old_status = row['status']
        old_data = {'status': old_status, 'approver': row['approver'], 'approve_time': row['approve_time']}
        
        now = datetime.now()
        cursor.execute('''
            UPDATE risk_control_release 
            SET status = ?, approver = ?, approve_time = ?, updated_at = ?, version = version + 1
            WHERE id = ?
        ''', (ReleaseStatus.RELEASED.value, approver, now.isoformat(), now.isoformat(), release_id))
        
        new_data = {'status': ReleaseStatus.RELEASED.value, 'approver': approver, 'approve_time': now.isoformat()}
        
        self._add_history(release_id, "审批通过", old_status, ReleaseStatus.RELEASED.value,
                         approver, remark, old_data, new_data, conn)
        
        conn.commit()
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        conn.close()
        
        return self._row_to_release(row)

    def add_remark(self, release_id: int, operator: str, remark: str) -> Optional[RiskControlRelease]:
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
        
        old_remark = row['remark']
        old_data = {'remark': old_remark}
        
        new_remark = old_remark + "\n" + remark if old_remark else remark
        
        cursor.execute('''
            UPDATE risk_control_release 
            SET remark = ?, updated_at = ?, version = version + 1
            WHERE id = ?
        ''', (new_remark, datetime.now().isoformat(), release_id))
        
        new_data = {'remark': new_remark}
        
        self._add_history(release_id, "添加备注", None, None, operator, 
                         remark, old_data, new_data, conn)
        
        conn.commit()
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        conn.close()
        
        return self._row_to_release(row)

    def expire_release(self, release_id: int, operator: str) -> Optional[RiskControlRelease]:
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
        
        old_status = row['status']
        old_data = {'status': old_status}
        
        cursor.execute('''
            UPDATE risk_control_release 
            SET status = ?, updated_at = ?, version = version + 1
            WHERE id = ?
        ''', (ReleaseStatus.EXPIRED.value, datetime.now().isoformat(), release_id))
        
        new_data = {'status': ReleaseStatus.EXPIRED.value}
        
        self._add_history(release_id, "过期失效", old_status, ReleaseStatus.EXPIRED.value,
                         operator, "放行期限已过期", old_data, new_data, conn)
        
        conn.commit()
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        conn.close()
        
        return self._row_to_release(row)

    def get_release_by_id(self, release_id: int) -> Optional[RiskControlRelease]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM risk_control_release WHERE id = ?', (release_id,))
        row = cursor.fetchone()
        conn.close()
        return self._row_to_release(row) if row else None

    def query_releases(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
                      status: Optional[ReleaseStatus] = None, applicant: Optional[str] = None,
                      business_object: Optional[str] = None, mobile: Optional[str] = None,
                      scene: Optional[str] = None) -> List[RiskControlRelease]:
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM risk_control_release WHERE 1=1'
        params = []
        
        if start_date:
            query += ' AND apply_time >= ?'
            params.append(start_date.isoformat())
        if end_date:
            query += ' AND apply_time <= ?'
            params.append(end_date.isoformat())
        if status:
            query += ' AND status = ?'
            params.append(status.value)
        if applicant:
            query += ' AND applicant LIKE ?'
            params.append(f'%{applicant}%')
        if business_object:
            query += ' AND business_object LIKE ?'
            params.append(f'%{business_object}%')
        if mobile:
            query += ' AND mobile LIKE ?'
            params.append(f'%{mobile}%')
        if scene:
            query += ' AND scene LIKE ?'
            params.append(f'%{scene}%')
        
        query += ' ORDER BY apply_time DESC'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_release(row) for row in rows]

    def get_history_by_release_id(self, release_id: int) -> List[OperationHistory]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM operation_history WHERE release_id = ? ORDER BY operation_time DESC', (release_id,))
        rows = cursor.fetchall()
        conn.close()
        
        return [OperationHistory(
            id=row['id'],
            release_id=row['release_id'],
            operation_type=row['operation_type'],
            old_status=row['old_status'],
            new_status=row['new_status'],
            operator=row['operator'],
            operation_time=datetime.fromisoformat(row['operation_time']),
            remark=row['remark'],
            old_data=row['old_data'],
            new_data=row['new_data']
        ) for row in rows]

    def add_import_bad_record(self, batch_no: str, row_number: int, original_data: str, error_message: str) -> ImportBadRecord:
        now = datetime.now()
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO import_bad_record (batch_no, row_number, original_data, error_message, import_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (batch_no, row_number, original_data, error_message, now.isoformat()))
        
        bad_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute('SELECT * FROM import_bad_record WHERE id = ?', (bad_id,))
        row = cursor.fetchone()
        conn.close()
        
        return ImportBadRecord(
            id=row['id'],
            batch_no=row['batch_no'],
            row_number=row['row_number'],
            original_data=row['original_data'],
            error_message=row['error_message'],
            import_time=datetime.fromisoformat(row['import_time']),
            processed=bool(row['processed'])
        )
