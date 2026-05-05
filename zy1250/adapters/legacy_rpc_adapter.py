import time
import json
from typing import Dict, Any, Optional, List
from datetime import datetime


class LegacyRpcAdapter:
    """老 RPC 适配器（模拟调用）"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.base_url = self.config.get('base_url', 'http://localhost:8080')
        self.timeout_ms = self.config.get('timeout_ms', 30000)
    
    def call(self, 
             method_name: str, 
             request: Dict, 
             metadata: Optional[List[Dict]] = None,
             deadline_ms: Optional[int] = None) -> Dict[str, Any]:
        """模拟调用老 RPC 接口"""
        actual_deadline = deadline_ms or self.timeout_ms
        
        start_time = time.time()
        
        try:
            response = self._simulate_rpc_call(method_name, request, metadata)
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            if elapsed_ms > actual_deadline:
                return {
                    'success': False,
                    'error': {
                        'code': 'DEADLINE_EXCEEDED',
                        'message': f'Request timed out after {elapsed_ms:.2f}ms (deadline: {actual_deadline}ms)',
                        'details': {}
                    },
                    'metadata': {
                        'deadline_ms': actual_deadline,
                        'elapsed_ms': elapsed_ms
                    }
                }
            
            return {
                'success': True,
                'data': response.get('data', {}),
                'metadata': {
                    **response.get('metadata', {}),
                    'deadline_ms': actual_deadline,
                    'elapsed_ms': elapsed_ms,
                    'request_metadata': metadata or []
                },
                'status_code': response.get('status_code', 200)
            }
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            return {
                'success': False,
                'error': {
                    'code': 'INTERNAL_ERROR',
                    'message': str(e),
                    'details': {}
                },
                'metadata': {
                    'deadline_ms': actual_deadline,
                    'elapsed_ms': elapsed_ms
                }
            }
    
    def _simulate_rpc_call(self, 
                           method_name: str, 
                           request: Dict, 
                           metadata: Optional[List[Dict]]) -> Dict:
        """模拟 RPC 调用逻辑"""
        
        method_handlers = self.config.get('method_handlers', {})
        
        if method_name in method_handlers:
            handler_config = method_handlers[method_name]
            
            latency_ms = handler_config.get('latency_ms', 100)
            if latency_ms > 0:
                time.sleep(latency_ms / 1000)
            
            if handler_config.get('should_fail', False):
                return {
                    'success': False,
                    'error': {
                        'code': handler_config.get('error_code', 'UNKNOWN_ERROR'),
                        'message': handler_config.get('error_message', 'Simulated error'),
                        'details': handler_config.get('error_details', {})
                    }
                }
            
            response_data = handler_config.get('response_data', {})
            return {
                'data': response_data,
                'metadata': {
                    'server_processing_time_ms': latency_ms,
                    'request_id': f'legacy-{int(time.time() * 1000)}'
                },
                'status_code': handler_config.get('status_code', 200)
            }
        
        return {
            'data': self._generate_default_response(method_name, request),
            'metadata': {
                'server_processing_time_ms': 50,
                'request_id': f'legacy-{int(time.time() * 1000)}'
            },
            'status_code': 200
        }
    
    def _generate_default_response(self, method_name: str, request: Dict) -> Dict:
        """生成默认响应"""
        response = {}
        
        for key, value in request.items():
            if isinstance(value, str) and key.endswith('_id'):
                response[f'{key}_echo'] = value
            elif isinstance(value, dict):
                response[key] = self._generate_default_response(method_name, value)
            elif isinstance(value, list):
                response[key] = [self._generate_default_response(method_name, item) 
                               if isinstance(item, dict) else item 
                               for item in value]
        
        response['_method'] = method_name
        response['_timestamp'] = datetime.utcnow().isoformat()
        response['_success'] = True
        
        return response
