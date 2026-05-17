#!/usr/bin/env python3
"""快照管理模块 - 负责快照的保存、加载和列表管理"""

import os
import json
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import asdict

from .scanner import PermissionEntry


class SnapshotManager:
    """快照管理器"""

    def __init__(self, snapshot_dir: str = ".perm-snapshots"):
        self.snapshot_dir = snapshot_dir
        os.makedirs(snapshot_dir, exist_ok=True)

    def _entry_to_dict(self, entry: PermissionEntry) -> Dict[str, Any]:
        """将权限条目转换为字典"""
        return asdict(entry)

    def save_snapshot(self, name: str, entries: List[PermissionEntry], 
                      errors: List[Dict], metadata: Dict = None) -> str:
        """保存快照到文件
        
        Args:
            name: 快照名称
            entries: 权限条目列表
            errors: 错误列表
            metadata: 额外的元数据
            
        Returns:
            保存的快照文件路径
        """
        timestamp = datetime.now().isoformat()
        snapshot_data = {
            "name": name,
            "timestamp": timestamp,
            "metadata": metadata or {},
            "entries": [self._entry_to_dict(e) for e in entries],
            "errors": errors
        }
        
        # 生成文件名，包含时间戳
        filename = f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(self.snapshot_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(snapshot_data, f, indent=2, ensure_ascii=False)
        
        return filepath

    def load_snapshot(self, filepath: str) -> Dict:
        """加载快照文件
        
        Args:
            filepath: 快照文件路径
            
        Returns:
            快照数据字典
        """
        # 如果文件不存在且不是绝对路径，尝试在快照目录中查找
        if not os.path.exists(filepath) and not os.path.isabs(filepath):
            filepath = os.path.join(self.snapshot_dir, filepath)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def list_snapshots(self) -> List[str]:
        """列出所有快照文件
        
        Returns:
            快照文件名列表，按时间排序
        """
        if not os.path.exists(self.snapshot_dir):
            return []
        
        snapshots = [f for f in os.listdir(self.snapshot_dir) if f.endswith('.json')]
        return sorted(snapshots)

    def get_latest_snapshot(self, name_prefix: str = None) -> str:
        """获取最新的快照文件
        
        Args:
            name_prefix: 可选的名称前缀过滤
            
        Returns:
            最新快照文件名，如果没有则返回None
        """
        snapshots = self.list_snapshots()
        if name_prefix:
            snapshots = [s for s in snapshots if s.startswith(name_prefix)]
        
        return snapshots[-1] if snapshots else None

    def get_snapshot_path(self, name_or_path: str) -> str:
        """获取快照的完整路径
        
        Args:
            name_or_path: 快照名称或路径
            
        Returns:
            快照的完整路径
        """
        if os.path.exists(name_or_path):
            return name_or_path
        
        # 尝试作为快照目录中的文件名
        full_path = os.path.join(self.snapshot_dir, name_or_path)
        if os.path.exists(full_path):
            return full_path
        
        # 尝试查找匹配前缀的最新快照
        latest = self.get_latest_snapshot(name_or_path)
        if latest:
            return os.path.join(self.snapshot_dir, latest)
        
        return None
