import time
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime


class GrpcAdapter:
    """gRPC 适配器（模拟调用）"""
    
    GRPC_STATUS_CODES = {
        0: 'OK',
        1: 'CANCELLED',
        2: 'UNKNOWN',
        3: 'INVALID_ARGUMENT',
        4: 'DEADLINE_EXCEEDED',
        5: 'NOT_FOUND',
        6: 'ALREADY_EXISTS',
        7: 'PERMISSION_DENIED',
        8: 'RESOURCE_EXHAUSTED',
        9: 'FAILED_PRECONDITION',
        10: 'ABORTED',
        11: 'OUT_OF_RANGE',
        12: 'UNIMPLEMENTED',
        13: 'INTERNAL',
        14: 'UNAVAILABLE',
        15: 'DATA_LOSS',
        16: 'UNAUTHENTICATED'
    }
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.target = self.config.get('target', 'localhost:50051')
        self.timeout_ms = self.config.get('timeout_ms', 30000)
    
    def call(self,
             service_name: str,
             method_name: str,
             request: Dict,
             metadata: Optional[List[Tuple[str, str]]] = None,
             deadline_ms: Optional[int] = None) -> Dict[str, Any]:
        """模拟调用 gRPC 接口"""
        actual_deadline = deadline_ms or self.timeout_ms
        
        start_time = time.time()
        
        try:
            response = self._simulate_grpc_call(service_name, method_name, request, metadata)
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            status_code = response.get('status_code', 0)
            
            if elapsed_ms > actual_deadline:
                return {
                    'success': False,
                    'error': {
                        'code': 'DEADLINE_EXCEEDED',
                        'grpc_code': 4,
                        'message': f'Deadline exceeded after {elapsed_ms:.2f}ms (deadline: {actual_deadline}ms)',
                        'details': {}
                    },
                    'metadata': {
                        'deadline_ms': actual_deadline,
                        'elapsed_ms': elapsed_ms,
                        'service': service_name,
                        'method': method_name
                    }
                }
            
            if status_code != 0:
                return {
                    'success': False,
                    'error': {
                        'code': self.GRPC_STATUS_CODES.get(status_code, 'UNKNOWN'),
                        'grpc_code': status_code,
                        'message': response.get('error_message', 'gRPC error'),
                        'details': response.get('error_details', {})
                    },
                    'metadata': {
                        **response.get('trailing_metadata', {}),
                        'deadline_ms': actual_deadline,
                        'elapsed_ms': elapsed_ms,
                        'service': service_name,
                        'method': method_name
                    }
                }
            
            return {
                'success': True,
                'data': response.get('data', {}),
                'metadata': {
                    **response.get('initial_metadata', {}),
                    **response.get('trailing_metadata', {}),
                    'deadline_ms': actual_deadline,
                    'elapsed_ms': elapsed_ms,
                    'service': service_name,
                    'method': method_name,
                    'request_metadata': metadata or []
                },
                'grpc_code': 0,
                'grpc_status': 'OK'
            }
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            return {
                'success': False,
                'error': {
                    'code': 'INTERNAL',
                    'grpc_code': 13,
                    'message': str(e),
                    'details': {}
                },
                'metadata': {
                    'deadline_ms': actual_deadline,
                    'elapsed_ms': elapsed_ms,
                    'service': service_name,
                    'method': method_name
                }
            }
    
    def _simulate_grpc_call(self,
                            service_name: str,
                            method_name: str,
                            request: Dict,
                            metadata: Optional[List[Tuple[str, str]]]) -> Dict:
        """模拟 gRPC 调用逻辑"""
        
        full_method = f'{service_name}/{method_name}'
        method_handlers = self.config.get('method_handlers', {})
        
        if full_method in method_handlers or method_name in method_handlers:
            handler_config = method_handlers.get(full_method) or method_handlers.get(method_name, {})
            
            latency_ms = handler_config.get('latency_ms', 50)
            if latency_ms > 0:
                time.sleep(latency_ms / 1000)
            
            if handler_config.get('should_fail', False):
                grpc_code = handler_config.get('grpc_code', 13)
                return {
                    'status_code': grpc_code,
                    'error_message': handler_config.get('error_message', 'Simulated gRPC error'),
                    'error_details': handler_config.get('error_details', {}),
                    'trailing_metadata': {
                        'grpc-status-details-bin': '',
                        'server_processing_time_ms': latency_ms
                    }
                }
            
            response_data = handler_config.get('response_data', {})
            return {
                'status_code': 0,
                'data': response_data,
                'initial_metadata': {
                    'content-type': 'application/grpc'
                },
                'trailing_metadata': {
                    'grpc-status': '0',
                    'grpc-message': '',
                    'server_processing_time_ms': latency_ms,
                    'request_id': f'grpc-{int(time.time() * 1000)}'
                }
            }
        
        return {
            'status_code': 0,
            'data': self._generate_default_response(service_name, method_name, request),
            'initial_metadata': {
                'content-type': 'application/grpc'
            },
            'trailing_metadata': {
                'grpc-status': '0',
                'grpc-message': '',
                'server_processing_time_ms': 20,
                'request_id': f'grpc-{int(time.time() * 1000)}'
            }
        }
    
    def _generate_default_response(self, service_name: str, method_name: str, request: Dict) -> Dict:
        """生成默认响应"""
        response = {}
        
        for key, value in request.items():
            if isinstance(value, str) and key.endswith('_id'):
                response[f'{key}_echo'] = value
            elif isinstance(value, dict):
                response[key] = self._generate_default_response(service_name, method_name, value)
            elif isinstance(value, list):
                response[key] = [self._generate_default_response(service_name, method_name, item)
                               if isinstance(item, dict) else item
                               for item in value]
        
        response['_service'] = service_name
        response['_method'] = method_name
        response['_timestamp'] = datetime.utcnow().isoformat()
        response['_success'] = True
        
        return response
