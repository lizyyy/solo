import json
import os
import shutil
import time
from pathlib import Path
from typing import List, Optional

from .config import SyncConfig
from .models import ConflictItem, ConflictType, SyncPlan, generate_timestamp_id


class ConflictManager:
    def __init__(self, config: SyncConfig):
        self.config = config
        self.quarantine_dir = Path(config.quarantine_dir)
        self._ensure_quarantine_dir()
    
    def _ensure_quarantine_dir(self) -> None:
        self.quarantine_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_quarantine_file(self, timestamp: Optional[str] = None) -> Path:
        if timestamp is None:
            timestamp = generate_timestamp_id()
        return self.quarantine_dir / f"quarantine_{timestamp}.json"
    
    def save_conflicts(self, conflicts: List[ConflictItem], timestamp: Optional[str] = None) -> str:
        if timestamp is None:
            timestamp = generate_timestamp_id()
        
        quarantine_data = {
            "version": "1.0",
            "timestamp": time.time(),
            "timestamp_id": timestamp,
            "conflicts_count": len(conflicts),
            "conflicts": [conf.to_dict() for conf in conflicts],
            "summary": self._generate_summary(conflicts),
        }
        
        quarantine_file = self._get_quarantine_file(timestamp)
        with open(quarantine_file, 'w', encoding='utf-8') as f:
            json.dump(quarantine_data, f, indent=2, ensure_ascii=False)
        
        latest_link = self.quarantine_dir / "quarantine_latest.json"
        if latest_link.exists():
            latest_link.unlink()
        try:
            latest_link.symlink_to(quarantine_file.name)
        except (OSError, AttributeError):
            shutil.copy2(quarantine_file, latest_link)
        
        return str(quarantine_file)
    
    def _generate_summary(self, conflicts: List[ConflictItem]) -> dict:
        summary = {
            "total": len(conflicts),
            "by_type": {},
        }
        
        for conf in conflicts:
            type_name = conf.conflict_type.value
            if type_name not in summary["by_type"]:
                summary["by_type"][type_name] = 0
            summary["by_type"][type_name] += 1
        
        return summary
    
    def load_conflicts(self, quarantine_file: str) -> dict:
        with open(quarantine_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def load_latest_conflicts(self) -> Optional[dict]:
        latest_file = self.quarantine_dir / "quarantine_latest.json"
        if not latest_file.exists():
            return None
        return self.load_conflicts(str(latest_file))
    
    def list_quarantine_files(self) -> List[Path]:
        if not self.quarantine_dir.exists():
            return []
        
        files = []
        for f in self.quarantine_dir.glob("quarantine_*.json"):
            if f.name != "quarantine_latest.json":
                files.append(f)
        
        files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        return files
    
    def quarantine_file_from_plan(self, plan: SyncPlan, timestamp: Optional[str] = None) -> str:
        return self.save_conflicts(plan.conflicts, timestamp)


def format_conflict_for_display(conflict: ConflictItem) -> str:
    lines = [f"冲突类型: {conflict.conflict_type.value}"]
    
    if conflict.left_file:
        lines.append(f"  左侧文件: {conflict.left_file.relative_path}")
        lines.append(f"    SHA256: {conflict.left_file.sha256}")
        lines.append(f"    大小: {conflict.left_file.size} bytes")
    
    if conflict.right_file:
        lines.append(f"  右侧文件: {conflict.right_file.relative_path}")
        lines.append(f"    SHA256: {conflict.right_file.sha256}")
        lines.append(f"    大小: {conflict.right_file.size} bytes")
    
    if conflict.suggestion:
        lines.append(f"  建议: {conflict.suggestion}")
    
    return "\n".join(lines)


def get_conflict_type_description(conflict_type: ConflictType) -> str:
    descriptions = {
        ConflictType.CASE_ONLY_DIFFERENCE: "大小写仅差异 - 不同系统对大小写敏感程度不同",
        ConflictType.SAME_PATH_DIFFERENT_CONTENT: "同路径不同内容 - 同一位置文件内容已修改",
        ConflictType.MTIME_DRIFT: "mtime漂移 - 内容相同但修改时间不同（可能是文件系统差异）",
        ConflictType.SYMLINK_ESCAPES_ROOT: "符号链接跳出根目录 - 存在安全风险",
        ConflictType.IGNORE_PATTERN_HIT: "忽略规则命中 - 文件被忽略规则过滤",
        ConflictType.RENAME_CANDIDATE: "重命名候选 - 相同内容不同路径，可能是重命名",
        ConflictType.ADD_ON_BOTH_SIDES: "两侧同时新增 - 相同路径两侧都有新增",
    }
    return descriptions.get(conflict_type, str(conflict_type))
