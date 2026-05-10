import os
import json
from typing import Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
from .models import (
    AssetCard, CostCenter, DepreciationRule, DepreciationRecord,
    RecalculationVersion, DifferenceDetail, AuditLog, DecimalEncoder
)


class JSONStorage:
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = data_dir
        self._ensure_dirs()
    
    def _ensure_dirs(self):
        dirs = [
            self.data_dir,
            os.path.join(self.data_dir, 'assets'),
            os.path.join(self.data_dir, 'cost_centers'),
            os.path.join(self.data_dir, 'depreciation_rules'),
            os.path.join(self.data_dir, 'depreciation_records'),
            os.path.join(self.data_dir, 'versions'),
            os.path.join(self.data_dir, 'differences'),
            os.path.join(self.data_dir, 'audit_logs'),
            os.path.join(self.data_dir, 'idempotency')
        ]
        for d in dirs:
            os.makedirs(d, exist_ok=True)
    
    def _file_path(self, category: str, id: str) -> str:
        return os.path.join(self.data_dir, category, f"{id}.json")
    
    def _list_ids(self, category: str) -> list:
        dir_path = os.path.join(self.data_dir, category)
        if not os.path.exists(dir_path):
            return []
        return [f[:-5] for f in os.listdir(dir_path) if f.endswith('.json')]
    
    def _save(self, category: str, id: str, data: Dict[str, Any]):
        with open(self._file_path(category, id), 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, cls=DecimalEncoder)
    
    def _load(self, category: str, id: str) -> Optional[Dict[str, Any]]:
        file_path = self._file_path(category, id)
        if not os.path.exists(file_path):
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def save_asset(self, asset: AssetCard):
        self._save('assets', asset.asset_code, asset.to_dict())
    
    def load_asset(self, asset_code: str) -> Optional[AssetCard]:
        data = self._load('assets', asset_code)
        if not data:
            return None
        
        data['original_value'] = Decimal(data['original_value'])
        data['accumulated_depreciation'] = Decimal(data['accumulated_depreciation'])
        if data['net_value']:
            data['net_value'] = Decimal(data['net_value'])
        data['purchase_date'] = datetime.strptime(data['purchase_date'], '%Y-%m-%d %H:%M:%S')
        
        return AssetCard(**data)
    
    def list_assets(self) -> list:
        return self._list_ids('assets')
    
    def save_cost_center(self, cost_center: CostCenter):
        self._save('cost_centers', cost_center.code, cost_center.to_dict())
    
    def load_cost_center(self, code: str) -> Optional[CostCenter]:
        data = self._load('cost_centers', code)
        if not data:
            return None
        
        data['effective_from'] = datetime.strptime(data['effective_from'], '%Y-%m-%d %H:%M:%S')
        if data.get('effective_to'):
            data['effective_to'] = datetime.strptime(data['effective_to'], '%Y-%m-%d %H:%M:%S')
        
        return CostCenter(**data)
    
    def save_depreciation_rule(self, rule: DepreciationRule):
        self._save('depreciation_rules', rule.code, rule.to_dict())
    
    def load_depreciation_rule(self, code: str) -> Optional[DepreciationRule]:
        data = self._load('depreciation_rules', code)
        if not data:
            return None
        
        data['salvage_value_rate'] = Decimal(data['salvage_value_rate'])
        data['effective_from'] = datetime.strptime(data['effective_from'], '%Y-%m-%d %H:%M:%S')
        
        return DepreciationRule(**data)
    
    def save_depreciation_record(self, record: DepreciationRecord):
        record_id = f"{record.asset_code}_{record.period}_{record.version_id or 'original'}"
        self._save('depreciation_records', record_id, record.to_dict())
    
    def load_depreciation_records(self, asset_code: str, period: Optional[str] = None, version_id: Optional[str] = None) -> list:
        records = []
        for record_id in self._list_ids('depreciation_records'):
            if not record_id.startswith(asset_code):
                continue
            
            parts = record_id.split('_')
            if period and len(parts) >= 2 and parts[1] != period:
                continue
            if version_id and len(parts) >= 3 and '_'.join(parts[2:]) != version_id:
                continue
            
            data = self._load('depreciation_records', record_id)
            if data:
                data['depreciation_amount'] = Decimal(data['depreciation_amount'])
                data['accumulated_depreciation'] = Decimal(data['accumulated_depreciation'])
                data['net_value'] = Decimal(data['net_value'])
                data['created_at'] = datetime.strptime(data['created_at'], '%Y-%m-%d %H:%M:%S')
                records.append(DepreciationRecord(**data))
        
        return sorted(records, key=lambda r: r.period)
    
    def save_version(self, version: RecalculationVersion):
        self._save('versions', version.version_id, version.to_dict())
    
    def load_version(self, version_id: str) -> Optional[RecalculationVersion]:
        data = self._load('versions', version_id)
        if not data:
            return None
        
        data['created_at'] = datetime.strptime(data['created_at'], '%Y-%m-%d %H:%M:%S')
        if data.get('completed_at'):
            data['completed_at'] = datetime.strptime(data['completed_at'], '%Y-%m-%d %H:%M:%S')
        
        return RecalculationVersion(**data)
    
    def list_versions(self, asset_code: Optional[str] = None) -> list:
        versions = []
        for version_id in self._list_ids('versions'):
            version = self.load_version(version_id)
            if version and (not asset_code or version.asset_code == asset_code):
                versions.append(version)
        return sorted(versions, key=lambda v: v.created_at, reverse=True)
    
    def save_difference(self, difference: DifferenceDetail):
        self._save('differences', difference.difference_id, difference.to_dict())
    
    def load_differences(self, version_id: str) -> list:
        differences = []
        for diff_id in self._list_ids('differences'):
            data = self._load('differences', diff_id)
            if data and data.get('version_id') == version_id:
                data['original_depreciation'] = Decimal(data['original_depreciation'])
                data['new_depreciation'] = Decimal(data['new_depreciation'])
                data['difference_amount'] = Decimal(data['difference_amount'])
                differences.append(DifferenceDetail(**data))
        return sorted(differences, key=lambda d: d.period)
    
    def save_audit_log(self, log: AuditLog):
        self._save('audit_logs', log.log_id, log.to_dict())
    
    def load_audit_logs(self, asset_code: Optional[str] = None, version_id: Optional[str] = None) -> list:
        logs = []
        for log_id in self._list_ids('audit_logs'):
            data = self._load('audit_logs', log_id)
            if not data:
                continue
            
            if asset_code and data.get('asset_code') != asset_code:
                continue
            if version_id and data.get('version_id') != version_id:
                continue
            
            data['operation_time'] = datetime.strptime(data['operation_time'], '%Y-%m-%d %H:%M:%S')
            logs.append(AuditLog(**data))
        
        return sorted(logs, key=lambda l: l.operation_time, reverse=True)
    
    def check_idempotency(self, key: str) -> Optional[Dict[str, Any]]:
        return self._load('idempotency', key)
    
    def save_idempotency(self, key: str, result: Dict[str, Any]):
        self._save('idempotency', key, {
            'key': key,
            'result': result,
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })


storage = JSONStorage()
