"""
关联算法和评分系统
"""

from typing import List, Dict, Optional, Tuple
from datetime import timedelta, datetime
from .models import (
    Change, Alert, ServiceAlias, CorrelationScore, CorrelationResult,
    ChangeType, MetricType
)


class Correlator:
    def __init__(
        self,
        time_window_minutes: int = 60,
        service_aliases: Optional[List[ServiceAlias]] = None
    ):
        self.time_window_minutes = time_window_minutes
        self.service_aliases = service_aliases or []
        self._alias_map = self._build_alias_map()

        self.change_metric_impact = {
            ChangeType.DEPLOYMENT: [
                MetricType.ERROR_RATE,
                MetricType.LATENCY,
                MetricType.AVAILABILITY,
            ],
            ChangeType.CONFIG_CHANGE: [
                MetricType.LATENCY,
                MetricType.ERROR_RATE,
                MetricType.CPU,
                MetricType.MEMORY,
            ],
            ChangeType.SCALE: [
                MetricType.CPU,
                MetricType.MEMORY,
                MetricType.NETWORK,
            ],
        }

    def _build_alias_map(self) -> Dict[str, str]:
        alias_map = {}
        for alias in self.service_aliases:
            canonical = alias.canonical.lower()
            alias_map[canonical] = canonical
            for a in alias.aliases:
                alias_map[a.lower()] = canonical
        return alias_map

    def _normalize_service(self, service: str) -> str:
        normalized = service.lower()
        return self._alias_map.get(normalized, normalized)

    def _calculate_time_score(
        self, change: Change, alert: Alert
    ) -> Tuple[float, str]:
        change_end = change.end_time or change.start_time
        alert_start = alert.start_time

        if alert_start < change.start_time:
            return 0.0, f"告警时间({alert_start})早于变更开始时间({change.start_time})"

        delta = (alert_start - change_end).total_seconds() / 60
        window = self.time_window_minutes

        if delta <= 5:
            return 1.0, f"告警在变更结束后{delta:.1f}分钟内发生，时间高度相关"
        elif delta <= 15:
            return 0.8, f"告警在变更结束后{delta:.1f}分钟内发生，时间强相关"
        elif delta <= 30:
            return 0.6, f"告警在变更结束后{delta:.1f}分钟内发生，时间相关"
        elif delta <= window:
            score = 0.6 * (1 - (delta - 30) / (window - 30))
            return max(0.2, score), f"告警在变更结束后{delta:.1f}分钟内发生，在时间窗口{window}分钟内"
        else:
            return 0.0, f"告警在变更结束后{delta:.1f}分钟发生，超出时间窗口{window}分钟"

    def _calculate_service_score(
        self, change: Change, alert: Alert
    ) -> Tuple[float, str]:
        change_service = self._normalize_service(change.service)
        alert_service = self._normalize_service(alert.service)

        if change_service == alert_service:
            return 1.0, f"服务名完全匹配: {change.service}"

        change_parts = change_service.split("-")
        alert_parts = alert_service.split("-")

        common_parts = set(change_parts) & set(alert_parts)
        if len(common_parts) >= 2:
            return 0.7, f"服务名部分匹配，共有部分: {', '.join(common_parts)}"

        if change_service in alert_service or alert_service in change_service:
            return 0.5, f"服务名包含关系: {change.service} vs {alert.service}"

        return 0.0, f"服务名不匹配: {change.service} vs {alert.service}"

    def _calculate_instance_score(
        self, change: Change, alert: Alert
    ) -> Tuple[float, str]:
        if change.instance is None and alert.instance is None:
            return 0.5, "变更和告警都未指定实例，基于服务级别关联"

        if change.instance is None:
            return 0.3, "变更未指定实例，告警影响范围可能更广"

        if alert.instance is None:
            return 0.3, "告警未指定实例，变更影响范围可能更广"

        if change.instance == alert.instance:
            return 1.0, f"实例完全匹配: {change.instance}"

        if change.instance.split(".")[0] == alert.instance.split(".")[0]:
            return 0.6, f"实例主机名匹配: {change.instance.split('.')[0]}"

        return 0.0, f"实例不匹配: {change.instance} vs {alert.instance}"

    def _calculate_tenant_score(
        self, change: Change, alert: Alert
    ) -> Tuple[float, str]:
        if change.tenant is None and alert.tenant is None:
            return 0.5, "变更和告警都未指定租户，基于服务级别关联"

        if change.tenant is None:
            return 0.3, "变更未指定租户，可能影响所有租户"

        if alert.tenant is None:
            return 0.3, "告警未指定租户，可能影响所有租户"

        if change.tenant == alert.tenant:
            return 1.0, f"租户完全匹配: {change.tenant}"

        return 0.0, f"租户不匹配: {change.tenant} vs {alert.tenant}"

    def _calculate_metric_score(
        self, change: Change, alert: Alert
    ) -> Tuple[float, str]:
        impacted_metrics = self.change_metric_impact.get(change.type, [])

        if alert.metric_type in impacted_metrics:
            return 1.0, f"{change.type.value}变更通常会影响{alert.metric_type.value}指标"

        return 0.2, f"{change.type.value}变更与{alert.metric_type.value}指标关联性较弱"

    def correlate(
        self, changes: List[Change], alerts: List[Alert]
    ) -> List[CorrelationResult]:
        active_changes = [c for c in changes if not c.excluded]
        results = []

        for change in active_changes:
            for alert in alerts:
                score = self._score_pair(change, alert)
                if score.total_score > 0:
                    result = CorrelationResult(
                        change=change,
                        alert=alert,
                        score=score,
                        is_root_cause=change.marked_cause,
                    )
                    results.append(result)

        results.sort(key=lambda r: r.score.total_score, reverse=True)
        return results

    def _score_pair(self, change: Change, alert: Alert) -> CorrelationScore:
        time_score, time_reason = self._calculate_time_score(change, alert)
        service_score, service_reason = self._calculate_service_score(change, alert)
        instance_score, instance_reason = self._calculate_instance_score(change, alert)
        tenant_score, tenant_reason = self._calculate_tenant_score(change, alert)
        metric_score, metric_reason = self._calculate_metric_score(change, alert)

        weights = {
            "time": 0.30,
            "service": 0.25,
            "instance": 0.15,
            "tenant": 0.10,
            "metric": 0.20,
        }

        total_score = (
            time_score * weights["time"]
            + service_score * weights["service"]
            + instance_score * weights["instance"]
            + tenant_score * weights["tenant"]
            + metric_score * weights["metric"]
        )

        return CorrelationScore(
            change_id=change.id,
            alert_id=alert.id,
            total_score=round(total_score, 3),
            time_score=round(time_score, 3),
            time_reason=time_reason,
            service_score=round(service_score, 3),
            service_reason=service_reason,
            instance_score=round(instance_score, 3),
            instance_reason=instance_reason,
            tenant_score=round(tenant_score, 3),
            tenant_reason=tenant_reason,
            metric_score=round(metric_score, 3),
            metric_reason=metric_reason,
            time_window_minutes=self.time_window_minutes,
        )

    def deduplicate_alerts(self, alerts: List[Alert]) -> List[Alert]:
        alert_groups: Dict[str, List[Alert]] = {}

        for alert in alerts:
            key = f"{alert.service}:{alert.metric_type.value}:{alert.tenant or 'all'}"
            if key not in alert_groups:
                alert_groups[key] = []
            alert_groups[key].append(alert)

        deduplicated = []
        for key, group in alert_groups.items():
            if len(group) == 1:
                deduplicated.append(group[0])
            else:
                group.sort(key=lambda a: a.start_time)
                primary = group[0]
                primary.deduplicated_from = [a.id for a in group[1:]]
                deduplicated.append(primary)

        return deduplicated
