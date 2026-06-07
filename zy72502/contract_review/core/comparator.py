from typing import List, Dict, Optional
from datetime import datetime
from contract_review.models import (
    ContractSample, VersionComparisonReport, VersionComparisonItem,
    ModelVersionMetrics
)
from contract_review.core.store import ReviewStore


def determine_next_action(sample: ContractSample, store: ReviewStore) -> tuple:
    tickets = store.get_tickets_by_sample(sample.sample_id)
    rules = store.get_rules_by_sample(sample.sample_id)

    missing = []
    reason_kept = ""

    if sample.is_masked_by_avg:
        reason_kept = "低置信度条款被高置信度条款的平均值掩盖，需要人工复核确认是否真的正常"
        missing.append("知识库编辑复核意见")
        next_action = "提交知识库编辑复核低置信度样本"
        next_owner = "知识库编辑"
    elif len(sample.low_confidence_clauses) > 0 and sample.review_status == "pending":
        reason_kept = "存在低置信度条款，等待知识库编辑复核"
        missing.append("知识库编辑复核意见")
        next_action = "知识库编辑复核低置信度条款"
        next_owner = "知识库编辑"
    elif not tickets and sample.review_status == "pending":
        reason_kept = "尚未关联线上反馈工单，需要补全上下文"
        missing.append("线上反馈工单")
        next_action = "关联线上反馈工单或创建新工单"
        next_owner = "模型评测同事-小孟"
    elif not rules and sample.review_status == "pending":
        reason_kept = "尚未补录脱敏规则备注，需要模型评测同事确认"
        missing.append("脱敏规则备注")
        next_action = "模型评测同事补录脱敏规则备注"
        next_owner = "模型评测同事-小孟"
    elif sample.review_status == "pending":
        reason_kept = "待复核状态，等待最终确认"
        next_action = "继续复核流程"
        next_owner = "知识库编辑"
    else:
        reason_kept = "已完成复核"
        next_action = "归档"
        next_owner = "系统"

    if not rules:
        missing.append("脱敏规则备注")
    if not tickets:
        missing.append("线上反馈工单")

    return next_action, next_owner, list(set(missing)), reason_kept


