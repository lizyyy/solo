from typing import List
from datetime import datetime

from .models import InspectionBatch, AbnormalRecord, NextHandler


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
        lines.append(f"  异常记录：{len(batch.abnormal_records)} 条")
        lines.append("")

        lines.append("🔍 二、异常工况表")
        lines.append("-" * 40)
        lines.append("")

        for i, record in enumerate(batch.abnormal_records, 1):
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

            lines.append(f"      │ ⏰ 更新时间：{record.updated_at.strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"      └─────────────────────────────────────")
            lines.append("")

        lines.append("📜 三、操作轨迹（谁改了什么）")
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
    def generate_abnormal_table(batch: InspectionBatch) -> str:
        lines = []
        lines.append("+" + "-" * 10 + "+" + "-" * 20 + "+" + "-" * 12 + "+" + "-" * 12 + "+" + "-" * 30 + "+")
        lines.append("| {:<8} | {:<18} | {:<10} | {:<10} | {:<28} |".format(
            "测点ID", "测点名称", "状态", "下一步找谁", "留下原因"
        ))
        lines.append("+" + "-" * 10 + "+" + "-" * 20 + "+" + "-" * 12 + "+" + "-" * 12 + "+" + "-" * 30 + "+")

        for r in batch.abnormal_records:
            reason_short = r.keep_reason[:28]
            if len(r.keep_reason) > 28:
                reason_short += "..."
            lines.append("| {:<8} | {:<18} | {:<10} | {:<10} | {:<28} |".format(
                r.point_id[:8], r.point_name[:18], r.status.value[:10],
                r.next_handler.value[:10], reason_short
            ))

        lines.append("+" + "-" * 10 + "+" + "-" * 20 + "+" + "-" * 12 + "+" + "-" * 12 + "+" + "-" * 30 + "+")
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
