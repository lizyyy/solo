import os
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    ConflictEntry,
    ConflictStatus,
    JudgmentChange,
    LookbackResult,
)


TYPE_LABELS = {
    ConflictStatus.DUPLICATE_CLAIM: "重复认款",
    ConflictStatus.DATA_MISMATCH: "数据不一致",
    ConflictStatus.LATE_ATTACHMENT: "晚到附件",
    ConflictStatus.NULL_FIELD: "空值字段",
    ConflictStatus.BOUNDARY: "边界异常",
}


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def print_terminal_summary(self, result: LookbackResult) -> str:
        lines = []
        lines.append("=" * 64)
        lines.append("  并购估值假设回看 · 终端摘要")
        lines.append("=" * 64)
        lines.append("")
        lines.append(f"  运行编号：{result.run_id}")
        lines.append(f"  运行时间：{result.run_at}")
        lines.append(f"  处理记录：{result.total_records} 条")
        lines.append("")

        lines.append("  ── 金额概览 ──")
        lines.append(f"  汇总金额：{result.summary_amount:,.2f} CNY")
        lines.append(f"  例外金额：{result.exception_amount:,.2f} CNY")
        lines.append("")

        lines.append("  ── 问题一览 ──")
        if result.conflict_count == 0:
            lines.append("  没有发现冲突，数据看起来挺干净的。")
        else:
            lines.append(f"  共发现 {result.conflict_count} 个需要关注的问题：")
            lines.append(f"    · 重复认款：{result.duplicate_claim_count} 条")
            lines.append(f"    · 数据不一致：{result.conflict_count - result.duplicate_claim_count - result.late_attachment_count - result.null_field_count - result.boundary_count} 条")
            lines.append(f"    · 晚到附件：{result.late_attachment_count} 条")
            lines.append(f"    · 空值字段：{result.null_field_count} 条")
            lines.append(f"    · 边界异常：{result.boundary_count} 条")
        lines.append("")

        if result.judgment_changes:
            lines.append("  ── 判断变更 ──")
            lines.append(f"  有 {len(result.judgment_changes)} 条判断因晚到附件而调整：")
            for c in result.judgment_changes:
                lines.append(f"    · {c.record_id}：{c.old_judgment} → {c.new_judgment}")
                lines.append(f"      原因：{c.change_reason[:60]}…")
            lines.append("")

        if result.conflicts:
            lines.append("  ── 需要你处理的事项 ──")
            for c in result.conflicts:
                label = TYPE_LABELS.get(c.conflict_type, c.conflict_type.value)
                lines.append(f"    [{label}] {c.conflict_id}")
                lines.append(f"      建议：{c.suggested_action[:70]}…")
            lines.append("")

        lines.append("  提示：详细报告已保存到 output 目录，可以发给同事看。")
        lines.append("=" * 64)

        text = "\n".join(lines)
        print(text)
        return text

    def generate_detail_report(self, result: LookbackResult, records_data: Optional[List[Dict]] = None) -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"detail_report_{result.run_id}_{ts}.txt"
        path = os.path.join(self.output_dir, filename)

        lines = []
        lines.append("并购估值假设回看 · 财务明细报告")
        lines.append(f"生成时间：{result.run_at}")
        lines.append(f"运行编号：{result.run_id}")
        lines.append("")

        lines.append("一、总体情况")
        lines.append("-" * 40)
        lines.append(f"本次回看共处理 {result.total_records} 条记录。")
        lines.append(f"汇总金额：{result.summary_amount:,.2f} CNY")
        lines.append(f"其中例外金额：{result.exception_amount:,.2f} CNY")
        lines.append("")

        lines.append("二、冲突详情")
        lines.append("-" * 40)
        if not result.conflicts:
            lines.append("没有发现冲突项。")
        else:
            for i, c in enumerate(result.conflicts, 1):
                label = TYPE_LABELS.get(c.conflict_type, c.conflict_type.value)
                lines.append(f"")
                lines.append(f"第 {i} 项 [{label}] {c.conflict_id}")
                lines.append(f"涉及记录：{', '.join(c.record_ids)}")
                lines.append(f"")
                lines.append("证据：")
                for k, v in c.evidence.items():
                    if v is not None:
                        lines.append(f"  {k}：{v}")
                lines.append(f"")
                lines.append(f"建议操作：{c.suggested_action}")
                if c.resolved:
                    lines.append(f"处理结果：{c.resolution_note}")
                else:
                    lines.append("状态：待处理")
        lines.append("")

        lines.append("三、判断变更记录")
        lines.append("-" * 40)
        if not result.judgment_changes:
            lines.append("没有判断变更。")
        else:
            for c in result.judgment_changes:
                lines.append(f"")
                lines.append(f"记录 {c.record_id}")
                lines.append(f"  变更前：{c.old_judgment}")
                lines.append(f"  变更后：{c.new_judgment}")
                lines.append(f"  变更原因：{c.change_reason}")
                lines.append(f"  变更时间：{c.changed_at}")
                if c.attachment_id:
                    lines.append(f"  关联附件：{c.attachment_id}")
                lines.append(f"  ⚠ 前后变化均已留痕，原判断不会丢失。")
        lines.append("")

        lines.append("四、备注")
        lines.append("-" * 40)
        lines.append("本报告由并购估值假设回看系统自动生成。")
        lines.append("如有疑问，请联系结算会计阿宁。")
        lines.append("例外项不会在汇总数字中消失，所有变更均有迹可查。")
        lines.append("")

        content = "\n".join(lines)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

        return path

    def generate_integrity_report(self, integrity: Dict, previous_notes: List[Dict]) -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"integrity_check_{ts}.txt"
        path = os.path.join(self.output_dir, filename)

        lines = []
        lines.append("并购估值假设回看 · 一致性校验报告")
        lines.append(f"校验时间：{datetime.now().isoformat()}")
        lines.append("")

        lines.append("一、存储状态")
        lines.append("-" * 40)
        lines.append(f"历史运行次数：{integrity['result_count']}")
        lines.append(f"历史备注数：{integrity['note_count']}")
        lines.append(f"判断变更数：{integrity['change_count']}")
        lines.append(f"最近一次运行：{integrity['latest_run'] or '无'}")
        lines.append("")

        if integrity["orphan_note_count"] > 0:
            lines.append(f"⚠ 有 {integrity['orphan_note_count']} 条备注没有对应的运行记录：")
            for rid in integrity["orphan_note_record_ids"]:
                lines.append(f"  - {rid}")
        else:
            lines.append("所有备注都有对应的运行记录，数据一致。")
        lines.append("")

        lines.append("二、历史备注核对")
        lines.append("-" * 40)
        if not previous_notes:
            lines.append("暂无历史备注。")
        else:
            for n in previous_notes:
                lines.append(f"  记录 {n['record_id']}：")
                lines.append(f"    内容：{n['note']}")
                lines.append(f"    作者：{n['author']}")
                lines.append(f"    时间：{n['written_at']}")
        lines.append("")

        lines.append("三、结论")
        lines.append("-" * 40)
        if integrity["orphan_note_count"] == 0:
            lines.append("重启后数据一致，历史备注和导出数字对得上，可以放心交接。")
        else:
            lines.append("存在孤立备注，建议核查后再交接。")
        lines.append("")

        content = "\n".join(lines)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

        return path
