import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field, asdict
from enum import Enum


class AnnotationType(str, Enum):
    """行级标注类型"""
    OK = "ok"
    ERROR = "error"
    WARNING = "warning"
    REVIEW = "review"
    QUESTION = "question"


@dataclass
class RowAnnotation:
    """行级标注"""
    row_index: int
    annotation_type: AnnotationType
    comment: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["annotation_type"] = self.annotation_type.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RowAnnotation":
        if isinstance(data.get("annotation_type"), str):
            data["annotation_type"] = AnnotationType(data["annotation_type"])
        return cls(**data)


@dataclass
class FieldMapping:
    """字段映射"""
    original_field: str
    mapped_field: str
    enabled: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FieldMapping":
        return cls(**data)


@dataclass
class FilterCondition:
    """筛选条件"""
    field: str
    operator: str
    value: Any
    enabled: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FilterCondition":
        return cls(**data)


@dataclass
class WorkspaceState:
    """工作区完整状态"""
    file_fingerprint: str
    filename: str = ""
    file_type: str = ""
    
    field_mappings: List[FieldMapping] = field(default_factory=list)
    filter_conditions: List[FilterCondition] = field(default_factory=list)
    row_annotations: List[RowAnnotation] = field(default_factory=list)
    general_notes: str = ""
    
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    version: int = 1
    
    def to_dict(self) -> Dict[str, Any]:
        data = {
            "file_fingerprint": self.file_fingerprint,
            "filename": self.filename,
            "file_type": self.file_type,
            "field_mappings": [fm.to_dict() for fm in self.field_mappings],
            "filter_conditions": [fc.to_dict() for fc in self.filter_conditions],
            "row_annotations": [ra.to_dict() for ra in self.row_annotations],
            "general_notes": self.general_notes,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "version": self.version,
        }
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkspaceState":
        field_mappings = [
            FieldMapping.from_dict(fm) for fm in data.get("field_mappings", [])
        ]
        filter_conditions = [
            FilterCondition.from_dict(fc) for fc in data.get("filter_conditions", [])
        ]
        row_annotations = [
            RowAnnotation.from_dict(ra) for ra in data.get("row_annotations", [])
        ]
        
        return cls(
            file_fingerprint=data.get("file_fingerprint", ""),
            filename=data.get("filename", ""),
            file_type=data.get("file_type", ""),
            field_mappings=field_mappings,
            filter_conditions=filter_conditions,
            row_annotations=row_annotations,
            general_notes=data.get("general_notes", ""),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            version=data.get("version", 1),
        )
    
    def update_timestamp(self):
        """更新时间戳"""
        self.updated_at = datetime.now().isoformat()
        self.version += 1


class StateManager:
    """状态管理器"""
    
    def __init__(self, workspaces_dir: Optional[str] = None):
        if workspaces_dir is None:
            workspaces_dir = os.path.join(os.getcwd(), ".workspaces")
        self.workspaces_dir = Path(workspaces_dir)
        self.workspaces_dir.mkdir(parents=True, exist_ok=True)
    
    def get_state_file_path(self, fingerprint: str) -> Path:
        """获取状态文件路径"""
        return self.workspaces_dir / f"{fingerprint}.json"
    
    def save_state(self, state: WorkspaceState) -> Path:
        """保存工作区状态"""
        state.update_timestamp()
        state_path = self.get_state_file_path(state.file_fingerprint)
        
        with open(state_path, 'w', encoding='utf-8') as f:
            json.dump(state.to_dict(), f, indent=2, ensure_ascii=False)
        
        return state_path
    
    def load_state(self, fingerprint: str) -> Optional[WorkspaceState]:
        """加载工作区状态，支持降级处理"""
        state_path = self.get_state_file_path(fingerprint)
        
        if not state_path.exists():
            return None
        
        try:
            with open(state_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return WorkspaceState.from_dict(data)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            print(f"状态文件损坏，尝试降级处理: {e}")
            return self._recover_state_from_corrupted_file(state_path)
    
    def _recover_state_from_corrupted_file(self, state_path: Path) -> Optional[WorkspaceState]:
        """从损坏的状态文件中尽可能恢复数据"""
        try:
            with open(state_path, 'r', encoding='utf-8') as f:
                raw_content = f.read()
            
            import json
            try:
                data = json.loads(raw_content)
            except json.JSONDecodeError:
                print("无法解析JSON，返回None")
                return None
            
            fingerprint = data.get("file_fingerprint", "unknown")
            filename = data.get("filename", "")
            file_type = data.get("file_type", "")
            general_notes = data.get("general_notes", "")
            
            return WorkspaceState(
                file_fingerprint=fingerprint,
                filename=filename,
                file_type=file_type,
                general_notes=general_notes,
            )
        except Exception as e:
            print(f"状态文件恢复失败: {e}")
            return None
    
    def state_exists(self, fingerprint: str) -> bool:
        """检查状态是否存在"""
        return self.get_state_file_path(fingerprint).exists()
    
    def delete_state(self, fingerprint: str) -> bool:
        """删除状态文件"""
        state_path = self.get_state_file_path(fingerprint)
        if state_path.exists():
            state_path.unlink()
            return True
        return False
    
    def list_workspaces(self) -> List[Dict[str, Any]]:
        """列出所有工作区"""
        workspaces = []
        for state_file in self.workspaces_dir.glob("*.json"):
            try:
                state = self.load_state(state_file.stem)
                if state:
                    workspaces.append({
                        "fingerprint": state.file_fingerprint,
                        "filename": state.filename,
                        "created_at": state.created_at,
                        "updated_at": state.updated_at,
                        "version": state.version,
                        "annotations_count": len(state.row_annotations),
                    })
            except Exception:
                continue
        return workspaces
