import os
import re
import json
from pathlib import Path
from typing import List, Tuple, Optional
import yaml

from .models import RouteRule, RequestSample, BadLine, MatchType


class ConfigParser:
    def __init__(self):
        self.bad_lines: List[BadLine] = []

    def parse_file(self, file_path: str) -> Tuple[List[RouteRule], List[RequestSample], List[BadLine]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        routes: List[RouteRule] = []
        requests: List[RequestSample] = []
        self.bad_lines = []

        if path.suffix.lower() in ('.yaml', '.yml'):
            routes, requests = self._parse_yaml(path)
        elif path.suffix.lower() == '.json':
            routes, requests = self._parse_json(path)
        elif path.suffix.lower() == '.conf':
            routes = self._parse_nginx_conf(path)
        elif path.suffix.lower() == '.txt':
            routes, requests = self._parse_text(path)
        else:
            routes, requests = self._parse_text(path)

        return routes, requests, self.bad_lines

    def parse_directory(self, dir_path: str) -> Tuple[List[RouteRule], List[RequestSample], List[BadLine]]:
        path = Path(dir_path)
        if not path.is_dir():
            raise NotADirectoryError(f"目录不存在: {dir_path}")

        all_routes: List[RouteRule] = []
        all_requests: List[RequestSample] = []
        all_bad_lines: List[BadLine] = []

        for file_path in path.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in ('.yaml', '.yml', '.json', '.conf', '.txt'):
                try:
                    routes, requests, bad_lines = self.parse_file(str(file_path))
                    all_routes.extend(routes)
                    all_requests.extend(requests)
                    all_bad_lines.extend(bad_lines)
                except Exception as e:
                    all_bad_lines.append(BadLine(
                        source_file=str(file_path),
                        line_number=0,
                        raw_content="",
                        error_message=f"文件解析失败: {str(e)}",
                        error_type="file_parse_error"
                    ))

        return all_routes, all_requests, all_bad_lines

    def _parse_yaml(self, path: Path) -> Tuple[List[RouteRule], List[RequestSample]]:
        routes: List[RouteRule] = []
        requests: List[RequestSample] = []

        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                data = yaml.safe_load(content)

            if not data:
                return routes, requests

            if 'routes' in data and isinstance(data['routes'], list):
                for idx, route_data in enumerate(data['routes']):
                    try:
                        if isinstance(route_data, dict) and 'path' in route_data and 'upstream' in route_data:
                            match_type = MatchType(route_data.get('match_type', 'prefix'))
                            routes.append(RouteRule(
                                path=route_data['path'],
                                upstream=route_data['upstream'],
                                match_type=match_type,
                                priority=route_data.get('priority', 0),
                                methods=route_data.get('methods', ["GET", "POST", "PUT", "DELETE"]),
                                headers=route_data.get('headers', {}),
                                source_file=str(path),
                                line_number=idx + 1,
                                raw_content=yaml.dump(route_data)
                            ))
                    except Exception as e:
                        self.bad_lines.append(BadLine(
                            source_file=str(path),
                            line_number=idx + 1,
                            raw_content=yaml.dump(route_data) if isinstance(route_data, dict) else str(route_data),
                            error_message=f"路由解析失败: {str(e)}",
                            error_type="route_parse_error"
                        ))

            if 'requests' in data and isinstance(data['requests'], list):
                for idx, req_data in enumerate(data['requests']):
                    try:
                        if isinstance(req_data, dict) and 'path' in req_data:
                            requests.append(RequestSample(
                                path=req_data['path'],
                                method=req_data.get('method', 'GET'),
                                headers=req_data.get('headers', {}),
                                source_file=str(path),
                                line_number=idx + 1,
                                raw_content=yaml.dump(req_data)
                            ))
                    except Exception as e:
                        self.bad_lines.append(BadLine(
                            source_file=str(path),
                            line_number=idx + 1,
                            raw_content=yaml.dump(req_data) if isinstance(req_data, dict) else str(req_data),
                            error_message=f"请求解析失败: {str(e)}",
                            error_type="request_parse_error"
                        ))

        except yaml.YAMLError as e:
            self.bad_lines.append(BadLine(
                source_file=str(path),
                line_number=getattr(e, 'line', 0),
                raw_content=str(e),
                error_message=f"YAML解析错误: {str(e)}",
                error_type="yaml_syntax_error"
            ))

        return routes, requests

    def _parse_json(self, path: Path) -> Tuple[List[RouteRule], List[RequestSample]]:
        routes: List[RouteRule] = []
        requests: List[RequestSample] = []

        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if 'routes' in data and isinstance(data['routes'], list):
                for idx, route_data in enumerate(data['routes']):
                    try:
                        if isinstance(route_data, dict) and 'path' in route_data and 'upstream' in route_data:
                            match_type = MatchType(route_data.get('match_type', 'prefix'))
                            routes.append(RouteRule(
                                path=route_data['path'],
                                upstream=route_data['upstream'],
                                match_type=match_type,
                                priority=route_data.get('priority', 0),
                                methods=route_data.get('methods', ["GET", "POST", "PUT", "DELETE"]),
                                headers=route_data.get('headers', {}),
                                source_file=str(path),
                                line_number=idx + 1,
                                raw_content=json.dumps(route_data)
                            ))
                    except Exception as e:
                        self.bad_lines.append(BadLine(
                            source_file=str(path),
                            line_number=idx + 1,
                            raw_content=json.dumps(route_data) if isinstance(route_data, dict) else str(route_data),
                            error_message=f"路由解析失败: {str(e)}",
                            error_type="route_parse_error"
                        ))

            if 'requests' in data and isinstance(data['requests'], list):
                for idx, req_data in enumerate(data['requests']):
                    try:
                        if isinstance(req_data, dict) and 'path' in req_data:
                            requests.append(RequestSample(
                                path=req_data['path'],
                                method=req_data.get('method', 'GET'),
                                headers=req_data.get('headers', {}),
                                source_file=str(path),
                                line_number=idx + 1,
                                raw_content=json.dumps(req_data)
                            ))
                    except Exception as e:
                        self.bad_lines.append(BadLine(
                            source_file=str(path),
                            line_number=idx + 1,
                            raw_content=json.dumps(req_data) if isinstance(req_data, dict) else str(req_data),
                            error_message=f"请求解析失败: {str(e)}",
                            error_type="request_parse_error"
                        ))

        except json.JSONDecodeError as e:
            self.bad_lines.append(BadLine(
                source_file=str(path),
                line_number=e.lineno,
                raw_content=str(e),
                error_message=f"JSON解析错误: {str(e)}",
                error_type="json_syntax_error"
            ))

        return routes, requests

    def _parse_nginx_conf(self, path: Path) -> List[RouteRule]:
        routes: List[RouteRule] = []

        location_pattern = re.compile(r'location\s+([~=]?)\s*([^{]+)\s*{\s*proxy_pass\s+http://([^/;]+)')

        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        content = ''.join(lines)
        matches = location_pattern.finditer(content)

        for match in matches:
            modifier = match.group(1)
            path_pattern = match.group(2).strip()
            upstream = match.group(3).strip()

            if modifier == '=':
                match_type = MatchType.EXACT
            elif modifier == '~':
                match_type = MatchType.REGEX
            else:
                match_type = MatchType.PREFIX

            line_num = content[:match.start()].count('\n') + 1

            routes.append(RouteRule(
                path=path_pattern,
                upstream=upstream,
                match_type=match_type,
                priority=10 if match_type == MatchType.EXACT else 0,
                source_file=str(path),
                line_number=line_num,
                raw_content=match.group(0)
            ))

        return routes

    def _parse_text(self, path: Path) -> Tuple[List[RouteRule], List[RequestSample]]:
        routes: List[RouteRule] = []
        requests: List[RequestSample] = []

        import re
        path_pattern = re.compile(r'^[a-zA-Z0-9_/.-]+$')

        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            parts = line.split()
            if len(parts) >= 2:
                if parts[0].upper() in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'):
                    req_path = parts[1]
                    if path_pattern.match(req_path) or req_path.startswith('/'):
                        requests.append(RequestSample(
                            path=req_path,
                            method=parts[0].upper(),
                            source_file=str(path),
                            line_number=line_num,
                            raw_content=line
                        ))
                    else:
                        self.bad_lines.append(BadLine(
                            source_file=str(path),
                            line_number=line_num,
                            raw_content=line,
                            error_message=f"无效的请求路径格式: {req_path}",
                            error_type="invalid_path"
                        ))
                elif '->' in line or '=>' in line:
                    separator = '->' if '->' in line else '=>'
                    path_part, upstream_part = line.split(separator, 1)
                    path_pattern_str = path_part.strip()
                    upstream = upstream_part.strip()
                    if path_pattern.match(path_pattern_str) or path_pattern_str.startswith('/'):
                        routes.append(RouteRule(
                            path=path_pattern_str,
                            upstream=upstream,
                            source_file=str(path),
                            line_number=line_num,
                            raw_content=line
                        ))
                    else:
                        self.bad_lines.append(BadLine(
                            source_file=str(path),
                            line_number=line_num,
                            raw_content=line,
                            error_message=f"无效的路由路径格式: {path_pattern_str}",
                            error_type="invalid_path"
                        ))
                else:
                    req_path = parts[0]
                    if path_pattern.match(req_path) or req_path.startswith('/'):
                        requests.append(RequestSample(
                            path=req_path,
                            method="GET",
                            source_file=str(path),
                            line_number=line_num,
                            raw_content=line
                        ))
                    else:
                        self.bad_lines.append(BadLine(
                            source_file=str(path),
                            line_number=line_num,
                            raw_content=line,
                            error_message=f"无效的路径格式: {req_path}",
                            error_type="invalid_path"
                        ))
            elif len(parts) == 1:
                req_path = parts[0]
                if path_pattern.match(req_path) or req_path.startswith('/'):
                    requests.append(RequestSample(
                        path=req_path,
                        method="GET",
                        source_file=str(path),
                        line_number=line_num,
                        raw_content=line
                    ))
                else:
                    self.bad_lines.append(BadLine(
                        source_file=str(path),
                        line_number=line_num,
                        raw_content=line,
                        error_message=f"无效的路径格式: {req_path}",
                        error_type="invalid_path"
                    ))
            else:
                self.bad_lines.append(BadLine(
                    source_file=str(path),
                    line_number=line_num,
                    raw_content=line,
                    error_message="无法解析的行格式",
                    error_type="parse_error"
                ))

        return routes, requests
