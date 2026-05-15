from typing import List, Tuple, Set
from database import SessionLocal, LatencyBucket, Incident, SlowRequestSample
import uuid
from datetime import datetime


class IncidentRulesEngine:
    def __init__(self):
        self.db = SessionLocal()
        self.buckets = self.db.query(LatencyBucket).all()

    def get_bucket_for_latency(self, latency: float) -> LatencyBucket:
        for bucket in sorted(self.buckets, key=lambda x: x.min_latency):
            if bucket.min_latency <= latency < bucket.max_latency:
                return bucket
        return self.buckets[-1]

    def calculate_severity(self, p99_latency: float, slow_ratio: float) -> str:
        bucket = self.get_bucket_for_latency(p99_latency)
        if slow_ratio > 0.5:
            severity_map = {
                "NORMAL": "warning",
                "WARNING": "error",
                "ALERT": "critical",
                "CRITICAL": "fatal",
                "FATAL": "fatal"
            }
            return severity_map.get(bucket.bucket_name, bucket.severity)
        return bucket.severity

    def identify_affected_tenants(self, samples: List[SlowRequestSample]) -> Tuple[int, str]:
        tenant_set = set()
        for sample in samples:
            if hasattr(sample, 'tenant_id'):
                tenant_set.add(sample.tenant_id)
            elif isinstance(sample, dict):
                tenant_set.add(sample.get('tenant_id', 'unknown'))
        tenant_list = sorted(list(tenant_set))
        return len(tenant_list), ",".join(tenant_list)

    def should_retain_sample(self, latency: float, sample_index: int, total_samples: int) -> bool:
        if latency > 3000:
            return True
        if sample_index < 10:
            return True
        if sample_index < int(total_samples * 0.1):
            return True
        return False

    def filter_samples(self, samples: List) -> List:
        filtered = []
        for i, sample in enumerate(samples):
            latency = sample.latency if hasattr(sample, 'latency') else sample.get('latency', 0)
            if self.should_retain_sample(latency, i, len(samples)):
                filtered.append(sample)
        return filtered

    def generate_incident_id(self) -> str:
        return f"INC-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

    def determine_initial_status(self, severity: str) -> str:
        status_map = {
            "info": "DETECTED",
            "warning": "INVESTIGATING",
            "error": "INVESTIGATING",
            "critical": "ESCALATED",
            "fatal": "ESCALATED"
        }
        return status_map.get(severity, "DETECTED")

    def get_valid_status_transitions(self) -> dict:
        return {
            "DETECTED": ["INVESTIGATING", "FALSE_POSITIVE"],
            "INVESTIGATING": ["ESCALATED", "RESOLVED", "FALSE_POSITIVE"],
            "ESCALATED": ["RESOLVED", "FALSE_POSITIVE"],
            "RESOLVED": ["CLOSED"],
            "FALSE_POSITIVE": ["CLOSED"],
            "CLOSED": []
        }

    def is_valid_transition(self, from_status: str, to_status: str) -> bool:
        transitions = self.get_valid_status_transitions()
        return to_status in transitions.get(from_status, [])

    def get_status_explanation(self, status: str, incident: Incident) -> str:
        explanations = {
            "DETECTED": f"系统自动检测到 {incident.api_path} 接口延迟异常，P99 延迟 {incident.p99_latency:.0f}ms 超过阈值",
            "INVESTIGATING": f"运维团队正在排查该接口延迟问题，已发现 {incident.affected_tenants} 个受影响租户",
            "ESCALATED": f"问题已升级，涉及 {incident.slow_requests} 个慢请求，{incident.affected_tenants} 个租户受影响",
            "RESOLVED": f"问题已修复，接口延迟恢复正常，持续时间 {self.calculate_duration(incident)}",
            "FALSE_POSITIVE": "经核实，该告警为误报，无实际业务影响",
            "CLOSED": f"事故已闭环，最终确认影响 {incident.affected_tenants} 个租户"
        }
        return explanations.get(status, "状态未知")

    def calculate_duration(self, incident: Incident) -> str:
        if incident.end_time:
            duration = incident.end_time - incident.start_time
        else:
            duration = datetime.utcnow() - incident.start_time
        hours = duration.total_seconds() // 3600
        minutes = (duration.total_seconds() % 3600) // 60
        if hours > 0:
            return f"{int(hours)}小时{int(minutes)}分钟"
        return f"{int(minutes)}分钟"

    def close(self):
        self.db.close()
