"""
状态存储模块
负责保存和恢复质检会话状态，包括人工标记的处理意见
"""

import os
import json
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict, field
from pathlib import Path

from rules_engine import QualityIssue, IssueType, IssueSeverity


@dataclass
class IssueResolution:
    """问题处理记录"""
    issue_index: int = 0
    issue_type: str = ""
    item_id: str = ""
    audio_file: str = ""
    title: str = ""
    message: str = ""
    
    # 处理状态
    resolved: bool = False
    resolution_action: str = ""  # "accept", "reject", "needs_fix", "deferred"
    resolution_note: str = ""
    resolved_at: str = ""
    resolved_by: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'IssueResolution':
        return cls(**data)


@dataclass
class SessionState:
    """会话状态"""
    # 会话标识
    session_id: str = ""
    created_at: str = ""
    updated_at: str = ""
    
    # 项目配置
    project_name: str = ""
    schedule_csv_path: str = ""
    audio_directory: str = ""
    
    # 问题处理记录（按问题索引或标识存储）
    issue_resolutions: List[IssueResolution] = field(default_factory=list)
    
    # 自定义配置（用户调整的质检参数）
    custom_config: Dict[str, Any] = field(default_factory=dict)
    
    # 备注和日志
    session_notes: str = ""
    check_history: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "project_name": self.project_name,
            "schedule_csv_path": self.schedule_csv_path,
            "audio_directory": self.audio_directory,
            "issue_resolutions": [r.to_dict() for r in self.issue_resolutions],
            "custom_config": self.custom_config,
            "session_notes": self.session_notes,
            "check_history": self.check_history
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SessionState':
        state = cls(
            session_id=data.get("session_id", ""),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
            project_name=data.get("project_name", ""),
            schedule_csv_path=data.get("schedule_csv_path", ""),
            audio_directory=data.get("audio_directory", ""),
            custom_config=data.get("custom_config", {}),
            session_notes=data.get("session_notes", ""),
            check_history=data.get("check_history", [])
        )
        
        # 恢复问题处理记录
        resolutions_data = data.get("issue_resolutions", [])
        state.issue_resolutions = [
            IssueResolution.from_dict(r) for r in resolutions_data
        ]
        
        return state


