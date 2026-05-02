#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
持久化模块
处理彩排方案的本地保存和加载
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from .models import RehearsalPlan


class PlanPersistence:
    """方案持久化管理器"""
    
    FILE_EXTENSION = ".micplan"
    DEFAULT_SAVE_DIR = "rehearsal_plans"
    
    def __init__(self, save_dir: Optional[str] = None):
        if save_dir is None:
            home = Path.home()
            self.save_dir = home / "无线麦频率彩排台" / self.DEFAULT_SAVE_DIR
        else:
            self.save_dir = Path(save_dir)
        
        self.save_dir.mkdir(parents=True, exist_ok=True)
    
    def save_plan(self, plan: RehearsalPlan, filepath: Optional[str] = None) -> str:
        """保存彩排方案到文件"""
        plan.updated_at = datetime.now()
        
        if filepath is None:
            safe_name = "".join(c for c in plan.name if c.isalnum() or c in " -_")
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{safe_name}_{timestamp}{self.FILE_EXTENSION}"
            filepath = str(self.save_dir / filename)
        
        data = plan.to_dict()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def load_plan(self, filepath: str) -> RehearsalPlan:
        """从文件加载彩排方案"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return RehearsalPlan.from_dict(data)
    
    def list_saved_plans(self) -> List[dict]:
        """列出所有保存的方案"""
        plans = []
        
        if not self.save_dir.exists():
            return plans
        
        for filepath in self.save_dir.glob(f"*{self.FILE_EXTENSION}"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                plans.append({
                    "filepath": str(filepath),
                    "name": data.get("name", "未命名方案"),
                    "created_at": data.get("created_at", ""),
                    "updated_at": data.get("updated_at", ""),
                    "mic_count": len(data.get("microphones", [])),
                    "scene_count": len(data.get("schedule", []))
                })
            except (json.JSONDecodeError, IOError):
                continue
        
        return sorted(plans, key=lambda x: x["updated_at"], reverse=True)
    
    def delete_plan(self, filepath: str) -> bool:
        """删除保存的方案"""
        try:
            path = Path(filepath)
            if path.exists():
                path.unlink()
                return True
        except Exception:
            pass
        return False
    
    def get_auto_save_path(self) -> str:
        """获取自动保存路径"""
        autosave_dir = self.save_dir / "autosave"
        autosave_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return str(autosave_dir / f"autosave_{timestamp}{self.FILE_EXTENSION}")
    
    def cleanup_old_autosaves(self, keep_count: int = 10):
        """清理旧的自动保存文件"""
        autosave_dir = self.save_dir / "autosave"
        if not autosave_dir.exists():
            return
        
        autosaves = list(autosave_dir.glob(f"*{self.FILE_EXTENSION}"))
        autosaves.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        for old_save in autosaves[keep_count:]:
            try:
                old_save.unlink()
            except Exception:
                pass
