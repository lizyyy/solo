"""
样例数据生成器
"""

from datetime import datetime, timedelta
from typing import List
from .models import Change, Alert, ServiceAlias, ChangeType, MetricType


class SampleDataGenerator:
    def generate_samples(self, base_time: datetime = None) -> tuple:
        base = base_time or datetime.now().replace(microsecond=0)

        changes = self._generate_changes(base)
        alerts = self._generate_alerts(base)
        aliases = self._generate_aliases()

        return changes, alerts, aliases

    def _generate_changes(self, base: datetime) -> List[Change]:
        return [
            Change(
                id="CHG-001",
                type=ChangeType.DEPLOYMENT,
                service="order-service",
                instance="order-01.example.com",
                tenant="acme-corp",
                start_time=base - timedelta(hours=2, minutes=30),
                end_time=base - timedelta(hours=2, minutes=15),
                description="发布 v2.3.1，包含订单创建逻辑重构",
                metadata={
                    "version": "2.3.1",
                    "commit": "abc1234",
                    "deployer": "zhang.san",
                },
            ),
            Change(
                id="CHG-002",
                type=ChangeType.SCALE,
                service="user-service",
                instance=None,
                tenant=None,
                start_time=base - timedelta(hours=2, minutes=20),
                end_time=base - timedelta(hours=2, minutes=10),
                description="扩容 user-service 从 3 实例到 6 实例",
                metadata={
                    "old_replicas": 3,
                    "new_replicas": 6,
                    "reason": "流量峰值预期",
                },
            ),
            Change(
                id="CHG-003",
                type=ChangeType.CONFIG_CHANGE,
                service="payment-service",
                instance="payment-02.example.com",
                tenant="acme-corp",
                start_time=base - timedelta(hours=1, minutes=45),
                end_time=base - timedelta(hours=1, minutes=40),
                description="修改支付超时配置从 10s 到 30s",
                metadata={
                    "config_key": "payment.timeout",
                    "old_value": "10s",
                    "new_value": "30s",
                },
            ),
        ]

    def _generate_alerts(self, base: datetime) -> List[Alert]:
        return [
            Alert(
                id="ALT-001",
                service="order-service",
                instance="order-01.example.com",
                tenant="acme-corp",
                metric_type=MetricType.ERROR_RATE,
                start_time=base - timedelta(hours=2, minutes=12),
                end_time=base - timedelta(hours=1, minutes=30),
                severity="critical",
                description="订单服务错误率从 0.1% 飙升至 15%",
                metadata={
                    "error_type": "500 Internal Server Error",
                    "affected_endpoints": ["/api/v1/orders", "/api/v1/orders/create"],
                },
            ),
            Alert(
                id="ALT-002",
                service="order-service",
                instance="order-01.example.com",
                tenant="acme-corp",
                metric_type=MetricType.ERROR_RATE,
                start_time=base - timedelta(hours=2, minutes=10),
                end_time=base - timedelta(hours=1, minutes=28),
                severity="critical",
                description="订单服务错误率持续高企",
                metadata={
                    "note": "这是 ALT-001 的重复告警",
                },
            ),
            Alert(
                id="ALT-003",
                service="user-service",
                instance="user-05.example.com",
                tenant=None,
                metric_type=MetricType.CPU,
                start_time=base - timedelta(hours=2, minutes=5),
                end_time=base - timedelta(hours=1, minutes=50),
                severity="warning",
                description="user-05 CPU 使用率 85%",
                metadata={
                    "cpu_usage": "85%",
                    "threshold": "80%",
                },
            ),
            Alert(
                id="ALT-004",
                service="payment-svc",
                instance="payment-02.example.com",
                tenant="acme-corp",
                metric_type=MetricType.LATENCY,
                start_time=base - timedelta(hours=1, minutes=30),
                end_time=base - timedelta(minutes=45),
                severity="warning",
                description="支付服务 P99 延迟从 500ms 上升至 2.5s",
                metadata={
                    "p50": "200ms",
                    "p95": "800ms",
                    "p99": "2500ms",
                },
            ),
            Alert(
                id="ALT-005",
                service="payment-service",
                instance=None,
                tenant="acme-corp",
                metric_type=MetricType.LATENCY,
                start_time=base - timedelta(hours=1, minutes=25),
                end_time=base - timedelta(minutes=40),
                severity="warning",
                description="支付服务整体延迟上升",
                metadata={
                    "note": "这是 ALT-004 的服务级别告警",
                },
            ),
        ]

    def _generate_aliases(self) -> List[ServiceAlias]:
        return [
            ServiceAlias(
                canonical="payment-service",
                aliases=["payment-svc", "pay-service", "payments"],
            ),
            ServiceAlias(
                canonical="order-service",
                aliases=["order-svc", "orders"],
            ),
        ]
