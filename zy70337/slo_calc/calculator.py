from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import numpy as np
from collections import defaultdict

from .config import SLOConfig, SLORule
from .log_parser import LogEntry, LogParseStats


@dataclass
class EndpointMetrics:
    endpoint: str
    group_name: str
    total_requests: int
    failed_requests: int
    error_rate: float
    availability: float
    p50_latency_ms: float
    p90_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    duration_samples: List[float] = field(default_factory=list)
    sample_errors: List[Dict] = field(default_factory=list)
    sample_slow: List[Dict] = field(default_factory=list)


@dataclass
class RuleEvaluation:
    rule: SLORule
    measured_value: float
    target: float
    passed: bool
    error_budget_total: float
    error_budget_remaining: float
    error_budget_consumed: float
    error_budget_consumption_rate: float
    violating_endpoints: List[str] = field(default_factory=list)
    endpoint_metrics: Dict[str, EndpointMetrics] = field(default_factory=dict)
    trend_data: Dict[str, List[float]] = field(default_factory=dict)

    @property
    def summary(self) -> str:
        if self.passed:
            return f"✓ {self.rule.name}: 达标 (实际 {self.measured_value:.2f}{self.rule.unit}, 目标 {self.target:.2f}{self.rule.unit})"
        else:
            return f"✗ {self.rule.name}: 超标 (实际 {self.measured_value:.2f}{self.rule.unit}, 目标 {self.target:.2f}{self.rule.unit})"


@dataclass
class WindowTrend:
    window_start: datetime
    window_end: datetime
    measured_value: float
    total_requests: int
    failed_requests: int


@dataclass
class SLOResult:
    evaluations: List[RuleEvaluation]
    parse_stats: LogParseStats
    generated_at: datetime
    summary: str = ""

    def get_evaluation_by_rule(self, rule_name: str) -> Optional[RuleEvaluation]:
        for ev in self.evaluations:
            if ev.rule.name == rule_name:
                return ev
        return None


