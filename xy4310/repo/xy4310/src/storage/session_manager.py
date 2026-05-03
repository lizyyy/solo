import json
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid
import logging
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import SESSION_DIR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SessionManager:
    """会话管理器"""
    
    SESSION_FILE_EXT = ".json"
    META_FILE = "session_meta.json"
    
    def __init__(self, session_dir: Optional[Path] = None):
        self.session_dir = session_dir or SESSION_DIR
        self.session_dir.mkdir(parents=True, exist_ok=True)
        
        self.current_session_id: Optional[str] = None
        self.current_session_data: Dict[str, Any] = {}
        
        self._load_sessions_meta()
    
    def _load_sessions_meta(self):
        """加载会话元数据"""
        meta_file = self.session_dir / self.META_FILE
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    self.sessions_meta = json.load(f)
            except Exception as e:
                logger.warning(f"加载会话元数据失败: {e}")
                self.sessions_meta = {}
        else:
            self.sessions_meta = {}
    
    def _save_sessions_meta(self):
        """保存会话元数据"""
        meta_file = self.session_dir / self.META_FILE
        try:
            with open(meta_file, "w", encoding="utf-8") as f:
                json.dump(self.sessions_meta, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            logger.error(f"保存会话元数据失败: {e}")
    
    def create_session(
        self,
        session_name: Optional[str] = None,
        description: str = ""
    ) -> str:
        """
        创建新会话
        
        Args:
            session_name: 会话名称
            description: 会话描述
            
        Returns:
            会话ID
        """
        session_id = str(uuid.uuid4())[:8]
        
        now = datetime.now()
        if not session_name:
            session_name = f"会话_{now.strftime('%Y%m%d_%H%M%S')}"
        
        self.current_session_id = session_id
        self.current_session_data = {
            "session_id": session_id,
            "session_name": session_name,
            "description": description,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "data_sources": {
                "complaints": None,
                "permits": None,
                "monitoring": None,
                "grids": None
            },
            "processed_data": {},
            "analysis_results": {},
            "user_tags": [],
            "verifications": [],
            "notes": ""
        }
        
        self.sessions_meta[session_id] = {
            "session_id": session_id,
            "session_name": session_name,
            "description": description,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "file_path": str(self._get_session_file(session_id))
        }
        
        self._save_session()
        self._save_sessions_meta()
        
        logger.info(f"创建新会话: {session_id} - {session_name}")
        
        return session_id
    
    def _get_session_file(self, session_id: str) -> Path:
        """获取会话文件路径"""
        return self.session_dir / f"{session_id}{self.SESSION_FILE_EXT}"
    
    def _save_session(self):
        """保存当前会话"""
        if not self.current_session_id or not self.current_session_data:
            return
        
        session_file = self._get_session_file(self.current_session_id)
        
        try:
            def convert_to_serializable(obj):
                if isinstance(obj, pd.DataFrame):
                    return {
                        "_type": "DataFrame",
                        "data": obj.to_dict(orient="records"),
                        "columns": list(obj.columns)
                    }
                elif isinstance(obj, pd.Series):
                    return {
                        "_type": "Series",
                        "data": obj.to_dict(),
                        "name": obj.name
                    }
                elif isinstance(obj, (datetime, pd.Timestamp)):
                    return obj.isoformat()
                elif isinstance(obj, np.ndarray):
                    return obj.tolist()
                elif isinstance(obj, np.integer):
                    return int(obj)
                elif isinstance(obj, np.floating):
                    return float(obj)
                return obj
            
            serializable_data = json.loads(
                json.dumps(self.current_session_data, default=convert_to_serializable)
            )
            
            with open(session_file, "w", encoding="utf-8") as f:
                json.dump(serializable_data, f, ensure_ascii=False, indent=2)
            
            self.current_session_data["updated_at"] = datetime.now().isoformat()
            
            if self.current_session_id in self.sessions_meta:
                self.sessions_meta[self.current_session_id]["updated_at"] = datetime.now().isoformat()
                self._save_sessions_meta()
            
            logger.info(f"保存会话: {self.current_session_id}")
            
        except Exception as e:
            logger.error(f"保存会话失败: {e}")
            raise
    
    def load_session(self, session_id: str) -> bool:
        """
        加载会话
        
        Args:
            session_id: 会话ID
            
        Returns:
            是否成功加载
        """
        session_file = self._get_session_file(session_id)
        
        if not session_file.exists():
            logger.error(f"会话文件不存在: {session_file}")
            return False
        
        try:
            with open(session_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            def restore_from_serializable(obj):
                if isinstance(obj, dict):
                    if obj.get("_type") == "DataFrame":
                        return pd.DataFrame(obj.get("data", []), columns=obj.get("columns"))
                    elif obj.get("_type") == "Series":
                        return pd.Series(obj.get("data", {}), name=obj.get("name"))
                return obj
            
            self.current_session_data = json.loads(
                json.dumps(data),
                object_hook=restore_from_serializable
            )
            
            self.current_session_id = session_id
            
            logger.info(f"加载会话成功: {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"加载会话失败: {e}")
            return False
    
    def update_session_data(
        self,
        key: str,
        value: Any,
        auto_save: bool = True
    ):
        """
        更新会话数据
        
        Args:
            key: 数据键
            value: 数据值
            auto_save: 是否自动保存
        """
        if not self.current_session_data:
            logger.warning("没有活动的会话")
            return
        
        keys = key.split(".")
        current = self.current_session_data
        
        for k in keys[:-1]:
            if k not in current:
                current[k] = {}
            current = current[k]
        
        current[keys[-1]] = value
        
        if auto_save:
            self._save_session()
    
    def get_session_data(self, key: str, default: Any = None) -> Any:
        """
        获取会话数据
        
        Args:
            key: 数据键
            default: 默认值
            
        Returns:
            数据值
        """
        if not self.current_session_data:
            return default
        
        keys = key.split(".")
        current = self.current_session_data
        
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            else:
                return default
        
        return current
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """
        列出所有会话
        
        Returns:
            会话列表
        """
        sessions = list(self.sessions_meta.values())
        sessions.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return sessions
    
    def delete_session(self, session_id: str) -> bool:
        """
        删除会话
        
        Args:
            session_id: 会话ID
            
        Returns:
            是否成功删除
        """
        session_file = self._get_session_file(session_id)
        
        try:
            if session_file.exists():
                session_file.unlink()
            
            if session_id in self.sessions_meta:
                del self.sessions_meta[session_id]
                self._save_sessions_meta()
            
            if self.current_session_id == session_id:
                self.current_session_id = None
                self.current_session_data = {}
            
            logger.info(f"删除会话: {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"删除会话失败: {e}")
            return False
    
    def save_data_source(
        self,
        source_type: str,
        file_name: str,
        file_path: str,
        data: pd.DataFrame,
        metadata: Optional[Dict] = None
    ):
        """
        保存数据源信息
        
        Args:
            source_type: 数据源类型 ('complaints', 'permits', 'monitoring', 'grids')
            file_name: 文件名
            file_path: 文件路径
            data: 数据 DataFrame
            metadata: 元数据
        """
        source_info = {
            "file_name": file_name,
            "file_path": file_path,
            "record_count": len(data),
            "columns": list(data.columns) if isinstance(data, pd.DataFrame) else [],
            "loaded_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self.update_session_data(f"data_sources.{source_type}", source_info)
    
    def add_user_tag(
        self,
        tag_type: str,
        target_id: str,
        tag_value: str,
        notes: str = ""
    ) -> Dict[str, Any]:
        """
        添加用户标记
        
        Args:
            tag_type: 标记类型 ('complaint', 'monitor', 'grid', 'source')
            target_id: 目标ID
            tag_value: 标记值
            notes: 备注
            
        Returns:
            标记信息
        """
        tag = {
            "tag_id": str(uuid.uuid4())[:8],
            "tag_type": tag_type,
            "target_id": target_id,
            "tag_value": tag_value,
            "notes": notes,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        if "user_tags" not in self.current_session_data:
            self.current_session_data["user_tags"] = []
        
        self.current_session_data["user_tags"].append(tag)
        self._save_session()
        
        logger.info(f"添加标记: {tag['tag_id']} - {tag_value}")
        
        return tag
    
    def add_verification(
        self,
        event_id: str,
        verification_result: str,
        verifier: str = "",
        notes: str = "",
        evidence: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        添加核实结论
        
        Args:
            event_id: 事件ID
            verification_result: 核实结果
            verifier: 核实人
            notes: 备注
            evidence: 证据
            
        Returns:
            核实信息
        """
        verification = {
            "verification_id": str(uuid.uuid4())[:8],
            "event_id": event_id,
            "result": verification_result,
            "verifier": verifier,
            "notes": notes,
            "evidence": evidence or {},
            "created_at": datetime.now().isoformat()
        }
        
        if "verifications" not in self.current_session_data:
            self.current_session_data["verifications"] = []
        
        self.current_session_data["verifications"].append(verification)
        self._save_session()
        
        logger.info(f"添加核实: {verification['verification_id']} - {verification_result}")
        
        return verification
    
    def get_tags_by_target(self, target_id: str) -> List[Dict[str, Any]]:
        """
        获取目标的所有标记
        
        Args:
            target_id: 目标ID
            
        Returns:
            标记列表
        """
        tags = self.get_session_data("user_tags", [])
        return [t for t in tags if t.get("target_id") == target_id]
    
    def get_verifications_by_event(self, event_id: str) -> List[Dict[str, Any]]:
        """
        获取事件的所有核实记录
        
        Args:
            event_id: 事件ID
            
        Returns:
            核实记录列表
        """
        verifications = self.get_session_data("verifications", [])
        return [v for v in verifications if v.get("event_id") == event_id]
    
    def close_session(self):
        """关闭当前会话"""
        if self.current_session_id:
            self._save_session()
            logger.info(f"关闭会话: {self.current_session_id}")
        
        self.current_session_id = None
        self.current_session_data = {}
    
    def get_current_session_info(self) -> Optional[Dict[str, Any]]:
        """
        获取当前会话信息
        
        Returns:
            会话信息
        """
        if not self.current_session_id or not self.current_session_data:
            return None
        
        return {
            "session_id": self.current_session_id,
            "session_name": self.current_session_data.get("session_name"),
            "description": self.current_session_data.get("description"),
            "created_at": self.current_session_data.get("created_at"),
            "updated_at": self.current_session_data.get("updated_at"),
            "data_sources": self.current_session_data.get("data_sources", {}),
            "tag_count": len(self.current_session_data.get("user_tags", [])),
            "verification_count": len(self.current_session_data.get("verifications", []))
        }
