from typing import List, Tuple
from datetime import datetime

from ..models.database import QueueMetrics, ConsumerLog, EdgeCaseDetection
from ..models.enums import BacklogCause, AlertLevel, EdgeCaseType
from ..models.schemas import (
    ProcessingSuggestion, BacklogAttribution, ExplainableScore
)


class SuggestionService:

    SUGGESTION_TEMPLATES = {
        BacklogCause.PRODUCTION_SURGE: [
            {
                "priority": "high",
                "action": "立即扩容消费者实例",
                "rationale": "生产速率较24h基线显著提升，现有消费者处理能力不足，需横向扩容以匹配生产速率。",
                "estimated_impact": "预计15-30分钟内可将消费能力提升50%-100%"
            },
            {
                "priority": "medium",
                "action": "排查生产端是否存在异常放量",
                "rationale": "请确认生产暴涨是业务正常峰值还是异常逻辑导致的重复发送。",
                "estimated_impact": "若为异常放量，修复后生产速率可恢复正常"
            },
            {
                "priority": "medium",
                "action": "临时开启批量消费模式",
                "rationale": "在业务允许的前提下，增加单次拉取消息数量以提高消费吞吐量。",
                "estimated_impact": "消费吞吐量可提升30%-50%"
            }
        ],
        BacklogCause.CONSUMPTION_SLOW: [
            {
                "priority": "high",
                "action": "分析消费者日志中的错误和耗时",
                "rationale": "消费速率下降通常伴随业务处理异常或下游依赖变慢，需从消费者日志入手排查。",
                "estimated_impact": "定位问题后预计30-60分钟可恢复消费速率"
            },
            {
                "priority": "high",
                "action": "检查下游依赖服务健康状态",
                "rationale": "数据库、缓存、第三方API等下游依赖超时会直接导致消费速率下降。",
                "estimated_impact": "下游恢复后消费速率可立即恢复正常"
            },
            {
                "priority": "medium",
                "action": "检查是否存在消费线程阻塞",
                "rationale": "线程死锁、无限循环或同步等待会导致单个消费者实际处理能力为0。",
                "estimated_impact": "重启或修复线程问题后消费能力恢复"
            }
        ],
        BacklogCause.DEAD_LETTER_PILEUP: [
            {
                "priority": "high",
                "action": "分析死信内容，识别共性问题",
                "rationale": "死信堆积通常由特定类型的消息处理失败导致，需抽样分析死信内容。",
                "estimated_impact": "定位问题后可针对性修复消费逻辑"
            },
            {
                "priority": "high",
                "action": "评估死信是否可重新投递",
                "rationale": "对于临时性错误导致的死信，可在修复问题后尝试重新投递以减少业务损失。",
                "estimated_impact": "预计可恢复50%-90%的死信消息"
            },
            {
                "priority": "medium",
                "action": "检查死信队列监控是否存在重复计数",
                "rationale": "死信计数可能存在重复上报或幂等性问题，人工核对实际死信数量。",
                "estimated_impact": "排除重复计数后可降低告警等级"
            }
        ],
        BacklogCause.CONSUMER_OFFLINE: [
            {
                "priority": "high",
                "action": "立即重启掉线的消费者实例",
                "rationale": "消费者掉线后无法处理任何消息，是最紧急的问题，需优先恢复。",
                "estimated_impact": "重启后1-5分钟内消费能力恢复"
            },
            {
                "priority": "high",
                "action": "排查消费者掉线根本原因",
                "rationale": "检查OOM、进程崩溃、网络分区、资源耗尽等问题，避免再次掉线。",
                "estimated_impact": "解决根本原因后可防止问题复发"
            },
            {
                "priority": "medium",
                "action": "配置消费者健康检查和自动拉起",
                "rationale": "完善健康检查机制，确保消费者异常退出后可自动恢复。",
                "estimated_impact": "提升系统可用性到99.9%+"
            }
        ],
        BacklogCause.MIXED: [
            {
                "priority": "high",
                "action": "按优先级逐项处理各根因",
                "rationale": "混合原因导致的积压需按贡献度排序，优先处理占比最高的因素。",
                "estimated_impact": "预计1-2小时内可看到明显改善"
            },
            {
                "priority": "medium",
                "action": "启动应急指挥，协调各方资源",
                "rationale": "多因素叠加的积压通常较为严重，需要跨团队协同处理。",
                "estimated_impact": "加快问题解决速度"
            }
        ],
        BacklogCause.UNKNOWN: [
            {
                "priority": "high",
                "action": "人工介入详细诊断",
                "rationale": "自动归因无法确定根因，需要人工分析指标、日志和系统状态。",
                "estimated_impact": "预计30-60分钟完成人工诊断"
            },
            {
                "priority": "medium",
                "action": "补充更细粒度的监控指标",
                "rationale": "现有指标不足以定位问题，建议增加消息追踪、链路监控等。",
                "estimated_impact": "提升后续问题诊断效率"
            }
        ]
    }

    EDGE_CASE_SUGGESTIONS = {
        EdgeCaseType.TIME_WINDOW_MISALIGN: {
            "priority": "high",
            "action": "修正时间窗后重新计算指标",
            "rationale": "时间窗错位会导致生产/消费速率计算失真，需先对齐时间窗再做归因。",
            "related_edge_cases": [EdgeCaseType.TIME_WINDOW_MISALIGN]
        },
        EdgeCaseType.DUPLICATE_DEAD_LETTER: {
            "priority": "high",
            "action": "人工核对死信实际数量",
            "rationale": "死信重复计数会导致误判死信堆积严重程度，需人工确认实际数量。",
            "related_edge_cases": [EdgeCaseType.DUPLICATE_DEAD_LETTER]
        },
        EdgeCaseType.CONSUMER_DROPPED: {
            "priority": "high",
            "action": "逐一核对消费者进程状态",
            "rationale": "指标可能未准确反映消费者掉线情况，需直接检查进程状态。",
            "related_edge_cases": [EdgeCaseType.CONSUMER_DROPPED]
        }
    }

    @staticmethod
    def generate_suggestions(
        attribution: BacklogAttribution,
        alert_level: AlertLevel,
        edge_cases: List[EdgeCaseDetection],
        metrics: List[QueueMetrics]
    ) -> List[ProcessingSuggestion]:
        suggestions = []

        primary_cause = attribution.primary_cause
        if not isinstance(primary_cause, str):
            primary_cause = primary_cause.value
        primary_cause = BacklogCause(primary_cause)
        templates = SuggestionService.SUGGESTION_TEMPLATES.get(primary_cause, [])

        for template in templates:
            suggestion = ProcessingSuggestion(
                priority=SuggestionService._adjust_priority(
                    template["priority"], alert_level
                ),
                action=template["action"],
                rationale=SuggestionService._enhance_rationale(
                    template["rationale"], attribution
                ),
                estimated_impact=template.get("estimated_impact")
            )
            suggestions.append(suggestion)

        seen_edge_types = set()
        for ec in edge_cases:
            ec_type_str = ec.edge_case_type
            if not isinstance(ec_type_str, str):
                ec_type_str = ec_type_str.value
            ec_type = EdgeCaseType(ec_type_str)
            if ec_type in seen_edge_types:
                continue
            seen_edge_types.add(ec_type)

            ec_template = SuggestionService.EDGE_CASE_SUGGESTIONS.get(ec_type)
            if ec_template:
                suggestion = ProcessingSuggestion(
                    priority=SuggestionService._adjust_priority(
                        ec_template["priority"], alert_level
                    ),
                    action=ec_template["action"],
                    rationale=ec_template["rationale"],
                    related_edge_cases=ec_template.get("related_edge_cases")
                )
                suggestions.append(suggestion)

        alert_level_enum = alert_level
        if isinstance(alert_level_enum, str):
            alert_level_enum = AlertLevel(alert_level_enum)

        if alert_level_enum in [AlertLevel.P0, AlertLevel.CRITICAL]:
            alert_display = alert_level_enum.value.upper()
            suggestions.insert(0, ProcessingSuggestion(
                priority="p0",
                action="启动应急预案，通知相关负责人",
                rationale=f"当前告警级别为{alert_display}，属于严重积压，需立即通知值班人员和业务方。",
                estimated_impact="确保关键人员知晓并投入处理"
            ))

        if metrics:
            latest_backlog = metrics[-1].backlog_count
            if latest_backlog > 100000:
                suggestions.append(ProcessingSuggestion(
                    priority="high",
                    action="考虑启动消息丢弃或降级策略",
                    rationale=f"当前积压量达{latest_backlog:,}条，若业务允许可考虑丢弃非核心消息以快速恢复。",
                    estimated_impact="可快速降低积压，但可能丢失部分数据"
                ))

        return suggestions

    @staticmethod
    def _adjust_priority(base_priority: str, alert_level: AlertLevel) -> str:
        level = alert_level
        if isinstance(level, str):
            level = AlertLevel(level)

        if level == AlertLevel.P0:
            if base_priority == "high":
                return "p0"
            return "high"
        if level == AlertLevel.CRITICAL:
            if base_priority == "medium":
                return "high"
        return base_priority

    @staticmethod
    def _enhance_rationale(base_rationale: str, attribution: BacklogAttribution) -> str:
        contributions = []
        if attribution.production_contribution > 0.1:
            contributions.append(
                f"生产暴涨贡献{attribution.production_contribution*100:.0f}%"
            )
        if attribution.consumption_contribution > 0.1:
            contributions.append(
                f"消费变慢贡献{attribution.consumption_contribution*100:.0f}%"
            )
        if attribution.dead_letter_contribution > 0.1:
            contributions.append(
                f"死信堆积贡献{attribution.dead_letter_contribution*100:.0f}%"
            )
        if attribution.consumer_offline_contribution > 0.1:
            contributions.append(
                f"消费者掉线贡献{attribution.consumer_offline_contribution*100:.0f}%"
            )

        if contributions:
            return f"{base_rationale}（{', '.join(contributions)}，置信度{attribution.confidence*100:.0f}%）"
        return base_rationale
