import json
import os
import glob
from datetime import datetime
from typing import Dict, Any, Optional


class ParamsManager:
    def __init__(self, config_dir: str = "config"):
        self.config_dir = config_dir
        self.params_history: Dict[str, Dict[str, Any]] = {}
        self.active_version: Optional[str] = None
        self._load_all_versions()

    def _load_all_versions(self) -> None:
        param_files = glob.glob(os.path.join(self.config_dir, "params_v*.json"))
        for fpath in sorted(param_files):
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                version = data.get('version')
                if version:
                    self.params_history[version] = {
                        'data': data,
                        'file_path': fpath,
                        'loaded_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
        if self.params_history:
            self.active_version = sorted(self.params_history.keys())[-1]

    def get_active_params(self) -> Dict[str, Any]:
        if not self.active_version or self.active_version not in self.params_history:
            raise ValueError("未找到任何参数配置版本")
        return self.params_history[self.active_version]['data']

    def get_params(self, version: str) -> Optional[Dict[str, Any]]:
        if version not in self.params_history:
            return None
        return self.params_history[version]['data']

    def list_versions(self) -> list:
        versions = []
        for v in sorted(self.params_history.keys()):
            info = self.params_history[v]
            versions.append({
                'version': v,
                'note': info['data'].get('version_note', ''),
                'created_by': info['data'].get('created_by', ''),
                'created_at': info['data'].get('created_at', ''),
                'loaded_at': info['loaded_at'],
                'is_active': v == self.active_version
            })
        return versions

    def set_active_version(self, version: str) -> bool:
        if version in self.params_history:
            self.active_version = version
            return True
        return False

    def get_threshold(self, key: str) -> Optional[float]:
        params = self.get_active_params()
        return params.get('thresholds', {}).get(key)

    def get_thresholds(self) -> Dict[str, float]:
        return self.get_active_params().get('thresholds', {})

    def get_deduction_config(self) -> Dict[str, Any]:
        return self.get_active_params().get('deduction', {})

    def create_new_version(self, new_params: Dict[str, Any], note: str, created_by: str) -> str:
        existing_versions = sorted(self.params_history.keys())
        if existing_versions:
            last_num = int(existing_versions[-1].replace('v', ''))
            new_version = f"v{last_num + 1}"
        else:
            new_version = "v1"

        new_params['version'] = new_version
        new_params['version_note'] = note
        new_params['created_by'] = created_by
        new_params['created_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        fpath = os.path.join(self.config_dir, f"params_{new_version}.json")
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(new_params, f, ensure_ascii=False, indent=4)

        self.params_history[new_version] = {
            'data': new_params,
            'file_path': fpath,
            'loaded_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self.active_version = new_version
        return new_version

    def get_active_version_info(self) -> Dict[str, Any]:
        if not self.active_version:
            return {}
        info = self.params_history[self.active_version]
        return {
            'version': self.active_version,
            'note': info['data'].get('version_note', ''),
            'created_by': info['data'].get('created_by', ''),
            'created_at': info['data'].get('created_at', ''),
            'loaded_at': info['loaded_at']
        }

    def compare_versions(self, v1: str, v2: str) -> Dict[str, Any]:
        p1 = self.get_params(v1)
        p2 = self.get_params(v2)
        if not p1 or not p2:
            return {'error': '版本不存在'}

        diff = {'thresholds': {}, 'deduction': {}}
        for key in set(list(p1['thresholds'].keys()) + list(p2['thresholds'].keys())):
            old = p1['thresholds'].get(key)
            new = p2['thresholds'].get(key)
            if old != new:
                diff['thresholds'][key] = {'old': old, 'new': new}

        for key in set(list(p1['deduction'].keys()) + list(p2['deduction'].keys())):
            old = p1['deduction'].get(key)
            new = p2['deduction'].get(key)
            if old != new:
                diff['deduction'][key] = {'old': old, 'new': new}

        return diff
