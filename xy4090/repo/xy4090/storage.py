import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from uuid import uuid4

from models import ConferenceProject


class StorageManager:
    APP_NAME = "flashcard_timeline"
    
    def __init__(self, custom_data_dir: Optional[str] = None):
        self.data_dir = self._get_data_dir(custom_data_dir)
        self.projects_dir = self.data_dir / "projects"
        self.backups_dir = self.data_dir / "backups"
        self.temp_dir = self.data_dir / "temp"
        
        self._ensure_directories()
    
    def _get_data_dir(self, custom_dir: Optional[str]) -> Path:
        if custom_dir:
            return Path(custom_dir).expanduser()
        
        home = Path.home()
        if os.name == "nt":
            app_data = os.environ.get("APPDATA", home)
            return Path(app_data) / self.APP_NAME
        else:
            return home / ".local" / "share" / self.APP_NAME
    
    def _ensure_directories(self) -> None:
        for directory in [self.data_dir, self.projects_dir, self.backups_dir, self.temp_dir]:
            directory.mkdir(parents=True, exist_ok=True)
    
    def save_project(self, project: ConferenceProject, create_backup: bool = True) -> bool:
        try:
            project.updated_at = datetime.now()
            
            project_file = self.projects_dir / f"{project.id}.json"
            temp_file = self.temp_dir / f"{project.id}_{uuid4().hex[:8]}.tmp"
            
            project_dict = project.to_dict()
            
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(project_dict, f, ensure_ascii=False, indent=2)
            
            if create_backup and project_file.exists():
                backup_name = f"{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json.bak"
                backup_path = self.backups_dir / backup_name
                shutil.copy2(project_file, backup_path)
                
                self._cleanup_old_backups(project.id)
            
            shutil.move(str(temp_file), str(project_file))
            
            self._update_project_index(project)
            
            return True
            
        except Exception as e:
            print(f"Error saving project: {e}")
            return False
    
    def _cleanup_old_backups(self, project_id: str, keep_count: int = 10) -> None:
        try:
            backups = sorted(
                self.backups_dir.glob(f"{project_id}_*.json.bak"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
            
            for old_backup in backups[keep_count:]:
                old_backup.unlink()
                
        except Exception as e:
            print(f"Error cleaning up backups: {e}")
    
    def load_project(self, project_id: str) -> Optional[ConferenceProject]:
        try:
            project_file = self.projects_dir / f"{project_id}.json"
            
            if not project_file.exists():
                return None
            
            with open(project_file, "r", encoding="utf-8") as f:
                project_dict = json.load(f)
            
            return ConferenceProject.from_dict(project_dict)
            
        except Exception as e:
            print(f"Error loading project: {e}")
            return self._try_load_from_backup(project_id)
    
    def _try_load_from_backup(self, project_id: str) -> Optional[ConferenceProject]:
        try:
            backups = sorted(
                self.backups_dir.glob(f"{project_id}_*.json.bak"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
            
            for backup in backups:
                try:
                    with open(backup, "r", encoding="utf-8") as f:
                        project_dict = json.load(f)
                    return ConferenceProject.from_dict(project_dict)
                except Exception:
                    continue
            
            return None
            
        except Exception as e:
            print(f"Error loading from backup: {e}")
            return None
    
    def delete_project(self, project_id: str) -> bool:
        try:
            project_file = self.projects_dir / f"{project_id}.json"
            
            if project_file.exists():
                backup_name = f"{project_id}_deleted_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json.bak"
                backup_path = self.backups_dir / backup_name
                shutil.copy2(project_file, backup_path)
                
                project_file.unlink()
            
            self._remove_from_project_index(project_id)
            
            return True
            
        except Exception as e:
            print(f"Error deleting project: {e}")
            return False
    
    def list_projects(self) -> List[Dict[str, Any]]:
        index_file = self.data_dir / "project_index.json"
        
        if not index_file.exists():
            return self._rebuild_project_index()
        
        try:
            with open(index_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return self._rebuild_project_index()
    
    def _update_project_index(self, project: ConferenceProject) -> None:
        projects = self.list_projects()
        
        project_info = {
            "id": project.id,
            "name": project.name,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "term_count": len(project.terms),
            "agenda_count": len(project.agenda),
            "mark_count": len(project.marks)
        }
        
        updated = False
        for i, p in enumerate(projects):
            if p["id"] == project.id:
                projects[i] = project_info
                updated = True
                break
        
        if not updated:
            projects.append(project_info)
        
        projects.sort(key=lambda x: x["updated_at"], reverse=True)
        
        index_file = self.data_dir / "project_index.json"
        temp_file = self.temp_dir / f"index_{uuid4().hex[:8]}.tmp"
        
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(projects, f, ensure_ascii=False, indent=2)
            shutil.move(str(temp_file), str(index_file))
        except Exception as e:
            print(f"Error updating project index: {e}")
    
    def _remove_from_project_index(self, project_id: str) -> None:
        projects = self.list_projects()
        projects = [p for p in projects if p["id"] != project_id]
        
        index_file = self.data_dir / "project_index.json"
        
        try:
            with open(index_file, "w", encoding="utf-8") as f:
                json.dump(projects, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error removing from project index: {e}")
    
    def _rebuild_project_index(self) -> List[Dict[str, Any]]:
        projects = []
        
        for project_file in self.projects_dir.glob("*.json"):
            try:
                with open(project_file, "r", encoding="utf-8") as f:
                    project_dict = json.load(f)
                
                projects.append({
                    "id": project_dict.get("id", project_file.stem),
                    "name": project_dict.get("name", "未命名项目"),
                    "created_at": project_dict.get("created_at", ""),
                    "updated_at": project_dict.get("updated_at", ""),
                    "term_count": len(project_dict.get("terms", [])),
                    "agenda_count": len(project_dict.get("agenda", [])),
                    "mark_count": len(project_dict.get("marks", []))
                })
            except Exception:
                continue
        
        projects.sort(key=lambda x: x["updated_at"], reverse=True)
        
        index_file = self.data_dir / "project_index.json"
        try:
            with open(index_file, "w", encoding="utf-8") as f:
                json.dump(projects, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        
        return projects
    
    def export_project_to_file(self, project_id: str, export_path: str) -> bool:
        try:
            project_file = self.projects_dir / f"{project_id}.json"
            
            if not project_file.exists():
                return False
            
            shutil.copy2(project_file, export_path)
            return True
            
        except Exception as e:
            print(f"Error exporting project: {e}")
            return False
    
    def import_project_from_file(self, import_path: str) -> Optional[str]:
        try:
            with open(import_path, "r", encoding="utf-8") as f:
                project_dict = json.load(f)
            
            project = ConferenceProject.from_dict(project_dict)
            project.id = str(uuid4())
            project.created_at = datetime.now()
            project.updated_at = datetime.now()
            
            if self.save_project(project, create_backup=False):
                return project.id
            return None
            
        except Exception as e:
            print(f"Error importing project: {e}")
            return None
    
    def get_data_directory(self) -> str:
        return str(self.data_dir)
    
    def get_projects_directory(self) -> str:
        return str(self.projects_dir)
    
    def get_backups_directory(self) -> str:
        return str(self.backups_dir)
    
    def cleanup_temp_files(self, older_than_hours: int = 24) -> int:
        try:
            import time as time_module
            cutoff = time_module.time() - (older_than_hours * 3600)
            deleted_count = 0
            
            for temp_file in self.temp_dir.iterdir():
                if temp_file.is_file() and temp_file.stat().st_mtime < cutoff:
                    temp_file.unlink()
                    deleted_count += 1
            
            return deleted_count
            
        except Exception as e:
            print(f"Error cleaning up temp files: {e}")
            return 0


class QuickSaveManager:
    def __init__(self, storage: StorageManager):
        self.storage = storage
        self._auto_save_interval: int = 60
        self._last_save: Optional[datetime] = None
        self._pending_project: Optional[ConferenceProject] = None
    
    def mark_dirty(self, project: ConferenceProject) -> None:
        self._pending_project = project
    
    def auto_save_if_needed(self) -> bool:
        if not self._pending_project:
            return False
        
        now = datetime.now()
        
        if self._last_save is None:
            should_save = True
        else:
            elapsed = (now - self._last_save).total_seconds()
            should_save = elapsed >= self._auto_save_interval
        
        if should_save:
            success = self.storage.save_project(self._pending_project, create_backup=False)
            if success:
                self._last_save = now
                self._pending_project = None
            return success
        
        return False
    
    def force_save(self) -> bool:
        if not self._pending_project:
            return True
        
        success = self.storage.save_project(self._pending_project, create_backup=True)
        if success:
            self._last_save = datetime.now()
            self._pending_project = None
        return success
    
    def set_auto_save_interval(self, seconds: int) -> None:
        self._auto_save_interval = max(10, seconds)
