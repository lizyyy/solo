from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Any
import math

from ..models.database import QueueMetrics, ConsumerLog
from ..models.enums import BacklogCause
from ..models.schemas import BacklogAttribution, ExplainableScore


class BacklogAttributionService:

    @staticmethod
    def _calculate_production_surge_score(metrics: List[QueueMetrics]) -> Tuple[float, List[Dict[str, Any]]]:
        if len(metrics) < 2:
            return 0.0, []

        evidence = []
        surge_scores = []

        for metric in metrics:
            if (metric.production_rate_avg_24h and
                metric.production_rate_avg_24h > 0):
                ratio = metric.production_rate / metric.production_rate_avg_24h
                deviation = ratio - 1.0

                if deviation > 0.5:
                    evidence.append({
                        "timestamp": metric.timestamp.isoformat(),
                        "current_rate": metric.production_rate,
                        "baseline_24h": metric.production_rate_avg_24h,
                        "ratio_to_baseline": ratio,
                        "deviation_percent": deviation * 100,
                        "severity": "high" if deviation > 1.0 else "medium"
                    })

                    score = min(deviation, 1.0)
                    surge_scores.append(score)

        if surge_scores:
            final_score = sum(surge_scores) / len(surge_scores)
            return final_score, evidence
        return 0.0, evidence

    @staticmethod
    def _calculate_consumption_slow_score(metrics: List[QueueMetrics]) -> Tuple[float, List[Dict[str, Any]]]:
        if len(metrics) < 2:
            return 0.0, []

        evidence = []
        slow_scores = []

        for metric in metrics:
            if (metric.consumption_rate_avg_24h and
                metric.consumption_rate_avg_24h > 0):
                ratio = metric.consumption_rate / metric.consumption_rate_avg_24h
                slowdown = 1.0 - ratio

                if slowdown > 0.3:
                    evidence.append({
                        "timestamp": metric.timestamp.isoformat(),
                        "current_rate": metric.consumption_rate,
                        "baseline_24h": metric.consumption_rate_avg_24h,
                        "ratio_to_baseline": ratio,
                        "slowdown_percent": slowdown * 100,
                        "severity": "high" if slowdown > 0.6 else "medium"
                    })

                    score = min(slowdown, 1.0)
                    slow_scores.append(score)

        if slow_scores:
            final_score = sum(slow_scores) / len(slow_scores)
            return final_score, evidence
        return 0.0, evidence

    @staticmethod
    def _calculate_dead_letter_score(
        metrics: List[QueueMetrics]
    ) -> Tuple[float, List[Dict[str, Any]]]:
        if len(metrics) < 2:
            return 0.0, []

        evidence = []
        dl_scores = []

        for i, metric in enumerate(metrics):
            if metric.dead_letter_increment and metric.dead_letter_increment > 0:
                backlog_ratio = (
                    metric.dead_letter_count / metric.backlog_count
                    if metric.backlog_count > 0 else 1.0
                )

                if backlog_ratio > 0.2:
                    evidence.append({
                        "timestamp": metric.timestamp.isoformat(),
                        "dead_letter_count": metric.dead_letter_count,
                        "dead_letter_increment": metric.dead_letter_increment,
                        "backlog_count": metric.backlog_count,
                        "dead_letter_ratio": backlog_ratio,
                        "severity": "high" if backlog_ratio > 0.5 else "medium"
                    })

                    score = min(backlog_ratio, 1.0)
                    dl_scores.append(score)

        if dl_scores:
            final_score = sum(dl_scores) / len(dl_scores)
            return final_score, evidence
        return 0.0, evidence

    @staticmethod
    def _calculate_consumer_offline_score(
        metrics: List[QueueMetrics],
        consumer_logs: List[ConsumerLog]
    ) -> Tuple[float, List[Dict[str, Any]]]:
        evidence = []

        expected_consumers = max((m.consumer_count for m in metrics), default=0)
        active_consumers = min((m.active_consumer_count or 0 for m in metrics), default=expected_consumers)

        if expected_consumers > 0:
            offline_count = expected_consumers - active_consumers
            offline_ratio = offline_count / expected_consumers if expected_consumers > 0 else 0

            if offline_ratio > 0:
                last_seen_times = {}
                for log in consumer_logs:
                    if log.is_heartbeat:
                        last_seen_times[log.consumer_id] = log.timestamp

                offline_consumers = []
                for consumer_id, last_seen in last_seen_times.items():
                    if metrics:
                        latest_metric_time = metrics[-1].timestamp
                        offline_duration = (latest_metric_time - last_seen).total_seconds()
                        if offline_duration > 300:
                            offline_consumers.append({
                                "consumer_id": consumer_id,
                                "last_heartbeat": last_seen.isoformat(),
                                "offline_duration_seconds": offline_duration,
                                "offline_duration_minutes": offline_duration / 60
                            })

                evidence.append({
                    "expected_consumer_count": expected_consumers,
                    "active_consumer_count": active_consumers,
                    "offline_count": offline_count,
                    "offline_ratio": offline_ratio,
                    "offline_consumers": offline_consumers,
                    "severity": "high" if offline_ratio > 0.5 else "medium"
                })

                return min(offline_ratio, 1.0), evidence

        return 0.0, evidence

    @staticmethod
    def attribute_backlog(
        metrics: List[QueueMetrics],
        consumer_logs: List[ConsumerLog]
    ) -> Tuple[BacklogAttribution, List[ExplainableScore]]:
        production_score, production_evidence = BacklogAttributionService._calculate_production_surge_score(metrics)
        consumption_score, consumption_evidence = BacklogAttributionService._calculate_consumption_slow_score(metrics)
        dead_letter_score, dl_evidence = BacklogAttributionService._calculate_dead_letter_score(metrics)
        offline_score, offline_evidence = BacklogAttributionService._calculate_consumer_offline_score(metrics, consumer_logs)

        total_score = production_score + consumption_score + dead_letter_score + offline_score
        if total_score == 0:
            total_score = 1

        production_contribution = production_score / total_score
        consumption_contribution = consumption_score / total_score
        dead_letter_contribution = dead_letter_score / total_score
        offline_contribution = offline_score / total_score

        scores = {
            BacklogCause.PRODUCTION_SURGE: production_score,
            BacklogCause.CONSUMPTION_SLOW: consumption_score,
            BacklogCause.DEAD_LETTER_PILEUP: dead_letter_score,
            BacklogCause.CONSUMER_OFFLINE: offline_score
        }

        high_scores = [(cause, score) for cause, score in scores.items() if score > 0.3]
        if len(high_scores) >= 2:
            primary_cause = BacklogCause.MIXED
        elif high_scores:
            primary_cause = max(high_scores, key=lambda x: x[1])[0]
        elif any(score > 0 for score in scores.values()):
            primary_cause = max(scores.items(), key=lambda x: x[1])[0]
        else:
            primary_cause = BacklogCause.UNKNOWN

        confidence = max(scores.values())
        evidence = (
            production_evidence +
            consumption_evidence +
            dl_evidence +
            offline_evidence
        )

        contributing_factors = []
        if production_score > 0.3:
            contributing_factors.append(
                f"生产速率较24h基线提升{production_score * 100:.0f}%"
            )
        if consumption_score > 0.3:
            contributing_factors.append(
                f"消费速率较24h基线下降{consumption_score * 100:.0f}%"
            )
        if dead_letter_score > 0.3:
            contributing_factors.append(
                f"死信占积压比例达{dead_letter_score * 100:.0f}%"
            )
        if offline_score > 0.3:
            contributing_factors.append(
                f"消费者掉线比例达{offline_score * 100:.0f}%"
            )

        attribution = BacklogAttribution(
            primary_cause=primary_cause,
            confidence=confidence,
            evidence=evidence,
            contributing_factors=contributing_factors,
            production_contribution=production_contribution,
            consumption_contribution=consumption_contribution,
            dead_letter_contribution=dead_letter_contribution,
            consumer_offline_contribution=offline_contribution
        )

        explainable_scores = [
            ExplainableScore(
                metric_name="production_surge_score",
                value=production_score,
                threshold=0.3,
                explanation=(
                    f"生产暴涨得分：{production_score:.2f}。"
                    f"基于生产速率与24h基线的偏差计算。"
                    f"{'超过阈值0.3，判定为生产暴涨因素。' if production_score > 0.3 else '未超过阈值。'}"
                ),
                supporting_evidence=production_evidence,
                formula_used="score = min(current_rate / baseline_24h - 1, 1)"
            ),
            ExplainableScore(
                metric_name="consumption_slow_score",
                value=consumption_score,
                threshold=0.3,
                explanation=(
                    f"消费变慢得分：{consumption_score:.2f}。"
                    f"基于消费速率与24h基线的下降比例计算。"
                    f"{'超过阈值0.3，判定为消费变慢因素。' if consumption_score > 0.3 else '未超过阈值。'}"
                ),
                supporting_evidence=consumption_evidence,
                formula_used="score = min(1 - current_rate / baseline_24h, 1)"
            ),
            ExplainableScore(
                metric_name="dead_letter_score",
                value=dead_letter_score,
                threshold=0.3,
                explanation=(
                    f"死信堆积得分：{dead_letter_score:.2f}。"
                    f"基于死信占总积压的比例计算。"
                    f"{'超过阈值0.3，判定为死信堆积因素。' if dead_letter_score > 0.3 else '未超过阈值。'}"
                ),
                supporting_evidence=dl_evidence,
                formula_used="score = min(dead_letter_count / backlog_count, 1)"
            ),
            ExplainableScore(
                metric_name="consumer_offline_score",
                value=offline_score,
                threshold=0.3,
                explanation=(
                    f"消费者掉线得分：{offline_score:.2f}。"
                    f"基于预期消费者数与活跃消费者数的差异计算。"
                    f"{'超过阈值0.3，判定为消费者掉线因素。' if offline_score > 0.3 else '未超过阈值。'}"
                ),
                supporting_evidence=offline_evidence,
                formula_used="score = min(offline_count / expected_count, 1)"
            )
        ]

        return attribution, explainable_scores
