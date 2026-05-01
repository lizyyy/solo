import json
import os
from typing import Optional, Dict, Any
from datetime import datetime

from models.project import Project


class ProjectManager:
    def __init__(self):
        self.current_project: Optional[Project] = None
        self.last_saved_path: Optional[str] = None

    def new_project(self, name: str = "未命名项目") -> Project:
        self.current_project = Project(name=name)
        self.last_saved_path = None
        return self.current_project

    def save_project(self, filepath: str, project: Project = None) -> bool:
        try:
            if project is None:
                project = self.current_project
            
            if project is None:
                return False
            
            project.update_timestamp()
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(project.to_dict(), f, ensure_ascii=False, indent=2)
            
            self.last_saved_path = filepath
            return True
        except Exception as e:
            print(f"保存项目失败: {e}")
            return False

    def load_project(self, filepath: str) -> Optional[Project]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self.current_project = Project.from_dict(data)
            self.last_saved_path = filepath
            return self.current_project
        except Exception as e:
            print(f"加载项目失败: {e}")
            return None

    def export_pieces_json(self, filepath: str, project: Project = None) -> bool:
        try:
            if project is None:
                project = self.current_project
            
            if project is None:
                return False
            
            export_data = {
                "version": "1.0",
                "exported_at": datetime.now().isoformat(),
                "project_name": project.name,
                "pieces": [p.to_dict() for p in project.pieces]
            }
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
            
            return True
        except Exception as e:
            print(f"导出裁片失败: {e}")
            return False

    def import_pieces_json(self, filepath: str, project: Project = None) -> int:
        try:
            if project is None:
                project = self.current_project
            
            if project is None:
                return 0
            
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            pieces_data = data.get("pieces", [])
            imported_count = 0
            
            for piece_data in pieces_data:
                from models.piece import Piece
                piece = Piece.from_dict(piece_data)
                project.add_piece(piece)
                imported_count += 1
            
            return imported_count
        except Exception as e:
            print(f"导入裁片失败: {e}")
            return 0


def save_project(project: Project, filepath: str) -> bool:
    manager = ProjectManager()
    return manager.save_project(filepath, project)


def load_project(filepath: str) -> Optional[Project]:
    manager = ProjectManager()
    return manager.load_project(filepath)
