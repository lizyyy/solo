"""JSON 持久化存储"""
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
from copy import deepcopy

from ..models.version import RehearsalPlan, VersionSnapshot
from ..models.member import Member
from ..models.seating import SeatingLayout


def get_app_data_dir() -> Path:
    """获取应用数据存储目录（跨平台）"""
    app_name = "chorus_seating_planner"
    
    if sys.platform == "darwin":
        data_dir = Path.home() / "Library" / "Application Support" / app_name
    elif sys.platform == "win32":
        data_dir = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / app_name
    else:
        data_dir = Path.home() / ".local" / "share" / app_name
    
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_plans_dir() -> Path:
    """获取排练计划存储目录"""
    plans_dir = get_app_data_dir() / "plans"
    plans_dir.mkdir(parents=True, exist_ok=True)
    return plans_dir


def get_exports_dir() -> Path:
    """获取导出目录"""
    exports_dir = get_app_data_dir() / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    return exports_dir


class PlanStorage:
    """单个排练计划的存储"""
    
    def __init__(self, plan_id: str, plans_dir: Optional[Path] = None):
        self.plan_id = plan_id
        self.plans_dir = plans_dir or get_plans_dir()
        self.plan_dir = self.plans_dir / plan_id
        self.plan_file = self.plan_dir / "plan.json"
        self.versions_dir = self.plan_dir / "versions"
    
    def _ensure_dirs(self):
        self.plan_dir.mkdir(parents=True, exist_ok=True)
        self.versions_dir.mkdir(parents=True, exist_ok=True)
    
    def save(self, plan: RehearsalPlan) -> bool:
        """保存排练计划"""
        try:
            self._ensure_dirs()
            
            plan.updated_at = datetime.now()
            
            data = plan.to_dict()
            
            with open(self.plan_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
        except Exception:
            return False
    
    def load(self) -> Optional[RehearsalPlan]:
        """加载排练计划"""
        try:
            if not self.plan_file.exists():
                return None
            
            with open(self.plan_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return RehearsalPlan.from_dict(data)
        except Exception:
            return None
    
    def save_version_snapshot(
        self,
        snapshot: VersionSnapshot,
        label: str = "",
        description: str = ""
    ) -> bool:
        """保存版本快照到独立文件"""
        try:
            self._ensure_dirs()
            
            if label:
                snapshot.label = label
            if description:
                snapshot.description = description
            
            version_file = self.versions_dir / f"v{snapshot.version_number}_{snapshot.id}.json"
            
            with open(version_file, 'w', encoding='utf-8') as f:
                json.dump(snapshot.to_dict(), f, ensure_ascii=False, indent=2)
            
            return True
        except Exception:
            return False
    
    def load_version_snapshot(self, version_number: int) -> Optional[VersionSnapshot]:
        """加载指定版本号的快照"""
        try:
            for f in self.versions_dir.glob(f"v{version_number}_*.json"):
                with open(f, 'r', encoding='utf-8') as file:
                    data = json.load(file)
                    return VersionSnapshot.from_dict(data)
            return None
        except Exception:
            return None
    
    def list_versions(self) -> List[Dict[str, Any]]:
        """列出所有版本信息"""
        versions = []
        try:
            for f in sorted(self.versions_dir.glob("v*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
                try:
                    with open(f, 'r', encoding='utf-8') as file:
                        data = json.load(file)
                        versions.append({
                            "version_number": data.get("version_number"),
                            "id": data.get("id"),
                            "label": data.get("label", ""),
                            "created_at": data.get("created_at"),
                            "is_marked": data.get("is_marked", False),
                            "is_auto_save": data.get("is_auto_save", False),
                        })
                except Exception:
                    continue
        except Exception:
            pass
        return versions
    
    def delete(self) -> bool:
        """删除整个计划"""
        try:
            import shutil
            if self.plan_dir.exists():
                shutil.rmtree(self.plan_dir)
            return True
        except Exception:
            return False


class StorageManager:
    """存储管理器"""
    
    def __init__(self):
        self.plans_dir = get_plans_dir()
        self._cache: Dict[str, PlanStorage] = {}
    
    def get_storage(self, plan_id: str) -> PlanStorage:
        """获取指定计划的存储"""
        if plan_id not in self._cache:
            self._cache[plan_id] = PlanStorage(plan_id, self.plans_dir)
        return self._cache[plan_id]
    
    def list_plans(self) -> List[Dict[str, Any]]:
        """列出所有排练计划"""
        plans = []
        try:
            for plan_dir in sorted(self.plans_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
                if not plan_dir.is_dir():
                    continue
                
                plan_file = plan_dir / "plan.json"
                if not plan_file.exists():
                    continue
                
                try:
                    with open(plan_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    plans.append({
                        "id": data.get("id"),
                        "name": data.get("name", "未命名计划"),
                        "rehearsal_date": data.get("rehearsal_date"),
                        "created_at": data.get("created_at"),
                        "updated_at": data.get("updated_at"),
                        "member_count": len(data.get("members", {})),
                        "version_count": len(data.get("version_history", {}).get("snapshots", [])),
                    })
                except Exception:
                    continue
        except Exception:
            pass
        
        return plans
    
    def create_new_plan(self, name: str = "") -> RehearsalPlan:
        """创建新排练计划"""
        from datetime import datetime
        
        plan = RehearsalPlan(
            name=name or f"排练计划 {datetime.now().strftime('%Y-%m-%d')}",
            rehearsal_date=datetime.now(),
        )
        
        layout = SeatingLayout(rows=4, cols=10)
        plan.layout = layout.to_dict()
        plan.members = {}
        
        return plan
    
    def save_plan(self, plan: RehearsalPlan, create_version: bool = True, 
                  version_label: str = "", is_auto_save: bool = False) -> bool:
        """保存计划并可选创建版本"""
        try:
            storage = self.get_storage(plan.id)
            
            if create_version and plan.version_history.snapshots:
                latest = plan.version_history.get_current_snapshot()
                if latest:
                    storage.save_version_snapshot(latest, label=version_label)
            
            return storage.save(plan)
        except Exception:
            return False
    
    def load_plan(self, plan_id: str) -> Optional[RehearsalPlan]:
        """加载计划"""
        storage = self.get_storage(plan_id)
        return storage.load()
    
    def delete_plan(self, plan_id: str) -> bool:
        """删除计划"""
        storage = self.get_storage(plan_id)
        result = storage.delete()
        if plan_id in self._cache:
            del self._cache[plan_id]
        return result


def save_rehearsal_plan(
    plan: RehearsalPlan,
    auto_save: bool = False,
    version_label: str = ""
) -> bool:
    """便捷函数：保存排练计划"""
    manager = StorageManager()
    return manager.save_plan(
        plan,
        create_version=True,
        version_label=version_label,
        is_auto_save=auto_save
    )


def load_rehearsal_plan(plan_id: str) -> Optional[RehearsalPlan]:
    """便捷函数：加载排练计划"""
    manager = StorageManager()
    return manager.load_plan(plan_id)


def list_rehearsal_plans() -> List[Dict[str, Any]]:
    """便捷函数：列出所有排练计划"""
    manager = StorageManager()
    return manager.list_plans()
