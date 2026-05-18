import os
import yaml
import json
import glob
from datetime import datetime
from typing import List, Dict, Any


class WhitelistInspector:
    def __init__(self, input_path: str, rules_file: str, inspection_date):
        self.input_path = input_path
        self.rules_file = rules_file
        self.inspection_date = inspection_date
        self.configs = []
        self.rules = {}
        
    def load_configs(self) -> None:
        self._load_rules()
        
        json_files = glob.glob(os.path.join(self.input_path, "**/*.json"), recursive=True)
        yaml_files = glob.glob(os.path.join(self.input_path, "**/*.yaml"), recursive=True)
        yml_files = glob.glob(os.path.join(self.input_path, "**/*.yml"), recursive=True)
        
        all_files = json_files + yaml_files + yml_files
        
        for file_path in all_files:
            try:
                config = self._load_file(file_path)
                if config:
                    config['_source_file'] = os.path.relpath(file_path, self.input_path)
                    self.configs.append(config)
            except Exception as e:
                print(f"警告: 无法加载文件 {file_path}: {str(e)}")
        
        if not self.configs:
            raise ValueError(f"在输入路径 {self.input_path} 中未找到有效的配置文件")
    
    def _load_rules(self) -> None:
        with open(self.rules_file, 'r', encoding='utf-8') as f:
            self.rules = yaml.safe_load(f)
        
        if not self.rules:
            raise ValueError("规则文件为空")
    
    def _load_file(self, file_path: str) -> Dict[str, Any]:
        ext = os.path.splitext(file_path)[1].lower()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if ext == '.json':
                return json.load(f)
            elif ext in ['.yaml', '.yml']:
                return yaml.safe_load(f)
        return None
    
    def analyze(self) -> Dict[str, Any]:
        all_whitelists = []
        expired_whitelists = []
        cache_config_items = []
        tenant_rename_items = []
        api_combination_items = []
        
        for config in self.configs:
            whitelists = self._extract_whitelists(config)
            all_whitelists.extend(whitelists)
            
            for wl in whitelists:
                if self._is_expired_and_active(wl):
                    item_type = self._classify_item(wl)
                    wl['type'] = item_type
                    expired_whitelists.append(wl)
                    
                    if item_type == 'cache_config':
                        cache_config_items.append(wl)
                    elif item_type == 'tenant_rename':
                        tenant_rename_items.append(wl)
                    elif item_type == 'api_combination':
                        api_combination_items.append(wl)
        
        return {
            'total_files': len(self.configs),
            'total_whitelists': len(all_whitelists),
            'expired_active_count': len(expired_whitelists),
            'cache_config_count': len(cache_config_items),
            'tenant_rename_count': len(tenant_rename_items),
            'api_combination_count': len(api_combination_items),
            'expired_whitelists': expired_whitelists,
            'cache_config_items': cache_config_items,
            'tenant_rename_items': tenant_rename_items,
            'api_combination_items': api_combination_items,
            'all_whitelists': all_whitelists,
            'inspection_date': self.inspection_date,
            'rules': self.rules
        }
    
    def _extract_whitelists(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        whitelists = []
        source_file = config.get('_source_file', 'unknown')
        
        if 'whitelists' in config:
            for idx, wl in enumerate(config['whitelists']):
                wl_data = self._normalize_whitelist(wl)
                wl_data['_source_file'] = source_file
                wl_data['_index'] = idx
                whitelists.append(wl_data)
        
        elif 'gateway' in config and 'whitelist' in config['gateway']:
            for idx, wl in enumerate(config['gateway']['whitelist']):
                wl_data = self._normalize_whitelist(wl)
                wl_data['_source_file'] = source_file
                wl_data['_index'] = idx
                whitelists.append(wl_data)
        
        elif 'rules' in config:
            for idx, rule in enumerate(config['rules']):
                if rule.get('type') == 'whitelist':
                    wl_data = self._normalize_whitelist(rule)
                    wl_data['_source_file'] = source_file
                    wl_data['_index'] = idx
                    whitelists.append(wl_data)
        
        return whitelists
    
    def _normalize_whitelist(self, wl: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {
            'id': wl.get('id', wl.get('rule_id', 'unknown')),
            'name': wl.get('name', wl.get('rule_name', '未命名')),
            'tenant': wl.get('tenant', wl.get('tenant_id', wl.get('tenant_name', '未知租户'))),
            'api': wl.get('api', wl.get('api_path', wl.get('interface', '未知接口'))),
            'status': wl.get('status', wl.get('enabled', True)),
            'expire_date': wl.get('expire_date', wl.get('expires_at', wl.get('valid_until', None))),
            'description': wl.get('description', wl.get('remark', '')),
            'tags': wl.get('tags', []),
            'original_data': wl
        }
        
        if isinstance(normalized['expire_date'], str):
            try:
                normalized['expire_date'] = datetime.strptime(
                    normalized['expire_date'], '%Y-%m-%d'
                ).date()
            except ValueError:
                try:
                    normalized['expire_date'] = datetime.strptime(
                        normalized['expire_date'], '%Y-%m-%d %H:%M:%S'
                    ).date()
                except ValueError:
                    pass
        
        return normalized
    
    def _is_expired_and_active(self, wl: Dict[str, Any]) -> bool:
        status = wl['status']
        if isinstance(status, bool):
            is_active = status
        else:
            is_active = str(status).lower() in ['true', 'enabled', 'active', '1', '启用']
        
        if not is_active:
            return False
        
        expire_date = wl['expire_date']
        if expire_date is None:
            return False
        
        if hasattr(expire_date, 'date'):
            expire_date = expire_date.date()
        
        return expire_date < self.inspection_date
    
    def _classify_item(self, wl: Dict[str, Any]) -> str:
        tags = wl.get('tags', [])
        name = wl.get('name', '').lower()
        description = wl.get('description', '').lower()
        
        cache_keywords = self.rules.get('classification', {}).get('cache_keywords', ['cache', '缓存', 'redis', 'memory'])
        for keyword in cache_keywords:
            if keyword.lower() in name or keyword.lower() in description or keyword in tags:
                return 'cache_config'
        
        rename_keywords = self.rules.get('classification', {}).get('rename_keywords', ['rename', '改名', '更名', '迁移'])
        for keyword in rename_keywords:
            if keyword.lower() in name or keyword.lower() in description or keyword in tags:
                return 'tenant_rename'
        
        combo_keywords = self.rules.get('classification', {}).get('combo_keywords', ['combo', '组合', 'bundle', '批量'])
        for keyword in combo_keywords:
            if keyword.lower() in name or keyword.lower() in description or keyword in tags:
                return 'api_combination'
        
        return 'normal'
