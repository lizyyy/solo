from typing import List, Dict, Any, Tuple

class OpenAPIDiffDetector:
    def __init__(self, old_spec: Dict[str, Any], new_spec: Dict[str, Any]):
        self.old_spec = old_spec
        self.new_spec = new_spec
        self.changes = []
    
    def detect(self) -> List[Dict[str, Any]]:
        self.changes = []
        
        old_paths = self.old_spec.get('paths', {})
        new_paths = self.new_spec.get('paths', {})
        
        for path in old_paths:
            if path not in new_paths:
                for method in old_paths[path]:
                    if method.lower() in ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']:
                        self._add_change(
                            'PATH_REMOVED',
                            path,
                            method.upper(),
                            None,
                            f"删除了路径 '{path}' 的 {method.upper()} 操作",
                            True,
                            'high'
                        )
        
        for path in new_paths:
            if path not in old_paths:
                for method in new_paths[path]:
                    if method.lower() in ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']:
                        self._add_change(
                            'PATH_ADDED',
                            path,
                            method.upper(),
                            None,
                            f"新增路径 '{path}' 的 {method.upper()} 操作",
                            False,
                            'low'
                        )
        
        for path in set(old_paths.keys()) & set(new_paths.keys()):
            old_path_ops = old_paths[path]
            new_path_ops = new_paths[path]
            
            for method in old_path_ops:
                if method.lower() not in ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']:
                    continue
                if method not in new_path_ops:
                    self._add_change(
                        'OPERATION_REMOVED',
                        path,
                        method.upper(),
                        None,
                        f"删除了路径 '{path}' 的 {method.upper()} 操作",
                        True,
                        'high'
                    )
            
            for method in new_path_ops:
                if method.lower() not in ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']:
                    continue
                if method not in old_path_ops:
                    self._add_change(
                        'OPERATION_ADDED',
                        path,
                        method.upper(),
                        None,
                        f"新增路径 '{path}' 的 {method.upper()} 操作",
                        False,
                        'low'
                    )
                else:
                    self._compare_parameters(
                        path,
                        method.upper(),
                        old_path_ops[method].get('parameters', []),
                        new_path_ops[method].get('parameters', [])
                    )
                    self._compare_request_body(
                        path,
                        method.upper(),
                        old_path_ops[method].get('requestBody'),
                        new_path_ops[method].get('requestBody')
                    )
                    self._compare_responses(
                        path,
                        method.upper(),
                        old_path_ops[method].get('responses', {}),
                        new_path_ops[method].get('responses', {})
                    )
        
        return self.changes
    
    def _compare_parameters(self, path: str, method: str, 
                           old_params: List[Dict], new_params: List[Dict]):
        old_param_map = {(p['name'], p.get('in', 'query')): p for p in old_params}
        new_param_map = {(p['name'], p.get('in', 'query')): p for p in new_params}
        
        for (name, location), param in old_param_map.items():
            if (name, location) not in new_param_map:
                if param.get('required', False):
                    self._add_change(
                        'PARAMETER_REMOVED',
                        path,
                        method,
                        name,
                        f"删除了必填 {location} 参数 '{name}'",
                        True,
                        'high'
                    )
                else:
                    self._add_change(
                        'PARAMETER_REMOVED',
                        path,
                        method,
                        name,
                        f"删除了可选 {location} 参数 '{name}'",
                        False,
                        'low'
                    )
        
        for (name, location), param in new_param_map.items():
            if (name, location) not in old_param_map:
                if param.get('required', False):
                    self._add_change(
                        'PARAMETER_ADDED',
                        path,
                        method,
                        name,
                        f"新增必填 {location} 参数 '{name}'",
                        True,
                        'high'
                    )
                else:
                    self._add_change(
                        'PARAMETER_ADDED',
                        path,
                        method,
                        name,
                        f"新增可选 {location} 参数 '{name}'",
                        False,
                        'low'
                    )
        
        for (name, location) in set(old_param_map.keys()) & set(new_param_map.keys()):
            old_param = old_param_map[(name, location)]
            new_param = new_param_map[(name, location)]
            
            if old_param.get('required', False) != new_param.get('required', False):
                if not old_param.get('required', False) and new_param.get('required', False):
                    self._add_change(
                        'PARAMETER_REQUIREMENT_CHANGED',
                        path,
                        method,
                        name,
                        f"参数 '{name}' 从可选变为必填",
                        True,
                        'high'
                    )
                else:
                    self._add_change(
                        'PARAMETER_REQUIREMENT_CHANGED',
                        path,
                        method,
                        name,
                        f"参数 '{name}' 从必填变为可选",
                        False,
                        'low'
                    )
            
            old_type = old_param.get('schema', {}).get('type', '')
            new_type = new_param.get('schema', {}).get('type', '')
            if old_type and new_type and old_type != new_type:
                self._add_change(
                    'PARAMETER_TYPE_CHANGED',
                    path,
                    method,
                    name,
                    f"参数 '{name}' 类型从 {old_type} 变为 {new_type}",
                    True,
                    'medium'
                )
    
    def _compare_request_body(self, path: str, method: str, 
                             old_body: Dict, new_body: Dict):
        if not old_body and not new_body:
            return
        if old_body and not new_body:
            self._add_change(
                'REQUEST_BODY_REMOVED',
                path,
                method,
                None,
                "删除了请求体",
                True,
                'high'
            )
            return
        if not old_body and new_body:
            self._add_change(
                'REQUEST_BODY_ADDED',
                path,
                method,
                None,
                "新增了请求体",
                True,
                'high' if new_body.get('required', False) else 'low'
            )
            return
        
        old_schema = old_body.get('content', {}).get('application/json', {}).get('schema', {})
        new_schema = new_body.get('content', {}).get('application/json', {}).get('schema', {})
        
        self._compare_schemas(path, method, 'request', old_schema, new_schema)
    
    def _compare_responses(self, path: str, method: str,
                          old_responses: Dict, new_responses: Dict):
        for status_code in old_responses:
            if status_code not in new_responses:
                self._add_change(
                    'RESPONSE_REMOVED',
                    path,
                    method,
                    None,
                    f"删除了 {status_code} 响应",
                    True,
                    'high'
                )
        
        for status_code in new_responses:
            if status_code not in old_responses:
                self._add_change(
                    'RESPONSE_ADDED',
                    path,
                    method,
                    None,
                    f"新增了 {status_code} 响应",
                    False,
                    'low'
                )
        
        for status_code in set(old_responses.keys()) & set(new_responses.keys()):
            old_schema = old_responses[status_code].get('content', {}).get('application/json', {}).get('schema', {})
            new_schema = new_responses[status_code].get('content', {}).get('application/json', {}).get('schema', {})
            
            if old_schema and new_schema:
                self._compare_schemas(path, method, f'response_{status_code}', old_schema, new_schema)
    
    def _compare_schemas(self, path: str, method: str, context: str,
                         old_schema: Dict, new_schema: Dict):
        old_props = old_schema.get('properties', {})
        new_props = new_schema.get('properties', {})
        
        old_required = set(old_schema.get('required', []))
        new_required = set(new_schema.get('required', []))
        
        for prop_name in old_props:
            if prop_name not in new_props:
                if prop_name in old_required:
                    self._add_change(
                        'PROPERTY_REMOVED',
                        path,
                        method,
                        prop_name,
                        f"删除了必填字段 '{prop_name}'",
                        True,
                        'high'
                    )
                else:
                    self._add_change(
                        'PROPERTY_REMOVED',
                        path,
                        method,
                        prop_name,
                        f"删除了可选字段 '{prop_name}'",
                        False,
                        'low'
                    )
        
        for prop_name in new_props:
            if prop_name not in old_props:
                if prop_name in new_required:
                    self._add_change(
                        'PROPERTY_ADDED',
                        path,
                        method,
                        prop_name,
                        f"新增必填字段 '{prop_name}'",
                        True,
                        'medium'
                    )
                else:
                    self._add_change(
                        'PROPERTY_ADDED',
                        path,
                        method,
                        prop_name,
                        f"新增可选字段 '{prop_name}'",
                        False,
                        'low'
                    )
        
        for prop_name in set(old_props.keys()) & set(new_props.keys()):
            old_prop = old_props[prop_name]
            new_prop = new_props[prop_name]
            
            if prop_name in old_required and prop_name not in new_required:
                self._add_change(
                    'PROPERTY_REQUIREMENT_CHANGED',
                    path,
                    method,
                    prop_name,
                    f"字段 '{prop_name}' 从必填变为可选",
                    False,
                    'low'
                )
            elif prop_name not in old_required and prop_name in new_required:
                self._add_change(
                    'PROPERTY_REQUIREMENT_CHANGED',
                    path,
                    method,
                    prop_name,
                    f"字段 '{prop_name}' 从可选变为必填",
                    True,
                    'medium'
                )
            
            old_type = old_prop.get('type', '')
            new_type = new_prop.get('type', '')
            if old_type and new_type and old_type != new_type:
                self._add_change(
                    'PROPERTY_TYPE_CHANGED',
                    path,
                    method,
                    prop_name,
                    f"字段 '{prop_name}' 类型从 {old_type} 变为 {new_type}",
                    True,
                    'medium'
                )
    
    def _add_change(self, change_type: str, path: str, method: str, 
                   field: str, description: str, is_breaking: bool, severity: str):
        self.changes.append({
            'change_type': change_type,
            'path': path,
            'method': method,
            'field': field,
            'description': description,
            'is_breaking': is_breaking,
            'severity': severity
        })

def detect_diffs(old_spec: Dict[str, Any], new_spec: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], bool]:
    detector = OpenAPIDiffDetector(old_spec, new_spec)
    changes = detector.detect()
    has_breaking = any(c['is_breaking'] for c in changes)
    return changes, has_breaking

def get_change_summary(changes: List[Dict[str, Any]]) -> Dict[str, Any]:
    breaking = [c for c in changes if c['is_breaking']]
    non_breaking = [c for c in changes if not c['is_breaking']]
    
    return {
        'total': len(changes),
        'breaking': len(breaking),
        'non_breaking': len(non_breaking),
        'by_type': {},
        'by_severity': {}
    }
