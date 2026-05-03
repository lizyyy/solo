# -*- coding: utf-8 -*-
import os
import json
from datetime import datetime

class StorageManager:
    def __init__(self, storage_dir):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
    
    def _get_project_path(self, project_id):
        return os.path.join(self.storage_dir, f'{project_id}.json')
    
    def list_projects(self):
        projects = []
        if not os.path.exists(self.storage_dir):
            return projects
        
        for filename in os.listdir(self.storage_dir):
            if filename.endswith('.json') and not filename.startswith('temp_'):
                try:
                    filepath = os.path.join(self.storage_dir, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        project = json.load(f)
                    
                    projects.append({
                        'id': project.get('id'),
                        'name': project.get('name'),
                        'description': project.get('description', ''),
                        'created_at': project.get('created_at'),
                        'updated_at': project.get('updated_at'),
                        'has_data': project.get('data') is not None,
                        'has_clusters': len(project.get('clusters', [])) > 0,
                        'original_filename': project.get('original_filename')
                    })
                except Exception:
                    continue
        
        projects.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
        return projects
    
    def load_project(self, project_id):
        filepath = self._get_project_path(project_id)
        if not os.path.exists(filepath):
            return None
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None
    
    def save_project(self, project):
        project['updated_at'] = datetime.now().isoformat()
        filepath = self._get_project_path(project['id'])
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(project, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False
    
    def delete_project(self, project_id):
        filepath = self._get_project_path(project_id)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                return True
            except Exception:
                return False
        return False
