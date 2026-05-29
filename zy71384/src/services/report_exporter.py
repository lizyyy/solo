from datetime import datetime
from typing import List, Dict, Any
import json
import os
import pandas as pd

from ..models.database import DiagnosisRecord, QueueMetrics, ConsumerLog, EdgeCaseDetection
from ..models.schemas import (
    DiagnosisWithExplanation, ExplainableScore, BacklogAttribution,
    ProcessingSuggestion
)
from .metric_alignment import MetricAlignmentService


class ReportExportService:

    EXPORT_DIR = "./exports"

    @classmethod
    def _ensure_export_dir(cls):
        os.makedirs(cls.EXPORT_DIR, exist_ok=True)

    @staticmethod
    def _flatten_dict(d: Dict[str, Any], parent_key: str = "", sep: str = "_") -> Dict[str, Any]:
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(ReportExportService._flatten_dict(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                items.append((new_key, json.dumps(v, ensure_ascii=False)))
            else:
                items.append((new_key, v))
        return dict(items)

    @staticmethod
    def generate_human_readable_summary(
        record: DiagnosisRecord,
        attribution: BacklogAttribution,
        edge_cases: List[EdgeCaseDetection],
        suggestions: List[ProcessingSuggestion]
    ) -> str:
        parts = []

        alert_level = record.alert_level
        if isinstance(alert_level, str):
            alert_display = alert_level.upper()
        else:
            alert_display = alert_level.value.upper() if alert_level else "未知"
        parts.append(f"【{alert_display}告警】{record.queue_name} 队列积压诊断报告")
        parts.append("=" * 60)
        parts.append(f"诊断ID: {record.id}")
        parts.append(f"创建时间: {record.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        status = record.status
        if isinstance(status, str):
            status_display = status
        else:
            status_display = status.value
        parts.append(f"当前状态: {status_display}")
        parts.append("")

        cause_desc = {
            "production_surge": "生产暴涨",
            "consumption_slow": "消费变慢",
            "dead_letter_pileup": "死信堆积",
            "consumer_offline": "消费者掉线",
            "mixed": "混合原因",
            "unknown": "未知原因"
        }

        parts.append(f"📊 诊断结论")
        primary_cause = attribution.primary_cause
        if not isinstance(primary_cause, str):
            primary_cause = primary_cause.value
        parts.append(f"  主要原因: {cause_desc.get(primary_cause, primary_cause)}")
        parts.append(f"  置信度: {attribution.confidence * 100:.1f}%")
        parts.append(f"  综合评分: {record.overall_score:.2f} / 1.00")
        parts.append("")

        if attribution.contributing_factors:
            parts.append(f"🔍 关键发现")
            for factor in attribution.contributing_factors:
                parts.append(f"  • {factor}")
            parts.append("")

        parts.append(f"📈 贡献度分析")
        parts.append(f"  生产暴涨: {attribution.production_contribution * 100:.1f}%")
        parts.append(f"  消费变慢: {attribution.consumption_contribution * 100:.1f}%")
        parts.append(f"  死信堆积: {attribution.dead_letter_contribution * 100:.1f}%")
        parts.append(f"  消费者掉线: {attribution.consumer_offline_contribution * 100:.1f}%")
        parts.append("")

        if edge_cases:
            parts.append(f"⚠️  特殊情况检测（{len(edge_cases)}项）")
            for i, ec in enumerate(edge_cases, 1):
                parts.append(f"  [{i}] {ec.human_readable_hint}")
                parts.append(f"      置信度: {ec.confidence * 100:.1f}%")
            parts.append("")

        parts.append(f"💡 处理建议（按优先级排序）")
        priority_order = {"p0": 0, "high": 1, "medium": 2, "low": 3}
        sorted_suggestions = sorted(
            suggestions,
            key=lambda s: priority_order.get(s.priority, 99)
        )
        for i, s in enumerate(sorted_suggestions, 1):
            priority_mark = {"p0": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(s.priority, "⚪")
            parts.append(f"  {priority_mark} [{i}] {s.action}")
            parts.append(f"      理由: {s.rationale}")
            if s.estimated_impact:
                parts.append(f"      预期效果: {s.estimated_impact}")
        parts.append("")

        if record.manual_review_notes:
            parts.append(f"📝 人工复核意见")
            parts.append(f"  复核人: {record.manual_reviewer or '未知'}")
            parts.append(f"  复核时间: {record.manual_reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if record.manual_reviewed_at else '未知'}")
            parts.append(f"  复核意见: {record.manual_review_notes}")
            if record.manual_correction_applied:
                parts.append(f"  状态: 已应用人工修正")
            parts.append("")

        if record.metrics:
            latest = record.metrics[-1]
            parts.append(f"📋 最新指标快照")
            parts.append(f"  时间: {latest.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            parts.append(f"  积压量: {latest.backlog_count:,} 条")
            parts.append(f"  生产速率: {latest.production_rate:,.1f} 条/秒")
            parts.append(f"  消费速率: {latest.consumption_rate:,.1f} 条/秒")
            parts.append(f"  净增长: {latest.production_rate - latest.consumption_rate:,.1f} 条/秒")
            parts.append(f"  死信数量: {latest.dead_letter_count:,} 条")
            parts.append(f"  消费者: {latest.active_consumer_count or latest.consumer_count} / {latest.consumer_count} 在线")

        return "\n".join(parts)

    @staticmethod
    def export_to_json(
        record: DiagnosisRecord,
        score_breakdown: List[ExplainableScore],
        include_raw_data: bool = False
    ) -> Dict[str, Any]:
        status = record.status
        if not isinstance(status, str):
            status = status.value

        alert_level = record.alert_level
        if alert_level and not isinstance(alert_level, str):
            alert_level = alert_level.value

        primary_cause = record.primary_cause
        if primary_cause and not isinstance(primary_cause, str):
            primary_cause = primary_cause.value

        report = {
            "diagnosis_id": record.id,
            "queue_name": record.queue_name,
            "status": status,
            "alert_level": alert_level,
            "primary_cause": primary_cause,
            "overall_score": record.overall_score,
            "score_explanation": record.score_explanation,
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat(),
            "exported_at": datetime.utcnow().isoformat(),
            "backlog_attribution": record.backlog_attribution,
            "processing_suggestions": record.processing_suggestions,
            "score_breakdown": [s.model_dump() for s in score_breakdown],
            "manual_review": {
                "notes": record.manual_review_notes,
                "reviewer": record.manual_reviewer,
                "reviewed_at": record.manual_reviewed_at.isoformat() if record.manual_reviewed_at else None,
                "correction_applied": record.manual_correction_applied
            },
            "edge_cases": [
                {
                    "type": ec.edge_case_type if isinstance(ec.edge_case_type, str) else ec.edge_case_type.value,
                    "hint": ec.human_readable_hint,
                    "confidence": ec.confidence,
                    "evidence": ec.evidence
                }
                for ec in record.edge_cases
            ],
            "metrics_summary": [
                {
                    "timestamp": m.timestamp.isoformat(),
                    "backlog_count": m.backlog_count,
                    "production_rate": m.production_rate,
                    "consumption_rate": m.consumption_rate,
                    "dead_letter_count": m.dead_letter_count,
                    "consumer_count": m.consumer_count,
                    "active_consumer_count": m.active_consumer_count
                }
                for m in record.metrics
            ]
        }

        if include_raw_data:
            report["raw_metrics"] = [
                {**m.raw_data, "timestamp": m.timestamp.isoformat()}
                for m in record.metrics
                if m.raw_data
            ]

        return report

    @classmethod
    def export_to_excel(
        cls,
        record: DiagnosisRecord,
        score_breakdown: List[ExplainableScore],
        include_raw_data: bool = False
    ) -> str:
        cls._ensure_export_dir()

        json_data = ReportExportService.export_to_json(
            record, score_breakdown, include_raw_data
        )

        filename = f"diagnosis_{record.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = os.path.join(cls.EXPORT_DIR, filename)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:

            alert_level = record.alert_level
            if alert_level and not isinstance(alert_level, str):
                alert_level = alert_level.value

            primary_cause = record.primary_cause
            if primary_cause and not isinstance(primary_cause, str):
                primary_cause = primary_cause.value

            status = record.status
            if not isinstance(status, str):
                status = status.value

            summary_data = {
                "项目": [
                    "诊断ID", "队列名称", "告警级别", "主要原因",
                    "综合评分", "置信度", "创建时间", "状态"
                ],
                "内容": [
                    record.id,
                    record.queue_name,
                    alert_level or "",
                    primary_cause or "",
                    f"{record.overall_score:.2f}" if record.overall_score else "",
                    f"{json_data['backlog_attribution']['confidence'] * 100:.1f}%" if json_data['backlog_attribution'] else "",
                    record.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    status
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name="诊断概览", index=False)

            if record.metrics:
                metrics_data = []
                for m in record.metrics:
                    metrics_data.append({
                        "时间": m.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                        "积压量": m.backlog_count,
                        "生产速率(条/秒)": m.production_rate,
                        "消费速率(条/秒)": m.consumption_rate,
                        "净增长(条/秒)": m.production_rate - m.consumption_rate,
                        "死信数量": m.dead_letter_count,
                        "死信增量": m.dead_letter_increment or "",
                        "消费者总数": m.consumer_count,
                        "活跃消费者": m.active_consumer_count or m.consumer_count
                    })
                pd.DataFrame(metrics_data).to_excel(writer, sheet_name="指标趋势", index=False)

            if json_data['score_breakdown']:
                score_data = []
                for s in json_data['score_breakdown']:
                    score_data.append({
                        "指标名称": s['metric_name'],
                        "分值": f"{s['value']:.2f}",
                        "阈值": f"{s['threshold']:.2f}" if s['threshold'] else "",
                        "解释": s['explanation'],
                        "计算公式": s['formula_used'] or ""
                    })
                pd.DataFrame(score_data).to_excel(writer, sheet_name="评分详解", index=False)

            if json_data['processing_suggestions']:
                sug_data = []
                for s in json_data['processing_suggestions']:
                    sug_data.append({
                        "优先级": s['priority'],
                        "处理动作": s['action'],
                        "理由": s['rationale'],
                        "预期效果": s.get('estimated_impact', '')
                    })
                pd.DataFrame(sug_data).to_excel(writer, sheet_name="处理建议", index=False)

            if json_data['edge_cases']:
                ec_data = []
                for ec in json_data['edge_cases']:
                    ec_data.append({
                        "异常类型": ec['type'],
                        "置信度": f"{ec['confidence'] * 100:.1f}%",
                        "提示信息": ec['hint']
                    })
                pd.DataFrame(ec_data).to_excel(writer, sheet_name="特殊情况", index=False)

            if record.consumer_logs:
                log_data = []
                for log in record.consumer_logs:
                    log_data.append({
                        "时间": log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                        "消费者ID": log.consumer_id,
                        "日志级别": log.log_level or "",
                        "是否心跳": "是" if log.is_heartbeat else "否",
                        "是否错误": "是" if log.is_error else "否",
                        "消息": log.message
                    })
                pd.DataFrame(log_data).to_excel(writer, sheet_name="消费者日志", index=False)

            if json_data['backlog_attribution']:
                attr = json_data['backlog_attribution']
                contribution_data = {
                    "因素": ["生产暴涨", "消费变慢", "死信堆积", "消费者掉线"],
                    "贡献度(%)": [
                        f"{attr['production_contribution'] * 100:.1f}",
                        f"{attr['consumption_contribution'] * 100:.1f}",
                        f"{attr['dead_letter_contribution'] * 100:.1f}",
                        f"{attr['consumer_offline_contribution'] * 100:.1f}"
                    ]
                }
                pd.DataFrame(contribution_data).to_excel(writer, sheet_name="归因分析", index=False)

            if include_raw_data and json_data.get("raw_metrics"):
                pd.DataFrame(json_data["raw_metrics"]).to_excel(
                    writer, sheet_name="原始数据", index=False
                )

            human_readable = ReportExportService.generate_human_readable_summary(
                record,
                BacklogAttribution(**json_data['backlog_attribution']) if json_data['backlog_attribution'] else None,
                record.edge_cases,
                [ProcessingSuggestion(**s) for s in json_data['processing_suggestions']] if json_data['processing_suggestions'] else []
            )
            summary_df = pd.DataFrame({"诊断报告": [human_readable]})
            summary_df.to_excel(writer, sheet_name="诊断报告", index=False)

        return filepath

    @classmethod
    def export_report(
        cls,
        record: DiagnosisRecord,
        score_breakdown: List[ExplainableScore],
        export_format: str = "excel",
        include_raw_data: bool = False
    ) -> Dict[str, Any]:
        if export_format == "json":
            return {
                "format": "json",
                "content": cls.export_to_json(record, score_breakdown, include_raw_data)
            }
        elif export_format == "excel":
            filepath = cls.export_to_excel(record, score_breakdown, include_raw_data)
            return {
                "format": "excel",
                "file_path": filepath,
                "download_url": f"/api/diagnosis/{record.id}/download"
            }
        else:
            raise ValueError(f"Unsupported export format: {export_format}")
