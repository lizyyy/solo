"""
导出模块：Markdown/CSV/JSON 格式导出
"""

import csv
import json
from io import StringIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from ..core.models import (
    ComparisonResult,
    RouteResult,
    RunSummary,
)
from ..analysis.comparator import MetricsCalculator, RunComparator, HitReasonAnalyzer


class BaseExporter:
    """导出器基类"""
    
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _format_percentage(self, value: float, decimal_places: int = 2) -> str:
        """格式化百分比"""
        return f"{value * 100:.{decimal_places}}%"
    
    def _format_cost(self, value: float, decimal_places: int = 4) -> str:
        """格式化成本"""
        return f"${value:.{decimal_places}}"
    
    def _format_latency(self, value: float, decimal_places: int = 1) -> str:
        """格式化延迟"""
        if value >= 1000:
            return f"{value / 1000:.{decimal_places}}s"
        return f"{value:.{decimal_places}}ms"


class MarkdownExporter(BaseExporter):
    """Markdown 格式导出器"""
    
    def export_run_summary(self, summary: RunSummary, results: List[RouteResult]) -> str:
        """导出运行摘要为 Markdown"""
        lines = []
        
        lines.append(f"# 运行报告: {summary.run_id}")
        lines.append("")
        lines.append(f"**策略**: {summary.policy_name} v{summary.policy_version}")
        lines.append(f"**运行时间**: {summary.timestamp}")
        lines.append("")
        
        lines.append("## 概览")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 总用例数 | {summary.total_cases} |")
        lines.append(f"| 成功数 | {summary.success_count} |")
        lines.append(f"| 失败数 | {summary.failed_count} |")
        lines.append(f"| 成功率 | {self._format_percentage(summary.success_rate)} |")
        lines.append(f"| 失败率 | {self._format_percentage(summary.failure_rate)} |")
        lines.append(f"| 总成本 | {self._format_cost(summary.total_cost)} |")
        lines.append(f"| 平均延迟 | {self._format_latency(summary.avg_latency_ms)} |")
        lines.append(f"| P50 延迟 | {self._format_latency(summary.p50_latency_ms)} |")
        lines.append(f"| P95 延迟 | {self._format_latency(summary.p95_latency_ms)} |")
        lines.append(f"| P99 延迟 | {self._format_latency(summary.p99_latency_ms)} |")
        lines.append(f"| 降级率 | {self._format_percentage(summary.degradation_rate)} |")
        lines.append(f"| 重试率 | {self._format_percentage(summary.retry_rate)} |")
        lines.append("")
        
        lines.append("## 模型分布")
        lines.append("")
        lines.append("| 模型 | 次数 | 百分比 |")
        lines.append("|------|------|--------|")
        for model, count in sorted(summary.model_distribution.items(), key=lambda x: -x[1]):
            pct = count / summary.total_cases if summary.total_cases > 0 else 0
            lines.append(f"| {model} | {count} | {self._format_percentage(pct)} |")
        lines.append("")
        
        lines.append("## 状态分布")
        lines.append("")
        lines.append("| 状态 | 次数 | 百分比 |")
        lines.append("|------|------|--------|")
        for status, count in sorted(summary.status_distribution.items(), key=lambda x: -x[1]):
            pct = count / summary.total_cases if summary.total_cases > 0 else 0
            lines.append(f"| {status} | {count} | {self._format_percentage(pct)} |")
        lines.append("")
        
        lines.append("## 命中原因分析")
        lines.append("")
        
        analyzer = HitReasonAnalyzer(results)
        analysis = analyzer.analyze()
        
        lines.append("### 成功原因")
        lines.append("")
        success_reasons = analysis["by_category"]["success"]
        if any(success_reasons.values()):
            lines.append("| 原因 | 次数 |")
            lines.append("|------|------|")
            for reason, count in success_reasons.items():
                if count > 0:
                    lines.append(f"| {reason} | {count} |")
        else:
            lines.append("无成功用例")
        lines.append("")
        
        lines.append("### 重试情况")
        lines.append("")
        retry_reasons = analysis["by_category"]["retries"]
        if retry_reasons:
            lines.append("| 重试原因 | 次数 |")
            lines.append("|----------|------|")
            for reason, count in sorted(retry_reasons.items(), key=lambda x: -x[1]):
                lines.append(f"| {reason} | {count} |")
        else:
            lines.append("无重试情况")
        lines.append("")
        
        lines.append("### 失败原因")
        lines.append("")
        fail_reasons = analysis["by_category"]["failures"]
        
        cb_reasons = fail_reasons.get("circuit_breakers", {})
        if cb_reasons:
            lines.append("#### 熔断器触发")
            lines.append("")
            lines.append("| 原因 | 次数 |")
            lines.append("|------|------|")
            for reason, count in cb_reasons.items():
                lines.append(f"| {reason} | {count} |")
            lines.append("")
        
        budget_reasons = fail_reasons.get("budget_exceeded", {})
        if budget_reasons:
            lines.append("#### 预算超限")
            lines.append("")
            lines.append("| 原因 | 次数 |")
            lines.append("|------|------|")
            for reason, count in budget_reasons.items():
                lines.append(f"| {reason} | {count} |")
            lines.append("")
        
        sensitive_count = fail_reasons.get("sensitive_blocked", 0)
        no_primary_count = fail_reasons.get("no_primary_available", 0)
        
        if sensitive_count > 0 or no_primary_count > 0:
            lines.append("#### 其他失败")
            lines.append("")
            lines.append("| 原因 | 次数 |")
            lines.append("|------|------|")
            if sensitive_count > 0:
                lines.append(f"| 敏感标签拦截 | {sensitive_count} |")
            if no_primary_count > 0:
                lines.append(f"| 无可用主模型 | {no_primary_count} |")
            lines.append("")
        
        return "\n".join(lines)
    
    def export_comparison(self, comparison: ComparisonResult) -> str:
        """导出比较报告为 Markdown"""
        lines = []
        
        lines.append(f"# 策略比较报告")
        lines.append("")
        lines.append(f"**策略 A**: {comparison.policy_a} (Run: {comparison.run_a_id[:8]})")
        lines.append(f"**策略 B**: {comparison.policy_b} (Run: {comparison.run_b_id[:8]})")
        lines.append("")
        
        lines.append("## 概览对比")
        lines.append("")
        lines.append("| 指标 | 变化 |")
        lines.append("|------|------|")
        
        cost_sign = "+" if comparison.cost_difference > 0 else ""
        cost_pct_sign = "+" if comparison.cost_percentage_change > 0 else ""
        lines.append(f"| 总成本变化 | {cost_sign}{self._format_cost(comparison.cost_difference)} ({cost_pct_sign}{comparison.cost_percentage_change:.2f}%) |")
        
        latency_sign = "+" if comparison.latency_difference_ms > 0 else ""
        latency_pct_sign = "+" if comparison.latency_percentage_change > 0 else ""
        lines.append(f"| 平均延迟变化 | {latency_sign}{self._format_latency(comparison.latency_difference_ms)} ({latency_pct_sign}{comparison.latency_percentage_change:.2f}%) |")
        
        sr_sign = "+" if comparison.success_rate_difference > 0 else ""
        lines.append(f"| 成功率变化 | {sr_sign}{comparison.success_rate_difference * 100:.2f}% |")
        
        lines.append(f"| 模型切换数 | {comparison.model_switch_count} |")
        lines.append(f"| 状态变化数 | {comparison.status_change_count} |")
        lines.append("")
        
        lines.append("## 详细变化分析")
        lines.append("")
        
        lines.append("### 状态变化")
        lines.append("")
        if comparison.status_change_count > 0:
            lines.append("| 用例 ID | 从状态 | 到状态 | 从模型 | 到模型 |")
            lines.append("|---------|--------|--------|--------|--------|")
            for comp in comparison.detailed_comparisons:
                if comp["status_changed"]:
                    lines.append(f"| {comp['test_case_id']} | {comp['policy_a']['status']} | {comp['policy_b']['status']} | {comp['policy_a']['model']} | {comp['policy_b']['model']} |")
        else:
            lines.append("无状态变化")
        lines.append("")
        
        lines.append("### 模型切换")
        lines.append("")
        if comparison.model_switch_count > 0:
            lines.append("| 用例 ID | 从模型 | 到模型 | 成本变化 | 延迟变化 |")
            lines.append("|---------|--------|--------|----------|----------|")
            for comp in comparison.detailed_comparisons:
                if comp["model_changed"]:
                    cost_diff = f"+{self._format_cost(comp['cost_diff'])}" if comp["cost_diff"] > 0 else self._format_cost(comp['cost_diff'])
                    latency_diff = f"+{self._format_latency(comp['latency_diff_ms'])}" if comp["latency_diff_ms"] > 0 else self._format_latency(comp['latency_diff_ms'])
                    lines.append(f"| {comp['test_case_id']} | {comp['policy_a']['model']} | {comp['policy_b']['model']} | {cost_diff} | {latency_diff} |")
        else:
            lines.append("无模型切换")
        lines.append("")
        
        return "\n".join(lines)
    
    def save_to_file(self, content: str, filename: str) -> Path:
        """保存到文件"""
        file_path = self.output_dir / filename
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return file_path


