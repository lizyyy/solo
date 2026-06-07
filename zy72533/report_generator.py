from typing import List, Optional
from datetime import datetime
from models import Sample, ModelVersionCompare, NextAction
from core import ModelVersionComparator


class ReportGenerator:
    @staticmethod
    def generate_comparison_report(
        samples: List[Sample],
        baseline_version: str,
        current_version: str
    ) -> str:
        comparisons = []
        for sample in samples:
            comp = ModelVersionComparator.compare_versions(
                sample, baseline_version, current_version
            )
            if comp:
                comparisons.append(comp)

        if not comparisons:
            return "没有可对比的样本数据"

        lines = []
        lines.append("=" * 80)
        lines.append("政务热线摘要脱敏 - 模型版本对比报告")
        lines.append("=" * 80)
        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"对比版本: {baseline_version} → {current_version}")
        lines.append(f"样本数量: {len(comparisons)}")
        lines.append("")

        need_kb_review = [c for c in comparisons if c.needs_kb_review]
        need_algo_oper = [c for c in comparisons if c.next_action == NextAction.TO_ALGO_OPER]
        need_retrain = [c for c in comparisons if c.next_action == NextAction.TO_MODEL_RETRAIN]
        low_conf_hidden = [c for c in comparisons if c.is_low_conf_hidden]

        lines.append("【概览统计】")
        lines.append(f"- 需知识库编辑复核: {len(need_kb_review)} 条")
        lines.append(f"- 需算法运营跟进: {len(need_algo_oper)} 条")
        lines.append(f"- 建议模型重训: {len(need_retrain)} 条")
        lines.append(f"- 低置信度被平均掩盖: {len(low_conf_hidden)} 条")
        lines.append("")

        if need_kb_review:
            lines.append("-" * 80)
            lines.append("【重点关注：需知识库编辑复核的样本】")
            lines.append("-" * 80)
            for comp in need_kb_review:
                lines.append(ReportGenerator._format_comparison_detail(comp, highlight=True))
                lines.append("")

        lines.append("-" * 80)
        lines.append("【全部样本详细对比】")
        lines.append("-" * 80)
        for comp in comparisons:
            lines.append(ReportGenerator._format_comparison_detail(comp))
            lines.append("")

        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)

    @staticmethod
    def _format_comparison_detail(comp: ModelVersionCompare, highlight: bool = False) -> str:
        lines = []
        prefix = "⚠️  " if highlight else "  "

        lines.append(f"{prefix}样本ID: {comp.sample_id}")
        lines.append(f"  置信度变化: {comp.baseline_confidence:.2f} → {comp.current_confidence:.2f} "
                     f"({comp.confidence_diff:+.2f})")

        if comp.is_low_conf_hidden:
            lines.append("  🔴 低置信度样本被平均指标掩盖，需重点关注！")

        lines.append(f"  保留原因: {comp.reason_kept}")
        lines.append(f"  关键差异:")
        for diff in comp.key_differences:
            lines.append(f"    - {diff}")

        if comp.missing_materials:
            lines.append(f"  缺少材料:")
            for mat in comp.missing_materials:
                lines.append(f"    ❌ {mat}")

        next_action_map = {
            NextAction.TO_KB_EDITOR: "📋 转交知识库编辑复核",
            NextAction.TO_ALGO_OPER: "🔧 转交算法运营老唐跟进",
            NextAction.TO_REANNOTATE: "✏️  需要重新标注",
            NextAction.TO_MODEL_RETRAIN: "🤖 建议模型重训优化"
        }
        lines.append(f"  下一步行动: {next_action_map.get(comp.next_action, comp.next_action.value)}")

        lines.append(f"  基线版本摘要: {comp.baseline_summary}")
        lines.append(f"  当前版本摘要: {comp.current_summary}")

        return "\n".join(lines)

    @staticmethod
    def generate_workflow_report(sample: Sample) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append(f"样本 {sample.sample_id} - 处理流程报告")
        lines.append("=" * 60)
        lines.append(f"当前状态: {sample.status.value}")
        lines.append(f"置信度等级: {sample.confidence_level.value}")
        if sample.hidden_by_avg:
            lines.append("⚠️  该样本为低置信度被平均指标掩盖样本")
        lines.append("")

        lines.append("【原始热线内容】")
        lines.append(f"  来电时间: {sample.call_time.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"  热线号码: {sample.hotline_number}")
        lines.append(f"  原始文本: {sample.original_text}")
        lines.append("")

        if sample.model_outputs:
            lines.append("【模型输出历史】")
            for i, output in enumerate(sample.model_outputs, 1):
                lines.append(f"  {i}. 版本 {output.model_version} (置信度: {output.confidence:.2f})")
                lines.append(f"     摘要: {output.summary}")
                if output.mask_details:
                    masks = ", ".join([f"{m['type']}:{m['masked']}" for m in output.mask_details])
                    lines.append(f"     脱敏: {masks}")
                if output.raw_output:
                    lines.append(f"     原始输出片段: {output.raw_output[:50]}..." if len(output.raw_output) > 50 else f"     原始输出片段: {output.raw_output}")
            lines.append("")

        if sample.annotations:
            lines.append("【标注记录】")
            for i, ann in enumerate(sample.annotations, 1):
                lines.append(f"  {i}. 标注员: {ann.annotator} ({ann.timestamp.strftime('%Y-%m-%d %H:%M')})")
                lines.append(f"     修正摘要: {ann.corrected_summary}")
                lines.append(f"     标注留言: {ann.comment}")
                if ann.error_type:
                    lines.append(f"     错误类型: {ann.error_type}")
            lines.append("")

        if sample.supplements:
            lines.append("【补录记录】")
            for i, sup in enumerate(sample.supplements, 1):
                lines.append(f"  {i}. 操作人: {sup.operator} ({sup.timestamp.strftime('%Y-%m-%d %H:%M')})")
                lines.append(f"     补录原因: {sup.reason}")
                lines.append(f"     模型输出片段: {sup.model_output_snippet}")
                if sup.additional_notes:
                    lines.append(f"     补充说明: {sup.additional_notes}")
            lines.append("")

        if sample.review_notes:
            lines.append(f"【复核意见】{sample.review_notes}")
            lines.append("")

        if sample.next_action:
            action_map = {
                NextAction.TO_KB_EDITOR: "转交知识库编辑复核",
                NextAction.TO_ALGO_OPER: "转交算法运营老唐跟进",
                NextAction.TO_REANNOTATE: "需要重新标注",
                NextAction.TO_MODEL_RETRAIN: "建议模型重训优化"
            }
            lines.append(f"【下一步行动】{action_map.get(sample.next_action, sample.next_action.value)}")

        lines.append("=" * 60)
        return "\n".join(lines)
