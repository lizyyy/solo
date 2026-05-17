from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from .yaml_parser import ParsedResource, ParseResult


@dataclass
class PortInfo:
    port: int
    name: Optional[str] = None
    protocol: str = "TCP"
    target_port: Optional[int] = None


@dataclass
class ServiceInfo:
    name: str
    namespace: Optional[str]
    ports: List[PortInfo]
    selector: Dict[str, str]
    file_path: str
    line_start: int


@dataclass
class IngressPath:
    path: str
    service_name: str
    service_port: int
    host: Optional[str] = None


@dataclass
class IngressInfo:
    name: str
    namespace: Optional[str]
    paths: List[IngressPath]
    file_path: str
    line_start: int


@dataclass
class PodInfo:
    name: str
    namespace: Optional[str]
    ports: List[PortInfo]
    labels: Dict[str, str]
    file_path: str
    line_start: int


@dataclass
class MappingGap:
    gap_type: str
    severity: str
    message: str
    details: Dict[str, Any]
    file_path: str
    line_start: int


@dataclass
class MappingResult:
    services: List[ServiceInfo] = field(default_factory=list)
    ingresses: List[IngressInfo] = field(default_factory=list)
    pods: List[PodInfo] = field(default_factory=list)
    gaps: List[MappingGap] = field(default_factory=list)
    mapping_chains: List[Dict[str, Any]] = field(default_factory=list)


