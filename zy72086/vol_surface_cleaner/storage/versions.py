import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid

from core.models import ParameterVersion


class VersionManager:
    def __init__(self, storage_dir: str = None, base_path: str = None):
        if base_path is not None:
            storage_dir = base_path
        if storage_dir is None:
            storage_dir = os.path.join(os.path.dirname(__file__), '..', 'storage')
        self.storage_dir = os.path.abspath(storage_dir)
        os.makedirs(self.storage_dir, exist_ok=True)
        self.versions_file = os.path.join(self.storage_dir, 'versions.json')
        self._init_storage()

    def _init_storage(self):
        if not os.path.exists(self.versions_file):
            with open(self.versions_file, 'w', encoding='utf-8') as f:
                json.dump({'versions': [], 'exports': []}, f, ensure_ascii=False, indent=2)

    def _load_all(self) -> Dict[str, Any]:
        os.makedirs(os.path.dirname(self.versions_file), exist_ok=True)
        if not os.path.exists(self.versions_file):
            self._init_storage()
        with open(self.versions_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_all(self, data: Dict[str, Any]):
        os.makedirs(os.path.dirname(self.versions_file), exist_ok=True)
        with open(self.versions_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_version(self, surface_id: str, version_data: Dict[str, Any],
                     comment: str = "") -> str:
        data = self._load_all()
        version_id = f"v{str(uuid.uuid4())[:8]}"
        version_record = {
            'version_id': version_id,
            'surface_id': surface_id,
            'created_at': datetime.now().isoformat(),
            'comment': comment,
            'data': version_data
        }
        data['versions'].append(version_record)
        self._save_all(data)
        return version_id

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        data = self._load_all()
        for v in data['versions']:
            if v['version_id'] == version_id:
                return v
        return None

    def list_versions(self, surface_id: str = None) -> List[Dict[str, Any]]:
        data = self._load_all()
        versions = data['versions']
        if surface_id:
            versions = [v for v in versions if v['surface_id'] == surface_id]
        return sorted(versions, key=lambda x: x['created_at'], reverse=True)

    def get_versions(self, surface_id: str = None) -> List[Dict[str, Any]]:
        return self.list_versions(surface_id)

    def compare_versions(self, version_id1: str, version_id2: str) -> Dict[str, Any]:
        v1 = self.get_version(version_id1)
        v2 = self.get_version(version_id2)

        if not v1 or not v2:
            return {'error': 'Version not found'}

        diff = {
            'version1': version_id1,
            'version2': version_id2,
            'surface_id': v1['surface_id'],
            'created_at1': v1['created_at'],
            'created_at2': v2['created_at'],
            'differences': []
        }

        d1 = v1.get('data', {})
        d2 = v2.get('data', {})

        all_keys = set(d1.keys()) | set(d2.keys())
        for key in all_keys:
            val1 = d1.get(key)
            val2 = d2.get(key)
            if val1 != val2:
                diff['differences'].append({
                    'key': key,
                    'value1': val1,
                    'value2': val2
                })

        return diff

    def export_version(self, version_id: str, export_path: str) -> str:
        version = self.get_version(version_id)
        if not version:
            raise ValueError(f"Version {version_id} not found")

        os.makedirs(os.path.dirname(os.path.abspath(export_path)), exist_ok=True)
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(version, f, ensure_ascii=False, indent=2)

        data = self._load_all()
        data['exports'].append({
            'version_id': version_id,
            'export_path': os.path.abspath(export_path),
            'exported_at': datetime.now().isoformat()
        })
        self._save_all(data)

        return export_path

    def rollback_to_version(self, surface_id: str, version_id: str) -> bool:
        version = self.get_version(version_id)
        if not version or version['surface_id'] != surface_id:
            return False

        new_version_id = self.save_version(
            surface_id,
            version.get('data', {}),
            f"Rollback to {version_id}"
        )
        return True

    def clear_all(self):
        self._save_all({'versions': [], 'exports': []})
