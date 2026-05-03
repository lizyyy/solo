#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
状态存储模块
管理人工确认状态、会话数据和持久化存储
"""

import json
import os
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict, field
from enum import Enum
from datetime import datetime


class ConfirmationStatus(Enum):
    """人工确认状态枚举"""
    PENDING = "pending"       # 待处理
    CONFIRMED = "confirmed"   # 已确认（问题有效）
    DISMISSED = "dismissed"   # 已忽略（问题无效）
    FIXED = "fixed"           # 已修复


@dataclass
class IssueState:
    """单个问题的状态"""
    issue_id: str
    subtitle_index: int
    issue_type: str
    status: ConfirmationStatus = ConfirmationStatus.PENDING
    notes: str = ""
    confirmed_at: Optional[str] = None
    confirmed_by: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = asdict(self)
        data['status'] = self.status.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'IssueState':
        """从字典创建"""
        data = data.copy()
        if 'status' in data:
            data['status'] = ConfirmationStatus(data['status'])
        return cls(**data)


@dataclass
class SessionState:
    """会话状态"""
    session_id: str
    created_at: str
    updated_at: str
    
    # 文件路径
    subtitle_file: str = ""
    segments_file: str = ""
    config_file: str = ""
    
    # 问题状态映射
    issue_states: Dict[str, IssueState] = field(default_factory=dict)
    
    # 字幕和片段数据（可选，用于缓存）
    subtitle_count: int = 0
    segment_count: int = 0
    total_duration: float = 0.0
    
    # 统计信息
    total_issues: int = 0
    confirmed_issues: int = 0
    dismissed_issues: int = 0
    pending_issues: int = 0
    
    # 用户备注
    session_notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = {
            'session_id': self.session_id,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'subtitle_file': self.subtitle_file,
            'segments_file': self.segments_file,
            'config_file': self.config_file,
            'issue_states': {k: v.to_dict() for k, v in self.issue_states.items()},
            'subtitle_count': self.subtitle_count,
            'segment_count': self.segment_count,
            'total_duration': self.total_duration,
            'total_issues': self.total_issues,
            'confirmed_issues': self.confirmed_issues,
            'dismissed_issues': self.dismissed_issues,
            'pending_issues': self.pending_issues,
            'session_notes': self.session_notes
        }
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SessionState':
        """从字典创建"""
        session = cls(
            session_id=data.get('session_id', ''),
            created_at=data.get('created_at', ''),
            updated_at=data.get('updated_at', '')
        )
        session.subtitle_file = data.get('subtitle_file', '')
        session.segments_file = data.get('segments_file', '')
        session.config_file = data.get('config_file', '')
        session.subtitle_count = data.get('subtitle_count', 0)
        session.segment_count = data.get('segment_count', 0)
        session.total_duration = data.get('total_duration', 0.0)
        session.total_issues = data.get('total_issues', 0)
        session.confirmed_issues = data.get('confirmed_issues', 0)
        session.dismissed_issues = data.get('dismissed_issues', 0)
        session.pending_issues = data.get('pending_issues', 0)
        session.session_notes = data.get('session_notes', '')
        
        # 恢复问题状态
        issue_states_data = data.get('issue_states', {})
        for issue_id, state_data in issue_states_data.items():
            session.issue_states[issue_id] = IssueState.from_dict(state_data)
        
        return session


class StateStorage:
    """状态存储管理器"""
    
    def __init__(self, storage_dir: str = None):
        """
        初始化状态存储
        :param storage_dir: 存储目录，默认为当前目录下的 .qa_state 文件夹
        """
        if storage_dir is None:
            storage_dir = os.path.join(os.getcwd(), '.qa_state')
        
        self.storage_dir = storage_dir
        self._ensure_storage_dir()
        
        # 当前会话
        self.current_session: Optional[SessionState] = None
    
    def _ensure_storage_dir(self):
        """确保存储目录存在"""
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)
    
    def create_new_session(self) -> SessionState:
        """
        创建新的会话
        """
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        now = datetime.now().isoformat()
        
        self.current_session = SessionState(
            session_id=session_id,
            created_at=now,
            updated_at=now
        )
        
        return self.current_session
    
    def load_session(self, session_file: str) -> Optional[SessionState]:
        """
        加载已保存的会话
        """
        if not os.path.exists(session_file):
            return None
        
        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.current_session = SessionState.from_dict(data)
            return self.current_session
        except Exception as e:
            print(f"加载会话失败: {e}")
            return None
    
    def save_session(self, session_file: str = None) -> bool:
        """
        保存当前会话
        """
        if self.current_session is None:
            return False
        
        if session_file is None:
            # 使用默认路径
            session_file = os.path.join(
                self.storage_dir, 
                f"{self.current_session.session_id}.json"
            )
        
        try:
            # 更新更新时间
            self.current_session.updated_at = datetime.now().isoformat()
            
            # 重新计算统计
            self._update_statistics()
            
            with open(session_file, 'w', encoding='utf-8') as f:
                json.dump(self.current_session.to_dict(), f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"保存会话失败: {e}")
            return False
    
    def _update_statistics(self):
        """更新统计信息"""
        if self.current_session is None:
            return
        
        confirmed = 0
        dismissed = 0
        pending = 0
        
        for state in self.current_session.issue_states.values():
            if state.status == ConfirmationStatus.CONFIRMED:
                confirmed += 1
            elif state.status == ConfirmationStatus.DISMISSED:
                dismissed += 1
            elif state.status == ConfirmationStatus.PENDING:
                pending += 1
        
        self.current_session.confirmed_issues = confirmed
        self.current_session.dismissed_issues = dismissed
        self.current_session.pending_issues = pending
        self.current_session.total_issues = len(self.current_session.issue_states)
    
    def set_file_paths(self, subtitle_file: str = "", 
                       segments_file: str = "", 
                       config_file: str = ""):
        """
        设置文件路径
        """
        if self.current_session is None:
            self.create_new_session()
        
        if subtitle_file:
            self.current_session.subtitle_file = subtitle_file
        if segments_file:
            self.current_session.segments_file = segments_file
        if config_file:
            self.current_session.config_file = config_file
    
    def update_issue_state(self, issue_id: str, 
                           subtitle_index: int,
                           issue_type: str,
                           status: ConfirmationStatus,
                           notes: str = "",
                           confirmed_by: str = "") -> IssueState:
        """
        更新问题状态
        """
        if self.current_session is None:
            self.create_new_session()
        
        if issue_id in self.current_session.issue_states:
            state = self.current_session.issue_states[issue_id]
        else:
            state = IssueState(
                issue_id=issue_id,
                subtitle_index=subtitle_index,
                issue_type=issue_type
            )
        
        state.status = status
        state.notes = notes
        state.confirmed_at = datetime.now().isoformat()
        state.confirmed_by = confirmed_by
        
        self.current_session.issue_states[issue_id] = state
        self._update_statistics()
        
        return state
    
    def get_issue_state(self, issue_id: str) -> Optional[IssueState]:
        """
        获取问题状态
        """
        if self.current_session is None:
            return None
        
        return self.current_session.issue_states.get(issue_id)
    
    def get_issue_status(self, issue_id: str) -> ConfirmationStatus:
        """
        获取问题状态枚举值
        """
        state = self.get_issue_state(issue_id)
        if state is None:
            return ConfirmationStatus.PENDING
        return state.status
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """
        列出所有已保存的会话
        """
        sessions = []
        
        if not os.path.exists(self.storage_dir):
            return sessions
        
        for filename in os.listdir(self.storage_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.storage_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    sessions.append({
                        'filename': filename,
                        'filepath': filepath,
                        'session_id': data.get('session_id', ''),
                        'created_at': data.get('created_at', ''),
                        'updated_at': data.get('updated_at', ''),
                        'subtitle_file': data.get('subtitle_file', ''),
                        'total_issues': data.get('total_issues', 0),
                        'pending_issues': data.get('pending_issues', 0),
                        'confirmed_issues': data.get('confirmed_issues', 0),
                        'dismissed_issues': data.get('dismissed_issues', 0)
                    })
                except Exception:
                    continue
        
        # 按创建时间排序（最新的在前）
        sessions.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return sessions
    
    def delete_session(self, session_file: str) -> bool:
        """
        删除会话文件
        """
        try:
            if os.path.exists(session_file):
                os.remove(session_file)
                return True
        except Exception as e:
            print(f"删除会话失败: {e}")
        
        return False
    
    def clear_current_session(self):
        """
        清除当前会话
        """
        self.current_session = None
    
    @staticmethod
    def generate_issue_id(subtitle_index: int, issue_type: str, start_time: float) -> str:
        """
        生成唯一的问题ID
        """
        return f"{subtitle_index}_{issue_type}_{int(start_time * 1000)}"
