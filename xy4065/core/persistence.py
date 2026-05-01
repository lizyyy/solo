import pandas as pd
import numpy as np
import json
import pickle
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
import logging
import shutil
from uuid import uuid4

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AuditEntry:
    timestamp: datetime
    action: str
    user: str
    record_id: str
    details: Dict[str, Any]
    ip_address: str = "127.0.0.1"
    session_id: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else self.timestamp,
            "action": self.action,
            "user": self.user,
            "record_id": self.record_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "session_id": self.session_id
        }


@dataclass
class WorkflowState:
    session_id: str
    created_at: datetime
    updated_at: datetime
    reviewed_ids: List[str]
    merged_groups: List[Dict]
    assigned_tasks: List[Dict]
    notes: Dict[str, str]
    status: str = "active"


class DataPersistence:
    def __init__(self, data_dir: Path, exports_dir: Path):
        self.data_dir = data_dir
        self.exports_dir = exports_dir
        
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)
        
        self.audit_file = self.data_dir / "audit_log.json"
        self.workflow_dir = self.data_dir / "workflow"
        self.workflow_dir.mkdir(parents=True, exist_ok=True)
        
        self._init_audit_file()
    
    def _init_audit_file(self):
        if not self.audit_file.exists():
            with open(self.audit_file, 'w', encoding='utf-8') as f:
                json.dump([], f)
    
    def save_sensor_data(self, df: pd.DataFrame, filename: str = "sensor_data.parquet") -> Path:
        file_path = self.data_dir / filename
        
        df_to_save = df.copy()
        for col in df_to_save.columns:
            if pd.api.types.is_datetime64_any_dtype(df_to_save[col]):
                df_to_save[col] = df_to_save[col].dt.strftime('%Y-%m-%d %H:%M:%S')
        
        df_to_save.to_parquet(file_path, index=False)
        logger.info(f"传感器数据已保存: {file_path}")
        
        self._log_audit(
            action="SAVE_SENSOR_DATA",
            user="system",
            record_id=filename,
            details={"rows": len(df), "columns": list(df.columns)}
        )
        
        return file_path
    
    def load_sensor_data(self, filename: str = "sensor_data.parquet") -> Optional[pd.DataFrame]:
        file_path = self.data_dir / filename
        
        if not file_path.exists():
            return None
        
        df = pd.read_parquet(file_path)
        
        for col in ["记录时间", "安装日期", "最后校准"]:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        logger.info(f"传感器数据已加载: {len(df)} 条记录")
        return df
    
    def save_manual_data(self, df: pd.DataFrame, filename: str = "manual_data.parquet") -> Path:
        file_path = self.data_dir / filename
        
        df_to_save = df.copy()
        for col in df_to_save.columns:
            if pd.api.types.is_datetime64_any_dtype(df_to_save[col]):
                df_to_save[col] = df_to_save[col].dt.strftime('%Y-%m-%d %H:%M:%S')
        
        df_to_save.to_parquet(file_path, index=False)
        logger.info(f"人工巡检数据已保存: {file_path}")
        
        self._log_audit(
            action="SAVE_MANUAL_DATA",
            user="system",
            record_id=filename,
            details={"rows": len(df), "columns": list(df.columns)}
        )
        
        return file_path
    
    def load_manual_data(self, filename: str = "manual_data.parquet") -> Optional[pd.DataFrame]:
        file_path = self.data_dir / filename
        
        if not file_path.exists():
            return None
        
        df = pd.read_parquet(file_path)
        
        for col in ["巡检时间"]:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        logger.info(f"人工巡检数据已加载: {len(df)} 条记录")
        return df
    
    def save_water_data(self, df: pd.DataFrame, filename: str = "water_data.parquet") -> Path:
        file_path = self.data_dir / filename
        
        df_to_save = df.copy()
        for col in df_to_save.columns:
            if pd.api.types.is_datetime64_any_dtype(df_to_save[col]):
                df_to_save[col] = df_to_save[col].dt.strftime('%Y-%m-%d %H:%M:%S')
        
        df_to_save.to_parquet(file_path, index=False)
        logger.info(f"积水点位数据已保存: {file_path}")
        
        self._log_audit(
            action="SAVE_WATER_DATA",
            user="system",
            record_id=filename,
            details={"rows": len(df), "columns": list(df.columns)}
        )
        
        return file_path
    
    def load_water_data(self, filename: str = "water_data.parquet") -> Optional[pd.DataFrame]:
        file_path = self.data_dir / filename
        
        if not file_path.exists():
            return None
        
        df = pd.read_parquet(file_path)
        
        for col in ["发生时间"]:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        logger.info(f"积水点位数据已加载: {len(df)} 条记录")
        return df
    
    def save_merged_data(self, df: pd.DataFrame, filename: str = "merged_data.parquet") -> Path:
        file_path = self.data_dir / filename
        
        df_to_save = df.copy()
        for col in df_to_save.columns:
            if pd.api.types.is_datetime64_any_dtype(df_to_save[col]):
                df_to_save[col] = df_to_save[col].apply(
                    lambda x: x.strftime('%Y-%m-%d %H:%M:%S') if pd.notna(x) else None
                )
        
        df_to_save.to_parquet(file_path, index=False)
        logger.info(f"合并数据已保存: {file_path}")
        
        self._log_audit(
            action="SAVE_MERGED_DATA",
            user="system",
            record_id=filename,
            details={"rows": len(df)}
        )
        
        return file_path
    
    def load_merged_data(self, filename: str = "merged_data.parquet") -> Optional[pd.DataFrame]:
        file_path = self.data_dir / filename
        
        if not file_path.exists():
            return None
        
        df = pd.read_parquet(file_path)
        
        for col in ["事件时间", "sensor_记录时间", "manual_巡检时间"]:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        logger.info(f"合并数据已加载: {len(df)} 条记录")
        return df
    
    def save_workflow_state(self, state: WorkflowState) -> Path:
        state_file = self.workflow_dir / f"{state.session_id}.json"
        
        state_dict = {
            "session_id": state.session_id,
            "created_at": state.created_at.isoformat() if isinstance(state.created_at, datetime) else state.created_at,
            "updated_at": state.updated_at.isoformat() if isinstance(state.updated_at, datetime) else state.updated_at,
            "reviewed_ids": state.reviewed_ids,
            "merged_groups": state.merged_groups,
            "assigned_tasks": state.assigned_tasks,
            "notes": state.notes,
            "status": state.status
        }
        
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(state_dict, f, ensure_ascii=False, indent=2)
        
        logger.info(f"工作流状态已保存: {state_file}")
        
        self._log_audit(
            action="SAVE_WORKFLOW",
            user="system",
            record_id=state.session_id,
            details={"status": state.status, "reviewed_count": len(state.reviewed_ids)}
        )
        
        return state_file
    
    def load_workflow_state(self, session_id: str) -> Optional[WorkflowState]:
        state_file = self.workflow_dir / f"{session_id}.json"
        
        if not state_file.exists():
            return None
        
        with open(state_file, 'r', encoding='utf-8') as f:
            state_dict = json.load(f)
        
        return WorkflowState(
            session_id=state_dict["session_id"],
            created_at=datetime.fromisoformat(state_dict["created_at"]) if state_dict.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(state_dict["updated_at"]) if state_dict.get("updated_at") else datetime.now(),
            reviewed_ids=state_dict.get("reviewed_ids", []),
            merged_groups=state_dict.get("merged_groups", []),
            assigned_tasks=state_dict.get("assigned_tasks", []),
            notes=state_dict.get("notes", {}),
            status=state_dict.get("status", "active")
        )
    
    def list_workflow_sessions(self) -> List[Dict]:
        sessions = []
        
        for state_file in self.workflow_dir.glob("*.json"):
            try:
                with open(state_file, 'r', encoding='utf-8') as f:
                    state_dict = json.load(f)
                
                sessions.append({
                    "session_id": state_dict.get("session_id", state_file.stem),
                    "created_at": state_dict.get("created_at", ""),
                    "updated_at": state_dict.get("updated_at", ""),
                    "status": state_dict.get("status", "unknown"),
                    "reviewed_count": len(state_dict.get("reviewed_ids", [])),
                    "file_path": str(state_file)
                })
            except Exception as e:
                logger.warning(f"无法读取工作流文件 {state_file}: {e}")
        
        sessions.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return sessions
    
    def create_new_session(self) -> WorkflowState:
        session_id = str(uuid4())[:8].upper()
        now = datetime.now()
        
        state = WorkflowState(
            session_id=session_id,
            created_at=now,
            updated_at=now,
            reviewed_ids=[],
            merged_groups=[],
            assigned_tasks=[],
            notes={},
            status="active"
        )
        
        self.save_workflow_state(state)
        logger.info(f"新会话已创建: {session_id}")
        
        return state
    
    def mark_as_reviewed(self, session_id: str, manhole_id: str, user: str = "user") -> bool:
        state = self.load_workflow_state(session_id)
        
        if not state:
            return False
        
        if manhole_id not in state.reviewed_ids:
            state.reviewed_ids.append(manhole_id)
            state.updated_at = datetime.now()
            self.save_workflow_state(state)
            
            self._log_audit(
                action="MARK_REVIEWED",
                user=user,
                record_id=manhole_id,
                details={"session_id": session_id}
            )
            
            logger.info(f"井盖 {manhole_id} 已标记为已复核")
        
        return True
    
    def mark_duplicates_merged(
        self,
        session_id: str,
        group_id: str,
        primary_id: str,
        merged_ids: List[str],
        user: str = "user"
    ) -> bool:
        state = self.load_workflow_state(session_id)
        
        if not state:
            return False
        
        merge_record = {
            "group_id": group_id,
            "primary_id": primary_id,
            "merged_ids": merged_ids,
            "merged_at": datetime.now().isoformat(),
            "merged_by": user
        }
        
        state.merged_groups.append(merge_record)
        state.updated_at = datetime.now()
        
        for mid in merged_ids:
            if mid not in state.reviewed_ids:
                state.reviewed_ids.append(mid)
        
        self.save_workflow_state(state)
        
        self._log_audit(
            action="MERGE_DUPLICATES",
            user=user,
            record_id=group_id,
            details={"primary": primary_id, "merged_count": len(merged_ids), "session_id": session_id}
        )
        
        logger.info(f"重复记录已合并: {group_id}, 主记录: {primary_id}")
        return True
    
    def assign_task(
        self,
        session_id: str,
        manhole_id: str,
        assignee: str,
        priority: str = "medium",
        due_hours: int = 24,
        user: str = "user"
    ) -> bool:
        state = self.load_workflow_state(session_id)
        
        if not state:
            return False
        
        now = datetime.now()
        due_time = now + timedelta(hours=due_hours)
        
        task = {
            "task_id": f"TASK_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "manhole_id": manhole_id,
            "assignee": assignee,
            "priority": priority,
            "created_at": now.isoformat(),
            "due_at": due_time.isoformat(),
            "status": "pending"
        }
        
        state.assigned_tasks.append(task)
        state.updated_at = now
        
        self.save_workflow_state(state)
        
        self._log_audit(
            action="ASSIGN_TASK",
            user=user,
            record_id=task["task_id"],
            details={"manhole_id": manhole_id, "assignee": assignee, "priority": priority}
        )
        
        logger.info(f"任务已分配: {task['task_id']} 给 {assignee}")
        return True
    
    def add_note(
        self,
        session_id: str,
        manhole_id: str,
        note: str,
        user: str = "user"
    ) -> bool:
        state = self.load_workflow_state(session_id)
        
        if not state:
            return False
        
        note_entry = {
            "timestamp": datetime.now().isoformat(),
            "user": user,
            "content": note
        }
        
        if manhole_id not in state.notes:
            state.notes[manhole_id] = []
        
        state.notes[manhole_id].append(note_entry)
        state.updated_at = datetime.now()
        
        self.save_workflow_state(state)
        
        self._log_audit(
            action="ADD_NOTE",
            user=user,
            record_id=manhole_id,
            details={"note_preview": note[:50] if len(note) > 50 else note}
        )
        
        return True
    
    def _log_audit(self, action: str, user: str, record_id: str, details: Dict[str, Any]):
        entry = AuditEntry(
            timestamp=datetime.now(),
            action=action,
            user=user,
            record_id=record_id,
            details=details
        )
        
        try:
            with open(self.audit_file, 'r', encoding='utf-8') as f:
                audit_log = json.load(f)
        except Exception:
            audit_log = []
        
        audit_log.append(entry.to_dict())
        
        with open(self.audit_file, 'w', encoding='utf-8') as f:
            json.dump(audit_log, f, ensure_ascii=False, indent=2)
    
    def get_audit_log(self, limit: int = 100) -> List[Dict]:
        if not self.audit_file.exists():
            return []
        
        with open(self.audit_file, 'r', encoding='utf-8') as f:
            audit_log = json.load(f)
        
        return audit_log[-limit:]
    
    def export_audit_package(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        package = {
            "export_time": datetime.now().isoformat(),
            "version": "1.0.0",
            "audit_log": self.get_audit_log(limit=1000),
            "workflow_sessions": self.list_workflow_sessions()
        }
        
        if session_id:
            state = self.load_workflow_state(session_id)
            if state:
                package["current_session"] = {
                    "session_id": state.session_id,
                    "created_at": state.created_at.isoformat() if isinstance(state.created_at, datetime) else state.created_at,
                    "reviewed_ids": state.reviewed_ids,
                    "merged_groups": state.merged_groups,
                    "assigned_tasks": state.assigned_tasks,
                    "notes": state.notes
                }
        
        merged_data = self.load_merged_data()
        if merged_data is not None:
            package["merged_data_count"] = len(merged_data)
            package["merged_data_columns"] = list(merged_data.columns)
        
        return package
    
    def clear_old_sessions(self, days: int = 30) -> int:
        cutoff = datetime.now() - timedelta(days=days)
        deleted_count = 0
        
        for session in self.list_workflow_sessions():
            try:
                updated_at = datetime.fromisoformat(session["updated_at"])
                if updated_at < cutoff:
                    file_path = Path(session["file_path"])
                    if file_path.exists():
                        file_path.unlink()
                        deleted_count += 1
            except Exception as e:
                logger.warning(f"无法删除旧会话 {session['session_id']}: {e}")
        
        logger.info(f"已清理 {deleted_count} 个旧会话")
        return deleted_count
