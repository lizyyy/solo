from typing import Dict, Any, List, Optional
from dataclasses import asdict
from datetime import datetime
import json
import csv
from io import StringIO

from .calculator import SLOResult, RuleEvaluation
from .config import SLOConfig


class ReportGenerator:
    def __init__(self, config: SLOConfig):
        self.config = config

    def format_console_report(self, result: SLOResult,
                              view: str = "both") -> str:
        if view == "management":
            return self._management_view(result)
        elif view == "technical":
            return self._technical_view(result)
        else:
            return (self._management_view(result) + "\n\n" + self._technical_view(result))

    def _management_view(self, result: SLOResult) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("SLO 报告 (管理视角)")
        lines.append(f"生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【一句话结论】")
        lines.append(f"  {result.summary}")
        lines.append("")

        total_requests = 0
        total_errors = 0
        for ev in result.evaluations:
            for m in ev.endpoint_metrics.values():
                total_requests += m.total_requests
                total_errors += m.failed_requests

        lines.append("【概览数据】")
        lines.append(f"  总请求数: {total_requests:,}")
        lines.append(f"  总错误数: {total_errors:,}")
        if result.parse_stats.earliest_timestamp:
            lines.append(f"  分析时段: {result.parse_stats.earliest_timestamp.strftime('%Y-%m-%d')} ~ "
                        f"{result.parse_stats.latest_timestamp.strftime('%Y-%m-%d')}")
        lines.append("")

        lines.append("【SLO 状态】")
        passed = sum(1 for e in result.evaluations if e.passed)
        total = len(result.evaluations)
        lines.append(f"  达标: {passed}/{total}")
        lines.append("")

        for ev in result.evaluations:
            status_icon = "✅" if ev.passed else "❌"
            status = "达标" if ev.passed else "超标"
            lines.append(f"  {status_icon} {ev.rule.name}: {status}")
            lines.append(f"     实际: {ev.measured_value:.2f}{ev.rule.unit} | "
                        f"目标: {ev.target:.2f}{ev.rule.unit}")
            lines.append(f"     错误预算: 已消耗 {ev.error_budget_consumed} / "
                        f"剩余 {ev.error_budget_remaining} "
                        f"({ev.error_budget_consumption_rate:.1f}%)")
            if ev.violating_endpoints:
                lines.append(f"     超标接口数: {len(ev.violating_endpoints)}")
            lines.append("")

        lines.append("【行动建议】")
        violating_evals = [e for e in result.evaluations if not e.passed]
        if not violating_evals:
            lines.append("  所有 SLO 均达标，继续保持。")
        else:
            for ev in violating_evals:
                lines.append(f"  - {ev.rule.name} 超标。建议排查以下接口:")
                for ep in ev.violating_endpoints[:5]:
                    lines.append(f"    * {ep}")
                if len(ev.violating_endpoints) > 5:
                    lines.append(f"    ... 还有 {len(ev.violating_endpoints) - 5} 个接口")

        return "\n".join(lines)

    def _technical_view(self, result: SLOResult) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("SLO 报告 (技术视角)")
        lines.append(f"生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【解析统计】")
        ps = result.parse_stats
        lines.append(f"  日志总行数: {ps.total_lines}")
        lines.append(f"  成功解析: {ps.parsed_lines}")
        lines.append(f"  解析失败: {ps.failed_lines}")
        lines.append(f"  重复行: {ps.duplicate_lines}")
        lines.append(f"  健康检查排除: {ps.health_check_excluded}")
        lines.append(f"  缺少耗时字段: {ps.missing_duration}")
        lines.append(f"  发现接口数: {len(ps.endpoints_seen)}")
        lines.append("")

        for ev in result.evaluations:
            status = "PASS" if ev.passed else "FAIL"
            status_color = "✓" if ev.passed else "✗"
            lines.append("-" * 80)
            lines.append(f" 规则: {ev.rule.name} [{status}]")
            lines.append(f" 类型: {ev.rule.type} | 目标: {ev.target:.2f}{ev.rule.unit}")
            lines.append(f" 描述: {ev.rule.description or '无'}")
            lines.append("")
            lines.append(f" 测量值: {ev.measured_value:.4f}{ev.rule.unit}")
            lines.append(f" 错误预算: 总额 {ev.error_budget_total:,} | "
                        f"已消耗 {ev.error_budget_consumed:,} | "
                        f"剩余 {ev.error_budget_remaining:,}")
            lines.append("")

            if ev.endpoint_metrics:
                lines.append(f"  接口详情:")
                sorted_eps = sorted(
                    ev.endpoint_metrics.items(),
                    key=lambda x: x[1].error_rate,
                    reverse=True
                )

                for ep, metrics in sorted_eps:
                    ep_passed = self._check_endpoint_passed(ev.rule, metrics)
                    ep_status = "  " if ep_passed else "⚠ "
                    lines.append(f"    {ep_status}{ep}")
                    lines.append(f"       请求: {metrics.total_requests:,} | "
                                f"错误: {metrics.failed_requests:,} | "
                                f"错误率: {metrics.error_rate:.2f}%")
                    lines.append(f"       延迟: P50={metrics.p50_latency_ms:.1f}ms | "
                                f"P95={metrics.p95_latency_ms:.1f}ms | "
                                f"P99={metrics.p99_latency_ms:.1f}ms")

                    if metrics.sample_errors:
                        lines.append(f"       错误样本:")
                        for s in metrics.sample_errors[:3]:
                            line = f"         * {s['timestamp']} {s['method']} "
                            if s['status']:
                                line += f"HTTP {s['status']} "
                            if s['business_code']:
                                line += f"Code:{s['business_code']} "
                            if s['trace_id']:
                                line += f"Trace:{s['trace_id']}"
                            lines.append(line)

                    if metrics.sample_slow:
                        lines.append(f"       慢请求样本:")
                        for s in metrics.sample_slow[:3]:
                            line = f"         * {s['timestamp']} {s['method']} "
                            line += f"{s['duration_ms']:.1f}ms"
                            if s['trace_id']:
                                line += f" Trace:{s['trace_id']}"
                            lines.append(line)

                    lines.append("")

            if ev.trend_data and ev.trend_data.get('values'):
                lines.append("  每日趋势:")
                values = ev.trend_data['values']
                timestamps = ev.trend_data['timestamps']
                for ts, val in zip(timestamps, values):
                    ts_date = ts.split('T')[0]
                    bar_length = int((val / 100) * 30)
                    bar = "█" * bar_length + "░" * (30 - bar_length)
                    lines.append(f"    {ts_date}: {bar} {val:.2f}%")
                lines.append("")

        return "\n".join(lines)

    def _check_endpoint_passed(self, rule, metrics) -> bool:
        if rule.type == 'availability':
            return metrics.availability >= rule.target
        elif rule.type == 'error_rate':
            return metrics.error_rate <= rule.target
        elif rule.type == 'latency':
            if not metrics.duration_samples:
                return True
            good = sum(1 for d in metrics.duration_samples if d <= rule.latency_threshold_ms)
            pct = good / len(metrics.duration_samples) * 100
            return pct >= rule.target
        return True

    def format_comparison_report(self, comparison: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("SLO 对比报告")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【对比结论】")
        lines.append(f"  {comparison['summary']}")
        lines.append("")

        lines.append("【时段 1】")
        p1 = comparison['period1']
        lines.append(f"  {p1['start'] or '未知'} ~ {p1['end'] or '未知'}")
        lines.append(f"  {p1['summary']}")
        lines.append("")

        lines.append("【时段 2】")
        p2 = comparison['period2']
        lines.append(f"  {p2['start'] or '未知'} ~ {p2['end'] or '未知'}")
        lines.append(f"  {p2['summary']}")
        lines.append("")

        lines.append("【规则对比】")
        for c in comparison['rule_comparisons']:
            status_emoji = {"改善": "↑", "恶化": "↓", "不变": "→", "新增": "+"}.get(c['status_change'], "?")
            lines.append(f"  {status_emoji} {c['rule']} [{c['status_change']}]")

            if c['period1_value'] is not None:
                lines.append(f"     时段1: {c['period1_value']:.2f} | 预算消耗: {c['period1_budget_consumed']}")
            if c['period2_value'] is not None:
                lines.append(f"     时段2: {c['period2_value']:.2f} | 预算消耗: {c['period2_budget_consumed']}")
            if c['budget_change'] is not None:
                direction = "+" if c['budget_change'] >= 0 else ""
                lines.append(f"     预算变化: {direction}{c['budget_change']}")
            lines.append("")

        return "\n".join(lines)

    def format_explain_report(self, explanation: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("SLO 违规解释")
        lines.append("=" * 80)
        lines.append("")

        if 'error' in explanation:
            lines.append(f"错误: {explanation['error']}")
            return "\n".join(lines)

        if 'message' in explanation:
            lines.append(f"{explanation['message']}")
            return "\n".join(lines)

        lines.append("【结论】")
        lines.append(f"  {explanation['summary']}")
        lines.append("")

        lines.append("【违规详情】")
        lines.append(f"  规则: {explanation['rule']}")
        lines.append(f"  类型: {explanation['type']}")
        lines.append(f"  目标: {explanation['target']}")
        lines.append(f"  实际: {explanation['actual']:.2f}")
        lines.append(f"  错误预算: 已消耗 {explanation['budget_consumed']} | "
                    f"剩余 {explanation['budget_remaining']}")
        lines.append("")

        lines.append("【超标接口】")
        for ep in explanation['violating_endpoints']:
            lines.append(f"  * {ep['endpoint']} (分组: {ep['group']})")
            lines.append(f"    请求: {ep['total_requests']:,} | "
                        f"错误: {ep['failed_requests']:,} | "
                        f"错误率: {ep['error_rate']:.2f}%")
            lines.append(f"    P95 延迟: {ep['p95_latency_ms']:.1f}ms | "
                        f"P99 延迟: {ep['p99_latency_ms']:.1f}ms")
            lines.append("")

        if explanation['evidence']:
            lines.append("【证据样本】")
            for i, ev in enumerate(explanation['evidence'][:10], 1):
                line = f"  {i}. {ev.get('timestamp', '')} {ev.get('method', '')}"
                if ev.get('status'):
                    line += f" HTTP {ev['status']}"
                if ev.get('business_code'):
                    line += f" Code:{ev['business_code']}"
                if ev.get('duration_ms'):
                    line += f" {ev['duration_ms']:.1f}ms"
                if ev.get('trace_id'):
                    line += f" (Trace: {ev['trace_id']})"
                lines.append(line)

        return "\n".join(lines)

    def export_json(self, result: SLOResult) -> str:
        export_data = {
            'generated_at': result.generated_at.isoformat(),
            'summary': result.summary,
            'parse_stats': {
                'total_lines': result.parse_stats.total_lines,
                'parsed_lines': result.parse_stats.parsed_lines,
                'failed_lines': result.parse_stats.failed_lines,
                'duplicate_lines': result.parse_stats.duplicate_lines,
                'health_check_excluded': result.parse_stats.health_check_excluded,
                'missing_duration': result.parse_stats.missing_duration,
                'earliest_timestamp': result.parse_stats.earliest_timestamp.isoformat()
                    if result.parse_stats.earliest_timestamp else None,
                'latest_timestamp': result.parse_stats.latest_timestamp.isoformat()
                    if result.parse_stats.latest_timestamp else None,
                'endpoints_seen_count': len(result.parse_stats.endpoints_seen)
            },
            'evaluations': []
        }

        for ev in result.evaluations:
            ev_data = {
                'rule_name': ev.rule.name,
                'rule_type': ev.rule.type,
                'rule_target': ev.target,
                'measured_value': ev.measured_value,
                'passed': ev.passed,
                'summary': ev.summary,
                'error_budget': {
                    'total': ev.error_budget_total,
                    'consumed': ev.error_budget_consumed,
                    'remaining': ev.error_budget_remaining,
                    'consumption_rate': ev.error_budget_consumption_rate
                },
                'violating_endpoints': ev.violating_endpoints,
                'endpoint_metrics': {},
                'trend': ev.trend_data
            }

            for ep, m in ev.endpoint_metrics.items():
                ev_data['endpoint_metrics'][ep] = {
                    'group': m.group_name,
                    'total_requests': m.total_requests,
                    'failed_requests': m.failed_requests,
                    'error_rate': m.error_rate,
                    'availability': m.availability,
                    'p50_latency_ms': m.p50_latency_ms,
                    'p90_latency_ms': m.p90_latency_ms,
                    'p95_latency_ms': m.p95_latency_ms,
                    'p99_latency_ms': m.p99_latency_ms,
                    'sample_errors': m.sample_errors,
                    'sample_slow': m.sample_slow
                }

            export_data['evaluations'].append(ev_data)

        return json.dumps(export_data, ensure_ascii=False, indent=2)

    def export_csv(self, result: SLOResult) -> str:
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'Rule', 'Rule Type', 'Target', 'Measured', 'Passed',
            'Endpoint', 'Group', 'Total Requests', 'Failed Requests',
            'Error Rate %', 'Availability %',
            'P50 ms', 'P90 ms', 'P95 ms', 'P99 ms'
        ])

        for ev in result.evaluations:
            for ep, m in ev.endpoint_metrics.items():
                writer.writerow([
                    ev.rule.name,
                    ev.rule.type,
                    f"{ev.target:.2f}",
                    f"{ev.measured_value:.4f}",
                    "YES" if ev.passed else "NO",
                    ep,
                    m.group_name,
                    m.total_requests,
                    m.failed_requests,
                    f"{m.error_rate:.4f}",
                    f"{m.availability:.4f}",
                    f"{m.p50_latency_ms:.2f}",
                    f"{m.p90_latency_ms:.2f}",
                    f"{m.p95_latency_ms:.2f}",
                    f"{m.p99_latency_ms:.2f}"
                ])

        return output.getvalue()
