from typing import List, Dict, Any
from datetime import datetime

from data_models import AirExchangeRecord, ValidationResult, VerificationStatus


class ReportGenerator:
    def __init__(self):
        self.status_emoji = {
            VerificationStatus.AUTO_PASS: "✅",
            VerificationStatus.NEED_MANUAL_CHECK: "⚠️",
            VerificationStatus.WECHAT_SUPPLEMENT: "💬",
            VerificationStatus.PENDING: "⏳",
            VerificationStatus.REJECTED: "❌",
        }

    def generate_processing_suggestion(
        self,
        record: AirExchangeRecord,
        validation: ValidationResult,
    ) -> str:
        suggestions = []

        if validation.errors:
            suggestions.append("🔴 【必须处理】")
            for error in validation.errors:
                suggestions.append(f"   - {error}")

        if validation.warnings:
            suggestions.append("🟡 【需要关注】")
            for warning in validation.warnings:
                suggestions.append(f"   - {warning}")

        if validation.suggestions:
            suggestions.append("💡 【改进建议】")
            for sug in validation.suggestions:
                suggestions.append(f"   - {sug}")

        if record.is_extreme_value:
            suggestions.append("⚠️ 【极端值提醒】")
            suggestions.append(f"   - {record.extreme_value_reason}")
            if record.processing_suggestion:
                suggestions.append(f"   - {record.processing_suggestion}")

        if record.source.value == "维修微信群":
            suggestions.append("💬 【微信群来源记录】")
            suggestions.append("   - 此记录来自维修微信群，请注意追溯原始聊天记录")
            if record.wechat_notes:
                suggestions.append(f"   - 备注摘要: {record.wechat_notes}")

        if record.calculated_efficiency is not None:
            eff = record.calculated_efficiency
            if eff < 10:
                suggestions.append("🔴 【效率警报】")
                suggestions.append(f"   - 换气效率仅 {eff:.2f}%，低于10%合格线")
                suggestions.append("   - 建议：立即检查设备运行状态，排查滤网堵塞、风机故障等问题")
            elif eff < 20:
                suggestions.append("🟡 【效率偏低】")
                suggestions.append(f"   - 换气效率 {eff:.2f}%，建议关注")
                suggestions.append("   - 建议：检查系统运行参数，考虑调整风机频率")
            else:
                suggestions.append("✅ 【效率正常】")
                suggestions.append(f"   - 换气效率 {eff:.2f}%，在正常范围")

        if not suggestions:
            suggestions.append("✅ 记录正常，无需额外处理")

        return "\n".join(suggestions)

    def generate_business_reminder(
        self,
        records: List[AirExchangeRecord],
        validation_results: Dict[str, ValidationResult],
        group_analysis: Dict[str, Any],
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("📋 空气净化换气效率 - 业务处理提醒")
        lines.append(f"📅 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)

        auto_pass = [r for r in records if r.verification_status == VerificationStatus.AUTO_PASS]
        need_check = [r for r in records if r.verification_status == VerificationStatus.NEED_MANUAL_CHECK]
        wechat_supplement = [r for r in records if r.verification_status == VerificationStatus.WECHAT_SUPPLEMENT]
        extreme_values = [r for r in records if r.is_extreme_value]

        lines.append(f"\n📊 记录统计:")
        lines.append(f"  总记录数: {len(records)}")
        lines.append(f"  ✅ 自动通过: {len(auto_pass)}")
        lines.append(f"  ⚠️ 需人工确认: {len(need_check)}")
        lines.append(f"  💬 微信群补录: {len(wechat_supplement)}")
        lines.append(f"  ⚡ 极端值标记: {len(extreme_values)}")

        risk = group_analysis.get("risk_assessment", {})
        lines.append(f"\n🔍 风险评估: {risk.get('level', '未知')}")
        lines.append(f"   {risk.get('description', '')}")

        if extreme_values:
            lines.append(f"\n⚡ 极端值记录 (原始值保留，未被平均):")
            for r in extreme_values:
                lines.append(f"   - {r.record_id} | {r.measure_time.strftime('%H:%M')} | {r.location}")
                lines.append(f"     风量: {r.air_volume} {r.unit} | {r.extreme_value_reason}")
                if r.processing_suggestion:
                    lines.append(f"     👉 {r.processing_suggestion}")

        if need_check:
            lines.append(f"\n⚠️ 需要人工确认的记录:")
            for r in need_check:
                validation = validation_results.get(r.record_id)
                lines.append(f"   - {r.record_id} | {r.measure_time.strftime('%m-%d %H:%M')} | {r.location}")
                if validation and validation.errors:
                    for err in validation.errors[:2]:
                        lines.append(f"     ❌ {err}")
                if validation and validation.warnings:
                    for warn in validation.warnings[:2]:
                        lines.append(f"     ⚠️ {warn}")
                lines.append(f"     👉 处理建议: 请林老师或业务同事核对原始记录后确认")

        if wechat_supplement:
            lines.append(f"\n💬 维修微信群补录记录 (原始聊天记录已保存):")
            for r in wechat_supplement:
                lines.append(f"   - {r.record_id} | {r.measure_time.strftime('%m-%d %H:%M')} | {r.location}")
                lines.append(f"     数据来源: {r.source.value}")
                if r.wechat_notes:
                    lines.append(f"     备注: {r.wechat_notes}")
                lines.append(f"     👉 处理建议: 如有更准确的实验表数据，请优先使用实验表数据")
                lines.append(f"     💾 原始微信聊天记录已保存在 raw_wechat_content 字段，不会被清洗掉")

        lines.append(f"\n📈 换气效率计算方法对比:")
        methods = group_analysis.get("methods", {})
        for method_name, method_data in methods.items():
            if "原始值逐个展示" in method_name:
                continue
            eff = method_data.get("efficiency", 0)
            vol = method_data.get("air_volume", 0)
            warning = method_data.get("warning", "")
            note = method_data.get("note", "")
            lines.append(f"   - {method_name}: {eff:.2f}% (风量 {vol:.0f} m³/h)")
            if warning:
                lines.append(f"     ⚠️ {warning}")
            if note:
                lines.append(f"     ℹ️ {note}")

        lines.append(f"\n👤 给业务同事的操作提醒:")
        lines.append("   1. 【先看极端值】⚠️标记的记录不要跳过，原始值已保留，风险没有被平均掉")
        lines.append("   2. 【核对微信群记录】💬标记的记录，翻微信群时按 record_id 对应，原始聊天内容已保留")
        lines.append("   3. 【确认需人工处理】⚠️标记的记录，确认后更新状态为自动通过或驳回")
        lines.append("   4. 【重跑数据】同一批数据重跑时，版本对比功能会并排展示新旧结果")
        lines.append("   5. 【效率计算】优先看「剔除极端值后平均」和「中位数」两个口径")
        lines.append("   6. 【方向符号】送风↑ 排风↓ 回风↺，如有标注错误请修正")
        lines.append("   7. 【时间间隔】标准间隔30分钟，短于5分钟或长于180分钟需注意")

        if "原始值逐个展示" in methods:
            lines.append(f"\n📋 原始测量值逐条展示 (防止平均掩盖风险):")
            raw_records = methods["原始值逐个展示"].get("records", [])
            for rr in raw_records:
                marker = "⚡" if rr.get("is_extreme") else "  "
                lines.append(
                    f"   {marker} {rr.get('time')} | {rr.get('record_id')} | "
                    f"风量 {rr.get('air_volume'):.0f} m³/h | 效率 {rr.get('efficiency'):.2f}%"
                )
                if rr.get("is_extreme"):
                    lines.append(f"      ⚠️ 极端值，请注意")

        lines.append("\n" + "=" * 80)
        return "\n".join(lines)

    def generate_single_record_report(
        self,
        record: AirExchangeRecord,
        validation: ValidationResult,
    ) -> str:
        lines = []
        emoji = self.status_emoji.get(record.verification_status, "")
        lines.append("-" * 60)
        lines.append(f"{emoji} 记录ID: {record.record_id} | 状态: {record.verification_status.value}")
        lines.append("-" * 60)
        lines.append(f"  测量时间: {record.measure_time.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"  测量位置: {record.location}")
        lines.append(f"  气流方向: {record.direction.value}")
        lines.append(f"  风量值: {record.air_volume} {record.unit}")
        lines.append(f"  时间间隔: {record.time_interval_min} 分钟")
        lines.append(f"  数据来源: {record.source.value}")
        if record.calculated_efficiency is not None:
            lines.append(f"  计算效率: {record.calculated_efficiency:.2f}%")
        if record.is_extreme_value:
            lines.append(f"  ⚡ 极端值: {record.extreme_value_reason}")

        if record.photo_desc:
            lines.append(f"  📷 照片说明: {record.photo_desc}")
        if record.working_condition:
            lines.append(f"  ⚙️ 工况记录: {record.working_condition}")
        if record.wechat_notes:
            lines.append(f"  💬 微信备注: {record.wechat_notes}")
        if record.raw_wechat_content:
            lines.append(f"  📱 原始微信内容: [已保存，长度{len(record.raw_wechat_content)}字符]")

        if validation.errors or validation.warnings or validation.suggestions:
            lines.append(f"\n  校验结果: {'❌ 无效' if not validation.is_valid else '⚠️ 有警告' if validation.warnings else '✅ 有效'}")
            if validation.errors:
                lines.append("  ❌ 错误:")
                for e in validation.errors:
                    lines.append(f"     - {e}")
            if validation.warnings:
                lines.append("  ⚠️ 警告:")
                for w in validation.warnings:
                    lines.append(f"     - {w}")
            if validation.suggestions:
                lines.append("  💡 建议:")
                for s in validation.suggestions:
                    lines.append(f"     - {s}")

        lines.append("")
        return "\n".join(lines)

    def generate_version_comparison_report(
        self,
        comparison: Dict[str, Any],
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("🔄 重跑数据 - 新旧版本对比报告")
        lines.append("=" * 80)

        lines.append(f"\n📌 旧版运行: {comparison['old_run']['time']}")
        lines.append(f"   说明: {comparison['old_run']['description']}")
        lines.append(f"\n📌 新版运行: {comparison['new_run']['time']}")
        lines.append(f"   说明: {comparison['new_run']['description']}")

        gc = comparison['group_comparison']
        lines.append(f"\n📊 整体指标变化:")
        lines.append(f"   换气效率: {gc['old_efficiency']:.2f}% → {gc['new_efficiency']:.2f}%")
        if gc['old_efficiency'] != gc['new_efficiency']:
            diff = gc['new_efficiency'] - gc['old_efficiency']
            arrow = "↑" if diff > 0 else "↓"
            lines.append(f"     {arrow} 变化: {'+' if diff > 0 else ''}{diff:.2f} 个百分点")
        lines.append(f"   极端值数量: {gc['old_extreme_count']} → {gc['new_extreme_count']}")
        lines.append(f"   风险等级: {gc['old_risk']} → {gc['new_risk']}")

        lines.append(f"\n📋 逐条记录对比:")
        for comp in comparison['record_comparisons']:
            lines.append(f"\n   记录ID: {comp['record_id']}")
            if comp.get('note'):
                lines.append(f"      ℹ️ {comp['note']}")
                continue

            changes = comp.get('changes', {})
            if changes:
                lines.append(f"      🔄 字段变更:")
                for field, change in changes.items():
                    lines.append(f"         {field}: {change['old']} → {change['new']}")
            else:
                lines.append(f"      ✅ 无变更")

            if 'side_by_side' in comp:
                changed_rows = [r for r in comp['side_by_side'] if r['是否变更'] == '是']
                if changed_rows:
                    lines.append(f"      📝 详情:")
                    for r in changed_rows:
                        lines.append(
                            f"         * {r['字段']}: {str(r['原值'])} → {str(r['新值'])}"
                        )

        lines.append(f"\n👤 给后续处理人的说明:")
        lines.append("   - 此对比报告展示了同一批数据两次分析的差异")
        lines.append("   - 请重点关注效率变化较大的记录和状态变更")
        lines.append("   - 微信群来源的记录请核对原始聊天记录（已保留）")
        lines.append("   - 极端值在两次计算中均已单独标记，未被平均掩盖")
        lines.append("   - 前次处理人的判断逻辑已通过版本历史保存，可追溯")

        lines.append("\n" + "=" * 80)
        return "\n".join(lines)
