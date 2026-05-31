"""评估说明导出模块：生成可追溯的评审说明，不追求排版但信息完整"""
import os
import json
from typing import List, Dict, Any
from datetime import datetime
from pathlib import Path

from .models import (
    Dispute, DisputeStatus, DisputeType, DataRecord, RecordType
)
from .trace_manager import TraceManager


class EvaluationExporter:
    """评估说明导出器"""

    def __init__(self, trace_manager: TraceManager):
        self.trace_manager = trace_manager

    def export_review_notes(
        self,
        disputes: List[Dispute],
        records: List[DataRecord],
        output_path: str,
        model_name: str = "",
        reviewer: str = ""
    ) -> str:
        """导出评审说明 - 纯文本格式，信息完整可追溯"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        lines = []

        lines.append("=" * 70)
        lines.append("文本分类争议评审说明")
        lines.append("=" * 70)
        lines.append(f"生成时间: {datetime.now().isoformat()}")
        lines.append(f"模型名称: {model_name or '未指定'}")
        lines.append(f"评审人: {reviewer or '未指定'}")
        lines.append(f"争议总数: {len(disputes)}")
        lines.append(f"  - 已解决: {len([d for d in disputes if d.status == DisputeStatus.RESOLVED])}")
        lines.append(f"  - 处理中: {len([d for d in disputes if d.status == DisputeStatus.REVIEWING])}")
        lines.append(f"  - 待处理: {len([d for d in disputes if d.status == DisputeStatus.OPEN])}")
        lines.append(f"  - 已驳回: {len([d for d in disputes if d.status == DisputeStatus.REJECTED])}")
        lines.append("")

        type_stats = {}
        for d in disputes:
            t = d.dispute_type.value
            type_stats[t] = type_stats.get(t, 0) + 1
        lines.append("争议类型统计:")
        for t, cnt in type_stats.items():
            lines.append(f"  - {t}: {cnt}")
        lines.append("")
        lines.append("-" * 70)
        lines.append("")

        for idx, dispute in enumerate(disputes, 1):
            lines.extend(self._format_dispute_section(dispute, records, idx))
            lines.append("")

        lines.append("=" * 70)
        lines.append("附录：记录类型说明")
        lines.append("  normal - 正常记录")
        lines.append("  late_attachment - 晚到附件")
        lines.append("  duplicate - 重复项")
        lines.append("  manual_correction - 人工更正")
        lines.append("")
        lines.append("争议类型说明:")
        lines.append("  label_missing - 标签漏映射")
        lines.append("  metric_change - 指标口径变更")
        lines.append("  label_mismatch - 标签不一致")
        lines.append("  duplicate_conflict - 重复项冲突")
        lines.append("  late_attachment_issue - 晚到附件待复核")
        lines.append("  correction_conflict - 人工更正冲突")
        lines.append("=" * 70)

        content = "\n".join(lines)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(output_path)

    def _format_dispute_section(
        self,
        dispute: Dispute,
        records: List[DataRecord],
        index: int
    ) -> List[str]:
        """格式化单条争议记录"""
        lines = []

        lines.append(f"【{index}】{dispute.title}")
        lines.append("-" * 50)
        lines.append(f"争议ID: {dispute.dispute_id}")
        lines.append(f"类型: {dispute.dispute_type.value}")
        lines.append(f"状态: {dispute.status.value}")
        lines.append(f"描述: {dispute.description}")
        lines.append(f"创建时间: {dispute.created_at.isoformat()}")
        lines.append("")

        if dispute.review_reasons:
            lines.append(">>> 复核原因:")
            for reason in dispute.review_reasons:
                lines.append(f"  [类型: {reason.reason_type}]")
                lines.append(f"  复核人: {reason.reviewer}")
                lines.append(f"  时间: {reason.created_at.isoformat()}")
                lines.append(f"  说明: {reason.description}")
                if reason.metric_before and reason.metric_after:
                    lines.append(f"  指标变更前: {json.dumps(reason.metric_before, ensure_ascii=False)}")
                    lines.append(f"  指标变更后: {json.dumps(reason.metric_after, ensure_ascii=False)}")
                    lines.append(f"  变更详情: {self._format_metric_diff(reason.metric_before, reason.metric_after)}")
                lines.append("")

        if dispute.conclusion:
            lines.append(">>> 结论:")
            lines.append(f"  结论: {dispute.conclusion}")
            lines.append(f"  处理人: {dispute.resolver}")
            lines.append(f"  处理时间: {dispute.resolved_at.isoformat() if dispute.resolved_at else 'N/A'}")
            lines.append("")

        trace_result = self.trace_manager.trace_conclusion_to_source(dispute, records)

        lines.append(">>> 关联记录（可追溯）:")
        for rec_idx, rec in enumerate(trace_result["related_records"], 1):
            lines.append(f"  【记录{rec_idx}】ID: {rec['record_id']}, 类型: {rec['record_type']}")

            if rec.get("annotation"):
                ann = rec["annotation"]
                lines.append(f"    -> 标注样本:")
                lines.append(f"       样本ID: {ann['sample_id']}")
                lines.append(f"       文本: {ann['text']}")
                lines.append(f"       标签: {ann['label']}")
                lines.append(f"       标注人: {ann['annotator']}")
                lines.append(f"       标注时间: {ann['annotated_at']}")
                lines.append(f"       来源文件: {ann['source_file']}")
                lines.append(f"       来源行号: {ann['source_line']}")
                lines.append(f"       置信度: {ann['confidence']}")

            if rec.get("evaluation"):
                evl = rec["evaluation"]
                lines.append(f"    -> 评估记录:")
                lines.append(f"       评估ID: {evl['eval_id']}")
                lines.append(f"       样本ID: {evl['sample_id']}")
                lines.append(f"       预测标签: {evl['predicted_label']}")
                lines.append(f"       真值标签: {evl['ground_truth']}")
                lines.append(f"       是否正确: {evl['is_correct']}")
                lines.append(f"       评估人: {evl['evaluator']}")
                lines.append(f"       评估时间: {evl['evaluated_at']}")
                lines.append(f"       模型版本: {evl['model_version']}")
                lines.append(f"       来源文件: {evl['source_file']}")
                lines.append(f"       来源行号: {evl['source_line']}")
                if evl["metrics"]:
                    lines.append(f"       指标: {json.dumps(evl['metrics'], ensure_ascii=False)}")

            if rec.get("note"):
                lines.append(f"    -> 备注: {rec['note']}")

        lines.append("")
        lines.append(">>> 证据链:")
        for ev_idx, ev in enumerate(trace_result["evidence_chain"], 1):
            if ev.get("type") == "review_reason":
                lines.append(f"  {ev_idx}. [复核原因] {ev['reason_type']} - {ev['reviewer']}: {ev['description']}")
            elif ev.get("type") == "conclusion":
                lines.append(f"  {ev_idx}. [结论] {ev['status']} - {ev['resolver']}: {ev['conclusion']}")
            else:
                lines.append(f"  {ev_idx}. [{ev['link_type']}] -> {ev['target_type']}:{ev['target_id']}")
                lines.append(f"     说明: {ev['description']}")

        lines.append("")
        lines.append(f"-- 争议{index}结束 --")

        return lines

    def _format_metric_diff(self, before: Dict, after: Dict) -> str:
        """格式化指标变更差异"""
        diffs = []
        all_keys = set(before.keys()) | set(after.keys())
        for key in sorted(all_keys):
            b = before.get(key, "N/A")
            a = after.get(key, "N/A")
            if b != a:
                if isinstance(b, (int, float)) and isinstance(a, (int, float)) and b != 0:
                    change = (a - b) / b * 100
                    diffs.append(f"{key}: {b:.4f} -> {a:.4f} ({change:+.2f}%)")
                else:
                    diffs.append(f"{key}: {b} -> {a}")
        return ", ".join(diffs) if diffs else "无显著变化"

    def export_summary_table(
        self,
        disputes: List[Dispute],
        output_path: str
    ) -> str:
        """导出争议汇总表 - CSV格式"""
        import csv

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "序号", "争议ID", "类型", "状态", "标题",
                "关联记录数", "证据链数", "已复核", "有结论",
                "创建时间", "解决时间", "处理人"
            ])

            for idx, d in enumerate(disputes, 1):
                writer.writerow([
                    idx,
                    d.dispute_id,
                    d.dispute_type.value,
                    d.status.value,
                    d.title,
                    len(d.record_ids),
                    len(d.evidence_links),
                    "是" if d.review_reasons else "否",
                    "是" if d.conclusion else "否",
                    d.created_at.isoformat(),
                    d.resolved_at.isoformat() if d.resolved_at else "",
                    d.resolver or ""
                ])

        return str(output_path)

    def export_json(
        self,
        disputes: List[Dispute],
        records: List[DataRecord],
        output_path: str
    ) -> str:
        """导出完整JSON数据 - 用于程序处理"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        record_map = {r.record_id: r for r in records}

        result = {
            "export_time": datetime.now().isoformat(),
            "dispute_count": len(disputes),
            "record_count": len(records),
            "disputes": []
        }

        for dispute in disputes:
            d_data = {
                "dispute_id": dispute.dispute_id,
                "dispute_type": dispute.dispute_type.value,
                "status": dispute.status.value,
                "title": dispute.title,
                "description": dispute.description,
                "created_at": dispute.created_at.isoformat(),
                "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
                "conclusion": dispute.conclusion,
                "resolver": dispute.resolver,
                "metadata": dispute.metadata,
                "record_ids": dispute.record_ids,
                "evidence_links": [
                    {
                        "link_id": l.link_id,
                        "link_type": l.link_type,
                        "target_type": l.target_type,
                        "target_id": l.target_id,
                        "description": l.description,
                        "source_file": self._extract_source_file(l.description),
                        "source_line": self._extract_source_line(l.description)
                    }
                    for l in dispute.evidence_links
                ],
                "review_reasons": [
                    {
                        "reason_id": r.reason_id,
                        "reviewer": r.reviewer,
                        "reason_type": r.reason_type,
                        "description": r.description,
                        "metric_before": r.metric_before,
                        "metric_after": r.metric_after,
                        "created_at": r.created_at.isoformat()
                    }
                    for r in dispute.review_reasons
                ],
                "trace": self.trace_manager.trace_conclusion_to_source(dispute, records)
            }
            result["disputes"].append(d_data)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        return str(output_path)

    def _extract_source_file(self, description: str) -> str:
        """从描述中提取源文件路径"""
        import re
        match = re.search(r"来源:?\s*(\S+\.\w+)", description)
        return match.group(1) if match else ""

    def _extract_source_line(self, description: str) -> str:
        """从描述中提取行号"""
        import re
        match = re.search(r"第(\d+)行", description)
        return match.group(1) if match else ""