class PortMapper:
    def __init__(self):
        self.services: List[ServiceInfo] = []
        self.ingresses: List[IngressInfo] = []
        self.pods: List[PodInfo] = []
        self.gaps: List[MappingGap] = []

    def analyze(self, parse_result: ParseResult) -> MappingResult:
        for resource in parse_result.resources:
            self._process_resource(resource)

        self._validate_mappings()
        self._build_mapping_chains()

        return MappingResult(
            services=self.services,
            ingresses=self.ingresses,
            pods=self.pods,
            gaps=self.gaps
        )

    def _process_resource(self, resource: ParsedResource):
        kind = resource.kind
        if kind == 'Service':
            self._process_service(resource)
        elif kind == 'Ingress':
            self._process_ingress(resource)
        elif kind in ['Deployment', 'StatefulSet', 'DaemonSet', 'Pod']:
            self._process_workload(resource)

    def _process_service(self, resource: ParsedResource):
        data = resource.data
        spec = data.get('spec', {})
        ports_data = spec.get('ports', [])
        selector = spec.get('selector', {})

        ports = []
        for p in ports_data:
            port_info = PortInfo(
                port=p.get('port', 0),
                name=p.get('name'),
                protocol=p.get('protocol', 'TCP'),
                target_port=p.get('targetPort')
            )
            ports.append(port_info)

        service = ServiceInfo(
            name=resource.name,
            namespace=resource.namespace,
            ports=ports,
            selector=selector,
            file_path=resource.file_path,
            line_start=resource.line_start
        )
        self.services.append(service)

        if not ports:
            self._add_gap(
                gap_type='SERVICE_NO_PORTS',
                severity='ERROR',
                message=f'Service {resource.name} 没有定义任何端口',
                details={'service': resource.name},
                file_path=resource.file_path,
                line_start=resource.line_start
            )

        if not selector:
            self._add_gap(
                gap_type='SERVICE_NO_SELECTOR',
                severity='WARNING',
                message=f'Service {resource.name} 没有定义 selector',
                details={'service': resource.name},
                file_path=resource.file_path,
                line_start=resource.line_start
            )

    def _process_ingress(self, resource: ParsedResource):
        data = resource.data
        spec = data.get('spec', {})
        rules = spec.get('rules', [])

        paths = []
        for rule in rules:
            host = rule.get('host')
            http = rule.get('http', {})
            paths_data = http.get('paths', [])
            for p in paths_data:
                backend = p.get('backend', {})
                service = backend.get('service', {})
                port_data = service.get('port', {})

                ingress_path = IngressPath(
                    path=p.get('path', '/'),
                    service_name=service.get('name', ''),
                    service_port=port_data.get('number', 0),
                    host=host
                )
                paths.append(ingress_path)

        ingress = IngressInfo(
            name=resource.name,
            namespace=resource.namespace,
            paths=paths,
            file_path=resource.file_path,
            line_start=resource.line_start
        )
        self.ingresses.append(ingress)

        if not paths:
            self._add_gap(
                gap_type='INGRESS_NO_PATHS',
                severity='ERROR',
                message=f'Ingress {resource.name} 没有定义任何路由路径',
                details={'ingress': resource.name},
                file_path=resource.file_path,
                line_start=resource.line_start
            )

    def _process_workload(self, resource: ParsedResource):
        data = resource.data
        kind = resource.kind

        if kind == 'Pod':
            spec = data.get('spec', {})
            metadata = data.get('metadata', {})
            labels = metadata.get('labels', {})
        else:
            spec = data.get('spec', {}).get('template', {}).get('spec', {})
            metadata = data.get('spec', {}).get('template', {}).get('metadata', {})
            labels = metadata.get('labels', {}) if metadata else {}

        containers = spec.get('containers', [])

        all_ports = []
        for container in containers:
            ports_data = container.get('ports', [])
            for p in ports_data:
                port_info = PortInfo(
                    port=p.get('containerPort', 0),
                    name=p.get('name'),
                    protocol=p.get('protocol', 'TCP')
                )
                all_ports.append(port_info)

        pod = PodInfo(
            name=resource.name,
            namespace=resource.namespace,
            ports=all_ports,
            labels=labels,
            file_path=resource.file_path,
            line_start=resource.line_start
        )
        self.pods.append(pod)

    def _validate_mappings(self):
        self._validate_ingress_to_service()
        self._validate_service_to_pod()

    def _validate_ingress_to_service(self):
        for ingress in self.ingresses:
            for path in ingress.paths:
                service_name = path.service_name
                if not service_name:
                    self._add_gap(
                        gap_type='INGRESS_NO_SERVICE',
                        severity='ERROR',
                        message=f'Ingress {ingress.name} 的路径 {path.path} 没有指定后端服务',
                        details={'ingress': ingress.name, 'path': path.path},
                        file_path=ingress.file_path,
                        line_start=ingress.line_start
                    )
                    continue

                matched_services = [s for s in self.services if s.name == service_name]
                if not matched_services:
                    self._add_gap(
                        gap_type='INGRESS_SERVICE_NOT_FOUND',
                        severity='ERROR',
                        message=f'Ingress {ingress.name} 引用的服务 {service_name} 不存在',
                        details={'ingress': ingress.name, 'service': service_name, 'path': path.path},
                        file_path=ingress.file_path,
                        line_start=ingress.line_start
                    )
                    continue

                service = matched_services[0]
                service_ports = [p.port for p in service.ports]
                if path.service_port and path.service_port not in service_ports:
                    self._add_gap(
                        gap_type='INGRESS_PORT_MISMATCH',
                        severity='ERROR',
                        message=f'Ingress {ingress.name} 使用的端口 {path.service_port} 不在服务 {service_name} 的端口列表 {service_ports} 中',
                        details={'ingress': ingress.name, 'service': service_name, 'ingress_port': path.service_port, 'service_ports': service_ports},
                        file_path=ingress.file_path,
                        line_start=ingress.line_start
                    )

    def _validate_service_to_pod(self):
        for service in self.services:
            if not service.selector:
                continue

            matched_pods = []
            for pod in self.pods:
                if self._selector_matches(service.selector, pod.labels):
                    matched_pods.append(pod)

            if not matched_pods:
                self._add_gap(
                    gap_type='SERVICE_NO_MATCHING_PODS',
                    severity='WARNING',
                    message=f'Service {service.name} 的 selector 没有匹配到任何 Pod',
                    details={'service': service.name, 'selector': service.selector},
                    file_path=service.file_path,
                    line_start=service.line_start
                )
                continue

            for port in service.ports:
                target_port = port.target_port
                if target_port is None:
                    target_port = port.port

                target_port_int = int(target_port) if str(target_port).isdigit() else None

                pod_has_port = False
                for pod in matched_pods:
                    pod_ports = [p.port for p in pod.ports]
                    if target_port_int in pod_ports:
                        pod_has_port = True
                        break

                if not pod_has_port:
                    self._add_gap(
                        gap_type='SERVICE_TARGET_PORT_MISMATCH',
                        severity='ERROR',
                        message=f'Service {service.name} 的 targetPort {target_port} 在匹配的 Pod 中不存在',
                        details={'service': service.name, 'target_port': target_port, 'matching_pods': len(matched_pods)},
                        file_path=service.file_path,
                        line_start=service.line_start
                    )

    def _selector_matches(self, selector: Dict[str, str], labels: Dict[str, str]) -> bool:
        for key, value in selector.items():
            if labels.get(key) != value:
                return False
        return True

    def _build_mapping_chains(self):
        pass

    def _add_gap(self, gap_type: str, severity: str, message: str, details: Dict[str, Any],
                 file_path: str, line_start: int):
        self.gaps.append(MappingGap(
            gap_type=gap_type,
            severity=severity,
            message=message,
            details=details,
            file_path=file_path,
            line_start=line_start
        ))
