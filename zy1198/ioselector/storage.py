"""
SQLite 存储模块 - 保存和查询运行记录
"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from contextlib import contextmanager

from .models import SimulationResult, IOSelectorType, TriggerMode


class SQLiteStorage:
    """
    SQLite 存储管理器
    
    用于保存和查询模拟运行记录
    """
    
    SCHEMA_VERSION = 1
    
    def __init__(self, db_path: Optional[str] = None):
        """
        初始化存储
        
        Args:
            db_path: 数据库文件路径，默认为当前目录下的 ioselector.db
        """
        if db_path is None:
            db_path = Path.cwd() / "ioselector.db"
        self.db_path = str(db_path)
        self._init_db()
    
    @contextmanager
    def _get_connection(self):
        """获取数据库连接上下文"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_db(self):
        """初始化数据库表结构"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 创建配置表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY
                )
            ''')
            
            cursor.execute('SELECT version FROM schema_version')
            if not cursor.fetchone():
                cursor.execute('INSERT INTO schema_version (version) VALUES (?)', 
                               (self.SCHEMA_VERSION,))
            
            # 创建运行记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_name TEXT NOT NULL,
                    selector_type TEXT NOT NULL,
                    trigger_mode TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    duration_ms INTEGER,
                    total_wakeups INTEGER,
                    unnecessary_wakeups INTEGER,
                    cpu_spins INTEGER,
                    fd_scan_count INTEGER,
                    missed_reads INTEGER,
                    thundering_herd_count INTEGER,
                    worker_stats TEXT,
                    fd_stats TEXT,
                    notes TEXT
                )
            ''')
            
            # 创建事件时间表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id INTEGER NOT NULL,
                    timestamp_ms INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    fd INTEGER,
                    worker_id INTEGER,
                    details TEXT,
                    FOREIGN KEY (run_id) REFERENCES runs (id)
                )
            ''')
            
            # 创建索引
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_runs_case_name ON runs (case_name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs (start_time)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_run_id ON events (run_id)')
            
            conn.commit()
    
    def save_run(self, result: SimulationResult, notes: str = "") -> int:
        """
        保存一次运行记录
        
        Args:
            result: 模拟结果
            notes: 附加备注
            
        Returns:
            int: 插入的记录 ID
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 插入主记录
            cursor.execute('''
                INSERT INTO runs (
                    case_name, selector_type, trigger_mode, start_time, end_time,
                    duration_ms, total_wakeups, unnecessary_wakeups, cpu_spins,
                    fd_scan_count, missed_reads, thundering_herd_count,
                    worker_stats, fd_stats, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                result.case_name,
                result.selector_type.value,
                result.trigger_mode.value,
                result.start_time.isoformat(),
                result.end_time.isoformat() if result.end_time else None,
                result.duration_ms,
                result.total_wakeups,
                result.unnecessary_wakeups,
                result.cpu_spins,
                result.fd_scan_count,
                result.missed_reads,
                result.thundering_herd_count,
                json.dumps(result.worker_stats, ensure_ascii=False),
                json.dumps(result.fd_stats, ensure_ascii=False),
                notes
            ))
            
            run_id = cursor.lastrowid
            
            # 插入事件记录
            if result.events:
                event_rows = [
                    (
                        run_id,
                        event.timestamp_ms,
                        event.event_type.value,
                        event.fd,
                        event.worker_id,
                        event.details
                    )
                    for event in result.events
                ]
                
                cursor.executemany('''
                    INSERT INTO events (run_id, timestamp_ms, event_type, fd, worker_id, details)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', event_rows)
            
            conn.commit()
            return run_id
    
    def get_run(self, run_id: int) -> Optional[Dict[str, Any]]:
        """
        获取指定 ID 的运行记录
        
        Args:
            run_id: 记录 ID
            
        Returns:
            记录字典或 None
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM runs WHERE id = ?', (run_id,))
            row = cursor.fetchone()
            
            if row is None:
                return None
            
            result = dict(row)
            
            # 解析 JSON 字段
            if result['worker_stats']:
                result['worker_stats'] = json.loads(result['worker_stats'])
            if result['fd_stats']:
                result['fd_stats'] = json.loads(result['fd_stats'])
            
            return result
    
    def get_run_events(self, run_id: int) -> List[Dict[str, Any]]:
        """
        获取指定运行的所有事件
        
        Args:
            run_id: 运行 ID
            
        Returns:
            事件列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM events 
                WHERE run_id = ? 
                ORDER BY timestamp_ms, id
            ''', (run_id,))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def list_runs(self, case_name: Optional[str] = None, 
                  limit: int = 20) -> List[Dict[str, Any]]:
        """
        列出运行记录
        
        Args:
            case_name: 按用例名称过滤
            limit: 返回数量限制
            
        Returns:
            运行记录列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if case_name:
                cursor.execute('''
                    SELECT * FROM runs 
                    WHERE case_name = ? 
                    ORDER BY start_time DESC 
                    LIMIT ?
                ''', (case_name, limit))
            else:
                cursor.execute('''
                    SELECT * FROM runs 
                    ORDER BY start_time DESC 
                    LIMIT ?
                ''', (limit,))
            
            results = []
            for row in cursor.fetchall():
                result = dict(row)
                if result['worker_stats']:
                    result['worker_stats'] = json.loads(result['worker_stats'])
                if result['fd_stats']:
                    result['fd_stats'] = json.loads(result['fd_stats'])
                results.append(result)
            
            return results
    
    def get_statistics(self, case_name: Optional[str] = None) -> Dict[str, Any]:
        """
        获取统计汇总
        
        Args:
            case_name: 按用例过滤
            
        Returns:
            统计汇总
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if case_name:
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_runs,
                        AVG(total_wakeups) as avg_wakeups,
                        AVG(unnecessary_wakeups) as avg_unnecessary_wakeups,
                        AVG(cpu_spins) as avg_cpu_spins,
                        AVG(fd_scan_count) as avg_fd_scans,
                        AVG(missed_reads) as avg_missed_reads,
                        AVG(thundering_herd_count) as avg_herd_count
                    FROM runs WHERE case_name = ?
                ''', (case_name,))
            else:
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_runs,
                        AVG(total_wakeups) as avg_wakeups,
                        AVG(unnecessary_wakeups) as avg_unnecessary_wakeups,
                        AVG(cpu_spins) as avg_cpu_spins,
                        AVG(fd_scan_count) as avg_fd_scans,
                        AVG(missed_reads) as avg_missed_reads,
                        AVG(thundering_herd_count) as avg_herd_count
                    FROM runs
                ''')
            
            row = cursor.fetchone()
            stats = dict(row) if row else {}
            
            # 获取不同配置的对比
            cursor.execute('''
                SELECT 
                    selector_type,
                    trigger_mode,
                    COUNT(*) as run_count,
                    AVG(total_wakeups) as avg_wakeups,
                    AVG(unnecessary_wakeups) as avg_unnecessary_wakeups,
                    AVG(cpu_spins) as avg_cpu_spins,
                    AVG(fd_scan_count) as avg_fd_scans,
                    AVG(thundering_herd_count) as avg_herd_count
                FROM runs
                GROUP BY selector_type, trigger_mode
                ORDER BY selector_type, trigger_mode
            ''')
            
            stats['by_config'] = [dict(row) for row in cursor.fetchall()]
            
            return stats
    
    def delete_run(self, run_id: int) -> bool:
        """
        删除指定的运行记录
        
        Args:
            run_id: 记录 ID
            
        Returns:
            是否成功删除
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 先删除事件
            cursor.execute('DELETE FROM events WHERE run_id = ?', (run_id,))
            
            # 删除主记录
            cursor.execute('DELETE FROM runs WHERE id = ?', (run_id,))
            
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
    
    def clear_all(self) -> int:
        """
        清空所有数据
        
        Returns:
            删除的记录数
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM events')
            events_deleted = cursor.rowcount
            
            cursor.execute('DELETE FROM runs')
            runs_deleted = cursor.rowcount
            
            conn.commit()
            return runs_deleted
