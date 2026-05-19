import yaml
import os
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from database import IssueType


@dataclass
class ContainerResources:
    namespace: str
    workload_name: str
    workload_type: str
    container_name: str
    cpu_requests: str
    memory_requests: str
    cpu_limits: str
    memory_limits: str
    yaml_file_path: str


class K8sResourceParser:
    WORKLOAD_TYPES = ["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob", "Pod"]

    def __init__(self, cpu_ratio_threshold: float = 2.0, memory_ratio_threshold: float = 2.0):
        self.cpu_ratio_threshold = cpu_ratio_threshold
        self.memory_ratio_threshold = memory_ratio_threshold

    @staticmethod
    def parse_cpu_value(value: str) -> float:
        if not value:
            return 0.0
        value = str(value).strip()
        if value.endswith('m'):
            return float(value[:-1]) / 1000.0
        try:
            return float(value)
        except ValueError:
            return 0.0

    @staticmethod
    def parse_memory_value(value: str) -> float:
        if not value:
            return 0.0
        value = str(value).strip()
        units = {
            'Ki': 1024,
            'Mi': 1024 ** 2,
            'Gi': 1024 ** 3,
            'Ti': 1024 ** 4,
            'K': 1000,
            'M': 1000 ** 2,
            'G': 1000 ** 3,
            'T': 1000 ** 4,
        }
        for unit, multiplier in units.items():
            if value.endswith(unit):
                try:
                    return float(value[:-len(unit)]) * multiplier
                except ValueError:
                    return 0.0
        try:
            return float(value)
        except ValueError:
            return 0.0

    def calculate_ratio(self, requests: str, limits: str, is_cpu: bool) -> float:
        if is_cpu:
            req_val = self.parse_cpu_value(requests)
            lim_val = self.parse_cpu_value(limits)
        else:
            req_val = self.parse_memory_value(requests)
            lim_val = self.parse_memory_value(limits)
        if req_val == 0 or lim_val == 0:
            return 0.0
        return lim_val / req_val

    def determine_issue_type(self, cpu_req: str, mem_req: str, cpu_lim: str, mem_lim: str) -> Tuple[IssueType, float, float]:
        has_cpu_req = bool(cpu_req and cpu_req.strip())
        has_mem_req = bool(mem_req and mem_req.strip())
        has_cpu_lim = bool(cpu_lim and cpu_lim.strip())
        has_mem_lim = bool(mem_lim and mem_lim.strip())

        has_requests = has_cpu_req or has_mem_req
        has_limits = has_cpu_lim or has_mem_lim

        cpu_ratio = self.calculate_ratio(cpu_req, cpu_lim, is_cpu=True)
        memory_ratio = self.calculate_ratio(mem_req, mem_lim, is_cpu=False)

        if not has_requests and not has_limits:
            return IssueType.MISSING_BOTH, cpu_ratio, memory_ratio
        elif not has_requests:
            return IssueType.MISSING_REQUESTS, cpu_ratio, memory_ratio
        elif not has_limits:
            return IssueType.MISSING_LIMITS, cpu_ratio, memory_ratio

        if cpu_ratio > self.cpu_ratio_threshold or memory_ratio > self.memory_ratio_threshold:
            return IssueType.RATIO_MISMATCH, cpu_ratio, memory_ratio

        return IssueType.NORMAL, cpu_ratio, memory_ratio

    def parse_yaml_file(self, file_path: str) -> List[ContainerResources]:
        containers = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                docs = list(yaml.safe_load_all(f))

            for doc in docs:
                if not doc or not isinstance(doc, dict):
                    continue

                kind = doc.get('kind', '')
                if kind not in self.WORKLOAD_TYPES:
                    continue

                metadata = doc.get('metadata', {})
                namespace = metadata.get('namespace', 'default')
                name = metadata.get('name', 'unknown')

                spec = doc.get('spec', {})

                if kind == 'CronJob':
                    spec = spec.get('jobTemplate', {}).get('spec', {})

                if kind == 'Pod':
                    template_spec = spec
                else:
                    template = spec.get('template', {})
                    template_spec = template.get('spec', {})

                pod_containers = template_spec.get('containers', [])

                for container in pod_containers:
                    container_name = container.get('name', 'unknown')
                    resources = container.get('resources', {})

                    requests = resources.get('requests', {}) or {}
                    limits = resources.get('limits', {}) or {}

                    containers.append(ContainerResources(
                        namespace=namespace,
                        workload_name=name,
                        workload_type=kind,
                        container_name=container_name,
                        cpu_requests=str(requests.get('cpu', '')),
                        memory_requests=str(requests.get('memory', '')),
                        cpu_limits=str(limits.get('cpu', '')),
                        memory_limits=str(limits.get('memory', '')),
                        yaml_file_path=file_path
                    ))

        except Exception as e:
            print(f"Error parsing {file_path}: {e}")

        return containers

    def parse_directory(self, dir_path: str) -> Tuple[List[ContainerResources], int]:
        all_containers = []
        file_count = 0

        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.endswith(('.yaml', '.yml')):
                    file_path = os.path.join(root, file)
                    file_count += 1
                    containers = self.parse_yaml_file(file_path)
                    all_containers.extend(containers)

        return all_containers, file_count
