"""限权建议生成器"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from collections import defaultdict

from .models import (
    AccessLog, APIKey, CustomerProfile, RiskAssessment,
    RateLimitSuggestion, RiskType, RiskLevel
)


class LimitSuggester:
    """限权建议生成器"""

    def __init__(self):
        pass

    def suggest(self,
                api_key: APIKey,
                customer: CustomerProfile,
                logs: List[AccessLog],
                assessment: RiskAssessment) -> RateLimitSuggestion:
        current_limit = api_key.rate_limit

        affected_apis = self._identify_affected_apis(logs, assessment)
        suggested_limit = self._calculate_suggested_limit(
            current_limit, assessment, customer, logs
        )
        normal_traffic_impact = self._assess_normal_traffic_impact(
            logs, suggested_limit, assessment
        )

        reason = self._generate_reason(assessment)

        return RateLimitSuggestion(
            key_id=api_key.key_id,
            customer_id=customer.customer_id,
            current_limit=current_limit,
            suggested_limit=suggested_limit,
            reason=reason,
            affected_apis=affected_apis,
            normal_traffic_impact=normal_traffic_impact
        )

    def _identify_affected_apis(self,
                                 logs: List[AccessLog],
                                 assessment: RiskAssessment) -> List[str]:
        affected = set()

        for evidence in assessment.evidences:
            if evidence.risk_type == RiskType.SENSITIVE_API:
                endpoints = evidence.supporting_data.get("sensitive_endpoints", {})
                for endpoint in endpoints.keys():
                    affected.add(endpoint)

        if not affected:
            endpoint_counts = defaultdict(int)
            for log in logs:
                endpoint_counts[log.endpoint] += 1

            sorted_endpoints = sorted(
                endpoint_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )
            for endpoint, _ in sorted_endpoints[:5]:
                affected.add(endpoint)

        return sorted(list(affected))

    def _calculate_suggested_limit(self,
                                    current_limit: int,
                                    assessment: RiskAssessment,
                                    customer: CustomerProfile,
                                    logs: List[AccessLog]) -> int:
        if assessment.risk_level == RiskLevel.CRITICAL:
            return max(int(current_limit * 0.1), 10)
        elif assessment.risk_level == RiskLevel.HIGH:
            return max(int(current_limit * 0.3), 50)
        elif assessment.risk_level == RiskLevel.MEDIUM:
            return max(int(current_limit * 0.6), 100)
        elif assessment.risk_level == RiskLevel.LOW:
            return max(int(current_limit * 0.8), 200)
        return current_limit

    def _assess_normal_traffic_impact(self,
                                       logs: List[AccessLog],
                                       suggested_limit: int,
                                       assessment: RiskAssessment) -> str:
        if len(logs) == 0:
            return "无法评估：无历史调用记录"

        recent_logs = [l for l in logs if l.timestamp > (datetime.now() - timedelta(days=7))]
        if len(recent_logs) == 0:
            recent_logs = logs

        peak_hourly = self._get_peak_hourly_calls(recent_logs)

        if peak_hourly <= suggested_limit:
            return f"正常业务不受影响：峰值{peak_hourly}次/小时 ≤ 建议限制{suggested_limit}次/小时"
        else:
            reduction_pct = ((peak_hourly - suggested_limit) / peak_hourly * 100)
            return f"可能影响正常业务：峰值{peak_hourly}次/小时 > 建议限制{suggested_limit}次/小时，预计{reduction_pct:.1f}%的峰值流量被限制"

    def _get_peak_hourly_calls(self, logs: List[AccessLog]) -> int:
        if len(logs) == 0:
            return 0

        hourly_counts = defaultdict(int)
        for log in logs:
            hour_key = log.timestamp.strftime("%Y-%m-%d %H:00")
            hourly_counts[hour_key] += 1

        if len(hourly_counts) == 0:
            return 0
        return max(hourly_counts.values())

    def _generate_reason(self, assessment: RiskAssessment) -> str:
        reasons = []

        for evidence in assessment.evidences:
            if evidence.risk_type == RiskType.VOLUME_SPIKE:
                reasons.append("调用量异常突增")
            elif evidence.risk_type == RiskType.UNUSUAL_REGION:
                reasons.append("存在非常用地区访问")
            elif evidence.risk_type == RiskType.SENSITIVE_API:
                reasons.append("敏感接口访问异常")
            elif evidence.risk_type == RiskType.FAILURE_RATE:
                reasons.append("请求失败率异常")
            elif evidence.risk_type == RiskType.MULTI_IP:
                reasons.append("多IP集中访问")

        if not reasons:
            reasons.append("预防性风控措施")

        return "；".join(reasons)
