#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
审批管理服务
"""

from typing import List, Dict, Optional
from datetime import datetime

from config import get_config
from database import get_db
from services.safety_service import SafetyService, SafetyCheckResult, CheckResultType


class ApprovalService:
    """审批管理服务"""
    
    def __init__(self):
        self.config = get_config()
        self.db = get_db()
        self.safety_service = SafetyService()
    
    def get_pending_approvals(self) -> List[Dict]:
        """获取待审批的预约"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT b.*, 
                   c.grade || c.class_number as class_name,
                   c.teacher_name as class_teacher,
                   (SELECT COUNT(*) FROM booking_items WHERE booking_id = b.id) as item_count
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            WHERE b.status = 'pending'
            ORDER BY b.experiment_date ASC, b.created_at ASC
        ''')
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_approval_history(self) -> List[Dict]:
        """获取审批历史"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT a.*,
                   b.experiment_name,
                   c.grade || c.class_number as class_name
            FROM approvals a
            JOIN bookings b ON a.booking_id = b.id
            JOIN classes c ON b.class_id = c.id
            ORDER BY a.approval_time DESC
        ''')
        
        return [dict(row) for row in cursor.fetchall()]
    
    def perform_approval(self, booking_id: int, approver_name: str, 
                         is_approved: bool, comments: str = "") -> Dict:
        """
        执行审批
        
        Returns:
            包含审批结果和安全检查结果的字典
        """
        cursor = self.db.cursor()
        
        # 1. 执行安全检查
        safety_results, all_safe = self.safety_service.check_all_safety(booking_id)
        
        # 2. 检查是否有阻断性问题
        has_blocking = any(r.is_blocking() for r in safety_results)
        
        result = {
            'success': False,
            'has_blocking': has_blocking,
            'safety_results': safety_results,
            'message': ''
        }
        
        # 如果有阻断性问题，不允许通过审批
        if is_approved and has_blocking:
            result['message'] = "存在阻断性安全问题，无法通过审批"
            return result
        
        # 3. 更新预约状态
        new_status = 'approved' if is_approved else 'rejected'
        
        cursor.execute('''
            UPDATE bookings
            SET status = ?
            WHERE id = ? AND status = 'pending'
        ''', (new_status, booking_id))
        
        if cursor.rowcount == 0:
            result['message'] = "预约不存在或状态已变更"
            return result
        
        # 4. 记录审批
        cursor.execute('''
            INSERT INTO approvals 
            (booking_id, approver_name, status, comments)
            VALUES (?, ?, ?, ?)
        ''', (
            booking_id,
            approver_name,
            new_status,
            comments
        ))
        
        self.db.commit()
        
        result['success'] = True
        if is_approved:
            result['message'] = "审批通过"
        else:
            result['message'] = "已拒绝审批"
        
        return result
    
    def get_approval_info(self, booking_id: int) -> Optional[Dict]:
        """获取预约的审批信息"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT a.*
            FROM approvals a
            WHERE a.booking_id = ?
            ORDER BY a.approval_time DESC
            LIMIT 1
        ''', (booking_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_audit_logs(self, limit: int = 100) -> List[Dict]:
        """获取审计日志"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT al.*
            FROM audit_logs al
            ORDER BY al.created_at DESC
            LIMIT ?
        ''', (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def log_action(self, user_name: str, action: str, table_name: str = None,
                   record_id: int = None, details: str = None):
        """记录审计日志"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            INSERT INTO audit_logs
            (user_name, action, table_name, record_id, details)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_name, action, table_name, record_id, details))
        
        self.db.commit()
    
    def format_safety_results(self, results: List[SafetyCheckResult]) -> str:
        """格式化安全检查结果为可读字符串"""
        lines = []
        
        for r in results:
            if r.result == CheckResultType.BLOCKED:
                icon = "❌"
                lines.append(f"{icon} 【阻断】{r.check_type}: {r.message}")
                if r.details:
                    for line in r.details.split('\n'):
                        lines.append(f"    {line}")
            elif r.result == CheckResultType.WARNING:
                icon = "⚠️"
                lines.append(f"{icon} 【警告】{r.check_type}: {r.message}")
                if r.details:
                    for line in r.details.split('\n'):
                        lines.append(f"    {line}")
            else:
                icon = "✅"
                lines.append(f"{icon} 【通过】{r.check_type}: {r.message}")
        
        return "\n".join(lines)
