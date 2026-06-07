from typing import List
import pandas as pd
from .models import DisputeMatchResult, DisputeStatus


class ReportGenerator:
    STATUS_COLORS = {
        DisputeStatus.NORMAL: "\033[92m",
        DisputeStatus.PENDING: "\033[93m",
        DisputeStatus.CONFLICT: "\033[91m",
        DisputeStatus.ABNORMAL: "\033[91m"
    }
    RESET_COLOR = "\033[0m"

    @classmethod
    def print_console_report(cls, results: List[DisputeMatchResult], sample_name: str = "") -> None:
        if sample_name:
            print(f"\n{'='*60}")
            print(f"  {sample_name}")
            print(f"{'='*60}")

        print(f"\n  客户总数: {len(results)}")
        
        status_count = {}
        for r in results:
            status_count[r.status] = status_count.get(r.status, 0) + 1
        
        print(f"  状态统计: ", end="")
        for status, count in status_count.items():
            color = cls.STATUS_COLORS.get(status, "")
            print(f"{color}{status.value}({count}){cls.RESET_COLOR} ", end="")
        print()

        print(f"\n{'─'*60}")
        for idx, result in enumerate(results, 1):
            cls._print_result_item(idx, result)

    @classmethod
    def _print_result_item(cls, idx: int, result: DisputeMatchResult) -> None:
        color = cls.STATUS_COLORS.get(result.status, "")
        status_text = {
            DisputeStatus.NORMAL: "正常",
            DisputeStatus.PENDING: "待确认",
            DisputeStatus.CONFLICT: "冲突",
            DisputeStatus.ABNORMAL: "异常"
        }

        print(f"\n  [{idx}] {color}{result.customer_name} ({result.customer_id}){cls.RESET_COLOR}")
        print(f"      状态: {color}{status_text.get(result.status, result.status)}{cls.RESET_COLOR}")
        print(f"      涉及账号: {len(result.impact_accounts)}个 - {', '.join(result.impact_accounts)}")
        print(f"      争议款总额: ¥{result.total_dispute_amount:,.2f}")
        
        if result.manager_notes:
            print(f"      客户经理备注 ({len(result.manager_notes)}条):")
            for note in result.manager_notes:
                frozen_mark = "❄️" if note.frozen else "⚠️"
                print(f"        [行号{note.original_line_no}] {frozen_mark} 账号{note.account_no}: ¥{note.dispute_amount:,.2f}")
                print(f"          {note.note} ({note.manager})")

        if result.valuation_records:
            print(f"      估值记录 ({len(result.valuation_records)}条):")
            for val in result.valuation_records:
                has_note = "✅" if val.manual_note else "❌"
                print(f"        v{val.version} {has_note} 账号{val.account_no}: ¥{val.valuation_amount:,.2f}")
                if val.manual_note:
                    print(f"          人工备注: {val.manual_note}")
                else:
                    print(f"          ⚠️  缺少人工备注")

        if result.conflict_details:
            print(f"      待确认/冲突项 ({len(result.conflict_details)}项):")
            for i, conflict in enumerate(result.conflict_details, 1):
                print(f"        {i}. 🟡 {conflict}")

        print(f"      摘要: {result.summary}")
        print(f"{'─'*60}")

    @classmethod
    def generate_text_report(cls, results: List[DisputeMatchResult], output_path: str) -> None:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("信用卡争议款冻结预警报告\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"生成时间: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"客户总数: {len(results)}\n\n")

            for idx, result in enumerate(results, 1):
                f.write(f"[{idx}] {result.customer_name} ({result.customer_id})\n")
                f.write(f"    状态: {result.status.value}\n")
                f.write(f"    涉及账号: {', '.join(result.impact_accounts)}\n")
                f.write(f"    争议款总额: ¥{result.total_dispute_amount:,.2f}\n")
                
                if result.manager_notes:
                    f.write(f"    客户经理备注:\n")
                    for note in result.manager_notes:
                        f.write(f"      [行号{note.original_line_no}] 账号{note.account_no}: ¥{note.dispute_amount:,.2f}\n")
                        f.write(f"        {note.note} ({note.manager})\n")

                if result.conflict_details:
                    f.write(f"    冲突/待确认项:\n")
                    for i, conflict in enumerate(result.conflict_details, 1):
                        f.write(f"      {i}. {conflict}\n")

                f.write(f"    摘要: {result.summary}\n")
                f.write("-" * 60 + "\n")