class StateStore:
    """状态存储器"""
    
    STATE_FILE_EXTENSION = ".qcs"  # Quality Check State
    STATE_DIRECTORY = ".quality_check_states"
    
    def __init__(self, base_directory: str = None):
        """
        初始化状态存储器
        
        Args:
            base_directory: 基础目录，用于存储状态文件
        """
        if base_directory is None:
            # 默认使用用户主目录
            base_directory = str(Path.home())
        
        self.base_directory = base_directory
        self.state_directory = os.path.join(base_directory, self.STATE_DIRECTORY)
        
        # 确保状态目录存在
        os.makedirs(self.state_directory, exist_ok=True)
    
    def _generate_session_id(self, 
                             schedule_path: str, 
                             audio_dir: str) -> str:
        """
        生成会话ID（基于节目单和音频目录的哈希）
        
        这样可以确保相同的项目组合使用相同的状态文件
        """
        combined = f"{schedule_path}|{audio_dir}".encode('utf-8')
        return hashlib.md5(combined).hexdigest()[:12]
    
    def _get_state_file_path(self, session_id: str) -> str:
        """获取状态文件路径"""
        return os.path.join(self.state_directory, f"{session_id}{self.STATE_FILE_EXTENSION}")
    
    def create_new_session(self,
                          project_name: str,
                          schedule_csv_path: str,
                          audio_directory: str,
                          custom_config: Dict[str, Any] = None) -> SessionState:
        """
        创建新会话
        
        Args:
            project_name: 项目名称
            schedule_csv_path: 节目单CSV路径
            audio_directory: 音频目录
            custom_config: 自定义配置
            
        Returns:
            新的会话状态
        """
        now = datetime.now().isoformat()
        session_id = self._generate_session_id(schedule_csv_path, audio_directory)
        
        state = SessionState(
            session_id=session_id,
            created_at=now,
            updated_at=now,
            project_name=project_name or os.path.basename(schedule_csv_path),
            schedule_csv_path=schedule_csv_path,
            audio_directory=audio_directory,
            custom_config=custom_config or {}
        )
        
        return state
    
    def save_session(self, state: SessionState) -> str:
        """
        保存会话状态
        
        Args:
            state: 会话状态
            
        Returns:
            保存的文件路径
        """
        # 更新时间戳
        state.updated_at = datetime.now().isoformat()
        
        file_path = self._get_state_file_path(state.session_id)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def load_session(self, session_id: str) -> Optional[SessionState]:
        """
        加载会话状态
        
        Args:
            session_id: 会话ID
            
        Returns:
            会话状态，如果不存在则返回 None
        """
        file_path = self._get_state_file_path(session_id)
        
        if not os.path.exists(file_path):
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return SessionState.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            return None
    
    def load_session_by_paths(self,
                              schedule_csv_path: str,
                              audio_directory: str) -> Optional[SessionState]:
        """
        通过路径加载会话（自动生成session_id）
        
        Args:
            schedule_csv_path: 节目单CSV路径
            audio_directory: 音频目录
            
        Returns:
            会话状态
        """
        session_id = self._generate_session_id(schedule_csv_path, audio_directory)
        return self.load_session(session_id)
    
    def update_issue_resolution(self,
                                state: SessionState,
                                issue: QualityIssue,
                                issue_index: int,
                                resolution_action: str,
                                resolution_note: str = "",
                                resolved_by: str = "") -> SessionState:
        """
        更新问题的处理状态
        
        Args:
            state: 会话状态
            issue: 质检问题
            issue_index: 问题在列表中的索引
            resolution_action: 处理动作："accept", "reject", "needs_fix", "deferred"
            resolution_note: 处理备注
            resolved_by: 处理人
            
        Returns:
            更新后的会话状态
        """
        # 查找现有的处理记录
        existing = None
        for r in state.issue_resolutions:
            if (r.issue_index == issue_index and 
                r.issue_type == issue.issue_type.value and
                r.item_id == issue.item_id and
                r.audio_file == issue.audio_file):
                existing = r
                break
        
        if existing is None:
            # 创建新记录
            resolution = IssueResolution(
                issue_index=issue_index,
                issue_type=issue.issue_type.value,
                item_id=issue.item_id,
                audio_file=issue.audio_file,
                title=issue.title,
                message=issue.message,
                resolved=resolution_action != "",
                resolution_action=resolution_action,
                resolution_note=resolution_note,
                resolved_at=datetime.now().isoformat(),
                resolved_by=resolved_by
            )
            state.issue_resolutions.append(resolution)
        else:
            # 更新现有记录
            existing.resolved = resolution_action != ""
            existing.resolution_action = resolution_action
            existing.resolution_note = resolution_note
            existing.resolved_at = datetime.now().isoformat()
            existing.resolved_by = resolved_by
        
        return state
    
    def apply_resolutions_to_issues(self,
                                    state: SessionState,
                                    issues: List[QualityIssue]) -> List[QualityIssue]:
        """
        将会话中保存的处理记录应用到问题列表
        
        Args:
            state: 会话状态
            issues: 质检问题列表
            
        Returns:
            更新后的问题列表
        """
        if not state.issue_resolutions:
            return issues
        
        # 为了快速查找，创建索引
        # 键：(issue_type, item_id, audio_file, issue_index)
        resolution_map = {}
        for r in state.issue_resolutions:
            key = (r.issue_type, r.item_id, r.audio_file, r.issue_index)
            resolution_map[key] = r
        
        # 应用到每个问题
        for idx, issue in enumerate(issues):
            # 尝试多种方式匹配
            # 1. 完整匹配
            key = (issue.issue_type.value, issue.item_id, issue.audio_file, idx)
            if key in resolution_map:
                r = resolution_map[key]
                issue.resolved = r.resolved
                issue.resolution_action = r.resolution_action
                issue.resolution_note = r.resolution_note
                continue
            
            # 2. 不包含索引的匹配（用于重新质检后问题顺序变化的情况）
            key2 = (issue.issue_type.value, issue.item_id, issue.audio_file)
            # 查找所有匹配的，找最新的
            matching = [r for r in state.issue_resolutions 
                       if (r.issue_type == issue.issue_type.value and 
                           r.item_id == issue.item_id and 
                           r.audio_file == issue.audio_file)]
            if matching:
                # 按时间排序，取最新的
                matching.sort(key=lambda x: x.resolved_at, reverse=True)
                r = matching[0]
                issue.resolved = r.resolved
                issue.resolution_action = r.resolution_action
                issue.resolution_note = r.resolution_note
        
        return issues
    
    def list_saved_sessions(self) -> List[Dict[str, Any]]:
        """
        列出所有保存的会话
        
        Returns:
            会话信息列表
        """
        sessions = []
        
        if not os.path.exists(self.state_directory):
            return sessions
        
        for filename in os.listdir(self.state_directory):
            if filename.endswith(self.STATE_FILE_EXTENSION):
                file_path = os.path.join(self.state_directory, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    session_info = {
                        "session_id": data.get("session_id", ""),
                        "project_name": data.get("project_name", "未命名项目"),
                        "created_at": data.get("created_at", ""),
                        "updated_at": data.get("updated_at", ""),
                        "schedule_csv_path": data.get("schedule_csv_path", ""),
                        "audio_directory": data.get("audio_directory", ""),
                        "resolution_count": len(data.get("issue_resolutions", [])),
                        "file_path": file_path
                    }
                    sessions.append(session_info)
                except (json.JSONDecodeError, KeyError, IOError):
                    continue
        
        # 按更新时间排序（最新的在前）
        sessions.sort(key=lambda x: x["updated_at"], reverse=True)
        
        return sessions
    
    def delete_session(self, session_id: str) -> bool:
        """
        删除会话
        
        Args:
            session_id: 会话ID
            
        Returns:
            是否成功删除
        """
        file_path = self._get_state_file_path(session_id)
        
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return True
            except OSError:
                return False
        
        return False
    
    def add_check_history(self,
                         state: SessionState,
                         check_type: str,
                         summary: str,
                         issue_count: int = 0) -> SessionState:
        """
        添加质检历史记录
        
        Args:
            state: 会话状态
            check_type: 质检类型
            summary: 摘要
            issue_count: 问题数量
            
        Returns:
            更新后的会话状态
        """
        record = {
            "timestamp": datetime.now().isoformat(),
            "check_type": check_type,
            "summary": summary,
            "issue_count": issue_count
        }
        state.check_history.append(record)
        
        return state


# 便捷函数
def get_default_store() -> StateStore:
    """获取默认状态存储器"""
    return StateStore()


def save_project_state(schedule_path: str,
                       audio_dir: str,
                       issues: List[QualityIssue],
                       project_name: str = "") -> str:
    """
    便捷函数：保存项目状态
    
    Args:
        schedule_path: 节目单路径
        audio_dir: 音频目录
        issues: 问题列表
        project_name: 项目名称
        
    Returns:
        保存的文件路径
    """
    store = get_default_store()
    
    # 加载现有状态或创建新状态
    state = store.load_session_by_paths(schedule_path, audio_dir)
    if state is None:
        state = store.create_new_session(
            project_name=project_name,
            schedule_csv_path=schedule_path,
            audio_directory=audio_dir
        )
    
    # 从问题中提取处理状态
    state.issue_resolutions = []
    for idx, issue in enumerate(issues):
        if issue.resolved or issue.resolution_action:
            resolution = IssueResolution(
                issue_index=idx,
                issue_type=issue.issue_type.value,
                item_id=issue.item_id,
                audio_file=issue.audio_file,
                title=issue.title,
                message=issue.message,
                resolved=issue.resolved,
                resolution_action=issue.resolution_action,
                resolution_note=issue.resolution_note,
                resolved_at=datetime.now().isoformat()
            )
            state.issue_resolutions.append(resolution)
    
    return store.save_session(state)
