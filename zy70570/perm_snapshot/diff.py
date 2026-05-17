#!/usr/bin/env python3
"""差异对比模块 - 负责对比两个快照的权限差异"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple


@dataclass
class DiffResult:
    """差异结果数据类"""
    path: str
    field: str
    old_value: Any
    new_value: Any
    change_type: str


class Differ:
    """差异对比器"""

    def __init__(self):
        self.ignore_fields = {"size", "mtime"}  # 忽略的字段

    def compare(self, baseline: Dict, current: Dict) -> Tuple[List[DiffResult], List[Dict], List[Dict]]:
        """对比两个快照，返回差异
        
        Args:
            baseline: 基线快照数据
            current: 当前快照数据
            
        Returns:
            (修改的条目列表, 新增的条目列表, 删除的条目列表)
        """
        baseline_entries = {e["path"]: e for e in baseline["entries"]}
        current_entries = {e["path"]: e for e in current["entries"]}
        
        diffs = []
        added = []
        removed = []
        
        all_paths = set(baseline_entries.keys()) | set(current_entries.keys())
        
        for path in all_paths:
            if path not in baseline_entries and path in current_entries:
                # 新增的条目
                added.append(current_entries[path])
            elif path in baseline_entries and path not in current_entries:
                # 删除的条目
                removed.append(baseline_entries[path])
            else:
                # 对比每个字段
                old_entry = baseline_entries[path]
                new_entry = current_entries[path]
                
                all_fields = set(old_entry.keys()) | set(new_entry.keys())
                
                for field in all_fields:
                    if field in self.ignore_fields:
                        continue
                    old_val = old_entry.get(field)
                    new_val = new_entry.get(field)
                    if old_val != new_val:
                        diffs.append(DiffResult(
                            path=path,
                            field=field,
                            old_value=old_val,
                            new_value=new_val,
                            change_type="modified"
                        ))
        
        return diffs, added, removed

    def get_summary(self, diffs: List[DiffResult], added: List[Dict], removed: List[Dict]) -> Dict:
        """获取差异摘要
        
        Args:
            diffs: 修改的条目列表
            added: 新增的条目列表
            removed: 删除的条目列表
            
        Returns:
            摘要字典
        """
        return {
            "modified_count": len(diffs),
            "added_count": len(added),
            "removed_count": len(removed),
            "modified_paths": sorted(list(set(d.path for d in diffs))),
            "added_paths": sorted([e["path"] for e in added]),
            "removed_paths": sorted([e["path"] for e in removed])
        }
