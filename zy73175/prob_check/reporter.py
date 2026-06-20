from typing import List
from .models import VerificationRecord, RecordStatus


class Reporter:
    @staticmethod
    def format_summary(results: List[dict], records: List[VerificationRecord]) -> str:
        total = len(results)
        if total == 0:
            return "（无记录）"
        passed = sum(1 for r in results if r["status"] == RecordStatus.VERIFIED.value)
        suspended = sum(1 for r in results if r["status"] == RecordStatus.SUSPENDED.value)
        rejected = sum(1 for r in results if r["status"] == RecordStatus.REJECTED.value)
        confirmed = sum(1 for r in results if r["status"] == RecordStatus.CONFIRMED.value)
        lines = []
        lines.append("=" * 60)
        lines.append("         概率模拟批量验算 — 汇总报告")
        lines.append("=" * 60)
        lines.append(f"  总记录数: {total}")
        lines.append(f"  通过验算: {passed}")
        lines.append(f"  验算不通过: {rejected}")
        lines.append(f"  挂起待确认: {suspended}")
        lines.append(f"  人工已确认: {confirmed}")
        lines.append("")
        lines.append("-" * 60)
        lines.append("  逐条结果：")
        lines.append("-" * 60)
        for res in results:
            rid = res["record_id"]
            status = res["status"]
            student = res["student"]
            msg = res["message"]
            lines.append(f"  [{rid}] {student} — {status}")
            if msg:
                lines.append(f"         {msg}")
            if res.get("boundary_issue"):
                b = res["boundary_issue"]
                lines.append(
                    f"         >>> 外推越界卡点: {b['variable']}={b['current_value']}, "
                    f"区间[{b['lower_bound']},{b['upper_bound']}], {b['direction']}"
                )
            lines.append("")
        lines.append("-" * 60)
        if suspended > 0:
            lines.append("  ⚠ 有记录处于【挂起待确认】状态")
            lines.append("    请使用命令: python -m prob_check confirm <记录ID> <确认人> <备注>")
            lines.append("    或人工确认后修改数值: python -m prob_check confirm <ID> <确认人> <备注> --override <新值>")
        lines.append("=" * 60)
        return "\n".join(lines)

    @staticmethod
    def format_record_detail(record: VerificationRecord) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append(f"  记录ID: {record.id}")
        lines.append(f"  学生: {record.student_name}")
        lines.append(f"  公式描述: {record.formula_desc}")
        lines.append(f"  数字来源线索: {record.source_trace}")
        lines.append(f"  输入: {record.input_value} {record.input_unit}")
        lines.append(f"  目标单位: {record.target_unit}")
        lines.append(f"  期望值: {record.expected_result} {record.target_unit}")
        lines.append(f"  实际结果: {record.actual_result} {record.target_unit if record.actual_result is not None else '（未验算）'}")
        lines.append(f"  容差: {record.tolerance * 100}%")
        lines.append(f"  当前状态: {record.status.value if hasattr(record.status, 'value') else record.status}")
        if record.suspension_reason:
            lines.append(f"  挂起原因: {record.suspension_reason.value if hasattr(record.suspension_reason, 'value') else record.suspension_reason}")
        if record.boundary_info:
            b = record.boundary_info
            lines.append(
                f"  越界信息: {b.variable}={b.current_value}, 区间[{b.lower_bound},{b.upper_bound}], {b.direction}"
            )
        if record.confirmation_note:
            lines.append(f"  确认备注: {record.confirmation_note}")
            lines.append(f"  确认人: {record.confirmed_by} @ {record.confirmed_at}")
        if record.attachments:
            lines.append("")
            lines.append("  ─── 附件 / 草稿备注 / 历史截图引用 ───")
            for a in record.attachments:
                lines.append(f"    [{a.added_at}] {a.kind}: {a.content}")
        if record.history:
            lines.append("")
            lines.append("  ─── 历史变更记录（含口径调整） ───")
            for h in record.history:
                lines.append(
                    f"    [{h.changed_at}] {h.operator} 修改 {h.field_changed}: "
                    f"{h.old_value} → {h.new_value}（原因: {h.reason}）"
                )
        lines.append("")
        lines.append(f"  创建: {record.created_at}   更新: {record.last_updated}")
        lines.append("=" * 60)
        return "\n".join(lines)
