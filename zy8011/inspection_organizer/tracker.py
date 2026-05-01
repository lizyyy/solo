"""
SQLite追踪库模块
用于维护照片处理的历史记录和追踪
"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .config import PhotoMetadata, Issue


class PhotoTracker:
    """照片追踪器"""
    
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self._init_db()
    
    @contextmanager
    def _get_connection(self):
        """获取数据库连接的上下文管理器"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_db(self):
        """初始化数据库表"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 创建照片记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS photos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_path TEXT NOT NULL,
                    archived_path TEXT,
                    filename TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    store_code TEXT,
                    checkpoint TEXT,
                    photo_time TEXT,
                    exif_time TEXT,
                    filename_time TEXT,
                    is_duplicate INTEGER DEFAULT 0,
                    duplicate_of TEXT,
                    processed_at TEXT NOT NULL,
                    batch_id TEXT,
                    UNIQUE(original_path, file_hash)
                )
            ''')
            
            # 创建问题记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    issue_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    message TEXT NOT NULL,
                    store_code TEXT,
                    checkpoint TEXT,
                    photo_id INTEGER,
                    details TEXT,
                    resolved INTEGER DEFAULT 0,
                    resolved_at TEXT,
                    resolved_note TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (photo_id) REFERENCES photos (id)
                )
            ''')
            
            # 创建批次记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS batches (
                    id TEXT PRIMARY KEY,
                    photo_dir TEXT NOT NULL,
                    rules_file TEXT,
                    inspection_file TEXT,
                    output_dir TEXT,
                    total_photos INTEGER DEFAULT 0,
                    archived_photos INTEGER DEFAULT 0,
                    issues_count INTEGER DEFAULT 0,
                    started_at TEXT NOT NULL,
                    completed_at TEXT
                )
            ''')
            
            # 创建索引
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_photos_store ON photos(store_code)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_photos_checkpoint ON photos(checkpoint)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_photos_hash ON photos(file_hash)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(issue_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_store ON issues(store_code)')
            
            conn.commit()
    
    def start_batch(self, photo_dir: str, rules_file: str = None, 
                   inspection_file: str = None, output_dir: str = None) -> str:
        """开始一个新的处理批次"""
        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO batches (id, photo_dir, rules_file, inspection_file, output_dir, started_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                batch_id,
                photo_dir,
                rules_file,
                inspection_file,
                output_dir,
                datetime.now().isoformat()
            ))
            conn.commit()
        
        return batch_id
    
    def end_batch(self, batch_id: str, total_photos: int = 0, 
                  archived_photos: int = 0, issues_count: int = 0):
        """结束处理批次"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE batches 
                SET total_photos = ?, archived_photos = ?, issues_count = ?, completed_at = ?
                WHERE id = ?
            ''', (
                total_photos,
                archived_photos,
                issues_count,
                datetime.now().isoformat(),
                batch_id
            ))
            conn.commit()
    
    def record_photo(self, metadata: PhotoMetadata, archived_path: str = None, 
                     batch_id: str = None) -> int:
        """记录照片处理信息"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 检查是否已存在
            cursor.execute('''
                SELECT id FROM photos WHERE original_path = ? AND file_hash = ?
            ''', (metadata.original_path, metadata.file_hash))
            
            existing = cursor.fetchone()
            
            if existing:
                # 更新现有记录
                cursor.execute('''
                    UPDATE photos SET
                        archived_path = ?,
                        store_code = ?,
                        checkpoint = ?,
                        photo_time = ?,
                        exif_time = ?,
                        filename_time = ?,
                        is_duplicate = ?,
                        duplicate_of = ?,
                        processed_at = ?,
                        batch_id = ?
                    WHERE id = ?
                ''', (
                    archived_path,
                    metadata.determined_store_code,
                    metadata.determined_checkpoint,
                    metadata.determined_time,
                    metadata.exif_time,
                    metadata.filename_time,
                    1 if metadata.is_duplicate else 0,
                    metadata.duplicate_of,
                    datetime.now().isoformat(),
                    batch_id,
                    existing['id']
                ))
                photo_id = existing['id']
            else:
                # 插入新记录
                cursor.execute('''
                    INSERT INTO photos (
                        original_path, archived_path, filename, file_hash, file_size,
                        store_code, checkpoint, photo_time, exif_time, filename_time,
                        is_duplicate, duplicate_of, processed_at, batch_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    metadata.original_path,
                    archived_path,
                    metadata.filename,
                    metadata.file_hash,
                    metadata.size,
                    metadata.determined_store_code,
                    metadata.determined_checkpoint,
                    metadata.determined_time,
                    metadata.exif_time,
                    metadata.filename_time,
                    1 if metadata.is_duplicate else 0,
                    metadata.duplicate_of,
                    datetime.now().isoformat(),
                    batch_id
                ))
                photo_id = cursor.lastrowid
            
            conn.commit()
            return photo_id
    
    def record_issue(self, issue: Issue, photo_id: int = None) -> int:
        """记录问题"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 将details转换为JSON字符串
            details_json = json.dumps(issue.details, ensure_ascii=False) if issue.details else None
            
            cursor.execute('''
                INSERT INTO issues (
                    issue_type, severity, message, store_code, checkpoint,
                    photo_id, details, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                issue.issue_type,
                issue.severity,
                issue.message,
                issue.store_code,
                issue.checkpoint,
                photo_id,
                details_json,
                datetime.now().isoformat()
            ))
            
            issue_id = cursor.lastrowid
            conn.commit()
            return issue_id
    
    def is_duplicate_hash(self, file_hash: str) -> bool:
        """检查文件哈希是否已存在（用于检测重复）"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) as count FROM photos WHERE file_hash = ? AND is_duplicate = 0
            ''', (file_hash,))
            result = cursor.fetchone()
            return result['count'] > 0
    
    def get_photo_by_hash(self, file_hash: str) -> Optional[Dict]:
        """根据哈希获取已存在的照片信息"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM photos WHERE file_hash = ? AND is_duplicate = 0 LIMIT 1
            ''', (file_hash,))
            result = cursor.fetchone()
            if result:
                return dict(result)
            return None
    
    def get_issues(self, issue_type: str = None, severity: str = None, 
                   store_code: str = None, unresolved_only: bool = True) -> List[Dict]:
        """查询问题记录"""
        query = '''
            SELECT i.*, p.original_path, p.archived_path, p.filename
            FROM issues i
            LEFT JOIN photos p ON i.photo_id = p.id
            WHERE 1=1
        '''
        params = []
        
        if issue_type:
            query += ' AND i.issue_type = ?'
            params.append(issue_type)
        
        if severity:
            query += ' AND i.severity = ?'
            params.append(severity)
        
        if store_code:
            query += ' AND i.store_code = ?'
            params.append(store_code)
        
        if unresolved_only:
            query += ' AND i.resolved = 0'
        
        query += ' ORDER BY i.created_at DESC'
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            results = cursor.fetchall()
            return [dict(row) for row in results]
    
    def resolve_issue(self, issue_id: int, note: str = None):
        """标记问题为已解决"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE issues 
                SET resolved = 1, resolved_at = ?, resolved_note = ?
                WHERE id = ?
            ''', (
                datetime.now().isoformat(),
                note,
                issue_id
            ))
            conn.commit()
    
    def get_statistics(self, batch_id: str = None) -> Dict:
        """获取统计信息"""
        stats = {
            "total_photos": 0,
            "total_issues": 0,
            "by_store": {},
            "by_checkpoint": {},
            "by_issue_type": {},
            "by_severity": {},
            "unresolved_issues": 0,
        }
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 总照片数
            query = 'SELECT COUNT(*) as count FROM photos'
            params = []
            if batch_id:
                query += ' WHERE batch_id = ?'
                params.append(batch_id)
            cursor.execute(query, params)
            stats["total_photos"] = cursor.fetchone()['count']
            
            # 总问题数
            query = 'SELECT COUNT(*) as count FROM issues'
            params = []
            if batch_id:
                query += '''
                    WHERE photo_id IN (SELECT id FROM photos WHERE batch_id = ?)
                '''
                params.append(batch_id)
            cursor.execute(query, params)
            stats["total_issues"] = cursor.fetchone()['count']
            
            # 未解决问题数
            query = 'SELECT COUNT(*) as count FROM issues WHERE resolved = 0'
            cursor.execute(query)
            stats["unresolved_issues"] = cursor.fetchone()['count']
            
            # 按门店统计
            cursor.execute('''
                SELECT store_code, COUNT(*) as count 
                FROM photos 
                GROUP BY store_code
            ''')
            for row in cursor.fetchall():
                if row['store_code']:
                    stats["by_store"][row['store_code']] = row['count']
            
            # 按问题类型统计
            cursor.execute('''
                SELECT issue_type, COUNT(*) as count 
                FROM issues 
                GROUP BY issue_type
            ''')
            for row in cursor.fetchall():
                stats["by_issue_type"][row['issue_type']] = row['count']
            
            # 按严重程度统计
            cursor.execute('''
                SELECT severity, COUNT(*) as count 
                FROM issues 
                WHERE resolved = 0
                GROUP BY severity
            ''')
            for row in cursor.fetchall():
                stats["by_severity"][row['severity']] = row['count']
        
        return stats
    
    def get_batch_history(self, limit: int = 10) -> List[Dict]:
        """获取批次处理历史"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM batches 
                ORDER BY started_at DESC 
                LIMIT ?
            ''', (limit,))
            results = cursor.fetchall()
            return [dict(row) for row in results]
