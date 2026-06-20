"""参数管理模块 - 支持版本追踪、原始数据保留、变更追溯"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import pandas as pd


@dataclass
class ParameterSource:
    """参数来源信息 - 保留原始数据痕迹"""
    source_type: str
    source_id: str
    source_name: str
    raw_data: Dict[str, Any]
    imported_at: datetime = field(default_factory=datetime.now)
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_type": self.source_type,
            "source_id": self.source_id,
            "source_name": self.source_name,
            "raw_data": self.raw_data,
            "imported_at": self.imported_at.isoformat(),
            "notes": self.notes,
        }


@dataclass
class ParameterVersion:
    """参数版本 - 记录每一次参数变更"""
    version_id: str
    version_name: str
    parameters: Dict[str, Any]
    parent_version_id: Optional[str]
    source: ParameterSource
    created_by: str
    created_at: datetime = field(default_factory=datetime.now)
    change_description: str = ""
    change_reason: str = ""
    
    def get_param_hash(self) -> str:
        """计算参数哈希，用于快速比较"""
        param_str = json.dumps(self.parameters, sort_keys=True, default=str)
        return hashlib.sha256(param_str.encode()).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "version_name": self.version_name,
            "parameters": self.parameters,
            "parent_version_id": self.parent_version_id,
            "source": self.source.to_dict(),
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "change_description": self.change_description,
            "change_reason": self.change_reason,
            "param_hash": self.get_param_hash(),
        }


@dataclass
class ParameterChange:
    """参数变更记录 - 用于追溯哪一步让结果变化"""
    param_name: str
    old_value: Any
    new_value: Any
    change_type: str
    description: str


class ParameterManager:
    """参数管理器 - 核心类"""
    
    def __init__(self, project_name: str = "优化调参图表解释"):
        self.project_name = project_name
        self._versions: Dict[str, ParameterVersion] = {}
        self._version_order: List[str] = []
        self._active_version_id: Optional[str] = None
        
    def import_parameters(
        self,
        parameters: Dict[str, Any],
        source_type: str,
        source_id: str,
        source_name: str,
        raw_data: Dict[str, Any],
        created_by: str,
        version_name: Optional[str] = None,
        parent_version_id: Optional[str] = None,
        change_description: str = "",
        change_reason: str = "",
        notes: str = "",
    ) -> ParameterVersion:
        """
        导入参数并创建新版本
        保留原始来源，避免脏数据被修得看不出痕迹
        """
        version_id = str(uuid4())
        
        if version_name is None:
            version_name = f"v{len(self._version_order) + 1}"
        
        source = ParameterSource(
            source_type=source_type,
            source_id=source_id,
            source_name=source_name,
            raw_data=raw_data,
            notes=notes,
        )
        
        version = ParameterVersion(
            version_id=version_id,
            version_name=version_name,
            parameters=dict(parameters),
            parent_version_id=parent_version_id or self._active_version_id,
            source=source,
            created_by=created_by,
            change_description=change_description,
            change_reason=change_reason,
        )
        
        self._versions[version_id] = version
        self._version_order.append(version_id)
        self._active_version_id = version_id
        
        return version
    
    def get_active_version(self) -> Optional[ParameterVersion]:
        """获取当前活跃版本"""
        if self._active_version_id is None:
            return None
        return self._versions.get(self._active_version_id)
    
    def get_version(self, version_id: str) -> Optional[ParameterVersion]:
        """获取指定版本"""
        return self._versions.get(version_id)
    
    def list_versions(self) -> List[ParameterVersion]:
        """列出所有版本"""
        return [self._versions[vid] for vid in self._version_order]
    
    def set_active_version(self, version_id: str) -> None:
        """设置活跃版本"""
        if version_id not in self._versions:
            raise ValueError(f"版本不存在: {version_id}")
        self._active_version_id = version_id
    
    def compare_versions(
        self,
        version_id1: str,
        version_id2: str,
    ) -> List[ParameterChange]:
        """比较两个版本，找出所有参数变更"""
        v1 = self._versions.get(version_id1)
        v2 = self._versions.get(version_id2)
        
        if v1 is None or v2 is None:
            raise ValueError("版本不存在")
        
        changes: List[ParameterChange] = []
        all_params = set(v1.parameters.keys()) | set(v2.parameters.keys())
        
        for param in sorted(all_params):
            old_val = v1.parameters.get(param)
            new_val = v2.parameters.get(param)
            
            if param not in v1.parameters:
                change_type = "新增"
                description = f"新增参数 '{param}'，值为 {new_val}"
            elif param not in v2.parameters:
                change_type = "删除"
                description = f"删除参数 '{param}'，原值为 {old_val}"
            elif old_val != new_val:
                change_type = "修改"
                description = f"参数 '{param}' 从 {old_val} 改为 {new_val}"
            else:
                continue
            
            changes.append(ParameterChange(
                param_name=param,
                old_value=old_val,
                new_value=new_val,
                change_type=change_type,
                description=description,
            ))
        
        return changes
    
    def get_version_timeline(self) -> List[Dict[str, Any]]:
        """获取版本时间线 - 供非技术人员查看历史"""
        timeline = []
        for i, vid in enumerate(self._version_order):
            v = self._versions[vid]
            changes = []
            if v.parent_version_id:
                changes = [c.description for c in self.compare_versions(v.parent_version_id, vid)]
            
            timeline.append({
                "step": i + 1,
                "version_name": v.version_name,
                "version_id": v.version_id,
                "created_at": v.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "created_by": v.created_by,
                "source": v.source.source_name,
                "change_description": v.change_description,
                "change_reason": v.change_reason,
                "changes": changes,
                "is_active": vid == self._active_version_id,
            })
        return timeline
    
    def trace_parameter_origin(self, param_name: str) -> List[Dict[str, Any]]:
        """
        追溯参数的所有历史变更
        坏数据影响结果时，接手的人能顺着提示回到原始对象
        """
        history = []
        for vid in self._version_order:
            v = self._versions[vid]
            if param_name in v.parameters:
                history.append({
                    "version_name": v.version_name,
                    "version_id": v.version_id,
                    "value": v.parameters[param_name],
                    "source_type": v.source.source_type,
                    "source_id": v.source.source_id,
                    "source_name": v.source.source_name,
                    "raw_data": v.source.raw_data,
                    "created_at": v.created_at.isoformat(),
                    "created_by": v.created_by,
                })
        return history
    
    def export_to_dataframe(self) -> pd.DataFrame:
        """导出参数表为DataFrame，保留版本信息"""
        records = []
        for vid in self._version_order:
            v = self._versions[vid]
            for param_name, param_value in v.parameters.items():
                records.append({
                    "版本名称": v.version_name,
                    "版本ID": v.version_id,
                    "参数名称": param_name,
                    "参数值": param_value,
                    "创建时间": v.created_at,
                    "创建人": v.created_by,
                    "来源类型": v.source.source_type,
                    "来源ID": v.source.source_id,
                    "来源名称": v.source.source_name,
                    "变更描述": v.change_description,
                    "变更原因": v.change_reason,
                })
        return pd.DataFrame(records)
    
    def save(self, filepath: str) -> None:
        """保存参数管理器状态"""
        data = {
            "project_name": self.project_name,
            "active_version_id": self._active_version_id,
            "version_order": self._version_order,
            "versions": {vid: v.to_dict() for vid, v in self._versions.items()},
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @classmethod
    def load(cls, filepath: str) -> "ParameterManager":
        """从文件加载参数管理器"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        manager = cls(project_name=data["project_name"])
        manager._active_version_id = data["active_version_id"]
        manager._version_order = data["version_order"]
        
        for vid, v_data in data["versions"].items():
            source = ParameterSource(
                source_type=v_data["source"]["source_type"],
                source_id=v_data["source"]["source_id"],
                source_name=v_data["source"]["source_name"],
                raw_data=v_data["source"]["raw_data"],
                imported_at=datetime.fromisoformat(v_data["source"]["imported_at"]),
                notes=v_data["source"]["notes"],
            )
            version = ParameterVersion(
                version_id=v_data["version_id"],
                version_name=v_data["version_name"],
                parameters=v_data["parameters"],
                parent_version_id=v_data["parent_version_id"],
                source=source,
                created_by=v_data["created_by"],
                created_at=datetime.fromisoformat(v_data["created_at"]),
                change_description=v_data["change_description"],
                change_reason=v_data["change_reason"],
            )
            manager._versions[vid] = version
        
        return manager
