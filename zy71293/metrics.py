import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from simulator import SimulationResult


class SeverityLevel(Enum):
    CRITICAL = "严重"
    WARNING = "警告"
    INFO = "提示"
    OK = "正常"


@dataclass
class Issue:
    level: SeverityLevel
    category: str
    message: str
    impact: str


@dataclass
class LongTailMetrics:
    p50_wait: float
    p75_wait: float
    p90_wait: float
    p95_wait: float
    p99_wait: float
    max_wait: float
    mean_wait: float
    std_wait: float
    tail_ratio: float
    extreme_wait_count: int
    extreme_wait_ratio: float

    @classmethod
    def from_wait_times(cls, wait_times: List[float], extreme_threshold: float = 60.0):
        if not wait_times:
            return cls(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        
        wait_array = np.array(wait_times)
        extreme_count = np.sum(wait_array > extreme_threshold)
        
        return cls(
            p50_wait=np.percentile(wait_array, 50),
            p75_wait=np.percentile(wait_array, 75),
            p90_wait=np.percentile(wait_array, 90),
            p95_wait=np.percentile(wait_array, 95),
            p99_wait=np.percentile(wait_array, 99),
            max_wait=np.max(wait_array),
            mean_wait=np.mean(wait_array),
            std_wait=np.std(wait_array),
            tail_ratio=np.percentile(wait_array, 95) / np.percentile(wait_array, 50) if np.percentile(wait_array, 50) > 0 else float('inf'),
            extreme_wait_count=int(extreme_count),
            extreme_wait_ratio=extreme_count / len(wait_array)
        )


@dataclass
class AggregatedMetrics:
    strategy_name: str
    num_runs: int
    avg_metrics: LongTailMetrics
    std_metrics: LongTailMetrics
    avg_utilization: float
    avg_queue_length: float
    avg_max_queue: float
    issues: List[Issue] = field(default_factory=list)
    seed_consistent: bool = True
    has_extreme_wait_runs: int = 0
    has_break_miss_runs: int = 0


class MetricsAnalyzer:
    EXTREME_WAIT_THRESHOLD = 60.0
    CRITICAL_WAIT_THRESHOLD = 120.0

    @staticmethod
    def analyze_single_result(result: SimulationResult) -> Tuple[LongTailMetrics, List[Issue]]:
        metrics = LongTailMetrics.from_wait_times(result.wait_times, MetricsAnalyzer.EXTREME_WAIT_THRESHOLD)
        issues = []

        if metrics.p99_wait > MetricsAnalyzer.CRITICAL_WAIT_THRESHOLD:
            issues.append(Issue(
                level=SeverityLevel.CRITICAL,
                category="极端等待",
                message=f"99分位等待时间 {metrics.p99_wait:.1f} 分钟，超过120分钟阈值",
                impact="严重影响患者体验，可能引发投诉"
            ))
        elif metrics.p95_wait > MetricsAnalyzer.EXTREME_WAIT_THRESHOLD:
            issues.append(Issue(
                level=SeverityLevel.WARNING,
                category="长尾等待",
                message=f"95分位等待时间 {metrics.p95_wait:.1f} 分钟，超过60分钟警戒线",
                impact="部分患者等待时间过长，需关注"
            ))

        if metrics.tail_ratio > 5.0:
            issues.append(Issue(
                level=SeverityLevel.WARNING,
                category="长尾效应",
                message=f"长尾比 (P95/P50) = {metrics.tail_ratio:.2f}，大于5.0",
                impact="等待时间分布不均，排队不公平"
            ))

        if metrics.extreme_wait_ratio > 0.1:
            issues.append(Issue(
                level=SeverityLevel.CRITICAL,
                category="极端等待比例",
                message=f"超过10%的患者等待超过60分钟 ({metrics.extreme_wait_ratio:.1%})",
                impact="系统存在严重瓶颈"
            ))
        elif metrics.extreme_wait_ratio > 0.05:
            issues.append(Issue(
                level=SeverityLevel.WARNING,
                category="极端等待比例",
                message=f"超过5%的患者等待超过60分钟 ({metrics.extreme_wait_ratio:.1%})",
                impact="需要优化排队策略"
            ))

        if result.has_random_seed_issue:
            issues.append(Issue(
                level=SeverityLevel.INFO,
                category="随机种子",
                message="未设置随机种子，结果不可复现",
                impact="仅用于探索性分析"
            ))

        if result.has_break_miss:
            issues.append(Issue(
                level=SeverityLevel.WARNING,
                category="休息配置",
                message="窗口休息时间配置不完整",
                impact="窗口利用率计算可能不准确"
            ))

        if result.config.num_windows < 1:
            issues.append(Issue(
                level=SeverityLevel.CRITICAL,
                category="窗口配置",
                message="窗口数量不足",
                impact="无法正常服务"
            ))

        return metrics, issues

    @staticmethod
    def aggregate_results(results: List[SimulationResult]) -> AggregatedMetrics:
        if not results:
            raise ValueError("结果列表为空")

        all_wait_times = []
        all_metrics = []
        all_utilization = []
        all_queue_length = []
        all_max_queue = []
        issues_set = {}

        has_extreme_wait_runs = 0
        has_break_miss_runs = 0
        seeds = set()

        for result in results:
            metrics, issues = MetricsAnalyzer.analyze_single_result(result)
            all_metrics.append(metrics)
            all_wait_times.extend(result.wait_times)
            all_utilization.append(np.mean(result.utilization))
            all_queue_length.append(result.avg_queue_length)
            all_max_queue.append(result.max_queue_length)
            
            if result.has_extreme_wait:
                has_extreme_wait_runs += 1
            if result.has_break_miss:
                has_break_miss_runs += 1
            seeds.add(result.config.random_seed)
            
            for issue in issues:
                key = (issue.category, issue.message)
                if key not in issues_set:
                    issues_set[key] = issue

        avg_metrics = LongTailMetrics.from_wait_times(all_wait_times, MetricsAnalyzer.EXTREME_WAIT_THRESHOLD)
        
        metric_arrays = {
            'p50_wait': [], 'p75_wait': [], 'p90_wait': [], 'p95_wait': [], 'p99_wait': [],
            'max_wait': [], 'mean_wait': [], 'std_wait': [], 'tail_ratio': [],
            'extreme_wait_count': [], 'extreme_wait_ratio': []
        }
        
        for m in all_metrics:
            for key in metric_arrays:
                metric_arrays[key].append(getattr(m, key))
        
        std_metrics = LongTailMetrics(
            p50_wait=np.std(metric_arrays['p50_wait']),
            p75_wait=np.std(metric_arrays['p75_wait']),
            p90_wait=np.std(metric_arrays['p90_wait']),
            p95_wait=np.std(metric_arrays['p95_wait']),
            p99_wait=np.std(metric_arrays['p99_wait']),
            max_wait=np.std(metric_arrays['max_wait']),
            mean_wait=np.std(metric_arrays['mean_wait']),
            std_wait=np.std(metric_arrays['std_wait']),
            tail_ratio=np.std(metric_arrays['tail_ratio']),
            extreme_wait_count=int(np.std(metric_arrays['extreme_wait_count'])),
            extreme_wait_ratio=np.std(metric_arrays['extreme_wait_ratio'])
        )

        issues = list(issues_set.values())
        issues.sort(key=lambda x: (x.level.value, x.category))

        return AggregatedMetrics(
            strategy_name=results[0].config.strategy_name,
            num_runs=len(results),
            avg_metrics=avg_metrics,
            std_metrics=std_metrics,
            avg_utilization=np.mean(all_utilization),
            avg_queue_length=np.mean(all_queue_length),
            avg_max_queue=np.mean(all_max_queue),
            issues=issues,
            seed_consistent=len(seeds) == 1 and None not in seeds,
            has_extreme_wait_runs=has_extreme_wait_runs,
            has_break_miss_runs=has_break_miss_runs
        )

    @staticmethod
    def format_metrics_table(metrics: AggregatedMetrics) -> str:
        lines = [
            f"策略: {metrics.strategy_name}",
            f"模拟次数: {metrics.num_runs}",
            f"种子一致性: {'✓' if metrics.seed_consistent else '✗'}",
            "",
            "等待时间统计 (分钟):",
            f"  均值: {metrics.avg_metrics.mean_wait:>6.2f} ± {metrics.std_metrics.mean_wait:.2f}",
            f"  P50:  {metrics.avg_metrics.p50_wait:>6.2f} ± {metrics.std_metrics.p50_wait:.2f}",
            f"  P75:  {metrics.avg_metrics.p75_wait:>6.2f} ± {metrics.std_metrics.p75_wait:.2f}",
            f"  P90:  {metrics.avg_metrics.p90_wait:>6.2f} ± {metrics.std_metrics.p90_wait:.2f}",
            f"  P95:  {metrics.avg_metrics.p95_wait:>6.2f} ± {metrics.std_metrics.p95_wait:.2f}",
            f"  P99:  {metrics.avg_metrics.p99_wait:>6.2f} ± {metrics.std_metrics.p99_wait:.2f}",
            f"  最大: {metrics.avg_metrics.max_wait:>6.2f} ± {metrics.std_metrics.max_wait:.2f}",
            "",
            "长尾指标:",
            f"  长尾比 (P95/P50): {metrics.avg_metrics.tail_ratio:.2f}",
            f"  极端等待(>60min): {metrics.avg_metrics.extreme_wait_count}人 ({metrics.avg_metrics.extreme_wait_ratio:.1%})",
            "",
            "系统指标:",
            f"  窗口利用率: {metrics.avg_utilization:.1%}",
            f"  平均队列长度: {metrics.avg_queue_length:.1f}",
            f"  最大队列长度: {metrics.avg_max_queue:.1f}",
        ]

        if metrics.issues:
            lines.append("")
            lines.append("问题清单:")
            for issue in metrics.issues:
                icon = "🔴" if issue.level == SeverityLevel.CRITICAL else "🟡" if issue.level == SeverityLevel.WARNING else "🔵"
                lines.append(f"  {icon} [{issue.level.value}] {issue.category}: {issue.message}")
                lines.append(f"     影响: {issue.impact}")

        return "\n".join(lines)