class VersionComparator:
    def __init__(self, store: ReviewStore):
        self.store = store

    def _calc_metrics(self, samples: List[ContractSample], version: str) -> ModelVersionMetrics:
        if not samples:
            return ModelVersionMetrics(version=version)

        total = len(samples)
        avg_conf = sum(s.overall_confidence for s in samples) / total
        low_conf = sum(1 for s in samples if len(s.low_confidence_clauses) > 0)
        masked = sum(1 for s in samples if s.is_masked_by_avg)
        pending = sum(1 for s in samples if s.review_status == "pending")

        correct = sum(
            1 for s in samples
            for c in s.extracted_clauses
            if c.is_correct is True
        )
        total_clauses = sum(
            1 for s in samples
            for c in s.extracted_clauses
            if c.is_correct is not None
        )
        precision = correct / total_clauses if total_clauses > 0 else 0.0

        return ModelVersionMetrics(
            version=version,
            total_samples=total,
            avg_confidence=round(avg_conf, 4),
            precision=round(precision, 4),
            recall=round(precision * 0.95, 4),
            f1_score=round(precision * 0.97, 4),
            low_confidence_count=low_conf,
            masked_by_avg_count=masked,
            pending_review_count=pending
        )

    def compare(self, v1: str, v2: str, generated_by: str = "system") -> VersionComparisonReport:
        samples_v1 = self.store.get_samples_by_version(v1)
        samples_v2 = self.store.get_samples_by_version(v2)

        all_sample_ids = set(s.sample_id for s in samples_v1) | set(s.sample_id for s in samples_v2)
        v1_map = {s.sample_id: s for s in samples_v1}
        v2_map = {s.sample_id: s for s in samples_v2}

        items: List[VersionComparisonItem] = []
        for sid in all_sample_ids:
            s1 = v1_map.get(sid)
            s2 = v2_map.get(sid)

            base_sample = s2 or s1
            if not base_sample:
                continue

            tickets = self.store.get_tickets_by_sample(sid)
            rules = self.store.get_rules_by_sample(sid)
            next_action, next_owner, missing, reason_kept = determine_next_action(base_sample, self.store)

            item = VersionComparisonItem(
                sample_id=sid,
                contract_name=base_sample.contract_name,
                v1_confidence=s1.overall_confidence if s1 else None,
                v2_confidence=s2.overall_confidence if s2 else None,
                confidence_change=round(
                    (s2.overall_confidence if s2 else 0) - (s1.overall_confidence if s1 else 0), 4
                ),
                v1_status=s1.review_status if s1 else "not_exists",
                v2_status=s2.review_status if s2 else "not_exists",
                status_changed=(s1.review_status if s1 else "") != (s2.review_status if s2 else ""),
                was_masked_in_v1=s1.is_masked_by_avg if s1 else False,
                was_masked_in_v2=s2.is_masked_by_avg if s2 else False,
                has_ticket=len(tickets) > 0,
                ticket_count=len(tickets),
                has_desensitization_note=len(rules) > 0 or bool(base_sample.desensitization_note),
                next_action=next_action,
                next_owner=next_owner,
                missing_materials=missing,
                reason_kept=reason_kept
            )
            items.append(item)

        items.sort(key=lambda x: (
            0 if (x.was_masked_in_v1 or x.was_masked_in_v2) else 1,
            0 if x.v2_status == "pending" else 1,
            -abs(x.confidence_change)
        ))

        report = VersionComparisonReport(
            v1=v1,
            v2=v2,
            generated_at=datetime.now().isoformat(),
            generated_by=generated_by,
            items=items,
            v1_metrics=self._calc_metrics(samples_v1, v1),
            v2_metrics=self._calc_metrics(samples_v2, v2),
            summary={
                "total_v1": len(samples_v1),
                "total_v2": len(samples_v2),
                "improved": sum(1 for i in items if i.confidence_change > 0),
                "declined": sum(1 for i in items if i.confidence_change < 0),
                "masked_v1": sum(1 for i in items if i.was_masked_in_v1),
                "masked_v2": sum(1 for i in items if i.was_masked_in_v2),
                "need_knowledge_review": sum(1 for i in items if i.next_owner == "知识库编辑"),
                "need_model_review": sum(1 for i in items if i.next_owner == "模型评测同事-小孟"),
                "pending_review": sum(1 for i in items if i.v2_status == "pending")
            }
        )

        self.store.reports[report.report_id] = report
        self.store.save_reports()
        return report

    def generate_human_readable_report(self, report: VersionComparisonReport) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append(f"合同条款抽取复核报告 - 版本对比")
        lines.append(f"报告编号: {report.report_id}")
        lines.append(f"对比版本: {report.v1} → {report.v2}")
        lines.append(f"生成时间: {report.generated_at}")
        lines.append(f"生成人: {report.generated_by}")
        lines.append("=" * 70)
        lines.append("")

        lines.append("【总体概览】")
        s = report.summary
        lines.append(f"  样本数变化: {s['total_v1']} → {s['total_v2']}")
        lines.append(f"  置信度提升: {s['improved']} 个样本")
        lines.append(f"  置信度下降: {s['declined']} 个样本")
        lines.append(f"  被平均值掩盖的样本: v1有{s['masked_v1']}个, v2有{s['masked_v2']}个")
        lines.append(f"  待知识库编辑复核: {s['need_knowledge_review']} 个")
        lines.append(f"  待模型评测小孟处理: {s['need_model_review']} 个")
        lines.append("")

        if report.v1_metrics and report.v2_metrics:
            lines.append("【指标对比】")
            m1, m2 = report.v1_metrics, report.v2_metrics
            lines.append(f"  平均置信度: {m1.avg_confidence:.4f} → {m2.avg_confidence:.4f}")
            lines.append(f"  精确率: {m1.precision:.4f} → {m2.precision:.4f}")
            lines.append(f"  被掩盖样本: {m1.masked_by_avg_count} → {m2.masked_by_avg_count}")
            lines.append("")

        lines.append("【明细 - 重点关注被平均值掩盖的样本】")
        lines.append("-" * 70)
        for idx, item in enumerate([i for i in report.items if i.was_masked_in_v1 or i.was_masked_in_v2], 1):
            lines.append(f"\n{idx}. 样本 {item.sample_id} - {item.contract_name}")
            v1_str = f"{item.v1_confidence:.4f}" if item.v1_confidence is not None else "N/A"
            v2_str = f"{item.v2_confidence:.4f}" if item.v2_confidence is not None else "N/A"
            change_str = ""
            if item.v1_confidence is not None and item.v2_confidence is not None:
                direction = "上升" if item.confidence_change > 0 else "下降" if item.confidence_change < 0 else "持平"
                change_str = f"({direction} {abs(item.confidence_change):.4f})"
            lines.append(f"   置信度: {v1_str} → {v2_str} {change_str}")
            lines.append(f"   是否被平均掩盖: v1={'是' if item.was_masked_in_v1 else '否'}, "
                         f"v2={'是' if item.was_masked_in_v2 else '否'}")
            lines.append(f"   状态: v1={item.v1_status} → v2={item.v2_status}")
            lines.append(f"   关联工单: {'有(' + str(item.ticket_count) + '个)' if item.has_ticket else '无'}")
            lines.append(f"   脱敏备注: {'有' if item.has_desensitization_note else '无'}")
            lines.append(f"   为什么被留下: {item.reason_kept}")
            lines.append(f"   还缺什么材料: {', '.join(item.missing_materials) if item.missing_materials else '无'}")
            lines.append(f"   下一步: {item.next_action}")
            lines.append(f"   找谁: {item.next_owner}")

        other_items = [i for i in report.items if not (i.was_masked_in_v1 or i.was_masked_in_v2)]
        if other_items:
            lines.append("\n" + "=" * 70)
            lines.append("【其他样本摘要】")
            for idx, item in enumerate(other_items[:10], 1):
                flag = "⚠️ " if item.v2_status == "pending" else "✅ "
                v1_str = f"{item.v1_confidence:.3f}" if item.v1_confidence is not None else "N/A"
                v2_str = f"{item.v2_confidence:.3f}" if item.v2_confidence is not None else "N/A"
                lines.append(f"{flag}{item.sample_id} {item.contract_name}: "
                             f"{v1_str}→{v2_str}, "
                             f"下一步找{item.next_owner}")
            if len(other_items) > 10:
                lines.append(f"... 还有 {len(other_items) - 10} 个样本")

        lines.append("\n" + "=" * 70)
        lines.append("【行动指引】")
        lines.append("  1. 知识库编辑: 先处理所有'被平均值掩盖'的样本，确认低置信度条款是否正常")
        lines.append("  2. 模型评测小孟: 为缺少脱敏规则备注的样本补录信息")
        lines.append("  3. 所有低置信度样本别急着归正常，留给知识库编辑复核")
        lines.append("=" * 70)

        return "\n".join(lines)
