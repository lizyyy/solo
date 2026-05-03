#!/usr/bin/env python3
"""
状态存储模块
负责保存和加载复核、放行/驳回状态
"""

import json
import os
import random
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path


class StateManager:
    """状态管理器类"""
    
    STATUS_PENDING = 'pending'
    STATUS_REVIEWED = 'reviewed'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    
    def __init__(self, storage_dir: Optional[str] = None):
        """
        初始化状态管理器
        
        Args:
            storage_dir: 存储目录路径，如果为None则使用默认目录
        """
        if storage_dir is None:
            # 使用用户主目录下的隐藏目录
            home_dir = Path.home()
            self.storage_dir = home_dir / '.rainfall_operation' / 'states'
        else:
            self.storage_dir = Path(storage_dir)
        
        # 确保存储目录存在
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        # 当前会话状态
        self.current_session = None
        self.operation_states = {}
    
    def create_new_session(self, operation_name: str = '') -> str:
        """
        创建新的作业会话
        
        Args:
            operation_name: 作业名称
            
        Returns:
            会话ID
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        random_suffix = ''.join(random.choices('0123456789', k=6))
        session_id = f'{timestamp}_{random_suffix}'
        
        self.current_session = {
            'session_id': session_id,
            'operation_name': operation_name,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'status': self.STATUS_PENDING,
            'review_notes': '',
            'approval_notes': '',
            'rejection_reason': '',
            'risks_reviewed': [],
            'data_sources': []
        }
        
        self.operation_states[session_id] = self.current_session
        
        return session_id
    
    def load_session(self, session_id: str) -> bool:
        """
        加载指定会话
        
        Args:
            session_id: 会话ID
            
        Returns:
            是否加载成功
        """
        session_file = self.storage_dir / f'{session_id}.json'
        
        if not session_file.exists():
            return False
        
        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                session_data = json.load(f)
            
            # 转换日期时间字符串
            if 'created_at' in session_data:
                session_data['created_at'] = datetime.fromisoformat(session_data['created_at'])
            if 'updated_at' in session_data:
                session_data['updated_at'] = datetime.fromisoformat(session_data['updated_at'])
            
            self.current_session = session_data
            self.operation_states[session_id] = session_data
            
            return True
        except Exception as e:
            print(f"加载会话失败: {e}")
            return False
    
    def save_session(self) -> bool:
        """
        保存当前会话
        
        Returns:
            是否保存成功
        """
        if self.current_session is None:
            return False
        
        session_id = self.current_session.get('session_id')
        if not session_id:
            return False
        
        # 更新时间
        self.current_session['updated_at'] = datetime.now()
        
        # 准备要保存的数据（转换日期时间为字符串）
        save_data = self.current_session.copy()
        if isinstance(save_data.get('created_at'), datetime):
            save_data['created_at'] = save_data['created_at'].isoformat()
        if isinstance(save_data.get('updated_at'), datetime):
            save_data['updated_at'] = save_data['updated_at'].isoformat()
        
        session_file = self.storage_dir / f'{session_id}.json'
        
        try:
            with open(session_file, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存会话失败: {e}")
            return False
    
    def update_status(self, status: str, notes: str = '') -> bool:
        """
        更新作业状态
        
        Args:
            status: 新状态
            notes: 备注信息
            
        Returns:
            是否更新成功
        """
        if self.current_session is None:
            return False
        
        valid_statuses = [
            self.STATUS_PENDING,
            self.STATUS_REVIEWED,
            self.STATUS_APPROVED,
            self.STATUS_REJECTED
        ]
        
        if status not in valid_statuses:
            return False
        
        self.current_session['status'] = status
        self.current_session['updated_at'] = datetime.now()
        
        if status == self.STATUS_REVIEWED:
            self.current_session['review_notes'] = notes
        elif status == self.STATUS_APPROVED:
            self.current_session['approval_notes'] = notes
        elif status == self.STATUS_REJECTED:
            self.current_session['rejection_reason'] = notes
        
        return self.save_session()
    
    def mark_risk_reviewed(self, risk_index: int, reviewed: bool = True) -> bool:
        """
        标记风险为已复核
        
        Args:
            risk_index: 风险索引
            reviewed: 是否已复核
            
        Returns:
            是否操作成功
        """
        if self.current_session is None:
            return False
        
        if 'risks_reviewed' not in self.current_session:
            self.current_session['risks_reviewed'] = []
        
        if reviewed:
            if risk_index not in self.current_session['risks_reviewed']:
                self.current_session['risks_reviewed'].append(risk_index)
        else:
            if risk_index in self.current_session['risks_reviewed']:
                self.current_session['risks_reviewed'].remove(risk_index)
        
        return True
    
    def add_data_source(self, file_path: str, data_type: str) -> bool:
        """
        添加数据源记录
        
        Args:
            file_path: 文件路径
            data_type: 数据类型
            
        Returns:
            是否添加成功
        """
        if self.current_session is None:
            return False
        
        if 'data_sources' not in self.current_session:
            self.current_session['data_sources'] = []
        
        data_source = {
            'file_path': file_path,
            'data_type': data_type,
            'added_at': datetime.now().isoformat()
        }
        
        self.current_session['data_sources'].append(data_source)
        
        return True
    
    def get_current_status(self) -> Optional[Dict[str, Any]]:
        """
        获取当前状态
        
        Returns:
            当前状态字典
        """
        return self.current_session
    
    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """
        获取所有会话列表
        
        Returns:
            会话列表
        """
        sessions = []
        
        for session_file in self.storage_dir.glob('*.json'):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    session_data = json.load(f)
                
                # 转换日期时间
                if 'created_at' in session_data and isinstance(session_data['created_at'], str):
                    session_data['created_at'] = datetime.fromisoformat(session_data['created_at'])
                if 'updated_at' in session_data and isinstance(session_data['updated_at'], str):
                    session_data['updated_at'] = datetime.fromisoformat(session_data['updated_at'])
                
                sessions.append(session_data)
            except Exception as e:
                print(f"读取会话文件 {session_file} 失败: {e}")
                continue
        
        # 按创建时间排序
        sessions.sort(key=lambda x: x.get('created_at', datetime.min), reverse=True)
        
        return sessions
    
    def delete_session(self, session_id: str) -> bool:
        """
        删除指定会话
        
        Args:
            session_id: 会话ID
            
        Returns:
            是否删除成功
        """
        session_file = self.storage_dir / f'{session_id}.json'
        
        if session_file.exists():
            try:
                session_file.unlink()
                
                # 从内存中移除
                if session_id in self.operation_states:
                    del self.operation_states[session_id]
                
                # 如果当前会话被删除，清空当前会话
                if self.current_session and self.current_session.get('session_id') == session_id:
                    self.current_session = None
                
                return True
            except Exception as e:
                print(f"删除会话失败: {e}")
                return False
        
        return False
    
    def get_status_display(self, status: str) -> str:
        """
        获取状态显示名称
        
        Args:
            status: 状态值
            
        Returns:
            状态显示名称
        """
        status_names = {
            self.STATUS_PENDING: '待复核',
            self.STATUS_REVIEWED: '已复核',
            self.STATUS_APPROVED: '已放行',
            self.STATUS_REJECTED: '已驳回'
        }
        return status_names.get(status, status)
    
    def get_status_color(self, status: str) -> str:
        """
        获取状态颜色
        
        Args:
            status: 状态值
            
        Returns:
            颜色代码
        """
        status_colors = {
            self.STATUS_PENDING: '#FFD700',
            self.STATUS_REVIEWED: '#87CEEB',
            self.STATUS_APPROVED: '#32CD32',
            self.STATUS_REJECTED: '#FF6347'
        }
        return status_colors.get(status, '#808080')
    
    def clear_current_session(self):
        """清空当前会话"""
        self.current_session = None
