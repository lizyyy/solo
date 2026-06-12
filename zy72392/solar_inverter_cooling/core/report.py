from typing import List
from datetime import datetime

from .models import InspectionBatch, AbnormalRecord, NextHandler, AbnormalStatus


class ReportGenerator:
    @staticmethod
    def generate_batch_report(batch: InspectionBatch) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append(f"  光伏逆变器散热质检报告")
        lines.append(f"  批次：{batch.name}")
        lines.append(f"  生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")

        truly_abnormal = [
            r for r in batch.abnormal_records
            if r.status not in (AbnormalStatus.CONFIRMED_NORMAL, AbnormalStatus.RESOLVED)
        ]
        confirmed_normal = [
            r for r in batch.abnormal_records
            if r.status == AbnormalStatus.CONFIRMED_NORMAL
        ]
        resolved = [
            r for r in batch.abnormal_records
            if r.status == AbnormalStatus.RESOLVED
        ]

        lines.append("📋 一、批次概况")
        lines.append("-" * 40)
        lines.append(f"  批次编号：{batch.id}")
        lines.append(f"  当前状态：{batch.status}")
        lines.append(f"  分析轮次：{batch.run_count} 次")
        lines.append(f"  导入证据：")
        lines.append(f"    - 维修群截图：{len(batch.repair_screenshots)} 份")
        for s in batch.repair_screenshots:
            lines.append(f"      · {s.filename}（{s.uploader}，{s.upload_time.strftime('%m-%d %H:%M')}）")
        lines.append(f"    - 采样间隔说明：{len(batch.sampling_notes)} 份")
        for n in batch.sampling_notes:
            name = n.filename or "文本说明"
            lines.append(f"      · {name}（{n.uploader}，{n.upload_time.strftime('%m-%d %H:%M')}）")
        lines.append(f"  测点统计：")
        lines.append(f"    - 真正异常：{len(truly_abnormal)} 条")
        lines.append(f"    - 已确认正常：{len(confirmed_normal)} 条")
        lines.append(f"    - 已复核解决：{len(resolved)} 条")
        lines.append(f"    - 总记录数：{len(batch.abnormal_records)} 条")
        lines.append("")

        lines.append("🔍 二、异常工况表（需关注的测点）")
        lines.append("-" * 40)
        lines.append("")

        if truly_abnormal:
            for i, record in enumerate(truly_abnormal, 1):
                ReportGenerator._render_record(lines, i, record)
        else:
            lines.append("  🎉 无需关注的异常测点")
            lines.append("")

        if confirmed_normal:
            lines.append("")
            lines.append("✅ 三、已确认正常的测点（供反查）")
            lines.append("-" * 40)
            lines.append("")
            for i, record in enumerate(confirmed_normal, 1):
                ReportGenerator._render_confirmed_normal(lines, i, record)

        if resolved:
            lines.append("")
            lines.append("🏁 四、已复核解决的测点")
            lines.append("-" * 40)
            lines.append("")
            for i, record in enumerate(resolved, 1):
                ReportGenerator._render_record(lines, i, record)

        lines.append("")
        lines.append("📜 五、操作轨迹（谁改了什么）")
        lines.append("-" * 40)
        lines.append("")

        for log in batch.audit_logs:
            time_str = log.timestamp.strftime('%m-%d %H:%M')
            lines.append(f"  [{time_str}] {log.operator}")
            lines.append(f"    动作：{log.action}")
            lines.append(f"    字段：{log.field_changed}")
            lines.append(f"    变更：{log.old_value} → {log.new_value}")
            lines.append(f"    原因：{log.reason}")
            if log.affected_results:
                lines.append(f"    影响：{', '.join(log.affected_results)}")
            lines.append("")

        lines.append("=" * 60)
        lines.append("  报告结束 — 质检员小白专用")
        lines.append("=" * 60)

        return "\n".join(lines)

    @staticmethod
    def _render_record(lines: List[str], i: int, record: AbnormalRecord) -> None:
        lines.append(f"  【{i}】{record.point_name}（测点ID：{record.point_id}）")
        lines.append(f"      ┌─────────────────────────────────────")
        lines.append(f"      │ 📌 状态：{record.status.value}")
        lines.append(f"      │ 🧭 方向判定：{record.direction_status.value}")

        if record.is_field_dispute:
            lines.append(f"      │ ⚠️  现场表述争议：是")
            lines.append(f"      │ 💬 现场师傅原话：「{record.direction_field_text}」")

        lines.append(f"      │ ❓ 为什么留下这条：")
        lines.append(f"      │    {record.keep_reason}")

        if record.field_mention:
            lines.append(f"      │ 🗣️  现场说法：{record.field_mention}")

        if record.missing_materials:
            lines.append(f"      │ 📦 还缺什么材料：")
            for m in record.missing_materials:
                lines.append(f"      │    · {m}")
        else:
            lines.append(f"      │ 📦 还缺什么材料：材料齐全")

        lines.append(f"      │ 👤 下一步找谁：{record.next_handler.value}")
        lines.append(f"      │ 📎 证据来源：{', '.join(record.evidence_sources)}")

        if record.notes:
            lines.append(f"      │ 📝 备注：{record.notes}")

        if record.trigger_source:
            lines.append(f"      │ � 触发来源：{record.trigger_source}")

        if record.resolution_trace:
            lines.append(f"      │ 📊 状态变化轨迹：")
            for trace in record.resolution_trace:
                lines.append(f"      │    · [{trace.get('step', '')}] {trace.get('status_before', '')} → {trace.get('status_after', '')}")
                if trace.get('content'):
                    lines.append(f"      │      内容：{trace['content']}")
                if trace.get('missing_before') and trace.get('missing_after') is not None:
                    lines.append(f"      │      缺料：{trace['missing_before']} → {trace['missing_after']}")

        lines.append(f"      │ ⏰ 更新时间：{record.updated_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"      └─────────────────────────────────────")
        lines.append("")

    @staticmethod
    def _render_confirmed_normal(lines: List[str], i: int, record: AbnormalRecord) -> None:
        lines.append(f"  【{i}】{record.point_name}（测点ID：{record.point_id}）")
        lines.append(f"      ┌─────────────────────────────────────")
        lines.append(f"      │ 📌 状态：✅ {record.status.value}")
        lines.append(f"      │ 🧭 方向判定：{record.direction_status.value}")
        lines.append(f"      │ ❓ 为什么确认正常：")
        lines.append(f"      │    {record.keep_reason}")

        if record.field_mention:
            lines.append(f"      │ 🗣️  现场说法：{record.field_mention}")

        lines.append(f"      │ 📎 证据来源：{', '.join(record.evidence_sources)}")

        if record.trigger_source:
            lines.append(f"      │ 🔗 触发来源（原始材料）：{record.trigger_source}")

        if record.resolution_trace:
            lines.append(f"      │ 📊 确认过程：")
            for trace in record.resolution_trace:
                lines.append(f"      │    · [{trace.get('step', '')}] {trace.get('status_before', '')} → {trace.get('status_after', '')}")
                if trace.get('content'):
                    lines.append(f"      │      内容：{trace['content']}")
                if trace.get('missing_before'):
                    lines.append(f"      │      缺料：{trace.get('missing_before', '')} → {trace.get('missing_after', '')}")

        lines.append(f"      └─────────────────────────────────────")
        lines.append("")

    @staticmethod
    def generate_abnormal_table(batch: InspectionBatch) -> str:
        lines = []
        lines.append("+" + "-" * 10 + "+" + "-" * 20 + "+" + "-" * 14 + "+" + "-" * 12 + "+" + "-" * 30 + "+")
        lines.append("| {:<8} | {:<18} | {:<12} | {:<10} | {:<28} |".format(
            "测点ID", "测点名称", "状态", "下一步找谁", "留下原因"
        ))
        lines.append("+" + "-" * 10 + "+" + "-" * 20 + "+" + "-" * 14 + "+" + "-" * 12 + "+" + "-" * 30 + "+")

        truly_abnormal = [
            r for r in batch.abnormal_records
            if r.status not in (AbnormalStatus.CONFIRMED_NORMAL, AbnormalStatus.RESOLVED)
        ]
        confirmed_normal = [
            r for r in batch.abnormal_records
            if r.status == AbnormalStatus.CONFIRMED_NORMAL
        ]
        resolved = [
            r for r in batch.abnormal_records
            if r.status == AbnormalStatus.RESOLVED
        ]

        for r in truly_abnormal:
            reason_short = r.keep_reason[:28]
            if len(r.keep_reason) > 28:
                reason_short += "..."
            lines.append("| {:<8} | {:<18} | {:<12} | {:<10} | {:<28} |".format(
                r.point_id[:8], r.point_name[:18], r.status.value[:12],
                r.next_handler.value[:10], reason_short
            ))

        for r in confirmed_normal:
            lines.append("| {:<8} | {:<18} | {:<12} | {:<10} | {:<28} |".format(
                r.point_id[:8], r.point_name[:18], "✅" + r.status.value[:10],
                r.next_handler.value[:10], r.keep_reason[:28]
            ))

        for r in resolved:
            lines.append("| {:<8} | {:<18} | {:<12} | {:<10} | {:<28} |".format(
                r.point_id[:8], r.point_name[:18], "🏁" + r.status.value[:9],
                r.next_handler.value[:10], r.keep_reason[:28]
            ))

        lines.append("+" + "-" * 10 + "+" + "-" * 20 + "+" + "-" * 14 + "+" + "-" * 12 + "+" + "-" * 30 + "+")
        lines.append(f"  异常{len(truly_abnormal)}条 | 已确认正常{len(confirmed_normal)}条 | 已解决{len(resolved)}条")
        return "\n".join(lines)

    @staticmethod
    def generate_audit_trail(batch: InspectionBatch) -> str:
        lines = []
        lines.append("审计追踪 - 批次：" + batch.name)
        lines.append("=" * 80)
        lines.append(f"{'时间':<18} {'操作人':<10} {'动作':<12} {'影响测点':<20} {'原因'}")
        lines.append("-" * 80)

        for log in batch.audit_logs:
            time_str = log.timestamp.strftime('%m-%d %H:%M')
            affected = ", ".join(log.affected_results[:2])
            if len(log.affected_results) > 2:
                affected += f" 等{len(log.affected_results)}个"
            reason_short = log.reason[:30]
            lines.append(f"{time_str:<18} {log.operator:<10} {log.action:<12} {affected:<20} {reason_short}")

        lines.append("=" * 80)
        return "\n".join(lines)
