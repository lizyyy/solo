from typing import List, Dict, Tuple
from collections import defaultdict
from datetime import datetime

from .models import ReconciliationRecord, MatchStatus, EvidenceType


class TerminalReporter:
    def __init__(self):
        self.colors = {
            "green": "\033[92m",
            "yellow": "\033[93m",
            "red": "\033[91m",
            "blue": "\033[94m",
            "cyan": "\033[96m",
            "bold": "\033[1m",
            "reset": "\033[0m"
        }

    def _color(self, text: str, color: str) -> str:
        return f"{self.colors.get(color, '')}{text}{self.colors['reset']}"

    def _status_color(self, status: MatchStatus) -> str:
        mapping = {
            MatchStatus.CONFIRMED: "green",
            MatchStatus.PENDING_MATERIALS: "yellow",
            MatchStatus.MANUAL_REVIEW: "blue",
            MatchStatus.CONFLICT: "red",
            MatchStatus.UNMATCHED: "yellow"
        }
        return mapping.get(status, "reset")

    def _group_by_status(
        self, records: List[ReconciliationRecord]
    ) -> Dict[MatchStatus, List[ReconciliationRecord]]:
        grouped = defaultdict(list)
        for r in records:
            grouped[r.current_status].append(r)
        return grouped

    def print_summary(self, records: List[ReconciliationRecord]) -> None:
        grouped = self._group_by_status(records)
        total = len(records)

        print("\n" + "=" * 80)
        print(self._color("  机场贵宾券核销对账 - 终端摘要报告", "bold"))
        print(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)

        print("\n" + self._color("【一、整体对账统计】", "bold"))
        print("-" * 60)

        total_expected = sum(r.expected_amount for r in records)
        total_actual_confirmed = sum(
            r.actual_amount or 0 for r in records
            if r.current_status == MatchStatus.CONFIRMED
        )

        status_order = [
            (MatchStatus.CONFIRMED, "已确认"),
            (MatchStatus.PENDING_MATERIALS, "待补材料"),
            (MatchStatus.MANUAL_REVIEW, "人工改判"),
            (MatchStatus.CONFLICT, "数据冲突"),
            (MatchStatus.UNMATCHED, "未匹配")
        ]

        for status, label in status_order:
            count = len(grouped.get(status, []))
            amount = sum(r.expected_amount for r in grouped.get(status, []))
            pct = f"{count/total*100:.1f}%" if total else "0%"
            color = self._status_color(status)

            bar = "█" * int(count / total * 30) if total else ""
            print(f"  {self._color(label, color):<10} | {count:>3} 笔 | {amount:>10.2f} 元 | {pct:>5} | {bar}")

        print("-" * 60)
        print(f"  {'合计':<10} | {total:>3} 笔 | {total_expected:>10.2f} 元 | 100% |")
        print(f"  已确认实收金额合计: {self._color(f'{total_actual_confirmed:.2f} 元', 'green')}")

        print("\n" + self._color("【二、分状态明细摘要】", "bold"))
        print("-" * 60)

        for status, label in status_order:
            recs = grouped.get(status, [])
            if not recs:
                continue

            color = self._status_color(status)
            print(f"\n  {self._color(f'● {label} ({len(recs)}笔)', color)}")

            for r in recs[:5]:
                diff = r.amount_diff
                diff_str = ""
                if diff is not None:
                    if abs(diff) < 0.01:
                        diff_str = " 金额一致"
                    elif diff > 0:
                        diff_str = self._color(f" +{diff:.2f}", "red")
                    else:
                        diff_str = self._color(f" {diff:.2f}", "yellow")

                latest = r.judgment_history[-1] if r.judgment_history else None
                reason = latest.reason[:30] + "..." if latest and len(latest.reason) > 30 else (latest.reason if latest else "")

                print(f"    {r.voucher_no} | {r.passenger_name:<4} | {r.flight_no:<7} | "
                      f"应收{r.expected_amount:.0f}/实收{'-' if r.actual_amount is None else f'{r.actual_amount:.0f}'}{diff_str}")
                print(f"      → {reason}")

            if len(recs) > 5:
                print(f"      ... 还有 {len(recs) - 5} 条记录，详细请见导出文件")

        print("\n" + self._color("【三、重点关注 - 数据冲突详情】", "bold"))
        print("-" * 60)
        conflicts = grouped.get(MatchStatus.CONFLICT, [])
        if conflicts:
            for r in conflicts:
                c = r.conflict_details
                if c:
                    pay_amt = f"{c['payment_amount']:.2f}元"
                    bank_amt = f"{c['bank_amount']:.2f}元"
                    diff_amt = f"{c['diff']:.2f}元"
                    print(f"\n  {self._color(r.voucher_no, 'red')} - {r.passenger_name} - {r.flight_no}")
                    print(f"    收款流水: {self._color(pay_amt, 'green')} 来源: {', '.join(c['payment_sources'])}")
                    print(f"    银企回单: {self._color(bank_amt, 'yellow')} 来源: {', '.join(c['bank_sources'])}")
                    print(f"    差额: {self._color(diff_amt, 'red')}")
                    for s in r.suggestions:
                        print(f"    {self._color('建议:', 'cyan')} {s}")
        else:
            print("  ✓ 本批无数据冲突记录")

        print("\n" + self._color("【四、业务操作建议】", "bold"))
        print("-" * 60)

        pending = grouped.get(MatchStatus.PENDING_MATERIALS, [])
        manual = grouped.get(MatchStatus.MANUAL_REVIEW, [])
        conflicts = grouped.get(MatchStatus.CONFLICT, [])

        suggestions = []
        if pending:
            suggestions.append(f"1. 待补材料 {len(pending)} 笔：请运营主管小孟尽快收集缺失的收款流水/银企回单")
        if manual:
            suggestions.append(f"2. 人工改判 {len(manual)} 笔：请小孟复核后在系统中标记最终处理意见")
        if conflicts:
            suggestions.append(f"3. 数据冲突 {len(conflicts)} 笔：请核对双方凭证原件，核实差异原因后再入账")

        if suggestions:
            for s in suggestions:
                print(f"  {self._color('!', 'yellow')} {s}")
        else:
            print(f"  {self._color('✓', 'green')} 本批对账结果良好，无特殊操作建议")

        print("\n" + self._color("【五、交接说明】", "bold"))
        print("-" * 60)
        print("  本报告由运营主管小孟发起对账，结果将同步给财务主管。")
        print("  详细数据、判断历史、证据链请查看导出的 Excel 文件。")
        print("  如有疑问，请对照导出文件中的「判断历史全记录」sheet 追溯。")
        print("=" * 80 + "\n")

    def print_late_evidence_changes(
        self,
        changes: List[Tuple[str, MatchStatus, MatchStatus, List[str]]]
    ) -> None:
        if not changes:
            print("\n" + self._color("【晚到附件处理结果】", "bold"))
            print("  本次无晚到附件需要处理\n")
            return

        print("\n" + self._color("【晚到附件处理结果】", "bold"))
        print("-" * 60)
        print(f"  本次共处理 {len(changes)} 条晚到附件记录：\n")

        for voucher_no, before, after, desc in changes:
            color_before = self._status_color(before)
            color_after = self._status_color(after)

            print(f"  {self._color(voucher_no, 'bold')}: "
                  f"{self._color(before.value, color_before)} → "
                  f"{self._color(after.value, color_after)}")
            for d in desc:
                print(f"    {d}")
            print()

    def print_manual_note_result(
        self,
        result: Tuple[str, MatchStatus, MatchStatus, List[str]]
    ) -> None:
        if not result:
            print("\n" + self._color("【补录备注结果】", "bold"))
            print(self._color("  未找到对应凭证编号\n", "red"))
            return

        voucher_no, before, after, desc = result
        color_before = self._status_color(before)
        color_after = self._status_color(after)

        print("\n" + self._color("【补录备注结果】", "bold"))
        print("-" * 60)
        print(f"  凭证编号: {self._color(voucher_no, 'bold')}")
        print(f"  状态变化: {self._color(before.value, color_before)} → "
              f"{self._color(after.value, color_after)}")
        for d in desc:
            print(f"  {d}")
        print()
