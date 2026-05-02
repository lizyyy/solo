"""存储层模块 - 使用SQLite持久化数据"""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import Event, Timeline


class Storage:
    """SQLite存储管理器
    
    负责：
    1. 事件的存储和检索
    2. 时间线的存储和检索
    3. 历史记录查询
    """
    
    SCHEMA_VERSION = 1
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = data_dir / 'postmortem.db'
        self._init_db()
    
    def _get_connection(self) -> sqlite3.Connection:
        """获取数据库连接"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_db(self):
        """初始化数据库表结构"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
        row = cursor.fetchone()
        
        if not row:
            self._create_tables(cursor)
            cursor.execute('INSERT INTO schema_version (version) VALUES (?)', (self.SCHEMA_VERSION,))
        
        conn.commit()
        conn.close()
    
    def _create_tables(self, cursor):
        """创建数据库表"""
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL,
                original_timestamp TEXT,
                event_type TEXT NOT NULL DEFAULT 'unknown',
                source TEXT NOT NULL,
                source_file TEXT,
                service TEXT,
                environment TEXT,
                severity TEXT,
                title TEXT NOT NULL,
                description TEXT,
                raw_content TEXT,
                tags TEXT,
                metadata TEXT,
                is_duplicate INTEGER DEFAULT 0,
                duplicate_of TEXT,
                quarantine_reason TEXT,
                is_quarantined INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_events_service ON events(service)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type)
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS timelines (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                service TEXT,
                environment TEXT,
                event_ids TEXT,
                quarantined_event_ids TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_timelines_start_time ON timelines(start_time)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_timelines_service ON timelines(service)
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS timeline_events (
                timeline_id TEXT,
                event_id TEXT,
                event_order INTEGER,
                PRIMARY KEY (timeline_id, event_id),
                FOREIGN KEY (timeline_id) REFERENCES timelines(id),
                FOREIGN KEY (event_id) REFERENCES events(id)
            )
        ''')
    
    def save_event(self, event: Event) -> None:
        """保存单个事件"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO events (
                id, timestamp, original_timestamp, event_type, source, source_file,
                service, environment, severity, title, description, raw_content,
                tags, metadata, is_duplicate, duplicate_of, quarantine_reason, is_quarantined
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            event.id,
            event.timestamp.isoformat() if event.timestamp else None,
            event.original_timestamp,
            event.event_type,
            event.source,
            event.source_file,
            event.service,
            event.environment,
            event.severity,
            event.title,
            event.description,
            event.raw_content,
            json.dumps(event.tags, ensure_ascii=False) if event.tags else None,
            json.dumps(event.metadata, ensure_ascii=False) if event.metadata else None,
            1 if event.is_duplicate else 0,
            event.duplicate_of,
            event.quarantine_reason,
            1 if event.is_quarantined else 0,
        ))
        
        conn.commit()
        conn.close()
    
    def save_events(self, events: List[Event]) -> None:
        """批量保存事件"""
        for event in events:
            self.save_event(event)
    
    def get_event(self, event_id: str) -> Optional[Event]:
        """根据ID获取事件"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,))
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return self._row_to_event(row)
        return None
    
    def get_all_events(self) -> List[Event]:
        """获取所有事件"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM events ORDER BY timestamp')
        rows = cursor.fetchall()
        
        conn.close()
        
        return [self._row_to_event(row) for row in rows]
    
    def get_events_by_service(self, service: str) -> List[Event]:
        """按服务获取事件"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM events WHERE service = ? ORDER BY timestamp', (service,))
        rows = cursor.fetchall()
        
        conn.close()
        
        return [self._row_to_event(row) for row in rows]
    
    def get_events_by_time_range(
        self, 
        start_time: datetime, 
        end_time: datetime
    ) -> List[Event]:
        """按时间范围获取事件"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM events 
            WHERE timestamp >= ? AND timestamp <= ? 
            ORDER BY timestamp
        ''', (start_time.isoformat(), end_time.isoformat()))
        rows = cursor.fetchall()
        
        conn.close()
        
        return [self._row_to_event(row) for row in rows]
    
    def save_timeline(self, timeline: Timeline) -> None:
        """保存时间线"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        event_ids = [e.id for e in timeline.events]
        quarantined_ids = [e.id for e in timeline.quarantined_events]
        
        for event in timeline.events:
            self.save_event(event)
        
        for event in timeline.quarantined_events:
            self.save_event(event)
        
        cursor.execute('''
            INSERT OR REPLACE INTO timelines (
                id, title, start_time, end_time, service, environment,
                event_ids, quarantined_event_ids, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            timeline.id,
            timeline.title,
            timeline.start_time.isoformat() if timeline.start_time else None,
            timeline.end_time.isoformat() if timeline.end_time else None,
            timeline.service,
            timeline.environment,
            json.dumps(event_ids, ensure_ascii=False),
            json.dumps(quarantined_ids, ensure_ascii=False),
        ))
        
        cursor.execute('DELETE FROM timeline_events WHERE timeline_id = ?', (timeline.id,))
        
        for i, event_id in enumerate(event_ids):
            cursor.execute('''
                INSERT INTO timeline_events (timeline_id, event_id, event_order)
                VALUES (?, ?, ?)
            ''', (timeline.id, event_id, i))
        
        conn.commit()
        conn.close()
    
    def get_timeline(self, timeline_id: str) -> Optional[Timeline]:
        """根据ID获取时间线"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM timelines WHERE id = ?', (timeline_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return None
        
        timeline = self._row_to_timeline(row, cursor)
        
        conn.close()
        return timeline
    
    def list_timelines(self, limit: int = 10) -> List[Timeline]:
        """列出时间线，按创建时间倒序"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM timelines 
            ORDER BY created_at DESC 
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        
        timelines = [self._row_to_timeline(row, cursor) for row in rows]
        
        conn.close()
        return timelines
    
    def delete_timeline(self, timeline_id: str) -> bool:
        """删除时间线"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM timeline_events WHERE timeline_id = ?', (timeline_id,))
        cursor.execute('DELETE FROM timelines WHERE id = ?', (timeline_id,))
        
        deleted = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return deleted
    
    def clear_all_events(self) -> None:
        """清除所有事件（用于测试）"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM events')
        
        conn.commit()
        conn.close()
    
    def _row_to_event(self, row: sqlite3.Row) -> Event:
        """将数据库行转换为Event对象"""
        data = dict(row)
        
        if data.get('timestamp'):
            try:
                data['timestamp'] = datetime.fromisoformat(data['timestamp'])
            except (ValueError, TypeError):
                data['timestamp'] = datetime.now()
        
        if data.get('created_at'):
            try:
                data['created_at'] = datetime.fromisoformat(data['created_at'])
            except (ValueError, TypeError):
                pass
        
        if data.get('tags'):
            try:
                data['tags'] = json.loads(data['tags'])
            except (json.JSONDecodeError, TypeError):
                data['tags'] = []
        
        if data.get('metadata'):
            try:
                data['metadata'] = json.loads(data['metadata'])
            except (json.JSONDecodeError, TypeError):
                data['metadata'] = {}
        
        data['is_duplicate'] = bool(data.get('is_duplicate', 0))
        data['is_quarantined'] = bool(data.get('is_quarantined', 0))
        
        return Event(**data)
    
    def _row_to_timeline(self, row: sqlite3.Row, cursor: sqlite3.Cursor) -> Timeline:
        """将数据库行转换为Timeline对象"""
        data = dict(row)
        
        if data.get('start_time'):
            try:
                data['start_time'] = datetime.fromisoformat(data['start_time'])
            except (ValueError, TypeError):
                pass
        
        if data.get('end_time'):
            try:
                data['end_time'] = datetime.fromisoformat(data['end_time'])
            except (ValueError, TypeError):
                pass
        
        if data.get('created_at'):
            try:
                data['created_at'] = datetime.fromisoformat(data['created_at'])
            except (ValueError, TypeError):
                pass
        
        if data.get('updated_at'):
            try:
                data['updated_at'] = datetime.fromisoformat(data['updated_at'])
            except (ValueError, TypeError):
                pass
        
        events = []
        event_ids = []
        if data.get('event_ids'):
            try:
                event_ids = json.loads(data['event_ids'])
            except (json.JSONDecodeError, TypeError):
                pass
        
        for event_id in event_ids:
            cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,))
            event_row = cursor.fetchone()
            if event_row:
                events.append(self._row_to_event(event_row))
        
        quarantined_events = []
        quarantined_ids = []
        if data.get('quarantined_event_ids'):
            try:
                quarantined_ids = json.loads(data['quarantined_event_ids'])
            except (json.JSONDecodeError, TypeError):
                pass
        
        for event_id in quarantined_ids:
            cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,))
            event_row = cursor.fetchone()
            if event_row:
                quarantined_events.append(self._row_to_event(event_row))
        
        data['events'] = events
        data['quarantined_events'] = quarantined_events
        
        return Timeline(**data)
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取存储统计信息"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        stats = {}
        
        cursor.execute('SELECT COUNT(*) as count FROM events')
        stats['total_events'] = cursor.fetchone()['count']
        
        cursor.execute('''
            SELECT event_type, COUNT(*) as count 
            FROM events 
            GROUP BY event_type
        ''')
        stats['by_event_type'] = {row['event_type']: row['count'] for row in cursor.fetchall()}
        
        cursor.execute('''
            SELECT severity, COUNT(*) as count 
            FROM events 
            WHERE severity IS NOT NULL 
            GROUP BY severity
        ''')
        stats['by_severity'] = {row['severity']: row['count'] for row in cursor.fetchall()}
        
        cursor.execute('SELECT COUNT(*) as count FROM timelines')
        stats['total_timelines'] = cursor.fetchone()['count']
        
        conn.close()
        
        return stats