class CSVExporter(BaseExporter):
    """CSV 格式导出器"""
    
    def export_run_results(self, results: List[RouteResult]) -> str:
        """导出运行结果为 CSV"""
        output = StringIO()
        
        fieldnames = [
            "test_case_id", "final_model", "final_status", "success",
            "final_latency_ms", "total_input_tokens", "total_output_tokens",
            "total_cost", "degradation_triggered", "retry_count",
            "circuit_triggered", "budget_exceeded", "sensitive_blocked",
            "hit_reason", "attempt_count"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for result in results:
            status_val = result.final_status.value if hasattr(result.final_status, "value") else str(result.final_status)
            writer.writerow({
                "test_case_id": result.test_case_id,
                "final_model": result.final_model,
                "final_status": status_val,
                "success": "True" if result.success else "False",
                "final_latency_ms": result.final_latency_ms,
                "total_input_tokens": result.total_input_tokens,
                "total_output_tokens": result.total_output_tokens,
                "total_cost": f"{result.total_cost:.6f}",
                "degradation_triggered": "True" if result.degradation_triggered else "False",
                "retry_count": result.retry_count,
                "circuit_triggered": "True" if result.circuit_triggered else "False",
                "budget_exceeded": "True" if result.budget_exceeded else "False",
                "sensitive_blocked": "True" if result.sensitive_blocked else "False",
                "hit_reason": result.hit_reason or "",
                "attempt_count": len(result.attempts),
            })
        
        return output.getvalue()
    
    def export_attempts(self, results: List[RouteResult]) -> str:
        """导出所有尝试详情为 CSV"""
        output = StringIO()
        
        fieldnames = [
            "test_case_id", "attempt_number", "model_name",
            "status", "latency_ms", "input_tokens", "output_tokens",
            "error_message"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for result in results:
            for attempt in result.attempts:
                status_val = attempt.status.value if hasattr(attempt.status, "value") else str(attempt.status)
                writer.writerow({
                    "test_case_id": result.test_case_id,
                    "attempt_number": attempt.attempt_number,
                    "model_name": attempt.model_name,
                    "status": status_val,
                    "latency_ms": attempt.latency_ms,
                    "input_tokens": attempt.input_tokens,
                    "output_tokens": attempt.output_tokens,
                    "error_message": attempt.error_message or "",
                })
        
        return output.getvalue()
    
    def export_comparison(self, comparison: ComparisonResult) -> str:
        """导出比较结果为 CSV"""
        output = StringIO()
        
        fieldnames = [
            "test_case_id",
            "a_model", "a_status", "a_success", "a_latency_ms", "a_cost", "a_hit_reason",
            "b_model", "b_status", "b_success", "b_latency_ms", "b_cost", "b_hit_reason",
            "model_changed", "status_changed", "success_changed",
            "cost_diff", "latency_diff_ms"
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for comp in comparison.detailed_comparisons:
            writer.writerow({
                "test_case_id": comp["test_case_id"],
                "a_model": comp["policy_a"]["model"],
                "a_status": comp["policy_a"]["status"],
                "a_success": "True" if comp["policy_a"]["success"] else "False",
                "a_latency_ms": comp["policy_a"]["latency_ms"],
                "a_cost": f"{comp['policy_a']['cost']:.6f}",
                "a_hit_reason": comp["policy_a"]["hit_reason"] or "",
                "b_model": comp["policy_b"]["model"],
                "b_status": comp["policy_b"]["status"],
                "b_success": "True" if comp["policy_b"]["success"] else "False",
                "b_latency_ms": comp["policy_b"]["latency_ms"],
                "b_cost": f"{comp['policy_b']['cost']:.6f}",
                "b_hit_reason": comp["policy_b"]["hit_reason"] or "",
                "model_changed": "True" if comp["model_changed"] else "False",
                "status_changed": "True" if comp["status_changed"] else "False",
                "success_changed": "True" if comp["success_changed"] else "False",
                "cost_diff": f"{comp['cost_diff']:.6f}",
                "latency_diff_ms": comp["latency_diff_ms"],
            })
        
        return output.getvalue()
    
    def save_to_file(self, content: str, filename: str) -> Path:
        """保存到文件"""
        file_path = self.output_dir / filename
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            f.write(content)
        return file_path


class JSONExporter(BaseExporter):
    """JSON 格式导出器"""
    
    def export_run_summary(self, summary: RunSummary) -> str:
        """导出运行摘要为 JSON"""
        return json.dumps({
            "run_id": summary.run_id,
            "policy_name": summary.policy_name,
            "policy_version": summary.policy_version,
            "timestamp": summary.timestamp.isoformat() if summary.timestamp else None,
            "summary": {
                "total_cases": summary.total_cases,
                "success_count": summary.success_count,
                "failed_count": summary.failed_count,
                "success_rate": summary.success_rate,
                "failure_rate": summary.failure_rate,
                "total_cost": summary.total_cost,
                "avg_latency_ms": summary.avg_latency_ms,
                "p50_latency_ms": summary.p50_latency_ms,
                "p95_latency_ms": summary.p95_latency_ms,
                "p99_latency_ms": summary.p99_latency_ms,
                "degradation_rate": summary.degradation_rate,
                "retry_rate": summary.retry_rate,
            },
            "distributions": {
                "model": summary.model_distribution,
                "status": summary.status_distribution,
                "hit_reasons": summary.hit_reasons,
            }
        }, ensure_ascii=False, indent=2)
    
    def export_results(self, results: List[RouteResult]) -> str:
        """导出运行结果为 JSON"""
        def result_to_dict(result: RouteResult) -> Dict[str, Any]:
            status_val = result.final_status.value if hasattr(result.final_status, "value") else str(result.final_status)
            return {
                "id": result.id,
                "test_case_id": result.test_case_id,
                "policy_name": result.policy_name,
                "policy_version": result.policy_version,
                "final_model": result.final_model,
                "final_status": status_val,
                "final_latency_ms": result.final_latency_ms,
                "total_input_tokens": result.total_input_tokens,
                "total_output_tokens": result.total_output_tokens,
                "total_cost": result.total_cost,
                "success": result.success,
                "degradation_triggered": result.degradation_triggered,
                "retry_count": result.retry_count,
                "circuit_triggered": result.circuit_triggered,
                "budget_exceeded": result.budget_exceeded,
                "sensitive_blocked": result.sensitive_blocked,
                "hit_reason": result.hit_reason,
                "timestamp": result.timestamp.isoformat() if result.timestamp else None,
                "attempts": [
                    {
                        "model_name": a.model_name,
                        "attempt_number": a.attempt_number,
                        "input_tokens": a.input_tokens,
                        "output_tokens": a.output_tokens,
                        "latency_ms": a.latency_ms,
                        "status": a.status.value if hasattr(a.status, "value") else str(a.status),
                        "error_message": a.error_message,
                        "cost": a.cost,
                    }
                    for a in result.attempts
                ],
            }
        
        return json.dumps(
            [result_to_dict(r) for r in results],
            ensure_ascii=False,
            indent=2
        )
    
    def export_comparison(self, comparison: ComparisonResult) -> str:
        """导出比较结果为 JSON"""
        return json.dumps({
            "run_a_id": comparison.run_a_id,
            "run_b_id": comparison.run_b_id,
            "policy_a": comparison.policy_a,
            "policy_b": comparison.policy_b,
            "summary": {
                "total_cases": comparison.total_cases,
                "common_cases": comparison.common_cases,
                "cost_difference": comparison.cost_difference,
                "cost_percentage_change": comparison.cost_percentage_change,
                "latency_difference_ms": comparison.latency_difference_ms,
                "latency_percentage_change": comparison.latency_percentage_change,
                "success_rate_difference": comparison.success_rate_difference,
                "model_switch_count": comparison.model_switch_count,
                "status_change_count": comparison.status_change_count,
            },
            "detailed_comparisons": comparison.detailed_comparisons,
        }, ensure_ascii=False, indent=2)
    
    def save_to_file(self, content: str, filename: str) -> Path:
        """保存到文件"""
        file_path = self.output_dir / filename
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return file_path
