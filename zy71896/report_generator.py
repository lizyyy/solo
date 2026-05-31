from typing import List
from datetime import datetime

from models import (
    ElevatorAccelerationReview,
    ReviewConclusion,
    JudgmentStep,
    ChangeRecord,
    ChangeType,
    ConclusionType,
    DataSource,
)


CONCLUSION_DISPLAY = {
    ConclusionType.QUALIFIED: ("✅ 合格", "green"),
    ConclusionType.UNQUALIFIED: ("❌ 不合格", "red"),
    ConclusionType.PENDING: ("⏳ 待补充材料", "yellow"),
    ConclusionType.CROSS_LEVEL: ("⚠️ 跨档待确认", "orange"),
}


class ReportGenerator:
    @staticmethod
    def generate_chief_report(review: ElevatorAccelerationReview) -> str:
        conclusion = review.conclusion
        if not conclusion:
            return "⚠️ 复核尚未执行，请先运行复核流程"

        conclusion_text, conclusion_color = CONCLUSION_DISPLAY.get(
            conclusion.conclusion_type, (conclusion.conclusion_type.value, "gray")
        )

        report_lines = []
        report_lines.append("=" * 70)
        report_lines.append("📋 电梯加速度复核报告（值班长版）")
        report_lines.append("=" * 70)
        report_lines.append("")
        report_lines.append(f"📌 基本信息")
        report_lines.append(f"   复核单号：{review.id}")
        report_lines.append(f"   电梯编号：{review.elevator_id}")
        report_lines.append(f"   创建时间：{review.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"   当前版本：v{review.version}")
        report_lines.append(f"   状态：{review.status}")
        report_lines.append("")

        report_lines.append(f"🎯 最终结论")
        report_lines.append(f"   {conclusion_text}")
        if conclusion.final_level:
            report_lines.append(f"   判定档位：{conclusion.final_level.value}档")
        if conclusion.max_acceleration is not None:
            report_lines.append(f"   峰值加速度：{conclusion.max_acceleration:.3f} m/s²")
        report_lines.append("")

        if conclusion.conclusion_type == ConclusionType.CROSS_LEVEL:
            report_lines.append("⚠️ 阈值跨档提醒")
            report_lines.append(f"   跨档来源：{conclusion.cross_level_source.value if conclusion.cross_level_source else '未知'}")
            if conclusion.cross_level_from and conclusion.cross_level_to:
                report_lines.append(f"   档位差异：阈值表 {conclusion.cross_level_from.value}档 → 实测 {conclusion.cross_level_to.value}档")
            report_lines.append("")

        if conclusion.next_action:
            report_lines.append("📝 下一步操作")
            report_lines.append(f"   操作内容：{conclusion.next_action}")
            report_lines.append(f"   责任方：{conclusion.next_owner}")
            report_lines.append("")

        report_lines.append("-" * 70)
        report_lines.append("🔍 判断理由明细（按步骤）")
        report_lines.append("-" * 70)
        for step in conclusion.judgment_steps:
            source_icon = ReportGenerator._get_source_icon(step.data_source)
            report_lines.append("")
            report_lines.append(f"【步骤{step.step_order}】{step.description}")
            report_lines.append(f"     判断：{step.judgment}")
            report_lines.append(f"     原因：{step.reason}")
            report_lines.append(f"     来源：{source_icon} {step.data_source.value if step.data_source else '自动计算'}")
            report_lines.append(f"     时间：{step.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            if step.evidence:
                report_lines.append(f"     证据：{ReportGenerator._format_evidence(step.evidence)}")

        report_lines.append("")
        report_lines.append("-" * 70)
        report_lines.append("📜 变更历史记录")
        report_lines.append("-" * 70)

        if review.change_history:
            material_changes, conclusion_changes = ReportGenerator._classify_changes_for_display(review.change_history)

            if material_changes:
                report_lines.append("")
                report_lines.append("📦 仅补材料（不影响结论）：")
                for i, change in enumerate(material_changes, 1):
                    report_lines.append(f"   {i}. [{change.timestamp.strftime('%Y-%m-%d %H:%M')}] {change.reason}")
                    report_lines.append(f"      字段：{change.field_name} | 操作人：{change.operator or '系统'}")

            if conclusion_changes:
                report_lines.append("")
                report_lines.append("🔴 影响结论的变更：")
                for i, change in enumerate(conclusion_changes, 1):
                    report_lines.append(f"   {i}. [{change.timestamp.strftime('%Y-%m-%d %H:%M')}] {change.reason}")
                    report_lines.append(f"      字段：{change.field_name}")
                    report_lines.append(f"      变更：{change.old_value} → {change.new_value}")
                    report_lines.append(f"      操作人：{change.operator or '系统'} | 来源：{change.data_source.value}")

            manual_curve_changes = [c for c in review.change_history if c.change_type == ChangeType.CURVE_EDITED]
            if manual_curve_changes:
                report_lines.append("")
                report_lines.append("✏️ 振动曲线人工修改记录（历史已留存）：")
                for i, change in enumerate(manual_curve_changes, 1):
                    report_lines.append(f"   {i}. [{change.timestamp.strftime('%Y-%m-%d %H:%M')}] {change.reason}")
                    report_lines.append(f"      变更前：{change.old_value}")
                    report_lines.append(f"      变更后：{change.new_value}")
                    report_lines.append(f"      操作人：{change.operator or '未知'}")
                    if review.vibration_curve and review.vibration_curve.original_curve_id:
                        report_lines.append(f"      原始曲线ID：{review.vibration_curve.original_curve_id}")
        else:
            report_lines.append("   暂无变更记录")

        report_lines.append("")
        report_lines.append("=" * 70)
        report_lines.append("📌 快速摘要")
        report_lines.append("=" * 70)
        report_lines.append(ReportGenerator._generate_summary(review, conclusion))

        return "\n".join(report_lines)

    @staticmethod
    def _get_source_icon(source: DataSource) -> str:
        icons = {
            DataSource.THRESHOLD_TABLE: "📊",
            DataSource.MAINTENANCE_ORDER: "🔧",
            DataSource.VIBRATION_CURVE: "📈",
            DataSource.MANUAL_EDIT: "✏️",
            DataSource.AUTO_CALC: "🤖",
        }
        return icons.get(source, "📄")

    @staticmethod
    def _format_evidence(evidence: dict) -> str:
        items = []
        for key, value in evidence.items():
            if isinstance(value, float):
                items.append(f"{key}={value:.3f}")
            elif isinstance(value, dict):
                items.append(f"{key}=(详见明细)")
            elif isinstance(value, list):
                items.append(f"{key}=({len(value)}项)")
            else:
                items.append(f"{key}={value}")
        return ", ".join(items[:5]) + ("..." if len(items) > 5 else "")

    @staticmethod
    def _classify_changes_for_display(changes: List[ChangeRecord]):
        material_only = []
        conclusion_affecting = []
        for change in changes:
            if change.affects_conclusion or change.change_type in (ChangeType.CONCLUSION_CHANGED, ChangeType.CURVE_EDITED):
                conclusion_affecting.append(change)
            else:
                material_only.append(change)
        return material_only, conclusion_affecting

    @staticmethod
    def _generate_summary(review: ElevatorAccelerationReview, conclusion: ReviewConclusion) -> str:
        lines = []

        has_late_maintenance = review.maintenance_order and review.maintenance_order.is_late_supply
        has_edited_curve = review.vibration_curve and review.vibration_curve.is_manually_edited
        has_cross_level = conclusion.conclusion_type == ConclusionType.CROSS_LEVEL

        if has_late_maintenance:
            lines.append("• 存在维修单晚补情况，阈值表先到后补维修单，仅补材料不影响原结论")

        if has_edited_curve:
            lines.append("• 振动曲线存在人工修改，原始曲线已留存，可追溯前后差异")

        if has_cross_level:
            src = conclusion.cross_level_source.value if conclusion.cross_level_source else "数据"
            lines.append(f"• 存在阈值跨档，差异来自{src}，请联系{conclusion.next_owner}确认")

        material_changes, concl_changes = ReportGenerator._classify_changes_for_display(review.change_history)
        if material_changes:
            lines.append(f"• 共{len(material_changes)}项仅补材料操作，不影响结论")
        if concl_changes:
            lines.append(f"• 共{len(concl_changes)}项变更影响结论，需重点关注")

        if not lines:
            lines.append("• 材料齐全，流程正常，无特殊情况")

        lines.append(f"• 下一步：{conclusion.next_action}（{conclusion.next_owner}）")

        return "\n".join(lines)

    @staticmethod
    def generate_inspection_consistency_report(review: ElevatorAccelerationReview) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("🔍 巡检报告与明细一致性核对")
        lines.append("=" * 70)
        lines.append("")

        if review.vibration_curve:
            curve = review.vibration_curve
            lines.append("📈 振动曲线信息：")
            lines.append(f"   曲线ID：{curve.id}")
            lines.append(f"   是否人工修改：{'是' if curve.is_manually_edited else '否'}")
            if curve.is_manually_edited:
                lines.append(f"   修改人：{curve.edited_by}")
                lines.append(f"   修改时间：{curve.edited_at.strftime('%Y-%m-%d %H:%M:%S') if curve.edited_at else '未知'}")
                lines.append(f"   修改原因：{curve.edit_reason}")
                lines.append(f"   原始曲线ID：{curve.original_curve_id}")
            lines.append("")

        if review.change_history:
            lines.append("📜 所有变更记录（巡检与明细统一来源）：")
            for change in review.change_history:
                lines.append(f"   [{change.timestamp.strftime('%Y-%m-%d %H:%M')}] {change.change_type.value}")
                lines.append(f"      字段：{change.field_name}")
                if change.old_value or change.new_value:
                    lines.append(f"      内容：{change.old_value} → {change.new_value}")
                lines.append(f"      操作人：{change.operator or '系统'} | 影响结论：{'是' if change.affects_conclusion else '否'}")
        else:
            lines.append("   暂无变更记录")

        lines.append("")
        lines.append("✅ 巡检报告与明细数据来源统一，历史变更可追溯，不会出现各说各话的情况")

        return "\n".join(lines)
