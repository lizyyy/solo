"""数据导入模块"""

import os
import sqlite3
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import (
    DatabaseInfo,
    TraceEvent,
    Migration,
    WorkloadOperation,
    WorkloadTransaction,
    ImportedData
)


class Importer:
    def __init__(self):
        self.data = ImportedData()
    
    def import_database(self, db_path: str) -> bool:
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"数据库文件不存在: {db_path}")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        db_info = DatabaseInfo(path=db_path, size=os.path.getsize(db_path))
        
        try:
            cursor.execute("PRAGMA page_size")
            db_info.page_size = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA page_count")
            db_info.page_count = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA journal_mode")
            db_info.journal_mode = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA synchronous")
            sync_map = {0: "off", 1: "normal", 2: "full", 3: "extra"}
            sync_val = cursor.fetchone()[0]
            db_info.synchronous = sync_map.get(sync_val, str(sync_val))
            
            cursor.execute("PRAGMA busy_timeout")
            db_info.busy_timeout = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA foreign_keys")
            db_info.foreign_keys = cursor.fetchone()[0] == 1
            
            cursor.execute("PRAGMA wal_autocheckpoint")
            db_info.wal_autocheckpoint = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA cache_size")
            db_info.cache_size = cursor.fetchone()[0]
            
            cursor.execute("PRAGMA temp_store")
            temp_map = {0: "default", 1: "file", 2: "memory"}
            temp_val = cursor.fetchone()[0]
            db_info.temp_store = temp_map.get(temp_val, str(temp_val))
            
            cursor.execute("PRAGMA locking_mode")
            db_info.locking_mode = cursor.fetchone()[0]
        except Exception as e:
            print(f"警告: 无法读取某些 PRAGMA 配置: {e}")
        
        wal_path = db_path + "-wal"
        if os.path.exists(wal_path):
            db_info.wal_size = os.path.getsize(wal_path)
        
        self.data.database_info = db_info
        conn.close()
        return True
    
    def import_trace_log(self, log_path: str) -> bool:
        if not os.path.exists(log_path):
            raise FileNotFoundError(f"Trace 日志文件不存在: {log_path}")
        
        events = []
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                event = self._parse_trace_line(line)
                if event:
                    events.append(event)
        
        self.data.trace_events = events
        return True
    
    def _parse_trace_line(self, line: str) -> Optional[TraceEvent]:
        timestamp_pattern = r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+'
        match = re.match(timestamp_pattern, line)
        
        timestamp = datetime.now()
        if match:
            try:
                ts_str = match.group(1)
                if '.' in ts_str:
                    timestamp = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S.%f")
                else:
                    timestamp = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        
        conn_match = re.search(r'\[conn:?\s*(\d+|0x[0-9a-fA-F]+)\]', line, re.IGNORECASE)
        connection_id = conn_match.group(1) if conn_match else "unknown"
        
        duration_match = re.search(r'(\d+(?:\.\d+)?)\s*ms', line, re.IGNORECASE)
        duration_ms = float(duration_match.group(1)) if duration_match else 0.0
        
        lock_wait_match = re.search(r'lock\s*wait[:\s]*(\d+(?:\.\d+)?)\s*ms', line, re.IGNORECASE)
        lock_wait_ms = float(lock_wait_match.group(1)) if lock_wait_match else 0.0
        
        lock_types = ['SHARED', 'RESERVED', 'PENDING', 'EXCLUSIVE', 'READ', 'WRITE']
        lock_type = None
        for lt in lock_types:
            if lt.lower() in line.lower():
                lock_type = lt
                break
        
        event_type = "UNKNOWN"
        if 'BEGIN' in line.upper():
            event_type = "BEGIN"
        elif 'COMMIT' in line.upper():
            event_type = "COMMIT"
        elif 'ROLLBACK' in line.upper():
            event_type = "ROLLBACK"
        elif 'SELECT' in line.upper():
            event_type = "SELECT"
        elif 'INSERT' in line.upper():
            event_type = "INSERT"
        elif 'UPDATE' in line.upper():
            event_type = "UPDATE"
        elif 'DELETE' in line.upper():
            event_type = "DELETE"
        elif 'CREATE' in line.upper():
            event_type = "CREATE"
        elif 'ALTER' in line.upper():
            event_type = "ALTER"
        elif 'DROP' in line.upper():
            event_type = "DROP"
        elif 'checkpoint' in line.lower():
            event_type = "CHECKPOINT"
        elif 'locked' in line.lower() or 'database is locked' in line.lower():
            event_type = "LOCK_ERROR"
        elif 'busy' in line.lower():
            event_type = "BUSY"
        
        success = 'error' not in line.lower() and 'fail' not in line.lower() and 'locked' not in line.lower()
        
        error_message = None
        if not success:
            error_match = re.search(r'(?:error|fail|locked)[^:]*:\s*(.+)', line, re.IGNORECASE)
            if error_match:
                error_message = error_match.group(1).strip()
        
        statement = line
        sql_match = re.search(r'(?:--|;)\s*((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|BEGIN|COMMIT|ROLLBACK|PRAGMA).+)', 
                              line, re.IGNORECASE | re.DOTALL)
        if sql_match:
            statement = sql_match.group(1).strip()
        
        return TraceEvent(
            timestamp=timestamp,
            event_type=event_type,
            connection_id=connection_id,
            statement=statement,
            duration_ms=duration_ms,
            lock_type=lock_type,
            lock_wait_ms=lock_wait_ms,
            success=success,
            error_message=error_message
        )
    
    def import_migrations(self, migrations_dir: str) -> bool:
        if not os.path.isdir(migrations_dir):
            raise NotADirectoryError(f"迁移目录不存在: {migrations_dir}")
        
        migrations = []
        for filename in sorted(os.listdir(migrations_dir)):
            if not (filename.endswith('.sql') or filename.endswith('.up.sql')):
                continue
            
            file_path = os.path.join(migrations_dir, filename)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            migration = self._parse_migration(filename, file_path, content)
            migrations.append(migration)
        
        self.data.migrations = migrations
        return True
    
    def _parse_migration(self, filename: str, file_path: str, content: str) -> Migration:
        has_alter_table = 'ALTER TABLE' in content.upper()
        has_drop_table = 'DROP TABLE' in content.upper()
        has_create_table_as = re.search(r'CREATE\s+(?:TEMP\s+)?TABLE\s+[^(]+\s+AS\s+SELECT', 
                                         content, re.IGNORECASE) is not None
        
        tables_affected = []
        alter_matches = re.findall(r'ALTER\s+TABLE\s+["`\[]?([\w.]+)["`\]]?', content, re.IGNORECASE)
        tables_affected.extend(alter_matches)
        
        drop_matches = re.findall(r'DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`\[]?([\w.]+)["`\]]?', content, re.IGNORECASE)
        tables_affected.extend(drop_matches)
        
        tables_affected = list(set(tables_affected))
        
        has_rebuild = False
        rebuild_patterns = [
            r'CREATE\s+TABLE.*SELECT.*FROM',
            r'INSERT\s+INTO.*SELECT.*FROM.*DROP.*TABLE',
            r'ALTER\s+TABLE.*RENAME.*CREATE.*TABLE.*INSERT.*SELECT',
        ]
        for pattern in rebuild_patterns:
            if re.search(pattern, content, re.IGNORECASE | re.DOTALL):
                has_rebuild = True
                break
        
        version_match = re.match(r'^(\d+)', filename)
        version = version_match.group(1) if version_match else "unknown"
        
        name = filename.replace('.sql', '').replace('.up', '')
        
        return Migration(
            version=version,
            name=name,
            file_path=file_path,
            sql_content=content,
            has_alter_table=has_alter_table,
            has_drop_table=has_drop_table,
            has_create_table_as=has_create_table_as,
            has_rebuild_operations=has_rebuild,
            tables_affected=tables_affected
        )
    
    def import_pragma_config(self, config_path: str) -> bool:
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"PRAGMA 配置文件不存在: {config_path}")
        
        config = {}
        with open(config_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('--') or line.startswith('#'):
                    continue
                
                pragma_match = re.match(r'PRAGMA\s+([\w_]+)\s*=\s*([^;]+);?', line, re.IGNORECASE)
                if pragma_match:
                    key = pragma_match.group(1).lower()
                    value = pragma_match.group(2).strip().strip("'\"")
                    
                    if value.isdigit():
                        value = int(value)
                    elif value.replace('.', '', 1).isdigit() and '.' in value:
                        value = float(value)
                    
                    config[key] = value
        
        self.data.pragma_config = config
        return True
    
    def import_workload_log(self, log_path: str) -> bool:
        if not os.path.exists(log_path):
            raise FileNotFoundError(f"工作负载日志文件不存在: {log_path}")
        
        operations = []
        transactions = {}
        current_transaction = None
        
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                op = self._parse_workload_line(line)
                if op:
                    operations.append(op)
                    
                    if op.transaction_id:
                        if op.transaction_id not in transactions:
                            transactions[op.transaction_id] = WorkloadTransaction(
                                transaction_id=op.transaction_id,
                                connection_id=op.connection_id or "unknown",
                                start_time=op.timestamp,
                                operations=[]
                            )
                        
                        txn = transactions[op.transaction_id]
                        txn.operations.append(op)
                        
                        if op.operation_type in ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP']:
                            txn.is_read_only = False
                        
                        if op.operation_type == 'COMMIT':
                            txn.end_time = op.timestamp
                            txn.commit_success = True
                            if txn.start_time:
                                txn.duration_ms = (txn.end_time - txn.start_time).total_seconds() * 1000
                        elif op.operation_type == 'ROLLBACK':
                            txn.end_time = op.timestamp
                            txn.commit_success = False
                            if txn.start_time:
                                txn.duration_ms = (txn.end_time - txn.start_time).total_seconds() * 1000
        
        self.data.workload_operations = operations
        self.data.workload_transactions = list(transactions.values())
        return True
    
    def _parse_workload_line(self, line: str) -> Optional[WorkloadOperation]:
        timestamp_pattern = r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+'
        match = re.match(timestamp_pattern, line)
        
        timestamp = datetime.now()
        if match:
            try:
                ts_str = match.group(1)
                if '.' in ts_str:
                    timestamp = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S.%f")
                else:
                    timestamp = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        
        conn_match = re.search(r'\[conn:?\s*(\d+|0x[0-9a-fA-F]+)\]', line, re.IGNORECASE)
        connection_id = conn_match.group(1) if conn_match else None
        
        txn_match = re.search(r'\[txn:?\s*(\d+|0x[0-9a-fA-F]+)\]', line, re.IGNORECASE)
        transaction_id = txn_match.group(1) if txn_match else None
        
        duration_match = re.search(r'(\d+(?:\.\d+)?)\s*ms', line, re.IGNORECASE)
        duration_ms = float(duration_match.group(1)) if duration_match else 0.0
        
        rows_match = re.search(r'(\d+)\s*(?:rows?|affected)', line, re.IGNORECASE)
        rows_affected = int(rows_match.group(1)) if rows_match else 0
        
        operation_type = "UNKNOWN"
        if 'BEGIN' in line.upper():
            operation_type = "BEGIN"
        elif 'COMMIT' in line.upper():
            operation_type = "COMMIT"
        elif 'ROLLBACK' in line.upper():
            operation_type = "ROLLBACK"
        elif 'SELECT' in line.upper():
            operation_type = "SELECT"
        elif 'INSERT' in line.upper():
            operation_type = "INSERT"
        elif 'UPDATE' in line.upper():
            operation_type = "UPDATE"
        elif 'DELETE' in line.upper():
            operation_type = "DELETE"
        elif 'CREATE' in line.upper():
            operation_type = "CREATE"
        elif 'ALTER' in line.upper():
            operation_type = "ALTER"
        elif 'DROP' in line.upper():
            operation_type = "DROP"
        
        table_name = None
        table_match = re.search(r'(?:FROM|INTO|UPDATE|TABLE)\s+["`\[]?([\w.]+)["`\]]?', line, re.IGNORECASE)
        if table_match:
            table_name = table_match.group(1)
        
        sql = line
        
        return WorkloadOperation(
            timestamp=timestamp,
            operation_type=operation_type,
            table_name=table_name,
            sql=sql,
            duration_ms=duration_ms,
            rows_affected=rows_affected,
            connection_id=connection_id,
            transaction_id=transaction_id
        )
    
    def get_data(self) -> ImportedData:
        return self.data