class SLOCalculator:
    def __init__(self, config: SLOConfig):
        self.config = config

    def calculate(self, entries: List[LogEntry],
                  parse_stats: LogParseStats,
                  window_days: Optional[int] = None) -> SLOResult:
        evaluations: List[RuleEvaluation] = []

        for rule in self.config.rules:
            ev = self._evaluate_rule(rule, entries, window_days)
            evaluations.append(ev)

        result = SLOResult(
            evaluations=evaluations,
            parse_stats=parse_stats,
            generated_at=datetime.now()
        )
        result.summary = self._generate_summary(result)
        return result

    def _evaluate_rule(self, rule: SLORule,
                       entries: List[LogEntry],
                       window_days: Optional[int]) -> RuleEvaluation:
        filtered_entries = self._filter_entries(rule, entries)

        if not filtered_entries:
            return RuleEvaluation(
                rule=rule,
                measured_value=100.0 if rule.type in ['availability', 'error_rate'] else 0.0,
                target=rule.target,
                passed=True,
                error_budget_total=0,
                error_budget_remaining=0,
                error_budget_consumed=0,
                error_budget_consumption_rate=0
            )

        wd = window_days or rule.window_days

        endpoint_metrics = self._calculate_endpoint_metrics(rule, filtered_entries)
        measured_value = self._calculate_overall_metric(rule, endpoint_metrics)
        trend_data = self._calculate_trend(rule, filtered_entries, wd)

        if rule.type == 'availability':
            error_budget_total = (100 - rule.target) / 100
            actual_error_rate = (100 - measured_value) / 100
        elif rule.type == 'error_rate':
            error_budget_total = rule.target / 100
            actual_error_rate = measured_value / 100
        elif rule.type == 'latency':
            total_requests = sum(m.total_requests for m in endpoint_metrics.values())
            slow_requests = sum(
                len([d for d in m.duration_samples if d > rule.latency_threshold_ms])
                for m in endpoint_metrics.values()
            )
            error_budget_total = (100 - rule.target) / 100
            actual_error_rate = slow_requests / total_requests if total_requests > 0 else 0

        total_requests = sum(m.total_requests for m in endpoint_metrics.values())
        error_budget_allowed = int(error_budget_total * total_requests)
        errors_consumed = int(actual_error_rate * total_requests)
        budget_remaining = max(0, error_budget_allowed - errors_consumed)

        passed = self._check_passed(rule, measured_value)

        violating_endpoints = []
        for ep, metrics in endpoint_metrics.items():
            ep_metric = self._get_endpoint_rule_metric(rule, metrics)
            if not self._check_passed(rule, ep_metric):
                violating_endpoints.append(ep)

        consumption_rate = (errors_consumed / error_budget_allowed * 100) if error_budget_allowed > 0 else 0

        return RuleEvaluation(
            rule=rule,
            measured_value=measured_value,
            target=rule.target,
            passed=passed,
            error_budget_total=error_budget_allowed,
            error_budget_remaining=budget_remaining,
            error_budget_consumed=errors_consumed,
            error_budget_consumption_rate=consumption_rate,
            violating_endpoints=violating_endpoints,
            endpoint_metrics=endpoint_metrics,
            trend_data=trend_data
        )

    def _filter_entries(self, rule: SLORule, entries: List[LogEntry]) -> List[LogEntry]:
        filtered = []

        for entry in entries:
            if rule.include_patterns:
                matched_include = False
                for pattern in rule.include_patterns:
                    import re
                    if re.search(pattern, entry.path):
                        matched_include = True
                        break
                if not matched_include:
                    continue

            if rule.exclude_patterns:
                should_exclude = False
                import re
                for pattern in rule.exclude_patterns:
                    if re.search(pattern, entry.path):
                        should_exclude = True
                        break
                if should_exclude:
                    continue

            import re
            if not re.match(rule.group_pattern, entry.path):
                continue

            filtered.append(entry)

        return filtered

    def _calculate_endpoint_metrics(self, rule: SLORule,
                                    entries: List[LogEntry]) -> Dict[str, EndpointMetrics]:
        grouped: Dict[str, List[LogEntry]] = defaultdict(list)
        for entry in entries:
            grouped[entry.path].append(entry)

        metrics: Dict[str, EndpointMetrics] = {}

        for endpoint, ep_entries in grouped.items():
            group = self.config.get_group_for_endpoint(endpoint)
            group_name = group.name if group else "未分组"

            total = len(ep_entries)
            failed = 0
            sample_errors = []
            sample_slow = []

            durations = []
            for e in ep_entries:
                if e.duration_ms >= 0:
                    durations.append(e.duration_ms)

                is_err = e.is_error(
                    http_5xx_as_error=rule.http_5xx_considered_error,
                    http_4xx_as_error=rule.http_4xx_considered_error,
                    business_error_codes=rule.business_error_codes
                )

                if is_err:
                    failed += 1
                    if len(sample_errors) < 5:
                        sample_errors.append({
                            'timestamp': e.timestamp.isoformat(),
                            'method': e.method,
                            'status': e.status,
                            'business_code': e.business_code,
                            'trace_id': e.trace_id,
                            'duration_ms': e.duration_ms
                        })

                if rule.type == 'latency' and rule.latency_threshold_ms:
                    if e.duration_ms > rule.latency_threshold_ms:
                        if len(sample_slow) < 5:
                            sample_slow.append({
                                'timestamp': e.timestamp.isoformat(),
                                'method': e.method,
                                'duration_ms': e.duration_ms,
                                'trace_id': e.trace_id
                            })

            error_rate = (failed / total * 100) if total > 0 else 0.0
            availability = 100.0 - error_rate

            if durations:
                p50 = float(np.percentile(durations, 50))
                p90 = float(np.percentile(durations, 90))
                p95 = float(np.percentile(durations, 95))
                p99 = float(np.percentile(durations, 99))
            else:
                p50 = p90 = p95 = p99 = 0.0

            metrics[endpoint] = EndpointMetrics(
                endpoint=endpoint,
                group_name=group_name,
                total_requests=total,
                failed_requests=failed,
                error_rate=error_rate,
                availability=availability,
                p50_latency_ms=p50,
                p90_latency_ms=p90,
                p95_latency_ms=p95,
                p99_latency_ms=p99,
                duration_samples=durations,
                sample_errors=sample_errors,
                sample_slow=sample_slow
            )

        return metrics

    def _calculate_overall_metric(self, rule: SLORule,
                                  endpoint_metrics: Dict[str, EndpointMetrics]) -> float:
        total_requests = sum(m.total_requests for m in endpoint_metrics.values())
        if total_requests == 0:
            return 100.0 if rule.type in ['availability', 'error_rate'] else 0.0

        if rule.type == 'availability':
            total_successful = sum(m.total_requests - m.failed_requests for m in endpoint_metrics.values())
            return total_successful / total_requests * 100

        elif rule.type == 'error_rate':
            total_errors = sum(m.failed_requests for m in endpoint_metrics.values())
            return total_errors / total_requests * 100

        elif rule.type == 'latency':
            all_durations = []
            for m in endpoint_metrics.values():
                all_durations.extend(m.duration_samples)

            if not all_durations:
                return 0.0

            quantile_value = float(np.percentile(all_durations, rule.quantile * 100))
            good_requests = sum(1 for d in all_durations if d <= rule.latency_threshold_ms)
            return good_requests / len(all_durations) * 100

        return 100.0

    def _get_endpoint_rule_metric(self, rule: SLORule, metrics: EndpointMetrics) -> float:
        if rule.type == 'availability':
            return metrics.availability
        elif rule.type == 'error_rate':
            return metrics.error_rate
        elif rule.type == 'latency':
            if not metrics.duration_samples:
                return 100.0
            good = sum(1 for d in metrics.duration_samples if d <= rule.latency_threshold_ms)
            return good / len(metrics.duration_samples) * 100
        return 100.0

    def _check_passed(self, rule: SLORule, measured_value: float) -> bool:
        if rule.type == 'availability':
            return measured_value >= rule.target
        elif rule.type == 'error_rate':
            return measured_value <= rule.target
        elif rule.type == 'latency':
            return measured_value >= rule.target
        return True

    def _calculate_trend(self, rule: SLORule,
                         entries: List[LogEntry],
                         window_days: int) -> Dict[str, List[float]]:
        if not entries:
            return {}

        earliest = min(e.timestamp for e in entries)
        latest = max(e.timestamp for e in entries)

        trend = {
            'timestamps': [],
            'values': [],
            'request_counts': [],
            'error_counts': []
        }

        step_hours = 24
        current = earliest.replace(hour=0, minute=0, second=0, microsecond=0)

        while current <= latest:
            window_end = current + timedelta(hours=step_hours)
            window_entries = [
                e for e in entries
                if current <= e.timestamp < window_end
            ]

            if window_entries:
                ep_metrics = self._calculate_endpoint_metrics(rule, window_entries)
                value = self._calculate_overall_metric(rule, ep_metrics)
                total = sum(m.total_requests for m in ep_metrics.values())
                errors = sum(m.failed_requests for m in ep_metrics.values())

                trend['timestamps'].append(current.isoformat())
                trend['values'].append(value)
                trend['request_counts'].append(total)
                trend['error_counts'].append(errors)

            current = window_end

        return trend

    def _generate_summary(self, result: SLOResult) -> str:
        total_rules = len(result.evaluations)
        passed_rules = sum(1 for e in result.evaluations if e.passed)

        if passed_rules == total_rules:
            return f"整体健康: 所有 {total_rules} 个 SLO 规则均达标"
        else:
            return f"有问题: {total_rules - passed_rules}/{total_rules} 个 SLO 规则超标，需要关注"

    def explain_violation(self, rule_name: str,
                          result: SLOResult) -> Dict[str, Any]:
        evaluation = result.get_evaluation_by_rule(rule_name)
        if not evaluation:
            return {"error": f"未找到规则 {rule_name}"}

        if evaluation.passed:
            return {"message": f"规则 {rule_name} 未超标"}

        reasons = []
        evidence = []

        for endpoint in evaluation.violating_endpoints:
            metrics = evaluation.endpoint_metrics[endpoint]
            reasons.append({
                'endpoint': endpoint,
                'group': metrics.group_name,
                'total_requests': metrics.total_requests,
                'failed_requests': metrics.failed_requests,
                'error_rate': metrics.error_rate,
                'availability': metrics.availability,
                'p95_latency_ms': metrics.p95_latency_ms,
                'p99_latency_ms': metrics.p99_latency_ms
            })

            if metrics.sample_errors:
                evidence.extend(metrics.sample_errors[:3])
            if metrics.sample_slow:
                evidence.extend(metrics.sample_slow[:3])

        return {
            'rule': evaluation.rule.name,
            'type': evaluation.rule.type,
            'target': evaluation.target,
            'actual': evaluation.measured_value,
            'budget_consumed': evaluation.error_budget_consumed,
            'budget_remaining': evaluation.error_budget_remaining,
            'violating_endpoints': reasons,
            'evidence': evidence,
            'summary': self._generate_explain_summary(evaluation, reasons)
        }

    def _generate_explain_summary(self, evaluation: RuleEvaluation,
                                  reasons: List[Dict]) -> str:
        rule = evaluation.rule
        endpoint_count = len(reasons)

        if rule.type == 'error_rate':
            return (f"错误率超标: {endpoint_count} 个接口错误率超过 {rule.target}% 目标。"
                   f"已消耗错误预算 {evaluation.error_budget_consumed} 个请求，"
                   f"剩余 {evaluation.error_budget_remaining} 个请求。")
        elif rule.type == 'availability':
            return (f"可用性不足: {endpoint_count} 个接口可用性低于 {rule.target}% 目标。"
                   f"已消耗错误预算 {evaluation.error_budget_consumed} 个请求，"
                   f"剩余 {evaluation.error_budget_remaining} 个请求。")
        elif rule.type == 'latency':
            return (f"延迟超标: {endpoint_count} 个接口 P{int(rule.quantile * 100)} 延迟超过 "
                   f"{rule.latency_threshold_ms}ms 阈值，达标率 {evaluation.measured_value:.2f}% "
                   f"低于目标 {rule.target}%。")
        return ""

    def compare_results(self, result1: SLOResult,
                       result2: SLOResult) -> Dict[str, Any]:
        comparison = {
            'period1': {
                'start': result1.parse_stats.earliest_timestamp.isoformat() if result1.parse_stats.earliest_timestamp else None,
                'end': result1.parse_stats.latest_timestamp.isoformat() if result1.parse_stats.latest_timestamp else None,
                'summary': result1.summary
            },
            'period2': {
                'start': result2.parse_stats.earliest_timestamp.isoformat() if result2.parse_stats.earliest_timestamp else None,
                'end': result2.parse_stats.latest_timestamp.isoformat() if result2.parse_stats.latest_timestamp else None,
                'summary': result2.summary
            },
            'rule_comparisons': [],
            'summary': ""
        }

        rules_map1 = {e.rule.name: e for e in result1.evaluations}
        rules_map2 = {e.rule.name: e for e in result2.evaluations}

        all_rule_names = set(rules_map1.keys()) | set(rules_map2.keys())

        for name in all_rule_names:
            e1 = rules_map1.get(name)
            e2 = rules_map2.get(name)

            if e1 and e2:
                comparison['rule_comparisons'].append({
                    'rule': name,
                    'period1_value': e1.measured_value,
                    'period2_value': e2.measured_value,
                    'period1_budget_consumed': e1.error_budget_consumed,
                    'period2_budget_consumed': e2.error_budget_consumed,
                    'budget_change': e2.error_budget_consumed - e1.error_budget_consumed,
                    'passed1': e1.passed,
                    'passed2': e2.passed,
                    'status_change': "恶化" if e1.passed and not e2.passed else ("改善" if not e1.passed and e2.passed else "不变")
                })
            elif e2:
                comparison['rule_comparisons'].append({
                    'rule': name,
                    'period1_value': None,
                    'period2_value': e2.measured_value,
                    'period1_budget_consumed': None,
                    'period2_budget_consumed': e2.error_budget_consumed,
                    'budget_change': None,
                    'passed1': None,
                    'passed2': e2.passed,
                    'status_change': "新增"
                })

        passed_diff = sum(1 for c in comparison['rule_comparisons'] if c['status_change'] == '恶化')
        improved_count = sum(1 for c in comparison['rule_comparisons'] if c['status_change'] == '改善')

        if passed_diff > improved_count:
            comparison['summary'] = f"趋势恶化: {passed_diff} 个规则从达标变为超标"
        elif improved_count > passed_diff:
            comparison['summary'] = f"趋势改善: {improved_count} 个规则从超标变为达标"
        else:
            comparison['summary'] = "趋势稳定: 整体状态没有显著变化"

        return comparison
