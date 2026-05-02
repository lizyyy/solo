"""会话存储 - 本地保存会话数据"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from pathlib import Path
from collections import defaultdict
import json
import hashlib
import time
import shutil

from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference, UnreachableShortcut, DuplicateMacro,
)
from src.rules.rule_engine import AnalysisResult, RuleResult
from src.suggestions.key_suggester import Suggestion


@dataclass
class MigrationPlan:
    """迁移方案 - 包含改键计划和解决的问题"""
    
    # 基本信息
    plan_id: str = ""
    plan_name: str = ""
    created_time: float = field(default_factory=time.time)
    modified_time: float = field(default_factory=time.time)
    
    # 目标平台
    target_platform: str = "all"  # "mac", "windows", "linux", "all"
    
    # 改键映射
    # original_key -> { "new_key": ..., "shortcut_id": ..., "reason": ... }
    key_mappings: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # 解决的问题
    resolved_conflicts: List[str] = field(default_factory=list)  # conflict IDs
    resolved_platform_differences: List[str] = field(default_factory=list)
    resolved_unreachable: List[str] = field(default_factory=list)
    resolved_duplicate_macros: List[str] = field(default_factory=list)
    
    # 用户标记
    # shortcut_id -> { "action": "keep"|"remap"|"ignore", "notes": ... }
    user_decisions: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # 保留键标记
    # key_str -> { "reason": ..., "application_id": ... }
    reserved_keys: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # 备注
    notes: str = ""
    
    # 统计信息
    total_shortcuts: int = 0
    total_modified: int = 0
    total_kept: int = 0
    total_ignored: int = 0
    
    def calculate_stats(self):
        """计算统计信息"""
        self.total_modified = len(self.key_mappings)
        self.total_kept = 0
        self.total_ignored = 0
        
        for decision in self.user_decisions.values():
            action = decision.get("action", "")
            if action == "keep":
                self.total_kept += 1
            elif action == "ignore":
                self.total_ignored += 1
    
    def add_mapping(
        self,
        original_key: str,
        new_key: str,
        shortcut_id: str,
        reason: str = ""
    ):
        """添加改键映射"""
        self.key_mappings[original_key] = {
            "new_key": new_key,
            "shortcut_id": shortcut_id,
            "reason": reason,
            "added_time": time.time(),
        }
        self.modified_time = time.time()
    
    def add_user_decision(
        self,
        shortcut_id: str,
        action: str,  # "keep", "remap", "ignore"
        notes: str = ""
    ):
        """添加用户决策"""
        self.user_decisions[shortcut_id] = {
            "action": action,
            "notes": notes,
            "decision_time": time.time(),
        }
        self.modified_time = time.time()
    
    def add_reserved_key(
        self,
        key_str: str,
        reason: str = "",
        application_id: str = ""
    ):
        """标记保留键"""
        self.reserved_keys[key_str] = {
            "reason": reason,
            "application_id": application_id,
            "added_time": time.time(),
        }
        self.modified_time = time.time()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "plan_id": self.plan_id,
            "plan_name": self.plan_name,
            "created_time": self.created_time,
            "modified_time": self.modified_time,
            "target_platform": self.target_platform,
            "key_mappings": self.key_mappings,
            "resolved_conflicts": self.resolved_conflicts,
            "resolved_platform_differences": self.resolved_platform_differences,
            "resolved_unreachable": self.resolved_unreachable,
            "resolved_duplicate_macros": self.resolved_duplicate_macros,
            "user_decisions": self.user_decisions,
            "reserved_keys": self.reserved_keys,
            "notes": self.notes,
            "total_shortcuts": self.total_shortcuts,
            "total_modified": self.total_modified,
            "total_kept": self.total_kept,
            "total_ignored": self.total_ignored,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MigrationPlan":
        """从字典创建"""
        plan = cls()
        plan.plan_id = data.get("plan_id", "")
        plan.plan_name = data.get("plan_name", "")
        plan.created_time = data.get("created_time", time.time())
        plan.modified_time = data.get("modified_time", time.time())
        plan.target_platform = data.get("target_platform", "all")
        plan.key_mappings = data.get("key_mappings", {})
        plan.resolved_conflicts = data.get("resolved_conflicts", [])
        plan.resolved_platform_differences = data.get("resolved_platform_differences", [])
        plan.resolved_unreachable = data.get("resolved_unreachable", [])
        plan.resolved_duplicate_macros = data.get("resolved_duplicate_macros", [])
        plan.user_decisions = data.get("user_decisions", {})
        plan.reserved_keys = data.get("reserved_keys", {})
        plan.notes = data.get("notes", "")
        plan.total_shortcuts = data.get("total_shortcuts", 0)
        plan.total_modified = data.get("total_modified", 0)
        plan.total_kept = data.get("total_kept", 0)
        plan.total_ignored = data.get("total_ignored", 0)
        return plan


@dataclass
class Session:
    """会话 - 包含完整的工作状态"""
    
    # 基本信息
    session_id: str = ""
    session_name: str = ""
    created_time: float = field(default_factory=time.time)
    modified_time: float = field(default_factory=time.time)
    
    # 导入的配置
    imported_files: List[str] = field(default_factory=list)
    
    # 数据模型
    applications: List[Dict[str, Any]] = field(default_factory=list)
    contexts: List[Dict[str, Any]] = field(default_factory=list)
    shortcuts: List[Dict[str, Any]] = field(default_factory=list)
    
    # 分析结果
    analysis_result: Optional[Dict[str, Any]] = None
    
    # 迁移方案
    migration_plans: List[Dict[str, Any]] = field(default_factory=list)
    
    # 当前活动的迁移方案
    active_plan_id: str = ""
    
    # 用户设置
    user_settings: Dict[str, Any] = field(default_factory=lambda: {
        "default_platform": "all",
        "auto_detect_conflicts": True,
        "show_suggestions": True,
    })
    
    def generate_id(self):
        """生成会话ID"""
        import hashlib
        content = f"{self.session_name}:{self.created_time}"
        self.session_id = hashlib.md5(content.encode()).hexdigest()[:12]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "session_id": self.session_id,
            "session_name": self.session_name,
            "created_time": self.created_time,
            "modified_time": self.modified_time,
            "imported_files": self.imported_files,
            "applications": self.applications,
            "contexts": self.contexts,
            "shortcuts": self.shortcuts,
            "analysis_result": self.analysis_result,
            "migration_plans": self.migration_plans,
            "active_plan_id": self.active_plan_id,
            "user_settings": self.user_settings,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Session":
        """从字典创建"""
        session = cls()
        session.session_id = data.get("session_id", "")
        session.session_name = data.get("session_name", "")
        session.created_time = data.get("created_time", time.time())
        session.modified_time = data.get("modified_time", time.time())
        session.imported_files = data.get("imported_files", [])
        session.applications = data.get("applications", [])
        session.contexts = data.get("contexts", [])
        session.shortcuts = data.get("shortcuts", [])
        session.analysis_result = data.get("analysis_result")
        session.migration_plans = data.get("migration_plans", [])
        session.active_plan_id = data.get("active_plan_id", "")
        session.user_settings = data.get("user_settings", {
            "default_platform": "all",
            "auto_detect_conflicts": True,
            "show_suggestions": True,
        })
        return session


class SessionStorage:
    """会话存储管理器"""
    
    def __init__(self, storage_dir: Optional[str] = None):
        """初始化存储管理器"""
        if storage_dir is None:
            # 使用默认存储位置
            home = Path.home()
            self.storage_dir = home / ".shortcut-migrator" / "sessions"
        else:
            self.storage_dir = Path(storage_dir)
        
        # 确保目录存在
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        # 自动保存的会话文件
        self.auto_save_file = self.storage_dir / "autosave.json"
    
    def save_session(self, session: Session) -> str:
        """保存会话"""
        if not session.session_id:
            session.generate_id()
        
        session.modified_time = time.time()
        
        # 保存到文件
        file_path = self.storage_dir / f"{session.session_id}.json"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)
        
        # 更新最近使用列表
        self._update_recent_sessions(session)
        
        return session.session_id
    
    def load_session(self, session_id: str) -> Optional[Session]:
        """加载会话"""
        file_path = self.storage_dir / f"{session_id}.json"
        
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return Session.from_dict(data)
        except Exception:
            return None
    
    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        file_path = self.storage_dir / f"{session_id}.json"
        
        if file_path.exists():
            try:
                file_path.unlink()
                return True
            except Exception:
                return False
        return False
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """列出所有会话"""
        sessions = []
        
        for file_path in self.storage_dir.glob("*.json"):
            if file_path.name == "autosave.json":
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 提取基本信息
                session_info = {
                    "session_id": data.get("session_id", ""),
                    "session_name": data.get("session_name", "未命名会话"),
                    "created_time": data.get("created_time", 0),
                    "modified_time": data.get("modified_time", 0),
                    "total_shortcuts": len(data.get("shortcuts", [])),
                    "total_applications": len(data.get("applications", [])),
                    "file_path": str(file_path),
                }
                sessions.append(session_info)
            except Exception:
                continue
        
        # 按修改时间排序（最新的在前）
        sessions.sort(key=lambda x: x["modified_time"], reverse=True)
        
        return sessions
    
    def auto_save(self, session: Session):
        """自动保存当前会话"""
        session.modified_time = time.time()
        
        try:
            with open(self.auto_save_file, 'w', encoding='utf-8') as f:
                json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    def load_auto_save(self) -> Optional[Session]:
        """加载自动保存的会话"""
        if not self.auto_save_file.exists():
            return None
        
        try:
            with open(self.auto_save_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return Session.from_dict(data)
        except Exception:
            return None
    
    def _update_recent_sessions(self, session: Session):
        """更新最近使用的会话列表"""
        # 这里可以实现最近使用会话的跟踪
        # 暂时保留简单实现
        pass
    
    def export_session(self, session_id: str, export_path: str) -> bool:
        """导出会话到指定路径"""
        source_path = self.storage_dir / f"{session_id}.json"
        target_path = Path(export_path)
        
        if not source_path.exists():
            return False
        
        try:
            shutil.copy2(source_path, target_path)
            return True
        except Exception:
            return False
    
    def import_session(self, import_path: str) -> Optional[str]:
        """从指定路径导入会话"""
        source_path = Path(import_path)
        
        if not source_path.exists():
            return None
        
        try:
            # 读取并验证
            with open(source_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 创建会话对象
            session = Session.from_dict(data)
            
            # 确保有唯一ID
            if not session.session_id:
                session.generate_id()
            
            # 保存到存储目录
            return self.save_session(session)
            
        except Exception:
            return None
    
    def get_session_count(self) -> int:
        """获取会话数量"""
        count = 0
        for file_path in self.storage_dir.glob("*.json"):
            if file_path.name != "autosave.json":
                count += 1
        return count
    
    def clear_all_sessions(self) -> bool:
        """清除所有会话（除了自动保存的）"""
        try:
            for file_path in self.storage_dir.glob("*.json"):
                if file_path.name != "autosave.json":
                    file_path.unlink()
            return True
        except Exception:
            return False
