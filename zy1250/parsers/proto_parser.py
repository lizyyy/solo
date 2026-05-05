import os
import re
from typing import Dict, List, Any, Optional
from models import ProtoService, ProtoMethod, ProtoMessage, db


class ProtoParser:
    """解析 .proto 文件"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
    
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """解析单个 .proto 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return self._parse_proto(content, file_path)
    
    def parse_directory(self, dir_path: str) -> List[Dict[str, Any]]:
        """解析目录下所有 .proto 文件"""
        results = []
        for root, dirs, files in os.walk(dir_path):
            for file in files:
                if file.endswith('.proto'):
                    file_path = os.path.join(root, file)
                    result = self.parse_file(file_path)
                    results.append(result)
        return results
    
    def parse_content(self, content: str, file_path: str = 'unknown.proto') -> Dict[str, Any]:
        """解析 proto 内容字符串"""
        return self._parse_proto(content, file_path)
    
    def _parse_proto(self, content: str, file_path: str) -> Dict[str, Any]:
        """解析 proto 内容"""
        services = []
        messages = []
        package = ''
        
        lines = content.split('\n')
        current_service = None
        current_message = None
        current_nested = None
        nesting_stack = []
        
        comment_buffer = []
        
        for line in lines:
            stripped = line.strip()
            
            if stripped.startswith('//'):
                comment = stripped[2:].strip()
                if comment:
                    comment_buffer.append(comment)
                continue
            
            if stripped.startswith('package'):
                package_match = re.match(r'package\s+([\w.]+)\s*;', stripped)
                if package_match:
                    package = package_match.group(1)
                comment_buffer = []
                continue
            
            if 'service' in stripped and '{' in stripped:
                service_match = re.match(r'(?:\w+\s+)*service\s+(\w+)\s*\{', stripped)
                if service_match:
                    service_name = service_match.group(1)
                    current_service = {
                        'name': service_name,
                        'package': package,
                        'methods': [],
                        'comments': comment_buffer.copy()
                    }
                    comment_buffer = []
                continue
            
            if current_service and 'rpc' in stripped:
                rpc_match = re.match(
                    r'(?:\w+\s+)*rpc\s+(\w+)\s*\(\s*(stream\s+)?([\w.]+)\s*\)\s+'
                    r'returns\s*\(\s*(stream\s+)?([\w.]+)\s*\)',
                    stripped
                )
                if rpc_match:
                    method_name = rpc_match.group(1)
                    is_client_streaming = rpc_match.group(2) is not None
                    request_type = rpc_match.group(3)
                    is_server_streaming = rpc_match.group(4) is not None
                    response_type = rpc_match.group(5)
                    
                    options = {}
                    if '{' in stripped:
                        pass
                    
                    current_service['methods'].append({
                        'name': method_name,
                        'request_type': request_type,
                        'response_type': response_type,
                        'is_client_streaming': is_client_streaming,
                        'is_server_streaming': is_server_streaming,
                        'options': options,
                        'comments': comment_buffer.copy()
                    })
                    comment_buffer = []
                continue
            
            if 'message' in stripped and '{' in stripped:
                message_match = re.match(r'(?:\w+\s+)*message\s+(\w+)\s*\{', stripped)
                if message_match:
                    message_name = message_match.group(1)
                    message_data = {
                        'name': message_name,
                        'package': package,
                        'fields': [],
                        'nested_types': [],
                        'comments': comment_buffer.copy(),
                        'is_nested': current_message is not None
                    }
                    
                    if current_message:
                        nesting_stack.append(current_message)
                        current_message['nested_types'].append(message_data)
                        current_message = message_data
                    else:
                        messages.append(message_data)
                        current_message = message_data
                    
                    comment_buffer = []
                continue
            
            if current_message and re.match(r'^(?:\w+\s+)*\w+\s+\w+\s*=\s*\d+', stripped):
                field_match = re.match(
                    r'(?:(optional|repeated|required)\s+)?'
                    r'(\w+(?:<\w+(?:,\s*\w+)?>)?)\s+'
                    r'(\w+)\s*=\s*(\d+)\s*(?:\[([^\]]+)\])?\s*;?',
                    stripped
                )
                if field_match:
                    label = field_match.group(1) or 'optional'
                    field_type = field_match.group(2)
                    field_name = field_match.group(3)
                    field_number = int(field_match.group(4))
                    options_str = field_match.group(5)
                    
                    field_options = {}
                    if options_str:
                        for opt in options_str.split(','):
                            opt = opt.strip()
                            if '=' in opt:
                                key, value = opt.split('=', 1)
                                field_options[key.strip()] = value.strip()
                            else:
                                field_options[opt] = True
                    
                    current_message['fields'].append({
                        'name': field_name,
                        'type': field_type,
                        'number': field_number,
                        'label': label,
                        'options': field_options,
                        'comments': comment_buffer.copy()
                    })
                    comment_buffer = []
                continue
            
            if stripped == '}':
                if current_message:
                    if nesting_stack:
                        current_message = nesting_stack.pop()
                    else:
                        current_message = None
                elif current_service:
                    services.append(current_service)
                    current_service = None
                comment_buffer = []
                continue
            
            comment_buffer = []
        
        return {
            'file_path': file_path,
            'package': package,
            'services': services,
            'messages': messages
        }
    
    def save_to_db(self, parsed_data: Dict) -> List[ProtoService]:
        """保存解析结果到数据库"""
        saved_services = []
        
        file_path = parsed_data.get('file_path', 'unknown.proto')
        package = parsed_data.get('package', '')
        
        for service_data in parsed_data.get('services', []):
            service = ProtoService(
                package=package,
                service_name=service_data['name'],
                proto_file_path=file_path
            )
            db.session.add(service)
            db.session.flush()
            
            for method_data in service_data.get('methods', []):
                method = ProtoMethod(
                    service_id=service.id,
                    name=method_data['name'],
                    request_type=method_data['request_type'],
                    response_type=method_data['response_type'],
                    is_client_streaming=method_data['is_client_streaming'],
                    is_server_streaming=method_data['is_server_streaming'],
                    comments='\n'.join(method_data.get('comments', []))
                )
                method.options = method_data['options']
                db.session.add(method)
            
            for message_data in parsed_data.get('messages', []):
                message = ProtoMessage(
                    service_id=service.id,
                    name=message_data['name'],
                    comments='\n'.join(message_data.get('comments', []))
                )
                message.fields = message_data['fields']
                message.nested_types = message_data['nested_types']
                db.session.add(message)
            
            saved_services.append(service)
        
        db.session.commit()
        return saved_services
