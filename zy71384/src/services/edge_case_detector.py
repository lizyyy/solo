from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from ..models.database import QueueMetrics, ConsumerLog, EdgeCaseDetection
from ..models.enums import EdgeCaseType
from ..models.schemas import ExplainableScore
from .metric_alignment import MetricAlignmentService


class EdgeCaseDetectionService:

    @staticmethod
    def detect_time_window_misalign(
        metrics: List[QueueMetrics],
        expected_interval: int = 60
    ) -> Tuple[bool, List[EdgeCaseDetection], List[ExplainableScore]]:
        detected, scores, evidence = MetricAlignmentService.detect_time_window_misalign(
            metrics, expected_interval
        )

        edge_cases = []
        if detected:
            for score in scores:
                evidence_data = score.supporting_evidence[0]
                hint = (
                    f"⚠️ 时间窗错位检测：第{evidence_data['metric_index'] + 1}个数据点 "
                    f"({evidence_data['prev_timestamp']}) 与第{evidence_data['metric_index'] + 2}个数据点 "
                    f"({evidence_data['curr_timestamp']}) 之间间隔 "
                    f"{evidence_data['actual_gap_seconds']:.0f} 秒，"
                    f"预期为 {evidence_data['expected_gap_seconds']} 秒，"
                    f"偏差达 {evidence_data['deviation_seconds']:.0f} 秒。\n"
                    f"💡 建议：请确认是否存在数据上报延迟、监控系统重启或时间同步问题。"
                    f"错位的时间窗可能导致生产/消费速率计算失真，请在人工复核时特别留意。"
                )

                edge_case = EdgeCaseDetection(
                    edge_case_type=EdgeCaseType.TIME_WINDOW_MISALIGN,
                    human_readable_hint=hint,
                    evidence=evidence_data,
                    confidence=min(evidence_data["deviation_seconds"] / expected_interval, 1.0)
                )
                edge_cases.append(edge_case)

        return detected, edge_cases, scores

    @staticmethod
    def detect_duplicate_dead_letter(
        metrics: List[QueueMetrics]
    ) -> Tuple[bool, List[EdgeCaseDetection], List[ExplainableScore]]:
        if len(metrics) < 3:
            return False, [], []

        edge_cases = []
        scores = []

        increments = []
        for i in range(1, len(metrics)):
            prev_dl = metrics[i - 1].dead_letter_count
            curr_dl = metrics[i].dead_letter_count
            increment = curr_dl - prev_dl
            increments.append(increment)

        if not increments:
            return False, [], []

        from collections import Counter
        increment_counts = Counter(increments)
        suspicious_patterns = []

        for inc, count in increment_counts.items():
            if inc > 0 and count >= 3:
                ratio = count / len(increments)
                if ratio > 0.3:
                    suspicious_patterns.append({
                        "increment_value": inc,
                        "occurrences": count,
                        "total_points": len(increments),
                        "ratio": ratio
                    })

        for pattern in suspicious_patterns:
            evidence = {
                "pattern": pattern,
                "all_increments": increments,
                "note": (
                    f"相同死信增量 {pattern['increment_value']} 重复出现 "
                    f"{pattern['occurrences']} 次，占比 {pattern['ratio']*100:.1f}%"
                )
            }

            score = ExplainableScore(
                metric_name="duplicate_dead_letter_score",
                value=pattern["ratio"],
                threshold=0.3,
                explanation=(
                    f"死信重复计数检测：相同增量值 {pattern['increment_value']} "
                    f"在 {pattern['total_points']} 个数据点中出现 {pattern['occurrences']} 次，"
                    f"占比 {pattern['ratio']*100:.1f}%，超过阈值 30%。"
                    f"这可能表示死信队列存在重复计数或消费重试逻辑异常。"
                ),
                supporting_evidence=[evidence],
                formula_used=(
                    f"duplicate_ratio = count(same_increment) / total_increments, "
                    f"threshold = 0.3"
                )
            )
            scores.append(score)

            hint = (
                f"⚠️ 死信重复计数检测：检测到可疑模式——死信增量值 "
                f"{pattern['increment_value']} 在 {pattern['total_points']} 个统计周期中 "
                f"重复出现 {pattern['occurrences']} 次（占比 {pattern['ratio']*100:.1f}%）。\n"
                f"💡 可能原因：\n"
                f"   1. 死信队列监控存在重复上报\n"
                f"   2. 消费失败后重试机制导致同一消息反复计入死信\n"
                f"   3. 死信计数的幂等性设计存在缺陷\n"
                f"💡 建议：请核对死信队列的实际消息 ID，确认是否存在重复计数。"
                f"若为重复计数，实际死信数量可能远低于显示值。"
            )

            edge_case = EdgeCaseDetection(
                edge_case_type=EdgeCaseType.DUPLICATE_DEAD_LETTER,
                human_readable_hint=hint,
                evidence=evidence,
                confidence=min(pattern["ratio"] * 2, 1.0)
            )
            edge_cases.append(edge_case)

        latest_dl = metrics[-1].dead_letter_count if metrics else 0
        earliest_dl = metrics[0].dead_letter_count if metrics else 0
        total_increment = latest_dl - earliest_dl
        sum_of_increments = sum(i for i in increments if i > 0)

        if total_increment > 0 and sum_of_increments > total_increment * 1.5:
            evidence = {
                "total_increment": total_increment,
                "sum_of_positive_increments": sum_of_increments,
                "excess_ratio": sum_of_increments / total_increment,
                "note": (
                    f"增量总和 {sum_of_increments} 是净增量 {total_increment} 的 "
                    f"{sum_of_increments / total_increment:.1f} 倍，存在重复计数嫌疑"
                )
            }

            score = ExplainableScore(
                metric_name="dead_letter_increment_bloat",
                value=sum_of_increments / total_increment,
                threshold=1.5,
                explanation=(
                    f"死信增量膨胀检测：所有正向增量之和 {sum_of_increments} 是"
                    f"周期内净增量 {total_increment} 的 "
                    f"{sum_of_increments / total_increment:.1f} 倍，超过阈值 1.5 倍。"
                    f"这强烈暗示存在重复计数问题。"
                ),
                supporting_evidence=[evidence],
                formula_used="bloat_ratio = sum(positive_increments) / net_increment"
            )
            scores.append(score)

            hint = (
                f"⚠️ 死信增量膨胀检测：统计周期内死信净增长 {total_increment} 条，"
                f"但所有正向增量之和达 {sum_of_increments} 条，"
                f"是净增量的 {sum_of_increments / total_increment:.1f} 倍。\n"
                f"💡 这意味着存在大量「死信增加后又减少」的波动，"
                f"可能是：\n"
                f"   1. 死信被重复消费又重新入队\n"
                f"   2. 监控系统上报存在抖动\n"
                f"   3. 死信队列有清理机制但计数未同步\n"
                f"💡 建议：请人工核对死信队列的真实消息数量，"
                f"不要仅依赖监控数据做决策。"
            )

            edge_case = EdgeCaseDetection(
                edge_case_type=EdgeCaseType.DUPLICATE_DEAD_LETTER,
                human_readable_hint=hint,
                evidence=evidence,
                confidence=min((sum_of_increments / total_increment - 1) / 2, 1.0)
            )
            edge_cases.append(edge_case)

        return len(edge_cases) > 0, edge_cases, scores

    @staticmethod
    def detect_dropped_consumers(
        metrics: List[QueueMetrics],
        consumer_logs: List[ConsumerLog]
    ) -> Tuple[bool, List[EdgeCaseDetection], List[ExplainableScore]]:
        edge_cases = []
        scores = []

        expected_count = max((m.consumer_count for m in metrics), default=0)
        active_count = min((m.active_consumer_count or 0 for m in metrics), default=expected_count)

        if expected_count == 0:
            return False, [], []

        heartbeat_by_consumer = defaultdict(list)
        for log in consumer_logs:
            if log.is_heartbeat:
                heartbeat_by_consumer[log.consumer_id].append(log.timestamp)

        known_consumer_ids = set(heartbeat_by_consumer.keys())
        metrics_consumer_count = set()
        for m in metrics:
            if m.consumer_count:
                metrics_consumer_count.add(m.consumer_count)

        latest_metric_time = metrics[-1].timestamp if metrics else datetime.utcnow()

        suspected_dropped = []
        for consumer_id, heartbeats in heartbeat_by_consumer.items():
            last_heartbeat = max(heartbeats)
            offline_duration = (latest_metric_time - last_heartbeat).total_seconds()

            if offline_duration > 300:
                suspected_dropped.append({
                    "consumer_id": consumer_id,
                    "last_heartbeat": last_heartbeat.isoformat(),
                    "offline_duration_seconds": offline_duration,
                    "offline_duration_minutes": offline_duration / 60,
                    "heartbeat_count": len(heartbeats)
                })

        unaccounted_offline = expected_count - active_count - len(suspected_dropped)

        if suspected_dropped or unaccounted_offline > 0:
            evidence = {
                "expected_consumer_count": expected_count,
                "active_consumer_count": active_count,
                "reported_offline_count": expected_count - active_count,
                "detected_offline_via_heartbeat": len(suspected_dropped),
                "unaccounted_offline_count": unaccounted_offline,
                "detailed_offline_consumers": suspected_dropped,
                "known_consumer_ids": list(known_consumer_ids)
            }

            confidence = min(
                (len(suspected_dropped) + abs(unaccounted_offline)) / expected_count,
                1.0
            )

            score_value = min(
                (len(suspected_dropped) + max(unaccounted_offline, 0)) / expected_count,
                1.0
            )

            score = ExplainableScore(
                metric_name="unrecognized_consumer_drop_score",
                value=score_value,
                threshold=0.1,
                explanation=(
                    f"消费者掉线未识别检测：预期 {expected_count} 个消费者，"
                    f"活跃 {active_count} 个，报告掉线 {expected_count - active_count} 个，"
                    f"通过心跳检测到未报告的掉线 {len(suspected_dropped)} 个，"
                    f"身份不明的掉线 {max(unaccounted_offline, 0)} 个。"
                ),
                supporting_evidence=[evidence],
                formula_used=(
                    f"unrecognized = (detected_via_heartbeat + unaccounted) / expected"
                )
            )
            scores.append(score)

            consumer_details = "\n".join([
                f"   - {c['consumer_id']}: 最后心跳 {c['last_heartbeat']}，"
                f"已掉线 {c['offline_duration_minutes']:.0f} 分钟"
                for c in suspected_dropped
            ]) if suspected_dropped else "   （无具体消费者信息）"

            hint_parts = []
            hint_parts.append(
                f"⚠️ 消费者掉线未识别检测：预期 {expected_count} 个消费者，"
                f"当前仅 {active_count} 个活跃。"
            )

            if suspected_dropped:
                hint_parts.append(
                    f"通过心跳日志识别出 {len(suspected_dropped)} 个已掉线但"
                    f"未在指标中报告的消费者：\n{consumer_details}"
                )

            if unaccounted_offline > 0:
                hint_parts.append(
                    f"另有 {unaccounted_offline} 个掉线消费者身份不明，"
                    f"可能是新启动的消费者未上报心跳即退出。"
                )

            hint_parts.append(
                "💡 建议：\n"
                "   1. 逐一核对消费者进程状态，不要仅依赖监控指标\n"
                "   2. 检查消费者心跳上报机制是否正常工作\n"
                "   3. 确认是否存在消费者启动失败但指标已计数的情况\n"
                "   4. 重点关注最近5分钟内无心跳的消费者实例"
            )

            hint = "\n".join(hint_parts)

            edge_case = EdgeCaseDetection(
                edge_case_type=EdgeCaseType.CONSUMER_DROPPED,
                human_readable_hint=hint,
                evidence=evidence,
                confidence=confidence
            )
            edge_cases.append(edge_case)

        return len(edge_cases) > 0, edge_cases, scores

    @staticmethod
    def detect_all_edge_cases(
        metrics: List[QueueMetrics],
        consumer_logs: List[ConsumerLog],
        expected_interval: int = 60
    ) -> Tuple[List[EdgeCaseDetection], List[ExplainableScore]]:
        all_edge_cases = []
        all_scores = []

        _, ec1, s1 = EdgeCaseDetectionService.detect_time_window_misalign(
            metrics, expected_interval
        )
        all_edge_cases.extend(ec1)
        all_scores.extend(s1)

        _, ec2, s2 = EdgeCaseDetectionService.detect_duplicate_dead_letter(metrics)
        all_edge_cases.extend(ec2)
        all_scores.extend(s2)

        _, ec3, s3 = EdgeCaseDetectionService.detect_dropped_consumers(
            metrics, consumer_logs
        )
        all_edge_cases.extend(ec3)
        all_scores.extend(s3)

        return all_edge_cases, all_scores
