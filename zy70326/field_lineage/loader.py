import json
import yaml
import os
from typing import List, Dict, Optional
from datetime import datetime

from .models import (
    TableField, SQLTask, Report, APIEndpoint, Owner, 
    Confirmation, LineageConfig, NodeType
)


class DataLoader:
    def __init__(self, config: LineageConfig):
        self.config = config
    
    def _load_json(self, path: str) -> List[Dict]:
        if not os.path.exists(path):
            return []
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]
    
    def _load_yaml(self, path: str) -> List[Dict]:
        if not os.path.exists(path):
            return []
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        if data is None:
            return []
        return data if isinstance(data, list) else [data]
    
    def load_table_fields(self) -> List[TableField]:
        data = self._load_json(self.config.tables_path)
        fields = []
        for item in data:
            fields.append(TableField(
                id=item.get('id') or f"{item.get('database', 'default')}.{item['table_name']}.{item['field_name']}",
                table_name=item['table_name'],
                field_name=item['field_name'],
                description=item.get('description', ''),
                database=item.get('database', 'default')
            ))
        return fields
    
    def load_sql_tasks(self) -> List[SQLTask]:
        data = self._load_json(self.config.sql_tasks_path)
        tasks = []
        for item in data:
            created_at = None
            if item.get('created_at'):
                try:
                    created_at = datetime.fromisoformat(item['created_at'].replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    pass
            tasks.append(SQLTask(
                id=item['id'],
                name=item['name'],
                sql=item['sql'],
                owner=item.get('owner', ''),
                target_table=item.get('target_table', ''),
                target_fields=item.get('target_fields', []),
                created_at=created_at,
                parse_error=None
            ))
        return tasks
    
    def load_reports(self) -> List[Report]:
        data = self._load_json(self.config.reports_path)
        reports = []
        for item in data:
            reports.append(Report(
                id=item['id'],
                name=item['name'],
                fields=item.get('fields', []),
                derived_fields=item.get('derived_fields', {}),
                owner=item.get('owner', ''),
                dashboard=item.get('dashboard', '')
            ))
        return reports
    
    def load_apis(self) -> List[APIEndpoint]:
        data = self._load_json(self.config.api_path)
        apis = []
        for item in data:
            apis.append(APIEndpoint(
                id=item['id'],
                name=item['name'],
                field_mappings=item.get('field_mappings', {}),
                owner=item.get('owner', ''),
                path=item.get('path', '')
            ))
        return apis
    
    def load_owners(self) -> Dict[str, Owner]:
        data = self._load_json(self.config.owners_path)
        owners = {}
        for item in data:
            owners[item['id']] = Owner(
                id=item['id'],
                name=item['name'],
                email=item.get('email', ''),
                team=item.get('team', '')
            )
        return owners
    
    def load_confirmations(self) -> Dict[str, Confirmation]:
        data = self._load_json(self.config.confirmations_path)
        confirmations = {}
        for item in data:
            confirmed_at = None
            if item.get('confirmed_at'):
                try:
                    confirmed_at = datetime.fromisoformat(item['confirmed_at'].replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    pass
            confirmations[item['node_id']] = Confirmation(
                node_id=item['node_id'],
                node_type=NodeType(item['node_type']),
                confirmed=item['confirmed'],
                confirmed_at=confirmed_at,
                confirmed_by=item.get('confirmed_by', ''),
                notes=item.get('notes', '')
            )
        return confirmations
    
    def save_confirmations(self, confirmations: Dict[str, Confirmation]):
        data = []
        for conf in confirmations.values():
            data.append({
                'node_id': conf.node_id,
                'node_type': conf.node_type.value,
                'confirmed': conf.confirmed,
                'confirmed_at': conf.confirmed_at.isoformat() if conf.confirmed_at else None,
                'confirmed_by': conf.confirmed_by,
                'notes': conf.notes
            })
        os.makedirs(os.path.dirname(self.config.confirmations_path), exist_ok=True)
        with open(self.config.confirmations_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
