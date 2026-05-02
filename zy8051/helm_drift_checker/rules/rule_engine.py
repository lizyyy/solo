from typing import Dict, Any, List
from ..parser.policy_parser import UpgradePolicy


class Issue:
    def __init__(self, issue_type: str, severity: str, path: str, message: str, details: Dict[str, Any] = None):
        self.issue_type = issue_type
        self.severity = severity
        self.path = path
        self.message = message
        self.details = details or {}


class RuleEngine:
    def __init__(self, current_values: Dict[str, Any], cluster_snapshot: Dict[str, Any], policy: UpgradePolicy):
        self.current = current_values
        self.cluster = cluster_snapshot
        self.policy = policy
        self.issues: List[Issue] = []

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get nested value by dot-separated path."""
        parts = path.split('.')
        current = data
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current

    def _check_deprecated_fields(self):
        """Check for deprecated fields in current values."""
        for field_path in self.policy.deprecated_fields:
            value = self._get_nested_value(self.current, field_path)
            if value is not None:
                self.issues.append(Issue(
                    issue_type='deprecated',
                    severity='high',
                    path=field_path,
                    message=f"Field '{field_path}' is deprecated but still in use",
                    details={'current_value': value}
                ))

    def _check_resource_limits(self):
        """Check resource quota/limit risks from cluster snapshot."""
        resources = self.cluster.get('resources', {})
        
        for resource_type, items in resources.items():
            for item in items:
                if isinstance(item, dict):
                    spec = item.get('spec', {})
                    containers = spec.get('containers', [])
                    
                    for container in containers:
                        resources = container.get('resources', {})
                        
                        if not resources.get('limits'):
                            self.issues.append(Issue(
                                issue_type='resource_limit_missing',
                                severity='medium',
                                path=f"{resource_type}.{item.get('metadata', {}).get('name', 'unknown')}",
                                message=f"Container {container.get('name')} has no resource limits",
                                details={'container': container.get('name')}
                            ))
                        
                        limits = resources.get('limits', {})
                        cpu_limit = limits.get('cpu')
                        memory_limit = limits.get('memory')
                        
                        thresholds = self.policy.risk_thresholds.get('resource_limits', {})
                        
                        if cpu_limit and self._is_cpu_above_threshold(cpu_limit, thresholds.get('cpu', '2')):
                            self.issues.append(Issue(
                                issue_type='resource_limit_high',
                                severity='high',
                                path=f"{resource_type}.{item.get('metadata', {}).get('name', 'unknown')}",
                                message=f"CPU limit {cpu_limit} exceeds threshold",
                                details={'container': container.get('name'), 'limit': cpu_limit}
                            ))
                        
                        if memory_limit and self._is_memory_above_threshold(memory_limit, thresholds.get('memory', '2Gi')):
                            self.issues.append(Issue(
                                issue_type='resource_limit_high',
                                severity='high',
                                path=f"{resource_type}.{item.get('metadata', {}).get('name', 'unknown')}",
                                message=f"Memory limit {memory_limit} exceeds threshold",
                                details={'container': container.get('name'), 'limit': memory_limit}
                            ))

    def _check_probes(self):
        """Check probe configuration risks."""
        resources = self.cluster.get('resources', {})
        
        for resource_type, items in resources.items():
            for item in items:
                if isinstance(item, dict):
                    spec = item.get('spec', {})
                    containers = spec.get('containers', [])
                    
                    for container in containers:
                        has_liveness = 'livenessProbe' in container
                        has_readiness = 'readinessProbe' in container
                        has_startup = 'startupProbe' in container
                        
                        if not has_liveness and not has_readiness:
                            self.issues.append(Issue(
                                issue_type='probe_missing',
                                severity='medium',
                                path=f"{resource_type}.{item.get('metadata', {}).get('name', 'unknown')}",
                                message=f"Container {container.get('name')} has no liveness/readiness probes",
                                details={'container': container.get('name')}
                            ))

    def _is_cpu_above_threshold(self, limit: str, threshold: str) -> bool:
        """Check if CPU limit is above threshold."""
        try:
            limit_val = float(limit.replace('m', '')) / 1000 if 'm' in limit else float(limit)
            threshold_val = float(threshold.replace('m', '')) / 1000 if 'm' in threshold else float(threshold)
            return limit_val > threshold_val
        except (ValueError, AttributeError):
            return False

    def _is_memory_above_threshold(self, limit: str, threshold: str) -> bool:
        """Check if memory limit is above threshold."""
        def to_bytes(s: str) -> float:
            units = {'Ki': 1024, 'Mi': 1024**2, 'Gi': 1024**3, 'Ti': 1024**4}
            for unit, factor in units.items():
                if s.endswith(unit):
                    return float(s[:-len(unit)]) * factor
            return float(s)
        
        try:
            return to_bytes(limit) > to_bytes(threshold)
        except (ValueError, AttributeError):
            return False

    def analyze(self) -> List[Issue]:
        """Run all rules."""
        self.issues = []
        self._check_deprecated_fields()
        self._check_resource_limits()
        self._check_probes()
        return self.issues
