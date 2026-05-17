import yaml
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field


@dataclass
class RouteMatch:
    prefix: Optional[str] = None
    path: Optional[str] = None
    regex: Optional[str] = None
    headers: List[Dict] = field(default_factory=list)
    query_parameters: List[Dict] = field(default_factory=list)


@dataclass
class Route:
    name: str
    match: RouteMatch
    cluster: str
    priority: int = 0
    route_config: Dict = field(default_factory=dict)


@dataclass
class VirtualHost:
    name: str
    domains: List[str]
    routes: List[Route]


@dataclass
class EnvoyConfig:
    virtual_hosts: List[VirtualHost]
    clusters: List[str]
    raw_config: Dict = field(default_factory=dict)


class ConfigParserError(Exception):
    def __init__(self, message: str, location: str = None):
        self.message = message
        self.location = location
        super().__init__(message)


class EnvoyConfigParser:
    def __init__(self):
        self.errors: List[Dict] = []

    def parse(self, config_path: str) -> EnvoyConfig:
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                if config_path.endswith('.json'):
                    raw_config = json.load(f)
                else:
                    raw_config = yaml.safe_load(f)
        except FileNotFoundError:
            raise ConfigParserError(f"配置文件不存在: {config_path}", "file")
        except yaml.YAMLError as e:
            raise ConfigParserError(f"YAML解析错误: {str(e)}", "syntax")
        except json.JSONDecodeError as e:
            raise ConfigParserError(f"JSON解析错误: {str(e)}", "syntax")
        except Exception as e:
            raise ConfigParserError(f"读取配置失败: {str(e)}", "io")

        return self._parse_config(raw_config)

    def _parse_config(self, raw_config: Dict) -> EnvoyConfig:
        virtual_hosts = []
        clusters = self._extract_clusters(raw_config)
        route_configs = self._find_route_configurations(raw_config)
        
        for route_config in route_configs:
            vhosts = route_config.get('virtual_hosts', [])
            for idx, vhost in enumerate(vhosts):
                try:
                    parsed_vhost = self._parse_virtual_host(vhost, idx)
                    virtual_hosts.append(parsed_vhost)
                except Exception as e:
                    self.errors.append({
                        'type': 'virtual_host',
                        'index': idx,
                        'name': vhost.get('name', 'unknown'),
                        'error': str(e)
                    })

        return EnvoyConfig(
            virtual_hosts=virtual_hosts,
            clusters=clusters,
            raw_config=raw_config
        )

    def _extract_clusters(self, raw_config: Dict) -> List[str]:
        clusters = []
        try:
            if 'static_resources' in raw_config:
                cluster_list = raw_config['static_resources'].get('clusters', [])
                clusters = [c.get('name') for c in cluster_list if c.get('name')]
            elif 'clusters' in raw_config:
                clusters = [c.get('name') for c in raw_config['clusters'] if c.get('name')]
        except Exception:
            pass
        return clusters

    def _find_route_configurations(self, raw_config: Dict) -> List[Dict]:
        route_configs = []
        try:
            if 'static_resources' in raw_config:
                listeners = raw_config['static_resources'].get('listeners', [])
                for listener in listeners:
                    filter_chains = listener.get('filter_chains', [])
                    for fc in filter_chains:
                        filters = fc.get('filters', [])
                        for f in filters:
                            if f.get('name') == 'envoy.filters.network.http_connection_manager':
                                config = f.get('typed_config', {})
                                rds = config.get('route_config') or config.get('rds', {}).get('route_config')
                                if rds:
                                    route_configs.append(rds)
            elif 'route_config' in raw_config:
                route_configs.append(raw_config['route_config'])
        except Exception as e:
            self.errors.append({
                'type': 'route_config',
                'error': f"查找路由配置失败: {str(e)}"
            })
        return route_configs

    def _parse_virtual_host(self, vhost_data: Dict, index: int) -> VirtualHost:
        name = vhost_data.get('name', f'vhost_{index}')
        domains = vhost_data.get('domains', ['*'])
        routes = []

        routes_data = vhost_data.get('routes', [])
        for route_idx, route_data in enumerate(routes_data):
            try:
                route = self._parse_route(route_data, route_idx)
                routes.append(route)
            except Exception as e:
                self.errors.append({
                    'type': 'route',
                    'virtual_host': name,
                    'index': route_idx,
                    'error': str(e)
                })

        return VirtualHost(name=name, domains=domains, routes=routes)

    def _parse_route(self, route_data: Dict, index: int) -> Route:
        name = route_data.get('name', f'route_{index}')
        match_data = route_data.get('match', {})
        route_match = RouteMatch(
            prefix=match_data.get('prefix'),
            path=match_data.get('path'),
            regex=match_data.get('regex'),
            headers=match_data.get('headers', []),
            query_parameters=match_data.get('query_parameters', [])
        )
        route_action = route_data.get('route', {})
        cluster = route_action.get('cluster', '')
        return Route(
            name=name,
            match=route_match,
            cluster=cluster,
            priority=index,
            route_config=route_data
        )

    def get_errors(self) -> List[Dict]:
        return self.errors
