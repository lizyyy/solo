"""
数据库层 - SQLite数据持久化
管理项目数据、异常记录和复核意见的存储
"""

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Generator

from .models import (
    Exhibit, ScanRecord, PhotoRecord, Anomaly, ReviewComment, ProjectData
)


class DatabaseManager:
    """SQLite数据库管理器"""
    
    def __init__(self, db_path: Optional[str] = None):
        """
        初始化数据库管理器
        
        Args:
            db_path: 数据库文件路径，如果为None则使用默认路径
        """
        if db_path is None:
            # 默认数据库路径：用户目录下的 .exhibit_verifier 文件夹
            home_dir = Path.home()
            app_dir = home_dir / ".exhibit_verifier"
            app_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(app_dir / "exhibit_verifier.db")
        
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """初始化数据库表结构"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 项目表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    project_id TEXT PRIMARY KEY,
                    project_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    description TEXT
                )
            ''')
            
            # 展品表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS exhibits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    exhibit_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    category TEXT,
                    location TEXT,
                    condition TEXT DEFAULT '完好',
                    is_fragile INTEGER DEFAULT 0,
                    special_requirements TEXT,
                    estimated_value REAL DEFAULT 0.0,
                    notes TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(project_id),
                    UNIQUE(project_id, exhibit_id)
                )
            ''')
            
            # 扫描记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scan_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    scan_id TEXT NOT NULL,
                    exhibit_id TEXT NOT NULL,
                    box_number TEXT NOT NULL,
                    scan_time TEXT NOT NULL,
                    operator TEXT NOT NULL,
                    location TEXT,
                    temperature REAL,
                    humidity REAL,
                    buffer_verified INTEGER DEFAULT 0,
                    has_signature INTEGER DEFAULT 0,
                    notes TEXT,
                    photo_references TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(project_id),
                    UNIQUE(project_id, scan_id)
                )
            ''')
            
            # 照片记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS photo_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    photo_id TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    capture_time TEXT,
                    exhibit_references TEXT,
                    box_references TEXT,
                    is_evidence_photo INTEGER DEFAULT 1,
                    notes TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(project_id),
                    UNIQUE(project_id, photo_id)
                )
            ''')
            
            # 异常记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS anomalies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    anomaly_id TEXT NOT NULL,
                    anomaly_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    exhibit_id TEXT,
                    box_number TEXT,
                    scan_id TEXT,
                    photo_id TEXT,
                    description TEXT NOT NULL,
                    suggestion TEXT,
                    detected_time TEXT NOT NULL,
                    is_resolved INTEGER DEFAULT 0,
                    resolved_by TEXT,
                    resolved_time TEXT,
                    resolution_notes TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(project_id),
                    UNIQUE(project_id, anomaly_id)
                )
            ''')
            
            # 复核意见表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS review_comments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    comment_id TEXT NOT NULL,
                    anomaly_id TEXT NOT NULL,
                    reviewer TEXT NOT NULL,
                    comment TEXT NOT NULL,
                    review_time TEXT NOT NULL,
                    is_approved INTEGER DEFAULT 0,
                    follow_up_required INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(project_id),
                    FOREIGN KEY (anomaly_id) REFERENCES anomalies(anomaly_id),
                    UNIQUE(project_id, comment_id)
                )
            ''')
            
            # 创建索引以提高查询性能
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_exhibits_project ON exhibits(project_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_scans_project ON scan_records(project_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_scans_exhibit ON scan_records(exhibit_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_anomalies_project ON anomalies(project_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON anomalies(is_resolved)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_anomaly ON review_comments(anomaly_id)')
            
            conn.commit()
    
    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """获取数据库连接的上下文管理器"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    # ==================== 项目管理 ====================
    
    def create_project(self, project_name: str, description: str = "") -> str:
        """
        创建新项目
        
        Args:
            project_name: 项目名称
            description: 项目描述
            
        Returns:
            str: 新项目的ID
        """
        project_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO projects (project_id, project_name, created_at, updated_at, description)
                VALUES (?, ?, ?, ?, ?)
            ''', (project_id, project_name, now, now, description))
            conn.commit()
        
        return project_id
    
    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """获取项目信息"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM projects WHERE project_id = ?', (project_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """列出所有项目"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM projects ORDER BY created_at DESC')
            return [dict(row) for row in cursor.fetchall()]
    
    def update_project(self, project_id: str, project_name: Optional[str] = None, 
                        description: Optional[str] = None) -> bool:
        """更新项目信息"""
        updates = []
        params = []
        now = datetime.now().isoformat()
        
        if project_name is not None:
            updates.append("project_name = ?")
            params.append(project_name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        
        if not updates:
            return False
        
        updates.append("updated_at = ?")
        params.extend([now, project_id])
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f'''
                UPDATE projects SET {', '.join(updates)}
                WHERE project_id = ?
            ''', params)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_project(self, project_id: str) -> bool:
        """删除项目及其所有关联数据"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 先删除子表数据
            cursor.execute('DELETE FROM review_comments WHERE project_id = ?', (project_id,))
            cursor.execute('DELETE FROM anomalies WHERE project_id = ?', (project_id,))
            cursor.execute('DELETE FROM photo_records WHERE project_id = ?', (project_id,))
            cursor.execute('DELETE FROM scan_records WHERE project_id = ?', (project_id,))
            cursor.execute('DELETE FROM exhibits WHERE project_id = ?', (project_id,))
            cursor.execute('DELETE FROM projects WHERE project_id = ?', (project_id,))
            
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== 展品管理 ====================
    
    def save_exhibits(self, project_id: str, exhibits: List[Exhibit]) -> int:
        """保存展品列表（覆盖式）"""
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 先删除该项目的所有展品
            cursor.execute('DELETE FROM exhibits WHERE project_id = ?', (project_id,))
            
            # 插入新展品
            count = 0
            for exhibit in exhibits:
                cursor.execute('''
                    INSERT INTO exhibits (
                        project_id, exhibit_id, name, category, location, condition,
                        is_fragile, special_requirements, estimated_value, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project_id, exhibit.exhibit_id, exhibit.name, exhibit.category,
                    exhibit.location, exhibit.condition, int(exhibit.is_fragile),
                    exhibit.special_requirements, exhibit.estimated_value, exhibit.notes, now
                ))
                count += 1
            
            conn.commit()
            return count
    
    def get_exhibits(self, project_id: str) -> List[Exhibit]:
        """获取项目的所有展品"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM exhibits WHERE project_id = ?', (project_id,))
            rows = cursor.fetchall()
            
            exhibits = []
            for row in rows:
                exhibits.append(Exhibit(
                    exhibit_id=row['exhibit_id'],
                    name=row['name'],
                    category=row['category'] or "",
                    location=row['location'] or "",
                    condition=row['condition'] or "完好",
                    is_fragile=bool(row['is_fragile']),
                    special_requirements=row['special_requirements'] or "",
                    estimated_value=row['estimated_value'] or 0.0,
                    notes=row['notes'] or ""
                ))
            return exhibits
    
    # ==================== 扫描记录管理 ====================
    
    def save_scan_records(self, project_id: str, scans: List[ScanRecord]) -> int:
        """保存扫描记录列表（覆盖式）"""
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM scan_records WHERE project_id = ?', (project_id,))
            
            count = 0
            for scan in scans:
                cursor.execute('''
                    INSERT INTO scan_records (
                        project_id, scan_id, exhibit_id, box_number, scan_time, operator,
                        location, temperature, humidity, buffer_verified, has_signature,
                        notes, photo_references, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project_id, scan.scan_id, scan.exhibit_id, scan.box_number,
                    scan.scan_time.isoformat(), scan.operator, scan.location,
                    scan.temperature, scan.humidity, int(scan.buffer_verified),
                    int(scan.has_signature), scan.notes,
                    json.dumps(scan.photo_references), now
                ))
                count += 1
            
            conn.commit()
            return count
    
    def get_scan_records(self, project_id: str) -> List[ScanRecord]:
        """获取项目的所有扫描记录"""
        from dateutil.parser import parse as parse_date
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM scan_records WHERE project_id = ?', (project_id,))
            rows = cursor.fetchall()
            
            scans = []
            for row in rows:
                photo_refs = json.loads(row['photo_references']) if row['photo_references'] else []
                
                scans.append(ScanRecord(
                    scan_id=row['scan_id'],
                    exhibit_id=row['exhibit_id'],
                    box_number=row['box_number'],
                    scan_time=parse_date(row['scan_time']),
                    operator=row['operator'],
                    location=row['location'] or "",
                    temperature=row['temperature'],
                    humidity=row['humidity'],
                    buffer_verified=bool(row['buffer_verified']),
                    has_signature=bool(row['has_signature']),
                    notes=row['notes'] or "",
                    photo_references=photo_refs
                ))
            return scans
    
    # ==================== 照片记录管理 ====================
    
    def save_photo_records(self, project_id: str, photos: List[PhotoRecord]) -> int:
        """保存照片记录列表（覆盖式）"""
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM photo_records WHERE project_id = ?', (project_id,))
            
            count = 0
            for photo in photos:
                cursor.execute('''
                    INSERT INTO photo_records (
                        project_id, photo_id, file_path, file_name, file_size, capture_time,
                        exhibit_references, box_references, is_evidence_photo, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project_id, photo.photo_id, photo.file_path, photo.file_name,
                    photo.file_size,
                    photo.capture_time.isoformat() if photo.capture_time else None,
                    json.dumps(photo.exhibit_references), json.dumps(photo.box_references),
                    int(photo.is_evidence_photo), photo.notes, now
                ))
                count += 1
            
            conn.commit()
            return count
    
    def get_photo_records(self, project_id: str) -> List[PhotoRecord]:
        """获取项目的所有照片记录"""
        from dateutil.parser import parse as parse_date
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM photo_records WHERE project_id = ?', (project_id,))
            rows = cursor.fetchall()
            
            photos = []
            for row in rows:
                exhibit_refs = json.loads(row['exhibit_references']) if row['exhibit_references'] else []
                box_refs = json.loads(row['box_references']) if row['box_references'] else []
                capture_time = parse_date(row['capture_time']) if row['capture_time'] else None
                
                photos.append(PhotoRecord(
                    photo_id=row['photo_id'],
                    file_path=row['file_path'],
                    file_name=row['file_name'],
                    file_size=row['file_size'],
                    capture_time=capture_time,
                    exhibit_references=exhibit_refs,
                    box_references=box_refs,
                    is_evidence_photo=bool(row['is_evidence_photo']),
                    notes=row['notes'] or ""
                ))
            return photos
    
    # ==================== 异常记录管理 ====================
    
    def save_anomalies(self, project_id: str, anomalies: List[Anomaly]) -> int:
        """保存异常记录列表（覆盖式，保留解决状态）"""
        # 先获取现有已解决的异常
        existing_resolved = {}
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT anomaly_id, is_resolved, resolved_by, resolved_time, resolution_notes
                FROM anomalies WHERE project_id = ? AND is_resolved = 1
            ''', (project_id,))
            for row in cursor.fetchall():
                existing_resolved[row['anomaly_id']] = {
                    'is_resolved': bool(row['is_resolved']),
                    'resolved_by': row['resolved_by'],
                    'resolved_time': row['resolved_time'],
                    'resolution_notes': row['resolution_notes']
                }
            
            # 删除所有异常
            cursor.execute('DELETE FROM anomalies WHERE project_id = ?', (project_id,))
            
            now = datetime.now().isoformat()
            count = 0
            
            for anomaly in anomalies:
                # 检查是否是已解决的异常
                resolved_data = existing_resolved.get(anomaly.anomaly_id, {})
                
                cursor.execute('''
                    INSERT INTO anomalies (
                        project_id, anomaly_id, anomaly_type, severity, exhibit_id, box_number,
                        scan_id, photo_id, description, suggestion, detected_time,
                        is_resolved, resolved_by, resolved_time, resolution_notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project_id, anomaly.anomaly_id, anomaly.anomaly_type, anomaly.severity,
                    anomaly.exhibit_id, anomaly.box_number, anomaly.scan_id, anomaly.photo_id,
                    anomaly.description, anomaly.suggestion, anomaly.detected_time.isoformat(),
                    int(resolved_data.get('is_resolved', anomaly.is_resolved)),
                    resolved_data.get('resolved_by') or anomaly.resolved_by,
                    resolved_data.get('resolved_time'),
                    resolved_data.get('resolution_notes') or anomaly.resolution_notes,
                    now
                ))
                count += 1
            
            conn.commit()
            return count
    
    def get_anomalies(self, project_id: str, severity: Optional[str] = None,
                       is_resolved: Optional[bool] = None) -> List[Anomaly]:
        """获取项目的异常记录"""
        from dateutil.parser import parse as parse_date
        
        query = 'SELECT * FROM anomalies WHERE project_id = ?'
        params = [project_id]
        
        if severity:
            query += ' AND severity = ?'
            params.append(severity)
        if is_resolved is not None:
            query += ' AND is_resolved = ?'
            params.append(int(is_resolved))
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            anomalies = []
            for row in rows:
                resolved_time = parse_date(row['resolved_time']) if row['resolved_time'] else None
                
                anomalies.append(Anomaly(
                    anomaly_id=row['anomaly_id'],
                    anomaly_type=row['anomaly_type'],
                    severity=row['severity'],
                    exhibit_id=row['exhibit_id'],
                    box_number=row['box_number'],
                    scan_id=row['scan_id'],
                    photo_id=row['photo_id'],
                    description=row['description'],
                    suggestion=row['suggestion'],
                    detected_time=parse_date(row['detected_time']),
                    is_resolved=bool(row['is_resolved']),
                    resolved_by=row['resolved_by'],
                    resolved_time=resolved_time,
                    resolution_notes=row['resolution_notes'] or ""
                ))
            return anomalies
    
    def update_anomaly_resolution(self, project_id: str, anomaly_id: str,
                                    is_resolved: bool, resolved_by: str = "",
                                    resolution_notes: str = "") -> bool:
        """更新异常的解决状态"""
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE anomalies 
                SET is_resolved = ?, resolved_by = ?, resolved_time = ?, resolution_notes = ?
                WHERE project_id = ? AND anomaly_id = ?
            ''', (int(is_resolved), resolved_by, now if is_resolved else None, 
                  resolution_notes, project_id, anomaly_id))
            conn.commit()
            return cursor.rowcount > 0
    
    # ==================== 复核意见管理 ====================
    
    def add_review_comment(self, project_id: str, comment: ReviewComment) -> str:
        """添加复核意见"""
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO review_comments (
                    project_id, comment_id, anomaly_id, reviewer, comment,
                    review_time, is_approved, follow_up_required, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                project_id, comment.comment_id, comment.anomaly_id, comment.reviewer,
                comment.comment, comment.review_time.isoformat(),
                int(comment.is_approved), int(comment.follow_up_required), now
            ))
            conn.commit()
            return comment.comment_id
    
    def get_review_comments(self, project_id: str, anomaly_id: Optional[str] = None) -> List[ReviewComment]:
        """获取复核意见"""
        from dateutil.parser import parse as parse_date
        
        query = 'SELECT * FROM review_comments WHERE project_id = ?'
        params = [project_id]
        
        if anomaly_id:
            query += ' AND anomaly_id = ?'
            params.append(anomaly_id)
        
        query += ' ORDER BY review_time DESC'
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            comments = []
            for row in rows:
                comments.append(ReviewComment(
                    comment_id=row['comment_id'],
                    anomaly_id=row['anomaly_id'],
                    reviewer=row['reviewer'],
                    comment=row['comment'],
                    review_time=parse_date(row['review_time']),
                    is_approved=bool(row['is_approved']),
                    follow_up_required=bool(row['follow_up_required'])
                ))
            return comments
    
    # ==================== 完整项目数据管理 ====================
    
    def save_project_data(self, project_data: ProjectData, project_id: Optional[str] = None) -> str:
        """
        保存完整的项目数据
        
        Args:
            project_data: 项目数据对象
            project_id: 可选的项目ID，如果提供则更新现有项目
            
        Returns:
            str: 项目ID
        """
        if not project_id:
            project_id = self.create_project(project_data.project_name)
        else:
            self.update_project(project_id, project_name=project_data.project_name)
        
        # 保存各部分数据
        self.save_exhibits(project_id, project_data.exhibits)
        self.save_scan_records(project_id, project_data.scan_records)
        self.save_photo_records(project_id, project_data.photo_records)
        self.save_anomalies(project_id, project_data.anomalies)
        
        return project_id
    
    def load_project_data(self, project_id: str) -> Optional[ProjectData]:
        """加载完整的项目数据"""
        project_info = self.get_project(project_id)
        if not project_info:
            return None
        
        project_data = ProjectData(
            project_name=project_info['project_name']
        )
        
        project_data.exhibits = self.get_exhibits(project_id)
        project_data.scan_records = self.get_scan_records(project_id)
        project_data.photo_records = self.get_photo_records(project_id)
        project_data.anomalies = self.get_anomalies(project_id)
        
        # 加载复核意见
        all_comments = self.get_review_comments(project_id)
        project_data.review_comments = all_comments
        
        return project_data
