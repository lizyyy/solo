import json
import csv
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict, is_dataclass
from enum import Enum
import hashlib


class DataclassJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if is_dataclass(obj):
            return asdict(obj)
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Path):
            return str(obj)
        return super().default(obj)


@dataclass
class RollbackState:
    device_id: str
    rollback_time: datetime
    from_version: str
    to_version: str
    reason: str
    rollback_id: str
    telemetry_sync_status: str = "pending"
    telemetry_sync_time: Optional[datetime] = None
    success: bool = True
    details: Dict[str, Any] = None


@dataclass
class UpgradeRecord:
    device_id: str
    upgrade_time: datetime
    from_version: str
    to_version: str
    batch_id: str
    window_id: str
    status: str
    failure_reason: Optional[str] = None
    rollback_performed: bool = False


class StateStorageError(Exception):
    pass


class StateStorage:
    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.db_path = storage_dir / "firmware_ga.db"
        self._init_database()
        
        self.json_dir = storage_dir / "json"
        self.json_dir.mkdir(exist_ok=True)
        
        self.rollback_dir = storage_dir / "rollback"
        self.rollback_dir.mkdir(exist_ok=True)
    
    def _init_database(self) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS upgrade_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                upgrade_time TEXT NOT NULL,
                from_version TEXT NOT NULL,
                to_version TEXT NOT NULL,
                batch_id TEXT,
                window_id TEXT,
                status TEXT NOT NULL,
                failure_reason TEXT,
                rollback_performed INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(device_id, upgrade_time)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rollback_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rollback_id TEXT UNIQUE NOT NULL,
                device_id TEXT NOT NULL,
                rollback_time TEXT NOT NULL,
                from_version TEXT NOT NULL,
                to_version TEXT NOT NULL,
                reason TEXT NOT NULL,
                telemetry_sync_status TEXT DEFAULT 'pending',
                telemetry_sync_time TEXT,
                success INTEGER DEFAULT 1,
                details TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS import_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                import_time TEXT NOT NULL,
                record_count INTEGER,
                metadata TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_upgrade_device 
            ON upgrade_records(device_id)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_upgrade_time 
            ON upgrade_records(upgrade_time)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_rollback_device 
            ON rollback_states(device_id)
        ''')
        
        conn.commit()
        conn.close()
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256.update(byte_block)
        return sha256.hexdigest()
    
    def record_import(
        self,
        import_type: str,
        file_path: Path,
        record_count: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        file_hash = self._calculate_file_hash(file_path)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO import_history 
            (import_type, file_path, file_hash, import_time, record_count, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            import_type,
            str(file_path),
            file_hash,
            datetime.now().isoformat(),
            record_count,
            json.dumps(metadata or {})
        ))
        
        conn.commit()
        conn.close()
    
    def get_import_history(self, import_type: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if import_type:
            cursor.execute('''
                SELECT * FROM import_history 
                WHERE import_type = ? 
                ORDER BY import_time DESC
            ''', (import_type,))
        else:
            cursor.execute('''
                SELECT * FROM import_history 
                ORDER BY import_time DESC
            ''')
        
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        results = []
        for row in rows:
            result = dict(zip(columns, row))
            if result.get('metadata'):
                result['metadata'] = json.loads(result['metadata'])
            results.append(result)
        
        conn.close()
        return results
    
    def record_upgrade_start(
        self,
        device_id: str,
        from_version: str,
        to_version: str,
        batch_id: str,
        window_id: str
    ) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO upgrade_records 
            (device_id, upgrade_time, from_version, to_version, batch_id, window_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            device_id,
            datetime.now().isoformat(),
            from_version,
            to_version,
            batch_id,
            window_id,
            'in_progress'
        ))
        
        conn.commit()
        conn.close()
    
    def record_upgrade_success(
        self,
        device_id: str,
        to_version: str
    ) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE upgrade_records 
            SET status = 'success'
            WHERE device_id = ? AND to_version = ? AND status = 'in_progress'
            ORDER BY upgrade_time DESC
            LIMIT 1
        ''', (device_id, to_version))
        
        conn.commit()
        conn.close()
    
    def record_upgrade_failure(
        self,
        device_id: str,
        to_version: str,
        failure_reason: str
    ) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE upgrade_records 
            SET status = 'failed', failure_reason = ?
            WHERE device_id = ? AND to_version = ? AND status = 'in_progress'
            ORDER BY upgrade_time DESC
            LIMIT 1
        ''', (failure_reason, device_id, to_version))
        
        conn.commit()
        conn.close()
    
    def record_rollback(
        self,
        rollback_state: RollbackState
    ) -> None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO rollback_states 
            (rollback_id, device_id, rollback_time, from_version, to_version, 
             reason, telemetry_sync_status, telemetry_sync_time, success, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            rollback_state.rollback_id,
            rollback_state.device_id,
            rollback_state.rollback_time.isoformat(),
            rollback_state.from_version,
            rollback_state.to_version,
            rollback_state.reason,
            rollback_state.telemetry_sync_status,
            rollback_state.telemetry_sync_time.isoformat() if rollback_state.telemetry_sync_time else None,
            1 if rollback_state.success else 0,
            json.dumps(rollback_state.details or {})
        ))
        
        cursor.execute('''
            UPDATE upgrade_records
            SET rollback_performed = 1
            WHERE device_id = ? AND to_version = ? AND status = 'failed'
        ''', (rollback_state.device_id, rollback_state.from_version))
        
        conn.commit()
        conn.close()
        
        self._save_rollback_json(rollback_state)
    
    def _save_rollback_json(self, rollback_state: RollbackState) -> None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"rollback_{rollback_state.device_id}_{timestamp}.json"
        file_path = self.rollback_dir / filename
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(asdict(rollback_state), f, indent=2, cls=DataclassJSONEncoder)
    
    def update_telemetry_sync(
        self,
        rollback_id: str,
        sync_status: str,
        sync_time: Optional[datetime] = None
    ) -> None:
        if sync_time is None:
            sync_time = datetime.now()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE rollback_states
            SET telemetry_sync_status = ?, telemetry_sync_time = ?
            WHERE rollback_id = ?
        ''', (sync_status, sync_time.isoformat(), rollback_id))
        
        conn.commit()
        conn.close()
    
    def get_device_upgrade_history(
        self,
        device_id: str
    ) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM upgrade_records 
            WHERE device_id = ? 
            ORDER BY upgrade_time DESC
        ''', (device_id,))
        
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        results = []
        for row in rows:
            result = dict(zip(columns, row))
            result['rollback_performed'] = bool(result.get('rollback_performed', 0))
            results.append(result)
        
        conn.close()
        return results
    
    def get_device_rollback_history(
        self,
        device_id: str
    ) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM rollback_states 
            WHERE device_id = ? 
            ORDER BY rollback_time DESC
        ''', (device_id,))
        
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        results = []
        for row in rows:
            result = dict(zip(columns, row))
            if result.get('details'):
                result['details'] = json.loads(result['details'])
            result['success'] = bool(result.get('success', 1))
            results.append(result)
        
        conn.close()
        return results
    
    def get_all_rollback_states(
        self,
        success_only: bool = False
    ) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if success_only:
            cursor.execute('''
                SELECT * FROM rollback_states 
                WHERE success = 1
                ORDER BY rollback_time DESC
            ''')
        else:
            cursor.execute('''
                SELECT * FROM rollback_states 
                ORDER BY rollback_time DESC
            ''')
        
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        results = []
        for row in rows:
            result = dict(zip(columns, row))
            if result.get('details'):
                result['details'] = json.loads(result['details'])
            result['success'] = bool(result.get('success', 1))
            results.append(result)
        
        conn.close()
        return results
    
    def export_upgrade_records_csv(
        self,
        output_path: Path,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = '''
            SELECT * FROM upgrade_records 
            WHERE 1=1
        '''
        params = []
        
        if start_time:
            query += ' AND upgrade_time >= ?'
            params.append(start_time.isoformat())
        if end_time:
            query += ' AND upgrade_time <= ?'
            params.append(end_time.isoformat())
        
        query += ' ORDER BY upgrade_time'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            for row in rows:
                row_dict = dict(zip(columns, row))
                row_dict['rollback_performed'] = bool(row_dict.get('rollback_performed', 0))
                writer.writerow(row_dict)
        
        conn.close()
        return len(rows)
    
    def export_rollback_states_csv(
        self,
        output_path: Path,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = '''
            SELECT * FROM rollback_states 
            WHERE 1=1
        '''
        params = []
        
        if start_time:
            query += ' AND rollback_time >= ?'
            params.append(start_time.isoformat())
        if end_time:
            query += ' AND rollback_time <= ?'
            params.append(end_time.isoformat())
        
        query += ' ORDER BY rollback_time'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            for row in rows:
                row_dict = dict(zip(columns, row))
                row_dict['success'] = bool(row_dict.get('success', 1))
                if row_dict.get('details'):
                    row_dict['details'] = json.loads(row_dict['details'])
                writer.writerow(row_dict)
        
        conn.close()
        return len(rows)
    
    def check_rollback_telemetry_sync(
        self,
        rollback_id: str,
        telemetry_entries: List[Any]
    ) -> Tuple[bool, str]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM rollback_states WHERE rollback_id = ?
        ''', (rollback_id,))
        
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False, f"回滚记录不存在: {rollback_id}"
        
        columns = [desc[0] for desc in cursor.description]
        rollback_data = dict(zip(columns, row))
        conn.close()
        
        device_id = rollback_data['device_id']
        rollback_time = datetime.fromisoformat(rollback_data['rollback_time'])
        
        sync_entries = [
            e for e in telemetry_entries
            if e.device_id == device_id and e.timestamp > rollback_time
        ]
        
        for entry in sync_entries:
            if entry.event_type == 'telemetry_report':
                if entry.details.get('firmware_version') == rollback_data['to_version']:
                    return True, f"遥测已同步: 设备 {device_id} 版本已回滚到 {rollback_data['to_version']}"
        
        return False, f"遥测未同步: 设备 {device_id} 尚未上报回滚后的版本信息"
    
    def get_statistics(self) -> Dict[str, Any]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
                SUM(CASE WHEN rollback_performed = 1 THEN 1 ELSE 0 END) as rollback_count
            FROM upgrade_records
        ''')
        
        upgrade_stats = dict(zip(
            ['total', 'success_count', 'failed_count', 'in_progress_count', 'rollback_count'],
            cursor.fetchone()
        ))
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN telemetry_sync_status = 'synced' THEN 1 ELSE 0 END) as synced_count
            FROM rollback_states
        ''')
        
        rollback_stats = dict(zip(
            ['total', 'success_count', 'synced_count'],
            cursor.fetchone()
        ))
        
        conn.close()
        
        return {
            "upgrade_records": upgrade_stats,
            "rollback_states": rollback_stats,
            "storage_path": str(self.storage_dir)
        }
