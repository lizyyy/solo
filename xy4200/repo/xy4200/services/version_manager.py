from typing import Dict, List, Any, Optional, TypeVar, Type
from datetime import datetime
import json

from app import db
from models import Version, Pottery, SpliceGroup


T = TypeVar('T', Pottery, SpliceGroup)


class VersionManager:
    
    @staticmethod
    def create_version(entity: T, entity_type: str, 
                       change_reason: str = '',
                       created_by: Optional[str] = None) -> Version:
        entity_id = getattr(entity, 'pottery_id', None) or getattr(entity, 'group_id', None)
        if not entity_id:
            raise ValueError('实体缺少 pottery_id 或 group_id')
        
        current_version = getattr(entity, 'version', 1)
        
        entity_data = entity.to_dict() if hasattr(entity, 'to_dict') else {}
        if 'issues' in entity_data:
            entity_data.pop('issues', None)
        
        version = Version(
            entity_type=entity_type,
            entity_id=entity_id,
            version_number=current_version,
            data=json.dumps(entity_data, ensure_ascii=False, default=str),
            created_by=created_by,
            change_reason=change_reason
        )
        
        db.session.add(version)
        
        entity.version = current_version + 1
        
        return version
    
    @staticmethod
    def get_versions(entity_type: str, entity_id: str) -> List[Version]:
        return Version.query.filter_by(
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by(Version.version_number.desc()).all()
    
    @staticmethod
    def get_version(entity_type: str, entity_id: str, 
                   version_number: int) -> Optional[Version]:
        return Version.query.filter_by(
            entity_type=entity_type,
            entity_id=entity_id,
            version_number=version_number
        ).first()
    
    @staticmethod
    def get_latest_version(entity_type: str, entity_id: str) -> Optional[Version]:
        return Version.query.filter_by(
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by(Version.version_number.desc()).first()
    
    @staticmethod
    def compare_versions(entity_type: str, entity_id: str,
                        version1: int, version2: int) -> Dict[str, Any]:
        v1 = VersionManager.get_version(entity_type, entity_id, version1)
        v2 = VersionManager.get_version(entity_type, entity_id, version2)
        
        if not v1 or not v2:
            return {
                'error': '无法找到指定版本',
                'versions_found': bool(v1) or bool(v2)
            }
        
        try:
            data1 = json.loads(v1.data) if v1.data else {}
            data2 = json.loads(v2.data) if v2.data else {}
        except json.JSONDecodeError:
            return {'error': '版本数据解析失败'}
        
        all_keys = set(data1.keys()) | set(data2.keys())
        added = []
        removed = []
        modified = []
        
        for key in all_keys:
            in_v1 = key in data1
            in_v2 = key in data2
            
            if in_v1 and not in_v2:
                removed.append({
                    'field': key,
                    'old_value': data1[key]
                })
            elif not in_v1 and in_v2:
                added.append({
                    'field': key,
                    'new_value': data2[key]
                })
            else:
                if data1[key] != data2[key]:
                    modified.append({
                        'field': key,
                        'old_value': data1[key],
                        'new_value': data2[key]
                    })
        
        return {
            'entity_type': entity_type,
            'entity_id': entity_id,
            'version1': version1,
            'version2': version2,
            'v1_created_at': v1.created_at.isoformat() if v1.created_at else None,
            'v2_created_at': v2.created_at.isoformat() if v2.created_at else None,
            'added': added,
            'removed': removed,
            'modified': modified,
            'summary': {
                'total_changes': len(added) + len(removed) + len(modified),
                'added_count': len(added),
                'removed_count': len(removed),
                'modified_count': len(modified)
            }
        }
    
    @staticmethod
    def restore_version(entity: T, entity_type: str,
                        version_number: int,
                        restored_by: Optional[str] = None) -> Optional[T]:
        version = VersionManager.get_version(entity_type, 
                                             getattr(entity, 'pottery_id', None) or 
                                             getattr(entity, 'group_id', None),
                                             version_number)
        
        if not version:
            return None
        
        try:
            version_data = json.loads(version.data) if version.data else {}
        except json.JSONDecodeError:
            return None
        
        for key, value in version_data.items():
            if hasattr(entity, key) and key not in ['id', 'version', 'created_at', 'updated_at']:
                setattr(entity, key, value)
        
        VersionManager.create_version(
            entity, entity_type,
            change_reason=f'从版本 v{version_number} 恢复',
            created_by=restored_by
        )
        
        return entity
    
    @staticmethod
    def get_version_history(entity_type: str, entity_id: str,
                           limit: int = 20) -> List[Dict[str, Any]]:
        versions = Version.query.filter_by(
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by(Version.version_number.desc()).limit(limit).all()
        
        history = []
        for version in versions:
            try:
                data = json.loads(version.data) if version.data else {}
            except json.JSONDecodeError:
                data = {}
            
            history.append({
                'version_number': version.version_number,
                'created_at': version.created_at.isoformat() if version.created_at else None,
                'created_by': version.created_by,
                'change_reason': version.change_reason,
                'data_keys': list(data.keys())[:10] if data else []
            })
        
        return history
