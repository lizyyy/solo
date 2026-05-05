#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
殡仪服务站本地存储
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, Optional
import hashlib


class LocalStorage:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            self.data_dir = os.path.join(os.path.expanduser("~"), ".funeral_review")
        else:
            self.data_dir = data_dir
        
        self.data_file = os.path.join(self.data_dir, "data.json")
        self.backup_dir = os.path.join(self.data_dir, "backups")
        
        self._ensure_directories()
    
    def _ensure_directories(self) -> None:
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir, exist_ok=True)
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir, exist_ok=True)
    
    def save(self, data: Dict[str, Any]) -> None:
        self._create_backup()
        
        save_data = {
            'version': '1.0',
            'saved_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'data': data,
            'checksum': self._calculate_checksum(data)
        }
        
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    def load(self) -> Optional[Dict[str, Any]]:
        if not os.path.exists(self.data_file):
            return None
        
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                save_data = json.load(f)
            
            if self._verify_checksum(save_data):
                return save_data.get('data', {})
            else:
                return self._try_load_backup()
        except (json.JSONDecodeError, IOError) as e:
            print(f"加载数据失败: {e}")
            return self._try_load_backup()
    
    def _create_backup(self) -> None:
        if not os.path.exists(self.data_file):
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"data_backup_{timestamp}.json"
        backup_path = os.path.join(self.backup_dir, backup_filename)
        
        try:
            with open(self.data_file, 'r', encoding='utf-8') as src:
                data = json.load(src)
            
            with open(backup_path, 'w', encoding='utf-8') as dst:
                json.dump(data, dst, ensure_ascii=False, indent=2)
            
            self._cleanup_old_backups()
        except Exception as e:
            print(f"创建备份失败: {e}")
    
    def _try_load_backup(self) -> Optional[Dict[str, Any]]:
        backups = self._list_backups()
        if not backups:
            return None
        
        latest_backup = backups[-1]
        backup_path = os.path.join(self.backup_dir, latest_backup)
        
        try:
            with open(backup_path, 'r', encoding='utf-8') as f:
                save_data = json.load(f)
            return save_data.get('data', {})
        except Exception as e:
            print(f"从备份加载失败: {e}")
            return None
    
    def _list_backups(self) -> list:
        if not os.path.exists(self.backup_dir):
            return []
        
        backups = [f for f in os.listdir(self.backup_dir) 
                   if f.startswith('data_backup_') and f.endswith('.json')]
        return sorted(backups)
    
    def _cleanup_old_backups(self, max_backups: int = 10) -> None:
        backups = self._list_backups()
        if len(backups) > max_backups:
            for backup in backups[:-max_backups]:
                try:
                    os.remove(os.path.join(self.backup_dir, backup))
                except Exception as e:
                    print(f"删除旧备份失败: {e}")
    
    def _calculate_checksum(self, data: Dict[str, Any]) -> str:
        data_str = json.dumps(data, sort_keys=True, ensure_ascii=True)
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()
    
    def _verify_checksum(self, save_data: Dict[str, Any]) -> bool:
        data = save_data.get('data', {})
        saved_checksum = save_data.get('checksum', '')
        calculated_checksum = self._calculate_checksum(data)
        return saved_checksum == calculated_checksum
    
    def get_data_path(self) -> str:
        return self.data_file
    
    def get_backup_path(self) -> str:
        return self.backup_dir
    
    def export_to_file(self, data: Dict[str, Any], file_path: str) -> None:
        export_data = {
            'version': '1.0',
            'exported_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'data': data
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
    
    def import_from_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        if not os.path.exists(file_path):
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                import_data = json.load(f)
            
            if 'data' in import_data:
                return import_data['data']
            else:
                return import_data
        except Exception as e:
            print(f"导入失败: {e}")
            return None
