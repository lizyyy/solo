import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from app.schemas import IssueType, Severity


@dataclass
class RouteInfo:
    path: str
    method: str
    order_index: int
    path_pattern: Any
    is_dynamic: bool
    dynamic_params: List[str]


class FastAPIRouteMatcher:
    DYNAMIC_PARAM_PATTERN = re.compile(r'\{([^}]+)\}')
    CONVERTER_PATTERN = re.compile(r'^(\w+):')
    
    def __init__(self, routes: List[Dict[str, Any]]):
        self.routes: List[RouteInfo] = []
        for route in routes:
            path = route['path']
            method = route['method'].upper()
            order_index = route['order_index']
            
            is_dynamic, dynamic_params = self._parse_dynamic_params(path)
            path_pattern = self._compile_path_pattern(path)
            
            self.routes.append(RouteInfo(
                path=path,
                method=method,
                order_index=order_index,
                path_pattern=path_pattern,
                is_dynamic=is_dynamic,
                dynamic_params=dynamic_params
            ))
        
        self.routes.sort(key=lambda r: r.order_index)
    
    def _parse_dynamic_params(self, path: str) -> Tuple[bool, List[str]]:
        matches = self.DYNAMIC_PARAM_PATTERN.findall(path)
        params = []
        for match in matches:
            if ':' in match:
                param_name = match.split(':')[0]
                params.append(param_name)
            else:
                params.append(match)
        return len(params) > 0, params
    
    def _compile_path_pattern(self, path: str) -> re.Pattern:
        if ':path}' in path:
            pattern = self._compile_path_with_path_converter(path)
        else:
            pattern = self._compile_path_standard(path)
        return re.compile(pattern)
    
    def _compile_path_standard(self, path: str) -> str:
        segments = path.split('/')
        pattern_parts = ['^']
        
        for segment in segments:
            if not segment:
                continue
            
            dynamic_match = self.DYNAMIC_PARAM_PATTERN.match(segment)
            if dynamic_match:
                param_spec = dynamic_match.group(1)
                
                if ':' in param_spec:
                    param_name, converter = param_spec.split(':', 1)
                    if converter == 'int':
                        pattern_parts.append(r'/(-?\d+)')
                    elif converter == 'float':
                        pattern_parts.append(r'/(-?\d+\.?\d*)')
                    elif converter == 'uuid':
                        pattern_parts.append(r'/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
                    else:
                        pattern_parts.append(r'/([^/]+)')
                else:
                    pattern_parts.append(r'/([^/]+)')
            else:
                pattern_parts.append(f'/{re.escape(segment)}')
        
        if path.endswith('/'):
            pattern_parts.append('/?$')
        else:
            pattern_parts.append('/?$')
        
        return ''.join(pattern_parts)
    
    def _compile_path_with_path_converter(self, path: str) -> str:
        match = re.search(r'\{[^}]*(?::path)\}', path)
        if not match:
            return self._compile_path_standard(path)
        
        prefix = path[:match.start()]
        suffix = path[match.end():]
        
        prefix_segments = prefix.split('/')
        pattern_parts = ['^']
        
        for segment in prefix_segments:
            if not segment:
                continue
            dynamic_match = self.DYNAMIC_PARAM_PATTERN.match(segment)
            if dynamic_match:
                param_spec = dynamic_match.group(1)
                if ':' in param_spec:
                    param_name, converter = param_spec.split(':', 1)
                    if converter == 'int':
                        pattern_parts.append(r'/(-?\d+)')
                    else:
                        pattern_parts.append(r'/([^/]+)')
                else:
                    pattern_parts.append(r'/([^/]+)')
            else:
                pattern_parts.append(f'/{re.escape(segment)}')
        
        pattern_parts.append(r'/(.+)')
        
        if suffix:
            suffix = suffix.lstrip('/')
            if suffix:
                pass
        
        pattern_parts.append('$')
        
        return ''.join(pattern_parts)
    
    def match_url(self, url: str, method: str = 'GET') -> Optional[RouteInfo]:
        method = method.upper()
        for route in self.routes:
            if route.method != method and route.method != 'GET':
                continue
            if route.path_pattern.match(url):
                return route
        return None
    
    def match_url_with_details(self, url: str, method: str = 'GET') -> Dict[str, Any]:
        method = method.upper()
        matched_routes = []
        
        for route in self.routes:
            if route.method != method:
                continue
            if route.path_pattern.match(url):
                matched_routes.append(route)
        
        if not matched_routes:
            return {
                'url': url,
                'method': method,
                'matched': False,
                'matched_route': None,
                'matched_order': -1,
                'all_matches': []
            }
        
        matched_route = matched_routes[0]
        return {
            'url': url,
            'method': method,
            'matched': True,
            'matched_route': matched_route.path,
            'matched_method': matched_route.method,
            'matched_order': matched_route.order_index,
            'is_dynamic': matched_route.is_dynamic,
            'all_matches': [
                {
                    'path': r.path,
                    'method': r.method,
                    'order_index': r.order_index,
                    'is_dynamic': r.is_dynamic
                }
                for r in matched_routes
            ]
        }


class RouteHealthAnalyzer:
    def __init__(self, routes: List[Dict[str, Any]]):
        self.matcher = FastAPIRouteMatcher(routes)
        self.routes = routes
    
    def check_dynamic_param_capture(self) -> List[Dict[str, Any]]:
        issues = []
        static_routes = [r for r in self.routes if not self._is_dynamic_path(r['path'])]
        
        for static_route in static_routes:
            path = static_route['path']
            method = static_route['method'].upper()
            order_index = static_route['order_index']
            
            dynamic_routes_before = [
                r for r in self.routes
                if self._is_dynamic_path(r['path']) 
                and r['order_index'] < order_index
                and r['method'].upper() == method
            ]
            
            match_result = self.matcher.match_url_with_details(path, method)
            
            if match_result['matched']:
                matched_route_path = match_result['matched_route']
                
                if matched_route_path != path:
                    if self._is_dynamic_path(matched_route_path):
                        issues.append({
                            'issue_type': IssueType.DYNAMIC_PARAM_CAPTURE,
                            'severity': Severity.CRITICAL,
                            'path': path,
                            'method': method,
                            'affected_routes': [
                                {'path': path, 'method': method, 'order_index': order_index},
                                {'path': matched_route_path, 'method': method, 
                                 'order_index': next(r['order_index'] for r in self.routes if r['path'] == matched_route_path)}
                            ],
                            'description': f'静态路径 "{path}" 被动态路径 "{matched_route_path}" 提前截获',
                            'suggestion': f'将静态路径 "{path}" 移动到动态路径 "{matched_route_path}" 之前定义'
                        })
        
        return issues
    
    def check_duplicate_paths(self) -> List[Dict[str, Any]]:
        issues = []
        path_method_map: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
        
        for route in self.routes:
            path = route['path']
            method = route['method'].upper()
            
            if path not in path_method_map:
                path_method_map[path] = {}
            if method not in path_method_map[path]:
                path_method_map[path][method] = []
            
            path_method_map[path][method].append({
                'path': path,
                'method': method,
                'order_index': route['order_index']
            })
        
        for path, method_map in path_method_map.items():
            for method, route_list in method_map.items():
                if len(route_list) > 1:
                    issues.append({
                        'issue_type': IssueType.DUPLICATE_PATH,
                        'severity': Severity.HIGH,
                        'path': path,
                        'method': method,
                        'affected_routes': route_list,
                        'description': f'路径 "{path}" ({method}) 重复定义了 {len(route_list)} 次',
                        'suggestion': '移除重复的路由定义，只保留一个'
                    })
        
        return issues
    
    def check_method_conflicts(self) -> List[Dict[str, Any]]:
        issues = []
        path_pattern_map: Dict[str, List[Dict[str, Any]]] = {}
        
        for route in self.routes:
            normalized_path = self._normalize_path(route['path'])
            
            if normalized_path not in path_pattern_map:
                path_pattern_map[normalized_path] = []
            
            path_pattern_map[normalized_path].append({
                'path': route['path'],
                'method': route['method'].upper(),
                'order_index': route['order_index']
            })
        
        for normalized_path, route_list in path_pattern_map.items():
            methods = set(r['method'] for r in route_list)
            if 'GET' in methods and 'POST' in methods:
                continue
            
            same_pattern_routes = {}
            for route in route_list:
                path_key = route['path']
                if path_key not in same_pattern_routes:
                    same_pattern_routes[path_key] = []
                same_pattern_routes[path_key].append(route)
            
            for path, routes_with_same_path in same_pattern_routes.items():
                if len(routes_with_same_path) > 1:
                    methods_for_path = [r['method'] for r in routes_with_same_path]
                    if len(set(methods_for_path)) < len(methods_for_path):
                        for method in set(methods_for_path):
                            routes_with_method = [r for r in routes_with_same_path if r['method'] == method]
                            if len(routes_with_method) > 1:
                                issues.append({
                                    'issue_type': IssueType.METHOD_CONFLICT,
                                    'severity': Severity.HIGH,
                                    'path': path,
                                    'method': method,
                                    'affected_routes': routes_with_method,
                                    'description': f'同一路径 "{path}" 相同方法 "{method}" 定义多次',
                                    'suggestion': '合并或移除重复的路由定义'
                                })
        
        return issues
    
    def check_unreachable_routes(self) -> List[Dict[str, Any]]:
        issues = []
        
        for i, route in enumerate(self.routes):
            path = route['path']
            method = route['method'].upper()
            order_index = route['order_index']
            
            match_result = self.matcher.match_url_with_details(path, method)
            
            if match_result['matched']:
                matched_route_path = match_result['matched_route']
                matched_order = match_result['matched_order']
                
                if matched_route_path != path and matched_order < order_index:
                    issues.append({
                        'issue_type': IssueType.UNREACHABLE,
                        'severity': Severity.CRITICAL,
                        'path': path,
                        'method': method,
                        'affected_routes': [
                            {'path': path, 'method': method, 'order_index': order_index},
                            {'path': matched_route_path, 'method': method, 'order_index': matched_order}
                        ],
                        'description': f'路由 "{path}" 永远不会被匹配，会被 "{matched_route_path}" 提前截获',
                        'suggestion': f'重新排序路由，将更具体的路径 "{path}" 放在前面，或者修改路径模式'
                    })
        
        return issues
    
    def run_all_checks(self) -> List[Dict[str, Any]]:
        issues = []
        issues.extend(self.check_dynamic_param_capture())
        issues.extend(self.check_duplicate_paths())
        issues.extend(self.check_method_conflicts())
        issues.extend(self.check_unreachable_routes())
        
        return sorted(issues, key=lambda x: {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3
        }[x['severity']])
    
    def get_fix_order(self, issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        ordered_suggestions = []
        
        critical_issues = [i for i in issues if i['severity'] == Severity.CRITICAL]
        high_issues = [i for i in issues if i['severity'] == Severity.HIGH]
        medium_issues = [i for i in issues if i['severity'] == Severity.MEDIUM]
        
        priority = 1
        for issue in critical_issues:
            if issue['issue_type'] == IssueType.DYNAMIC_PARAM_CAPTURE:
                ordered_suggestions.append({
                    'priority': priority,
                    'issue_type': issue['issue_type'],
                    'description': issue['description'],
                    'affected_paths': [r['path'] for r in issue['affected_routes']],
                    'suggested_action': issue['suggestion']
                })
                priority += 1
        
        for issue in critical_issues:
            if issue['issue_type'] == IssueType.UNREACHABLE:
                ordered_suggestions.append({
                    'priority': priority,
                    'issue_type': issue['issue_type'],
                    'description': issue['description'],
                    'affected_paths': [r['path'] for r in issue['affected_routes']],
                    'suggested_action': issue['suggestion']
                })
                priority += 1
        
        for issue in high_issues:
            ordered_suggestions.append({
                'priority': priority,
                'issue_type': issue['issue_type'],
                'description': issue['description'],
                'affected_paths': [r['path'] for r in issue['affected_routes']],
                'suggested_action': issue['suggestion']
            })
            priority += 1
        
        for issue in medium_issues:
            ordered_suggestions.append({
                'priority': priority,
                'issue_type': issue['issue_type'],
                'description': issue['description'],
                'affected_paths': [r['path'] for r in issue['affected_routes']],
                'suggested_action': issue['suggestion']
            })
            priority += 1
        
        return ordered_suggestions
    
    def test_sample_requests(self, sample_urls: List[str]) -> List[Dict[str, Any]]:
        results = []
        
        for url in sample_urls:
            result = self.matcher.match_url_with_details(url, 'GET')
            results.append(result)
        
        return results
    
    def _is_dynamic_path(self, path: str) -> bool:
        return '{' in path and '}' in path
    
    def _normalize_path(self, path: str) -> str:
        normalized = re.sub(r'\{[^}]+\}', '{param}', path)
        return normalized.lower()
