"""版本历史和排练计划模型"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid
import json
from copy import deepcopy


@dataclass
class VersionSnapshot:
    """单个版本快照"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    version_number: int = 1
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    
    label: str = ""
    description: str = ""
    
    data: Dict[str, Any] = field(default_factory=dict)
    
    is_auto_save: bool = False
    is_marked: bool = False

    def to_dict(self):
        return {
            "id": self.id,
            "version_number": self.version_number,
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
            "label": self.label,
            "description": self.description,
            "data": self.data,
            "is_auto_save": self.is_auto_save,
            "is_marked": self.is_marked,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id", str(uuid.uuid4())[:12]),
            version_number=data.get("version_number", 1),
            created_at=datetime.fromisoformat(data["created_at"]),
            created_by=data.get("created_by", "system"),
            label=data.get("label", ""),
            description=data.get("description", ""),
            data=deepcopy(data.get("data", {})),
            is_auto_save=data.get("is_auto_save", False),
            is_marked=data.get("is_marked", False),
        )

    def display_name(self):
        if self.label:
            return f"v{self.version_number} - {self.label}"
        return f"v{self.version_number} ({self.created_at.strftime('%m-%d %H:%M')})"

    def __repr__(self):
        return f"<VersionSnapshot v{self.version_number} id={self.id}>"


@dataclass
class VersionHistory:
    """版本历史管理器"""
    snapshots: List[VersionSnapshot] = field(default_factory=list)
    current_index: int = -1
    max_versions: int = 50

    def get_next_version_number(self) -> int:
        if not self.snapshots:
            return 1
        return max(s.version_number for s in self.snapshots) + 1

    def create_snapshot(
        self,
        data: Dict[str, Any],
        label: str = "",
        description: str = "",
        is_auto_save: bool = False,
        created_by: str = "system"
    ) -> VersionSnapshot:
        """创建新版本快照"""
        snapshot = VersionSnapshot(
            version_number=self.get_next_version_number(),
            label=label,
            description=description,
            data=deepcopy(data),
            is_auto_save=is_auto_save,
            created_by=created_by,
        )
        self.snapshots.append(snapshot)
        self.current_index = len(self.snapshots) - 1
        
        if len(self.snapshots) > self.max_versions:
            self.snapshots = self.snapshots[-self.max_versions:]
            self.current_index = len(self.snapshots) - 1
        
        return snapshot

    def get_current_snapshot(self) -> Optional[VersionSnapshot]:
        """获取当前版本"""
        if 0 <= self.current_index < len(self.snapshots):
            return self.snapshots[self.current_index]
        return None

    def rollback_to(self, snapshot_id: str) -> Optional[VersionSnapshot]:
        """回滚到指定版本（不删除后续版本，只是切换当前索引）"""
        for i, s in enumerate(self.snapshots):
            if s.id == snapshot_id:
                self.current_index = i
                return s
        return None

    def get_snapshot_by_version(self, version_number: int) -> Optional[VersionSnapshot]:
        """按版本号获取快照"""
        for s in self.snapshots:
            if s.version_number == version_number:
                return s
        return None

    def get_snapshots_desc(self) -> List[VersionSnapshot]:
        """获取所有快照（按时间倒序）"""
        return sorted(self.snapshots, key=lambda s: s.created_at, reverse=True)

    def mark_snapshot(self, snapshot_id: str, marked: bool = True) -> bool:
        """标记/取消标记重要版本"""
        for s in self.snapshots:
            if s.id == snapshot_id:
                s.is_marked = marked
                return True
        return False

    def to_dict(self):
        return {
            "snapshots": [s.to_dict() for s in self.snapshots],
            "current_index": self.current_index,
            "max_versions": self.max_versions,
        }

    @classmethod
    def from_dict(cls, data):
        snapshots = [VersionSnapshot.from_dict(s) for s in data.get("snapshots", [])]
        return cls(
            snapshots=snapshots,
            current_index=data.get("current_index", -1),
            max_versions=data.get("max_versions", 50),
        )

    def __repr__(self):
        return f"<VersionHistory: {len(self.snapshots)} snapshots, current=v{self.get_current_snapshot().version_number if self.get_current_snapshot() else 'None'}>"


@dataclass
class RehearsalPlan:
    """完整的排练计划（包含成员、布局、版本历史）"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    rehearsal_date: datetime = field(default_factory=datetime.now)
    
    members: Dict[str, Any] = field(default_factory=dict)
    layout: Dict[str, Any] = field(default_factory=dict)
    
    version_history: VersionHistory = field(default_factory=VersionHistory)
    
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: str = ""

    def save_version(self, label: str = "", description: str = "", is_auto_save: bool = False):
        """保存当前状态为新版本"""
        data = {
            "members": deepcopy(self.members),
            "layout": deepcopy(self.layout),
        }
        self.version_history.create_snapshot(
            data=data,
            label=label,
            description=description,
            is_auto_save=is_auto_save,
        )
        self.updated_at = datetime.now()

    def restore_from_snapshot(self, snapshot_id: str) -> bool:
        """从快照恢复"""
        snapshot = self.version_history.rollback_to(snapshot_id)
        if snapshot and snapshot.data:
            data = snapshot.data
            self.members = deepcopy(data.get("members", {}))
            self.layout = deepcopy(data.get("layout", {}))
            self.updated_at = datetime.now()
            return True
        return False

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "rehearsal_date": self.rehearsal_date.isoformat(),
            "members": self.members,
            "layout": self.layout,
            "version_history": self.version_history.to_dict(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            name=data.get("name", ""),
            rehearsal_date=datetime.fromisoformat(data["rehearsal_date"]) if data.get("rehearsal_date") else datetime.now(),
            members=deepcopy(data.get("members", {})),
            layout=deepcopy(data.get("layout", {})),
            version_history=VersionHistory.from_dict(data.get("version_history", {})),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
            notes=data.get("notes", ""),
        )

    def __repr__(self):
        return f"<RehearsalPlan '{self.name}' date={self.rehearsal_date.date()}>"
