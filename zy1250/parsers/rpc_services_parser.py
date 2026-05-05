import yaml
import os
from typing import Dict, List, Any, Optional
from models import RpcService, RpcMethod, db


class RpcServicesParser:
    """解析 rpc-services.yaml 文件"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
    
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """解析 YAML 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        return self._parse_services(data)
    
    def parse_content(self, content: str) -> Dict[str, Any]:
        """解析 YAML 内容字符串"""
        data = yaml.safe_load(content)
        return self._parse_services(data)
    
    def _parse_services(self, data: Dict) -> Dict[str, Any]:
        """解析服务定义"""
        services_data = []
        services = data.get('services', [])
        global_defaults = data.get('defaults', {})
        
        for service_data in services:
            service_name = service_data.get('name', 'UnknownService')
            namespace = service_data.get('namespace', global_defaults.get('namespace', ''))
            version = service_data.get('version', global_defaults.get('version', 'v1'))
            
            service_defaults = service_data.get('defaults', {})
            methods_data = []
            
            methods = service_data.get('methods', [])
            for method_data in methods:
                method_name = method_data.get('name', 'UnknownMethod')
                
                request_fields = self._parse_fields(
                    method_data.get('request', {}), 
                    service_defaults.get('request', {}),
                    global_defaults.get('request', {})
                )
                response_fields = self._parse_fields(
                    method_data.get('response', {}),
                    service_defaults.get('response', {}),
                    global_defaults.get('response', {})
                )
                
                deadline_ms = method_data.get('deadline_ms') or \
                              service_defaults.get('deadline_ms') or \
                              global_defaults.get('deadline_ms', 30000)
                
                retry_policy = method_data.get('retry_policy') or \
                               service_defaults.get('retry_policy') or \
                               global_defaults.get('retry_policy', {})
                
                error_codes = method_data.get('error_codes') or \
                             service_defaults.get('error_codes') or \
                             global_defaults.get('error_codes', [])
                
                idempotent_key = method_data.get('idempotent_key') or \
                                service_defaults.get('idempotent_key') or \
                                global_defaults.get('idempotent_key', '')
                
                metadata = method_data.get('metadata') or \
                          service_defaults.get('metadata') or \
                          global_defaults.get('metadata', [])
                
                methods_data.append({
                    'name': method_name,
                    'request_fields': request_fields,
                    'response_fields': response_fields,
                    'deadline_ms': deadline_ms,
                    'retry_policy': retry_policy,
                    'error_codes': error_codes,
                    'idempotent_key': idempotent_key,
                    'metadata': metadata,
                    'description': method_data.get('description', '')
                })
            
            services_data.append({
                'name': service_name,
                'namespace': namespace,
                'version': version,
                'methods': methods_data,
                'description': service_data.get('description', '')
            })
        
        return {
            'services': services_data,
            'global_defaults': global_defaults
        }
    
    def _parse_fields(self, 
                      method_fields: Dict, 
                      service_fields: Dict, 
                      global_fields: Dict) -> List[Dict]:
        """解析字段定义"""
        fields = method_fields.get('fields', [])
        
        if not fields:
            fields = service_fields.get('fields', [])
        
        if not fields:
            fields = global_fields.get('fields', [])
        
        parsed_fields = []
        for field in fields:
            if isinstance(field, dict):
                parsed_fields.append({
                    'name': field.get('name', ''),
                    'type': field.get('type', 'string'),
                    'required': field.get('required', False),
                    'default': field.get('default'),
                    'description': field.get('description', '')
                })
            elif isinstance(field, str):
                parsed_fields.append({
                    'name': field,
                    'type': 'string',
                    'required': False,
                    'default': None,
                    'description': ''
                })
        
        return parsed_fields
    
    def save_to_db(self, parsed_data: Dict) -> List[RpcService]:
        """保存解析结果到数据库"""
        saved_services = []
        
        for service_data in parsed_data.get('services', []):
            service = RpcService(
                name=service_data['name'],
                namespace=service_data['namespace'],
                version=service_data['version']
            )
            db.session.add(service)
            db.session.flush()
            
            for method_data in service_data.get('methods', []):
                method = RpcMethod(
                    service_id=service.id,
                    name=method_data['name'],
                    deadline_ms=method_data['deadline_ms'],
                    idempotent_key=method_data.get('idempotent_key', '')
                )
                method.request_fields = method_data['request_fields']
                method.response_fields = method_data['response_fields']
                method.retry_policy = method_data['retry_policy']
                method.error_codes = method_data['error_codes']
                method.metadata = method_data['metadata']
                
                db.session.add(method)
            
            saved_services.append(service)
        
        db.session.commit()
        return saved_services
