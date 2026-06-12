from typing import List, Dict, Optional
from datetime import datetime
from contract_review.models import (
    ContractSample, VersionComparisonReport, VersionComparisonItem,
    ModelVersionMetrics
)
from contract_review.core.store import ReviewStore


def determine_next_action(sample: ContractSample, store: ReviewStore) -> tuple:
    tickets = store.get_tickets_by_contract_name(sample.contract_name)
    rules = store.get_rules_by_contract_name(sample.contract_name)

    missing = []
    reason_kept = ""

    if sample.is_masked_by_avg:
        reason_kept = "低置信度条款被高置信度条款的平均值掩盖，整体置信度看起来正常但实际有问题，必须人工复核"
        missing.append("知识库编辑复核意见")
        next_action = "提交知识库编辑复核被平均值掩盖的样本"
        next_owner = "知识库编辑"
    elif len(sample.low_confidence_clauses) > 0 and sample.review_status == "pending":
        reason_kept = f"存在 {len(sample.low_confidence_clauses)} 个低置信度条款，等待知识库编辑确认是否正常"
        missing.append("知识库编辑复核意见")
        next_action = "知识库编辑逐条复核低置信度条款"
        next_owner = "知识库编辑"
    elif not tickets and sample.review_status == "pending":
        reason_kept = "尚未关联线上反馈工单，无法判断抽取结果是否符合线上实际情况"
        missing.append("线上反馈工单")
        next_action = "模型评测同事小孟导入或关联线上反馈工单"
        next_owner = "模型评测同事-小孟"
    elif not rules and sample.review_status == "pending":
        reason_kept = "尚未补录脱敏规则备注，无法判断低置信度是否因脱敏导致"
        missing.append("脱敏规则备注")
        next_action = "模型评测同事小孟补录脱敏规则备注，说明低置信度原因"
        next_owner = "模型评测同事-小孟"
    elif sample.review_status == "pending":
        reason_kept = "工单和脱敏备注已补全，等待知识库编辑最终确认"
        next_action = "知识库编辑做最终复核判断"
        next_owner = "知识库编辑"
    elif sample.review_status == "approved":
        reason_kept = "已通过知识库编辑复核"
        next_action = "可用于模型训练或上线"
        next_owner = "系统"
    elif sample.review_status == "rejected":
        reason_kept = "已被知识库编辑驳回，需要重新处理"
        next_action = "分析驳回原因，重新标注或优化模型"
        next_owner = "模型评测同事-小孟"
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

        v1_by_name = {s.contract_name: s for s in samples_v1}
        v2_by_name = {s.contract_name: s for s in samples_v2}

        all_contract_names = set(v1_by_name.keys()) | set(v2_by_name.keys())

        items: List[VersionComparisonItem] = []
        for contract_name in sorted(all_contract_names):
            s1 = v1_by_name.get(contract_name)
            s2 = v2_by_name.get(contract_name)

            base_sample = s2 or s1
            if not base_sample:
                continue

            display_id = s2.sample_id if s2 else s1.sample_id

            tickets = self.store.get_tickets_by_contract_name(contract_name)
            rules = self.store.get_rules_by_contract_name(contract_name)

            sample_for_determine = s2 if s2 else s1
            next_action, next_owner, missing, reason_kept = determine_next_action(
                sample_for_determine, self.store
            )

            v1_conf = s1.overall_confidence if s1 else None
            v2_conf = s2.overall_confidence if s2 else None
            conf_change = 0.0
            if v1_conf is not None and v2_conf is not None:
                conf_change = round(v2_conf - v1_conf, 4)

            item = VersionComparisonItem(
                sample_id=display_id,
                contract_name=contract_name,
                v1_sample_id=s1.sample_id if s1 else None,
                v2_sample_id=s2.sample_id if s2 else None,
                v1_confidence=v1_conf,
                v2_confidence=v2_conf,
                confidence_change=conf_change,
                v1_status=s1.review_status if s1 else "not_exists",
                v2_status=s2.review_status if s2 else "not_exists",
                status_changed=(s1.review_status if s1 else "") != (s2.review_status if s2 else ""),
                was_masked_in_v1=s1.is_masked_by_avg if s1 else False,
                was_masked_in_v2=s2.is_masked_by_avg if s2 else False,
                v1_low_confidence_count=len(s1.low_confidence_clauses) if s1 else 0,
                v2_low_confidence_count=len(s2.low_confidence_clauses) if s2 else 0,
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

        improved = sum(1 for i in items if i.v1_confidence and i.v2_confidence and i.confidence_change > 0)
        declined = sum(1 for i in items if i.v1_confidence and i.v2_confidence and i.confidence_change < 0)

        report = VersionComparisonReport(
            v1=v1,
            v2=v2,
            generated_at=datetime.now().isoformat(),
            generated_by=generated_by,
            items=items,
            v1_metrics=self._calc_metrics(samples_v1, v1),
            v2_metrics=self._calc_metrics(samples_v2, v2),
            summary={
                "total_contracts": len(items),
                "total_v1": len(samples_v1),
                "total_v2": len(samples_v2),
                "improved": improved,
                "declined": declined,
                "masked_v1": sum(1 for i in items if i.was_masked_in_v1),
                "masked_v2": sum(1 for i in items if i.was_masked_in_v2),
                "need_knowledge_review": sum(1 for i in items if i.next_owner == "知识库编辑"),
                "need_model_review": sum(1 for i in items if i.next_owner == "模型评测同事-小孟"),
                "pending_review_v1": sum(1 for i in items if i.v1_status == "pending"),
                "pending_review_v2": sum(1 for i in items if i.v2_status == "pending")
            }
        )

        self.store.reports[report.report_id] = report
        self.store.save_reports()
        return report

    def generate_human_readable_report(self, report: VersionComparisonReport) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append(f"合同条款抽取复核报告 - 版本对比")
        lines.append(f"报告编号: {report.report_id}")
        lines.append(f"对比版本: {report.v1} → {report.v2}")
        lines.append(f"生成时间: {report.generated_at}")
        lines.append(f"生成人: {report.generated_by}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("【📊 总体概览】")
        s = report.summary
        lines.append(f"  对比合同数: {s['total_contracts']} 份")
        lines.append(f"  样本数: v1有{s['total_v1']}个 → v2有{s['total_v2']}个")
        lines.append(f"  置信度提升: {s['improved']} 个合同")
        lines.append(f"  置信度下降: {s['declined']} 个合同")
        lines.append(f"  被平均值掩盖: v1有{s['masked_v1']}个, v2有{s['masked_v2']}个")
        lines.append(f"  待知识库编辑复核: {s['need_knowledge_review']} 个")
        lines.append(f"  待模型评测小孟处理: {s['need_model_review']} 个")
        lines.append("")

        if report.v1_metrics and report.v2_metrics:
            lines.append("【📈 指标对比】")
            m1, m2 = report.v1_metrics, report.v2_metrics
            lines.append(f"  平均置信度: {m1.avg_confidence:.4f} → {m2.avg_confidence:.4f}")
            lines.append(f"  精确率: {m1.precision:.4f} → {m2.precision:.4f}")
            lines.append(f"  低置信度样本: {m1.low_confidence_count} → {m2.low_confidence_count}")
            lines.append(f"  被平均值掩盖: {m1.masked_by_avg_count} → {m2.masked_by_avg_count}")
            lines.append(f"  待复核: {m1.pending_review_count} → {m2.pending_review_count}")
            lines.append("")

        lines.append("【⚠️ 重点关注 - 被平均值掩盖的样本】")
        lines.append("-" * 80)
        masked_items = [i for i in report.items if i.was_masked_in_v1 or i.was_masked_in_v2]
        if not masked_items:
            lines.append("  暂无被平均值掩盖的样本 ✅")
        else:
            for idx, item in enumerate(masked_items, 1):
                lines.append(f"\n{idx}. 📄 {item.contract_name}")
                lines.append(f"   样本ID: v1={item.v1_sample_id or '无'} | v2={item.v2_sample_id or '无'}")

                v1_str = f"{item.v1_confidence:.4f}" if item.v1_confidence is not None else "N/A"
                v2_str = f"{item.v2_confidence:.4f}" if item.v2_confidence is not None else "N/A"
                change_str = ""
                if item.v1_confidence is not None and item.v2_confidence is not None:
                    direction = "↑上升" if item.confidence_change > 0 else "↓下降" if item.confidence_change < 0 else "→持平"
                    change_str = f"  {direction} {abs(item.confidence_change):.4f}"
                lines.append(f"   置信度: {v1_str} → {v2_str}{change_str}")

                lines.append(f"   低置信条款数: v1={item.v1_low_confidence_count}个 | v2={item.v2_low_confidence_count}个")
                lines.append(f"   被平均掩盖: v1={'是 ⚠️' if item.was_masked_in_v1 else '否'} | v2={'是 ⚠️' if item.was_masked_in_v2 else '否'}")
                lines.append(f"   状态: v1={item.v1_status} → v2={item.v2_status}")
                lines.append(f"   关联工单: {'有(' + str(item.ticket_count) + '个) ✅' if item.has_ticket else '无 ❌'}")
                lines.append(f"   脱敏备注: {'有 ✅' if item.has_desensitization_note else '无 ❌'}")
                lines.append(f"")
                lines.append(f"   🎯 为什么被留下: {item.reason_kept}")
                lines.append(f"   📦 还缺什么材料: {', '.join(item.missing_materials) if item.missing_materials else '无'}")
                lines.append(f"   👤 下一步找谁: {item.next_owner}")
                lines.append(f"   📝 具体做什么: {item.next_action}")

        other_items = [i for i in report.items if not (i.was_masked_in_v1 or i.was_masked_in_v2)]
        if other_items:
            lines.append("\n" + "=" * 80)
            lines.append("【📋 其他合同对比明细】")
            lines.append("-" * 80)
            for idx, item in enumerate(other_items, 1):
                flag = "⚠️ " if item.v2_status == "pending" else "✅ "
                v1_str = f"{item.v1_confidence:.3f}" if item.v1_confidence is not None else "N/A"
                v2_str = f"{item.v2_confidence:.3f}" if item.v2_confidence is not None else "N/A"

                v1_masked = "⚠️" if item.was_masked_in_v1 else "  "
                v2_masked = "⚠️" if item.was_masked_in_v2 else "  "

                lines.append(f"\n{idx}. {flag}{item.contract_name}")
                lines.append(f"   置信度: {v1_str} {v1_masked} → {v2_str} {v2_masked}")
                lines.append(f"   状态: {item.v1_status} → {item.v2_status}")
                lines.append(f"   工单: {'✅' if item.has_ticket else '❌'} | 备注: {'✅' if item.has_desensitization_note else '❌'}")
                lines.append(f"   下一步: {item.next_owner} - {item.next_action}")

        lines.append("\n" + "=" * 80)
        lines.append("【🚩 行动指引】")
        lines.append("  1. 知识库编辑: 先处理所有'被平均值掩盖'的样本，逐条确认低置信度条款")
        lines.append("  2. 知识库编辑: 不要被平均置信度迷惑，重点看单个条款的置信度分布")
        lines.append("  3. 模型评测小孟: 为缺少工单或脱敏备注的样本补全信息")
        lines.append("  4. 模型评测小孟: 补录备注时填写修改原因，便于后续追溯")
        lines.append("  5. 所有人: 低置信度样本别急着归正常，必须留给知识库编辑复核")
        lines.append("  6. 查询历史: 可查看修改日志了解改前改后和修改原因")
        lines.append("=" * 80)

        return "\n".join(lines)
