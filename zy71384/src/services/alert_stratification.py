from typing import List, Tuple, Dict, Any
from datetime import datetime

from ..models.database import QueueMetrics, ConsumerLog
from ..models.enums import AlertLevel, BacklogCause
from ..models.schemas import ExplainableScore, BacklogAttribution


class AlertStratificationService:

    @staticmethod
    def _calculate_backlog_severity(metrics: List[QueueMetrics]) -> Tuple[float, List[Dict[str, Any]]]:
        if not metrics:
            return 0.0, []

        latest = metrics[-1]
        evidence = []

        backlog = latest.backlog_count
        growth_rate = latest.backlog_growth_rate or 0

        if growth_rate > 0:
            projected_10min = backlog + growth_rate * 600
        else:
            projected_10min = backlog

        if backlog > 100000:
            score = 1.0
            severity = "critical"
        elif backlog > 50000:
            score = 0.8
            severity = "high"
        elif backlog > 10000:
            score = 0.5
            severity = "medium"
        elif backlog > 1000:
            score = 0.3
            severity = "low"
        else:
            score = 0.0
            severity = "none"

        evidence.append({
            "metric": "backlog_count",
            "value": backlog,
            "thresholds": [1000, 10000, 50000, 100000],
            "severity": severity,
            "projected_10min": projected_10min,
            "growth_rate": growth_rate
        })

        return score, evidence

    @staticmethod
    def _calculate_growth_severity(metrics: List[QueueMetrics]) -> Tuple[float, List[Dict[str, Any]]]:
        if len(metrics) < 2:
            return 0.0, []

        evidence = []
        growth_scores = []

        for i, metric in enumerate(metrics):
            if metric.production_rate > 0 and metric.consumption_rate >= 0:
                net_growth = metric.production_rate - metric.consumption_rate
                net_growth_ratio = (
                    net_growth / metric.production_rate
                    if metric.production_rate > 0 else 0
                )

                if net_growth_ratio > 0.8:
                    score = 1.0
                elif net_growth_ratio > 0.5:
                    score = 0.7
                elif net_growth_ratio > 0.2:
                    score = 0.4
                else:
                    score = 0.0

                if score > 0:
                    evidence.append({
                        "timestamp": metric.timestamp.isoformat(),
                        "production_rate": metric.production_rate,
                        "consumption_rate": metric.consumption_rate,
                        "net_growth": net_growth,
                        "net_growth_ratio": net_growth_ratio,
                        "severity_score": score
                    })
                    growth_scores.append(score)

        if growth_scores:
            return max(growth_scores), evidence
        return 0.0, evidence

    @staticmethod
    def _calculate_consumer_severity(
        metrics: List[QueueMetrics],
        consumer_logs: List[ConsumerLog]
    ) -> Tuple[float, List[Dict[str, Any]]]:
        evidence = []

        expected = max((m.consumer_count for m in metrics), default=0)
        active = min((m.active_consumer_count or 0 for m in metrics), default=expected)

        if expected == 0:
            return 0.0, evidence

        offline_ratio = (expected - active) / expected

        if offline_ratio >= 1.0:
            score = 1.0
            severity = "all_offline"
        elif offline_ratio >= 0.5:
            score = 0.8
            severity = "majority_offline"
        elif offline_ratio >= 0.3:
            score = 0.5
            severity = "partial_offline"
        else:
            score = 0.0
            severity = "healthy"

        error_logs = [log for log in consumer_logs if log.is_error]
        error_count = len(error_logs)

        evidence.append({
            "expected_consumers": expected,
            "active_consumers": active,
            "offline_count": expected - active,
            "offline_ratio": offline_ratio,
            "severity": severity,
            "error_log_count": error_count
        })

        if error_count > 0:
            error_score = min(error_count / 10, 1.0)
            score = max(score, error_score * 0.5)
            evidence.append({
                "metric": "consumer_errors",
                "count": error_count,
                "error_score_contribution": error_score * 0.5
            })

        return score, evidence

    @staticmethod
    def _calculate_dead_letter_severity(metrics: List[QueueMetrics]) -> Tuple[float, List[Dict[str, Any]]]:
        if not metrics:
            return 0.0, []

        evidence = []
        latest = metrics[-1]

        dl_count = latest.dead_letter_count
        backlog = latest.backlog_count

        if backlog == 0:
            dl_ratio = 1.0 if dl_count > 0 else 0.0
        else:
            dl_ratio = dl_count / backlog

        if dl_count > 10000 or dl_ratio > 0.5:
            score = 1.0
        elif dl_count > 1000 or dl_ratio > 0.2:
            score = 0.7
        elif dl_count > 100 or dl_ratio > 0.05:
            score = 0.4
        else:
            score = 0.0

        evidence.append({
            "dead_letter_count": dl_count,
            "backlog_count": backlog,
            "dead_letter_ratio": dl_ratio,
            "thresholds": {
                "count": [100, 1000, 10000],
                "ratio": [0.05, 0.2, 0.5]
            }
        })

        return score, evidence

    @staticmethod
    def stratify_alert(
        metrics: List[QueueMetrics],
        consumer_logs: List[ConsumerLog],
        attribution: BacklogAttribution
    ) -> Tuple[AlertLevel, float, List[ExplainableScore], str]:
        backlog_score, backlog_evidence = AlertStratificationService._calculate_backlog_severity(metrics)
        growth_score, growth_evidence = AlertStratificationService._calculate_growth_severity(metrics)
        consumer_score, consumer_evidence = AlertStratificationService._calculate_consumer_severity(metrics, consumer_logs)
        dl_score, dl_evidence = AlertStratificationService._calculate_dead_letter_severity(metrics)

        weights = {
            "backlog": 0.35,
            "growth": 0.30,
            "consumer": 0.25,
            "dead_letter": 0.10
        }

        overall_score = (
            backlog_score * weights["backlog"] +
            growth_score * weights["growth"] +
            consumer_score * weights["consumer"] +
            dl_score * weights["dead_letter"]
        )

        if overall_score >= 0.8:
            alert_level = AlertLevel.P0
        elif overall_score >= 0.6:
            alert_level = AlertLevel.CRITICAL
        elif overall_score >= 0.3:
            alert_level = AlertLevel.WARNING
        else:
            alert_level = AlertLevel.INFO

        explainable_scores = [
            ExplainableScore(
                metric_name="backlog_severity_score",
                value=backlog_score,
                threshold=0.3,
                explanation=(
                    f"积压量严重度：{backlog_score:.2f}（权重{weights['backlog']}）。"
                    f"基于当前积压量与阈值（1K/10K/50K/100K）比较。"
                    f"若积压量持续增长，10分钟后预计达到"
                    f"{backlog_evidence[0].get('projected_10min', 0):,.0f}条。"
                ),
                supporting_evidence=backlog_evidence,
                formula_used="score = tier(backlog_count, [1000, 10000, 50000, 100000])"
            ),
            ExplainableScore(
                metric_name="growth_severity_score",
                value=growth_score,
                threshold=0.3,
                explanation=(
                    f"增长趋势严重度：{growth_score:.2f}（权重{weights['growth']}）。"
                    f"基于生产与消费速率差占生产速率的比例。"
                    f"{'存在持续正增长，积压正在加速。' if growth_score > 0 else '未检测到加速增长。'}"
                ),
                supporting_evidence=growth_evidence,
                formula_used="score = tier(net_growth / production_rate, [0.2, 0.5, 0.8])"
            ),
            ExplainableScore(
                metric_name="consumer_severity_score",
                value=consumer_score,
                threshold=0.3,
                explanation=(
                    f"消费者健康度：{consumer_score:.2f}（权重{weights['consumer']}）。"
                    f"基于消费者掉线比例和错误日志数。"
                    f"预期{consumer_evidence[0]['expected_consumers']}个消费者，"
                    f"当前活跃{consumer_evidence[0]['active_consumers']}个。"
                ),
                supporting_evidence=consumer_evidence,
                formula_used="score = max(offline_ratio, error_count_score * 0.5)"
            ),
            ExplainableScore(
                metric_name="dead_letter_severity_score",
                value=dl_score,
                threshold=0.3,
                explanation=(
                    f"死信严重度：{dl_score:.2f}（权重{weights['dead_letter']}）。"
                    f"基于死信绝对数量和占积压比例。"
                    f"当前死信{dl_evidence[0]['dead_letter_count']:,}条，"
                    f"占比{dl_evidence[0]['dead_letter_ratio']*100:.1f}%。"
                ),
                supporting_evidence=dl_evidence,
                formula_used="score = max(tier(count), tier(ratio))"
            )
        ]

        score_explanation = (
            f"综合评分 {overall_score:.2f} = "
            f"积压量({backlog_score:.2f}×{weights['backlog']}) + "
            f"增长趋势({growth_score:.2f}×{weights['growth']}) + "
            f"消费者健康度({consumer_score:.2f}×{weights['consumer']}) + "
            f"死信严重度({dl_score:.2f}×{weights['dead_letter']})。"
            f"告警级别：{alert_level.value.upper()}。"
        )

        return alert_level, overall_score, explainable_scores, score_explanation
