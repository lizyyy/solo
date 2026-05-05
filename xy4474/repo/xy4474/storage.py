# -*- coding: utf-8 -*-
"""
证件照影楼交付前复核工具 - 存储模块
负责复核结果的存储、查询和人工备注管理
"""

import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from contextlib import contextmanager

from config import DATABASE_CONFIG, OUTPUT_DIR
from utils import logger, DateTimeHelper, JSONEncoder


class ReviewStorage:
    """
    复核结果存储类
    使用SQLite数据库存储复核结果和人工备注
    """
    
    def __init__(self, db_path: str = None):
        """
        初始化存储
        
        Args:
            db_path: 数据库文件路径
        """
        self.db_path = db_path or DATABASE_CONFIG["path"]
        self._init_database()
    
    @contextmanager
    def _get_connection(self):
        """
        获取数据库连接的上下文管理器
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_database(self):
        """
        初始化数据库表结构
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 创建复核会话表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS review_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_name TEXT NOT NULL,
                    start_time TIMESTAMP NOT NULL,
                    end_time TIMESTAMP,
                    status TEXT DEFAULT 'running',
                    total_orders INTEGER DEFAULT 0,
                    total_issues INTEGER DEFAULT 0,
                    resolved_issues INTEGER DEFAULT 0,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 创建订单表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    order_id TEXT NOT NULL,
                    customer_name TEXT,
                    sizes TEXT,
                    background TEXT,
                    priority TEXT DEFAULT '普通',
                    status TEXT,
                    create_time TIMESTAMP,
                    raw_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES review_sessions (id)
                )
            ''')
            
            # 创建问题表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    order_id TEXT NOT NULL,
                    issue_type TEXT NOT NULL,
                    issue_name TEXT,
                    severity TEXT DEFAULT 'medium',
                    details TEXT,
                    detected_time TIMESTAMP,
                    resolved BOOLEAN DEFAULT 0,
                    resolved_time TIMESTAMP,
                    resolved_by TEXT,
                    resolution_notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES review_sessions (id)
                )
            ''')
            
            # 创建人工备注表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    order_id TEXT NOT NULL,
                    issue_id INTEGER,
                    note_type TEXT DEFAULT 'general',
                    content TEXT NOT NULL,
                    author TEXT DEFAULT 'system',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES review_sessions (id),
                    FOREIGN KEY (issue_id) REFERENCES issues (id)
                )
            ''')
            
            # 创建导出记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS exports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    export_type TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES review_sessions (id)
                )
            ''')
            
            # 创建索引
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_order_id ON issues (order_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_session_id ON issues (session_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_resolved ON issues (resolved)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_notes_order_id ON notes (order_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders (order_id)')
            
            conn.commit()
            logger.info(f"数据库初始化完成: {self.db_path}")
    
    # ==================== 会话管理 ====================
    
    def create_session(self, session_name: str = None) -> int:
        """
        创建新的复核会话
        
        Args:
            session_name: 会话名称
            
        Returns:
            会话ID
        """
        if not session_name:
            session_name = f"复核会话_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO review_sessions (session_name, start_time, status)
                VALUES (?, ?, ?)
            ''', (session_name, datetime.now(), 'running'))
            session_id = cursor.lastrowid
            conn.commit()
            logger.info(f"创建复核会话: {session_name} (ID: {session_id})")
            return session_id
    
    def close_session(self, session_id: int, notes: str = None) -> bool:
        """
        关闭复核会话
        
        Args:
            session_id: 会话ID
            notes: 会话备注
            
        Returns:
            是否成功
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 统计会话数据
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT o.order_id) as total_orders,
                    COUNT(i.id) as total_issues,
                    SUM(CASE WHEN i.resolved = 1 THEN 1 ELSE 0 END) as resolved_issues
                FROM review_sessions s
                LEFT JOIN orders o ON s.id = o.session_id
                LEFT JOIN issues i ON s.id = i.session_id
                WHERE s.id = ?
            ''', (session_id,))
            
            row = cursor.fetchone()
            total_orders = row['total_orders'] if row else 0
            total_issues = row['total_issues'] if row else 0
            resolved_issues = row['resolved_issues'] if row else 0
            
            cursor.execute('''
                UPDATE review_sessions 
                SET end_time = ?, status = ?, total_orders = ?, 
                    total_issues = ?, resolved_issues = ?, notes = ?
                WHERE id = ?
            ''', (datetime.now(), 'completed', total_orders, total_issues, 
                  resolved_issues, notes, session_id))
            
            conn.commit()
            logger.info(f"关闭复核会话 (ID: {session_id})")
            return True
    
    def get_session(self, session_id: int) -> Optional[Dict[str, Any]]:
        """
        获取会话信息
        
        Args:
            session_id: 会话ID
            
        Returns:
            会话信息字典
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM review_sessions WHERE id = ?', (session_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
    
    def get_all_sessions(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        获取所有会话列表
        
        Args:
            limit: 返回数量限制
            
        Returns:
            会话列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM review_sessions 
                ORDER BY created_at DESC 
                LIMIT ?
            ''', (limit,))
            return [dict(row) for row in cursor.fetchall()]
    
    # ==================== 订单存储 ====================
    
    def save_order(self, session_id: int, order: Dict[str, Any]) -> int:
        """
        保存订单信息
        
        Args:
            session_id: 会话ID
            order: 订单数据字典
            
        Returns:
            记录ID
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 转换sizes为JSON字符串
            sizes_json = json.dumps(order.get('sizes', []), ensure_ascii=False)
            
            # 转换raw_data为JSON字符串
            raw_data_json = json.dumps(order.get('raw_data', {}), ensure_ascii=False)
            
            cursor.execute('''
                INSERT INTO orders (
                    session_id, order_id, customer_name, sizes, background,
                    priority, status, create_time, raw_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                order.get('order_id'),
                order.get('customer_name'),
                sizes_json,
                order.get('background'),
                order.get('priority', '普通'),
                order.get('status'),
                order.get('create_time'),
                raw_data_json
            ))
            
            record_id = cursor.lastrowid
            conn.commit()
            return record_id
    
    def save_orders_batch(self, session_id: int, orders: List[Dict[str, Any]]) -> int:
        """
        批量保存订单
        
        Args:
            session_id: 会话ID
            orders: 订单列表
            
        Returns:
            保存数量
        """
        count = 0
        for order in orders:
            self.save_order(session_id, order)
            count += 1
        logger.info(f"批量保存 {count} 条订单")
        return count
    
    def get_orders_by_session(self, session_id: int) -> List[Dict[str, Any]]:
        """
        获取指定会话的所有订单
        
        Args:
            session_id: 会话ID
            
        Returns:
            订单列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM orders WHERE session_id = ?', (session_id,))
            rows = cursor.fetchall()
            
            orders = []
            for row in rows:
                order = dict(row)
                # 解析JSON字段
                if order.get('sizes'):
                    try:
                        order['sizes'] = json.loads(order['sizes'])
                    except:
                        order['sizes'] = []
                if order.get('raw_data'):
                    try:
                        order['raw_data'] = json.loads(order['raw_data'])
                    except:
                        order['raw_data'] = {}
                orders.append(order)
            
            return orders
    
    # ==================== 问题存储 ====================
    
    def save_issue(self, session_id: int, issue: Dict[str, Any]) -> int:
        """
        保存问题
        
        Args:
            session_id: 会话ID
            issue: 问题数据字典
            
        Returns:
            问题ID
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # 转换details为JSON字符串
            details_json = json.dumps(issue.get('details', {}), ensure_ascii=False, cls=JSONEncoder)
            
            cursor.execute('''
                INSERT INTO issues (
                    session_id, order_id, issue_type, issue_name, severity,
                    details, detected_time, resolved, resolution_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                issue.get('order_id'),
                issue.get('issue_type'),
                issue.get('issue_name'),
                issue.get('severity', 'medium'),
                details_json,
                issue.get('detected_time'),
                1 if issue.get('resolved', False) else 0,
                issue.get('resolution_notes')
            ))
            
            issue_id = cursor.lastrowid
            conn.commit()
            return issue_id
    
    def save_issues_batch(self, session_id: int, issues: List[Dict[str, Any]]) -> int:
        """
        批量保存问题
        
        Args:
            session_id: 会话ID
            issues: 问题列表
            
        Returns:
            保存数量
        """
        count = 0
        for issue in issues:
            self.save_issue(session_id, issue)
            count += 1
        logger.info(f"批量保存 {count} 个问题")
        return count
    
    def get_issues_by_session(self, session_id: int, 
                               resolved: bool = None) -> List[Dict[str, Any]]:
        """
        获取指定会话的问题
        
        Args:
            session_id: 会话ID
            resolved: 是否只获取已解决/未解决的问题（None表示全部）
            
        Returns:
            问题列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if resolved is None:
                cursor.execute('''
                    SELECT * FROM issues WHERE session_id = ? 
                    ORDER BY severity DESC, detected_time
                ''', (session_id,))
            else:
                cursor.execute('''
                    SELECT * FROM issues WHERE session_id = ? AND resolved = ?
                    ORDER BY severity DESC, detected_time
                ''', (session_id, 1 if resolved else 0))
            
            rows = cursor.fetchall()
            
            issues = []
            for row in rows:
                issue = dict(row)
                # 解析JSON字段
                if issue.get('details'):
                    try:
                        issue['details'] = json.loads(issue['details'])
                    except:
                        issue['details'] = {}
                # 转换布尔值
                issue['resolved'] = bool(issue.get('resolved', 0))
                issues.append(issue)
            
            return issues
    
    def get_issues_by_order(self, order_id: str, session_id: int = None) -> List[Dict[str, Any]]:
        """
        获取指定订单的问题
        
        Args:
            order_id: 订单号
            session_id: 可选的会话ID过滤
            
        Returns:
            问题列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if session_id:
                cursor.execute('''
                    SELECT * FROM issues WHERE order_id = ? AND session_id = ?
                    ORDER BY severity DESC, detected_time
                ''', (order_id, session_id))
            else:
                cursor.execute('''
                    SELECT * FROM issues WHERE order_id = ?
                    ORDER BY severity DESC, detected_time
                ''', (order_id,))
            
            rows = cursor.fetchall()
            
            issues = []
            for row in rows:
                issue = dict(row)
                if issue.get('details'):
                    try:
                        issue['details'] = json.loads(issue['details'])
                    except:
                        issue['details'] = {}
                issue['resolved'] = bool(issue.get('resolved', 0))
                issues.append(issue)
            
            return issues
    
    def resolve_issue(self, issue_id: int, resolution_notes: str = None,
                      resolved_by: str = 'operator') -> bool:
        """
        标记问题为已解决
        
        Args:
            issue_id: 问题ID
            resolution_notes: 解决备注
            resolved_by: 处理人
            
        Returns:
            是否成功
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE issues 
                SET resolved = 1, resolved_time = ?, resolved_by = ?, resolution_notes = ?
                WHERE id = ?
            ''', (datetime.now(), resolved_by, resolution_notes, issue_id))
            conn.commit()
            logger.info(f"标记问题已解决 (ID: {issue_id})")
            return True
    
    def unresolve_issue(self, issue_id: int) -> bool:
        """
        标记问题为未解决
        
        Args:
            issue_id: 问题ID
            
        Returns:
            是否成功
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE issues 
                SET resolved = 0, resolved_time = NULL, resolved_by = NULL
                WHERE id = ?
            ''', (issue_id,))
            conn.commit()
            logger.info(f"标记问题为未解决 (ID: {issue_id})")
            return True
    
    # ==================== 备注管理 ====================
    
    def add_note(self, session_id: int, order_id: str, content: str,
                 note_type: str = 'general', issue_id: int = None,
                 author: str = 'operator') -> int:
        """
        添加人工备注
        
        Args:
            session_id: 会话ID
            order_id: 订单号
            content: 备注内容
            note_type: 备注类型（general/issue/resolution）
            issue_id: 关联的问题ID（可选）
            author: 作者
            
        Returns:
            备注ID
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO notes (
                    session_id, order_id, issue_id, note_type, content, author
                ) VALUES (?, ?, ?, ?, ?, ?)
            ''', (session_id, order_id, issue_id, note_type, content, author))
            note_id = cursor.lastrowid
            conn.commit()
            logger.info(f"添加备注 (订单: {order_id}, 类型: {note_type})")
            return note_id
    
    def get_notes_by_order(self, order_id: str, session_id: int = None) -> List[Dict[str, Any]]:
        """
        获取指定订单的所有备注
        
        Args:
            order_id: 订单号
            session_id: 可选的会话ID过滤
            
        Returns:
            备注列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if session_id:
                cursor.execute('''
                    SELECT * FROM notes WHERE order_id = ? AND session_id = ?
                    ORDER BY created_at
                ''', (order_id, session_id))
            else:
                cursor.execute('''
                    SELECT * FROM notes WHERE order_id = ?
                    ORDER BY created_at
                ''', (order_id,))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def get_notes_by_issue(self, issue_id: int) -> List[Dict[str, Any]]:
        """
        获取指定问题的所有备注
        
        Args:
            issue_id: 问题ID
            
        Returns:
            备注列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM notes WHERE issue_id = ?
                ORDER BY created_at
            ''', (issue_id,))
            return [dict(row) for row in cursor.fetchall()]
    
    def update_note(self, note_id: int, content: str) -> bool:
        """
        更新备注
        
        Args:
            note_id: 备注ID
            content: 新的备注内容
            
        Returns:
            是否成功
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (content, note_id))
            conn.commit()
            return True
    
    def delete_note(self, note_id: int) -> bool:
        """
        删除备注
        
        Args:
            note_id: 备注ID
            
        Returns:
            是否成功
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM notes WHERE id = ?', (note_id,))
            conn.commit()
            logger.info(f"删除备注 (ID: {note_id})")
            return True
    
    # ==================== 查询功能 ====================
    
    def search_orders(self, keyword: str, session_id: int = None) -> List[Dict[str, Any]]:
        """
        搜索订单
        
        Args:
            keyword: 搜索关键词（订单号或客户姓名）
            session_id: 可选的会话ID过滤
            
        Returns:
            匹配的订单列表
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if session_id:
                cursor.execute('''
                    SELECT * FROM orders 
                    WHERE session_id = ? AND (order_id LIKE ? OR customer_name LIKE ?)
                    ORDER BY created_at DESC
                ''', (session_id, f'%{keyword}%', f'%{keyword}%'))
            else:
                cursor.execute('''
                    SELECT * FROM orders 
                    WHERE order_id LIKE ? OR customer_name LIKE ?
                    ORDER BY created_at DESC
                ''', (f'%{keyword}%', f'%{keyword}%'))
            
            rows = cursor.fetchall()
            
            orders = []
            for row in rows:
                order = dict(row)
                if order.get('sizes'):
                    try:
                        order['sizes'] = json.loads(order['sizes'])
                    except:
                        order['sizes'] = []
                if order.get('raw_data'):
                    try:
                        order['raw_data'] = json.loads(order['raw_data'])
                    except:
                        order['raw_data'] = {}
                orders.append(order)
            
            return orders
    
    def get_statistics(self, session_id: int = None) -> Dict[str, Any]:
        """
        获取统计信息
        
        Args:
            session_id: 可选的会话ID过滤
            
        Returns:
            统计信息字典
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            stats = {}
            
            # 基础统计
            if session_id:
                cursor.execute('''
                    SELECT 
                        COUNT(DISTINCT order_id) as total_orders,
                        COUNT(*) as total_issues,
                        SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved_issues,
                        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_issues,
                        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_issues,
                        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_issues,
                        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_issues
                    FROM issues WHERE session_id = ?
                ''', (session_id,))
            else:
                cursor.execute('''
                    SELECT 
                        COUNT(DISTINCT order_id) as total_orders,
                        COUNT(*) as total_issues,
                        SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved_issues,
                        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_issues,
                        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_issues,
                        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_issues,
                        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_issues
                    FROM issues
                ''')
            
            row = cursor.fetchone()
            if row:
                stats.update({
                    'total_orders': row['total_orders'] or 0,
                    'total_issues': row['total_issues'] or 0,
                    'resolved_issues': row['resolved_issues'] or 0,
                    'unresolved_issues': (row['total_issues'] or 0) - (row['resolved_issues'] or 0),
                    'issues_by_severity': {
                        'critical': row['critical_issues'] or 0,
                        'high': row['high_issues'] or 0,
                        'medium': row['medium_issues'] or 0,
                        'low': row['low_issues'] or 0,
                    }
                })
            
            # 按问题类型统计
            if session_id:
                cursor.execute('''
                    SELECT issue_type, issue_name, COUNT(*) as count
                    FROM issues WHERE session_id = ?
                    GROUP BY issue_type, issue_name
                    ORDER BY count DESC
                ''', (session_id,))
            else:
                cursor.execute('''
                    SELECT issue_type, issue_name, COUNT(*) as count
                    FROM issues
                    GROUP BY issue_type, issue_name
                    ORDER BY count DESC
                ''')
            
            stats['issues_by_type'] = [
                {'type': row['issue_type'], 'name': row['issue_name'], 'count': row['count']}
                for row in cursor.fetchall()
            ]
            
            return stats
    
    # ==================== 导出记录 ====================
    
    def record_export(self, session_id: int, export_type: str, 
                      file_path: str, file_size: int = None) -> int:
        """
        记录导出操作
        
        Args:
            session_id: 会话ID
            export_type: 导出类型（markdown/json）
            file_path: 导出文件路径
            file_size: 文件大小
            
        Returns:
            记录ID
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO exports (session_id, export_type, file_path, file_size)
                VALUES (?, ?, ?, ?)
            ''', (session_id, export_type, file_path, file_size))
            export_id = cursor.lastrowid
            conn.commit()
            logger.info(f"记录导出操作: {export_type} -> {file_path}")
            return export_id


