"""风控规则引擎"""

from datetime import datetime, timedelta, date
from collections import defaultdict
from typing import List, Dict, Tuple, Optional
from statistics import mean, stdev

from .models import (
    AccessLog, CustomerProfile, APIKey, IPRegionBaseline,
    RiskEvidence, RiskType, RiskLevel, RiskAssessment, SafetyMark
)


class RiskConfig:
    """风控配置"""
    VOLUME_SPIKE_THRESHOLD = 3.0
    VOLUME_SPIKE_MIN_CALLS = 100
    UNUSUAL_REGION_MIN_PERCENT = 0.2
    SENSITIVE_API_RATIO_THRESHOLD = 0.7
    SENSITIVE_API_MIN_COUNT = 20
    FAILURE_RATE_THRESHOLD = 0.4
    FAILURE_MIN_COUNT = 30
    MULTI_IP_THRESHOLD = 8
    MULTI_IP_TIME_WINDOW_MINUTES = 15
    MULTI_IP_MIN_CALLS_PER_IP = 1
    HOLIDAY_GROWTH_THRESHOLD = 2.0
    NEW_CUSTOMER_GRACE_DAYS = 7
    SAFETY_MARK_GRACE_HOURS = 24
    WORSENING_MULTIPLIER = 1.5


class RiskRuleEngine:
    """风控规则引擎"""

    def __init__(self, config: RiskConfig = None):
        self.config = config or RiskConfig()

    def analyze(self,
                logs: List[AccessLog],
                customer: CustomerProfile,
                api_key: APIKey,
                baseline: Optional[IPRegionBaseline] = None,
                safety_marks: List[SafetyMark] = None) -> RiskAssessment:
        if safety_marks is None:
            safety_marks = []

        filtered_logs = self._filter_duplicates(logs)

        evidences = []

        evidences.extend(self._check_volume_spike(filtered_logs, customer))
        evidences.extend(self._check_unusual_regions(filtered_logs, customer, baseline))
        evidences.extend(self._check_sensitive_api(filtered_logs))
        evidences.extend(self._check_failure_rate(filtered_logs))
        evidences.extend(self._check_multi_ip(filtered_logs))

        evidences = self._apply_context_adjustments(
            evidences, customer, filtered_logs, safety_marks
        )

        overall_score = self._calculate_overall_score(evidences)
        risk_level = self._determine_risk_level(overall_score)
        recommendations = self._generate_recommendations(evidences, risk_level)

        return RiskAssessment(
            customer_id=customer.customer_id,
            key_id=api_key.key_id,
            risk_level=risk_level,
            overall_score=overall_score,
            evidences=evidences,
            recommendations=recommendations
        )

    def _filter_duplicates(self, logs: List[AccessLog]) -> List[AccessLog]:
        return [log for log in logs if not log.is_duplicate]

    def _check_volume_spike(self, logs: List[AccessLog],
                           customer: CustomerProfile) -> List[RiskEvidence]:
        if len(logs) < self.config.VOLUME_SPIKE_MIN_CALLS:
            return []

        if customer.avg_daily_calls == 0:
            return []

        recent_logs = self._get_recent_logs(logs, hours=1)
        recent_count = len(recent_logs)

        hourly_avg = customer.avg_daily_calls / 24
        spike_ratio = recent_count / hourly_avg if hourly_avg > 0 else 0

        if spike_ratio >= self.config.VOLUME_SPIKE_THRESHOLD:
            return [RiskEvidence(
                risk_type=RiskType.VOLUME_SPIKE,
                description=f"调用量突增: 过去1小时调用{recent_count}次，是平均值的{spike_ratio:.1f}倍",
                severity=min(spike_ratio / 5.0, 1.0),
                supporting_data={
                    "recent_calls": recent_count,
                    "historical_avg": hourly_avg,
                    "spike_ratio": spike_ratio,
                    "threshold": self.config.VOLUME_SPIKE_THRESHOLD
                }
            )]
        return []

    def _check_unusual_regions(self,
                              logs: List[AccessLog],
                              customer: CustomerProfile,
                              baseline: Optional[IPRegionBaseline]) -> List[RiskEvidence]:
        if len(logs) == 0:
            return []

        usual_regions = set(customer.usual_regions)
        if baseline:
            usual_regions.update(baseline.usual_regions)

        region_counts = defaultdict(int)
        for log in logs:
            region_counts[log.region] += 1

        total = len(logs)
        unusual_count = 0
        unusual_regions = []

        for region, count in region_counts.items():
            if region not in usual_regions and region != "未知":
                unusual_count += count
                unusual_regions.append((region, count))

        evidences = []
        if unusual_count > 0:
            unusual_ratio = unusual_count / total
            if unusual_ratio >= self.config.UNUSUAL_REGION_MIN_PERCENT:
                evidences.append(RiskEvidence(
                    risk_type=RiskType.UNUSUAL_REGION,
                    description=f"非常用地区访问: {unusual_ratio:.1%}的调用来自非常规地区",
                    severity=min(unusual_ratio * 2, 1.0),
                    supporting_data={
                        "total_calls": total,
                        "unusual_calls": unusual_count,
                        "unusual_ratio": unusual_ratio,
                        "unusual_regions": unusual_regions,
                        "usual_regions": list(usual_regions)
                    }
                ))
        return evidences

    def _check_sensitive_api(self, logs: List[AccessLog]) -> List[RiskEvidence]:
        if len(logs) == 0:
            return []

        sensitive_calls = [log for log in logs if log.is_sensitive]
        sensitive_count = len(sensitive_calls)
        total_count = len(logs)

        if sensitive_count >= self.config.SENSITIVE_API_MIN_COUNT:
            ratio = sensitive_count / total_count
            if ratio >= self.config.SENSITIVE_API_RATIO_THRESHOLD:
                sensitive_endpoints = defaultdict(int)
                for log in sensitive_calls:
                    sensitive_endpoints[log.endpoint] += 1

                return [RiskEvidence(
                    risk_type=RiskType.SENSITIVE_API,
                    description=f"敏感接口集中访问: {ratio:.1%}的调用集中在敏感接口",
                    severity=min(ratio, 1.0),
                    supporting_data={
                        "total_calls": total_count,
                        "sensitive_calls": sensitive_count,
                        "ratio": ratio,
                        "sensitive_endpoints": dict(sensitive_endpoints)
                    }
                )]
        return []

    def _check_failure_rate(self, logs: List[AccessLog]) -> List[RiskEvidence]:
        if len(logs) < self.config.FAILURE_MIN_COUNT:
            return []

        failure_codes = {401, 403, 404, 429, 500}
        failed_logs = [log for log in logs if log.status_code in failure_codes]
        failed_count = len(failed_logs)
        total_count = len(logs)
        failure_rate = failed_count / total_count

        if failure_rate >= self.config.FAILURE_RATE_THRESHOLD:
            failure_by_code = defaultdict(int)
            for log in failed_logs:
                failure_by_code[log.status_code] += 1

            return [RiskEvidence(
                risk_type=RiskType.FAILURE_RATE,
                description=f"失败率异常: 失败率{failure_rate:.1%}，超过阈值",
                severity=min(failure_rate * 1.5, 1.0),
                supporting_data={
                    "total_calls": total_count,
                    "failed_calls": failed_count,
                    "failure_rate": failure_rate,
                    "threshold": self.config.FAILURE_RATE_THRESHOLD,
                    "failure_by_code": dict(failure_by_code)
                }
            )]
        return []

    def _check_multi_ip(self, logs: List[AccessLog]) -> List[RiskEvidence]:
        if len(logs) == 0:
            return []

        window = timedelta(minutes=self.config.MULTI_IP_TIME_WINDOW_MINUTES)
        sorted_logs = sorted(logs, key=lambda x: x.timestamp)

        evidences = []
        for i, log in enumerate(sorted_logs):
            window_end = log.timestamp + window
            window_logs = [l for l in sorted_logs[i:] if l.timestamp <= window_end]

            if len(window_logs) < 20:
                continue

            ip_counts = defaultdict(int)
            for l in window_logs:
                ip_counts[l.ip] += 1

            unique_ips = len(ip_counts)
            ips_with_few_calls = sum(1 for count in ip_counts.values() if count <= 2)
            suspicious_ratio = ips_with_few_calls / unique_ips if unique_ips > 0 else 0

            if (unique_ips >= self.config.MULTI_IP_THRESHOLD and
                suspicious_ratio >= 0.5):
                time_range = (window_logs[0].timestamp, window_logs[-1].timestamp)
                duration = (time_range[1] - time_range[0]).total_seconds() / 60

                evidences.append(RiskEvidence(
                    risk_type=RiskType.MULTI_IP,
                    description=f"短时间多IP分散访问: {duration:.0f}分钟内来自{unique_ips}个不同IP，{suspicious_ratio:.0%}的IP调用次数≤2次",
                    severity=min(unique_ips / 15.0 + suspicious_ratio * 0.5, 1.0),
                    supporting_data={
                        "unique_ips": unique_ips,
                        "time_window_minutes": duration,
                        "threshold": self.config.MULTI_IP_THRESHOLD,
                        "suspicious_ratio": suspicious_ratio,
                        "ips_with_few_calls": ips_with_few_calls
                    }
                ))
                break

        return evidences

    def _apply_context_adjustments(self,
                                    evidences: List[RiskEvidence],
                                    customer: CustomerProfile,
                                    logs: List[AccessLog],
                                    safety_marks: List[SafetyMark]) -> List[RiskEvidence]:
        if len(evidences) == 0:
            return evidences

        adjusted = []

        is_holiday = self._is_holiday(date.today())
        is_new_customer = self._is_new_customer(customer)
        active_safety_mark = self._get_active_safety_mark(safety_marks)

        for evidence in evidences:
            severity = evidence.severity
            reason = ""

            if is_new_customer and evidence.risk_type == RiskType.VOLUME_SPIKE:
                severity *= 0.5
                reason = " (新客户冷启动调整)"

            if is_holiday and evidence.risk_type == RiskType.VOLUME_SPIKE:
                data = evidence.supporting_data
                if data.get("spike_ratio", 0) < self.config.HOLIDAY_GROWTH_THRESHOLD:
                    severity *= 0.3
                    reason = " (节假日活动调整)"

            if active_safety_mark:
                mark_time = active_safety_mark.mark_time
                recent_logs = [l for l in logs if l.timestamp > mark_time]
                if len(recent_logs) > len(logs) * 0.5:
                    severity *= self.config.WORSENING_MULTIPLIER
                    reason = " (标记安全后持续恶化)"
                else:
                    severity *= 0.2
                    reason = " (安全标记保护期)"

            evidence.severity = min(severity, 1.0)
            evidence.description += reason
            adjusted.append(evidence)

        return adjusted

    def _get_recent_logs(self, logs: List[AccessLog], hours: int) -> List[AccessLog]:
        if not logs:
            return []
        latest_time = max(log.timestamp for log in logs)
        cutoff = latest_time - timedelta(hours=hours)
        return [log for log in logs if log.timestamp >= cutoff]

    def _is_holiday(self, d: date) -> bool:
        holiday_dates = {
            (1, 1), (5, 1), (10, 1), (10, 2), (10, 3),
            (6, 18), (11, 11), (12, 12),
            (2, 14), (2, 15), (2, 16),
            (4, 4), (4, 5), (4, 6),
            (5, 4), (5, 5),
        }
        return (d.month, d.day) in holiday_dates or d.weekday() >= 5

    def _is_new_customer(self, customer: CustomerProfile) -> bool:
        if customer.is_new_customer:
            return True
        days_since_creation = (date.today() - customer.create_date).days
        return days_since_creation <= self.config.NEW_CUSTOMER_GRACE_DAYS

    def _get_active_safety_mark(self, marks: List[SafetyMark]) -> Optional[SafetyMark]:
        now = datetime.now()
        for mark in marks:
            if not mark.is_active:
                continue
            if mark.expires_at and mark.expires_at < now:
                continue
            grace_end = mark.mark_time + timedelta(hours=self.config.SAFETY_MARK_GRACE_HOURS)
            if now <= grace_end:
                return mark
        return None

    def _calculate_overall_score(self, evidences: List[RiskEvidence]) -> float:
        if len(evidences) == 0:
            return 0.0

        type_weights = {
            RiskType.VOLUME_SPIKE: 1.2,
            RiskType.UNUSUAL_REGION: 1.0,
            RiskType.SENSITIVE_API: 1.5,
            RiskType.FAILURE_RATE: 1.3,
            RiskType.MULTI_IP: 1.4,
        }

        weighted_sum = 0
        total_weight = 0

        for evidence in evidences:
            weight = type_weights.get(evidence.risk_type, 1.0)
            weighted_sum += evidence.severity * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0

    def _determine_risk_level(self, score: float) -> RiskLevel:
        if score >= 0.8:
            return RiskLevel.CRITICAL
        elif score >= 0.6:
            return RiskLevel.HIGH
        elif score >= 0.3:
            return RiskLevel.MEDIUM
        elif score >= 0.1:
            return RiskLevel.LOW
        else:
            return RiskLevel.LOW

    def _generate_recommendations(self,
                                   evidences: List[RiskEvidence],
                                   risk_level: RiskLevel) -> List[str]:
        recommendations = []

        risk_types = {e.risk_type for e in evidences}

        if risk_level == RiskLevel.CRITICAL:
            recommendations.append("立即暂停该API密钥，启动安全调查")
            recommendations.append("通知客户安全团队，评估影响范围")
        elif risk_level == RiskLevel.HIGH:
            recommendations.append("限制调用频率至正常值的50%")
            recommendations.append("密切监控后续24小时行为")
        elif risk_level == RiskLevel.MEDIUM:
            recommendations.append("降低调用频率阈值")
            recommendations.append("持续观察48小时")

        if RiskType.UNUSUAL_REGION in risk_types:
            recommendations.append("验证是否为客户新业务地区")

        if RiskType.SENSITIVE_API in risk_types:
            recommendations.append("检查敏感接口访问权限配置")

        if RiskType.FAILURE_RATE in risk_types:
            recommendations.append("分析失败原因，判断是否为撞库尝试")

        if RiskType.MULTI_IP in risk_types:
            recommendations.append("确认是否为分布式服务或代理访问")

        if not recommendations:
            recommendations.append("继续常规监控")

        return recommendations