class LocalQueryInterface:
    """
    本地查询接口
    提供方便的查询API
    """
    
    def __init__(self, storage: ReviewStorage = None):
        """
        初始化查询接口
        
        Args:
            storage: 存储实例
        """
        self.storage = storage or ReviewStorage()
    
    def query_order(self, order_id: str, session_id: int = None) -> Dict[str, Any]:
        """
        查询订单详情
        
        Args:
            order_id: 订单号
            session_id: 会话ID
            
        Returns:
            订单详情，包含问题和备注
        """
        result = {
            'order': None,
            'issues': [],
            'notes': [],
            'found': False
        }
        
        # 搜索订单
        orders = self.storage.search_orders(order_id, session_id)
        if orders:
            result['order'] = orders[0]
            result['found'] = True
            
            # 获取相关问题
            result['issues'] = self.storage.get_issues_by_order(order_id, session_id)
            
            # 获取相关备注
            result['notes'] = self.storage.get_notes_by_order(order_id, session_id)
        
        return result
    
    def query_issues(self, session_id: int = None, 
                     severity: str = None,
                     issue_type: str = None,
                     resolved: bool = None) -> List[Dict[str, Any]]:
        """
        查询问题列表
        
        Args:
            session_id: 会话ID
            severity: 严重程度过滤
            issue_type: 问题类型过滤
            resolved: 是否解决过滤
            
        Returns:
            问题列表
        """
        issues = self.storage.get_issues_by_session(session_id, resolved)
        
        # 应用额外过滤
        if severity:
            issues = [i for i in issues if i.get('severity') == severity]
        
        if issue_type:
            issues = [i for i in issues if i.get('issue_type') == issue_type]
        
        return issues
    
    def query_statistics(self, session_id: int = None) -> Dict[str, Any]:
        """
        查询统计信息
        
        Args:
            session_id: 会话ID
            
        Returns:
            统计信息
        """
        return self.storage.get_statistics(session_id)
    
    def add_note_to_order(self, session_id: int, order_id: str, 
                          content: str, author: str = 'operator') -> int:
        """
        为订单添加备注
        
        Args:
            session_id: 会话ID
            order_id: 订单号
            content: 备注内容
            author: 作者
            
        Returns:
            备注ID
        """
        return self.storage.add_note(
            session_id=session_id,
            order_id=order_id,
            content=content,
            note_type='general',
            author=author
        )
    
    def add_note_to_issue(self, session_id: int, order_id: str,
                         issue_id: int, content: str,
                         author: str = 'operator') -> int:
        """
        为问题添加备注
        
        Args:
            session_id: 会话ID
            order_id: 订单号
            issue_id: 问题ID
            content: 备注内容
            author: 作者
            
        Returns:
            备注ID
        """
        return self.storage.add_note(
            session_id=session_id,
            order_id=order_id,
            issue_id=issue_id,
            content=content,
            note_type='issue',
            author=author
        )
    
    def resolve_issue(self, issue_id: int, notes: str = None,
                      author: str = 'operator') -> bool:
        """
        解决问题
        
        Args:
            issue_id: 问题ID
            notes: 解决备注
            author: 处理人
            
        Returns:
            是否成功
        """
        return self.storage.resolve_issue(issue_id, notes, author)
    
    def list_sessions(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        列出所有复核会话
        
        Args:
            limit: 返回数量限制
            
        Returns:
            会话列表
        """
        return self.storage.get_all_sessions(limit)
